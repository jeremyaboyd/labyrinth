// ---- editor/emap: painting the overworld ----
// The world is the same ASCII art the game builds from, so the editor's job
// is honest: recolor characters in strings. The canvas is only a view of it.
'use strict';

const EMap = {
  scale: 8,          // pixels per cell
  ox: 0, oy: 0,      // screen position of world origin
  tool: 'draw',
  glyph: '.',
  painting: false,
  panning: false,
  panFrom: null,
  cursor: null,      // {x, y} under the mouse, or null
};

const RAMP_ARROWS = { 1: '▶', 2: '◀', 3: '▼', 4: '▲' };

function mapCanvas() { return document.getElementById('mapcanvas'); }

function worldRows() { return ED.draft.world.rows; }
function worldW() { return worldRows()[0].length; }
function worldH() { return worldRows().length; }

// ---------- view ----------
function fitMapView() {
  const c = mapCanvas();
  EMap.scale = clamp(Math.floor(Math.min(c.width / worldW(), c.height / worldH())), 2, 24);
  EMap.ox = Math.floor((c.width - worldW() * EMap.scale) / 2);
  EMap.oy = Math.floor((c.height - worldH() * EMap.scale) / 2);
}

function sizeMapCanvas() {
  const c = mapCanvas();
  const w = c.clientWidth, h = c.clientHeight;
  if (w && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; fitMapView(); }
}

function cellAtScreen(e) {
  const r = mapCanvas().getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left - EMap.ox) / EMap.scale);
  const y = Math.floor((e.clientY - r.top - EMap.oy) / EMap.scale);
  if (x < 0 || y < 0 || x >= worldW() || y >= worldH()) return null;
  return { x, y };
}

// ---------- rendering ----------
function renderMap() {
  const c = mapCanvas();
  const g = c.getContext('2d');
  const w = worldW(), h = worldH(), s = EMap.scale;
  const world = ED.draft.world;
  g.fillStyle = '#06060a';
  g.fillRect(0, 0, c.width, c.height);

  const x0 = Math.max(0, Math.floor(-EMap.ox / s));
  const y0 = Math.max(0, Math.floor(-EMap.oy / s));
  const x1 = Math.min(w, Math.ceil((c.width - EMap.ox) / s));
  const y1 = Math.min(h, Math.ceil((c.height - EMap.oy) / s));

  for (let y = y0; y < y1; y++) {
    const row = world.rows[y];
    for (let x = x0; x < x1; x++) {
      const ch = row[x];
      const entry = world.legend[ch];
      const sx = EMap.ox + x * s, sy = EMap.oy + y * s;
      if (!entry) { g.fillStyle = '#f0f'; g.fillRect(sx, sy, s, s); continue; }
      const wallId = entry[0];
      const def = wallId ? TILE_DEFS[wallId] : null;
      if (def && def.prop) {
        // a tree or a lamp stands on its ground; show both
        g.fillStyle = texAvgColor(entry[1]);
        g.fillRect(sx, sy, s, s);
        g.fillStyle = texAvgColor(wallId);
        const p = Math.max(1, s >> 2);
        g.fillRect(sx + (s - p * 2 >> 1), sy + (s - p * 2 >> 1), p * 2, p * 2);
      } else {
        g.fillStyle = texAvgColor(wallId || entry[1]);
        g.fillRect(sx, sy, s, s);
        // solid tiles read as raised: a dark line along their south and east
        if (wallId && (!def || !def.noWall) && s >= 4) {
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(sx, sy + s - 1, s, 1);
          g.fillRect(sx + s - 1, sy, 1, s);
        }
      }
    }
  }

  if (s >= 6) {
    g.font = 'bold ' + Math.max(8, s - 2) + 'px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = (x, y, txt, color) => {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(EMap.ox + x * s + 1, EMap.oy + y * s + 1, s - 2, s - 2);
      g.fillStyle = color;
      g.fillText(txt, EMap.ox + x * s + s / 2, EMap.oy + y * s + s / 2 + 1);
    };
    // glyphs with mechanics get letters so they are never lost in the grass
    for (let y = y0; y < y1; y++) {
      const row = world.rows[y];
      for (let x = x0; x < x1; x++) {
        const ch = row[x];
        if (SPECIAL_GLYPHS[ch]) label(x, y, ch, '#e05040');
      }
    }
    for (const f of world.ramps) {
      const [sxk, syk] = RAMP_STEP[f.dir];
      for (let k = 0; k < f.len; k++) {
        const x = f.x + sxk * k, y = f.y + syk * k;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) label(x, y, RAMP_ARROWS[f.dir], '#c8a038');
      }
    }
    for (const [x, y] of world.villagers) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) label(x, y, 'V', '#48c8c8');
    }
    if (world.king) label(world.king[0], world.king[1], 'K', '#e8c838');
    label(world.start.x, world.start.y, 'S', '#68e068');
  }

  // cursor cell
  if (EMap.cursor) {
    g.strokeStyle = '#e8e0d0';
    g.strokeRect(EMap.ox + EMap.cursor.x * s + 0.5, EMap.oy + EMap.cursor.y * s + 0.5, s - 1, s - 1);
  }
}

