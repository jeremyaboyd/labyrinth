// ---- game/main: state machine, world assembly, main loop, boot ----
'use strict';

const W = 320, H = 200;
const HUD_H = 32;
const VIEW_H = H - HUD_H; // 168
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
  messages: [],
  transT: 0,
  shakeT: 0,
  hurtT: 0,
  showMap: false,
  titleAngle: 0,
  crownTaken: false,
  best: parseInt(localStorage.getItem('labyrinth.best') || '0', 10),
  stats: { kills: 0 },
};

function addMsg(text) {
  G.messages.push({ text, t: 3 });
  if (G.messages.length > 4) G.messages.shift();
}

// ---------- floor / run management ----------
function loadFloor(n) {
  const lvl = generateDungeon(n, (G.baseSeed + n * 7919) >>> 0);
  G.level = lvl;
  G.explored = new Uint8Array(lvl.w * lvl.h);
  const p = G.player;
  p.x = lvl.start.x + 0.5;
  p.y = lvl.start.y + 0.5;
  p.keys = 0;
  p.floor = n;
  // face toward open space
  for (const [dx, dy] of ADJ) {
    if (cellAt(lvl, p.x + dx, p.y + dy) === 0) { p.a = Math.atan2(dy, dx); break; }
  }
  G.enemies = lvl.spawns.map(s => makeEnemy(s.type, s.x, s.y));
  G.items = lvl.items.map(it => ({ ...it, bob: Math.random() * 10 }));
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
  G.crownTaken = false;
  G.stats.kills = 0;
  loadFloor(1);
  G.state = 'transition';
  G.transT = 0;
  G.messages = [];
}

function nextFloor() {
  loadFloor(G.player.floor + 1);
}

// ---------- world rendering assembly ----------
function buildBillboards() {
  const lvl = G.level;
  const out = [];
  for (const t of lvl.torches) {
    const fi = ((G.time * 9 + t.phase) | 0) % 3;
    out.push({ x: t.x, y: t.y, img: SPRITES.torch[fi], hFrac: 0.44, zOff: 0.38, glow: true });
  }
  if (!lvl.hasCrown || G.crownTaken) {
    out.push({ x: lvl.exit.x + 0.5, y: lvl.exit.y + 0.5, img: SPRITES.stairs[0], hFrac: 0.9, zOff: 0, glow: false });
  }
  for (const it of G.items) {
    const bobZ = 0.04 + Math.sin(it.bob) * 0.02;
    if (it.type === 'potion') out.push({ x: it.x, y: it.y, img: SPRITES.potion[0], hFrac: 0.24, zOff: 0.01, glow: false });
    else if (it.type === 'gold') out.push({ x: it.x, y: it.y, img: SPRITES.gold[0], hFrac: 0.2, zOff: 0.01, glow: false });
    else if (it.type === 'key') out.push({ x: it.x, y: it.y, img: SPRITES.key[0], hFrac: 0.24, zOff: bobZ, glow: true });
    else if (it.type === 'crown') out.push({ x: it.x, y: it.y, img: SPRITES.crown[((G.time * 3) | 0) % 2], hFrac: 0.3, zOff: 0.15 + bobZ, glow: true });
  }
  for (const e of G.enemies) {
    const st = ENEMY_STATS[e.type];
    let fi;
    if (e.painT > 0) fi = 3;
    else if (e.atkT > 0) fi = 2;
    else fi = ((e.walkPhase | 0) % 2);
    const zOff = st.floats ? 0.06 + Math.sin(e.bob) * 0.04 : 0;
    out.push({ x: e.x, y: e.y, img: SPRITES[e.type][fi], hFrac: st.hFrac, zOff, glow: st.glow });
  }
  return out;
}

function renderWorldView(camX, camY, camA, bob) {
  const flicker = 0.9 + 0.06 * Math.sin(G.time * 11) + 0.04 * Math.sin(G.time * 23 + 1.7);
  renderView(view, G.level, { x: camX, y: camY, a: camA, bob }, buildBillboards(), {
    textures: Textures, texSize: TEX_SIZE,
    floorTex: T_FLOOR, ceilTex: T_CEIL, borderTex: T_STONE,
    fovPlane: FOV_PLANE, flicker,
  });
}

// ---------- input wiring ----------
function handlePress(code) {
  if (code === 'Enter') {
    initAudio();
    if (G.state === 'title') newGame();
    else if (G.state === 'dead') newGame();
    else if (G.state === 'win') { G.state = 'transition'; G.transT = 0; nextFloor(); }
    else if (G.state === 'pause') G.state = 'play';
    return;
  }
  if (code === 'Escape') {
    if (G.state === 'play') { G.state = 'pause'; Input.exitLock(); }
    else if (G.state === 'pause') G.state = 'play';
    return;
  }
  if (code === 'Tab') { G.showMap = !G.showMap; return; }
  if (code === 'KeyM') {
    const on = Synth.toggle();
    addMsg(on ? 'SOUND ON' : 'SOUND OFF');
    return;
  }
  if (code === 'KeyE' && G.state === 'play') useDoor();
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
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  G.time += dt;

  for (const m of G.messages) m.t -= dt;
  G.messages = G.messages.filter(m => m.t > 0);

  if (G.state === 'title') {
    drawTitle();
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

  if (G.state === 'play' || G.state === 'pause') {
    drawWeapon();
    if (G.hurtT > 0) drawVignetteOverlay('#c02010', clamp(G.hurtT, 0, 0.35));
    // crosshair
    ctx.fillStyle = 'rgba(230,220,200,0.5)';
    ctx.fillRect(W / 2, VIEW_H / 2 - 2, 1, 5);
    ctx.fillRect(W / 2 - 2, VIEW_H / 2, 5, 1);
    doorHint();
  }

  drawHUD();
  drawMessages();
  if (G.showMap && (G.state === 'play' || G.state === 'pause')) drawMinimap();

  if (G.state === 'pause') drawPause();
  else if (G.state === 'dead') drawDead();
  else if (G.state === 'win') drawWin();
}

// ---------- boot ----------
generateTextures(0xDEADBEEF);
generateSprites();
// backdrop level for the title screen
G.player = newPlayer();
loadFloor(1);
requestAnimationFrame(frame);
