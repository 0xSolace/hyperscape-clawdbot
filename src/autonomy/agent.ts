/**
 * Autonomous Behavior Manager for Hyperscape
 * 
 * This manages the THINKING+ACTION loop for autonomous gameplay.
 * Runs as a sub-agent, logging to Telegram for observability.
 */

import { EventEmitter } from "events";
import type { HyperscapeClient } from "../client.js";
import type { GameState } from "../types.js";
import { 
  selectGoal, 
  createGoalContext, 
  updateGoalContext,
  type GoalTemplate,
  type GoalContext,
  type GoalProgress
} from "./goals.js";
import { 
  checkGuardrails, 
  formatGuardrailsPrompt,
  type ProposedAction 
} from "./guardrails.js";

export interface AgentConfig {
  /** Telegram chat ID for logging (optional) */
  telegramChatId?: string;
  /** Telegram topic ID for logging (optional) */
  telegramTopicId?: number;
  /** Tick interval in ms (default 10000 = 10s) */
  tickInterval?: number;
  /** Maximum session duration in ms (default 3600000 = 1 hour) */
  maxSessionDuration?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom system prompt additions */
  customPrompt?: string;
}

export interface AgentThought {
  timestamp: number;
  thinking: string;
  action: string | null;
  goal: string | null;
  warnings: string[];
}

export interface AgentStats {
  sessionStart: number;
  tickCount: number;
  goalsCompleted: number;
  xpGained: Record<string, number>;
  mobsKilled: number;
  resourcesGathered: number;
  deaths: number;
}

export class AutonomousAgent extends EventEmitter {
  private client: HyperscapeClient;
  private config: Required<AgentConfig>;
  private running = false;
  private tickTimer: NodeJS.Timeout | null = null;
  
  private goalContext: GoalContext;
  private currentGoal: GoalTemplate | null = null;
  private goalProgress: GoalProgress | null = null;
  
  private thoughts: AgentThought[] = [];
  private stats: AgentStats;
  
  // Callback for sending messages (will be wired to Telegram)
  private sendLog: ((message: string) => Promise<void>) | null = null;

  constructor(client: HyperscapeClient, config: AgentConfig = {}) {
    super();
    this.client = client;
    this.config = {
      telegramChatId: config.telegramChatId ?? "",
      telegramTopicId: config.telegramTopicId ?? 0,
      tickInterval: config.tickInterval ?? 10000,
      maxSessionDuration: config.maxSessionDuration ?? 3600000,
      verbose: config.verbose ?? false,
      customPrompt: config.customPrompt ?? "",
    };
    
    this.goalContext = createGoalContext();
    this.stats = this.createStats();
    
    // Wire up client events
    this.setupClientListeners();
  }

  private createStats(): AgentStats {
    return {
      sessionStart: Date.now(),
      tickCount: 0,
      goalsCompleted: 0,
      xpGained: {},
      mobsKilled: 0,
      resourcesGathered: 0,
      deaths: 0,
    };
  }

  private setupClientListeners(): void {
    this.client.on("xpDrop", (data: { skill: string; xp: number }) => {
      this.stats.xpGained[data.skill] = (this.stats.xpGained[data.skill] ?? 0) + data.xp;
    });

    this.client.on("death", () => {
      this.stats.deaths++;
      this.log("💀 Agent died! Will respawn...");
    });

    this.client.on("respawned", () => {
      this.log("🔄 Respawned successfully");
    });

    this.client.on("gatheringComplete", () => {
      this.stats.resourcesGathered++;
      if (this.goalProgress) {
        this.goalProgress.resourcesGathered = (this.goalProgress.resourcesGathered ?? 0) + 1;
      }
    });

    this.client.on("damageDealt", (data: { damage: number; killed?: boolean }) => {
      if (data.killed) {
        this.stats.mobsKilled++;
        if (this.goalProgress) {
          this.goalProgress.targetsKilled = (this.goalProgress.targetsKilled ?? 0) + 1;
        }
      }
    });
  }

  /**
   * Set the logging callback (typically wired to Telegram)
   */
  setLogger(logger: (message: string) => Promise<void>): void {
    this.sendLog = logger;
  }

