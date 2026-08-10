// ---- LABERINTH: main engine, raycaster, entities, states ----
'use strict';

const W = 320, H = 200;
const HUD_H = 32;
const VIEW_H = H - HUD_H; // 168
const FOV_PLANE = 0.66;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const frameImg = ctx.createImageData(W, VIEW_H);
const buf = new Uint32Array(frameImg.data.buffer);
const zBuffer = new Float32Array(W);

// ---------- fit canvas to window at 4:3 (mode 13h pixel aspect) ----------
function fitCanvas() {
  const s = Math.min(window.innerWidth / 320, window.innerHeight / 240);
  canvas.style.width = Math.floor(320 * s) + 'px';
  canvas.style.height = Math.floor(240 * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- game state ----------
const ENEMY_STATS = {
  rat:      { hp: 20, speed: 2.3, dmg: 6,  range: 0.8,  cd: 0.9, wFrac: 0.55, hFrac: 0.42, drop: 0.2,  sight: 7,  sfx: 'ratSqueak' },
  skeleton: { hp: 45, speed: 1.45, dmg: 12, range: 0.95, cd: 1.2, wFrac: 0.62, hFrac: 0.74, drop: 0.35, sight: 9,  sfx: 'skelRattle' },
  wraith:   { hp: 60, speed: 1.9, dmg: 16, range: 0.95, cd: 1.1, wFrac: 0.62, hFrac: 0.8,  drop: 0.5,  sight: 12, sfx: 'wraithMoan' },
};

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
  transTarget: 1,
  shakeT: 0,
  hurtT: 0,
  showMap: false,
  titleAngle: 0,
  crownTaken: false,
  best: parseInt(localStorage.getItem('laberinth.best') || '0', 10),
  stats: { kills: 0 },
};

function newPlayer() {
  return {
    x: 0, y: 0, a: 0,
    hp: 100, maxHp: 100, gold: 0, keys: 0, floor: 1,
    attackT: 0, attackHitDone: false, atkCd: 0,
    bobPhase: 0, moving: false, stepAcc: 0,
  };
}

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
    if (cellAt(p.x + dx, p.y + dy) === 0) { p.a = Math.atan2(dy, dx); break; }
  }
  G.enemies = lvl.spawns.map(s => {
    const st = ENEMY_STATS[s.type];
    return {
      type: s.type, x: s.x, y: s.y, hp: st.hp,
      state: 'idle', dir: Math.random() * Math.PI * 2, dirT: 0,
      atkT: 0, cdT: 0, painT: 0, walkPhase: Math.random() * 10,
      soundT: 2 + Math.random() * 6, bob: Math.random() * 10,
    };
  });
  G.items = lvl.items.map(it => ({ ...it, bob: Math.random() * 10 }));
  if (n > G.best) { G.best = n; localStorage.setItem('laberinth.best', String(n)); }
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

// ---------- map helpers ----------
function cellAt(x, y) {
  const lvl = G.level;
  const cx = x | 0, cy = y | 0;
  if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) return T_STONE;
  return lvl.map[cy * lvl.w + cx];
}

function solidAt(x, y) {
  const c = cellAt(x, y);
  if (c === 0) return false;
  if (c === T_DOOR || c === T_DOOR_LOCKED) {
    const d = G.level.doors[(y | 0) * G.level.w + (x | 0)];
    return !(d && d.open > 0.75);
  }
  return true;
}

function tryMove(e, dx, dy, r) {
  if (dx !== 0) {
    const nx = e.x + dx;
    const sx = dx > 0 ? nx + r : nx - r;
    if (!solidAt(sx, e.y - r) && !solidAt(sx, e.y + r)) e.x = nx;
  }
  if (dy !== 0) {
    const ny = e.y + dy;
    const sy = dy > 0 ? ny + r : ny - r;
    if (!solidAt(e.x - r, sy) && !solidAt(e.x + r, sy)) e.y = ny;
  }
}

function lineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solidAt(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// ---------- input ----------
const keys = {};
let pointerLocked = false;

window.addEventListener('keydown', (e) => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;

  if (e.code === 'Enter') {
    AudioSys.init();
    if (G.state === 'title') newGame();
    else if (G.state === 'dead') { newGame(); }
    else if (G.state === 'win') { G.state = 'transition'; G.transT = 0; nextFloor(); }
    else if (G.state === 'pause') G.state = 'play';
  }
  if (e.code === 'Escape' && G.state === 'play') G.state = 'pause';
  else if (e.code === 'Escape' && G.state === 'pause') G.state = 'play';
  if (e.code === 'Tab') G.showMap = !G.showMap;
  if (e.code === 'KeyM') {
    const on = AudioSys.toggle();
    addMsg(on ? 'SOUND ON' : 'SOUND OFF');
  }
  if (e.code === 'KeyE' && G.state === 'play') useDoor();
  if (e.code === 'Space' && G.state === 'play') startAttack();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (G.state === 'play' && !pointerLocked) {
    canvas.requestPointerLock();
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (G.state === 'play' && pointerLocked && e.button === 0) startAttack();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (pointerLocked && G.state === 'play') {
    G.player.a += e.movementX * 0.0026;
  }
});

// ---------- messages ----------
function addMsg(text) {
  G.messages.push({ text, t: 3 });
  if (G.messages.length > 4) G.messages.shift();
}

// ---------- player actions ----------
function startAttack() {
  const p = G.player;
  if (p.atkCd > 0) return;
  p.atkCd = 0.42;
  p.attackT = 0.32;
  p.attackHitDone = false;
  AudioSys.sfx.swing();
}

function doAttackHit() {
  const p = G.player;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  let hit = false;
  for (const e of G.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) continue;
    const dot = (dx / d) * dirX + (dy / d) * dirY;
    if (dot < 0.75 && d > 0.6) continue;
    if (!lineOfSight(p.x, p.y, e.x, e.y)) continue;
    e.hp -= 22 + Math.random() * 8;
    e.painT = 0.18;
    e.state = 'chase';
    // knockback
    tryMove(e, (dx / d) * 0.3, (dy / d) * 0.3, 0.3);
    hit = true;
  }
  if (hit) AudioSys.sfx.hit();
}

function useDoor() {
  const p = G.player;
  const lvl = G.level;
  const fx = p.x + Math.cos(p.a) * 0.9, fy = p.y + Math.sin(p.a) * 0.9;
  const candidates = [[fx, fy], [p.x + Math.cos(p.a) * 1.4, p.y + Math.sin(p.a) * 1.4]];
  for (const [cx, cy] of candidates) {
    const c = cellAt(cx, cy);
    if (c !== T_DOOR && c !== T_DOOR_LOCKED) continue;
    const idx = (cy | 0) * lvl.w + (cx | 0);
    const d = lvl.doors[idx];
    if (!d) continue;
    if (d.locked) {
      if (p.keys > 0) {
        p.keys--;
        d.locked = false;
        d.opening = true;
        lvl.map[idx] = T_DOOR;
        addMsg('THE KEY TURNS. THE WAY IS OPEN.');
        AudioSys.sfx.unlock();
      } else {
        addMsg("LOCKED. FIND THE KEY.");
        AudioSys.sfx.doorLocked();
      }
    } else if (d.open < 0.1 && !d.opening) {
      d.opening = true;
      AudioSys.sfx.doorOpen();
    }
    return;
  }
}

function nextFloor() {
  const p = G.player;
  loadFloor(p.floor + 1);
}

