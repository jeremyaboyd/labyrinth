// ---- game/ui: weapon overlay, HUD, minimap, messages, state screens ----
'use strict';

function drawWeapon() {
  const p = G.player;
  const w = weaponDef(p);
  const set = w && WEAPON_FRAMES[w.fp];
  if (!set) return; // bare handed
  let frame = 0;
  if (p.attackT > 0) {
    const prog = 1 - clamp(p.attackT / w.swing, 0, 1);
    frame = prog < w.frames[0] ? 1 : (prog < w.frames[1] ? 2 : 3);
  }
  const sway = p.moving ? Math.sin(p.bobPhase) * 7 : Math.sin(G.time * 1.4) * 2;
  const dip = p.moving ? Math.abs(Math.cos(p.bobPhase)) * 5 : 0;
  const scale = 1.8;
  const wsize = Math.round(96 * scale);
  ctx.drawImage(set[frame], Math.round(W - 205 + sway), Math.round(VIEW_H - wsize - 4 + dip), wsize, wsize);
}

function drawIcon(name, x, y, size) {
  const list = SPRITES[name];
  const f = list && list[0];
  if (!f || !f.canvas) return;
  if (size) ctx.drawImage(f.canvas, x, y, size, size);
  else ctx.drawImage(f.canvas, x, y);
}

// small labelled meter used for HP and MP
function drawMeter(label, x, y, frac, fill, back, value) {
  drawText(ctx, label, x, y + 1, '#b8a890', 1);
  ctx.fillStyle = back;
  ctx.fillRect(x + 16, y, 52, 8);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 17, y + 1, Math.round(50 * clamp(frac, 0, 1)), 6);
  drawText(ctx, value, x + 72, y + 1, '#e0d0b0', 1);
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
  for (const x of [4, 314]) { ctx.fillRect(x, VIEW_H + 5, 2, 2); ctx.fillRect(x, H - 8, 2, 2); }

  const hpFrac = p.hp / p.maxHp;
  drawMeter('HP', 8, VIEW_H + 4, hpFrac, hpFrac > 0.35 ? '#c02020' : '#e05010', '#3a0c0c',
    String(Math.max(0, Math.ceil(p.hp))));
  drawMeter('MP', 8, VIEW_H + 18, p.mp / p.maxMp, '#2050c8', '#0c1436', String(Math.floor(p.mp)));

  // purse and quiver
  drawIcon('gold', 104, VIEW_H + 2);
  drawText(ctx, String(p.gold), 122, VIEW_H + 7, '#e8c040', 1);
  if (p.equip.ammo) {
    drawIcon(ITEMS[p.equip.ammo].icon, 104, VIEW_H + 20);
    drawText(ctx, String(ammoCount(p)), 122, VIEW_H + 25, '#c8b898', 1);
  }

  // what is in hand and on the back
  const w = weaponDef(p), ar = itemDef(p.equip.armor);
  drawText(ctx, w ? w.name : 'BARE FISTS', 156, VIEW_H + 5, '#b8a890', 1);
  drawText(ctx, ar ? ar.name : 'NO ARMOUR', 156, VIEW_H + 19, ar ? '#9aa2b0' : '#5a5248', 1);

  // depth
  drawText(ctx, 'FLOOR ' + p.floor, 248, VIEW_H + 5, '#b8a890', 1);
  drawText(ctx, 'BEST ' + G.best, 248, VIEW_H + 19, '#6a6058', 1);

  // key slot
  ctx.fillStyle = '#0e0b08';
  ctx.fillRect(298, VIEW_H + 3, 18, 18);
  if (p.keys > 0) drawIcon('key', 299, VIEW_H + 4);

  // the hint row doubles as a status line while a full panel is up
  const latest = G.messages[G.messages.length - 1];
  if (latest && PANEL_STATES.includes(G.state)) {
    drawText(ctx, latest.text, 8, VIEW_H + 31, '#c8b070', 1);
  } else {
    drawText(ctx, 'M MAP  E USE  I PACK  Q QUICK  TAB MENU', 8, VIEW_H + 31, '#4a4238', 1);
  }
}

