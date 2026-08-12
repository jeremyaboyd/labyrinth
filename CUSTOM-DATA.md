# custom-data.js — the world file format

`custom-data.js` is the whole of a custom game: one JavaScript file assigning
one plain object to `window.CUSTOM`. The level designer (`editor.html`) writes
it for you on EXPORT ZIP, but it is ordinary data and nothing stops you writing
it by hand or generating it — `tools/make-custom-game.js` is a Node script that
builds the shipped world (THE SUNDERED SHORE) exactly this way, validation and
all, and the `custom-data.js` at the repo root is its output. Both are worked
examples of everything below.

```js
window.CUSTOM = null;   // stock Kingshore
```

```js
window.CUSTOM = {       // a custom world
  version: 2,
  world: { /* the surface, and everything hung on it */ },
  tiles: { /* wall tile definitions, by id */ },
  textures: { /* edited pixels, by id, as base64 */ },
};
```

## How it loads

`js/game/custom.js` picks the data at boot, in this order:

1. With `?draft=1` on the URL: the editor's working draft, from localStorage
   key `labyrinth.custom.draft`. This is what PLAY TEST opens. The draft is
   **the same object** — the editor persists exactly the shape documented here.
2. Otherwise `window.CUSTOM` from `custom-data.js`.
3. If that is `null` (or the file is absent), the stock Kingshore.

Every section is optional and independent: `tiles` and `textures` apply even
when `world` is absent (reskinning the stock world), and they reach the
dungeons below as well as the surface. `version` is written as `2` by the
editor and is currently informational — the loader does not check it.

A note on trust: the file is executed as script, so treat a `custom-data.js`
from somebody else the way you would treat any JavaScript from somebody else.
The editor's own exports contain only the data literal.

## The shape at a glance

```js
window.CUSTOM = {
  version: 2,
  world: {
    name: 'THE SUNDERED SHORE',        // named in dialogue and errands
    rows: [ 'MMMMM~~', 'M...t~~', /* ... every row the same width ... */ ],
    legend: { 'M': [20, 102], '~': [27, 104], '.': [0, 102], /* ... */ },
    ramps: [ { x: 60, y: 42, dir: 2, len: 3 } ],
    start: { x: 22, y: 88, a: -1.5708 },
    king: [27, 36],                    // or null: no king in this world
    villagers: [ [24, 47], [31, 44], /* index here = quest giver id */ ],
    portals: [ /* dungeons, mines, boats -- the ways off the surface */ ],
    quests: [ /* what the king and the villagers ask of the player */ ],
  },
  tiles: {
    '30': { name: 'PALISADE', h: 2 },  // a custom two-storey wall
  },
  textures: {
    '30': 'AAAA...base64...==',        // its 64x64 art
  },
};
```

## world

### name

Uppercase string. It is how the land refers to itself: errands say a keepsake
is `SOMEWHERE ABOUT THE SUNDERED SHORE`, and the map screen titles the surface
with it.

### rows and legend

The surface is a literal ASCII map: `rows` is an array of strings, one per map
row, **every row the same length** — a miscounted row throws at load rather
than corrupt the world. Each character is looked up in `legend`:

```js
legend: {
  //        [ wall tile id, ground texture id ]
  'M': [20, 102],   // mountain standing on grass
  '~': [27, 104],   // water over the sea floor
  's': [0,  103],   // no wall, sand underfoot
  '.': [0,  102],   // no wall, grass
  't': [25, 102],   // a tree (a prop tile) on grass
  'r': [0,  105],   // road
  'H': [21, 102],   // cottage wall
  'W': [22, 102],   // cottage window (lights up of an evening)
  'D': [23, 102],   // cottage door
  'C': [24, 106],   // castle wall on courtyard stone
  'y': [0,  106],   // open courtyard
  'L': [26, 102],   // lamp post
}
```

Each entry is `[wallTileId, groundTextureId]`. Wall tile `0` means open
ground. A glyph the legend does not define throws at load, glyph by glyph, so
a typo names its own coordinates.

Any character can be a glyph. Three have historical meaning — `X`, `m`, `n`
mark the stock world's castle descent and the two mouths of the Deepcut mine —
but they are only consulted for a portal whose `x` is `null` (the stock
definition leaves placement to the art). A custom world writes portal
coordinates out explicitly, and then `X`/`m`/`n` are ordinary glyphs like any
other.

