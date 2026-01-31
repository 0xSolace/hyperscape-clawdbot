# @openclaw/skill-hyperscape

> 🎮 Play Hyperscape MMORPG as an OpenClaw AI agent

This skill enables [OpenClaw](https://openclaw.ai) AI agents to play [Hyperscape](https://github.com/HyperscapeAI/hyperscape), a RuneScape-inspired MMORPG.

## Features

- **Direct WebSocket Connection** - Connects to Hyperscape server using the binary MessagePack protocol
- **Full Game Actions** - Movement, combat, gathering, inventory management
- **Real-time State** - Track player position, health, nearby entities
- **Agent-Friendly** - Provides context strings for LLM decision making

## Installation

```bash
npm install @openclaw/skill-hyperscape
```

## Usage

### With OpenClaw

Add to your agent's skills:

```json
{
  "skills": {
    "entries": {
      "hyperscape": {
        "enabled": true
      }
    }
  }
}
```

Then chat with your agent:

```
Connect to hyperscape at ws://localhost:5555/ws

Move to position 100, 0, 100

Attack the nearest goblin

Chop some trees
```

### Standalone

```typescript
import { HyperscapeClient } from '@clawdbot/skill-hyperscape';

const client = new HyperscapeClient({
  serverUrl: 'ws://localhost:5555/ws'
});

await client.connect();
await client.enterWorld();

// Move around
client.move([100, 0, 100]);

// Attack
client.attack('mob-123');

// Gather resources
client.interactResource('tree-456');

// Get state for agent context
console.log(client.getStateContext());
```

## Tools

| Tool | Description |
|------|-------------|
| `hyperscape_connect` | Connect to game server |
| `hyperscape_disconnect` | Disconnect from server |
| `hyperscape_status` | Get game state and nearby entities |
| `hyperscape_move` | Move to coordinates |
| `hyperscape_attack` | Attack a target |
| `hyperscape_gather` | Gather from resource |
| `hyperscape_pickup` | Pick up ground item |
| `hyperscape_drop` | Drop inventory item |
| `hyperscape_equip` | Equip an item |
| `hyperscape_chat` | Send chat message |

## Environment Variables

- `HYPERSCAPE_SERVER_URL` - WebSocket URL (default: `ws://localhost:5555/ws`)
- `HYPERSCAPE_AUTH_TOKEN` - Privy auth token for authenticated connections

## Protocol

This skill communicates directly with the Hyperscape server using:
- **WebSocket** for real-time bidirectional communication
- **MessagePack** for efficient binary serialization
- **Packet IDs** mapped to packet names for bandwidth efficiency

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## License

MIT

## Credits

- [Hyperscape](https://github.com/HyperscapeAI/hyperscape) - The AI-native MMORPG
- [OpenClaw](https://openclaw.ai) - AI agent framework
- [ElizaOS](https://github.com/elizaOS/eliza) - Multi-agent AI framework
