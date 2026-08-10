// ---- game/main: state machine, world assembly, main loop, boot ----
'use strict';

const W = 320, H = 200;
const HUD_H = 40;
const VIEW_H = H - HUD_H; // 160
const FOV_PLANE = 0.66;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const view = createView(W, VIEW_H);

// ---------- fit canvas to window at 4:3 (mode 13h pixel aspect) ----------
function fitCanvas() {
  const s = Math.min(window.innerWidth / 320, window.innerHeight / 240);
  canvas.style.width = Math.floor(320 * s) + 'px';
  canvas.style.height = Math.floor(240 * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- game state ----------
const G = {
  state: 'title',
  time: 0,
  baseSeed: (Math.random() * 1e9) | 0,
  level: null,
  explored: null,
  player: null,
  enemies: [],
  items: [],
  projectiles: [],
  npcs: [],
  clock: CLOCK_START, // hours on the surface; one real minute is one hour
  messages: [],
  transT: 0,
  shakeT: 0,
  hurtT: 0,
  showMap: false,
  titleAngle: 0,
  crownTaken: false,
  best: parseInt(localStorage.getItem('labyrinth.best') || '0', 10),
  stats: { kills: 0 },
  // cameFrom: which menu a sub-screen (options, help) was opened from
  menu: { items: [], ids: [], sel: 0, scroll: 0, slots: null, actions: [], actionSel: 0, actionSlot: 0, cameFrom: 'title' },
  deepest: -1,    // deepest floor reached this run; anything at or above it is walked ground
  floorNames: {}, // floor -> the name it was given, so the climb menu can list them
  shop: null,     // shop whose window is currently open
  flights: [],    // floors the stair menu is offering
  flightDir: 'up',// which way that menu is going
  hot: [],        // quick-item rows, rebuilt each time Q is pressed
  journal: [],    // quest rows, rebuilt each time J is pressed
  dialogue: null, // who is speaking, and what they say
  npc: null,      // villager the E menu is open on
  fogOfWar: true,
  showFps: false,
  activeSlot: null, // save slot this run writes to (null until saved/loaded)
};

function addMsg(text) {
  G.messages.push({ text, t: 3 });
  if (G.messages.length > 4) G.messages.shift();
}

// ---------- floor / run management ----------
// arriveAt: 'start' (you came down, or the run begins) | 'exit' (you came back up)
function loadFloor(n, arriveAt) {
  // level 0 is the fixed surface; everything below it is rolled from the seed
  const lvl = n === 0 ? buildOverworld() : generateDungeon(n, (G.baseSeed + n * 7919) >>> 0);
  G.level = lvl;
  G.explored = new Uint8Array(lvl.w * lvl.h);
  // ground you have already walked stays walked: no fog on a floor you finished
  if (n <= G.deepest) G.explored.fill(1);
  if (n > G.deepest) G.deepest = n;
  G.floorNames[n] = lvl.name;
  const p = G.player;
  const spot = arriveAt === 'exit' ? lvl.exit : lvl.start;
  p.x = spot.x + 0.5;
  p.y = spot.y + 0.5;
  p.keys = 0;
  p.floor = n;
  // the surface has a scripted opening view, but only when you start there
  if (arriveAt !== 'exit' && lvl.startAngle != null) {
    p.a = lvl.startAngle;
  } else {
    // face toward open space
    for (const [dx, dy] of ADJ) {
      if (cellAt(lvl, p.x + dx, p.y + dy) === 0) { p.a = Math.atan2(dy, dx); break; }
    }
  }
  G.enemies = lvl.spawns.map(s => makeEnemy(s.type, s.x, s.y));
  G.items = lvl.items.map(it => ({ ...it, bob: Math.random() * 10 }));
  // keepsakes from fetch errands lie where they were lost until found
  if (p.quests) {
    for (const qid in p.quests.log) {
      const def = questDef(p, qid), e = p.quests.log[qid];
      if (def && def.kind === 'fetch' && !e.done && !e.carrying && def.item.floor === n) {
        G.items.push({ type: 'quest', qid, x: def.item.x + 0.5, y: def.item.y + 0.5, bob: Math.random() * 10 });
      }
    }
  }
  G.projectiles = [];
  G.npcs = (lvl.villagers || []).map((v, i) => makeVillager(v.x, v.y, i, v.role));
  if (n > G.best) { G.best = n; localStorage.setItem('labyrinth.best', String(n)); }
}

function makeEnemy(type, x, y) {
  const st = ENEMY_STATS[type];
  return {
    type, x, y, hp: st.hp,
    state: 'idle', dir: Math.random() * Math.PI * 2, dirT: 0,
    atkT: 0, cdT: 0, painT: 0, walkPhase: Math.random() * 10,
    soundT: 2 + Math.random() * 6, bob: Math.random() * 10,
  };
}

function newGame() {
  G.baseSeed = (Math.random() * 1e9) | 0;
  G.player = newPlayer();
  questsOnNewGame(G.player);
  G.crownTaken = false;
  G.stats.kills = 0;
  G.activeSlot = null;
  G.clock = CLOCK_START;
  G.deepest = -1;   // so the surface itself is not treated as already walked
  G.floorNames = {};
  loadFloor(0); // every run begins on the surface
  G.state = 'transition';
  G.transT = 0;
  G.messages = [];
}

function changeFloor(n, arriveAt) {
  loadFloor(n, arriveAt);
  if (G.activeSlot != null) {
    if (SaveSys.write(G.activeSlot)) addMsg('AUTOSAVED TO SLOT ' + (G.activeSlot + 1));
  }
}

// down the stairs: you appear at the head of the new floor
function nextFloor() { changeFloor(G.player.floor + 1, 'start'); }

// ---------- menus ----------
function openTitleMenu() {
  const hasSaves = SaveSys.list().some(Boolean);
  G.menu.ids = hasSaves ? ['continue', 'new', 'load', 'help', 'options'] : ['new', 'load', 'help', 'options'];
  G.menu.items = hasSaves
    ? ['CONTINUE', 'NEW GAME', 'LOAD GAME', 'HELP', 'OPTIONS']
    : ['NEW GAME', 'LOAD GAME', 'HELP', 'OPTIONS'];
  G.menu.sel = 0;
  G.state = 'title';
  Input.exitLock(); // the only exit from a run: give the mouse back
}

function openPauseMenu() {
  G.menu.ids = ['resume', 'save', 'help', 'options', 'quit'];
  G.menu.items = ['RESUME', 'SAVE GAME', 'HELP', 'OPTIONS', 'QUIT TO TITLE'];
  G.menu.sel = 0;
  G.state = 'pause';
  // pointer lock is kept: every menu is keyboard driven, and dropping it
  // would force a click to get mouse look back on the way out
}

// ---------- options ----------
function optionsLabels() {
  return [
    'SOUND: ' + (Synth.enabled ? 'ON' : 'OFF'),
    'FOG OF WAR: ' + (G.fogOfWar ? 'ON' : 'OFF'),
    'SHOW FPS: ' + (G.showFps ? 'ON' : 'OFF'),
    'BACK',
  ];
}

function openOptions(from) {
  G.menu.ids = ['sound', 'fog', 'fps', 'back'];
  G.menu.items = optionsLabels();
  G.menu.sel = 0;
  G.menu.cameFrom = from;
  G.state = 'options';
}

// backing out of a sub-screen lands on the row that opened it
function backToMenu(id) {
  if (G.menu.cameFrom === 'pause') openPauseMenu();
  else openTitleMenu();
  const i = G.menu.ids.indexOf(id);
  if (i >= 0) G.menu.sel = i;
}

function closeOptions() { backToMenu('options'); }

// ---------- help ----------
function openHelp(from) {
  G.menu.cameFrom = from;
  G.state = 'help';
}

function closeHelp() { backToMenu('help'); }

function openSlotMenu(mode) { // 'loadmenu' | 'savemenu'
  G.menu.slots = SaveSys.list();
  if (mode === 'loadmenu') {
    const first = G.menu.slots.findIndex(Boolean);
    if (first < 0) return; // nothing to load
    G.menu.sel = first;
  } else {
    G.menu.sel = 0;
  }
  G.state = mode;
}

// move selection; in loadmenu only occupied slots are selectable
function menuMove(dir) {
  const m = G.menu;
  if (G.state === 'loadmenu' || G.state === 'savemenu') {
    const n = SaveSys.SLOTS;
    for (let step = 1; step <= n; step++) {
      const next = ((m.sel + dir * step) % n + n) % n;
      if (G.state === 'loadmenu' && !m.slots[next]) continue;
      m.sel = next;
      break;
    }
    SFX.menuMove();
    return;
  }
  if (G.state === 'title' || G.state === 'pause' || G.state === 'options') {
    const n = m.items.length;
    m.sel = ((m.sel + dir) % n + n) % n;
    SFX.menuMove();
    return;
  }
  menuSelRef(dir); // pack, item actions, quick items, shop
}

function loadFromSlot(slot) {
  const d = SaveSys.read(slot);
  if (!d || !SaveSys.restore(d)) { addMsg('SAVE IS CORRUPT'); return; }
  G.activeSlot = slot;
  G.state = 'transition';
  G.transT = 0;
  SFX.menuSelect();
}

// ---------- world rendering assembly ----------
function buildBillboards() {
  const lvl = G.level;
  const out = [];
  if (lvl.props) {
    const lit = lampsLit(G.clock);
    for (const pr of lvl.props) {
      if (pr.type === 'tree') {
        out.push({ x: pr.x, y: pr.y, img: SPRITES.tree[pr.variant], hFrac: 1.9, zOff: 0, glow: false });
      } else {
        const img = lit ? SPRITES.lampOn[((G.time * 9 + pr.phase) | 0) % 3] : SPRITES.lampOff[0];
        out.push({ x: pr.x, y: pr.y, img, hFrac: 1.35, zOff: 0, glow: lit });
      }
    }
  }
  for (const v of G.npcs) {
    const frames = v.role === 'king' ? SPRITES.king : SPRITES['villager' + v.kind];
    const fi = v.moving ? ((v.walkPhase | 0) % 2 + 2) % 2 : 2;
    out.push({ x: v.x, y: v.y, img: frames[fi], hFrac: 0.8, zOff: 0, glow: false });
  }
  for (const t of lvl.torches) {
    const fi = ((G.time * 9 + t.phase) | 0) % 3;
    out.push({ x: t.x, y: t.y, img: SPRITES.torch[fi], hFrac: 0.44, zOff: 0.38, glow: true });
  }
  if (!lvl.hasCrown || G.crownTaken) {
    out.push({ x: lvl.exit.x + 0.5, y: lvl.exit.y + 0.5, img: SPRITES.stairs[0], hFrac: 0.9, zOff: 0, glow: false });
  }
  if (lvl.floorNum > 0) { // the way back up; the surface has none
    out.push({ x: lvl.start.x + 0.5, y: lvl.start.y + 0.5, img: SPRITES.stairsUp[0], hFrac: 0.9, zOff: 0, glow: false });
  }
  for (const it of G.items) {
    const bobZ = 0.04 + Math.sin(it.bob) * 0.02;
    if (it.type === 'item') {
      const d = ITEMS[it.item];
      const spr = d && SPRITES[d.icon];
      if (spr) out.push({ x: it.x, y: it.y, img: spr[0], hFrac: 0.24, zOff: 0.01, glow: false });
    }
    else if (it.type === 'gold') out.push({ x: it.x, y: it.y, img: SPRITES.gold[0], hFrac: 0.2, zOff: 0.01, glow: false });
    else if (it.type === 'key') out.push({ x: it.x, y: it.y, img: SPRITES.key[0], hFrac: 0.24, zOff: bobZ, glow: true });
    else if (it.type === 'quest') out.push({ x: it.x, y: it.y, img: SPRITES.trinket[0], hFrac: 0.24, zOff: bobZ, glow: true });
    else if (it.type === 'crown') out.push({ x: it.x, y: it.y, img: SPRITES.crown[((G.time * 3) | 0) % 2], hFrac: 0.3, zOff: 0.15 + bobZ, glow: true });
  }
  for (const e of G.enemies) {
    const st = ENEMY_STATS[e.type];
    const frames = SPRITES[e.type];
    let fi;
    if (e.painT > 0) fi = 3;
    else if (e.atkT > 0) fi = 2;
    else fi = (e.walkPhase | 0) % 2;
    fi = ((fi % frames.length) + frames.length) % frames.length;
    const zOff = st.floats ? 0.06 + Math.sin(e.bob) * 0.04 : 0;
    out.push({ x: e.x, y: e.y, img: frames[fi], hFrac: st.hFrac, zOff, glow: st.glow });
  }
  projectileBillboards(out);
  return out;
}

function renderWorldView(camX, camY, camA, bob) {
  const lvl = G.level;
  const opts = {
    textures: Textures, texSize: TEX_SIZE,
    floorTex: T_FLOOR, ceilTex: T_CEIL, borderTex: T_STONE,
    fovPlane: FOV_PLANE,
    flicker: 0.9 + 0.06 * Math.sin(G.time * 11) + 0.04 * Math.sin(G.time * 23 + 1.7),
  };
  if (lvl.outdoor) {
    updateSurfaceLighting();
    opts.sky = SkyTex;
    opts.ambient = ambientLight(G.clock);
    opts.fogK = ambientFogK(G.clock);
    opts.flicker = 1;            // no torchlight to gutter out here
    opts.floorTex = T_GRASS;     // only used if a cell has no floorMap entry
    opts.borderTex = T_MOUNTAIN;
  }
  renderView(view, lvl, { x: camX, y: camY, a: camA, bob }, buildBillboards(), opts);
}

// ---------- input wiring ----------
// Menus confirm on Enter, numpad Enter, or E. E is the world's "use" key, so
// it only confirms once we are out of play and there is nothing to use.
function isConfirm(code) {
  if (code === 'Enter' || code === 'NumpadEnter') return true;
  return code === 'KeyE' && G.state !== 'play';
}

function handlePress(code) {
  initAudio(); // idempotent; any keypress is a valid audio gesture

  if (MENU_STATES.includes(G.state)) {
    if (code === 'ArrowUp' || code === 'KeyW') { menuMove(-1); return; }
    if (code === 'ArrowDown' || code === 'KeyS') { menuMove(1); return; }
  }

  // quick items double as number keys
  if (G.state === 'hotlist' && code.startsWith('Digit')) {
    const n = parseInt(code.slice(5), 10);
    if (n >= 1 && n <= G.hot.length) { G.menu.sel = n - 1; useHotlistEntry(n - 1); }
    return;
  }

  if (code === 'KeyI') {
    if (G.state === 'play') openInventory();
    else if (G.state === 'inventory') G.state = 'play';
    return;
  }
  if (code === 'KeyQ') {
    if (G.state === 'play') openHotlist();
    else if (G.state === 'hotlist') G.state = 'play';
    return;
  }
  if (code === 'KeyJ') {
    if (G.state === 'play') openJournal();
    else if (G.state === 'journal') G.state = 'play';
    return;
  }

  if (isConfirm(code)) {
    if (G.state === 'title') {
      const id = G.menu.ids[G.menu.sel];
      SFX.menuSelect();
      if (id === 'new') newGame();
      else if (id === 'continue') loadFromSlot(SaveSys.mostRecentSlot());
      else if (id === 'load') openSlotMenu('loadmenu');
      else if (id === 'help') openHelp('title');
      else if (id === 'options') openOptions('title');
    } else if (G.state === 'help') {
      SFX.menuSelect();
      closeHelp();
    } else if (G.state === 'options') {
      SFX.menuSelect();
      const id = G.menu.ids[G.menu.sel];
      if (id === 'sound') {
        Synth.toggle();
        G.menu.items = optionsLabels(); // the label itself is the confirmation
      } else if (id === 'fog') {
        G.fogOfWar = !G.fogOfWar;
        G.menu.items = optionsLabels();
      } else if (id === 'fps') {
        G.showFps = !G.showFps;
        G.menu.items = optionsLabels();
      } else {
        closeOptions();
      }
    } else if (G.state === 'loadmenu') {
      if (G.menu.slots[G.menu.sel]) loadFromSlot(G.menu.sel);
    } else if (G.state === 'savemenu') {
      if (SaveSys.write(G.menu.sel)) {
        G.activeSlot = G.menu.sel;
        addMsg('SAVED TO SLOT ' + (G.menu.sel + 1));
        SFX.menuSelect();
        G.state = 'play';
      } else {
        addMsg('SAVE FAILED');
      }
    } else if (G.state === 'pause') {
      const id = G.menu.ids[G.menu.sel];
      SFX.menuSelect();
      if (id === 'resume') G.state = 'play';
      else if (id === 'save') openSlotMenu('savemenu');
      else if (id === 'help') openHelp('pause');
      else if (id === 'options') openOptions('pause');
      else if (id === 'quit') openTitleMenu(); // deliberately does not save
    } else if (G.state === 'inventory') {
      openItemAction();
    } else if (G.state === 'itemaction') {
      confirmItemAction();
    } else if (G.state === 'hotlist') {
      useHotlistEntry(G.menu.sel);
    } else if (G.state === 'shop') {
      confirmShopBuy();
    } else if (G.state === 'dialogue') {
      endDialogue();
    } else if (G.state === 'npcaction') {
      confirmNpcAction();
    } else if (G.state === 'stairs') {
      confirmStairs();
    } else if (G.state === 'journal') {
      openQuestAction();
    } else if (G.state === 'questaction') {
      confirmQuestAction();
    } else if (G.state === 'questdetail') {
      G.state = 'journal';
    } else if (G.state === 'dead') {
      openTitleMenu();
    } else if (G.state === 'win') {
      G.state = 'transition'; G.transT = 0; nextFloor();
    }
    return;
  }

  // Tab backs out of whatever is open. Escape mirrors it because the browser
  // fires Escape to leave pointer lock whether the game asks for it or not,
  // and a freed mouse with an unpaused game reads as a bug.
  if (code === 'Tab' || code === 'Escape') {
    if (G.state === 'play') openPauseMenu();
    else if (G.state === 'pause') G.state = 'play';
    else if (G.state === 'loadmenu') openTitleMenu();
    else if (G.state === 'savemenu') openPauseMenu();
    else if (G.state === 'options') closeOptions();
    else if (G.state === 'help') closeHelp();
    else if (G.state === 'itemaction') G.state = 'inventory';
    else if (G.state === 'questaction' || G.state === 'questdetail') G.state = 'journal';
    else if (G.state === 'dialogue') endDialogue();
    else if (['inventory', 'hotlist', 'shop', 'journal', 'stairs', 'npcaction'].includes(G.state)) G.state = 'play';
    return;
  }
  if (code === 'KeyM') { G.showMap = !G.showMap; return; }
  if (code === 'KeyE' && G.state === 'play') useFront();
  if (code === 'Space' && G.state === 'play') startAttack();
}

Input.init(canvas, {
  preventCodes: ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  shouldLock: () => G.state === 'play',
  onPress: handlePress,
  onMouseButton: (b) => {
    if (b === 0 && Input.locked && G.state === 'play') startAttack();
  },
  onMouseMove: (dx) => {
    if (G.state === 'play') G.player.a += dx * 0.0026;
  },
});

// ---------- main loop ----------
let lastT = 0;
let fpsAvg = 0;
function frame(t) {
  requestAnimationFrame(frame);
  // the raw frame gap, smoothed, so the readout does not flicker
  const raw = (t - lastT) / 1000;
  if (raw > 0) fpsAvg += (1 / raw - fpsAvg) * 0.08;
  drawFrame(t);
  // stamped over whatever the frame drew, so every screen carries it
  if (G.showFps) drawText(ctx, Math.round(fpsAvg), 3, 3, '#ffffff', 1);
}

function drawFrame(t) {
  // clamp: a clock that jumps backwards must never rewind animation phases
  const dt = clamp((t - lastT) / 1000 || 0.016, 0, 0.05);
  lastT = t;
  G.time += dt;

  for (const m of G.messages) m.t -= dt;
  G.messages = G.messages.filter(m => m.t > 0);

  if (G.state === 'title') {
    drawTitle();
    return;
  }

  if (G.state === 'loadmenu') {
    drawTitleBase();
    drawSlotMenu('LOAD GAME', G.menu.slots, G.menu.sel);
    return;
  }

  // options and help reached from the title have no world behind them
  if ((G.state === 'options' || G.state === 'help') && G.menu.cameFrom === 'title') {
    drawTitleBase();
    if (G.state === 'help') drawHelp(); else drawOptions();
    return;
  }

  if (G.state === 'transition') {
    G.transT += dt;
    drawTransition();
    if (G.transT > 2.2) G.state = 'play';
    return;
  }

  if (G.state === 'play') updatePlay(dt);

  // render 3D view (also as backdrop for pause/dead/win)
  const p = G.player;
  const bobY = p.moving ? Math.sin(p.bobPhase * 2) * 1.6 : 0;
  renderWorldView(p.x, p.y, p.a, bobY);
  let sx = 0, sy = 0;
  if (G.shakeT > 0) {
    sx = ((Math.random() * 5) | 0) - 2;
    sy = ((Math.random() * 5) | 0) - 2;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, VIEW_H);
  ctx.putImageData(view.frameImg, sx, sy);

  if (G.state === 'play' || OVERLAY_STATES.includes(G.state)) {
    drawWeapon();
    if (G.hurtT > 0) drawVignetteOverlay('#c02010', clamp(G.hurtT, 0, 0.35));
    // crosshair
    ctx.fillStyle = 'rgba(230,220,200,0.5)';
    ctx.fillRect(W / 2, VIEW_H / 2 - 2, 1, 5);
    ctx.fillRect(W / 2 - 2, VIEW_H / 2, 5, 1);
    if (G.state === 'play') { useHint(); drawActiveQuest(); }
  }

  drawHUD();
  if (G.showMap && (G.state === 'play' || G.state === 'pause')) drawMinimap();

  if (G.state === 'pause') drawPause();
  else if (G.state === 'options') drawOptions();
  else if (G.state === 'help') drawHelp();
  else if (G.state === 'savemenu') drawSlotMenu('SAVE GAME', G.menu.slots, G.menu.sel);
  else if (G.state === 'inventory') drawInventory();
  else if (G.state === 'itemaction') drawItemAction();
  else if (G.state === 'hotlist') drawHotlist();
  else if (G.state === 'shop') drawShop();
  else if (G.state === 'journal') drawJournal();
  else if (G.state === 'stairs') drawStairs();
  else if (G.state === 'questaction') drawQuestAction();
  else if (G.state === 'questdetail') drawQuestDetail();
  else if (G.state === 'npcaction') drawNpcAction();
  else if (G.state === 'dialogue') drawDialogue();
  else if (G.state === 'dead') drawDead();
  else if (G.state === 'win') drawWin();

  // last so feedback is never buried; panels show it on the HUD status line
  if (!PANEL_STATES.includes(G.state)) drawMessages();
}

// ---------- boot ----------
generateTextures(0xDEADBEEF);
generateSprites();
initSky();
// backdrop level for the title screen
G.player = newPlayer();
loadFloor(1);
openTitleMenu();
requestAnimationFrame(frame);
