# LABYRINTH — Crown of the Deep

An old-school first-person dungeon crawler in the style of early-90s DOS games
(Wolfenstein 3D / DOOM era). Software-rendered raycaster at 320×200, chunky
pixels, procedurally generated labyrinths, and a WebAudio chiptune soundscape —
all in vanilla JavaScript with zero dependencies.

The Crown of the Deep lies lost on the 8th floor of the labyrinth.
None who sought it have returned.

## Play

Serve the folder with any static file server and open it in a browser:

```bash
python -m http.server 8123
```

Then visit `http://localhost:8123`.

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move / strafe |
| Mouse (click to capture) or `←` `→` | Turn |
| `Space` / left click | Sword attack |
| `E` | Open / unlock doors |
| `Shift` | Run |
| `Tab` | Toggle map (fog of war) |
| `M` | Toggle sound |
| `Esc` | Pause menu (save / quit) |
| `↑` `↓` + `Enter` | Navigate menus |

## Saving

Three save slots, stored in your browser's localStorage. Save any time from
the pause menu (`Esc` → SAVE GAME); the game also autosaves to your slot on
every stair descent. Quitting to the title does **not** save — anything since
your last save or descent is lost. The title screen offers CONTINUE (most
recent slot), NEW GAME, and LOAD GAME. A save captures the full mid-floor
state — position, health, gold, keys, every enemy, item, opened door, and
your explored map. Dungeon layouts are not stored: they regenerate
deterministically from the run's seed.

## The game

- **Endless procedural labyrinths** — every floor is a fresh maze of corridors
  and rooms, decorated with moss, glowing runes, banners, and skull niches.
  Floors grow larger and deadlier as you descend.
- **Locked doors & keys** — most floors bar the way to the stairs with a locked
  door; the iron key is hidden somewhere in the reachable half of the maze.
- **Three foes** — giant rats (fast, weak), skeleton warriors (steady, armed),
  and dark wraiths (fast, vicious, glowing eyes). They wander until they see
  you, then they hunt.
- **Loot** — gold piles for score, crimson draughts to heal (+30), slain foes
  drop coin.
- **The Crown** — reach floor 8, THE THRONE OF THE DEEP, and take it. The
  stairs descend further for those who want an endless high-score run; your
  deepest delve is remembered.

## Tech notes

- Pure canvas software rendering: DDA raycast walls, per-row textured
  floor/ceiling casting, z-buffered billboard sprites, distance fog quantized
  into DOS-style light bands, torch flicker.
- Wolf3D-style sliding doors rendered in the raycast core.
- All textures and sprites are generated procedurally at boot (no image
  assets); text uses a hand-built 5×7 bitmap font.
- All sound is synthesized live with WebAudio (no audio assets): sword, doors,
  pickups, monster voices, and a slow minor-key ambient drone.
- Mazes come from a recursive-backtracker with rooms carved on top for loops
  and combat spaces; key/lock placement is validated with BFS reachability.
- The code is split into an engine layer (`js/engine/`: raycaster, grid
  queries, input, synth — no game knowledge) and a game layer (`js/game/`:
  tiles, balance config, art, sfx, dungeon, actors, UI, saves).

Built as a one-shot by Claude.