// ---------- update ----------
function updatePlay(dt) {
  const p = G.player;
  const lvl = G.level;

  // turning
  if (keys['ArrowLeft']) p.a -= 2.7 * dt;
  if (keys['ArrowRight']) p.a += 2.7 * dt;

  // movement
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = (run ? 3.6 : 2.5) * dt;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  let mx = 0, my = 0;
  if (keys['KeyW'] || keys['ArrowUp']) { mx += dirX; my += dirY; }
  if (keys['KeyS'] || keys['ArrowDown']) { mx -= dirX; my -= dirY; }
  if (keys['KeyA']) { mx += dirY; my -= dirX; }
  if (keys['KeyD']) { mx -= dirY; my += dirX; }
  const ml = Math.hypot(mx, my);
  p.moving = ml > 0;
  if (ml > 0) {
    tryMove(p, (mx / ml) * speed, (my / ml) * speed, 0.24);
    p.bobPhase += dt * (run ? 11 : 8);
    p.stepAcc += dt * (run ? 11 : 8);
    if (p.stepAcc > Math.PI) { p.stepAcc -= Math.PI; AudioSys.sfx.step(); }
  }

  // attack timeline
  if (p.atkCd > 0) p.atkCd -= dt;
  if (p.attackT > 0) {
    p.attackT -= dt;
    if (!p.attackHitDone && p.attackT < 0.2) {
      p.attackHitDone = true;
      doAttackHit();
    }
  }

  // doors animate
  for (const k in lvl.doors) {
    const d = lvl.doors[k];
    if (d.opening && d.open < 1) d.open = Math.min(1, d.open + dt * 1.6);
  }

  // explored map
  const px = p.x | 0, py = p.y | 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = px + dx, y = py + dy;
    if (x >= 0 && y >= 0 && x < lvl.w && y < lvl.h && dx * dx + dy * dy <= 12) {
      G.explored[y * lvl.w + x] = 1;
    }
  }

  // items
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    it.bob += dt * 3;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < 0.55) {
      if (it.type === 'potion') {
        if (p.hp >= p.maxHp) continue;
        p.hp = Math.min(p.maxHp, p.hp + 30);
        addMsg('YOU DRINK THE CRIMSON DRAUGHT. +30');
        AudioSys.sfx.pickupPotion();
      } else if (it.type === 'gold') {
        const v = 8 + ((Math.random() * 18) | 0);
        p.gold += v;
        addMsg('PICKED UP ' + v + ' GOLD');
        AudioSys.sfx.pickupGold();
      } else if (it.type === 'key') {
        p.keys++;
        addMsg('YOU FOUND AN IRON KEY');
        AudioSys.sfx.pickupKey();
      } else if (it.type === 'crown') {
        G.crownTaken = true;
        G.state = 'win';
        document.exitPointerLock();
        AudioSys.sfx.victory();
      }
      G.items.splice(i, 1);
    }
  }
  if (G.state !== 'play') return; // crown pickup may have ended the run

  // stairs
  if (!lvl.hasCrown || G.crownTaken) {
    const d = Math.hypot(lvl.exit.x + 0.5 - p.x, lvl.exit.y + 0.5 - p.y);
    if (d < 0.55) {
      AudioSys.sfx.stairs();
      G.state = 'transition';
      G.transT = 0;
      nextFloor();
      return;
    }
  }

  updateEnemies(dt);

  if (G.hurtT > 0) G.hurtT -= dt;
  if (G.shakeT > 0) G.shakeT -= dt;

  if (p.hp <= 0) {
    G.state = 'dead';
    document.exitPointerLock();
    AudioSys.sfx.death();
  }
}

function updateEnemies(dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const st = ENEMY_STATS[e.type];

    if (e.hp <= 0) {
      G.stats.kills++;
      AudioSys.sfx.kill();
      if (Math.random() < st.drop) {
        G.items.push({ type: 'gold', x: e.x, y: e.y, bob: 0 });
      }
      G.enemies.splice(i, 1);
      continue;
    }

    if (e.painT > 0) e.painT -= dt;
    if (e.cdT > 0) e.cdT -= dt;
    e.bob += dt * 4;

    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);

    // wake up on sight
    if (e.state === 'idle') {
      if (d < st.sight && lineOfSight(e.x, e.y, p.x, p.y)) {
        e.state = 'chase';
        if (d < 9) AudioSys.sfx[st.sfx]();
      } else {
        // slow wander
        e.dirT -= dt;
        if (e.dirT <= 0) { e.dir = Math.random() * Math.PI * 2; e.dirT = 1.5 + Math.random() * 2.5; }
        const ox = e.x, oy = e.y;
        tryMove(e, Math.cos(e.dir) * st.speed * 0.25 * dt, Math.sin(e.dir) * st.speed * 0.25 * dt, 0.28);
        if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < 0.001) e.dirT = 0;
        e.walkPhase += dt * 3;
        continue;
      }
    }

    // attack wind-up in progress
    if (e.atkT > 0) {
      e.atkT -= dt;
      if (e.atkT <= 0) {
        if (d < st.range + 0.35) {
          p.hp -= st.dmg * (0.8 + Math.random() * 0.4);
          G.hurtT = 0.35;
          G.shakeT = 0.25;
          AudioSys.sfx.enemyHitPlayer();
        }
        e.cdT = st.cd;
      }
      continue;
    }

    // chase
    if (d > st.range) {
      const hasLos = lineOfSight(e.x, e.y, p.x, p.y);
      let vx = dx / d, vy = dy / d;
      if (!hasLos) {
        // hug along walls: keep last dir with a drift toward player
        vx = Math.cos(e.dir) * 0.6 + vx * 0.4;
        vy = Math.sin(e.dir) * 0.6 + vy * 0.4;
        const vl = Math.hypot(vx, vy) || 1;
        vx /= vl; vy /= vl;
      } else {
        e.dir = Math.atan2(vy, vx);
      }
      // separation from other enemies
      for (const o of G.enemies) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        if (od > 0.001 && od < 0.7) { vx += (ox / od) * 0.5; vy += (oy / od) * 0.5; }
      }
      const vl = Math.hypot(vx, vy) || 1;
      const beforeX = e.x, beforeY = e.y;
      tryMove(e, (vx / vl) * st.speed * dt, (vy / vl) * st.speed * dt, 0.28);
      if (Math.abs(e.x - beforeX) + Math.abs(e.y - beforeY) < st.speed * dt * 0.2) {
        // stuck: pick a perpendicular escape direction
        e.dir += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2) + (Math.random() - 0.5);
      }
      e.walkPhase += dt * 7;
      // occasional growl
      e.soundT -= dt;
      if (e.soundT <= 0 && d < 8) { AudioSys.sfx[st.sfx](); e.soundT = 4 + Math.random() * 6; }
    } else if (e.cdT <= 0) {
      e.atkT = 0.35; // wind up
    }
  }
}

