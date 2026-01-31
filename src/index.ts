/**
 * @openclaw/skill-hyperscape
 *
 * OpenClaw skill for playing Hyperscape MMORPG.
 * Provides tools for connecting to game server, movement, combat, skills, and more.
 * 
 * Features:
 * - 32+ tools for manual gameplay
 * - Autonomous agent mode with goals, guardrails, and THINKING+ACTION loop
 * - Telegram logging for observability
 */

export { HyperscapeClient } from "./client.js";
export * from "./types.js";
export * from "./autonomy/index.js";

// Singleton instances
let client: import("./client.js").HyperscapeClient | null = null;
let autonomousAgent: import("./autonomy/agent.js").AutonomousAgent | null = null;

/**
 * Get the current Hyperscape client instance (may be null if not connected)
 */
export function getClient(): import("./client.js").HyperscapeClient | null {
  return client;
}

/**
 * Get or create the Hyperscape client instance
 */
export function ensureClient(): import("./client.js").HyperscapeClient {
  if (!client) {
    const { HyperscapeClient } = require("./client.js");
    client = new HyperscapeClient();
  }
  return client!;
}

/**
 * Reset the client (for testing or reconnection)
 */
export function resetClient(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
}

// === Tool Definitions for Clawdbot ===

export const tools = {
  // === Connection ===
  hyperscape_connect: {
    description: "Connect to a Hyperscape game server and enter the world",
    parameters: {
      serverUrl: { type: "string", description: "WebSocket URL (optional, defaults to localhost:5555)" },
      authToken: { type: "string", description: "Auth token (optional, uses env var if not provided)" },
    },
    handler: async (params: { serverUrl?: string; authToken?: string }) => {
      const { HyperscapeClient } = await import("./client.js");
      client = new HyperscapeClient({ 
        serverUrl: params.serverUrl,
        authToken: params.authToken 
      });
      await client.connect();
      await client.enterWorld();
      client.clientReady();
      return { success: true, message: "Connected to Hyperscape server and entered world" };
    },
  },

  hyperscape_disconnect: {
    description: "Disconnect from Hyperscape server",
    parameters: {},
    handler: async () => {
      if (!client) return { success: false, message: "Not connected" };
      client.disconnect();
      client = null;
      return { success: true, message: "Disconnected" };
    },
  },

  hyperscape_status: {
    description: "Get current game state, position, health, skills, inventory, and nearby entities",
    parameters: {},
    handler: async () => {
      if (!client) return { success: false, message: "Not connected to Hyperscape" };
      return {
        success: true,
        context: client.getStateContext(),
        availableActions: client.getAvailableActions(),
        bankContext: client.state.bankOpen ? client.getBankContext() : undefined,
      };
    },
  },

  // === Movement ===
  hyperscape_move: {
    description: "Move to a position in the game world",
    parameters: {
      x: { type: "number", description: "X coordinate", required: true },
      y: { type: "number", description: "Y coordinate (height)", required: true },
      z: { type: "number", description: "Z coordinate", required: true },
      run: { type: "boolean", description: "Run instead of walk (default true)" },
    },
    handler: async (params: { x: number; y: number; z: number; run?: boolean }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.move([params.x, params.y, params.z], params.run ?? true);
      return { success: true, message: `Moving to [${params.x}, ${params.y}, ${params.z}]` };
    },
  },

  hyperscape_home_teleport: {
    description: "Teleport to home/spawn location",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.homeTeleport();
      return { success: true, message: "Casting home teleport..." };
    },
  },

  // === Combat ===
  hyperscape_attack: {
    description: "Attack a mob or enemy",
    parameters: {
      targetId: { type: "string", description: "Entity ID to attack", required: true },
      attackType: { type: "string", description: "Attack type: melee, ranged, or magic (default melee)" },
    },
    handler: async (params: { targetId: string; attackType?: "melee" | "ranged" | "magic" }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.attack(params.targetId, params.attackType ?? "melee");
      return { success: true, message: `Attacking ${params.targetId}` };
    },
  },

  hyperscape_change_attack_style: {
    description: "Change combat attack style",
    parameters: {
      style: { type: "string", description: "Attack style to use", required: true },
    },
    handler: async (params: { style: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.changeAttackStyle(params.style);
      return { success: true, message: `Changed attack style to ${params.style}` };
    },
  },

  hyperscape_auto_retaliate: {
    description: "Toggle auto-retaliate on or off",
    parameters: {
      enabled: { type: "boolean", description: "Enable or disable auto-retaliate", required: true },
    },
    handler: async (params: { enabled: boolean }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.setAutoRetaliate(params.enabled);
      return { success: true, message: `Auto-retaliate ${params.enabled ? "enabled" : "disabled"}` };
    },
  },

  hyperscape_respawn: {
    description: "Respawn after death",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.respawn();
      return { success: true, message: "Requesting respawn..." };
    },
  },

  // === Gathering ===
  hyperscape_gather: {
    description: "Gather from a resource (tree, rock, fishing spot)",
    parameters: {
      resourceId: { type: "string", description: "Resource entity ID", required: true },
    },
    handler: async (params: { resourceId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.interactResource(params.resourceId);
      return { success: true, message: `Gathering from ${params.resourceId}` };
    },
  },

  hyperscape_cook: {
    description: "Cook food on a fire or range",
    parameters: {
      itemId: { type: "string", description: "Food item ID to cook", required: true },
      sourceId: { type: "string", description: "Fire/range entity ID (optional)" },
    },
    handler: async (params: { itemId: string; sourceId?: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.cook(params.itemId, params.sourceId);
      return { success: true, message: `Cooking ${params.itemId}` };
    },
  },

  hyperscape_light_fire: {
    description: "Light a fire using tinderbox and logs",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.lightFire();
      return { success: true, message: "Lighting fire..." };
    },
  },

  // === Inventory ===
  hyperscape_pickup: {
    description: "Pick up an item from the ground",
    parameters: {
      itemId: { type: "string", description: "Ground item ID", required: true },
    },
    handler: async (params: { itemId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.pickup(params.itemId);
      return { success: true, message: `Picking up ${params.itemId}` };
    },
  },

  hyperscape_drop: {
    description: "Drop an item from inventory",
    parameters: {
      itemId: { type: "string", description: "Item ID to drop", required: true },
      quantity: { type: "number", description: "Quantity to drop (default 1)" },
    },
    handler: async (params: { itemId: string; quantity?: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.drop(params.itemId, params.quantity ?? 1);
      return { success: true, message: `Dropped ${params.quantity ?? 1}x ${params.itemId}` };
    },
  },

  hyperscape_equip: {
    description: "Equip an item from inventory",
    parameters: {
      itemId: { type: "string", description: "Item ID to equip", required: true },
    },
    handler: async (params: { itemId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.equip(params.itemId);
      return { success: true, message: `Equipped ${params.itemId}` };
    },
  },

  hyperscape_unequip: {
    description: "Unequip an item to inventory",
    parameters: {
      slot: { type: "string", description: "Equipment slot to unequip", required: true },
    },
    handler: async (params: { slot: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.unequip(params.slot);
      return { success: true, message: `Unequipped ${params.slot}` };
    },
  },

  hyperscape_use_item: {
    description: "Use an item (eat food, drink potion, etc)",
    parameters: {
      itemId: { type: "string", description: "Item ID to use", required: true },
    },
    handler: async (params: { itemId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.useItem(params.itemId);
      return { success: true, message: `Using ${params.itemId}` };
    },
  },

  // === Banking ===
  hyperscape_bank_deposit: {
    description: "Deposit item to bank (bank must be open)",
    parameters: {
      itemId: { type: "string", description: "Item ID to deposit", required: true },
      quantity: { type: "number", description: "Quantity to deposit (default 1)" },
    },
    handler: async (params: { itemId: string; quantity?: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      if (!client.state.bankOpen) return { success: false, message: "Bank is not open" };
      client.bankDeposit(params.itemId, params.quantity ?? 1);
      return { success: true, message: `Depositing ${params.quantity ?? 1}x ${params.itemId}` };
    },
  },

  hyperscape_bank_deposit_all: {
    description: "Deposit all inventory items to bank",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      if (!client.state.bankOpen) return { success: false, message: "Bank is not open" };
      client.bankDepositAll();
      return { success: true, message: "Depositing all items" };
    },
  },

  hyperscape_bank_withdraw: {
    description: "Withdraw item from bank",
    parameters: {
      itemId: { type: "string", description: "Item ID to withdraw", required: true },
      quantity: { type: "number", description: "Quantity to withdraw (default 1)" },
    },
    handler: async (params: { itemId: string; quantity?: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      if (!client.state.bankOpen) return { success: false, message: "Bank is not open" };
      client.bankWithdraw(params.itemId, params.quantity ?? 1);
      return { success: true, message: `Withdrawing ${params.quantity ?? 1}x ${params.itemId}` };
    },
  },

  hyperscape_bank_close: {
    description: "Close the bank interface",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.bankClose();
      return { success: true, message: "Bank closed" };
    },
  },

  // === NPC Interaction ===
  hyperscape_npc_interact: {
    description: "Interact with an NPC (talk, trade, bank, etc)",
    parameters: {
      npcId: { type: "string", description: "NPC entity ID", required: true },
      action: { type: "string", description: "Interaction type (talk, trade, bank)" },
    },
    handler: async (params: { npcId: string; action?: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.npcInteract(params.npcId, params.action);
      return { success: true, message: `Interacting with ${params.npcId}` };
    },
  },

  hyperscape_dialogue_respond: {
    description: "Select a dialogue option",
    parameters: {
      optionIndex: { type: "number", description: "Option number (0-indexed)", required: true },
    },
    handler: async (params: { optionIndex: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.dialogueResponse(params.optionIndex);
      return { success: true, message: `Selected option ${params.optionIndex}` };
    },
  },

  hyperscape_dialogue_continue: {
    description: "Continue dialogue (click to proceed)",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.dialogueContinue();
      return { success: true, message: "Continuing dialogue" };
    },
  },

  hyperscape_dialogue_close: {
    description: "Close dialogue window",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.dialogueClose();
      return { success: true, message: "Dialogue closed" };
    },
  },

  // === Store ===
  hyperscape_store_buy: {
    description: "Buy an item from a store",
    parameters: {
      itemId: { type: "string", description: "Item ID to buy", required: true },
      quantity: { type: "number", description: "Quantity to buy (default 1)" },
    },
    handler: async (params: { itemId: string; quantity?: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      if (!client.state.storeOpen) return { success: false, message: "Store is not open" };
      client.storeBuy(params.itemId, params.quantity ?? 1);
      return { success: true, message: `Buying ${params.quantity ?? 1}x ${params.itemId}` };
    },
  },

  hyperscape_store_sell: {
    description: "Sell an item to a store",
    parameters: {
      itemId: { type: "string", description: "Item ID to sell", required: true },
      quantity: { type: "number", description: "Quantity to sell (default 1)" },
    },
    handler: async (params: { itemId: string; quantity?: number }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      if (!client.state.storeOpen) return { success: false, message: "Store is not open" };
      client.storeSell(params.itemId, params.quantity ?? 1);
      return { success: true, message: `Selling ${params.quantity ?? 1}x ${params.itemId}` };
    },
  },

  hyperscape_store_close: {
    description: "Close the store interface",
    parameters: {},
    handler: async () => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.storeClose();
      return { success: true, message: "Store closed" };
    },
  },

  // === Social ===
  hyperscape_chat: {
    description: "Send a chat message in the game",
    parameters: {
      message: { type: "string", description: "Message to send", required: true },
      channel: { type: "string", description: "Chat channel (local, global)" },
    },
    handler: async (params: { message: string; channel?: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.chat(params.message, params.channel ?? "local");
      return { success: true, message: `Sent: ${params.message}` };
    },
  },

  hyperscape_follow: {
    description: "Follow another player",
    parameters: {
      playerId: { type: "string", description: "Player ID to follow", required: true },
    },
    handler: async (params: { playerId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.followPlayer(params.playerId);
      return { success: true, message: `Following ${params.playerId}` };
    },
  },

  // === Autonomous Agent ===
  hyperscape_auto_start: {
    description: "Start autonomous agent mode. The agent will play the game independently using goals, guardrails, and THINKING+ACTION loop. Logs to Telegram topic if configured.",
    parameters: {
      serverUrl: { type: "string", description: "WebSocket URL (optional)" },
      authToken: { type: "string", description: "Auth token (optional)" },
      telegramChatId: { type: "string", description: "Telegram chat ID for logging" },
      telegramTopicId: { type: "number", description: "Telegram topic ID for logging" },
      tickInterval: { type: "number", description: "Decision interval in ms (default 10000)" },
      maxDuration: { type: "number", description: "Max session duration in minutes (default 60)" },
      verbose: { type: "boolean", description: "Enable verbose logging" },
    },
    handler: async (params: {
      serverUrl?: string;
      authToken?: string;
      telegramChatId?: string;
      telegramTopicId?: number;
      tickInterval?: number;
      maxDuration?: number;
      verbose?: boolean;
    }) => {
      // Lazy import to avoid circular deps
      const { HyperscapeClient } = await import("./client.js");
      const { createAutonomousAgent } = await import("./autonomy/agent.js");

      // Create client if needed
      if (!client) {
        client = new HyperscapeClient({
          serverUrl: params.serverUrl,
          authToken: params.authToken,
        });
        await client.connect();
        await client.enterWorld();
        client.clientReady();
      }

      // Create autonomous agent
      autonomousAgent = createAutonomousAgent(client, {
        telegramChatId: params.telegramChatId,
        telegramTopicId: params.telegramTopicId,
        tickInterval: params.tickInterval ?? 10000,
        maxSessionDuration: (params.maxDuration ?? 60) * 60000,
        verbose: params.verbose ?? false,
      });

      // Start the agent
      await autonomousAgent.start();

      return {
        success: true,
        message: "Autonomous agent started",
        config: {
          tickInterval: params.tickInterval ?? 10000,
          maxDuration: params.maxDuration ?? 60,
          logging: params.telegramChatId ? `Telegram ${params.telegramChatId}` : "console only",
        },
      };
    },
  },

  hyperscape_auto_stop: {
    description: "Stop the autonomous agent and return to manual control",
    parameters: {},
    handler: async () => {
      if (!autonomousAgent) {
        return { success: false, message: "No autonomous agent running" };
      }

      await autonomousAgent.stop();
      const stats = autonomousAgent.getStats();
      autonomousAgent = null;

      return {
        success: true,
        message: "Autonomous agent stopped",
        stats: {
          duration: Math.floor((Date.now() - stats.sessionStart) / 60000),
          goalsCompleted: stats.goalsCompleted,
          mobsKilled: stats.mobsKilled,
          resourcesGathered: stats.resourcesGathered,
          totalXp: Object.values(stats.xpGained).reduce((a, b) => a + b, 0),
          deaths: stats.deaths,
        },
      };
    },
  },

  hyperscape_auto_status: {
    description: "Get current autonomous agent status, stats, and recent thoughts",
    parameters: {
      thoughtCount: { type: "number", description: "Number of recent thoughts to return (default 5)" },
    },
    handler: async (params: { thoughtCount?: number }) => {
      if (!autonomousAgent) {
        return { 
          success: true, 
          running: false, 
          message: "No autonomous agent running" 
        };
      }

      const stats = autonomousAgent.getStats();
      const thoughts = autonomousAgent.getThoughts(params.thoughtCount ?? 5);

      return {
        success: true,
        running: autonomousAgent.isRunning(),
        stats: {
          duration: Math.floor((Date.now() - stats.sessionStart) / 60000),
          tickCount: stats.tickCount,
          goalsCompleted: stats.goalsCompleted,
          mobsKilled: stats.mobsKilled,
          resourcesGathered: stats.resourcesGathered,
          totalXp: Object.values(stats.xpGained).reduce((a, b) => a + b, 0),
          deaths: stats.deaths,
        },
        recentThoughts: thoughts.map(t => ({
          time: new Date(t.timestamp).toISOString(),
          goal: t.goal,
          thinking: t.thinking,
          action: t.action,
          warnings: t.warnings,
        })),
      };
    },
  },

  hyperscape_auto_set_logger: {
    description: "Set a custom logging function for the autonomous agent (advanced)",
    parameters: {},
    handler: async () => {
      return {
        success: false,
        message: "Use the telegramChatId/telegramTopicId params in hyperscape_auto_start instead",
      };
    },
  },
};

// Provider for context injection
export const providers = {
  gameState: {
    description: "Current game state including position, health, skills, inventory",
    get: () => {
      if (!client) return "Not connected to Hyperscape.";
      return client.getStateContext();
    },
  },
  availableActions: {
    description: "List of actions available based on current game context",
    get: () => {
      if (!client) return ["hyperscape_connect"];
      return client.getAvailableActions();
    },
  },
  bankState: {
    description: "Current bank contents (when bank is open)",
    get: () => {
      if (!client?.state.bankOpen) return null;
      return client.getBankContext();
    },
  },
  autonomousStatus: {
    description: "Status of autonomous agent (if running)",
    get: () => {
      if (!autonomousAgent) return { running: false };
      const stats = autonomousAgent.getStats();
      return {
        running: autonomousAgent.isRunning(),
        duration: Math.floor((Date.now() - stats.sessionStart) / 60000),
        goalsCompleted: stats.goalsCompleted,
        recentThoughts: autonomousAgent.getThoughts(3),
      };
    },
  },
};

export default {
  name: "hyperscape",
  description: "Play Hyperscape MMORPG as an AI agent. Connect to game servers, move around, fight mobs, gather resources, manage inventory, trade with NPCs, and more. Supports autonomous mode with goal-based AI.",
  tools,
  providers,
};
