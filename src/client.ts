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
} from "./types.js";
import { getPacketId, getPacketName } from "./types.js";

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
      case "snapshot":
        this.handleSnapshot(data);
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
        this.handlePlayerState(data);
        break;
      case "inventoryUpdated":
        this.handleInventoryUpdated(data);
        break;
      case "chatAdded":
        this.emit("chat", data);
        break;
      case "pong":
        // Heartbeat response
        break;
      case "characterList":
        this.emit("characterList", data);
        break;
      default:
        // Emit for custom handlers
        this.emit(`packet:${name}`, data);
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
    this.emit("entityRemoved", data);
  }

  private handlePlayerState(data: unknown): void {
    if (this.state.playerEntity) {
      Object.assign(this.state.playerEntity, data);
    }
    this.emit("playerState", data);
  }

  private handleInventoryUpdated(data: unknown): void {
    if (this.state.playerEntity) {
      this.state.playerEntity.inventory = (data as { items: typeof this.state.playerEntity.inventory }).items;
    }
    this.emit("inventoryUpdated", data);
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
   * Move to a position
   */
  move(target: [number, number, number], runMode = false): void {
    this.sendPacket("moveRequest", { target, runMode });
  }

  /**
   * Attack a mob/entity
   */
  attack(targetId: string): void {
    this.sendPacket("attackMob", { mobId: targetId, attackType: "melee" });
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
   * Use an item
   */
  useItem(itemId: string, slot?: number): void {
    this.sendPacket("useItem", { itemId, slot });
  }

  /**
   * Send a chat message
   */
  chat(message: string, channel = "local"): void {
    this.sendPacket("chatMessage", { message, channel });
  }

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

    const nearbyList = Array.from(this.state.nearbyEntities.values())
      .filter(e => e.id !== player.id)
      .slice(0, 10)
      .map(e => `- ${e.name || e.type} (${e.type}) ${e.position ? `at [${e.position.map(n => n.toFixed(1)).join(", ")}]` : ""}`)
      .join("\n");

    return `
**Hyperscape Status**
- Position: ${pos}
- Health: ${health}
- World: ${this.state.worldId || "unknown"}

**Nearby Entities (${this.state.nearbyEntities.size}):**
${nearbyList || "None"}
`.trim();
  }
}