### ramps

The world stacks (see `tiles.h` below), and ramps are the only way to walk up
it. Each entry lays one straight flight:

```js
ramps: [
  { x: 60, y: 42, dir: 2, len: 3 },   // three tiles, climbing west
]
```

- `x, y` — where the low end sits (an open-ground cell).
- `dir` — which way it climbs: `1` east, `2` west, `3` south, `4` north.
- `len` — how many tiles it runs. Each tile rises one, at 45 degrees, so a
  flight of three carries you up three storeys.
- `z0` — optional: the height the low end starts at, for a flight that begins
  partway up something. Omitted, it starts at the ground.

A body can also step up half a tile unaided, and falls off whatever it walks
off — villagers and monsters obey the same rules.

**Multi-storey buildings** are the pairing of tall tiles and ramps: paint a
`h: 3` castle wall (its top face renders, so you can look down on
battlements), leave a walkway of open cells behind the parapet, and run a
`len: 3` flight up to it. The stock courtyard's rampart stair is exactly this.

### start

```js
start: { x: 22, y: 88, a: -1.5708 }
```

Tile coordinates of an open cell, and the facing angle in radians: `0` looks
east (+x), and the y axis points south, so `-Math.PI / 2` (≈ `-1.5708`) looks
north. This is where a NEW GAME begins.

### king

`[x, y]` on open ground, or `null` for a world with no king. He stands where
he is put (he does not pace), TALK/TRADE menus do not apply to him — `E` is
his audience directly. Make him a quest giver with `giver: 'king'` (below);
a custom-world king with no quest left to give greets the player and no more.
In the stock world he runs the crown story.

### villagers

```js
villagers: [
  [24, 47],   // villager 0
  [31, 44],   // villager 1  <- giver: 1 in a quest means this one
  /* ... */
]
```

An array of `[x, y]` spots on open ground. **The array index is the
villager's identity**: it is what a quest's `giver` field names, so reordering
this array re-addresses every quest. Villagers wander a little from where
they are placed. Their names cycle through a fixed set (MARA, TOMM, ELSBETH,
BRAN, HILDA, OSRIC, WENNA) and villagers without a designer quest make small
talk and occasionally offer fetch errands, exactly as in the stock world.
A villager who *does* have a designer quest speaks of nothing else until it
is finished.

### portals

Portals are the ways off the surface. Every portal is its own **realm**: a
descent with its own seed (floors regenerate deterministically), its own
deepest-floor record, its own floor names.

```js
portals: [
  { id: 'oldkeep',  kind: 'dungeon', name: 'THE OLD KEEP', floors: 2, x: 36, y: 28 },
  { id: 'hollow',   kind: 'mine',    name: 'THE HOLLOW MINE', x: 22, y: 73, exit: { x: 27, y: 45 } },
  { id: 'ferry',    kind: 'boat',    name: 'THE FERRY', x: 46, y: 38, exit: { x: 56, y: 46 }, locked: true },
  { id: 'vault',    kind: 'dungeon', name: 'THE SEALED VAULT', floors: 3, x: 95, y: 43,
    locked: true, prize: 'northmine' },
  { id: 'storeroom', kind: 'dungeon', name: 'THE STOREROOM', floors: 1, x: 95, y: 6,
    enemies: { rat: 12, skeleton: 0, wraith: 0 } },
]
```

Fields common to all kinds:

- `id` — unique string; quests and prizes refer to portals by it.
- `name` — uppercase; used in messages, the stairwell, quest text.
- `x, y` — the entrance, on open ground. A portal whose `x` is `null` and is
  not one of the stock ids (`castle`, `deepcut`, which resolve from the
  `X`/`m`/`n` glyphs) is dropped at load.
- `locked` — optional. A sealed portal refuses entry (`SEALED. SOMEONE HOLDS
  THE KEY.` — or, for a boat, `YOU HAVE NO PASSAGE. SOMEONE MUST BOOK IT.`)
  until the player is granted its key by a quest `reward.key` or another
  realm's `prize`. Keys are how a world opens up one delve at a time.

Per kind:

- **`kind: 'dungeon'`** — a rogue-like descent below the entrance.
  - `floors` — how deep it goes; `0` means endless. A finite dungeon's
    deepest floor is where its prize and its quests' relics lie; an endless
    one has no such floor, so give it neither.
