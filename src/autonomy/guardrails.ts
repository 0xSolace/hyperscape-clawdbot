/**
 * Guardrails for Autonomous Hyperscape Agent
 * 
 * Safety rules and constraints to prevent bad behavior.
 * These are hard limits the agent cannot violate.
 */

import type { GameState, Entity } from "../types.js";

export interface Guardrail {
  id: string;
  name: string;
  description: string;
  severity: "warning" | "block" | "critical";
  
  /** Check if this guardrail is currently triggered */
  isTriggered: (state: GameState, action: ProposedAction) => boolean;
  
  /** Get the constraint message to include in prompt */
  getMessage: (state: GameState) => string;
}

export interface ProposedAction {
  tool: string;
  params: Record<string, unknown>;
}

export interface GuardrailResult {
  allowed: boolean;
  violations: Array<{
    guardrail: Guardrail;
    message: string;
  }>;
  warnings: string[];
}

// === Helper Functions ===

function getHealthPercent(state: GameState): number {
  const player = state.playerEntity;
  if (!player || !player.maxHealth) return 100;
  return (player.health ?? 0) / player.maxHealth * 100;
}

function isValuableItem(itemId: string, itemName?: string): boolean {
  const valuablePatterns = [
    "rune", "dragon", "mystic", "amulet", "ring", "necklace",
    "ancient", "rare", "unique", "gold", "coin"
  ];
  const name = (itemName ?? itemId).toLowerCase();
  return valuablePatterns.some(p => name.includes(p));
}

function getMobLevel(mob: Entity): number {
  return mob.level ?? mob.combatLevel ?? 1;
}

function getPlayerCombatLevel(state: GameState): number {
  const skills = state.playerEntity?.skills ?? {};
  const attack = skills.attack?.level ?? 1;
  const strength = skills.strength?.level ?? 1;
  const defence = skills.defence?.level ?? 1;
  const hitpoints = skills.hitpoints?.level ?? 10;
  
  // Simplified combat level calc
  return Math.floor((attack + strength + defence + hitpoints) / 4);
}

// === Guardrails ===

export const GUARDRAILS: Guardrail[] = [
  // === SURVIVAL GUARDRAILS ===
  {
    id: "no_combat_low_hp",
    name: "No Combat at Low HP",
    description: "Do not engage in combat when health is critically low",
    severity: "block",
    isTriggered: (state, action) => {
      const combatActions = ["hyperscape_attack"];
      if (!combatActions.includes(action.tool)) return false;
      return getHealthPercent(state) < 25;
    },
    getMessage: (state) => `⚠️ BLOCKED: Health is at ${getHealthPercent(state).toFixed(0)}%. Do not attack anything - flee and heal first!`,
  },

  {
    id: "flee_threshold",
    name: "Force Flee at Critical HP",
    description: "Must flee when HP drops below 15%",
    severity: "critical",
    isTriggered: (state) => {
      return getHealthPercent(state) < 15 && !state.playerEntity?.isDead;
    },
    getMessage: () => `🚨 CRITICAL: Health below 15%! MUST flee immediately. All other goals suspended until safe.`,
  },

  // === ITEM PROTECTION ===
  {
    id: "no_drop_valuables",
    name: "Don't Drop Valuable Items",
    description: "Never drop rare or valuable items",
    severity: "block",
    isTriggered: (state, action) => {
      if (action.tool !== "hyperscape_drop") return false;
      const itemId = action.params.itemId as string;
      const item = state.playerEntity?.inventory?.find(i => i.itemId === itemId);
      return isValuableItem(itemId, item?.name);
    },
    getMessage: () => `⚠️ BLOCKED: Cannot drop valuable items. Bank them instead.`,
  },

  {
    id: "no_sell_valuables",
    name: "Don't Sell Valuable Items",
    description: "Never sell rare items to NPC stores",
    severity: "warning",
    isTriggered: (state, action) => {
      if (action.tool !== "hyperscape_store_sell") return false;
      const itemId = action.params.itemId as string;
      const item = state.playerEntity?.inventory?.find(i => i.itemId === itemId);
      return isValuableItem(itemId, item?.name);
    },
    getMessage: () => `⚠️ WARNING: About to sell a valuable item. Consider banking instead.`,
  },

  // === COMBAT SAFETY ===
  {
    id: "no_attack_high_level",
    name: "Don't Attack Overpowered Mobs",
    description: "Don't attack mobs significantly higher level",
    severity: "warning",
    isTriggered: (state, action) => {
      if (action.tool !== "hyperscape_attack") return false;
      const targetId = action.params.targetId as string;
      const target = state.nearbyEntities.get(targetId);
      if (!target) return false;
      
      const mobLevel = getMobLevel(target);
      const playerLevel = getPlayerCombatLevel(state);
      
      return mobLevel > playerLevel + 10;
    },
    getMessage: (state) => {
      const playerLevel = getPlayerCombatLevel(state);
      return `⚠️ WARNING: Target is much higher level than you (combat level ~${playerLevel}). Consider finding easier targets.`;
    },
  },

  {
    id: "no_multi_combat",
    name: "Avoid Attacking While Already in Combat",
    description: "Don't engage new enemies when already fighting",
    severity: "warning",
    isTriggered: (state, action) => {
      if (action.tool !== "hyperscape_attack") return false;
      
      // Check if we already have a target (in combat)
      const currentTarget = state.currentTarget;
      const newTarget = action.params.targetId as string;
      
      // Warn if switching targets mid-combat
      return currentTarget !== null && currentTarget !== newTarget;
    },
    getMessage: () => `⚠️ WARNING: Already fighting another target. Focus on current enemy first.`,
  },

  // === RESOURCE MANAGEMENT ===
  {
    id: "inventory_full_warning",
    name: "Inventory Full Warning",
    description: "Warn when inventory is nearly full",
    severity: "warning",
    isTriggered: (state, action) => {
      const gatherActions = ["hyperscape_gather", "hyperscape_pickup"];
      if (!gatherActions.includes(action.tool)) return false;
      
      const inv = state.playerEntity?.inventory ?? [];
      return inv.length >= 26; // 26/28 slots
    },
    getMessage: () => `⚠️ WARNING: Inventory almost full (26+/28 slots). Consider banking soon.`,
  },

  // === UI STATE GUARDRAILS ===
  {
    id: "respect_dialogue",
    name: "Complete Dialogue First",
    description: "Don't interrupt active dialogues",
    severity: "block",
    isTriggered: (state, action) => {
      if (!state.dialogueOpen) return false;
      
      const dialogueActions = [
        "hyperscape_dialogue_respond",
        "hyperscape_dialogue_continue",
        "hyperscape_dialogue_close"
      ];
      
      // Block non-dialogue actions when in dialogue
      return !dialogueActions.includes(action.tool);
    },
    getMessage: () => `⚠️ BLOCKED: Dialogue is open. Complete or close the dialogue first.`,
  },

  {
    id: "respect_bank",
    name: "Complete Banking First",
    description: "Don't wander off with bank open",
    severity: "block",
    isTriggered: (state, action) => {
      if (!state.bankOpen) return false;
      
      const bankActions = [
        "hyperscape_bank_deposit",
        "hyperscape_bank_deposit_all",
        "hyperscape_bank_withdraw",
        "hyperscape_bank_close"
      ];
      const allowedActions = [...bankActions, "hyperscape_status"];
      
      return !allowedActions.includes(action.tool);
    },
    getMessage: () => `⚠️ BLOCKED: Bank is open. Complete banking or close the bank first.`,
  },

  {
    id: "respect_store",
    name: "Complete Store Transaction First",
    description: "Don't leave store without closing",
    severity: "block",
    isTriggered: (state, action) => {
      if (!state.storeOpen) return false;
      
      const storeActions = [
        "hyperscape_store_buy",
        "hyperscape_store_sell",
        "hyperscape_store_close"
      ];
      const allowedActions = [...storeActions, "hyperscape_status"];
      
      return !allowedActions.includes(action.tool);
    },
    getMessage: () => `⚠️ BLOCKED: Store is open. Complete transaction or close the store first.`,
  },
];

