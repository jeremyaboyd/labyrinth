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

// ---------- standing on things ----------
// A body can step up this far without a ramp, and needs this much room over
// its feet to fit. Anything solid between the two is a wall to it.
const STEP_UP = 0.51;
const BODY_H = 0.9;

// The walkable height of a slab's top at a world point: flat ground gives its
// own height back, a ramp gives the point on the slope.
function slabTop(sl, cx, cy, wx, wy) {
  if (!sl.ramp) return sl.z1;
  const k = sl.rampHi - sl.z1;
  let t;
  if (sl.ramp === 1) t = wx - cx;
  else if (sl.ramp === 2) t = cx + 1 - wx;
  else if (sl.ramp === 3) t = wy - cy;
  else t = cy + 1 - wy;
  return sl.z1 + (t < 0 ? 0 : t > 1 ? 1 : t) * k;
}

// Highest surface at (x,y) that a body with its feet at z could be standing
// on, reaching up by STEP_UP. Null where there is nothing to stand on.
function groundUnder(lvl, x, y, z) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return null;
  const cell = lvl.slabs && lvl.slabs[cy * lvl.w + cx];
  if (!cell) return null;
  const reach = z + STEP_UP;
  let best = null;
  for (let i = 0; i < cell.length; i++) {
    const sl = cell[i];
    if (sl.door) continue;                 // you never stand on a door
    const top = slabTop(sl, cx, cy, x, y);
    if (top <= reach && (best === null || top > best)) best = top;
  }
  return best;
}

// Would a body of radius r with its feet at z overlap anything at (x,y)? Only
// what sits between its shins and its head counts: lower is a step up, higher
// is headroom it walks under.
function walkBlocked(lvl, x, y, z, r) {
  if (!lvl.slabs) return circleBlocked(lvl, x, y, r);
  const lo = z + STEP_UP, hi = z + BODY_H;
  const cx0 = Math.floor(x - r), cx1 = Math.floor(x + r);
  const cy0 = Math.floor(y - r), cy1 = Math.floor(y + r);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return true;
      // the point of this cell the body is closest to, for both the circle
      // test and for reading a ramp at the right place
      const nx = x < cx ? cx : (x > cx + 1 ? cx + 1 : x);
      const ny = y < cy ? cy : (y > cy + 1 ? cy + 1 : y);
      const ddx = x - nx, ddy = y - ny;
      if (ddx * ddx + ddy * ddy >= r * r) continue;

      // a thin prop only blocks around its post, however tall the cell is
      const c = lvl.map[cy * lvl.w + cx];
      const def = c ? lvl.tiles[c] : null;
      if (def && def.radius) {
        const px = x - (cx + 0.5), py = y - (cy + 0.5), rr = def.radius + r;
        if (px * px + py * py < rr * rr) return true;
        continue;
      }

      const cell = lvl.slabs[cy * lvl.w + cx];
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const sl = cell[i];
        if (sl.door) {
          const d = lvl.doors[cy * lvl.w + cx];
          if (d && d.open > 0.75) continue;  // slid far enough to walk through
          return true;
        }
        const top = slabTop(sl, cx, cy, nx, ny);
        if (sl.z0 < hi && top > lo) return true;
      }
    }
  }
  return false;
}

// axis-separated slide movement for a circle of radius r
function tryMove(lvl, e, dx, dy, r) {
  const z = e.z || 0;
  if (dx !== 0 && !walkBlocked(lvl, e.x + dx, e.y, z, r)) e.x += dx;
  if (dy !== 0 && !walkBlocked(lvl, e.x, e.y + dy, z, r)) e.y += dy;
}

// Follow the ground: step up onto what you walked into, fall off what you
// walked off. Everything that moves through the world runs through this, so a
// villager takes a ramp the same way the player does.
function settleZ(lvl, e, dt) {
  if (!lvl.slabs) { e.z = 0; return; }
  const g = groundUnder(lvl, e.x, e.y, e.z || 0);
  if (g === null) return;                    // nothing underfoot: hold station
  if (e.z == null) e.z = g;
  if (e.z <= g + 1e-6) {                     // on it, or stepping up onto it
    e.z = g;
    e.vz = 0;
  } else {
    e.vz = (e.vz || 0) - 14 * dt;            // in the air
    e.z += e.vz * dt;
    if (e.z < g) { e.z = g; e.vz = 0; }
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