  /**
   * Log a message (emits event + sends to Telegram if configured)
   */
  private async log(message: string): Promise<void> {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const formatted = `[${timestamp}] ${message}`;
    
    this.emit("log", formatted);
    
    if (this.config.verbose) {
      console.log(`[HyperscapeAgent] ${formatted}`);
    }
    
    if (this.sendLog) {
      try {
        await this.sendLog(formatted);
      } catch (err) {
        console.error("[HyperscapeAgent] Failed to send log:", err);
      }
    }
  }

  /**
   * Start autonomous behavior
   */
  async start(): Promise<void> {
    if (this.running) {
      await this.log("⚠️ Agent already running");
      return;
    }

    if (!this.client.state.connected) {
      throw new Error("Client not connected to Hyperscape server");
    }

    this.running = true;
    this.stats = this.createStats();
    this.goalContext = createGoalContext();
    
    await this.log("🚀 Autonomous agent started");
    await this.log(`⏱️ Max session: ${(this.config.maxSessionDuration / 60000).toFixed(0)} minutes`);
    await this.log(`🎯 Tick interval: ${(this.config.tickInterval / 1000).toFixed(0)}s`);

    // Start the tick loop
    this.scheduleNextTick();
  }

  /**
   * Stop autonomous behavior
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }

    await this.log("🛑 Autonomous agent stopped");
    await this.logStats();
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current stats
   */
  getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * Get recent thoughts
   */
  getThoughts(limit = 10): AgentThought[] {
    return this.thoughts.slice(-limit);
  }

  private scheduleNextTick(): void {
    if (!this.running) return;

    this.tickTimer = setTimeout(async () => {
      await this.tick();
      this.scheduleNextTick();
    }, this.config.tickInterval);
  }

  /**
   * Main tick - one decision cycle
   */
  private async tick(): Promise<void> {
    if (!this.running) return;

    this.stats.tickCount++;
    const state = this.client.state;

    // Update goal context timing
    this.goalContext.sessionDuration = Date.now() - this.stats.sessionStart;
    this.goalContext.timeSinceLastCombat += this.config.tickInterval;
    this.goalContext.timeSinceLastSkilling += this.config.tickInterval;

    // Check session timeout
    if (this.goalContext.sessionDuration >= this.config.maxSessionDuration) {
      await this.log("⏰ Session duration limit reached, stopping...");
      await this.stop();
      return;
    }

    // Check if we need to respawn (highest priority)
    if (state.playerEntity?.isDead) {
      await this.executeAction("hyperscape_respawn", {});
      return;
    }

    // Check if current goal is complete
    if (this.currentGoal && this.goalProgress) {
      if (this.currentGoal.isComplete(state, this.goalProgress)) {
        await this.log(`✅ Goal complete: ${this.currentGoal.name}`);
        this.goalContext = updateGoalContext(this.goalContext, this.currentGoal.id);
        this.stats.goalsCompleted++;
        this.currentGoal = null;
        this.goalProgress = null;
      }
    }

    // Select new goal if needed
    if (!this.currentGoal) {
      this.currentGoal = selectGoal(state, this.goalContext);
      if (this.currentGoal) {
        this.goalProgress = {
          goalId: this.currentGoal.id,
          startedAt: Date.now(),
        };
        await this.log(`🎯 New goal: ${this.currentGoal.name}`);
      } else {
        await this.log("🤔 No suitable goals available, exploring...");
        // Default to random movement
        await this.randomMove(state);
        return;
      }
    }

    // Generate thinking and action
    const thought = await this.think(state);
    this.thoughts.push(thought);

    // Keep only last 50 thoughts
    if (this.thoughts.length > 50) {
      this.thoughts = this.thoughts.slice(-50);
    }

    // Execute the action if we have one
    if (thought.action) {
      await this.executeThoughtAction(thought, state);
    }
  }

