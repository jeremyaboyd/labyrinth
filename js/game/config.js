// ---- game/config: balance knobs, enemy stats, key bindings ----
'use strict';

const CROWN_FLOOR = 8;

const ENEMY_STATS = {
  rat:      { hp: 20, speed: 2.3,  dmg: 6,  range: 0.8,  cd: 0.9, hFrac: 0.42, drop: 0.2,  sight: 7,  sfx: 'ratSqueak',  glow: false, floats: false },
  skeleton: { hp: 45, speed: 1.45, dmg: 12, range: 0.95, cd: 1.2, hFrac: 0.74, drop: 0.35, sight: 9,  sfx: 'skelRattle', glow: false, floats: false },
  wraith:   { hp: 60, speed: 1.9,  dmg: 16, range: 0.95, cd: 1.1, hFrac: 0.8,  drop: 0.5,  sight: 12, sfx: 'wraithMoan', glow: true,  floats: true },
};

// per-floor difficulty curves used by the dungeon generator
const BALANCE = {
  mapSize: f => Math.min(21 + f * 2, 37),
  rooms: f => 3 + Math.floor(f / 2),
  rats: f => 2 + Math.min(f, 6),
  skeletons: f => 1 + Math.floor(f * 0.9),
  wraiths: f => (f >= 3 ? Math.min(f - 2, 5) : 0),
  potions: f => 2 + Math.floor(f / 2),
  goldPiles: f => 4 + f,
  doorMax: f => 4 + Math.floor(f / 2),
};

// movement bindings (held keys); discrete actions are mapped in main.js
const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  strafeL: ['KeyA'],
  strafeR: ['KeyD'],
  turnL: ['ArrowLeft'],
  turnR: ['ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};
