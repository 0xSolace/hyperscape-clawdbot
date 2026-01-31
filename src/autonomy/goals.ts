/**
 * Goal Templates for Autonomous Hyperscape Agent
 * 
 * Each goal has conditions, priority scoring, and completion criteria.
 * Inspired by plugin-hyperscape's goalTemplatesProvider.
 */

import type { GameState, Entity, SkillData } from "../types.js";

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: "combat" | "skilling" | "gathering" | "exploration" | "social" | "survival";
  
  /** Check if this goal is currently possible */
  isPossible: (state: GameState) => boolean;
  
  /** Score this goal (higher = more priority). Returns 0-100 */
  score: (state: GameState, context: GoalContext) => number;
  
  /** Check if goal is complete */
  isComplete: (state: GameState, progress: GoalProgress) => boolean;
  
  /** Get action prompt for the agent */
  getPrompt: (state: GameState) => string;
}

export interface GoalContext {
  recentGoals: string[];           // Last N goals attempted
  recentGoalCounts: Record<string, number>;
  timeSinceLastCombat: number;     // ms
  timeSinceLastSkilling: number;   // ms
  sessionDuration: number;         // ms
  xpGained: Record<string, number>;
}

export interface GoalProgress {
  goalId: string;
  startedAt: number;
  targetsKilled?: number;
  resourcesGathered?: number;
  xpGained?: number;
  itemsCollected?: number;
}

// === Helper Functions ===

function getHealthPercent(state: GameState): number {
  const player = state.playerEntity;
  if (!player || !player.maxHealth) return 100;
  return (player.health ?? 0) / player.maxHealth * 100;
}

function hasFood(state: GameState): boolean {
  const inv = state.playerEntity?.inventory ?? [];
  return inv.some(item => 
    item.name?.toLowerCase().includes("fish") ||
    item.name?.toLowerCase().includes("meat") ||
    item.name?.toLowerCase().includes("bread") ||
    item.itemId?.includes("cooked")
  );
}

function hasWeapon(state: GameState): boolean {
  const equipment = state.playerEntity?.equipment ?? {};
  return !!equipment.weapon || !!equipment.mainhand;
}

function getNearbyMobs(state: GameState): Entity[] {
  return Array.from(state.nearbyEntities.values())
    .filter(e => e.type === "mob" && e.alive !== false);
}

function getNearbyResources(state: GameState): Entity[] {
  return Array.from(state.nearbyEntities.values())
    .filter(e => ["resource", "tree", "rock", "fishing"].includes(e.type ?? ""));
}

function getGroundItems(state: GameState): Entity[] {
  return Array.from(state.nearbyEntities.values())
    .filter(e => e.type === "item" || e.type === "groundItem");
}

function getSkillLevel(state: GameState, skill: string): number {
  return state.playerEntity?.skills?.[skill]?.level ?? 1;
}

function getInventorySpace(state: GameState): number {
  const inv = state.playerEntity?.inventory ?? [];
  return 28 - inv.length; // Assuming 28 slot inventory
}

function getDiversityPenalty(goalId: string, context: GoalContext): number {
  const count = context.recentGoalCounts[goalId] ?? 0;
  return Math.min(count * 15, 45); // Max 45 point penalty
}

