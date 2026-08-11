// ---- editor/etex: painting the art itself ----
// Textures stay what they are in the game: 64x64 grids of packed ABGR. The
// editor works on a copy and only SAVE writes it into the draft, so closing
// the box loses nothing but the experiment.
'use strict';

const ETex = {
  id: null,
  px: null,      // working copy, Uint32Array
  tool: 'pen',
  color: { r: 200, g: 160, b: 60 },
  drawing: false,
};

// the classic 16, for reaching a readable DOS color in one click
const EGA = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
  [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
  [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];

function refreshTexGrid() {
  const grid = document.getElementById('tex-grid');
  grid.textContent = '';
  for (const id of allTextureIds()) {
    const card = document.createElement('div');
    card.className = 'tex-card' + (ED.draft.textures[id] ? ' edited' : '');
    card.append(texPreviewCanvas(id, 96));
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = id + ' ' + tileName(id) + (ED.draft.textures[id] ? ' *' : '');
    card.append(lbl);
    card.onclick = () => openTexEditor(id);
    grid.append(card);
  }
}

// ---------- the pixel editor ----------
function openTexEditor(id) {
  const tex = Textures[id];
  if (!tex) return;
  ETex.id = id;
  ETex.px = new Uint32Array(tex.data);
  document.getElementById('tex-editor-title').textContent = 'TEXTURE ' + id + ' — ' + tileName(id);
  document.getElementById('tex-editor').classList.remove('hidden');
  buildTexPalette();
  drawTexCanvas();
}

function closeTexEditor() {
  document.getElementById('tex-editor').classList.add('hidden');
  ETex.id = null;
  ETex.px = null;
}

function drawTexCanvas() {
  const c = document.getElementById('texcanvas');
  const g = c.getContext('2d');
  const off = document.createElement('canvas');
  off.width = TEX_SIZE; off.height = TEX_SIZE;
  const og = off.getContext('2d');
  og.putImageData(new ImageData(new Uint8ClampedArray(ETex.px.buffer.slice(0)), TEX_SIZE, TEX_SIZE), 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(off, 0, 0, c.width, c.height);
}

function curColorU32() {
  const { r, g, b } = ETex.color;
  const p = document.getElementById('tex-post').checked;
  return rgb(p ? post(r) : r, p ? post(g) : g, p ? post(b) : b);
}

function setCurColor(r, g, b) {
  ETex.color = { r, g, b };
  document.getElementById('tex-r').value = r;
  document.getElementById('tex-g').value = g;
  document.getElementById('tex-b').value = b;
  document.getElementById('tex-cur').style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
}

function buildTexPalette() {
  const pal = document.getElementById('tex-pal');
  pal.textContent = '';
  const add = (r, g, b) => {
    const sw = document.createElement('div');
    sw.className = 'pal-swatch';
    sw.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
    sw.onclick = () => setCurColor(r, g, b);
    pal.append(sw);
  };
  for (const [r, g, b] of EGA) add(r, g, b);
  // and 16 drawn from the texture itself, so its own tones are one click away
  const counts = new Map();
  for (let i = 0; i < ETex.px.length; i += 3) {
    const v = ETex.px[i];
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
  for (const [v] of top) add(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF);
}

function texCellAt(e) {
  const c = document.getElementById('texcanvas');
  const r = c.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * TEX_SIZE);
  const y = Math.floor((e.clientY - r.top) / r.height * TEX_SIZE);
  if (x < 0 || y < 0 || x >= TEX_SIZE || y >= TEX_SIZE) return null;
  return { x, y };
}

function texApply(cell, rightClick) {
  const { x, y } = cell;
  if (rightClick || ETex.tool === 'pick') {
    const v = ETex.px[y * TEX_SIZE + x];
    setCurColor(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF);
    return;
  }
  const color = curColorU32();
  if (ETex.tool === 'fill') {
    const from = ETex.px[y * TEX_SIZE + x];
    if (from === color) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= TEX_SIZE || cy >= TEX_SIZE) continue;
      if (ETex.px[cy * TEX_SIZE + cx] !== from) continue;
      ETex.px[cy * TEX_SIZE + cx] = color;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  } else {
    const size = document.getElementById('tex-brush').value | 0;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const px = x + dx, py = y + dy;
      if (px < TEX_SIZE && py < TEX_SIZE) ETex.px[py * TEX_SIZE + px] = color;
    }
  }
  drawTexCanvas();
}

function saveTexEdit() {
  const id = ETex.id;
  ED.draft.textures[id] = encodeTexData(ETex.px);
  Textures[id] = { data: new Uint32Array(ETex.px), w: TEX_SIZE, h: TEX_SIZE };
  delete ED.avgCache[id];
  markDirty();
  refreshTexGrid();
  refreshTilesPanel();
  refreshGlyphUI();
  renderMap();
  closeTexEditor();
}

// back to what the game generates -- or, for a tile born in the editor and
// owning no generated art, back to the plain stone it started from
function resetTexEdit() {
  const id = ETex.id;
  delete ED.draft.textures[id];
  generateTextures(0xDEADBEEF);
  applyDraftToRuntime();
  if (!Textures[id]) {
    // custom id: it only exists as an edit, so it keeps a texture no matter what
    ED.draft.textures[id] = encodeTexData(new Uint32Array(Textures[id < 100 ? T_STONE : T_GRASS].data));
    applyDraftToRuntime();
  }
  ED.avgCache = {};
  markDirty();
  ETex.px = new Uint32Array(Textures[id].data);
  drawTexCanvas();
  buildTexPalette();
  refreshTexGrid();
  refreshTilesPanel();
  refreshGlyphUI();
  renderMap();
}

function initTex() {
  const c = document.getElementById('texcanvas');
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('mousedown', (e) => {
    const cell = texCellAt(e);
    if (!cell) return;
    if (e.button === 2) { texApply(cell, true); return; }
    ETex.drawing = true;
    texApply(cell, false);
  });
  window.addEventListener('mousemove', (e) => {
    if (!ETex.drawing || ETex.tool !== 'pen') return;
    const cell = texCellAt(e);
    if (cell) texApply(cell, false);
  });
  window.addEventListener('mouseup', () => { ETex.drawing = false; });

  for (const b of document.querySelectorAll('#tex-tools .ttool')) {
    b.onclick = () => {
      ETex.tool = b.dataset.ttool;
      for (const o of document.querySelectorAll('#tex-tools .ttool')) {
        o.classList.toggle('active', o === b);
      }
    };
  }
  for (const ch of ['r', 'g', 'b']) {
    document.getElementById('tex-' + ch).onchange = (e) => {
      ETex.color[ch] = clamp(e.target.value | 0, 0, 255);
      setCurColor(ETex.color.r, ETex.color.g, ETex.color.b);
    };
  }
  document.getElementById('btn-tex-save').onclick = saveTexEdit;
  document.getElementById('btn-tex-reset').onclick = resetTexEdit;
  document.getElementById('btn-tex-close').onclick = closeTexEditor;
  setCurColor(200, 160, 60);
  refreshTexGrid();
}
