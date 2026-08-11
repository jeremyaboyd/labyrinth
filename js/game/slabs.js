// ---- game/slabs: turning a tile map into the stacks the renderer draws ----
// The grid still decides what is where; this decides how tall it is and what
// its top and underside look like. One cell holds a list of solid spans in z,
// sorted and never overlapping, so a cell can be ground with a room over it,
// or a cliff with a walkway cut through, and not just "wall" or "not wall".
//
// Heights are in tiles, and the eye sits at 0.5, which is why a plain wall
// running 0..1 fills the view exactly as it always has.
'use strict';

const Z_GROUND = 0;   // what you walk on at the bottom of the world
const Z_CEIL = 1;     // underside of a dungeon ceiling
const Z_DEEP = -8;    // far enough below that no face ever ends on screen
const Z_HIGH = 8;     // ditto above

// How tall each solid tile stands, in tiles. Anything unlisted is one tall,
// which is what every wall in the game was before there was a choice. Only
// the surface uses these: underground a wall runs to the ceiling regardless.
const TILE_H = {
  [T_MOUNTAIN]: 5,   // the range walls the world in, and now looks like it
  [T_CASTLE]: 3,     // three storeys, with a walk along the top
  [T_HOUSE]: 2,      // cottages with an upper floor
  [T_WINDOW]: 2,
  [T_HDOOR]: 2,
};

function tileHeight(id) {
  const h = TILE_H[id];
  return h != null ? h : 1;
}

// A ramp rises one tile across one tile of ground -- 45 degrees -- and is the
// only thing you can walk up to reach the level above. Direction is which way
// it climbs; a level supplies them per cell in rampMap, with the height of the
// low edge in rampLo.
const RAMP_DIR = { E: 1, W: 2, S: 3, N: 4 };
const RAMP_STEP = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]; // by direction

// Turn a sparse list of flights into per-cell ramp data. Each flight names
// where it starts, which way it climbs and how many tiles long it is; the
// low edge of each step is one higher than the last, so a flight of three
// carries you up three.
function layRamps(lvl, flights, baseZ) {
  const ramp = new Uint8Array(lvl.w * lvl.h);
  const lo = new Float32Array(lvl.w * lvl.h);
  for (const f of flights) {
    const [sx, sy] = RAMP_STEP[f.dir];
    for (let k = 0; k < f.len; k++) {
      const x = f.x + sx * k, y = f.y + sy * k;
      if (x < 0 || y < 0 || x >= lvl.w || y >= lvl.h) continue;
      const i = y * lvl.w + x;
      ramp[i] = f.dir;
      lo[i] = (f.z0 != null ? f.z0 : baseZ || 0) + k;
    }
  }
  lvl.rampMap = ramp;
  lvl.rampLo = lo;
}

// A cell you can stand in: ground underfoot, and a ceiling overhead if this
// level has one. Outdoors there is no ceiling slab, which is what lets the sky
// show through.
function openCell(floorTex, ceilTex) {
  const out = [{ z0: Z_DEEP, z1: Z_GROUND, side: 0, top: floorTex, bot: 0 }];
  if (ceilTex) out.push({ z0: Z_CEIL, z1: Z_HIGH, side: 0, top: 0, bot: ceilTex });
  return out;
}

// Build every cell's stack for a level. Called once when the floor is built,
// and again by anything that reshapes the map afterwards.
function buildSlabs(lvl, opts) {
  const floorTex = opts.floorTex, ceilTex = opts.ceilTex || 0;
  const floorMap = lvl.floorMap || null;
  const slabs = new Array(lvl.w * lvl.h);

  for (let y = 0; y < lvl.h; y++) {
    for (let x = 0; x < lvl.w; x++) {
      const i = y * lvl.w + x;
      const c = lvl.map[i];
      const ground = (floorMap && floorMap[i]) || floorTex;
      const def = c ? lvl.tiles[c] : null;

      // a ramp: ground that climbs, so the level above is reachable on foot.
      // The map cell stays open, because a ramp is floor and not wall.
      const rdir = lvl.rampMap && lvl.rampMap[i];
      if (rdir) {
        const zlo = lvl.rampLo ? lvl.rampLo[i] : 0;
        const cell = [{
          z0: Z_DEEP, z1: zlo, side: opts.rampTex || ground, top: opts.rampTex || ground,
          bot: 0, ramp: rdir, rampHi: zlo + 1,
        }];
        if (ceilTex) cell.push({ z0: Z_CEIL, z1: Z_HIGH, side: 0, top: 0, bot: ceilTex });
        slabs[i] = cell;
        continue;
      }

      // empty ground, or something solid to walk into that the ray sees past
      // anyway: trees and lamp posts are billboards, the sea is drawn flat
      if (!c || (def && def.noWall)) {
        const cell = openCell(ground, ceilTex);
        // a mouth cut into a cliff: rock overhead with headroom under it, so
        // the way in reads as a tunnel and not as a gap in a wall
        if (lvl.lintels && lvl.lintels[i]) {
          cell.push({ z0: 1.4, z1: Z_HIGH, side: opts.lintelTex, top: 0, bot: opts.lintelTex });
        }
        slabs[i] = cell;
        continue;
      }

      // a door fills the gap between floor and ceiling and nothing more, so
      // that once it slides open the room behind it is simply there
      if (def && def.door) {
        const cell = openCell(ground, ceilTex);
        cell.push({ z0: Z_GROUND, z1: Z_CEIL, side: c, top: 0, bot: 0, door: true });
        cell.sort((a, b) => a.z0 - b.z0);
        slabs[i] = cell;
        continue;
      }

      // solid: one span from below the ground to the top of the tile. No floor
      // slab under it, because there is no floor to see inside a wall.
      const h = tileHeight(c);
      slabs[i] = [{
        z0: Z_DEEP,
        z1: ceilTex && h <= 1 ? Z_HIGH : h,  // indoors a wall meets the ceiling
        side: c,
        // Only a tile that stands above the eye line shows a top, and it is
        // roofed in its own stone: you look down on battlements and clifftops,
        // never on the grass they were cut from.
        top: h > 1 ? c : 0,
        bot: 0,
      }];
      // glow is deliberately not cached here: the clock lights the cottage
      // windows by flipping the tile def, and the renderer reads it per frame
    }
  }
  lvl.slabs = slabs;
  return lvl;
}