- **`kind: 'mine'`** — one maze level with a mouth at each end.
  - `exit: { x, y }` — the far mouth, required (a mine without one is dropped
    at load). Press `E` at either mouth to enter; the maze's walls become
    packed earth shored with timber. Its single level is its prize floor.
    Both mouths get a timber frame and a rock lintel automatically.
- **`kind: 'boat'`** — surface-to-surface passage across water.
  - `exit: { x, y }` — the far dock, required. `E` at either dock sails you
    to the other; a skiff is drawn tied up at both. Boats have no floors, no
    monsters, no prize — but they can be `locked`, and a quest whose
    `reward.key` names the boat is how passage gets booked.

Optional fields for dungeons and mines:

- `enemies` — dictate the realm's population instead of the difficulty
  curves: `{ rat: 12, skeleton: 0, wraith: 0, witch: 0 }`. Counts are per
  floor; a key left out falls back to the usual curve for that depth, so
  spell out every key you mean to control. This is how a storeroom holds
  nothing but rats, or a cave nothing but skeletons. (The witch spawns
  **only** from this or from a slay quest — the curves never roll her.)
- `prize` — another portal's id. The key to that portal is laid on this
  realm's prize floor (a mine's single level, a finite dungeon's deepest
  floor), waiting to be carried out: `YOU FOUND THE KEY TO <name>`. A chain
  of prizes and quest keys is the backbone of a designed world.

One id is special: a portal with `id: 'castle'` inherits the stock story —
the crown lies on floor 8 of it, and villagers' fetch errands may point into
it. A custom world that keeps no `castle` portal keeps every errand on the
surface, and no crown quest exists unless you write your own quests.

### quests

What the king and the villagers ask. Each entry becomes a journal quest with
its own marker, dialogue and reward:

```js
quests: [
  { id: 'crown', kind: 'relic', name: 'THE TRUE CROWN',
    thing: 'THE TRUE CROWN', giver: 'king', portal: 'oldkeep',
    reward: { key: 'ferry' },
    lines: {
      offer:  ['THIS CROWN OF MINE IS A FACSIMILE.',
               'THE TRUE ONE LIES BELOW THE OLD KEEP.',
               'BRING IT BACK AND I WILL BOOK YOUR PASSAGE.'],
      remind: ['THE KEEP, DELVER. TWO FLOORS DOWN.'],
      done:   ['THE TRUE CROWN! PASSAGE IS BOOKED.'],
    } },
  { id: 'witch', kind: 'slay', name: 'THE WITCH OF THE WEST WOOD',
    thing: 'HER CHARM', giver: 5, portal: 'westwood',
    reward: { key: 'vault' } },
  { id: 'rats', kind: 'exterminate', name: 'THE STOREROOM RATS',
    thing: 'THE RATS', giver: 15, portal: 'storeroom',
    reward: { gold: 300 } },
]
```

- `id` — unique string (the editor allocates `q1`, `q2`, ...; any string
  works). At runtime the quest is known as `dq_` + id.
- `kind` — one of:
  - **`relic`** (the default) — `thing` lies on the portal realm's prize
    floor, at its far point; pick it up, carry it home.
  - **`slay`** — a boss carries `thing` instead. She spawns at the same spot,
    **warded by her own minions**: while any skeleton stands on the floor,
    blades and bolts glance off her. Pair the portal with
    `enemies: { skeleton: N, ... }` so there is a ward to break. She drops
    the relic where she falls.
  - **`exterminate`** — no relic at all: kill everything alive down there.
    The quest fulfils the moment a kill leaves the floor you stand on empty,
    so give it a single-floor realm (`floors: 1`, or a mine) — that floor
    *is* the infestation. Then carry the news home.
- `name` — the journal title. Defaults to `thing`. Uppercased either way.
- `thing` — what is wanted, phrased as a noun (`THE TRUE CROWN`,
  `HER CHARM`). Defaults to `THE LOST RELIC`. Woven into hints, journal
  steps and stock dialogue.
- `giver` — a villager's index in `world.villagers`, or the string `'king'`
  (which requires `world.king`).
- `portal` — the realm's portal id. Boats cannot be quest targets (the editor
  warns); a relic or slay quest needs a realm with a prize floor, so an
  endless dungeon (`floors: 0`) cannot host one either.
