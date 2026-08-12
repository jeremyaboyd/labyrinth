// ---- game/custom: applying what the level designer made ----
// The designer's output is data, not code: a world definition, tile defs and
// raw texture pixels. It reaches the game one of two ways -- baked into
// custom-data.js by an export, or sitting in localStorage as the editor's
// working draft, chosen with ?draft=1 so a play test never disturbs the
// shipped world.
'use strict';

const CustomData = (() => {
  const DRAFT_KEY = 'labyrinth.custom.draft';
  let data = null;

  try {
    if (/[?&]draft=1/.test(location.search)) {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) data = JSON.parse(raw);
    }
  } catch (err) { /* a broken draft must never take the game down */ }
  if (!data && typeof window !== 'undefined' && window.CUSTOM) data = window.CUSTOM;

  // texture pixels travel as base64 of the raw little-endian ABGR bytes
  function decodeTex(b64) {
    try {
      const bin = atob(b64);
      if (bin.length !== TEX_SIZE * TEX_SIZE * 4) return null;
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Uint32Array(bytes.buffer);
    } catch (err) {
      return null;
    }
  }

  return {
    DRAFT_KEY,
    get() { return data; },
    world() { return data && data.world ? data.world : null; },

    // merge tile defs before the first level is built: flags into TILE_DEFS,
    // stature into TILE_H. An entry always carries its full truth, so writing
    // one over a stock tile is an edit and not an accident -- except for
    // noWall and block, which the editor has no switch for: an entry that
    // omits them keeps what the tile had, so renaming the sea cannot drain it.
    applyTiles() {
      if (!data || !data.tiles) return;
      for (const key in data.tiles) {
        const id = key | 0;
        const t = data.tiles[key];
        if (!id || !t) continue;
        const was = TILE_DEFS[id];
        const def = {};
        if (t.door) def.door = true;
        if (t.glow) def.glow = true;
        if (t.shop) def.shop = t.shop;
        if (t.prop) {
          def.noWall = true;
          def.prop = t.prop;
          def.radius = t.radius != null ? t.radius : 0.18;
        } else if (t.noWall != null ? t.noWall : (was && was.noWall && !was.prop)) {
          def.noWall = true;
        }
        if (t.block != null ? t.block : (was && was.block)) def.block = true;
        TILE_DEFS[id] = def;
        if (t.h != null && t.h > 1) TILE_H[id] = t.h;
        else delete TILE_H[id];
      }
    },

    // after generateTextures: the procedural art stands, then edits land on
    // top of it. The sea and the cottage windows are swapped live by the
    // clock, so an edit to those has to silence the swap or it lasts a frame.
    applyTextures() {
      if (!data || !data.textures) return;
      for (const key in data.textures) {
        const id = key | 0;
        const px = decodeTex(data.textures[key]);
        if (!px) continue;
        const tex = { data: px, w: TEX_SIZE, h: TEX_SIZE };
        Textures[id] = tex;
        if (id === T_SEA) SeaFrames.length = 0;
        if (id === T_WINDOW) { WindowArt.dark = tex; WindowArt.lit = tex; }
      }
    },
  };
})();
