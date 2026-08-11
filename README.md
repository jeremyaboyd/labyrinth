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

Append `?nosw=1` while editing: the service worker caches the shell hard,
which is right for a game you install and wrong for one you are changing.

Then visit `http://localhost:8123`.

## Controls

| Key | Touch pad | Action |
|---|---|---|
| `W` `A` `S` `D` | D-pad | Move / strafe |
| Mouse (click to capture) or `←` `→` | `<` `>` rocker | Turn |
| `Space` / left click | `B` | Attack with the equipped weapon |
| `E` | `A` | Take the stairs you stand on (pick a floor), open / unlock doors, trade at a shop window |
| `I` | `L1` | Open your pack (10 slots) |
| `Q` | `L2` | Quick items — drink without hunting through the pack |
| `J` | `Y` | Journal — your quests, and which one you are tracking |
| `Shift` | — | Run |
| `M` | `X` | Toggle map (fog of war) |
| `Tab` | `MENU` to pause, `B` to back out | Pause menu, and back out of any screen |
| `↑` `↓` to move, `Enter` / numpad `Enter` / `E` to confirm | D-pad and `A` | Navigate menus |

HELP, on both the title and pause menus, lists all of the above in game.
Sound, fog of war and an FPS readout are toggled from OPTIONS, on the same
two menus.

On a phone or tablet the game grows gamepad-style touch controls, laid out
like the pads this game is dressed after: an 8-way d-pad on the left walks,
`L1` and `L2` sit above it for your pack and quick items, a rocker on the
right turns, and A/B/X/Y are use/attack/map/journal — with B doubling as
BACK inside any menu, the way a gamepad's B does. A MENU pill above the
buttons pauses. All of it is multi-touch, so you can walk, turn and shoot at
once. Running has no button of its own. Append `?touch=1` to the URL to
force the controls on a desktop, or `?touch=0` to suppress them.

With the pads up, the game stops naming keys you do not have: every prompt,
hint and the HELP screen name the button instead — `A - DESCEND` rather than
`E - DESCEND`.

Hold the device whichever way you like. Portrait stacks the screen above the
pads; landscape sets the pads either side of it and gives the game a wider
view. It follows the device as you turn it, and the pads read the safe-area
insets both ways, so nothing hides under a notch or a home indicator.

## Install it

The game is a PWA: open it once and your browser will offer to add it to
your home screen, where it opens fullscreen with no browser chrome. Every
file is precached on install, so once it is there it plays with no network
at all — on a plane, on the underground, anywhere. Shipping a new version
bumps `VERSION` in `sw.js`, which is what evicts the old copy.

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

- **The surface (level 0)** — a fixed, hand-drawn world, 96 by 88 tiles,
  assembled from regions stamped into a canvas of mountain. Kingshore has its
  timber cottages, woods, a castle against the range, and a beach along the
  bay; the northern vale lies on the far side of the mountains with a second
  village of its own. Villagers wander both. It is the same world every run —
  only what lies below is rolled fresh.
- **Height** — the world stacks. The castle stands three storeys with a walk
  along the top, cottages have an upper floor, and the range that walls the
  world in is a five-tile cliff. Stone flights climb at 45 degrees, and
  anything that walks can take them: step up half a tile unaided, walk up a
  ramp, fall off what you walk off.
- **The Deepcut Mine** — the only road to the vale. A mouth in the range above
  Kingshore, one level of maze with its own monsters and loot, and a second
  mouth out the far side. It sits beside the descent rather than in it, so it
  never appears in the stairwell's list of floors: press `E` at either end and
  you cross.
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

## The level designer

Open `editor.html` next to the game and you get a DOS-flavored design tool
with three panels:

- **MAP** — paint the overworld the way it is stored: as glyphs on a grid.
  Draw and flood-fill terrain, define new glyphs (any character, bound to a
  wall tile standing on a ground texture), place the player start and the
  king, toggle villagers, and lay 45° ramp flights. Right-click picks the
  glyph under the cursor; the mouse wheel zooms and middle-drag pans.
  The WAYS DOWN panel places portals: any number of **dungeons** (each its
  own rogue-like descent with a floor count of your choosing) and any number
  of **mines** (place the entrance, then click where it comes out — two
  mouths, one maze between them). A portal can be SEALED, openable only by
  a key some quest awards.
