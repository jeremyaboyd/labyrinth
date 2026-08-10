# LABYRINTH — Crown of the Deep

An old-school first-person dungeon crawler in the style of early-90s DOS games
(Wolfenstein 3D / DOOM era). Software-rendered raycaster at 320×200, chunky
pixels, procedurally generated labyrinths, and a WebAudio chiptune soundscape —
all in vanilla JavaScript with zero dependencies.

You begin on the shore at Kingshore, under an open sky. The Crown of the Deep
lies lost on the 8th floor of the labyrinth beneath the castle.
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
| `Space` / left click | Attack with the equipped weapon |
| `E` | Take the stairs you stand on (pick a floor), open / unlock doors, trade at a shop window |
| `I` | Open your pack (10 slots) |
| `Q` | Quick items — drink without hunting through the pack |
| `J` | Journal — your quests, and which one you are tracking |
| `Shift` | Run |
| `M` | Toggle map (fog of war) |
| `Tab` | Pause menu, and back out of any screen |
| `↑` `↓` to move, `Enter` / numpad `Enter` / `E` to confirm | Navigate menus |

HELP, on both the title and pause menus, lists all of the above in game.
Sound is toggled from OPTIONS, on the same two menus.

## Saving

Three save slots, stored in your browser's localStorage. Save any time from
the pause menu (`Esc` → SAVE GAME); the game also autosaves to your slot on
every change of floor. Quitting to the title does **not** save — anything since
your last save or descent is lost. The title screen offers CONTINUE (most
recent slot), NEW GAME, and LOAD GAME. A save captures the full mid-floor
state — position, health, gold, keys, every enemy, item, opened door, and
your explored map, your pack and what you have equipped, and which shop
lines you have already bought out. Dungeon layouts are not stored: they
regenerate deterministically from the run's seed. Saves from before the
shops update still load — those runs simply keep their starting kit.

## The game

- **The surface (level 0)** — a fixed, hand-drawn world: a village of timber
  cottages, woods, a castle against the mountains, and a beach along the bay.
  Mountains wall off the north and west, the sea closes the south and east.
  Villagers wander the lanes. It is the same world every run — only what lies
  below is rolled fresh.
- **Day and night** — one real minute is one hour. Dawn breaks at 6, full day
  runs from 7, dusk falls at 21 and night holds from 22. The sky shifts from
  stars to sunrise to blue to a red sunset and back, the land brightens and
  darkens with it, the lamp posts light at dusk and go out at dawn, and cottage
  windows glow from 6pm until 11pm.
- **Quests** — you begin under a royal summons. Find the king in the castle
  courtyard, hear him out, and he sets you after the crown. `J` opens the
  journal: pick a quest to set it active or read what you have learned so far.
  Only one is tracked at a time, and the tracked one names itself in the top
  right and marks its destination on the map. Fog of war can be turned off in
  OPTIONS if you would rather see the whole world.
- **People** — press `E` on a villager and choose to TALK or TRADE. Trading
  opens their pockets: a few sundries at village prices. Talking may hand you
  an errand — somebody has lost a keepsake, somewhere in Kingshore or down in
  the labyrinth (never deeper than one floor past your deepest), and bringing
  it back pays gold. Up to three errands can be outstanding at once; they live
  in the journal like any quest, and the tracked one marks the keepsake — or,
  once you carry it, the villager waiting for it — on the map. The king is
  above bartering: `E` gets you his audience, as ever.
- **Down into the dark** — the way below is in the castle courtyard, through
  the front gate. The clock keeps its own counsel once you are underground.
- **Endless procedural labyrinths** — every floor below is a fresh maze of corridors
  and rooms, decorated with moss, glowing runes, banners, and skull niches.
  Floors grow larger and deadlier as you descend.
- **Locked doors & keys** — most floors bar the way to the stairs with a locked
  door; the iron key is hidden somewhere in the reachable half of the maze.
- **Stairs both ways** — every floor has a flight down at its far end and the
  flight you arrived by at its head. Press `E` on either and the stairwell asks
  how far you mean to go, listing the floors by name. The climb offers
  everything above you, so you can go from the deep straight to the castle
  courtyard to carry the crown home and restock at the village. The descent
  offers everything down to the deepest floor you have reached, and only from
  that floor itself can you press on into UNTRODDEN ground — the labyrinth is
  not handing you a shortcut past what you have not seen. Ground you have
  already walked stays lit: no fog on a floor you finished. The floor itself is
  rebuilt from the seed when you return, so the walls are where you left them,
  but the monsters and the loot are not.
- **Three foes** — giant rats (fast, weak), skeleton warriors (steady, armed),
  and dark wraiths (fast, vicious, glowing eyes). They wander until they see
  you, then they hunt.
- **Shop windows** — some walls are cut through with an arched window: a
  hooded keeper behind a counter, wares on the shelf, and a brass plaque
  naming the trade. Press `E` at the counter to spend your gold. Every floor
  has one to three of them, and the stock deepens as you descend.
- **Gear** — bronze, iron and steel swords; a hunting bow that eats the arrows
  you carry (bronze, iron, steel); an arcane staff that spends mana to throw
  magic bolts. Leather, iron and steel armour soak 15, 30 and 45 percent of
  every blow. Vitality and arcane tonics raise your maximum HP and MP for good.
- **Your pack** — ten slots, no more. `I` opens it; `Enter` on a row offers
  use, equip/unequip and destroy. Hoarding one of everything leaves no room
  for draughts, so something has to go.
- **Loot** — gold piles to spend, crimson draughts to heal (+30), blue
  draughts to restore mana (+30), slain foes drop coin.
- **The Crown** — reach floor 8, THE THRONE OF THE DEEP, and take it. The
  stairs descend further for those who want an endless high-score run; your
  deepest delve is remembered.

## Tech notes

- Pure canvas software rendering: DDA raycast walls, per-row textured
  floor/ceiling casting, z-buffered billboard sprites, distance fog quantized
  into DOS-style light bands, torch flicker.
- Wolf3D-style sliding doors rendered in the raycast core; shop windows are
  ordinary solid wall tiles, placed only on walls with a single exposed face
  so the window art is never seen from behind. Their lettering is pre-flipped
  in the texture, because the raycaster mirrors every wall face.
- Arrows and magic bolts are sub-stepped billboards, so a fast shot cannot
  tunnel through a wall or a rat.
- The surface adds three generic renderer features: a sky panorama sampled by
  view angle in place of a ceiling, per-cell ground textures so grass, sand,
  road and sea can meet, and tiles that block movement while letting the ray
  pass (trees and lamp posts are sprites; the sea is drawn at ground level).
  Ambient brightness and fog falloff are parameters, which is what lets night
  close in around you.
- Level 0 is a literal ASCII map in `js/game/overworld.js` — edit the art and
  you edit the world. It is validated at load, so a miscounted row fails loudly
  instead of quietly corrupting the map.
- All textures and sprites are generated procedurally at boot (no image
  assets); text uses a hand-built 5×7 bitmap font.
- All sound is synthesized live with WebAudio (no audio assets): sword, doors,
  pickups, monster voices, and a slow minor-key ambient drone.
- Mazes come from a recursive-backtracker with rooms carved on top for loops
  and combat spaces; key/lock placement is validated with BFS reachability.
- The code is split into an engine layer (`js/engine/`: raycaster, grid
  queries, input, synth — no game knowledge) and a game layer (`js/game/`:
  tiles, balance config, items, shops, art, sfx, dungeon, overworld, day/night,
  projectiles, actors, UI, menus, saves).

Built as a one-shot by Claude.