  /**
   * Generate THINKING + ACTION for current state
   */
  private async think(state: GameState): Promise<AgentThought> {
    const thought: AgentThought = {
      timestamp: Date.now(),
      thinking: "",
      action: null,
      goal: this.currentGoal?.name ?? null,
      warnings: [],
    };

    // Get current constraints
    const constraints = formatGuardrailsPrompt(state);
    
    // Build thinking
    const thinkingParts: string[] = [];
    
    // Current state assessment
    const hp = state.playerEntity?.health ?? 0;
    const maxHp = state.playerEntity?.maxHealth ?? 1;
    const hpPercent = (hp / maxHp * 100).toFixed(0);
    thinkingParts.push(`HP: ${hpPercent}%`);
    
    if (this.currentGoal) {
      thinkingParts.push(`Goal: ${this.currentGoal.name}`);
      thinkingParts.push(this.currentGoal.getPrompt(state));
    }

    if (constraints) {
      thinkingParts.push(`Constraints: ${constraints}`);
    }

    thought.thinking = thinkingParts.join(" | ");

    // Determine action based on goal
    if (this.currentGoal) {
      const action = this.selectActionForGoal(state, this.currentGoal);
      if (action) {
        // Check guardrails
        const guardrailCheck = checkGuardrails(state, action);
        
        if (guardrailCheck.allowed) {
          thought.action = JSON.stringify(action);
          thought.warnings = guardrailCheck.warnings;
        } else {
          // Action blocked by guardrails
          thought.warnings = guardrailCheck.violations.map(v => v.message);
          thought.thinking += ` | BLOCKED: ${guardrailCheck.violations[0]?.message}`;
          
          // Try to find alternative action
          const altAction = this.getAlternativeAction(state, guardrailCheck);
          if (altAction) {
            thought.action = JSON.stringify(altAction);
          }
        }
      }
    }

    return thought;
  }

  /**
   * Select the appropriate action for current goal
   */
  private selectActionForGoal(state: GameState, goal: GoalTemplate): ProposedAction | null {
    const nearbyMobs = Array.from(state.nearbyEntities.values())
      .filter(e => e.type === "mob" && e.alive !== false);
    const nearbyResources = Array.from(state.nearbyEntities.values())
      .filter(e => ["resource", "tree", "rock", "fishing"].includes(e.type ?? ""));
    const groundItems = Array.from(state.nearbyEntities.values())
      .filter(e => e.type === "item" || e.type === "groundItem");

    switch (goal.id) {
      case "flee_danger":
        // Move away from threats
        return { tool: "hyperscape_home_teleport", params: {} };

      case "eat_food":
        const food = state.playerEntity?.inventory?.find(i => 
          i.name?.toLowerCase().includes("fish") || 
          i.name?.toLowerCase().includes("meat") ||
          i.name?.toLowerCase().includes("bread")
        );
        if (food) {
          return { tool: "hyperscape_use_item", params: { itemId: food.itemId } };
        }
        break;

      case "respawn":
        return { tool: "hyperscape_respawn", params: {} };

      case "train_combat":
        if (nearbyMobs.length > 0) {
          // Pick lowest level mob
          const target = nearbyMobs.sort((a, b) => (a.level ?? 1) - (b.level ?? 1))[0];
          return { tool: "hyperscape_attack", params: { targetId: target.id } };
        }
        break;

      case "gather_resources":
        if (nearbyResources.length > 0) {
          const target = nearbyResources[0];
          return { tool: "hyperscape_gather", params: { resourceId: target.id } };
        }
        break;

      case "collect_loot":
        if (groundItems.length > 0) {
          const target = groundItems[0];
          return { tool: "hyperscape_pickup", params: { itemId: target.id } };
        }
        break;

      case "explore_area":
        // Random movement
        const pos = state.playerEntity?.position ?? [0, 0, 0];
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 20;
        return {
          tool: "hyperscape_move",
          params: {
            x: pos[0] + Math.cos(angle) * distance,
            y: pos[1],
            z: pos[2] + Math.sin(angle) * distance,
          }
        };

      case "bank_items":
        if (state.bankOpen) {
          return { tool: "hyperscape_bank_deposit_all", params: {} };
        }
        // Find bank NPC
        const bankNpc = Array.from(state.nearbyEntities.values())
          .find(e => e.name?.toLowerCase().includes("bank"));
        if (bankNpc) {
          return { tool: "hyperscape_npc_interact", params: { npcId: bankNpc.id, action: "bank" } };
        }
        break;
    }

    return null;
  }