// ---------- rendering ----------
function fogLight(d, flicker) {
  let l = 1.45 / (1 + d * d * 0.10);
  l = l > 1 ? 1 : l;
  l *= flicker;
  // quantize for chunky DOS banding
  return Math.floor(l * 13) / 13;
}

function shadePix(c, l) {
  const r = ((c & 255) * l) | 0;
  const g = (((c >> 8) & 255) * l * 0.97) | 0;
  const b = (((c >> 16) & 255) * l * 0.9) | 0;
  return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function renderScene(camX, camY, camA, bobY) {
  const lvl = G.level;
  const flicker = 0.9 + 0.06 * Math.sin(G.time * 11) + 0.04 * Math.sin(G.time * 23 + 1.7);
  const horizon = (VIEW_H >> 1) + Math.round(bobY);
  const dirX = Math.cos(camA), dirY = Math.sin(camA);
  const planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;
  const posZ = 0.5 * VIEW_H;

  // --- floor & ceiling ---
  const floorTex = Textures[T_FLOOR].data, ceilTex = Textures[T_CEIL].data;
  const rd0x = dirX - planeX, rd0y = dirY - planeY;
  const rd1x = dirX + planeX, rd1y = dirY + planeY;
  for (let y = 0; y < VIEW_H; y++) {
    const p = y - horizon;
    if (p === 0) {
      const c = shadePix(rgb(20, 18, 16), 0.2);
      for (let x = 0; x < W; x++) buf[y * W + x] = c;
      continue;
    }
    const rowDist = p > 0 ? posZ / p : posZ / -p;
    const light = fogLight(rowDist, flicker);
    if (light <= 0.02) {
      for (let x = 0; x < W; x++) buf[y * W + x] = 0xFF000000;
      continue;
    }
    const stepX = rowDist * (rd1x - rd0x) / W;
    const stepY = rowDist * (rd1y - rd0y) / W;
    let fx = camX + rowDist * rd0x;
    let fy = camY + rowDist * rd0y;
    const tex = p > 0 ? floorTex : ceilTex;
    const rowOff = y * W;
    for (let x = 0; x < W; x++) {
      const tx = ((fx - Math.floor(fx)) * TEX_SIZE) | 0;
      const ty = ((fy - Math.floor(fy)) * TEX_SIZE) | 0;
      buf[rowOff + x] = shadePix(tex[ty * TEX_SIZE + tx], light);
      fx += stepX; fy += stepY;
    }
  }

  // --- walls ---
  for (let x = 0; x < W; x++) {
    const cameraX = 2 * x / W - 1;
    const rayX = dirX + planeX * cameraX;
    const rayY = dirY + planeY * cameraX;
    let mapX = camX | 0, mapY = camY | 0;
    const deltaX = Math.abs(1 / (rayX || 1e-9));
    const deltaY = Math.abs(1 / (rayY || 1e-9));
    let stepX, stepY, sideX, sideY;
    if (rayX < 0) { stepX = -1; sideX = (camX - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - camX) * deltaX; }
    if (rayY < 0) { stepY = -1; sideY = (camY - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - camY) * deltaY; }

    let side = 0, hitTex = 0, perp = 30, wallX = 0;
    for (let it = 0; it < 128; it++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= lvl.w || mapY >= lvl.h) { hitTex = T_STONE; perp = 30; break; }
      const c = lvl.map[mapY * lvl.w + mapX];
      if (c === 0) continue;
      const pd = side === 0 ? sideX - deltaX : sideY - deltaY;
      let wx = side === 0 ? camY + pd * rayY : camX + pd * rayX;
      wx -= Math.floor(wx);
      if (c === T_DOOR || c === T_DOOR_LOCKED) {
        const d = lvl.doors[mapY * lvl.w + mapX];
        const open = d ? d.open : 0;
        if (wx < open) continue; // ray slips through the opening gap
        hitTex = c; perp = pd; wallX = wx - open;
        break;
      }
      hitTex = c; perp = pd; wallX = wx;
      break;
    }
    if (perp < 0.01) perp = 0.01;
    zBuffer[x] = perp;

    const lineH = (VIEW_H / perp) | 0;
    let drawStart = horizon - (lineH >> 1);
    let drawEnd = drawStart + lineH;
    const tex = Textures[hitTex] ? Textures[hitTex].data : Textures[T_STONE].data;
    let texX = (wallX * TEX_SIZE) | 0;
    if (texX < 0) texX = 0; if (texX > TEX_SIZE - 1) texX = TEX_SIZE - 1;
    // mirror so texture isn't flipped on two faces
    const rayXpos = side === 0 && rayX > 0, rayYneg = side === 1 && rayY < 0;
    if (rayXpos || rayYneg) texX = TEX_SIZE - 1 - texX;

    let light = fogLight(perp, flicker);
    if (side === 1) light *= 0.72;

    const texStep = TEX_SIZE / lineH;
    let texPos = drawStart < 0 ? -drawStart * texStep : 0;
    if (drawStart < 0) drawStart = 0;
    if (drawEnd > VIEW_H) drawEnd = VIEW_H;
    for (let y = drawStart; y < drawEnd; y++) {
      const texY = texPos & (TEX_SIZE - 1);
      texPos += texStep;
      buf[y * W + x] = shadePix(tex[texY * TEX_SIZE + texX], light);
    }
  }

  // --- sprites ---
  const rl = [];
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  function pushSprite(x, y, frames, frameIdx, wFrac, hFrac, zOff, glow) {
    const sx = x - camX, sy = y - camY;
    const tx = invDet * (dirY * sx - dirX * sy);
    const ty = invDet * (-planeY * sx + planeX * sy);
    if (ty <= 0.15) return;
    rl.push({ ty, tx, frames, frameIdx, wFrac, hFrac, zOff, glow });
  }

  for (const t of lvl.torches) {
    const fi = ((G.time * 9 + t.phase) | 0) % 3;
    pushSprite(t.x, t.y, SPRITES.torch, fi, 0.30, 0.44, 0.38, true);
  }
  if (!lvl.hasCrown || G.crownTaken) {
    pushSprite(lvl.exit.x + 0.5, lvl.exit.y + 0.5, SPRITES.stairs, 0, 0.85, 0.9, 0, false);
  }
  for (const it of G.items) {
    const bobZ = 0.04 + Math.sin(it.bob) * 0.02;
    if (it.type === 'potion') pushSprite(it.x, it.y, SPRITES.potion, 0, 0.22, 0.24, 0.01, false);
    else if (it.type === 'gold') pushSprite(it.x, it.y, SPRITES.gold, 0, 0.26, 0.2, 0.01, false);
    else if (it.type === 'key') pushSprite(it.x, it.y, SPRITES.key, 0, 0.22, 0.24, bobZ, true);
    else if (it.type === 'crown') pushSprite(it.x, it.y, SPRITES.crown, ((G.time * 3) | 0) % 2, 0.34, 0.3, 0.15 + bobZ, true);
  }
  for (const e of G.enemies) {
    const st = ENEMY_STATS[e.type];
    let fi;
    if (e.painT > 0) fi = 3;
    else if (e.atkT > 0) fi = 2;
    else fi = ((e.walkPhase | 0) % 2);
    let zOff = 0;
    if (e.type === 'wraith') zOff = 0.06 + Math.sin(e.bob) * 0.04;
    pushSprite(e.x, e.y, SPRITES[e.type], fi, st.wFrac, st.hFrac, zOff, e.type === 'wraith');
  }

  rl.sort((a, b) => b.ty - a.ty);

  for (const s of rl) {
    const spr = s.frames[Math.min(s.frameIdx, s.frames.length - 1)];
    const fullH = VIEW_H / s.ty;
    const floorLine = horizon + fullH / 2;
    const sh = s.hFrac * fullH;
    const sw = s.wFrac * fullH * (spr.w / spr.h) * (s.hFrac / s.wFrac); // keep art aspect
    const bottom = floorLine - s.zOff * fullH;
    const top = bottom - sh;
    const cxs = (W / 2) * (1 + s.tx / s.ty);
    let x0 = Math.floor(cxs - sw / 2), x1 = Math.ceil(cxs + sw / 2);
    let light = fogLight(s.ty, flicker);
    if (s.glow) light = Math.max(light, 0.85);
    if (x1 < 0 || x0 >= W) continue;
    if (x0 < 0) x0 = 0; if (x1 > W) x1 = W;
    const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(VIEW_H, Math.ceil(bottom));
    for (let x = x0; x < x1; x++) {
      if (s.ty >= zBuffer[x]) continue;
      const u = ((x - (cxs - sw / 2)) / sw * spr.w) | 0;
      if (u < 0 || u >= spr.w) continue;
      for (let y = y0; y < y1; y++) {
        const v = ((y - top) / sh * spr.h) | 0;
        if (v < 0 || v >= spr.h) continue;
        const c = spr.data[v * spr.w + u];
        if (!(c >>> 24)) continue;
        buf[y * W + x] = shadePix(c, light);
      }
    }
  }
}

