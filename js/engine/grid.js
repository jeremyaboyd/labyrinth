// ---- engine/grid: world queries on a tile grid level ----
// A level is { w, h, map: Uint8Array, doors: {idx: {open,locked,...}}, tiles: {id: {door?}} }.
// Cell value 0 is empty; any other value is solid unless its tile def marks
// it as a door, in which case doors[idx].open decides passability.
'use strict';

const ADJ = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function cellAt(lvl, x, y) {
  const cx = x | 0, cy = y | 0;
  if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return -1; // out of bounds
  return lvl.map[cy * lvl.w + cx];
}

function solidAt(lvl, x, y) {
  const c = cellAt(lvl, x, y);
  if (c === 0) return false;
  if (c === -1) return true;
  const def = lvl.tiles[c];
  if (def && def.door) {
    const d = lvl.doors[(y | 0) * lvl.w + (x | 0)];
    return !(d && d.open > 0.75);
  }
  return true;
}

// axis-separated slide movement for a circle of radius r
function tryMove(lvl, e, dx, dy, r) {
  if (dx !== 0) {
    const nx = e.x + dx;
    const sx = dx > 0 ? nx + r : nx - r;
    if (!solidAt(lvl, sx, e.y - r) && !solidAt(lvl, sx, e.y + r)) e.x = nx;
  }
  if (dy !== 0) {
    const ny = e.y + dy;
    const sy = dy > 0 ? ny + r : ny - r;
    if (!solidAt(lvl, e.x - r, sy) && !solidAt(lvl, e.x + r, sy)) e.y = ny;
  }
}

function lineOfSight(lvl, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solidAt(lvl, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}
