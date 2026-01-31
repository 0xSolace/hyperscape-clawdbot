/**
 * HyperscapeClient - WebSocket client for Hyperscape game server
 *
 * Handles connection, authentication, and message sending/receiving
 * using binary MessagePack protocol.
 */

import WebSocket from "ws";
import { Packr, Unpackr } from "msgpackr";
import { EventEmitter } from "events";
import type {
  ConnectionConfig,
  GameState,
  Entity,
  PlayerEntity,
  PacketName,
  BankItem,
  XpDrop,
  SkillData,
  InventoryItem,
  EquippedItem,
} from "./types.js";
import { getPacketId, getPacketName, formatSkillName, getLevelForXp } from "./types.js";

const packr = new Packr({ structuredClone: true });
const unpackr = new Unpackr();

export class HyperscapeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  public state: GameState = {
    connected: false,
    authenticated: false,
    playerEntity: null,
    nearbyEntities: new Map(),
    worldId: null,
    lastUpdate: Date.now(),
    // Bank
    bankOpen: false,
    bankItems: [],
    bankCoins: 0,
    // Combat
    attackStyle: "accurate",
    autoRetaliate: true,
    currentTarget: null,
    // UI
    dialogueOpen: false,
    storeOpen: false,
    tradeOpen: false,
  };

  constructor(config: Partial<ConnectionConfig> = {}) {
    super();
    this.config = {
      serverUrl: config.serverUrl || process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws",
      authToken: config.authToken || process.env.HYPERSCAPE_AUTH_TOKEN,
      privyUserId: config.privyUserId || process.env.HYPERSCAPE_PRIVY_USER_ID,
      autoReconnect: config.autoReconnect ?? true,
    };
  }

  /**
   * Connect to the Hyperscape server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      console.log(`[HyperscapeClient] Connecting to ${this.config.serverUrl}...`);

      this.ws = new WebSocket(this.config.serverUrl);
      this.ws.binaryType = "arraybuffer";

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        console.log("[HyperscapeClient] Connected!");
        this.state.connected = true;
        this.startPing();
        
        // Send authenticate packet if we have a token
        if (this.config.authToken) {
          this.sendPacket("authenticate", { 
            token: this.config.authToken,
            privyUserId: this.config.privyUserId 
          });
        }
        
        this.emit("connected");
        resolve();
      });

      this.ws.on("message", (data: Buffer | ArrayBuffer) => {
        this.handleMessage(data);
      });

      this.ws.on("close", () => {
        console.log("[HyperscapeClient] Disconnected");
        this.state.connected = false;
        this.state.authenticated = false;
        this.stopPing();
        this.emit("disconnected");

        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (error) => {
        console.error("[HyperscapeClient] Error:", error.message);
        clearTimeout(timeout);
        this.emit("error", error);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state.connected = false;
    this.state.authenticated = false;
  }

  /**
   * Send a binary packet to the server
   */
  sendPacket(name: PacketName | string, data: unknown = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[HyperscapeClient] Cannot send ${name}: not connected`);
      return;
    }

    const packetId = getPacketId(name);
    if (packetId === null) {
      console.warn(`[HyperscapeClient] Unknown packet: ${name}`);
      return;
    }

    const packet = packr.pack([packetId, data]);
    this.ws.send(packet);
    console.log(`[HyperscapeClient] Sent: ${name}`);
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: Buffer | ArrayBuffer): void {
    try {
      const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;
      const decoded = unpackr.unpack(buffer) as [number, unknown];

      if (!Array.isArray(decoded) || decoded.length < 2) {
        console.warn("[HyperscapeClient] Invalid packet format");
        return;
      }

      const [packetId, payload] = decoded;
      const packetName = getPacketName(packetId);

      if (!packetName) {
        console.warn(`[HyperscapeClient] Unknown packet ID: ${packetId}`);
        return;
      }

      this.handlePacket(packetName, payload);
    } catch (error) {
      console.error("[HyperscapeClient] Failed to decode message:", error);
    }
  }

  /**
   * Handle specific packet types
   */
  private handlePacket(name: string, data: unknown): void {
    this.state.lastUpdate = Date.now();

    switch (name) {
      // Core state
      case "snapshot":
        this.handleSnapshot(data);
        break;
      case "authResult":
        this.handleAuthResult(data as { success: boolean; message?: string });
        break;
      case "entityAdded":
        this.handleEntityAdded(data as Entity);
        break;
      case "entityModified":
        this.handleEntityModified(data as Partial<Entity> & { id: string });
        break;
      case "entityRemoved":
        this.handleEntityRemoved(data as { id: string });
        break;
      case "playerState":
      case "playerUpdated":
        this.handlePlayerState(data);
        break;
      
      // Inventory & Items
      case "inventoryUpdated":
        this.handleInventoryUpdated(data);
        break;
      case "coinsUpdated":
        if (this.state.playerEntity) {
          this.state.playerEntity.coins = (data as { coins: number }).coins;
        }
        this.emit("coinsUpdated", data);
        break;
      case "equipmentUpdated":
        this.handleEquipmentUpdated(data);
        break;
      
      // Skills & XP
      case "skillsUpdated":
        this.handleSkillsUpdated(data);
        break;
      case "xpDrop":
        this.handleXpDrop(data as XpDrop);
        break;
      
      // Combat
      case "attackStyleChanged":
      case "attackStyleUpdate":
        this.state.attackStyle = (data as { style: string }).style;
        this.emit("attackStyleChanged", data);
        break;
      case "autoRetaliateChanged":
        this.state.autoRetaliate = (data as { enabled: boolean }).enabled;
        this.emit("autoRetaliateChanged", data);
        break;
      case "combatDamageDealt":
        this.emit("damageDealt", data);
        break;
      
      // Death & Respawn
      case "deathScreen":
        if (this.state.playerEntity) {
          this.state.playerEntity.isDead = true;
        }
        this.emit("death", data);
        break;
      case "playerRespawned":
        if (this.state.playerEntity) {
          this.state.playerEntity.isDead = false;
        }
        this.emit("respawned", data);
        break;
      
      // Bank
      case "bankOpen":
      case "bankState":
        this.handleBankState(data);
        break;
      case "bankClose":
        this.state.bankOpen = false;
        this.emit("bankClosed");
        break;
      
      // Chat
      case "chatAdded":
        this.emit("chat", data);
        break;
      case "systemMessage":
        this.emit("systemMessage", data);
        break;
      case "showToast":
        this.emit("toast", data);
        break;
      
      // Dialogue
      case "dialogueStart":
        this.state.dialogueOpen = true;
        this.emit("dialogueStart", data);
        break;
      case "dialogueEnd":
      case "dialogueClose":
        this.state.dialogueOpen = false;
        this.emit("dialogueEnd", data);
        break;
      
      // Store
      case "storeOpen":
      case "storeState":
        this.state.storeOpen = true;
        this.emit("storeOpen", data);
        break;
      case "storeClose":
        this.state.storeOpen = false;
        this.emit("storeClosed");
        break;
      
      // Trade
      case "tradeStarted":
        this.state.tradeOpen = true;
        this.emit("tradeStarted", data);
        break;
      case "tradeCompleted":
      case "tradeCancelled":
        this.state.tradeOpen = false;
        this.emit("tradeEnded", data);
        break;
      
      // Gathering
      case "gatheringStarted":
        this.emit("gatheringStarted", data);
        break;
      case "gatheringComplete":
        this.emit("gatheringComplete", data);
        break;
      case "gatheringStopped":
        this.emit("gatheringStopped", data);
        break;
      
      // Character selection
      case "pong":
        break;
      case "characterList":
        this.emit("characterList", data);
        break;
      case "enterWorldApproved":
        this.state.authenticated = true;
        this.emit("enteredWorld", data);
        break;
      case "enterWorldRejected":
        this.emit("enterWorldRejected", data);
        break;
      
      default:
        this.emit(`packet:${name}`, data);
    }
  }

  private handleAuthResult(data: { success: boolean; message?: string }): void {
    if (data.success) {
      console.log("[HyperscapeClient] Authentication successful");
      this.state.authenticated = true;
      this.emit("authenticated");
    } else {
      console.error("[HyperscapeClient] Authentication failed:", data.message);
      this.emit("authFailed", data);
    }
  }

  private handleSnapshot(data: unknown): void {
    const snapshot = data as {
      entities?: Entity[];
      playerId?: string;
      worldId?: string;
    };

    console.log("[HyperscapeClient] Received snapshot");

    if (snapshot.worldId) {
      this.state.worldId = snapshot.worldId;
    }

    if (snapshot.entities) {
      this.state.nearbyEntities.clear();
      for (const entity of snapshot.entities) {
        this.state.nearbyEntities.set(entity.id, entity);
        if (entity.id === snapshot.playerId) {
          this.state.playerEntity = entity as PlayerEntity;
        }
      }
    }

    this.state.authenticated = true;
    this.emit("snapshot", snapshot);
  }

  private handleEntityAdded(entity: Entity): void {
    this.state.nearbyEntities.set(entity.id, entity);
    this.emit("entityAdded", entity);
  }

  private handleEntityModified(update: Partial<Entity> & { id: string }): void {
    const existing = this.state.nearbyEntities.get(update.id);
    if (existing) {
      Object.assign(existing, update);
      if (this.state.playerEntity?.id === update.id) {
        Object.assign(this.state.playerEntity, update);
      }
    }
    this.emit("entityModified", update);
  }

  private handleEntityRemoved(data: { id: string }): void {
    this.state.nearbyEntities.delete(data.id);
    if (this.state.currentTarget === data.id) {
      this.state.currentTarget = null;
    }
    this.emit("entityRemoved", data);
  }

  private handlePlayerState(data: unknown): void {
    if (this.state.playerEntity) {
      Object.assign(this.state.playerEntity, data);
    }
    this.emit("playerState", data);
  }

  private handleInventoryUpdated(data: unknown): void {
    const update = data as { items?: InventoryItem[] };
    if (this.state.playerEntity && update.items) {
      this.state.playerEntity.inventory = update.items;
    }
    this.emit("inventoryUpdated", data);
  }

  private handleEquipmentUpdated(data: unknown): void {
    if (this.state.playerEntity) {
      const update = data as { equipment: Record<string, EquippedItem> };
      this.state.playerEntity.equipment = update.equipment;
    }
    this.emit("equipmentUpdated", data);
  }

  private handleSkillsUpdated(data: unknown): void {
    if (this.state.playerEntity) {
      this.state.playerEntity.skills = (data as { skills: Record<string, SkillData> }).skills;
    }
    this.emit("skillsUpdated", data);
  }

  private handleXpDrop(data: XpDrop): void {
    // Update skill in player entity
    if (this.state.playerEntity?.skills) {
      const skill = this.state.playerEntity.skills[data.skill];
      if (skill) {
        skill.xp = data.totalXp;
        skill.level = data.level;
      }
    }
    this.emit("xpDrop", data);
  }

  private handleBankState(data: unknown): void {
    const bank = data as { items?: BankItem[]; coins?: number };
    this.state.bankOpen = true;
    if (bank.items) {
      this.state.bankItems = bank.items;
    }
    if (bank.coins !== undefined) {
      this.state.bankCoins = bank.coins;
    }
    this.emit("bankOpened", data);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.sendPacket("ping", { timestamp: Date.now() });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log("[HyperscapeClient] Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(console.error);
    }, 5000);
  }

  // === Game Commands ===

  /**
   * Select character and enter world
   */
  async enterWorld(characterId?: string): Promise<void> {
    if (characterId) {
      this.sendPacket("characterSelected", { characterId });
    }
    this.sendPacket("enterWorld", {});
  }

  /**
   * Signal client is ready (after loading)
   */
  clientReady(): void {
    this.sendPacket("clientReady", {});
  }

  /**
   * Move to a position
   */
  move(target: [number, number, number], runMode = false): void {
    this.sendPacket("moveRequest", { target, runMode });
  }

  /**
   * Attack a mob/entity
   */
  attack(targetId: string, attackType: "melee" | "ranged" | "magic" = "melee"): void {
    this.state.currentTarget = targetId;
    this.sendPacket("attackMob", { mobId: targetId, attackType });
  }

  /**
   * Attack another player (PvP)
   */
  attackPlayer(targetId: string): void {
    this.state.currentTarget = targetId;
    this.sendPacket("attackPlayer", { targetId });
  }

  /**
   * Follow a player
   */
  followPlayer(targetId: string): void {
    this.sendPacket("followPlayer", { targetId });
  }

  /**
   * Change attack style
   */
  changeAttackStyle(style: string): void {
    this.sendPacket("changeAttackStyle", { style });
  }

  /**
   * Toggle auto-retaliate
   */
  setAutoRetaliate(enabled: boolean): void {
    this.sendPacket("setAutoRetaliate", { enabled });
  }

  /**
   * Gather from a resource (tree, rock, fishing spot)
   */
  gather(resourceId: string): void {
    this.sendPacket("resourceGather", { resourceId });
  }

  /**
   * Interact with a resource (server-authoritative pathing)
   */
  interactResource(resourceId: string): void {
    this.sendPacket("resourceInteract", { resourceId });
  }

  /**
   * Cook food on fire/range
   */
  cook(itemId: string, sourceId?: string): void {
    this.sendPacket("cookingRequest", { itemId, sourceId });
  }

  /**
   * Light a fire
   */
  lightFire(): void {
    this.sendPacket("firemakingRequest", {});
  }

  /**
   * Pick up an item from the ground
   */
  pickup(itemId: string): void {
    this.sendPacket("pickupItem", { itemId, timestamp: Date.now() });
  }

  /**
   * Drop an item from inventory
   */
  drop(itemId: string, quantity = 1, slot?: number): void {
    this.sendPacket("dropItem", { itemId, quantity, slot });
  }

  /**
   * Equip an item
   */
  equip(itemId: string, slot?: number): void {
    this.sendPacket("equipItem", { itemId, slot });
  }

  /**
   * Unequip an item
   */
  unequip(slot: string): void {
    this.sendPacket("unequipItem", { slot });
  }

  /**
   * Use an item
   */
  useItem(itemId: string, slot?: number): void {
    this.sendPacket("useItem", { itemId, slot });
  }

  // === Bank Commands ===

  /**
   * Deposit item to bank
   */
  bankDeposit(itemId: string, quantity = 1, slot?: number): void {
    this.sendPacket("bankDeposit", { itemId, quantity, slot });
  }

  /**
   * Deposit all items to bank
   */
  bankDepositAll(): void {
    this.sendPacket("bankDepositAll", {});
  }

  /**
   * Withdraw item from bank
   */
  bankWithdraw(itemId: string, quantity = 1, slot?: number): void {
    this.sendPacket("bankWithdraw", { itemId, quantity, slot });
  }

  /**
   * Deposit coins to bank
   */
  bankDepositCoins(amount: number): void {
    this.sendPacket("bankDepositCoins", { amount });
  }

  /**
   * Withdraw coins from bank
   */
  bankWithdrawCoins(amount: number): void {
    this.sendPacket("bankWithdrawCoins", { amount });
  }

  /**
   * Close bank interface
   */
  bankClose(): void {
    this.sendPacket("bankClose", {});
    this.state.bankOpen = false;
  }

  // === NPC & Dialogue ===

  /**
   * Interact with an NPC
   */
  npcInteract(npcId: string, action?: string): void {
    this.sendPacket("npcInteract", { npcId, action });
  }

  /**
   * Respond to dialogue option
   */
  dialogueResponse(optionIndex: number): void {
    this.sendPacket("dialogueResponse", { optionIndex });
  }

  /**
   * Continue dialogue
   */
  dialogueContinue(): void {
    this.sendPacket("dialogueContinue", {});
  }

  /**
   * Close dialogue
   */
  dialogueClose(): void {
    this.sendPacket("dialogueClose", {});
    this.state.dialogueOpen = false;
  }

  // === Store ===

  /**
   * Buy item from store
   */
  storeBuy(itemId: string, quantity = 1): void {
    this.sendPacket("storeBuy", { itemId, quantity });
  }

  /**
   * Sell item to store
   */
  storeSell(itemId: string, quantity = 1, slot?: number): void {
    this.sendPacket("storeSell", { itemId, quantity, slot });
  }

  /**
   * Close store
   */
  storeClose(): void {
    this.sendPacket("storeClose", {});
    this.state.storeOpen = false;
  }

  // === Death & Respawn ===

  /**
   * Request respawn after death
   */
  respawn(): void {
    this.sendPacket("requestRespawn", {});
  }

  /**
   * Home teleport
   */
  homeTeleport(): void {
    this.sendPacket("homeTeleport", {});
  }

  /**
   * Send a chat message
   */
  chat(message: string, channel = "local"): void {
    this.sendPacket("chatMessage", { message, channel });
  }

  // === Context Providers ===

  /**
   * Get formatted game state for agent context
   */
  getStateContext(): string {
    if (!this.state.connected) {
      return "Not connected to Hyperscape server.";
    }

    if (!this.state.playerEntity) {
      return "Connected but no player entity yet.";
    }

    const player = this.state.playerEntity;
    const pos = player.position ? `[${player.position.map(n => n.toFixed(1)).join(", ")}]` : "unknown";
    const health = player.health !== undefined ? `${player.health}/${player.maxHealth}` : "unknown";
    const coins = player.coins?.toLocaleString() ?? "0";

    // Format skills
    let skillsStr = "";
    if (player.skills) {
      const skills = Object.entries(player.skills)
        .map(([name, data]) => `${formatSkillName(name)}: ${data.level}`)
        .join(", ");
      skillsStr = skills || "None";
    }

    // Format inventory
    let invStr = "";
    if (player.inventory && player.inventory.length > 0) {
      invStr = player.inventory
        .slice(0, 10)
        .map(item => `${item.name || item.itemId} x${item.quantity}`)
        .join(", ");
      if (player.inventory.length > 10) {
        invStr += ` (+${player.inventory.length - 10} more)`;
      }
    }

    // Format nearby entities
    const nearby = Array.from(this.state.nearbyEntities.values())
      .filter(e => e.id !== player.id)
      .slice(0, 15);
    
    const mobs = nearby.filter(e => e.type === "mob" || e.type === "npc");
    const resources = nearby.filter(e => e.type === "resource" || e.type === "tree" || e.type === "rock" || e.type === "fishing");
    const items = nearby.filter(e => e.type === "item" || e.type === "groundItem");
    const players = nearby.filter(e => e.type === "player");

    const formatEntity = (e: Entity) => {
      const dist = player.position && e.position 
        ? Math.sqrt(
            Math.pow(player.position[0] - e.position[0], 2) +
            Math.pow(player.position[2] - e.position[2], 2)
          ).toFixed(0)
        : "?";
      const hp = e.health !== undefined ? ` (${e.health}/${e.maxHealth})` : "";
      const lvl = e.level ? ` Lv${e.level}` : "";
      return `- ${e.name || e.type}${lvl}${hp} [${dist}m] id:${e.id}`;
    };

    let nearbyStr = "";
    if (mobs.length > 0) nearbyStr += `**Mobs/NPCs:**\n${mobs.map(formatEntity).join("\n")}\n`;
    if (resources.length > 0) nearbyStr += `**Resources:**\n${resources.map(formatEntity).join("\n")}\n`;
    if (items.length > 0) nearbyStr += `**Ground Items:**\n${items.map(formatEntity).join("\n")}\n`;
    if (players.length > 0) nearbyStr += `**Players:**\n${players.map(formatEntity).join("\n")}\n`;

    const combatStatus = player.inCombat ? "⚔️ In Combat" : player.isDead ? "💀 Dead" : "🟢 Safe";

    return `
**Hyperscape Status** ${combatStatus}
- Position: ${pos}
- Health: ${health}
- Coins: ${coins}
- Attack Style: ${this.state.attackStyle}
- Auto-Retaliate: ${this.state.autoRetaliate ? "On" : "Off"}
${this.state.currentTarget ? `- Target: ${this.state.currentTarget}` : ""}

**Skills:** ${skillsStr || "Loading..."}

**Inventory:** ${invStr || "Empty"}

${nearbyStr || "No entities nearby."}
`.trim();
  }

  /**
   * Get available actions based on current context
   */
  getAvailableActions(): string[] {
    const actions: string[] = [];
    const player = this.state.playerEntity;

    if (!this.state.connected) {
      return ["hyperscape_connect"];
    }

    if (!player) {
      return ["hyperscape_status"];
    }

    // Always available
    actions.push("hyperscape_status", "hyperscape_move", "hyperscape_chat");

    // Dead state
    if (player.isDead) {
      actions.push("hyperscape_respawn");
      return actions;
    }

    // UI states
    if (this.state.bankOpen) {
      actions.push("hyperscape_bank_deposit", "hyperscape_bank_withdraw", "hyperscape_bank_close");
      return actions;
    }
    if (this.state.dialogueOpen) {
      actions.push("hyperscape_dialogue_continue", "hyperscape_dialogue_respond", "hyperscape_dialogue_close");
      return actions;
    }
    if (this.state.storeOpen) {
      actions.push("hyperscape_store_buy", "hyperscape_store_sell", "hyperscape_store_close");
      return actions;
    }

    // Combat
    const nearMobs = Array.from(this.state.nearbyEntities.values()).filter(e => e.type === "mob" && e.alive !== false);
    if (nearMobs.length > 0) {
      actions.push("hyperscape_attack");
    }

    // Resources
    const resources = Array.from(this.state.nearbyEntities.values()).filter(e => 
      e.type === "resource" || e.type === "tree" || e.type === "rock" || e.type === "fishing"
    );
    if (resources.length > 0) {
      actions.push("hyperscape_gather");
    }

    // Ground items
    const groundItems = Array.from(this.state.nearbyEntities.values()).filter(e => 
      e.type === "item" || e.type === "groundItem"
    );
    if (groundItems.length > 0) {
      actions.push("hyperscape_pickup");
    }

    // Inventory actions
    if (player.inventory && player.inventory.length > 0) {
      actions.push("hyperscape_drop", "hyperscape_equip", "hyperscape_use_item");
    }

    // NPCs
    const npcs = Array.from(this.state.nearbyEntities.values()).filter(e => e.type === "npc");
    if (npcs.length > 0) {
      actions.push("hyperscape_npc_interact");
    }

    return actions;
  }

  /**
   * Get bank context
   */
  getBankContext(): string {
    if (!this.state.bankOpen) {
      return "Bank is not open.";
    }

    const itemsStr = this.state.bankItems
      .slice(0, 20)
      .map(item => `${item.name || item.itemId} x${item.quantity}`)
      .join(", ");

    return `
**Bank Open**
- Coins: ${this.state.bankCoins.toLocaleString()}
- Items: ${itemsStr || "Empty"}
${this.state.bankItems.length > 20 ? `(+${this.state.bankItems.length - 20} more)` : ""}
`.trim();
  }
}