// ---------- 2D overlays ----------
function drawWeapon() {
  const p = G.player;
  let frame = 0;
  if (p.attackT > 0) {
    const t = 0.32 - p.attackT;
    frame = t < 0.08 ? 1 : (t < 0.2 ? 2 : 3);
  }
  const sway = p.moving ? Math.sin(p.bobPhase) * 7 : Math.sin(G.time * 1.4) * 2;
  const dip = p.moving ? Math.abs(Math.cos(p.bobPhase)) * 5 : 0;
  const c = WEAPON_FRAMES[frame];
  const scale = 1.8;
  const wsize = Math.round(96 * scale);
  ctx.drawImage(c, Math.round(W - 205 + sway), Math.round(VIEW_H - wsize - 4 + dip), wsize, wsize);
}

function drawIcon(name, x, y) {
  const f = SPRITES[name][0];
  if (f.canvas) ctx.drawImage(f.canvas, x, y);
}

function drawHUD() {
  const p = G.player;
  // panel
  ctx.fillStyle = '#181310';
  ctx.fillRect(0, VIEW_H, W, HUD_H);
  ctx.fillStyle = '#3a3028';
  ctx.fillRect(0, VIEW_H, W, 2);
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, H - 2, W, 2);
  // rivets
  ctx.fillStyle = '#5a4c3c';
  for (const x of [4, 314]) { ctx.fillRect(x, VIEW_H + 5, 2, 2); ctx.fillRect(x, H - 7, 2, 2); }

  // HP
  drawText(ctx, 'HP', 12, VIEW_H + 6, '#b8a890', 1);
  const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = '#3a0c0c';
  ctx.fillRect(12, VIEW_H + 16, 62, 8);
  ctx.fillStyle = hpFrac > 0.35 ? '#c02020' : '#e05010';
  ctx.fillRect(13, VIEW_H + 17, Math.round(60 * hpFrac), 6);
  drawText(ctx, String(Math.max(0, Math.ceil(p.hp))), 80, VIEW_H + 17, '#e0d0b0', 1);

  // gold
  drawIcon('gold', 112, VIEW_H + 12);
  drawText(ctx, String(p.gold), 130, VIEW_H + 17, '#e8c040', 1);

  // floor
  drawText(ctx, 'FLOOR ' + p.floor, 170, VIEW_H + 6, '#b8a890', 1);
  drawText(ctx, 'BEST ' + G.best, 170, VIEW_H + 17, '#6a6058', 1);

  // key slot
  ctx.fillStyle = '#0e0b08';
  ctx.fillRect(238, VIEW_H + 8, 20, 18);
  if (p.keys > 0) drawIcon('key', 240, VIEW_H + 9);

  // controls hint
  drawText(ctx, 'TAB MAP', 268, VIEW_H + 6, '#4a4238', 1);
  drawText(ctx, 'E USE', 268, VIEW_H + 17, '#4a4238', 1);
}

