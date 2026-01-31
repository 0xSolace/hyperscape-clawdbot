# Hyperscape Skill

Play [Hyperscape](https://github.com/HyperscapeAI/hyperscape) MMORPG as an OpenClaw AI agent.

## Description

This skill enables OpenClaw agents to connect to and play Hyperscape, a RuneScape-inspired MMORPG with AI-native gameplay. Agents can move, fight, gather resources, manage inventory, trade, and interact with the game world.

**Now with Autonomous Mode!** Sub-agents can play independently using a goal-based AI system with guardrails, THINKING+ACTION decision loop, and Telegram logging for observability.

## Requirements

- Hyperscape server running (default: `ws://localhost:5555/ws`)
- Optional: Privy auth token for authenticated connections
- Optional: Telegram bot for autonomous agent logging

## Environment Variables

- `HYPERSCAPE_SERVER_URL` - WebSocket URL (default: `ws://localhost:5555/ws`)
- `HYPERSCAPE_AUTH_TOKEN` - Privy auth token for authentication

## Quick Start

### Manual Play
```
Connect to hyperscape and tell me where I am
```

### Autonomous Mode
```
Start autonomous hyperscape agent, log to telegram topic 12345 in chat -100123456
```

---

## Autonomous Agent Mode

The skill includes a sophisticated autonomous agent that can play the game independently:

### Features

- **Goal System** - Prioritizes survival, combat training, resource gathering, exploration
- **Guardrails** - Safety rules prevent bad behavior (flee at low HP, don't drop valuables)
- **THINKING+ACTION Loop** - Transparent decision-making with logged reasoning
- **Telegram Logging** - Stream activity to a topic for real-time observability
- **Session Management** - Auto-stop after configurable duration

### Tools

| Tool | Description |
|------|-------------|
| `hyperscape_auto_start` | Start autonomous mode with optional Telegram logging |
| `hyperscape_auto_stop` | Stop autonomous agent, return stats |
| `hyperscape_auto_status` | Get current stats and recent thoughts |

### Goal Templates

The agent selects from available goals based on current state:

| Goal | Category | Description |
|------|----------|-------------|
| `flee_danger` | survival | HP critically low, escape and heal |
| `eat_food` | survival | Heal up when HP is low |
| `respawn` | survival | Respawn after death |
| `train_combat` | combat | Fight mobs for XP |
| `gather_resources` | gathering | Chop trees, mine rocks, fish |
| `collect_loot` | gathering | Pick up ground items |
| `explore_area` | exploration | Wander to new locations |
| `bank_items` | management | Deposit items when inventory full |

### Guardrails

Safety rules that prevent bad behavior:

| Guardrail | Severity | Description |
|-----------|----------|-------------|
| `no_combat_low_hp` | block | Don't attack when HP < 25% |
| `flee_threshold` | critical | Force flee when HP < 15% |
| `no_drop_valuables` | block | Never drop rare items |
| `no_attack_high_level` | warning | Warn about overpowered mobs |
| `inventory_full_warning` | warning | Warn when inventory nearly full |
| `respect_dialogue` | block | Complete dialogues before other actions |
| `respect_bank` | block | Close bank before moving |

### Example: Start Autonomous Agent

```
hyperscape_auto_start({
  telegramChatId: "-100123456789",
  telegramTopicId: 12345,
  tickInterval: 10000,      // 10 second decision cycles
  maxDuration: 60,          // 60 minute max session
  verbose: true
})
```

---

## Manual Tools (32 total)

### Connection
| Tool | Description |
|------|-------------|
| `hyperscape_connect` | Connect to game server and enter world |
| `hyperscape_disconnect` | Disconnect from server |
| `hyperscape_status` | Get full game state, position, health, skills, inventory, nearby entities |

### Movement
| Tool | Description |
|------|-------------|
| `hyperscape_move` | Move to coordinates (x, y, z) |
| `hyperscape_home_teleport` | Teleport to spawn location |

### Combat
| Tool | Description |
|------|-------------|
| `hyperscape_attack` | Attack a mob or enemy (melee/ranged/magic) |
| `hyperscape_change_attack_style` | Change combat attack style |
| `hyperscape_auto_retaliate` | Toggle auto-retaliate on/off |
| `hyperscape_respawn` | Respawn after death |

### Gathering
| Tool | Description |
|------|-------------|
| `hyperscape_gather` | Gather from resource (tree, rock, fishing spot) |
| `hyperscape_cook` | Cook food on fire/range |
| `hyperscape_light_fire` | Light a fire with tinderbox + logs |

### Inventory
| Tool | Description |
|------|-------------|
| `hyperscape_pickup` | Pick up ground item |
| `hyperscape_drop` | Drop item from inventory |
| `hyperscape_equip` | Equip item |
| `hyperscape_unequip` | Unequip item to inventory |
| `hyperscape_use_item` | Use item (eat, drink, etc) |

### Banking
| Tool | Description |
|------|-------------|
| `hyperscape_bank_deposit` | Deposit item to bank |
| `hyperscape_bank_deposit_all` | Deposit all inventory items |
| `hyperscape_bank_withdraw` | Withdraw item from bank |
| `hyperscape_bank_close` | Close bank interface |

### NPCs & Dialogue
| Tool | Description |
|------|-------------|
| `hyperscape_npc_interact` | Interact with NPC (talk, trade, bank) |
| `hyperscape_dialogue_respond` | Select dialogue option |
| `hyperscape_dialogue_continue` | Continue dialogue |
| `hyperscape_dialogue_close` | Close dialogue |

### Store
| Tool | Description |
|------|-------------|
| `hyperscape_store_buy` | Buy item from store |
| `hyperscape_store_sell` | Sell item to store |
| `hyperscape_store_close` | Close store |

### Social
| Tool | Description |
|------|-------------|
| `hyperscape_chat` | Send chat message |
| `hyperscape_follow` | Follow another player |

---

## Providers

| Provider | Description |
|----------|-------------|
| `gameState` | Current position, health, skills, inventory |
| `availableActions` | Context-aware list of available actions |
| `bankState` | Bank contents (when open) |
| `autonomousStatus` | Autonomous agent status and recent thoughts |

---

## Architecture

```
┌─────────────────────────────────────────┐
│ OpenClaw Session (main)                 │
│  └─ hyperscape_auto_start               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ AutonomousAgent                         │
│  ├─ GoalTemplates (what to do)          │
│  ├─ Guardrails (safety rules)           │
│  ├─ THINKING+ACTION loop                │
│  ├─ HyperscapeClient (game connection)  │
│  └─ Logger → Telegram topic             │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Hyperscape Server                       │
│  ├─ WebSocket (MessagePack binary)      │
│  └─ Game world                          │
└─────────────────────────────────────────┘
```

---

## Protocol

Uses binary WebSocket with MessagePack serialization to communicate with Hyperscape server. Packet IDs map to server methods for bandwidth efficiency.

---

## Status

- ✅ Connection & authentication
- ✅ Movement & positioning
- ✅ Combat & attack styles
- ✅ Resource gathering
- ✅ Inventory management
- ✅ Banking
- ✅ NPC interaction & dialogue
- ✅ Store buying/selling
- ✅ Chat & social
- ✅ **Autonomous agent mode**
- ✅ **Goal-based AI**
- ✅ **Guardrails/safety rules**
- ✅ **THINKING+ACTION loop**
- 🔲 Telegram topic logging integration
- 🔲 Quest system
- 🔲 Trading with players
- 🔲 Dueling
- 🔲 Prayer/spells
