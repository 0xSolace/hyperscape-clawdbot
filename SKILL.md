---
name: hyperscape
description: Play Hyperscape MMORPG as an AI agent. Connect to game server, move around, fight, gather resources, and interact with the world.
---

# Hyperscape Skill

Enables Clawdbot agents to play Hyperscape, a RuneScape-inspired MMORPG.

## Setup

1. Have a Hyperscape server running (default: ws://localhost:5555/ws)
2. Get auth credentials (Privy token or guest mode)
3. Configure connection in environment or via tool

## Tools

### Connection
- `hyperscape_connect` - Connect to game server
- `hyperscape_disconnect` - Disconnect from server
- `hyperscape_status` - Get connection and game state

### Movement
- `hyperscape_move` - Move to position or named location
- `hyperscape_follow` - Follow another entity

### Combat
- `hyperscape_attack` - Attack a target entity
- `hyperscape_flee` - Run away from combat

### Skills
- `hyperscape_chop` - Chop a nearby tree
- `hyperscape_fish` - Fish at a nearby fishing spot
- `hyperscape_cook` - Cook food on a fire
- `hyperscape_mine` - Mine a nearby rock

### Inventory
- `hyperscape_pickup` - Pick up ground item
- `hyperscape_drop` - Drop item from inventory
- `hyperscape_equip` - Equip an item
- `hyperscape_use` - Use an item

### Social
- `hyperscape_chat` - Send chat message
- `hyperscape_emote` - Perform emote

## Environment Variables

- `HYPERSCAPE_SERVER_URL` - WebSocket URL (default: ws://localhost:5555/ws)
- `HYPERSCAPE_AUTH_TOKEN` - Privy auth token (optional)

## Example Usage

```
Connect to hyperscape and show my status

Move to the forest

Attack the nearest goblin

Chop trees until I have 10 logs
```
