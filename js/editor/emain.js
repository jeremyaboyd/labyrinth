// ---- editor/emain: boot and the top bar ----
'use strict';

function showTab(name) {
  for (const b of document.querySelectorAll('#ed-tabs .tab')) {
    b.classList.toggle('active', b.dataset.tab === name);
  }
  for (const p of ['map', 'quests', 'tiles', 'textures']) {
    document.getElementById('panel-' + p).classList.toggle('hidden', p !== name);
  }
  if (name === 'map') { sizeMapCanvas(); renderMap(); }
  if (name === 'quests') refreshQuestPanel();
  if (name === 'tiles') refreshTilesPanel();
  if (name === 'textures') refreshTexGrid();
}

function initEditor() {
  // the same procedural art the game bakes at boot, then the draft on top
  generateTextures(0xDEADBEEF);
  ED.draft = loadDraft();
  applyDraftToRuntime();

  for (const b of document.querySelectorAll('#ed-tabs .tab')) {
    b.onclick = () => showTab(b.dataset.tab);
  }

  document.getElementById('btn-play').onclick = () => {
    saveDraft();
    // nosw keeps the service worker's cached shell from serving stale code
    // over the draft being tested
    window.open('index.html?draft=1&nosw=1', 'labyrinth-playtest');
  };
  document.getElementById('btn-export').onclick = exportZip;
  document.getElementById('btn-revert').onclick = () => {
    if (!confirm('THROW AWAY EVERY EDIT AND RETURN TO THE STOCK WORLD?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  };

  initMap();
  initQuests();
  initTiles();
  initTex();
  showTab('map');
}

initEditor();
