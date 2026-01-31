# Hyperscape Clawdbot Skill - Implementation Plan

## Overview
Enable Clawdbot/OpenClaw agents to play Hyperscape by connecting directly to the game server via WebSocket.

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
         │ WebSocket + MessagePack
         ▼
┌─────────────────────────────────────────┐
│ Hyperscape Server (port 5555)           │
└─────────────────────────────────────────┘
```

## Implementation Progress

### Phase 1: Core Connection ✅ COMPLETE
- [x] WebSocket client with MessagePack
- [x] Authentication flow (Privy token)
- [x] Basic state tracking (position, health)
- [x] `hyperscape_connect` tool
- [x] `hyperscape_status` tool
- [x] `hyperscape_move` tool
- [x] Packet list synced with server (200+ packets)

### Phase 2: Combat & Skills ✅ COMPLETE
- [x] `hyperscape_attack` tool (melee/ranged/magic)
- [x] `hyperscape_gather` tool (trees, rocks, fishing)
- [x] `hyperscape_cook` tool
- [x] `hyperscape_light_fire` tool
- [x] Combat state tracking (target, style, auto-retaliate)
- [x] Skill XP tracking via skillsUpdated/xpDrop packets
- [x] `hyperscape_change_attack_style` tool
- [x] `hyperscape_auto_retaliate` tool

### Phase 3: Inventory & Banking ✅ COMPLETE
- [x] `hyperscape_pickup` tool
- [x] `hyperscape_drop` tool
- [x] `hyperscape_equip` tool
- [x] `hyperscape_unequip` tool
- [x] `hyperscape_use_item` tool
- [x] `hyperscape_bank_deposit` tool
- [x] `hyperscape_bank_withdraw` tool
- [x] `hyperscape_bank_deposit_all` tool
- [x] `hyperscape_bank_close` tool
- [x] Inventory state provider
- [x] Bank state provider

### Phase 4: NPC & Social ✅ COMPLETE
- [x] `hyperscape_npc_interact` tool
- [x] `hyperscape_dialogue_respond` tool
- [x] `hyperscape_dialogue_continue` tool
- [x] `hyperscape_dialogue_close` tool
- [x] `hyperscape_store_buy` tool
- [x] `hyperscape_store_sell` tool
- [x] `hyperscape_store_close` tool
- [x] `hyperscape_chat` tool
- [x] `hyperscape_follow` tool
- [x] Nearby entities provider
- [x] Available actions provider
- [x] Death/respawn handling

### Phase 5: Autonomous Agent Mode ✅ COMPLETE
- [x] Goal templates system (8 goals)
  - flee_danger, eat_food, respawn (survival)
  - train_combat (combat)
  - gather_resources, collect_loot (gathering)
  - explore_area, bank_items (exploration/management)
- [x] Guardrails system (9 rules)
  - no_combat_low_hp, flee_threshold (survival)
  - no_drop_valuables, no_sell_valuables (item protection)
  - no_attack_high_level, no_multi_combat (combat safety)
  - inventory_full_warning (resource management)
  - respect_dialogue, respect_bank, respect_store (UI state)
- [x] THINKING+ACTION decision loop
- [x] `hyperscape_auto_start` tool
- [x] `hyperscape_auto_stop` tool
- [x] `hyperscape_auto_status` tool
- [x] Session stats tracking (XP, kills, resources, deaths)
- [x] Goal context with diversity scoring
- [ ] Telegram topic logging integration

### Phase 6: Advanced Features (TODO)
- [ ] Quest system tools (getQuestList, acceptQuest, etc.)
- [ ] Player trading tools
- [ ] Dueling system
- [ ] Prayer/spell system
- [ ] Friends list / private messages
- [ ] Smelting/smithing tools

## File Structure

```
packages/skill-hyperscape/
├── SKILL.md              # Clawdbot skill manifest
├── PLAN.md               # This file
├── README.md             # User documentation
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Skill entry point, all tools
│   ├── client.ts         # WebSocket client
│   ├── types.ts          # Shared types, packet definitions
│   └── autonomy/         # Autonomous agent system
│       ├── index.ts      # Module exports
│       ├── goals.ts      # Goal templates
│       ├── guardrails.ts # Safety rules
│       └── agent.ts      # AutonomousAgent class
└── dist/                 # Compiled output
```

## Tools Summary (36 total)

### Connection (3)
- hyperscape_connect
- hyperscape_disconnect
- hyperscape_status

### Movement (2)
- hyperscape_move
- hyperscape_home_teleport

### Combat (4)
- hyperscape_attack
- hyperscape_change_attack_style
- hyperscape_auto_retaliate
- hyperscape_respawn

### Gathering (3)
- hyperscape_gather
- hyperscape_cook
- hyperscape_light_fire

### Inventory (5)
- hyperscape_pickup
- hyperscape_drop
- hyperscape_equip
- hyperscape_unequip
- hyperscape_use_item

### Banking (4)
- hyperscape_bank_deposit
- hyperscape_bank_deposit_all
- hyperscape_bank_withdraw
- hyperscape_bank_close

### NPCs & Dialogue (4)
- hyperscape_npc_interact
- hyperscape_dialogue_respond
- hyperscape_dialogue_continue
- hyperscape_dialogue_close

### Store (3)
- hyperscape_store_buy
- hyperscape_store_sell
- hyperscape_store_close

### Social (2)
- hyperscape_chat
- hyperscape_follow

### Autonomous Agent (4)
- hyperscape_auto_start
- hyperscape_auto_stop
- hyperscape_auto_status
- hyperscape_auto_set_logger

## Providers (4)
- gameState - Position, health, skills, inventory
- availableActions - Context-aware action list
- bankState - Bank contents when open
- autonomousStatus - Agent running state, stats, thoughts

## Dependencies

```json
{
  "dependencies": {
    "ws": "^8.18.0",
    "msgpackr": "^1.11.0"
  }
}
```

## Testing Strategy

1. **Build test**: `npm run build` compiles without errors
2. **Connection test**: Connect to local hyperscape server
3. **Integration tests**: Full gameplay loops
4. **Autonomous test**: Let agent run for 10+ minutes
5. **E2E with agent**: Test with actual Clawdbot instance

## Next Steps

1. Wire up Telegram logging in autonomous agent
2. Publish to npm as @clawdbot/skill-hyperscape
3. Test with running Hyperscape server
4. Add quest system tools
5. Add player trading
6. Create example agent workflows
