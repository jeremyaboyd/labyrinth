// ---- editor/estate: the draft being edited, and how it persists ----
// The draft is exactly the object the game consumes as window.CUSTOM: a world
// definition, tile defs keyed by id, and edited textures as base64 pixels.
// It lives in localStorage under the same key the game reads with ?draft=1,
// which is what makes PLAY TEST a plain page open.
'use strict';

const DRAFT_KEY = 'labyrinth.custom.draft';

// what the stock ids are called; custom ids carry their name in the draft
const TILE_NAMES = {
  [T_STONE]: 'STONE', [T_MOSS]: 'MOSSY STONE', [T_RUNE]: 'RUNE WALL',
  [T_BANNER]: 'BANNER', [T_SKULL]: 'SKULL WALL', [T_DOOR]: 'DOOR',
  [T_DOOR_LOCKED]: 'LOCKED DOOR', [T_SHOP_POTION]: 'POTION SHOP',
  [T_SHOP_WEAPON]: 'WEAPON SHOP', [T_SHOP_ARMOR]: 'ARMOR SHOP',
  [T_MOUNTAIN]: 'MOUNTAIN', [T_HOUSE]: 'HOUSE', [T_WINDOW]: 'WINDOW',
  [T_HDOOR]: 'HOUSE DOOR', [T_CASTLE]: 'CASTLE', [T_TREE]: 'TREE',
  [T_LAMP]: 'LAMP POST', [T_WATER]: 'WATER', [T_DIRT]: 'DIRT WALL',
  [T_MINE_SUPPORT]: 'MINE SUPPORT',
  [T_FLOOR]: 'DUNGEON FLOOR', [T_CEIL]: 'DUNGEON CEILING', [T_GRASS]: 'GRASS',
  [T_SAND]: 'SAND', [T_SEA]: 'SEA', [T_ROAD]: 'ROAD', [T_COURT]: 'COURTYARD',
  [T_DIRT_FLOOR]: 'MINE FLOOR', [T_PLANK_CEIL]: 'PLANK CEILING',
  [T_HOLE_DOWN]: 'HOLE DOWN', [T_HOLE_UP]: 'HOLE UP',
};

// glyphs with meaning beyond their tiles; they can never leave the legend
const SPECIAL_GLYPHS = { 'X': 'THE WAY DOWN', 'm': 'MINE MOUTH A', 'n': 'MINE MOUTH B' };

const ED = {
  draft: null,
  saveTimer: 0,
  avgCache: {}, // texture id -> css color
};

function freshDraft() {
  const d = defaultWorldDef();
  const draft = {
    version: 2,
    world: {
      name: d.name,
      rows: d.rows.slice(),
      legend: JSON.parse(JSON.stringify(d.legend)),
      ramps: d.ramps.map(r => ({ x: r.x, y: r.y, dir: r.dir, len: r.len })),
      start: { x: d.start.x, y: d.start.y, a: d.start.a },
      king: d.king ? d.king.slice() : null,
      villagers: d.villagers.map(v => v.slice()),
      portals: d.portals.map(p => ({ ...p })),
      quests: [],
    },
    tiles: {},
    textures: {},
  };
  resolveDraftPortals(draft.world);
  return draft;
}

// the stock def leaves portal coordinates to the X / m / n glyphs in the
// art; the editor works in coordinates, so pin them down here
function resolveDraftPortals(world) {
  const find = (ch) => {
    for (let y = 0; y < world.rows.length; y++) {
      const x = world.rows[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
    return null;
  };
  for (const p of world.portals) {
    if (p.x == null) {
      const spot = p.id === 'castle' ? find('X') : p.id === 'deepcut' ? find('m') : null;
      if (spot) { p.x = spot.x; p.y = spot.y; }
    }
    if (p.kind === 'mine' && !p.exit && p.id === 'deepcut') {
      p.exit = find('n');
    }
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.world && d.world.rows) {
        // drafts saved before portals and quests existed grow them here
        if (!d.world.portals) {
          d.world.portals = defaultWorldDef().portals.map(p => ({ ...p }));
          resolveDraftPortals(d.world);
        }
        if (!d.world.quests) d.world.quests = [];
        return d;
      }
    }
  } catch (err) { /* fall through to fresh */ }
  return freshDraft();
}

// ---------- portal + quest bookkeeping ----------
function allocPortalId(kind) {
  const used = new Set(ED.draft.world.portals.map(p => p.id));
  for (let i = 1; i < 100; i++) {
    const id = (kind === 'mine' ? 'mine' : 'delve') + i;
    if (!used.has(id)) return id;
  }
  return null;
}

function addPortal(kind) {
  const id = allocPortalId(kind);
  if (!id) return null;
  const p = kind === 'mine'
    ? { id, kind: 'mine', name: 'THE NEW MINE', x: null, y: null, exit: null }
    : { id, kind: 'dungeon', name: 'THE NEW DELVE', floors: 3, x: null, y: null, locked: false };
  ED.draft.world.portals.push(p);
  markDirty();
  return p;
}

function allocQuestId() {
  const used = new Set(ED.draft.world.quests.map(q => q.id));
  for (let i = 1; i < 1000; i++) if (!used.has('q' + i)) return 'q' + i;
  return null;
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(ED.draft));
  } catch (err) {
    alert('DRAFT DID NOT SAVE: ' + err.message);
  }
}

// every mutation calls this; the write itself is debounced because painting
// fires hundreds of them a second
function markDirty() {
  clearTimeout(ED.saveTimer);
  ED.saveTimer = setTimeout(saveDraft, 300);
}

