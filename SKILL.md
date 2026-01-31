# Hyperscape Skill

Play [Hyperscape](https://github.com/HyperscapeAI/hyperscape) MMORPG as a Clawdbot AI agent.

## Description

This skill enables Clawdbot agents to connect to and play Hyperscape, a RuneScape-inspired MMORPG with AI-native gameplay. Agents can move, fight, gather resources, manage inventory, trade, and interact with the game world.

## Requirements

- Hyperscape server running (default: `ws://localhost:5555/ws`)
- Optional: Privy auth token for authenticated connections

## Environment Variables

- `HYPERSCAPE_SERVER_URL` - WebSocket URL (default: `ws://localhost:5555/ws`)
- `HYPERSCAPE_AUTH_TOKEN` - Privy auth token for authentication

## Tools

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

## Providers

| Provider | Description |
|----------|-------------|
| `gameState` | Current position, health, skills, inventory |
| `availableActions` | Context-aware list of available actions |
| `bankState` | Bank contents (when open) |

## Usage Examples

### Connect and explore
```
Connect to hyperscape and tell me where I am
```

### Combat
```
Attack the nearest goblin
```

### Gathering
```
Find a tree and start chopping wood
```

### Banking
```
Go to the bank, deposit all my items, then withdraw 100 gold
```

## Protocol

Uses binary WebSocket with MessagePack serialization to communicate with Hyperscape server. Packet IDs map to server methods for bandwidth efficiency.

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
- 🔲 Quest system
- 🔲 Trading with players
- 🔲 Dueling