// ---------- edits ----------
function setGlyph(x, y, ch) {
  const rows = worldRows();
  if (rows[y][x] === ch) return;
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  markDirty();
}

function floodFill(x, y, ch) {
  const rows = worldRows();
  const from = rows[y][x];
  if (from === ch) return;
  const w = worldW(), h = worldH();
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || rows[cy][cx] !== from) continue;
    rows[cy] = rows[cy].slice(0, cx) + ch + rows[cy].slice(cx + 1);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  markDirty();
}

function applyTool(cell, rightClick) {
  const world = ED.draft.world;
  const { x, y } = cell;
  if (rightClick) {
    if (EMap.tool === 'ramp') {
      world.ramps = world.ramps.filter(f => {
        const [sx, sy] = RAMP_STEP[f.dir];
        for (let k = 0; k < f.len; k++) if (f.x + sx * k === x && f.y + sy * k === y) return false;
        return true;
      });
      markDirty();
    } else if (EMap.tool === 'king') {
      world.king = null;
      markDirty();
    } else {
      // any other tool: right-click reads the map instead of writing it
      EMap.glyph = world.rows[y][x];
      refreshGlyphUI();
    }
    return;
  }
  switch (EMap.tool) {
    case 'draw': setGlyph(x, y, EMap.glyph); break;
    case 'fill': floodFill(x, y, EMap.glyph); break;
    case 'start': {
      world.start.x = x; world.start.y = y;
      world.start.a = parseFloat(document.getElementById('start-dir').value);
      markDirty(); break;
    }
    case 'king': world.king = [x, y]; markDirty(); break;
    case 'villager': {
      const i = world.villagers.findIndex(v => v[0] === x && v[1] === y);
      if (i >= 0) world.villagers.splice(i, 1); else world.villagers.push([x, y]);
      markDirty(); break;
    }
    case 'ramp': {
      const dir = document.getElementById('ramp-dir').value | 0;
      const len = clamp(document.getElementById('ramp-len').value | 0 || 1, 1, 8);
      world.ramps.push({ x, y, dir, len });
      markDirty(); break;
    }
  }
  validateWorld();
}

// ---------- world size ----------
function resizeWorld(nw, nh) {
  const world = ED.draft.world;
  nw = clamp(nw | 0, 16, 256); nh = clamp(nh | 0, 16, 256);
  const rows = [];
  for (let y = 0; y < nh; y++) {
    let row = y < world.rows.length ? world.rows[y] : '';
    if (row.length > nw) row = row.slice(0, nw);
    while (row.length < nw) row += 'M';
    rows.push(row);
  }
  world.rows = rows;
  world.villagers = world.villagers.filter(v => v[0] < nw && v[1] < nh);
  world.ramps = world.ramps.filter(f => f.x < nw && f.y < nh);
  if (world.king && (world.king[0] >= nw || world.king[1] >= nh)) world.king = null;
  world.start.x = Math.min(world.start.x, nw - 1);
  world.start.y = Math.min(world.start.y, nh - 1);
  markDirty();
  fitMapView();
  renderMap();
  validateWorld();
}