// ---------- texture pixels <-> base64 ----------
function encodeTexData(px) {
  const bytes = new Uint8Array(px.buffer, px.byteOffset, px.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
  }
  return btoa(bin);
}

function decodeTexData(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Uint32Array(bytes.buffer);
}

// ---------- draft -> runtime ----------
// mirror of what game/custom.js does at boot, so previews here match play
function applyDraftToRuntime() {
  const d = ED.draft;
  for (const key in d.tiles) {
    const id = key | 0, t = d.tiles[key];
    const def = {};
    if (t.door) def.door = true;
    if (t.glow) def.glow = true;
    if (t.shop) def.shop = t.shop;
    if (t.prop) { def.noWall = true; def.prop = t.prop; def.radius = t.radius != null ? t.radius : 0.18; }
    else if (t.noWall) def.noWall = true;
    TILE_DEFS[id] = def;
    if (t.h != null && t.h > 1) TILE_H[id] = t.h;
    else delete TILE_H[id];
  }
  for (const key in d.textures) {
    const id = key | 0;
    Textures[id] = { data: decodeTexData(d.textures[key]), w: TEX_SIZE, h: TEX_SIZE };
    delete ED.avgCache[id];
  }
}

// ---------- effective tile info ----------
function tileName(id) {
  const t = ED.draft.tiles[id];
  return (t && t.name) || TILE_NAMES[id] || 'TILE ' + id;
}

function tileInfo(id) {
  const t = ED.draft.tiles[id];
  if (t) return { name: tileName(id), h: t.h || 1, door: !!t.door, glow: !!t.glow, shop: t.shop || '', prop: t.prop || '', stock: !!TILE_NAMES[id] };
  const def = TILE_DEFS[id] || {};
  return {
    name: tileName(id),
    h: TILE_H[id] || 1,
    door: !!def.door,
    glow: !!def.glow,
    shop: def.shop || '',
    prop: def.prop || '',
    stock: true,
  };
}

// write a full entry into the draft, whether the id is stock or custom
function setTileInfo(id, info) {
  ED.draft.tiles[id] = {
    name: info.name, h: info.h || 1,
    door: !!info.door, glow: !!info.glow,
    shop: info.shop || undefined, prop: info.prop || undefined,
    radius: info.prop ? (info.prop === 'lamp' ? 0.12 : 0.18) : undefined,
  };
  applyDraftToRuntime();
  markDirty();
}

// ---------- id bookkeeping ----------
function allWallIds() {
  const ids = new Set(Object.keys(TILE_DEFS).map(Number));
  for (const k in ED.draft.tiles) ids.add(k | 0);
  return [...ids].filter(id => id > 0 && id < 100).sort((a, b) => a - b);
}

function allFloorIds() {
  const ids = new Set([T_FLOOR, T_CEIL, T_GRASS, T_SAND, T_SEA, T_ROAD, T_COURT,
    T_DIRT_FLOOR, T_PLANK_CEIL, T_HOLE_DOWN, T_HOLE_UP]);
  for (const k in ED.draft.textures) if ((k | 0) >= 100) ids.add(k | 0);
  return [...ids].sort((a, b) => a - b);
}

function allTextureIds() {
  const ids = new Set([...allWallIds(), ...allFloorIds()]);
  for (const k in Textures) ids.add(k | 0);
  for (const k in ED.draft.textures) ids.add(k | 0);
  return [...ids].filter(id => Textures[id]).sort((a, b) => a - b);
}

function allocId(lo, hi) {
  const used = new Set(allTextureIds().concat(allWallIds()));
  for (let id = lo; id <= hi; id++) if (!used.has(id)) return id;
  return null;
}

// a new tile is born as a copy of stone (walls) or grass (grounds), so there
// is always something to see before its texture is painted
function createTile(kind) {
  const wall = kind === 'wall';
  const id = wall ? allocId(30, 99) : allocId(111, 199);
  if (id == null) { alert('NO FREE IDS LEFT'); return null; }
  const src = Textures[wall ? T_STONE : T_GRASS];
  const px = new Uint32Array(src.data);
  Textures[id] = { data: px, w: TEX_SIZE, h: TEX_SIZE };
  ED.draft.textures[id] = encodeTexData(px);
  if (wall) ED.draft.tiles[id] = { name: 'CUSTOM ' + id, h: 1 };
  markDirty();
  return id;
}

// ---------- average colors, for painting the map grid ----------
// tiles drawn as sprites or flat water own no wall texture; give them a color
const UNTEXTURED_COLORS = {
  [T_TREE]: '#2e5e22', [T_LAMP]: '#c8a038', [T_WATER]: '#26468a',
};

function texAvgColor(id) {
  if (ED.avgCache[id]) return ED.avgCache[id];
  const tex = Textures[id];
  if (!tex) return UNTEXTURED_COLORS[id] || '#f0f';
  let r = 0, g = 0, b = 0;
  const d = tex.data, n = d.length;
  for (let i = 0; i < n; i += 7) { // stride: close enough, 9x cheaper
    const v = d[i];
    r += v & 0xFF; g += (v >> 8) & 0xFF; b += (v >> 16) & 0xFF;
  }
  const m = Math.ceil(n / 7);
  const css = 'rgb(' + (r / m | 0) + ',' + (g / m | 0) + ',' + (b / m | 0) + ')';
  ED.avgCache[id] = css;
  return css;
}

function glyphColor(ch) {
  const entry = ED.draft.world.legend[ch];
  if (!entry) return '#f0f';
  return texAvgColor(entry[0] || entry[1]);
}
