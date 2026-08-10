// ---- engine/grid: world queries on a tile grid level ----
// A level is { w, h, map: Uint8Array, doors: {idx: {open,locked,...}}, tiles: {id: {...}} }.
// Cell value 0 is empty; any other value fills its whole tile, unless its def
// says otherwise:
//   door       => doors[idx].open decides passability
//   radius: n  => only a post of radius n at the cell centre is solid, so
//                 thin things like tree trunks and lamp posts can be walked past
'use strict';

const ADJ = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function cellAt(lvl, x, y) {
  const cx = x | 0, cy = y | 0;
  if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return -1; // out of bounds
  return lvl.map[cy * lvl.w + cx];
}

// point test: used for sight lines and for anything small like an arrow
function solidAt(lvl, x, y) {
  const c = cellAt(lvl, x, y);
  if (c === 0) return false;
  if (c === -1) return true;
  const def = lvl.tiles[c];
  if (def) {
    if (def.door) {
      const d = lvl.doors[Math.floor(y) * lvl.w + Math.floor(x)];
      return !(d && d.open > 0.75);
    }
    if (def.radius) {
      const dx = x - (Math.floor(x) + 0.5), dy = y - (Math.floor(y) + 0.5);
      return dx * dx + dy * dy <= def.radius * def.radius;
    }
  }
  return true;
}

// Would a body of radius r standing at (x,y) overlap anything solid? Tests the
// whole circle rather than a couple of sample points, so a narrow post cannot
// slip between the samples and be walked straight through.
function circleBlocked(lvl, x, y, r) {
  const cx0 = Math.floor(x - r), cx1 = Math.floor(x + r);
  const cy0 = Math.floor(y - r), cy1 = Math.floor(y + r);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return true;
      const c = lvl.map[cy * lvl.w + cx];
      if (c === 0) continue;
      const def = lvl.tiles[c];
      if (def && def.door) {
        const d = lvl.doors[cy * lvl.w + cx];
        if (d && d.open > 0.75) continue;
        return true; // a shut door fills its tile
      }
      if (def && def.radius) {
        const dx = x - (cx + 0.5), dy = y - (cy + 0.5), rr = def.radius + r;
        if (dx * dx + dy * dy < rr * rr) return true;
        continue;
      }
      // solid tile: nearest point on the cell box against the body circle
      const nx = x < cx ? cx : (x > cx + 1 ? cx + 1 : x);
      const ny = y < cy ? cy : (y > cy + 1 ? cy + 1 : y);
      const dx = x - nx, dy = y - ny;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// axis-separated slide movement for a circle of radius r
function tryMove(lvl, e, dx, dy, r) {
  if (dx !== 0 && !circleBlocked(lvl, e.x + dx, e.y, r)) e.x += dx;
  if (dy !== 0 && !circleBlocked(lvl, e.x, e.y + dy, r)) e.y += dy;
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