// prompt for whatever the player is standing in front of
function useHint() {
  const p = G.player;
  const lvl = G.level;
  const fx = p.x + Math.cos(p.a) * 0.9, fy = p.y + Math.sin(p.a) * 0.9;
  const c = cellAt(lvl, fx, fy);
  let hint = null;
  if (c === T_DOOR || c === T_DOOR_LOCKED) {
    const d = lvl.doors[(fy | 0) * lvl.w + (fx | 0)];
    if (d && d.open < 0.1) hint = d.locked ? 'E - UNLOCK' : 'E - OPEN';
  } else if (shopKindAt(c)) {
    const shop = shopAtCell(lvl, fx, fy);
    if (shop && (p.x | 0) === shop.fx && (p.y | 0) === shop.fy) hint = 'E - ' + SHOP_TITLE[shop.kind];
  }
  // sits above the shop plaque rather than across it
  if (hint) drawTextCentered(ctx, hint, W / 2, VIEW_H - 44, '#d0c090', 1);
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
    else if (c === T_SHOP_POTION) col = '#a060d0';
    else if (c === T_SHOP_WEAPON) col = '#d05030';
    else if (c === T_SHOP_ARMOR) col = '#50a0d0';
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

// vertical menu list with a '>' selector
function drawMenuItems(items, sel, yStart, spacing) {
  items.forEach((label, i) => {
    const y = yStart + i * spacing;
    if (i === sel) {
      drawTextCentered(ctx, '> ' + label + ' <', W / 2, y, '#ffe080', 1);
    } else {
      drawTextCentered(ctx, label, W / 2, y, '#8a8078', 1);
    }
  });
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function slotLabel(i, d) {
  if (!d) return 'SLOT ' + (i + 1) + ' - EMPTY';
  const dt = new Date(d.t);
  return 'SLOT ' + (i + 1) + ' - FLOOR ' + d.floor + ' - GOLD ' + d.player.gold + ' - ' + MONTHS[dt.getMonth()] + ' ' + dt.getDate();
}

// slot picker over a dark panel (used by both load and save screens)
function drawSlotMenu(title, slots, sel) {
  drawVignetteOverlay('#000000', 0.6);
  ctx.fillStyle = 'rgba(8,6,4,0.9)';
  ctx.fillRect(30, 40, W - 60, 92);
  ctx.fillStyle = '#6a5a40';
  ctx.fillRect(30, 40, W - 60, 1);
  ctx.fillRect(30, 131, W - 60, 1);
  ctx.fillRect(30, 40, 1, 92);
  ctx.fillRect(W - 31, 40, 1, 92);
  drawTextCentered(ctx, title, W / 2, 50, '#c8a038', 1);
  slots.forEach((d, i) => {
    const y = 68 + i * 14;
    const label = slotLabel(i, d);
    if (i === sel) drawTextCentered(ctx, '> ' + label + ' <', W / 2, y, '#ffe080', 1);
    else drawTextCentered(ctx, label, W / 2, y, d ? '#8a8078' : '#4a4238', 1);
  });
  drawTextCentered(ctx, 'ENTER/E SELECT   TAB BACK', W / 2, 118, '#544c40', 1);
}

// rotating dungeon backdrop + logo, shared by title and load screens
function drawTitleBase() {
  G.titleAngle += 0.0035;
  const lvl = G.level;
  renderWorldView(lvl.start.x + 0.5, lvl.start.y + 0.5, G.titleAngle, 0);
  ctx.putImageData(view.frameImg, 0, 0);
  drawVignetteOverlay('#000000', 0.55);
  ctx.fillStyle = '#0c0a08';
  ctx.fillRect(0, VIEW_H, W, HUD_H);

  drawTextCentered(ctx, 'LABYRINTH', W / 2, 30, '#c8a038', 4);
  drawTextCentered(ctx, 'CROWN OF THE DEEP', W / 2, 66, '#8a7040', 1);

  // torches flanking the title
  const fi = ((G.time * 9) | 0) % 3;
  const t = SPRITES.torch[fi];
  if (t.canvas) {
    ctx.drawImage(t.canvas, 44, 26, 32, 48);
    ctx.drawImage(t.canvas, 244, 26, 32, 48);
  }
}

function drawTitle() {
  drawTitleBase();

  drawTextCentered(ctx, 'THE CROWN OF THE DEEP LIES LOST', W / 2, 80, '#7a7268', 1);
  drawTextCentered(ctx, 'ON THE 8TH FLOOR OF THE LABYRINTH.', W / 2, 90, '#7a7268', 1);
  drawTextCentered(ctx, 'NONE WHO SOUGHT IT HAVE RETURNED.', W / 2, 100, '#7a7268', 1);

  drawMenuItems(G.menu.items, G.menu.sel, 114, 12);

  drawTextCentered(ctx, 'WASD MOVE   MOUSE OR ARROWS TURN   SHIFT RUN', W / 2, VIEW_H + 5, '#544c40', 1);
  drawTextCentered(ctx, 'SPACE ATTACK   E USE   I PACK   Q QUICK   M MAP', W / 2, VIEW_H + 16, '#544c40', 1);
  if (G.best > 1) drawTextCentered(ctx, 'DEEPEST DELVE: FLOOR ' + G.best, W / 2, VIEW_H + 28, '#6a6058', 1);
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
  if (Math.sin(G.time * 4) > -0.3) drawTextCentered(ctx, 'PRESS ENTER OR E', W / 2, 124, '#e8d8a8', 1);
}

function drawWin() {
  drawVignetteOverlay('#302000', 0.45);
  const fi = ((G.time * 3) | 0) % 2;
  const c = SPRITES.crown[fi];
  if (c.canvas) ctx.drawImage(c.canvas, W / 2 - 30, 26, 60, 48);
  drawTextCentered(ctx, 'THE CROWN IS YOURS', W / 2, 82, '#f0c030', 2);
  drawTextCentered(ctx, 'GOLD ' + G.player.gold + '   KILLS ' + G.stats.kills, W / 2, 110, '#c0b090', 1);
  drawTextCentered(ctx, 'YET THE STAIRS DESCEND FURTHER...', W / 2, 126, '#7a7268', 1);
  if (Math.sin(G.time * 4) > -0.3) drawTextCentered(ctx, 'PRESS ENTER OR E TO DELVE DEEPER', W / 2, 146, '#e8d8a8', 1);
}

function drawPause() {
  drawVignetteOverlay('#000000', 0.5);
  drawTextCentered(ctx, 'PAUSED', W / 2, 52, '#e8d8a8', 2);
  drawMenuItems(G.menu.items, G.menu.sel, 82, 13);
  drawTextCentered(ctx, 'TAB RESUME', W / 2, 138, '#544c40', 1);
}

// same box as the slot picker, so the two feel like siblings
function drawOptions() {
  drawVignetteOverlay('#000000', 0.6);
  drawPanel(30, 40, W - 60, 92);
  drawTextCentered(ctx, 'OPTIONS', W / 2, 50, '#c8a038', 1);
  drawMenuItems(G.menu.items, G.menu.sel, 74, 16);
  drawTextCentered(ctx, 'ENTER/E TOGGLE   TAB BACK', W / 2, 118, '#544c40', 1);
}