function doorHint() {
  const p = G.player;
  const fx = p.x + Math.cos(p.a) * 0.9, fy = p.y + Math.sin(p.a) * 0.9;
  const c = cellAt(fx, fy);
  if (c === T_DOOR || c === T_DOOR_LOCKED) {
    const d = G.level.doors[(fy | 0) * G.level.w + (fx | 0)];
    if (d && d.open < 0.1) {
      drawTextCentered(ctx, d.locked ? 'E - UNLOCK' : 'E - OPEN', W / 2, VIEW_H - 24, '#d0c090', 1);
    }
  }
}

function drawMessages() {
  let y = 8;
  for (const m of G.messages) {
    const alpha = clamp(m.t / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    drawTextCentered(ctx, m.text, W / 2, y, '#e8d8a8', 1);
    ctx.globalAlpha = 1;
    y += 10;
  }
}

function drawMinimap() {
  const lvl = G.level;
  const scale = Math.max(3, Math.min(5, Math.floor(150 / lvl.w)));
  const mw = lvl.w * scale, mh = lvl.h * scale;
  const ox = (W - mw) >> 1, oy = ((VIEW_H - mh) >> 1);
  ctx.fillStyle = 'rgba(8,6,4,0.92)';
  ctx.fillRect(ox - 5, oy - 5, mw + 10, mh + 10);
  ctx.fillStyle = '#6a5a40';
  ctx.fillRect(ox - 5, oy - 5, mw + 10, 1);
  ctx.fillRect(ox - 5, oy + mh + 4, mw + 10, 1);
  ctx.fillRect(ox - 5, oy - 5, 1, mh + 10);
  ctx.fillRect(ox + mw + 4, oy - 5, 1, mh + 10);
  for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) {
    if (!G.explored[y * lvl.w + x]) continue;
    const c = lvl.map[y * lvl.w + x];
    let col;
    if (c === 0) col = '#3c352a';
    else if (c === T_DOOR) col = '#a06a34';
    else if (c === T_DOOR_LOCKED) col = '#e0b020';
    else col = '#8d857a';
    ctx.fillStyle = col;
    ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    if (x === lvl.exit.x && y === lvl.exit.y && (!lvl.hasCrown || G.crownTaken)) {
      ctx.fillStyle = '#40e060';
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
  // key marker
  for (const it of G.items) {
    if (it.type === 'key' && G.explored[(it.y | 0) * lvl.w + (it.x | 0)]) {
      ctx.fillStyle = '#ffd830';
      ctx.fillRect(ox + (it.x | 0) * scale, oy + (it.y | 0) * scale, scale, scale);
    }
  }
  // enemies in explored territory
  for (const e of G.enemies) {
    if (G.explored[(e.y | 0) * lvl.w + (e.x | 0)]) {
      ctx.fillStyle = '#d02020';
      ctx.fillRect(Math.round(ox + e.x * scale) - 1, Math.round(oy + e.y * scale) - 1, 2, 2);
    }
  }
  // player arrow
  const p = G.player;
  const pxx = ox + p.x * scale, pyy = oy + p.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(pxx) - 1, Math.round(pyy) - 1, 3, 3);
  ctx.fillRect(Math.round(pxx + Math.cos(p.a) * 4) - 1, Math.round(pyy + Math.sin(p.a) * 4) - 1, 2, 2);
}

// ---------- state screens ----------
function drawVignetteOverlay(color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, VIEW_H);
  ctx.globalAlpha = 1;
}