// === Goal Templates ===

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // === SURVIVAL (highest priority when triggered) ===
  {
    id: "flee_danger",
    name: "Flee from Danger",
    description: "Health is critically low, need to escape and heal",
    category: "survival",
    isPossible: (state) => getHealthPercent(state) < 25 && !state.playerEntity?.isDead,
    score: (state) => {
      const hp = getHealthPercent(state);
      if (hp < 10) return 100;
      if (hp < 15) return 95;
      if (hp < 20) return 90;
      if (hp < 25) return 85;
      return 0;
    },
    isComplete: (state) => getHealthPercent(state) > 50 || state.playerEntity?.isDead === true,
    getPrompt: () => `CRITICAL: Health is dangerously low! Must flee immediately. Use food if available, then run away from all threats. Move to a safe area.`,
  },

  {
    id: "eat_food",
    name: "Eat Food to Heal",
    description: "Health is low, eat food to recover",
    category: "survival",
    isPossible: (state) => getHealthPercent(state) < 60 && hasFood(state),
    score: (state) => {
      const hp = getHealthPercent(state);
      if (hp < 30) return 80;
      if (hp < 40) return 60;
      if (hp < 50) return 40;
      return 20;
    },
    isComplete: (state) => getHealthPercent(state) > 80,
    getPrompt: (state) => {
      const food = state.playerEntity?.inventory?.find(i => 
        i.name?.toLowerCase().includes("fish") || i.name?.toLowerCase().includes("meat")
      );
      return `Health is low (${getHealthPercent(state).toFixed(0)}%). Eat ${food?.name || "food"} to heal up before continuing.`;
    },
  },

  {
    id: "respawn",
    name: "Respawn After Death",
    description: "Player is dead and needs to respawn",
    category: "survival",
    isPossible: (state) => state.playerEntity?.isDead === true,
    score: () => 100, // Always highest priority
    isComplete: (state) => state.playerEntity?.isDead !== true,
    getPrompt: () => `You have died! Click respawn to return to the spawn point.`,
  },

  // === COMBAT ===
  {
    id: "train_combat",
    name: "Train Combat Skills",
    description: "Fight mobs to gain combat XP",
    category: "combat",
    isPossible: (state) => {
      return hasWeapon(state) && 
             getHealthPercent(state) > 40 && 
             getNearbyMobs(state).length > 0;
    },
    score: (state, ctx) => {
      let score = 50;
      
      // Bonus if we have good HP
      if (getHealthPercent(state) > 80) score += 10;
      
      // Bonus if mobs are low level
      const mobs = getNearbyMobs(state);
      const lowLevelMobs = mobs.filter(m => (m.level ?? 1) <= getSkillLevel(state, "attack") + 5);
      if (lowLevelMobs.length > 3) score += 15;
      
      // Penalty for recent combat (encourage diversity)
      if (ctx.timeSinceLastCombat < 60000) score -= 10;
      
      // Diversity penalty
      score -= getDiversityPenalty("train_combat", ctx);
      
      return Math.max(0, score);
    },
    isComplete: (state, progress) => {
      // Complete after killing 5 mobs or 5 minutes
      return (progress.targetsKilled ?? 0) >= 5 || 
             (Date.now() - progress.startedAt > 300000);
    },
    getPrompt: (state) => {
      const mobs = getNearbyMobs(state);
      const target = mobs[0];
      return `Train combat by fighting nearby mobs. Target: ${target?.name || "nearest enemy"} (id: ${target?.id}). Attack and defeat enemies to gain combat XP.`;
    },
  },

  // === GATHERING ===
  {
    id: "gather_resources",
    name: "Gather Resources",
    description: "Gather from trees, rocks, or fishing spots",
    category: "gathering",
    isPossible: (state) => {
      return getNearbyResources(state).length > 0 && 
             getInventorySpace(state) > 0;
    },
    score: (state, ctx) => {
      let score = 45;
      
      // Bonus for lots of resources nearby
      const resources = getNearbyResources(state);
      if (resources.length > 5) score += 15;
      
      // Bonus if inventory is mostly empty
      if (getInventorySpace(state) > 20) score += 10;
      
      // Penalty if we just did skilling
      if (ctx.timeSinceLastSkilling < 60000) score -= 15;
      
      score -= getDiversityPenalty("gather_resources", ctx);
      
      return Math.max(0, score);
    },
    isComplete: (state, progress) => {
      return getInventorySpace(state) < 3 || 
             (progress.resourcesGathered ?? 0) >= 10 ||
             (Date.now() - progress.startedAt > 300000);
    },
    getPrompt: (state) => {
      const resources = getNearbyResources(state);
      const target = resources[0];
      return `Gather resources from ${target?.name || target?.type || "nearby resource"} (id: ${target?.id}). Continue until inventory is full or resources depleted.`;
    },
  },

  // === EXPLORATION ===
  {
    id: "explore_area",
    name: "Explore New Areas",
    description: "Move around and discover new locations",
    category: "exploration",
    isPossible: (state) => {
      return !state.playerEntity?.isDead && 
             getHealthPercent(state) > 50;
    },
    score: (state, ctx) => {
      let score = 30;
      
      // Higher if we've been doing same thing too long
      if (ctx.sessionDuration > 600000) score += 15; // 10 min session
      
      // Lower if there's stuff to do here
      if (getNearbyMobs(state).length > 3) score -= 20;
      if (getNearbyResources(state).length > 3) score -= 15;
      
      score -= getDiversityPenalty("explore_area", ctx);
      
      return Math.max(0, score);
    },
    isComplete: (state, progress) => {
      // Explore for 2 minutes then reassess
      return Date.now() - progress.startedAt > 120000;
    },
    getPrompt: (state) => {
      const pos = state.playerEntity?.position;
      const randomDir = ["north", "south", "east", "west"][Math.floor(Math.random() * 4)];
      return `Explore the world! Move ${randomDir} from current position ${pos ? `[${pos[0].toFixed(0)}, ${pos[2].toFixed(0)}]` : ""}. Look for new areas, resources, or mobs to fight.`;
    },
  },

  // === LOOT ===
  {
    id: "collect_loot",
    name: "Collect Ground Items",
    description: "Pick up valuable items from the ground",
    category: "gathering",
    isPossible: (state) => {
      return getGroundItems(state).length > 0 && 
             getInventorySpace(state) > 0;
    },
    score: (state, ctx) => {
      let score = 55; // Loot is usually good to grab
      
      const items = getGroundItems(state);
      if (items.length > 5) score += 20;
      
      // Higher priority if low on inventory space (grab before it fills)
      if (getInventorySpace(state) < 5) score += 10;
      
      score -= getDiversityPenalty("collect_loot", ctx);
      
      return Math.max(0, score);
    },
    isComplete: (state) => {
      return getGroundItems(state).length === 0 || 
             getInventorySpace(state) === 0;
    },
    getPrompt: (state) => {
      const items = getGroundItems(state);
      return `Pick up valuable items from the ground! Found ${items.length} items nearby. Prioritize valuable loot.`;
    },
  },

  // === BANKING ===
  {
    id: "bank_items",
    name: "Bank Inventory",
    description: "Deposit items to bank when inventory is full",
    category: "exploration",
    isPossible: (state) => {
      const hasNearbyBank = Array.from(state.nearbyEntities.values())
        .some(e => e.name?.toLowerCase().includes("bank") || e.type === "bank");
      return getInventorySpace(state) < 5 && hasNearbyBank;
    },
    score: (state) => {
      if (getInventorySpace(state) === 0) return 70;
      if (getInventorySpace(state) < 3) return 55;
      return 35;
    },
    isComplete: (state) => {
      return !state.bankOpen && getInventorySpace(state) > 20;
    },
    getPrompt: () => `Inventory is nearly full! Find the bank and deposit items to make space.`,
  },
];

