/**
 * Type definitions for Hyperscape Clawdbot Skill
 * Adapted from @hyperscape/shared types
 */

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Entity {
  id: string;
  type: string;
  name?: string;
  position?: [number, number, number];
  health?: number;
  maxHealth?: number;
  level?: number;
  alive?: boolean;
}

export interface PlayerEntity extends Entity {
  type: "player";
  inventory?: InventoryItem[];
  skills?: Record<string, SkillData>;
  equipment?: Record<string, string>;
  coins?: number;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
  name?: string;
}

export interface SkillData {
  level: number;
  xp: number;
}

export interface GameState {
  connected: boolean;
  authenticated: boolean;
  playerEntity: PlayerEntity | null;
  nearbyEntities: Map<string, Entity>;
  worldId: string | null;
  lastUpdate: number;
}

export interface ConnectionConfig {
  serverUrl: string;
  authToken?: string;
  privyUserId?: string;
  autoReconnect?: boolean;
}

// Packet names mapped to IDs (must match server)
export const PACKET_NAMES = [
  "snapshot",
  "command",
  "chatAdded",
  "chatCleared",
  "entityAdded",
  "entityModified",
  "moveRequest",
  "entityEvent",
  "entityRemoved",
  "playerTeleport",
  "playerPush",
  "playerSessionAvatar",
  "settingsModified",
  "spawnModified",
  "kick",
  "ping",
  "pong",
  "input",
  "inputAck",
  "correction",
  "playerState",
  "serverStateUpdate",
  "deltaUpdate",
  "compressedUpdate",
  "resourceSnapshot",
  "resourceSpawnPoints",
  "resourceSpawned",
  "resourceDepleted",
  "resourceRespawned",
  "fishingSpotMoved",
  "resourceInteract",
  "resourceGather",
  "gatheringComplete",
  "gatheringStarted",
  "gatheringStopped",
  "gatheringToolShow",
  "gatheringToolHide",
  "firemakingRequest",
  "cookingRequest",
  "cookingSourceInteract",
  "fireCreated",
  "fireExtinguished",
  "smeltingSourceInteract",
  "smithingSourceInteract",
  "processingSmelting",
  "processingSmithing",
  "smeltingInterfaceOpen",
  "smithingInterfaceOpen",
  "smeltingClose",
  "smithingClose",
  "attackMob",
  "attackPlayer",
  "followPlayer",
  "changeAttackStyle",
  "setAutoRetaliate",
  "autoRetaliateChanged",
  "pickupItem",
  "dropItem",
  "moveItem",
  "useItem",
  "equipItem",
  "unequipItem",
  "inventoryUpdated",
  "bankAction",
  "bankUpdated",
  "chatMessage",
  "characterListRequest",
  "characterCreate",
  "characterList",
  "characterCreated",
  "characterSelected",
  "enterWorld",
] as const;

export type PacketName = (typeof PACKET_NAMES)[number];

export function getPacketId(name: string): number | null {
  const index = PACKET_NAMES.indexOf(name as PacketName);
  return index >= 0 ? index : null;
}

export function getPacketName(id: number): string | null {
  return PACKET_NAMES[id] ?? null;
}
