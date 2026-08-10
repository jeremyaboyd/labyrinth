// ---- game/tiles: tile vocabulary of the labyrinth ----
// Tile id doubles as the texture key the renderer looks up.
'use strict';

const T_STONE = 1;
const T_MOSS = 2;
const T_RUNE = 3;
const T_BANNER = 4;
const T_SKULL = 5;
const T_DOOR = 8;
const T_DOOR_LOCKED = 9;
// shop windows: solid walls the player can trade through
const T_SHOP_POTION = 10;
const T_SHOP_WEAPON = 11;
const T_SHOP_ARMOR = 12;
// surface world (level 0)
const T_MOUNTAIN = 20;
const T_HOUSE = 21;
const T_WINDOW = 22;   // swapped between lit and dark art of an evening
const T_HDOOR = 23;
const T_CASTLE = 24;
const T_TREE = 25;     // blocks movement, drawn as a billboard
const T_LAMP = 26;     // ditto: a lamp post
const T_WATER = 27;    // blocks movement, but the ray sees the sea floor
// non-map texture keys
const T_FLOOR = 100;
const T_CEIL = 101;
const T_GRASS = 102;
const T_SAND = 103;
const T_SEA = 104;
const T_ROAD = 105;
const T_COURT = 106;

const SHOP_TILE = { potion: T_SHOP_POTION, weapon: T_SHOP_WEAPON, armor: T_SHOP_ARMOR };

// behavior flags consumed by engine/grid and engine/raycaster
const TILE_DEFS = {
  [T_STONE]: {},
  [T_MOSS]: {},
  [T_RUNE]: {},
  [T_BANNER]: {},
  [T_SKULL]: {},
  [T_DOOR]: { door: true },
  [T_DOOR_LOCKED]: { door: true },
  [T_SHOP_POTION]: { shop: 'potion' },
  [T_SHOP_WEAPON]: { shop: 'weapon' },
  [T_SHOP_ARMOR]: { shop: 'armor' },
  [T_MOUNTAIN]: {},
  [T_HOUSE]: {},
  [T_WINDOW]: { glow: false }, // the clock turns this on and off
  [T_HDOOR]: {},
  [T_CASTLE]: {},
  [T_TREE]: { noWall: true, prop: 'tree' },
  [T_LAMP]: { noWall: true, prop: 'lamp' },
  [T_WATER]: { noWall: true },
};

function shopKindAt(cell) {
  const def = TILE_DEFS[cell];
  return def && def.shop ? def.shop : null;
}