// ---------- validation ----------
function validateWorld() {
  const world = ED.draft.world;
  const warns = [];
  let hasExit = false;
  for (const row of world.rows) if (row.indexOf('X') >= 0) { hasExit = true; break; }
  if (!hasExit) warns.push('NO X GLYPH: THE DUNGEON CANNOT BE ENTERED');
  const sEntry = world.legend[world.rows[world.start.y][world.start.x]];
  const sDef = sEntry && sEntry[0] ? TILE_DEFS[sEntry[0]] : null;
  if (sEntry && sEntry[0] && (!sDef || !sDef.noWall)) warns.push('START IS INSIDE A SOLID TILE');
  document.getElementById('map-warn').textContent = warns.join(' — ');
}

// ---------- legend UI ----------
function glyphLabel(ch) {
  if (SPECIAL_GLYPHS[ch]) return SPECIAL_GLYPHS[ch];
  const entry = ED.draft.world.legend[ch];
  return entry[0] ? tileName(entry[0]) : tileName(entry[1]);
}

function glyphInUse(ch) {
  for (const row of worldRows()) if (row.indexOf(ch) >= 0) return true;
  return false;
}

function refreshGlyphUI() {
  const list = document.getElementById('glyph-list');
  list.textContent = '';
  const legend = ED.draft.world.legend;
  for (const ch of Object.keys(legend)) {
    const row = document.createElement('div');
    row.className = 'glyph-row' + (ch === EMap.glyph ? ' active' : '');
    const sw = document.createElement('span');
    sw.className = 'glyph-swatch';
    sw.style.background = glyphColor(ch);
    const c = document.createElement('span');
    c.className = 'glyph-ch raw';
    c.textContent = ch;
    const name = document.createElement('span');
    name.className = 'glyph-name';
    name.textContent = glyphLabel(ch);
    row.append(sw, c, name);
    // 'M' pads every resize; the specials carry mechanics. Those stay.
    if (!SPECIAL_GLYPHS[ch] && ch !== 'M' && !glyphInUse(ch)) {
      const del = document.createElement('button');
      del.className = 'glyph-del';
      del.textContent = 'X';
      del.title = 'REMOVE GLYPH';
      del.onclick = (e) => {
        e.stopPropagation();
        delete legend[ch];
        if (EMap.glyph === ch) EMap.glyph = '.';
        markDirty();
        refreshGlyphUI();
      };
      row.append(del);
    }
    row.onclick = () => {
      EMap.glyph = ch;
      if (EMap.tool !== 'draw' && EMap.tool !== 'fill') setMapTool('draw');
      refreshGlyphUI();
    };
    list.append(row);
  }
  fillTileSelects();
}

function fillTileSelects() {
  const wallSel = document.getElementById('new-glyph-wall');
  const floorSel = document.getElementById('new-glyph-floor');
  wallSel.textContent = '';
  const none = document.createElement('option');
  none.value = '0'; none.textContent = 'WALL: NONE';
  wallSel.append(none);
  for (const id of allWallIds()) {
    const o = document.createElement('option');
    o.value = id; o.textContent = tileName(id);
    wallSel.append(o);
  }
  floorSel.textContent = '';
  for (const id of allFloorIds()) {
    const o = document.createElement('option');
    o.value = id; o.textContent = 'ON ' + tileName(id);
    floorSel.append(o);
  }
}