function drawTitle() {
  // slowly rotating dungeon backdrop
  G.titleAngle += 0.0035;
  const lvl = G.level;
  renderScene(lvl.start.x + 0.5, lvl.start.y + 0.5, G.titleAngle, 0);
  ctx.putImageData(frameImg, 0, 0);
  drawVignetteOverlay('#000000', 0.55);
  ctx.fillStyle = '#0c0a08';
  ctx.fillRect(0, VIEW_H, W, HUD_H);

  const flick = 0.8 + 0.2 * Math.sin(G.time * 9) * Math.sin(G.time * 3.7);
  drawTextCentered(ctx, 'LABERINTH', W / 2, 30, '#c8a038', 4);
  drawTextCentered(ctx, 'CROWN OF THE DEEP', W / 2, 66, '#8a7040', 1);

  // torches flanking the title
  const fi = ((G.time * 9) | 0) % 3;
  const t = SPRITES.torch[fi];
  if (t.canvas) {
    ctx.drawImage(t.canvas, 44, 26, 32, 48);
    ctx.drawImage(t.canvas, 244, 26, 32, 48);
  }

  drawTextCentered(ctx, 'THE CROWN OF THE DEEP LIES LOST', W / 2, 92, '#7a7268', 1);
  drawTextCentered(ctx, 'ON THE 8TH FLOOR OF THE LABYRINTH.', W / 2, 102, '#7a7268', 1);
  drawTextCentered(ctx, 'NONE WHO SOUGHT IT HAVE RETURNED.', W / 2, 112, '#7a7268', 1);

  if (Math.sin(G.time * 4) > -0.3) {
    drawTextCentered(ctx, 'PRESS ENTER', W / 2, 136, '#e8d8a8', 1);
  }
  drawTextCentered(ctx, 'WASD MOVE  MOUSE/ARROWS TURN  SPACE/CLICK ATTACK', W / 2, 154, '#544c40', 1);
  if (G.best > 1) drawTextCentered(ctx, 'DEEPEST DELVE: FLOOR ' + G.best, W / 2, VIEW_H + 12, '#6a6058', 1);
}

