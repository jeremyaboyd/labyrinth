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
// non-map texture keys
const T_FLOOR = 100;
const T_CEIL = 101;

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
};

function shopKindAt(cell) {
  const def = TILE_DEFS[cell];
  return def && def.shop ? def.shop : null;
}