- `boss` — slay only; which enemy carries the thing. Defaults to `'witch'`,
  which is also the only boss in the bestiary today.
- `reward` — any mix of:
  - `gold: 300` — paid on the spot.
  - `item: 'swordSteel'` — an item id from the table below. If the pack is
    full it waits on the ground at your feet.
  - `key: 'vault'` — a portal id; its seal opens (`THE WAY INTO <name> IS
    OPEN`). Pointing it at a locked boat is how passage gets booked.
  - An empty reward pays `MY THANKS`.
- `lines` — optional; the giver's own words in place of the stock ones. Three
  arrays, each one dialogue-box line per string: `offer` (first meeting),
  `remind` (quest underway), `done` (the handover). Leave any of the three
  out (or empty) to keep its stock speech. See **Text rules** below for what
  the font can draw and how long a line can be.

A quest missing `id`, `giver` or `portal` is silently skipped. Quests are
rebuilt from the world definition every time the surface loads; only the
player's progress lives in a save, so editing quest text mid-run is safe.

## tiles

Wall tile definitions, keyed by tile id (as strings — it is JSON). Use it to
**mint new tiles** (ids 30–99; the editor allocates from there) or to
**reshape stock ones**. An entry always carries its full truth — it replaces
the stock definition rather than patching it:

```js
tiles: {
  '30': { name: 'PALISADE', h: 2 },                  // two-storey custom wall
  '31': { name: 'CRYPT DOOR', h: 1, door: true },    // slides open on E
  '32': { name: 'CANDLE SHRINE', h: 1, glow: true }, // ignores distance fog
  '33': { name: 'APOTHECARY', h: 1, shop: 'potion' },// trade through it with E
  '34': { name: 'OLD OAK', h: 1, prop: 'tree', radius: 0.18 },
}
```

- `name` — what the editor calls it. The game ignores it.
- `h` — height in storeys (default 1). Anything over 1 stands that tall on
  the surface and shows a top face, so you can look down on it from above —
  this plus a ramp is a building you can climb. Underground every wall runs
  floor to ceiling regardless.
- `door: true` — a sliding door. `E` opens it.
- `glow: true` — the texture ignores distance fog and darkness, for things
  that shine.
- `shop: 'potion' | 'weapon' | 'armor'` — a shop window: a solid wall the
  player trades through with `E`. Place it on a wall face like the stock
  dungeon shops.
- `prop: 'tree' | 'lamp'` — not a wall at all but a billboard sprite; the ray
  sees straight through the tile to the ground behind it and only a post of
  `radius` (default `0.18`; the stock lamp uses `0.12`) at the cell's centre
  blocks movement. `radius` applies only with `prop`.
- `noWall: true` *without* `prop` — the ray reads through the tile to its
  ground texture, and nothing blocks movement unless `block` says otherwise.
- `block: true` — stops your feet without stopping the ray. Paired with
  `noWall` it is exactly the stock water tile: ground that reads as open sea
  but cannot be walked into. Mint your own for lava, chasms, marsh.

An entry that **omits** `noWall` and `block` keeps whatever the tile already
had — the editor's TILES panel has no switch for either, so renaming WATER
(27) there does not drain the sea. Write them explicitly (including
`block: false`) only when you mean to change them.

