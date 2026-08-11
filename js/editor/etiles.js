// ---- editor/etiles: what each wall tile is ----
// A tile is a handful of truths: how tall it stands, whether it opens, glows,
// trades, or is really a prop. Stock tiles can be reshaped the same way as
// new ones; the row just writes a full entry over the old id.
'use strict';

function texPreviewCanvas(id, size) {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const tex = Textures[id];
  const g = c.getContext('2d');
  if (tex) {
    const img = new ImageData(new Uint8ClampedArray(tex.data.buffer.slice(0)), TEX_SIZE, TEX_SIZE);
    g.putImageData(img, 0, 0);
  } else {
    // sprite-drawn tiles have no wall art; show their map color instead
    g.fillStyle = texAvgColor(id);
    g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  }
  return c;
}

function refreshTilesPanel() {
  const body = document.querySelector('#tiles-table tbody');
  body.textContent = '';
  for (const id of allWallIds()) {
    const info = tileInfo(id);
    const tr = document.createElement('tr');

    const tdPrev = document.createElement('td');
    tdPrev.append(texPreviewCanvas(id, 32));
    tr.append(tdPrev);

    const tdId = document.createElement('td');
    tdId.textContent = id;
    tdId.className = info.stock ? 'stock' : '';
    tr.append(tdId);

    const tdName = document.createElement('td');
    if (info.stock && !ED.draft.tiles[id]) {
      tdName.textContent = info.name;
      tdName.className = 'stock';
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = info.name;
      inp.onchange = () => { info.name = inp.value.toUpperCase() || 'TILE ' + id; commit(); };
      tdName.append(inp);
    }
    tr.append(tdName);

    const tdH = document.createElement('td');
    const hIn = document.createElement('input');
    hIn.type = 'number'; hIn.min = 1; hIn.max = 8; hIn.value = info.h;
    hIn.onchange = () => { info.h = clamp(hIn.value | 0 || 1, 1, 8); commit(); };
    tdH.append(hIn);
    tr.append(tdH);

    const check = (key) => {
      const td = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!info[key];
      cb.onchange = () => { info[key] = cb.checked; commit(); };
      td.append(cb);
      return td;
    };
    tr.append(check('door'), check('glow'));

    const tdShop = document.createElement('td');
    const shopSel = document.createElement('select');
    for (const [v, l] of [['', 'NO'], ['potion', 'POTION'], ['weapon', 'WEAPON'], ['armor', 'ARMOR']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l; o.selected = info.shop === v;
      shopSel.append(o);
    }
    shopSel.onchange = () => { info.shop = shopSel.value; commit(); };
    tdShop.append(shopSel);
    tr.append(tdShop);

    const tdProp = document.createElement('td');
    const propSel = document.createElement('select');
    for (const [v, l] of [['', 'NO'], ['tree', 'TREE'], ['lamp', 'LAMP']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l; o.selected = info.prop === v;
      propSel.append(o);
    }
    propSel.onchange = () => { info.prop = propSel.value; commit(); };
    tdProp.append(propSel);
    tr.append(tdProp);

    const tdEdit = document.createElement('td');
    const paint = document.createElement('button');
    paint.textContent = 'PAINT';
    paint.onclick = () => openTexEditor(id);
    tdEdit.append(paint);
    tr.append(tdEdit);

    function commit() {
      setTileInfo(id, info);
      refreshTilesPanel();
      refreshGlyphUI();
      renderMap();
    }

    body.append(tr);
  }
}

function initTiles() {
  document.getElementById('btn-new-wall').onclick = () => {
    const id = createTile('wall');
    if (id == null) return;
    refreshTilesPanel();
    refreshGlyphUI();
    refreshTexGrid();
    openTexEditor(id);
  };
  document.getElementById('btn-new-floor').onclick = () => {
    const id = createTile('floor');
    if (id == null) return;
    refreshGlyphUI();
    refreshTexGrid();
    openTexEditor(id);
  };
  refreshTilesPanel();
}
