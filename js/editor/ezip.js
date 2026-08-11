// ---- editor/ezip: packaging the game, no dependencies harmed ----
// A ZIP with no compression is just headers, CRCs and the bytes themselves,
// which is well within reach of plain JS. The export fetches every file the
// game is made of, swaps custom-data.js for the draft, and hands back one
// archive that runs on any static host.
'use strict';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// entries: [{ name, data: Uint8Array }] -> Blob of a stored (method 0) zip
function makeZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  // one fixed MS-DOS timestamp; the archive's date is not the point
  const dosTime = (12 << 11) | (0 << 5) | 0;        // 12:00:00
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version needed
    local.setUint16(6, 0x0800, true);      // utf-8 names
    local.setUint16(8, 0, true);           // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, e.data.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, e.data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, e.data.length, true);
    cen.setUint32(24, e.data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + e.data.length;
  }

  let cenSize = 0;
  for (const c of central) cenSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cenSize, true);
  end.setUint32(16, offset, true);
  parts.push(...central, new Uint8Array(end.buffer));

  return new Blob(parts, { type: 'application/zip' });
}

// every file the game is made of; must track index.html's script list and
// the service worker's SHELL when files are added
const PACKAGE_FILES = [
  'index.html', 'style.css', 'manifest.webmanifest', 'sw.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/engine/util.js', 'js/engine/font.js', 'js/engine/synth.js',
  'js/engine/grid.js', 'js/engine/raycaster.js', 'js/engine/input.js',
  'js/game/tiles.js', 'js/game/slabs.js', 'js/game/custom.js',
  'js/game/config.js', 'js/game/items.js', 'js/game/shops.js',
  'js/game/textures.js', 'js/game/sprites.js', 'js/game/sfx.js',
  'js/game/dungeon.js', 'js/game/overworld.js', 'js/game/daynight.js',
  'js/game/quests.js', 'js/game/save.js', 'js/game/projectiles.js',
  'js/game/actors.js', 'js/game/ui.js', 'js/game/menus.js',
  'js/game/main.js', 'js/game/touch.js',
  // the designer travels with the game, so an export can be edited again
  'editor.html', 'editor.css',
  'js/editor/estate.js', 'js/editor/ezip.js', 'js/editor/emap.js',
  'js/editor/etiles.js', 'js/editor/etex.js', 'js/editor/emain.js',
];

async function exportZip() {
  const btn = document.getElementById('btn-export');
  btn.disabled = true;
  btn.textContent = 'PACKING...';
  try {
    const entries = [];
    for (const path of PACKAGE_FILES) {
      const res = await fetch(path, { cache: 'reload' });
      if (!res.ok) throw new Error(path + ' -> HTTP ' + res.status);
      entries.push({ name: 'labyrinth/' + path, data: new Uint8Array(await res.arrayBuffer()) });
    }
    const dataJs = '// exported by the level designer\nwindow.CUSTOM = '
      + JSON.stringify(ED.draft) + ';\n';
    entries.push({ name: 'labyrinth/custom-data.js', data: new TextEncoder().encode(dataJs) });

    const blob = makeZip(entries);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'labyrinth.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (err) {
    alert('EXPORT FAILED: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'EXPORT ZIP';
  }
}