Custom wall ids need art: give every minted id a matching entry in
`textures`, or there is nothing to draw. (The editor does this for you —
NEW WALL TILE clones stone's pixels as a starting point.)

Ground/texture ids live at 100+ (custom grounds 111–199). They take no
`tiles` entry — a ground is only pixels — just a `textures` entry, and then a
legend entry can stand ground `0` on it.

### Stock tile ids

| id | wall | | id | ground/other |
|---|---|---|---|---|
| 1 | STONE | | 100 | DUNGEON FLOOR |
| 2 | MOSSY STONE | | 101 | DUNGEON CEILING |
| 3 | RUNE WALL | | 102 | GRASS |
| 4 | BANNER | | 103 | SAND |
| 5 | SKULL WALL | | 104 | SEA |
| 8 | DOOR | | 105 | ROAD |
| 9 | LOCKED DOOR | | 106 | COURTYARD |
| 10 | POTION SHOP | | 107 | MINE FLOOR |
| 11 | WEAPON SHOP | | 108 | PLANK CEILING |
| 12 | ARMOR SHOP | | 109 | HOLE DOWN |
| 20 | MOUNTAIN (h 5) | | 110 | HOLE UP |
| 21 | HOUSE (h 2) | | | |
| 22 | WINDOW (h 2) | | | |
| 23 | HOUSE DOOR (h 2) | | | |
| 24 | CASTLE (h 3) | | | |
| 25 | TREE (prop) | | | |
| 26 | LAMP POST (prop) | | | |
| 27 | WATER (noWall + block) | | | |
| 28 | DIRT WALL | | | |
| 29 | MINE SUPPORT | | | |

## textures

Edited pixels, keyed by texture id (tile id and texture id are the same
number). Each value is base64 of the raw pixels: **64 × 64, row-major from
the top-left, 4 bytes per pixel in R, G, B, A order** — 16,384 bytes, which
is what a little-endian `Uint32Array` reads as `0xAABBGGRR`. A value of the
wrong length is silently ignored.

```js
// building one by hand (Node or browser):
const px = new Uint8Array(64 * 64 * 4);
for (let i = 0; i < 64 * 64; i++) {
  px[i * 4 + 0] = 40;    // R
  px[i * 4 + 1] = 90;    // G
  px[i * 4 + 2] = 40;    // B
  px[i * 4 + 3] = 255;   // A (keep it 255: the renderer does not blend walls)
}
const b64 = btoa(String.fromCharCode(...px));   // -> textures: { '30': b64 }
```

All stock art is generated procedurally at boot; these entries land **on top
of it**, so a world only ships the textures it actually changed. Edits apply
everywhere the id appears, dungeons included. Two stock textures are
live-swapped by the clock and go still when edited: the SEA (104) stops
animating, and the WINDOW (22) stops trading its lit and dark art at dusk
and dawn.

## Text rules

Every string the player reads — world and portal and quest names, `thing`,
custom `lines` — is drawn in the game's 5×7 bitmap font. It carries only:

```
A-Z 0-9 space . , : ! ? - + / ' ( ) " > <
```

Text is uppercased when drawn, so write in either case; any character outside
the set renders as a blank gap. The dialogue box does not wrap: one array
entry is one line, and about **44 characters** is the width of the box — keep
lines to 42 or fewer and they will never crowd the border.

## Item ids (for `reward.item`)

| id | | id | |
|---|---|---|---|
| `swordBronze` | BRONZE SWORD | `armorLeather` | LEATHER MAIL |
| `swordIron` | IRON SWORD | `armorIron` | IRON MAIL |
| `swordSteel` | STEEL SWORD | `armorSteel` | STEEL PLATE |
| `bow` | HUNTING BOW | `potionRed` | CRIMSON DRAUGHT |
| `staff` | ARCANE STAFF | `potionBlue` | BLUE DRAUGHT |
| `arrowBronze` | BRONZE ARROW | `tonicHp` | VITALITY TONIC |
| `arrowIron` | IRON ARROW | `tonicMp` | ARCANE TONIC |
| `arrowSteel` | STEEL ARROW | | |

## Enemy ids (for `portals[].enemies`)

- `rat` — fast, weak, everywhere early.
- `skeleton` — steady, armed; also the witch's ward.
- `wraith` — fast and vicious, glowing eyes, the deep floors' terror.
- `witch` — the boss: ranged hex bolts, warded while skeletons stand. Never
  rolled by the difficulty curves; she appears only where `enemies` names her
  or a slay quest spawns her.

## Pitfalls the loader will and will not catch

Caught loudly at load:
- Rows of unequal width.
- A glyph missing from the legend.

Handled silently — check your work:
- A portal with `x: null` (other than stock `castle`/`deepcut`), or a mine or
  boat without `exit`, is dropped; quests pointing at it dangle.
- A quest missing `id`, `giver` or `portal` is skipped.
- A texture of the wrong byte length is ignored.
- A `locked` portal no quest key and no prize ever opens is sealed forever.
- A `prize` or a relic/slay quest on an endless dungeon (`floors: 0`) never
  lays — there is no deepest floor to lay it on.
- Nothing verifies markers stand on open ground or that story legs are
  reachable. The editor's validator warns about most of these
  (`editor.html`, bottom of the MAP panel), and `tools/make-custom-game.js`
  shows how to BFS-check reachability in a generator.