- **QUESTS** — a villager, a place, a prize and a promise: the giver asks
  for a relic that lies at the bottom of a dungeon or deep in a mine, and
  pays in gold, an item, or the key to a sealed portal. Keys are how a
  world opens up one delve at a time: clear the small dungeon by the first
  village, be handed the way into the mine, come out at a second village
  with a quest of its own. The validator warns about sealed ways no quest
  can open, portals buried in solid rock, and quests pointing at nothing.
- **TILES** — reshape any wall tile, stock or new: its height in storeys,
  whether it is a door, glows, trades as a shop, or is really a tree/lamp
  prop. NEW WALL TILE and NEW GROUND TEXTURE mint fresh ids.
- **TEXTURES** — a 64×64 pixel editor over every texture in the game:
  pen, fill and eyedropper, the 16 EGA colors plus the texture's own most
  common tones, and a posterize toggle to keep new paint on the DOS palette.
  RESET returns a stock texture to its procedurally generated self.

Your work saves itself to the browser as you go. PLAY TEST opens the game
against the draft (`?draft=1`); EXPORT ZIP fetches every file of the game,
bakes the draft into `custom-data.js`, and downloads a complete package —
extract it onto any static host (or run `python -m http.server` inside it)
and it plays your world, editor included, so an exported game can be edited
again. REVERT ALL returns to the stock world.

Edits to stock tiles and textures reach the dungeons too; the map itself is
the surface world only — the floors below are always rolled from the seed.

## Tech notes

- Pure canvas software rendering. A cell holds a list of solid spans in z
  rather than one wall, each with a texture for its sides, top and underside,
  so a ceiling is just the underside of the slab above you. Columns march
  front to back into a list of unpainted screen spans, which keeps the cost
  near one write per pixel however deep the stack goes. Sloped ground needs no
  subdivision: a ray is linear in distance and a ramp is linear in world x or
  y, so the surface down one ray is `z = A + B*d` and inverting it for a
  screen row has a closed form — flat ground is the same path with `B = 0`.
  Depth is per pixel, because down one column the distance varies. Distance
  fog is quantized into DOS-style light bands.
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
  instead of quietly corrupting the map. The level designer speaks the same
  language: `buildOverworld` consumes a plain data object (rows, legend,
  ramps, markers), and `window.CUSTOM` — from `custom-data.js` or the
  editor's localStorage draft — simply supplies a different one. Edited
  textures travel as base64 of the raw 64×64 pixels and land on top of the
  procedural art at boot.
- The export is a ZIP written by hand in `js/editor/ezip.js` — stored
  entries, CRC-32 and a central directory are all a static host needs, and
  it keeps the zero-dependency rule intact.
- Below the surface the world is organized into **realms**: every portal is
  its own descent with its own seed, deepest-floor record and floor names.
  The castle labyrinth and the Deepcut mine are simply the stock world's two
  portals, on the same formulas as ever, so old saves regenerate the same
  floors — a v2 save standing in the old mine wakes up in the deepcut realm.
- All textures and sprites are generated procedurally at boot (no image
  assets); text uses a hand-built 5×7 bitmap font. The only images in the
  repo are the home-screen icons, which a browser cannot ask a canvas for.
- All sound is synthesized live with WebAudio (no audio assets): sword, doors,
  pickups, monster voices, and a slow minor-key ambient drone.
- Mazes come from a recursive-backtracker with rooms carved on top for loops
  and combat spaces; key/lock placement is validated with BFS reachability.
- The code is split into an engine layer (`js/engine/`: raycaster, grid
  queries, input, synth — no game knowledge) and a game layer (`js/game/`:
  tiles, balance config, items, shops, art, sfx, dungeon, overworld, day/night,
  projectiles, actors, UI, menus, saves).

Built as a one-shot by Claude.
