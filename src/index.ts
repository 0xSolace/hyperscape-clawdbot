/**
 * @clawdbot/skill-hyperscape
 *
 * Clawdbot skill for playing Hyperscape MMORPG.
 * Provides tools for connecting to game server, movement, combat, skills, and more.
 */

export { HyperscapeClient } from "./client.js";
export * from "./types.js";

// Singleton client instance for the skill
let client: import("./client.js").HyperscapeClient | null = null;

/**
 * Get or create the Hyperscape client instance
 */
export function getClient(): import("./client.js").HyperscapeClient {
  if (!client) {
    const { HyperscapeClient } = require("./client.js");
    client = new HyperscapeClient();
  }
  return client;
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
// These would be registered with the Clawdbot skill system

export const tools = {
  hyperscape_connect: {
    description: "Connect to a Hyperscape game server",
    parameters: {
      serverUrl: { type: "string", description: "WebSocket URL (optional, defaults to localhost:5555)" },
    },
    handler: async (params: { serverUrl?: string }) => {
      const { HyperscapeClient } = await import("./client.js");
      client = new HyperscapeClient({ serverUrl: params.serverUrl });
      await client.connect();
      await client.enterWorld();
      return { success: true, message: "Connected to Hyperscape server" };
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
    description: "Get current game state and nearby entities",
    parameters: {},
    handler: async () => {
      if (!client) return { success: false, message: "Not connected to Hyperscape" };
      return {
        success: true,
        state: client.state,
        context: client.getStateContext(),
      };
    },
  },

  hyperscape_move: {
    description: "Move to a position in the game world",
    parameters: {
      x: { type: "number", description: "X coordinate" },
      y: { type: "number", description: "Y coordinate (height)" },
      z: { type: "number", description: "Z coordinate" },
      run: { type: "boolean", description: "Run instead of walk" },
    },
    handler: async (params: { x: number; y: number; z: number; run?: boolean }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.move([params.x, params.y, params.z], params.run ?? false);
      return { success: true, message: `Moving to [${params.x}, ${params.y}, ${params.z}]` };
    },
  },

  hyperscape_attack: {
    description: "Attack a target entity",
    parameters: {
      targetId: { type: "string", description: "Entity ID to attack" },
    },
    handler: async (params: { targetId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.attack(params.targetId);
      return { success: true, message: `Attacking ${params.targetId}` };
    },
  },

  hyperscape_gather: {
    description: "Gather from a resource (tree, rock, fishing spot)",
    parameters: {
      resourceId: { type: "string", description: "Resource entity ID" },
    },
    handler: async (params: { resourceId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.interactResource(params.resourceId);
      return { success: true, message: `Gathering from ${params.resourceId}` };
    },
  },

  hyperscape_pickup: {
    description: "Pick up an item from the ground",
    parameters: {
      itemId: { type: "string", description: "Ground item ID" },
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
      itemId: { type: "string", description: "Item ID to drop" },
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
      itemId: { type: "string", description: "Item ID to equip" },
    },
    handler: async (params: { itemId: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.equip(params.itemId);
      return { success: true, message: `Equipped ${params.itemId}` };
    },
  },

  hyperscape_chat: {
    description: "Send a chat message in the game",
    parameters: {
      message: { type: "string", description: "Message to send" },
      channel: { type: "string", description: "Chat channel (local, global)" },
    },
    handler: async (params: { message: string; channel?: string }) => {
      if (!client?.state.connected) return { success: false, message: "Not connected" };
      client.chat(params.message, params.channel ?? "local");
      return { success: true, message: `Sent: ${params.message}` };
    },
  },
};

export default {
  name: "hyperscape",
  description: "Play Hyperscape MMORPG as an AI agent",
  tools,
};