/**
 * Check all guardrails against a proposed action
 */
export function checkGuardrails(state: GameState, action: ProposedAction): GuardrailResult {
  const violations: GuardrailResult["violations"] = [];
  const warnings: string[] = [];
  let allowed = true;

  for (const guardrail of GUARDRAILS) {
    if (guardrail.isTriggered(state, action)) {
      const message = guardrail.getMessage(state);
      
      if (guardrail.severity === "block" || guardrail.severity === "critical") {
        violations.push({ guardrail, message });
        allowed = false;
      } else {
        warnings.push(message);
      }
    }
  }

  return { allowed, violations, warnings };
}

/**
 * Get all currently active guardrail constraints for prompt injection
 */
export function getActiveConstraints(state: GameState): string[] {
  const constraints: string[] = [];

  // Check health-based constraints
  const hp = getHealthPercent(state);
  if (hp < 15) {
    constraints.push("🚨 CRITICAL HP (<15%): Flee immediately, heal, do not engage combat");
  } else if (hp < 25) {
    constraints.push("⚠️ LOW HP (<25%): Prioritize healing, avoid combat");
  } else if (hp < 50) {
    constraints.push("⚡ MODERATE HP (<50%): Consider eating before combat");
  }

  // Check UI state constraints
  if (state.dialogueOpen) {
    constraints.push("📜 DIALOGUE OPEN: Must complete or close dialogue before other actions");
  }
  if (state.bankOpen) {
    constraints.push("🏦 BANK OPEN: Must close bank before moving or fighting");
  }
  if (state.storeOpen) {
    constraints.push("🏪 STORE OPEN: Must close store before moving or fighting");
  }

  // Check inventory
  const invSpace = 28 - (state.playerEntity?.inventory?.length ?? 0);
  if (invSpace === 0) {
    constraints.push("📦 INVENTORY FULL: Cannot pick up more items, consider banking");
  } else if (invSpace < 5) {
    constraints.push(`📦 INVENTORY NEARLY FULL (${invSpace} slots): Bank soon`);
  }

  // Check combat state
  if (state.currentTarget) {
    constraints.push(`⚔️ IN COMBAT with target ${state.currentTarget}: Focus on current fight`);
  }

  return constraints;
}

/**
 * Format guardrails for inclusion in agent prompt
 */
export function formatGuardrailsPrompt(state: GameState): string {
  const constraints = getActiveConstraints(state);
  
  if (constraints.length === 0) {
    return "";
  }

  return `
## Active Constraints
${constraints.map(c => `- ${c}`).join("\n")}
`.trim();
}