function drawTransition() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const lvl = G.level;
  const a = clamp(G.transT / 0.4, 0, 1) * clamp((2.2 - G.transT) / 0.4, 0, 1);
  ctx.globalAlpha = a;
  drawTextCentered(ctx, 'FLOOR ' + lvl.floorNum, W / 2, 76, '#c8a038', 2);
  drawTextCentered(ctx, lvl.name, W / 2, 100, '#8a8078', 1);
  ctx.globalAlpha = 1;
}

function drawDead() {
  drawVignetteOverlay('#400000', 0.5);
  drawTextCentered(ctx, 'YOU HAVE PERISHED', W / 2, 48, '#e03020', 2);
  drawTextCentered(ctx, 'FLOOR ' + G.player.floor + '   GOLD ' + G.player.gold + '   KILLS ' + G.stats.kills, W / 2, 80, '#c0b090', 1);
  drawTextCentered(ctx, 'THE LABYRINTH KEEPS ITS SECRETS.', W / 2, 96, '#7a7268', 1);
  if (Math.sin(G.time * 4) > -0.3) drawTextCentered(ctx, 'PRESS ENTER TO DELVE AGAIN', W / 2, 124, '#e8d8a8', 1);
}

function drawWin() {
  drawVignetteOverlay('#302000', 0.45);
  const fi = ((G.time * 3) | 0) % 2;
  const c = SPRITES.crown[fi];
  if (c.canvas) ctx.drawImage(c.canvas, W / 2 - 30, 26, 60, 48);
  drawTextCentered(ctx, 'THE CROWN IS YOURS', W / 2, 82, '#f0c030', 2);
  drawTextCentered(ctx, 'GOLD ' + G.player.gold + '   KILLS ' + G.stats.kills, W / 2, 110, '#c0b090', 1);
  drawTextCentered(ctx, 'YET THE STAIRS DESCEND FURTHER...', W / 2, 126, '#7a7268', 1);
  if (Math.sin(G.time * 4) > -0.3) drawTextCentered(ctx, 'PRESS ENTER TO DELVE DEEPER', W / 2, 146, '#e8d8a8', 1);
}

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
  renderScene(p.x, p.y, p.a, bobY);
  let sx = 0, sy = 0;
  if (G.shakeT > 0) {
    sx = ((Math.random() * 5) | 0) - 2;
    sy = ((Math.random() * 5) | 0) - 2;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, VIEW_H);
  ctx.putImageData(frameImg, sx, sy);

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

  if (G.state === 'pause') {
    drawVignetteOverlay('#000000', 0.5);
    drawTextCentered(ctx, 'PAUSED', W / 2, 70, '#e8d8a8', 2);
    drawTextCentered(ctx, 'ESC OR ENTER TO RESUME', W / 2, 96, '#8a8078', 1);
  } else if (G.state === 'dead') {
    drawDead();
  } else if (G.state === 'win') {
    drawWin();
  }
}

// ---------- boot ----------
generateTextures(0xDEADBEEF);
generateSprites();
// backdrop level for the title screen
G.player = newPlayer();
loadFloor(1);
requestAnimationFrame(frame);