  /**
   * Get alternative action when primary is blocked
   */
  private getAlternativeAction(state: GameState, guardrailResult: ReturnType<typeof checkGuardrails>): ProposedAction | null {
    // If health is critical, always try to heal or flee
    const hp = (state.playerEntity?.health ?? 0) / (state.playerEntity?.maxHealth ?? 1) * 100;
    
    if (hp < 25) {
      // Try to eat food
      const food = state.playerEntity?.inventory?.find(i => 
        i.name?.toLowerCase().includes("fish") || i.name?.toLowerCase().includes("meat")
      );
      if (food) {
        return { tool: "hyperscape_use_item", params: { itemId: food.itemId } };
      }
      // Otherwise flee
      return { tool: "hyperscape_home_teleport", params: {} };
    }

    // If in dialogue/bank/store, handle those
    if (state.dialogueOpen) {
      return { tool: "hyperscape_dialogue_continue", params: {} };
    }
    if (state.bankOpen) {
      return { tool: "hyperscape_bank_close", params: {} };
    }
    if (state.storeOpen) {
      return { tool: "hyperscape_store_close", params: {} };
    }

    return null;
  }

  /**
   * Execute the action from a thought
   */
  private async executeThoughtAction(thought: AgentThought, state: GameState): Promise<void> {
    if (!thought.action) return;

    try {
      const action: ProposedAction = JSON.parse(thought.action);
      await this.executeAction(action.tool, action.params);
    } catch (err) {
      console.error("[HyperscapeAgent] Failed to execute action:", err);
    }
  }

  /**
   * Execute a game action
   */
  private async executeAction(tool: string, params: Record<string, unknown>): Promise<void> {
    if (this.config.verbose) {
      await this.log(`🎮 Action: ${tool} ${JSON.stringify(params)}`);
    }

    // Map tool to client method
    switch (tool) {
      case "hyperscape_move":
        this.client.move([params.x as number, params.y as number, params.z as number], true);
        break;
      case "hyperscape_attack":
        this.client.attack(params.targetId as string);
        break;
      case "hyperscape_gather":
        this.client.interactResource(params.resourceId as string);
        break;
      case "hyperscape_pickup":
        this.client.pickup(params.itemId as string);
        break;
      case "hyperscape_use_item":
        this.client.useItem(params.itemId as string);
        break;
      case "hyperscape_respawn":
        this.client.respawn();
        break;
      case "hyperscape_home_teleport":
        this.client.homeTeleport();
        break;
      case "hyperscape_npc_interact":
        this.client.npcInteract(params.npcId as string, params.action as string);
        break;
      case "hyperscape_bank_deposit_all":
        this.client.bankDepositAll();
        break;
      case "hyperscape_bank_close":
        this.client.bankClose();
        break;
      case "hyperscape_store_close":
        this.client.storeClose();
        break;
      case "hyperscape_dialogue_continue":
        this.client.dialogueContinue();
        break;
      case "hyperscape_dialogue_close":
        this.client.dialogueClose();
        break;
      default:
        console.warn(`[HyperscapeAgent] Unknown action: ${tool}`);
    }
  }

  /**
   * Random movement when no goal
   */
  private async randomMove(state: GameState): Promise<void> {
    const pos = state.playerEntity?.position ?? [0, 0, 0];
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * 15;
    
    this.client.move([
      pos[0] + Math.cos(angle) * distance,
      pos[1],
      pos[2] + Math.sin(angle) * distance
    ], true);
  }

  /**
   * Log session statistics
   */
  private async logStats(): Promise<void> {
    const duration = Math.floor((Date.now() - this.stats.sessionStart) / 60000);
    const totalXp = Object.values(this.stats.xpGained).reduce((a, b) => a + b, 0);
    
    const statsMsg = `
📊 **Session Stats**
⏱️ Duration: ${duration} minutes
🎯 Goals completed: ${this.stats.goalsCompleted}
⚔️ Mobs killed: ${this.stats.mobsKilled}
🪨 Resources gathered: ${this.stats.resourcesGathered}
✨ Total XP: ${totalXp.toLocaleString()}
💀 Deaths: ${this.stats.deaths}
`.trim();

    await this.log(statsMsg);
  }
}

/**
 * Create and configure an autonomous agent
 */
export function createAutonomousAgent(
  client: HyperscapeClient, 
  config: AgentConfig = {}
): AutonomousAgent {
  return new AutonomousAgent(client, config);
}
