# RAM Maps

Memory addresses for reading game state directly.

## Example Platformer Game

| Address | Name | Type | Description |
|---------|------|------|-------------|
| `0x0094` | player_x | u16 | X position (little-endian) |
| `0x0096` | player_y | u16 | Y position (little-endian) |
| `0x0019` | powerup | u8 | 0=Small, 1=Big, 2=Cape, 3=Fire |
| `0x0071` | dying | u8 | Non-zero when player is dying |
| `0x0DBE` | lives | u8 | Lives remaining |
| `0x0DBF` | coins | u8 | Coins collected |
| `0x13EF` | on_ground | u8 | Non-zero when on ground |

### Usage Example

```python
from superpy import SuperPy

snes = SuperPy("your_game.smc")  # Your legally obtained ROM

# Read player's position (16-bit, little-endian)
player_x = int.from_bytes(snes.memory[0x94:0x96], 'little')
player_y = int.from_bytes(snes.memory[0x96:0x98], 'little')

# Read single-byte values
coins = int(snes.memory[0xDBF])
lives = int(snes.memory[0xDBE])
powerup = int(snes.memory[0x19])

print(f"Pos: ({player_x}, {player_y}), Coins: {coins}, Lives: {lives}")
```

---

## The Legend of Zelda: A Link to the Past

| Address | Name | Type | Description |
|---------|------|------|-------------|
| `0x0022` | link_x | u16 | Link X position |
| `0x0020` | link_y | u16 | Link Y position |
| `0x036D` | hearts | u8 | Current hearts |
| `0x036E` | rupees | u8 | Rupee count (low byte) |
| `0x007B` | room_id | u8 | Current room/dungeon ID |

---

## Super Metroid

| Address | Name | Type | Description |
|---------|------|------|-------------|
| `0x0AF6` | samus_x | u16 | Samus X position |
| `0x0AFA` | samus_y | u16 | Samus Y position |
| `0x09C2` | health | u16 | Current energy |
| `0x09C6` | missiles | u8 | Missile count |

---

## Contributing RAM Maps

Found a useful memory address? Add it to our community-maintained collection:

1. Use a memory viewer/debugger to find addresses
2. Document the address, data type, and meaning
3. Submit a PR to `ram_maps/<game_name>.json`

### JSON Format

```json
{
  "game": "Example Platformer",
  "region": "USA",
  "addresses": [
    {
      "address": "0x0094",
      "name": "player_x",
      "type": "u16",
      "endian": "little",
      "description": "Player X position in pixels"
    }
  ]
}
```