/**
 * Select the best goal based on current state
 */
export function selectGoal(state: GameState, context: GoalContext): GoalTemplate | null {
  const possibleGoals = GOAL_TEMPLATES.filter(g => g.isPossible(state));
  
  if (possibleGoals.length === 0) return null;
  
  // Score all possible goals
  const scored = possibleGoals.map(g => ({
    goal: g,
    score: g.score(state, context),
  }));
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Return highest scoring goal
  return scored[0]?.goal ?? null;
}

/**
 * Create initial goal context
 */
export function createGoalContext(): GoalContext {
  return {
    recentGoals: [],
    recentGoalCounts: {},
    timeSinceLastCombat: Infinity,
    timeSinceLastSkilling: Infinity,
    sessionDuration: 0,
    xpGained: {},
  };
}

/**
 * Update context after completing a goal
 */
export function updateGoalContext(context: GoalContext, goalId: string): GoalContext {
  const updated = { ...context };
  
  // Track recent goals (last 10)
  updated.recentGoals = [goalId, ...context.recentGoals].slice(0, 10);
  
  // Update counts
  updated.recentGoalCounts = { ...context.recentGoalCounts };
  updated.recentGoalCounts[goalId] = (updated.recentGoalCounts[goalId] ?? 0) + 1;
  
  // Update timing
  const goal = GOAL_TEMPLATES.find(g => g.id === goalId);
  if (goal?.category === "combat") {
    updated.timeSinceLastCombat = 0;
  } else if (["skilling", "gathering"].includes(goal?.category ?? "")) {
    updated.timeSinceLastSkilling = 0;
  }
  
  return updated;
}
