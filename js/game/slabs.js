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

// how tall each solid tile stands, in tiles. Anything unlisted is one tall,
// which is what every wall in the game was before there was a choice.
const TILE_H = {};

function tileHeight(id) {
  const h = TILE_H[id];
  return h != null ? h : 1;
}

// Which way a ramp tile climbs, and how far. A ramp rises one tile across one
// tile of ground, so its face is at 45 degrees, and it is the only thing in
// the world you can walk up to reach the level above.
const RAMP_DIR = { E: 1, W: 2, S: 3, N: 4 };
const TILE_RAMP = {};   // tile id -> { dir, lo, hi }

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

      // a ramp: ground that climbs, so the level above is reachable on foot
      const rp = c ? TILE_RAMP[c] : null;
      if (rp) {
        const cell = [{
          z0: Z_DEEP, z1: rp.lo, side: c, top: c, bot: 0,
          ramp: rp.dir, rampHi: rp.hi,
        }];
        if (ceilTex) cell.push({ z0: Z_CEIL, z1: Z_HIGH, side: 0, top: 0, bot: ceilTex });
        slabs[i] = cell;
        continue;
      }

      // empty ground, or something solid to walk into that the ray sees past
      // anyway: trees and lamp posts are billboards, the sea is drawn flat
      if (!c || (def && def.noWall)) {
        slabs[i] = openCell(ground, ceilTex);
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
