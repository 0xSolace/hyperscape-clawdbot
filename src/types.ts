/**
 * Type definitions for Hyperscape Clawdbot Skill
 * Synced from @hyperscape/shared packets.ts
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
  combatLevel?: number;
}

export interface PlayerEntity extends Entity {
  type: "player";
  inventory?: InventoryItem[];
  skills?: Record<string, SkillData>;
  equipment?: Record<string, EquippedItem>;
  coins?: number;
  prayerPoints?: number;
  runEnergy?: number;
  weight?: number;
  inCombat?: boolean;
  isDead?: boolean;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
  name?: string;
}

export interface EquippedItem {
  itemId: string;
  name?: string;
  slot: string;
}

export interface SkillData {
  level: number;
  xp: number;
  virtualLevel?: number;
}

export interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
  name?: string;
  tab?: number;
}

export interface GameState {
  connected: boolean;
  authenticated: boolean;
  playerEntity: PlayerEntity | null;
  nearbyEntities: Map<string, Entity>;
  worldId: string | null;
  lastUpdate: number;
  // Bank state (when open)
  bankOpen: boolean;
  bankItems: BankItem[];
  bankCoins: number;
  // Combat state
  attackStyle: string;
  autoRetaliate: boolean;
  currentTarget: string | null;
  // UI state
  dialogueOpen: boolean;
  storeOpen: boolean;
  tradeOpen: boolean;
}

export interface ConnectionConfig {
  serverUrl: string;
  authToken?: string;
  privyUserId?: string;
  autoReconnect?: boolean;
}

export interface XpDrop {
  skill: string;
  xp: number;
  totalXp: number;
  level: number;
}

export interface ToastMessage {
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

// Packet names synced from @hyperscape/shared packets.ts
// MUST match server exactly - order determines packet ID
export const PACKET_NAMES = [
  'snapshot',
  'command',
  'chatAdded',
  'chatCleared',
  'entityAdded',
  'entityModified',
  'moveRequest',
  'entityEvent',
  'entityRemoved',
  'playerTeleport',
  'playerPush',
  'playerSessionAvatar',
  'settingsModified',
  'spawnModified',
  'kick',
  'ping',
  'pong',
  'input',
  'inputAck',
  'correction',
  'playerState',
  'serverStateUpdate',
  'deltaUpdate',
  'compressedUpdate',
  'resourceSnapshot',
  'resourceSpawnPoints',
  'resourceSpawned',
  'resourceDepleted',
  'resourceRespawned',
  'fishingSpotMoved',
  'resourceInteract',
  'resourceGather',
  'gatheringComplete',
  'gatheringStarted',
  'gatheringStopped',
  'gatheringToolShow',
  'gatheringToolHide',
  'firemakingRequest',
  'cookingRequest',
  'cookingSourceInteract',
  'fireCreated',
  'fireExtinguished',
  'smeltingSourceInteract',
  'smithingSourceInteract',
  'processingSmelting',
  'processingSmithing',
  'smeltingInterfaceOpen',
  'smithingInterfaceOpen',
  'smeltingClose',
  'smithingClose',
  'attackMob',
  'attackPlayer',
  'followPlayer',
  'changeAttackStyle',
  'setAutoRetaliate',
  'autoRetaliateChanged',
  'pickupItem',
  'dropItem',
  'moveItem',
  'useItem',
  'coinPouchWithdraw',
  'equipItem',
  'unequipItem',
  'inventoryUpdated',
  'coinsUpdated',
  'playerWeightUpdated',
  'equipmentUpdated',
  'skillsUpdated',
  'xpDrop',
  'showToast',
  'deathScreen',
  'deathScreenClose',
  'requestRespawn',
  'playerSetDead',
  'playerRespawned',
  'corpseLoot',
  'lootResult',
  'attackStyleChanged',
  'attackStyleUpdate',
  'combatDamageDealt',
  'projectileLaunched',
  'playerUpdated',
  'playerNameChanged',
  'actionBarSave',
  'actionBarLoad',
  'actionBarState',
  'characterListRequest',
  'characterCreate',
  'characterList',
  'characterCreated',
  'characterSelected',
  'enterWorld',
  'enterWorldApproved',
  'enterWorldRejected',
  'syncGoal',
  'goalOverride',
  'syncAgentThought',
  'bankOpen',
  'bankState',
  'bankDeposit',
  'bankDepositAll',
  'bankWithdraw',
  'bankDepositCoins',
  'bankWithdrawCoins',
  'bankClose',
  'bankMove',
  'bankCreateTab',
  'bankDeleteTab',
  'bankMoveToTab',
  'bankSelectTab',
  'bankWithdrawPlaceholder',
  'bankReleasePlaceholder',
  'bankReleaseAllPlaceholders',
  'bankToggleAlwaysPlaceholder',
  'bankWithdrawToEquipment',
  'bankDepositEquipment',
  'bankDepositAllEquipment',
  'storeOpen',
  'storeState',
  'storeBuy',
  'storeSell',
  'storeClose',
  'npcInteract',
  'entityInteract',
  'dialogueStart',
  'dialogueNodeChange',
  'dialogueResponse',
  'dialogueContinue',
  'dialogueEnd',
  'dialogueClose',
  'entityTileUpdate',
  'tileMovementStart',
  'tileMovementEnd',
  'systemMessage',
  'clientReady',
  'worldTimeSync',
  'prayerToggle',
  'prayerDeactivateAll',
  'altarPray',
  'prayerStateSync',
  'prayerToggled',
  'prayerPointsChanged',
  'getQuestList',
  'getQuestDetail',
  'questList',
  'questDetail',
  'questStartConfirm',
  'questAccept',
  'questAbandon',
  'questTogglePin',
  'questPinned',
  'questComplete',
  'questProgressed',
  'questCompleted',
  'xpLampUse',
  'homeTeleport',
  'homeTeleportCancel',
  'homeTeleportStart',
  'homeTeleportFailed',
  'tradeRequest',
  'tradeRequestRespond',
  'tradeIncoming',
  'tradeStarted',
  'tradeAddItem',
  'tradeRemoveItem',
  'tradeSetItemQuantity',
  'tradeUpdated',
  'tradeAccept',
  'tradeCancelAccept',
  'tradeCancel',
  'tradeCompleted',
  'tradeCancelled',
  'tradeError',
  'tradeConfirmScreen',
  'duel:challenge',
  'duel:challenge:respond',
  'duelChallengeSent',
  'duelChallengeIncoming',
  'duelSessionStarted',
  'duelChallengeDeclined',
  'duelError',
  'duel:toggle:rule',
  'duel:toggle:equipment',
  'duel:accept:rules',
  'duel:add:stake',
  'duel:remove:stake',
  'duel:accept:stakes',
  'duel:accept:final',
  'duel:cancel',
  'duelStateUpdated',
  'duelMoveToStakes',
  'duelMoveToConfirm',
  'duelStartFight',
  'duelCancelled',
  'duelRulesUpdated',
  'duelEquipmentUpdated',
  'duelAcceptanceUpdated',
  'duelStateChanged',
  'duelStakesUpdated',
  'duelCountdownStart',
  'duelCountdownTick',
  'duelFightBegin',
  'duelFightStart',
  'duelEnded',
  'duelCompleted',
  'duelOpponentDisconnected',
  'duelOpponentReconnected',
  'duel:forfeit',
  'useSkill',
  'castSpell',
  'setAutocast',
  'skillActivated',
  'spellCast',
  'abilityCooldown',
  'abilityFailed',
  'friendRequest',
  'friendAccept',
  'friendDecline',
  'friendRemove',
  'friendsListSync',
  'friendStatusUpdate',
  'friendRequestIncoming',
  'ignoreAdd',
  'ignoreRemove',
  'privateMessage',
  'privateMessageReceived',
  'privateMessageFailed',
  'socialError',
  'testLevelUp',
  'testXpDrop',
  'testDeathScreen',
  'authenticate',
  'authResult',
] as const;

export type PacketName = (typeof PACKET_NAMES)[number];

export function getPacketId(name: string): number | null {
  const index = PACKET_NAMES.indexOf(name as PacketName);
  return index >= 0 ? index : null;
}

export function getPacketName(id: number): string | null {
  return PACKET_NAMES[id] ?? null;
}

// Helper to format skill name for display
export function formatSkillName(skill: string): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
}

// XP table for level calculation
export const XP_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411,
  2746, 3115, 3523, 3973, 4470, 5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824,
  12031, 13363, 14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648,
  37224, 41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
  111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742,
  302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627,
  814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808,
  1986068, 2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776,
  4842295, 5346332, 5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629,
  11805606, 13034431, 200000000
];

export function getLevelForXp(xp: number): number {
  for (let level = 98; level >= 1; level--) {
    if (xp >= XP_TABLE[level]) return level + 1;
  }
  return 1;
}
