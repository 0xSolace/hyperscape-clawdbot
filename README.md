# @openclaw/skill-hyperscape

> 🎮 Play Hyperscape MMORPG as an OpenClaw AI agent — now with autonomous mode!

This skill enables [OpenClaw](https://openclaw.ai) AI agents to play [Hyperscape](https://github.com/HyperscapeAI/hyperscape), a RuneScape-inspired MMORPG with AI-native gameplay.

## Features

- **36 Game Tools** - Full control: movement, combat, gathering, inventory, banking, NPCs, stores
- **Autonomous Mode** - Goal-based AI plays independently with THINKING+ACTION loop
- **Guardrails** - Safety rules prevent bad behavior (flee at low HP, protect valuables)
- **Real-time State** - Track position, health, skills, inventory, nearby entities
- **Telegram Logging** - Stream agent thoughts to a topic for observability
- **Direct WebSocket** - Binary MessagePack protocol for efficiency

## Quick Start

### Manual Play

```
Connect to hyperscape and tell me what's nearby

Attack the nearest goblin

Chop some trees until inventory is full

Bank all my items
```

### Autonomous Mode

```
Start autonomous hyperscape agent for 30 minutes, log to telegram
```

The agent will:
- Select goals based on context (combat, gathering, exploring)
- Follow safety guardrails (flee when low HP, don't drop valuables)
- Log THINKING+ACTION decisions to Telegram for observability
- Track XP gains, kills, resources gathered

## Installation

```bash
npm install @openclaw/skill-hyperscape
```

## Usage with OpenClaw

Add to your agent's skills configuration:

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

Set environment variables:

```bash
export HYPERSCAPE_SERVER_URL="ws://localhost:5555/ws"
export HYPERSCAPE_AUTH_TOKEN="your-privy-token"  # optional
```

## Tools (36 total)

### Connection
| Tool | Description |
|------|-------------|
| `hyperscape_connect` | Connect to game server and enter world |
| `hyperscape_disconnect` | Disconnect from server |
| `hyperscape_status` | Get full game state |

### Movement
| Tool | Description |
|------|-------------|
| `hyperscape_move` | Move to coordinates (x, y, z) |
| `hyperscape_home_teleport` | Teleport to spawn |

### Combat
| Tool | Description |
|------|-------------|
| `hyperscape_attack` | Attack mob/enemy (melee/ranged/magic) |
| `hyperscape_change_attack_style` | Change combat style |
| `hyperscape_auto_retaliate` | Toggle auto-retaliate |
| `hyperscape_respawn` | Respawn after death |

### Gathering
| Tool | Description |
|------|-------------|
| `hyperscape_gather` | Gather from resource (tree, rock, fishing) |
| `hyperscape_cook` | Cook food on fire/range |
| `hyperscape_light_fire` | Light a fire |

### Inventory
| Tool | Description |
|------|-------------|
| `hyperscape_pickup` | Pick up ground item |
| `hyperscape_drop` | Drop item |
| `hyperscape_equip` | Equip item |
| `hyperscape_unequip` | Unequip item |
| `hyperscape_use_item` | Use item (eat, drink, etc) |

### Banking
| Tool | Description |
|------|-------------|
| `hyperscape_bank_deposit` | Deposit item |
| `hyperscape_bank_deposit_all` | Deposit all items |
| `hyperscape_bank_withdraw` | Withdraw item |
| `hyperscape_bank_close` | Close bank |

### NPCs & Dialogue
| Tool | Description |
|------|-------------|
| `hyperscape_npc_interact` | Talk/trade/bank with NPC |
| `hyperscape_dialogue_respond` | Select dialogue option |
| `hyperscape_dialogue_continue` | Continue dialogue |
| `hyperscape_dialogue_close` | Close dialogue |

### Store
| Tool | Description |
|------|-------------|
| `hyperscape_store_buy` | Buy from store |
| `hyperscape_store_sell` | Sell to store |
| `hyperscape_store_close` | Close store |

### Social
| Tool | Description |
|------|-------------|
| `hyperscape_chat` | Send chat message |
| `hyperscape_follow` | Follow player |

### Autonomous Agent
| Tool | Description |
|------|-------------|
| `hyperscape_auto_start` | Start autonomous mode |
| `hyperscape_auto_stop` | Stop and get stats |
| `hyperscape_auto_status` | Get status and thoughts |

## Autonomous Agent Mode

The skill includes a sophisticated autonomous agent inspired by [Eliza's plugin-hyperscape](https://github.com/HyperscapeAI/hyperscape).

### Goal System

The agent selects from 8 goal templates based on current state:

| Goal | Category | Trigger |
|------|----------|---------|
| `flee_danger` | survival | HP < 25% |
| `eat_food` | survival | HP < 60% and has food |
| `respawn` | survival | Dead |
| `train_combat` | combat | Mobs nearby, has weapon |
| `gather_resources` | gathering | Resources nearby |
| `collect_loot` | gathering | Items on ground |
| `explore_area` | exploration | Nothing else to do |
| `bank_items` | management | Inventory nearly full |

Goals are scored with diversity penalties to encourage varied gameplay.

### Guardrails

Safety rules prevent bad behavior:

| Rule | Severity | Description |
|------|----------|-------------|
| `no_combat_low_hp` | block | Can't attack when HP < 25% |
| `flee_threshold` | critical | Must flee when HP < 15% |
| `no_drop_valuables` | block | Never drop rare items |
| `no_sell_valuables` | warning | Warn before selling rares |
| `no_attack_high_level` | warning | Warn about overpowered mobs |
| `no_multi_combat` | warning | Warn about target switching |
| `inventory_full_warning` | warning | Warn when inventory full |
| `respect_dialogue` | block | Complete dialogues first |
| `respect_bank/store` | block | Close UI before moving |

### Example: Start Autonomous Agent

```typescript
// Via tool call
hyperscape_auto_start({
  telegramChatId: "-100123456789",
  telegramTopicId: 12345,
  tickInterval: 10000,      // 10 second decision cycles
  maxDuration: 60,          // 60 minute session
  verbose: true
})

// Check status
hyperscape_auto_status({ thoughtCount: 5 })

// Stop and get stats
hyperscape_auto_stop()
// Returns: { goalsCompleted, mobsKilled, resourcesGathered, totalXp, deaths }
```

## Standalone Usage

```typescript
import { HyperscapeClient, createAutonomousAgent } from '@openclaw/skill-hyperscape';

// Manual control
const client = new HyperscapeClient({
  serverUrl: 'ws://localhost:5555/ws'
});

await client.connect();
await client.enterWorld();
client.clientReady();

client.move([100, 0, 100]);
client.attack('mob-123');
console.log(client.getStateContext());

// Autonomous mode
const agent = createAutonomousAgent(client, {
  tickInterval: 10000,
  maxSessionDuration: 3600000,
  verbose: true
});

agent.on('log', console.log);
await agent.start();

// Later...
await agent.stop();
console.log(agent.getStats());
```

## Architecture

```
┌─────────────────────────────────────────┐
│ OpenClaw Session                        │
│  └─ hyperscape_auto_start               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ AutonomousAgent                         │
│  ├─ GoalTemplates (8 goals)             │
│  ├─ Guardrails (9 safety rules)         │
│  ├─ THINKING+ACTION decision loop       │
│  ├─ HyperscapeClient                    │
│  └─ Logger → Telegram/Console           │
└─────────────────────────────────────────┘
         │ WebSocket + MessagePack
         ▼
┌─────────────────────────────────────────┐
│ Hyperscape Server                       │
└─────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HYPERSCAPE_SERVER_URL` | WebSocket URL | `ws://localhost:5555/ws` |
| `HYPERSCAPE_AUTH_TOKEN` | Privy auth token | - |
| `HYPERSCAPE_PRIVY_USER_ID` | Privy user ID | - |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck
```

## Protocol

Uses binary WebSocket with MessagePack serialization. Packet IDs map to 200+ server methods for efficient bandwidth usage.

## License

MIT

## Credits

- [Hyperscape](https://github.com/HyperscapeAI/hyperscape) - AI-native MMORPG
- [OpenClaw](https://openclaw.ai) - AI agent framework
- [ElizaOS](https://github.com/elizaOS/eliza) - Multi-agent AI framework
