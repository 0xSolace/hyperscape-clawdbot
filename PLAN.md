# Hyperscape Clawdbot Skill - Implementation Plan

## Overview
Enable Clawdbot/OpenClaw agents to play Hyperscape by connecting directly to the game server via WebSocket.

## Architecture

```
┌─────────────────┐
│  Clawdbot Agent │
│    (Claude)     │
└────────┬────────┘
         │ tools + providers
         ▼
┌─────────────────┐
│ hyperscape-skill│
│  (this package) │
└────────┬────────┘
         │ WebSocket + MessagePack
         ▼
┌─────────────────┐
│Hyperscape Server│
│  (port 5555)    │
└─────────────────┘
```

## Components

### 1. HyperscapeClient (core connection)
- WebSocket connection to game server
- MessagePack serialization/deserialization  
- Authentication via Privy token
- Reconnection handling
- Event emitter for game state updates

### 2. Game State Manager
- Track player state (position, health, inventory, skills)
- Track nearby entities (NPCs, players, items)
- Track available actions based on context

### 3. Clawdbot Tools (actions)
| Tool | Description |
|------|-------------|
| `hyperscape_connect` | Connect to game server |
| `hyperscape_move` | Move to position or entity |
| `hyperscape_attack` | Attack target entity |
| `hyperscape_chop` | Chop nearby tree |
| `hyperscape_fish` | Fish at nearby spot |
| `hyperscape_cook` | Cook food on fire |
| `hyperscape_pickup` | Pick up ground item |
| `hyperscape_drop` | Drop inventory item |
| `hyperscape_equip` | Equip item |
| `hyperscape_bank` | Deposit/withdraw from bank |
| `hyperscape_chat` | Send chat message |
| `hyperscape_status` | Get current game state |

### 4. Clawdbot Providers (context)
| Provider | Description |
|----------|-------------|
| `gameState` | Current player stats, position |
| `inventory` | Items in inventory |
| `nearbyEntities` | NPCs, players, items nearby |
| `availableActions` | Context-aware action list |

## File Structure

```
packages/skill-hyperscape/
├── SKILL.md              # Clawdbot skill manifest
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Skill entry point
│   ├── client.ts         # WebSocket client
│   ├── state.ts          # Game state manager
│   ├── tools/
│   │   ├── connect.ts
│   │   ├── movement.ts
│   │   ├── combat.ts
│   │   ├── skills.ts
│   │   ├── inventory.ts
│   │   ├── social.ts
│   │   └── index.ts
│   ├── providers/
│   │   ├── gameState.ts
│   │   ├── inventory.ts
│   │   ├── nearbyEntities.ts
│   │   └── index.ts
│   └── types.ts          # Shared types (from hyperscape)
└── README.md
```

## Implementation Phases

### Phase 1: Core Connection (MVP)
- [ ] WebSocket client with MessagePack
- [ ] Authentication flow
- [ ] Basic state tracking (position, health)
- [ ] `hyperscape_connect` tool
- [ ] `hyperscape_status` tool
- [ ] `hyperscape_move` tool

### Phase 2: Combat & Skills
- [ ] `hyperscape_attack` tool
- [ ] `hyperscape_chop` tool
- [ ] `hyperscape_fish` tool
- [ ] Combat state tracking
- [ ] Skill XP tracking

### Phase 3: Inventory & Banking
- [ ] `hyperscape_pickup` tool
- [ ] `hyperscape_drop` tool
- [ ] `hyperscape_equip` tool
- [ ] `hyperscape_bank` tool
- [ ] Inventory state provider

### Phase 4: Social & Polish
- [ ] `hyperscape_chat` tool
- [ ] Nearby entities provider
- [ ] Available actions provider
- [ ] Error handling improvements
- [ ] Reconnection logic

## Dependencies

```json
{
  "dependencies": {
    "ws": "^8.18.0",
    "@msgpack/msgpack": "^3.0.0"
  }
}
```

## Message Protocol

Hyperscape uses MessagePack over WebSocket. Key message types:

**Client → Server:**
- `auth`: `{ type: "auth", token: string }`
- `move`: `{ type: "move", position: {x, y, z} }`
- `attack`: `{ type: "attack", targetId: string }`
- `action`: `{ type: "action", action: string, data: any }`

**Server → Client:**
- `state`: Full game state update
- `entity_update`: Entity changes
- `chat`: Chat messages
- `error`: Error messages

## Testing Strategy

1. **Unit tests**: State management, message parsing
2. **Integration tests**: Connect to local hyperscape server
3. **E2E tests**: Full gameplay loops (move, attack, loot)

## Success Criteria

- [ ] Clawdbot can connect and authenticate to Hyperscape
- [ ] Agent can move around the world
- [ ] Agent can attack NPCs
- [ ] Agent can train skills (woodcutting, fishing)
- [ ] Agent can manage inventory
- [ ] Agent can respond to game state in conversation

## References

- Hyperscape repo: https://github.com/HyperscapeAI/hyperscape
- plugin-hyperscape: `/packages/plugin-hyperscape/`
- ElizaOS types: `@elizaos/core`
- Clawdbot skills: https://docs.clawd.bot/skills