function addGlyph() {
  const chIn = document.getElementById('new-glyph-ch');
  const ch = chIn.value;
  const legend = ED.draft.world.legend;
  if (!ch || ch === ' ') { alert('GLYPH NEEDS A CHARACTER'); return; }
  if (legend[ch]) { alert('GLYPH "' + ch + '" ALREADY EXISTS'); return; }
  const wall = document.getElementById('new-glyph-wall').value | 0;
  const floor = document.getElementById('new-glyph-floor').value | 0;
  legend[ch] = [wall, floor];
  chIn.value = '';
  EMap.glyph = ch;
  markDirty();
  refreshGlyphUI();
  renderMap();
}

// ---------- tool + wiring ----------
function setMapTool(tool) {
  EMap.tool = tool;
  for (const b of document.querySelectorAll('#map-tools .tool')) {
    b.classList.toggle('active', b.dataset.tool === tool);
  }
  document.getElementById('ramp-opts').classList.toggle('hidden', tool !== 'ramp');
  document.getElementById('start-opts').classList.toggle('hidden', tool !== 'start');
}

function initMap() {
  const c = mapCanvas();

  for (const b of document.querySelectorAll('#map-tools .tool')) {
    b.onclick = () => setMapTool(b.dataset.tool);
  }
  document.getElementById('btn-resize').onclick = () => {
    resizeWorld(document.getElementById('world-w').value, document.getElementById('world-h').value);
    syncWorldInputs();
  };
  document.getElementById('world-name').oninput = (e) => {
    ED.draft.world.name = e.target.value.toUpperCase() || 'THE OVERWORLD';
    markDirty();
  };
  document.getElementById('btn-add-glyph').onclick = addGlyph;
  document.getElementById('start-dir').onchange = (e) => {
    ED.draft.world.start.a = parseFloat(e.target.value);
    markDirty();
  };

  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      EMap.panning = true;
      EMap.panFrom = { x: e.clientX - EMap.ox, y: e.clientY - EMap.oy };
      e.preventDefault();
      return;
    }
    const cell = cellAtScreen(e);
    if (!cell) return;
    if (e.button === 2) { applyTool(cell, true); renderMap(); return; }
    EMap.painting = true;
    applyTool(cell, false);
    renderMap();
  });
  window.addEventListener('mousemove', (e) => {
    if (EMap.panning) {
      EMap.ox = e.clientX - EMap.panFrom.x;
      EMap.oy = e.clientY - EMap.panFrom.y;
      renderMap();
      return;
    }
    const cell = cellAtScreen(e);
    EMap.cursor = cell;
    if (cell) {
      const ch = worldRows()[cell.y][cell.x];
      document.getElementById('map-status').innerHTML = '';
      const st = document.getElementById('map-status');
      st.textContent = cell.x + ',' + cell.y + '  "' + ch + '" ' + glyphLabel(ch);
      st.classList.add('raw');
    }
    if (EMap.painting && cell && (EMap.tool === 'draw')) applyTool(cell, false);
    if (document.getElementById('panel-map').offsetParent !== null) renderMap();
  });
  window.addEventListener('mouseup', () => { EMap.painting = false; EMap.panning = false; });
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const old = EMap.scale;
    EMap.scale = clamp(Math.round(old * (e.deltaY < 0 ? 1.25 : 0.8)) || 1, 2, 24);
    // keep the cell under the cursor under the cursor
    EMap.ox = mx - (mx - EMap.ox) * (EMap.scale / old);
    EMap.oy = my - (my - EMap.oy) * (EMap.scale / old);
    renderMap();
  }, { passive: false });
  window.addEventListener('resize', () => { sizeMapCanvas(); renderMap(); });

  syncWorldInputs();
  refreshGlyphUI();
  sizeMapCanvas();
  fitMapView();
  renderMap();
  validateWorld();
}

function syncWorldInputs() {
  document.getElementById('world-name').value = ED.draft.world.name;
  document.getElementById('world-w').value = worldW();
  document.getElementById('world-h').value = worldH();
}
