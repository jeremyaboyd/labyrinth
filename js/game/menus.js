// ---- game/menus: pack, quick items, and the shop window ----
// Each of these screens freezes the simulation and takes menu input; main.js
// routes keys here and draws them over the last rendered frame.
'use strict';

// ---------- shared chrome ----------
function drawPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,6,4,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6a5a40';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawRight(text, right, y, color) {
  drawText(ctx, text, right - textWidth(text, 1), y, color, 1);
}

// greedy word wrap to a pixel width, at most `max` lines
function wrapText(text, pxWide, max) {
  const words = String(text).toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && textWidth(next, 1) > pxWide) { lines.push(cur); cur = word; }
    else cur = next;
    if (lines.length === max) return lines;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, max);
}

function highlightRow(x, y, w) {
  ctx.fillStyle = 'rgba(120,92,32,0.55)';
  ctx.fillRect(x, y - 3, w, 12);
}

// ---------- opening ----------
function openInventory() {
  G.menu.sel = 0;
  G.state = 'inventory';
  Input.exitLock();
  SFX.menuMove();
}

// usable stacks, in pack order
function hotlistEntries() {
  const inv = G.player.inv;
  const out = [];
  for (let i = 0; i < inv.length; i++) {
    if (inv[i] && isUsable(inv[i].id)) out.push({ slot: i, id: inv[i].id, n: inv[i].n });
  }
  return out;
}

function openHotlist() {
  G.hot = hotlistEntries();
  if (!G.hot.length) { addMsg('NOTHING TO DRINK'); SFX.denied(); return; }
  G.menu.sel = 0;
  G.state = 'hotlist';
  Input.exitLock();
  SFX.menuMove();
}

function openShop(shop) {
  G.shop = shop;
  G.menu.sel = 0;
  G.state = 'shop';
  Input.exitLock();
  SFX.menuSelect(); // the greeting is the panel subtitle, not a floating message
}

function itemActions(slot) {
  const s = G.player.inv[slot];
  if (!s) return null;
  const acts = [];
  if (isUsable(s.id)) acts.push({ id: 'use', label: 'USE' });
  if (isEquippable(s.id)) {
    acts.push(equippedAs(G.player, s.id)
      ? { id: 'unequip', label: 'UNEQUIP' }
      : { id: 'equip', label: 'EQUIP' });
  }
  acts.push({ id: 'destroy', label: s.n > 1 ? 'DESTROY ALL ' + s.n : 'DESTROY' });
  acts.push({ id: 'cancel', label: 'CANCEL' });
  return acts;
}

function openItemAction() {
  const acts = itemActions(G.menu.sel);
  if (!acts) { SFX.denied(); return; }
  G.menu.actionSlot = G.menu.sel;
  G.menu.actions = acts;
  G.menu.actionSel = 0;
  G.state = 'itemaction';
  SFX.menuSelect();
}

// ---------- how many rows the current screen has ----------
function menuRowCount() {
  switch (G.state) {
    case 'inventory': return INV_SLOTS;
    case 'itemaction': return G.menu.actions.length;
    case 'hotlist': return G.hot.length;
    case 'shop': return G.shop.stock.length;
    default: return 0;
  }
}

function menuSelRef(dir) {
  if (G.state === 'itemaction') {
    const n = G.menu.actions.length;
    G.menu.actionSel = ((G.menu.actionSel + dir) % n + n) % n;
  } else {
    const n = menuRowCount();
    if (n > 0) G.menu.sel = ((G.menu.sel + dir) % n + n) % n;
  }
  SFX.menuMove();
}

// ---------- confirming ----------
function useHotlistEntry(i) {
  const e = G.hot[i];
  if (!e) return;
  const msg = useSlot(G.player, e.slot);
  if (!msg) { SFX.denied(); return; }
  addMsg(msg);
  G.hot = hotlistEntries();
  if (!G.hot.length) { G.state = 'play'; return; }
  if (G.menu.sel >= G.hot.length) G.menu.sel = G.hot.length - 1;
}

function confirmItemAction() {
  const p = G.player;
  const slot = G.menu.actionSlot;
  const act = G.menu.actions[G.menu.actionSel];
  const s = p.inv[slot];
  if (!act || !s) { G.state = 'inventory'; return; }
  if (act.id === 'use') {
    const msg = useSlot(p, slot);
    if (msg) addMsg(msg); else SFX.denied();
  } else if (act.id === 'equip') {
    equipItem(p, s.id);
    addMsg('EQUIPPED ' + ITEMS[s.id].name);
    SFX.equip();
  } else if (act.id === 'unequip') {
    unequipItem(p, s.id);
    addMsg('PUT AWAY ' + ITEMS[s.id].name);
    SFX.equip();
  } else if (act.id === 'destroy') {
    const name = ITEMS[s.id].name;
    p.inv[slot] = null;
    syncEquipment(p);
    addMsg('YOU CAST ASIDE THE ' + name);
    SFX.denied();
  } else {
    SFX.menuMove();
  }
  G.state = 'inventory';
}

function confirmShopBuy() {
  const res = buyLine(G.shop, G.menu.sel);
  addMsg(res.msg);
  if (!res.ok) SFX.denied();
}

// ---------- drawing ----------
function slotRowY(i) { return 22 + i * 13; }

function drawInventory() {
  const p = G.player;
  drawVignetteOverlay('#000000', 0.62);
  drawPanel(6, 4, W - 12, VIEW_H - 12);
  drawTextCentered(ctx, 'YOUR PACK', W / 2, 8, '#c8a038', 1);
  ctx.fillStyle = '#3a3028';
  ctx.fillRect(172, 18, 1, VIEW_H - 40);

  for (let i = 0; i < INV_SLOTS; i++) {
    const y = slotRowY(i);
    const s = p.inv[i];
    if (i === G.menu.sel) highlightRow(10, y, 158);
    if (!s) {
      drawText(ctx, '-- EMPTY --', 30, y, '#3f3a32', 1);
      continue;
    }
    const d = ITEMS[s.id];
    const worn = equippedAs(p, s.id);
    drawIcon(d.icon, 14, y - 2, 11);
    drawText(ctx, d.name, 30, y, worn ? '#ffe080' : '#b8ac98', 1);
    if (s.n > 1) drawRight('X' + s.n, 166, y, '#8a8078');
    else if (worn) drawRight('*', 166, y, '#ffe080');
  }

  // worn gear and the details of whatever is selected
  let ry = 22;
  drawText(ctx, 'IN HAND', 180, ry, '#6a6058', 1); ry += 10;
  const w = weaponDef(p);
  drawText(ctx, w ? w.name : 'BARE FISTS', 184, ry, '#e0d0b0', 1); ry += 14;
  drawText(ctx, 'WORN', 180, ry, '#6a6058', 1); ry += 10;
  const ar = itemDef(p.equip.armor);
  drawText(ctx, ar ? ar.name : 'NOTHING', 184, ry, '#e0d0b0', 1); ry += 14;
  drawText(ctx, 'QUIVER', 180, ry, '#6a6058', 1); ry += 10;
  const am = itemDef(p.equip.ammo);
  drawText(ctx, am ? am.name + ' X' + ammoCount(p) : 'EMPTY', 184, ry, '#e0d0b0', 1); ry += 16;

  ctx.fillStyle = '#3a3028';
  ctx.fillRect(180, ry - 6, 120, 1);
  const sel = p.inv[G.menu.sel];
  if (sel) {
    const d = ITEMS[sel.id];
    drawText(ctx, d.name, 180, ry, '#c8a038', 1); ry += 11;
    for (const lineText of itemStatLines(d)) { drawText(ctx, lineText, 184, ry, '#8a8078', 1); ry += 9; }
    if (d.blurb) {
      for (const lineText of wrapText(d.blurb, 126, 2)) { drawText(ctx, lineText, 184, ry, '#5f584e', 1); ry += 9; }
    }
  }

  drawText(ctx, 'GOLD ' + p.gold, 12, VIEW_H - 18, '#e8c040', 1);
  drawRight('ENTER ACTIONS   I OR ESC CLOSE', W - 12, VIEW_H - 18, '#544c40');
}

// short stat readout shown in the pack and the shop
function itemStatLines(d) {
  const out = [];
  if (d.kind === 'weapon') {
    if (d.wclass === 'bow') out.push('USES ARROWS');
    else out.push('DMG ' + d.dmg + '-' + (d.dmg + d.vary));
    if (d.mana) out.push('COSTS ' + d.mana + ' MP');
    out.push('SPEED ' + Math.round(10 / d.cd) / 10 + ' HIT/S');
  } else if (d.kind === 'ammo') {
    out.push('DMG ' + d.dmg + '-' + (d.dmg + d.vary));
  } else if (d.kind === 'armor') {
    out.push('SOAKS ' + Math.round(d.soak * 100) + ' PCT');
  } else if (d.kind === 'potion') {
    if (d.heal) out.push('HEALS ' + d.heal + ' HP');
    if (d.mana) out.push('RESTORES ' + d.mana + ' MP');
  } else if (d.kind === 'tonic') {
    if (d.maxHp) out.push('MAX HP +' + d.maxHp);
    if (d.maxMp) out.push('MAX MP +' + d.maxMp);
  }
  return out;
}

function drawItemAction() {
  drawInventory();
  const acts = G.menu.actions;
  const s = G.player.inv[G.menu.actionSlot];
  const h = acts.length * 12 + 22;
  const x = 96, y = Math.round((VIEW_H - h) / 2), w = 128;
  drawPanel(x, y, w, h);
  drawTextCentered(ctx, s ? ITEMS[s.id].name : '', x + w / 2, y + 6, '#c8a038', 1);
  acts.forEach((a, i) => {
    const ry = y + 18 + i * 12;
    if (i === G.menu.actionSel) highlightRow(x + 4, ry, w - 8);
    drawTextCentered(ctx, a.label, x + w / 2, ry, i === G.menu.actionSel ? '#ffe080' : '#8a8078', 1);
  });
}

function drawHotlist() {
  const p = G.player;
  drawVignetteOverlay('#000000', 0.55);
  const rows = G.hot.length;
  const h = 30 + rows * 14 + 14;
  const x = 74, y = Math.round((VIEW_H - h) / 2), w = 172;
  drawPanel(x, y, w, h);
  drawTextCentered(ctx, 'QUICK ITEMS', x + w / 2, y + 7, '#c8a038', 1);
  G.hot.forEach((e, i) => {
    const ry = y + 26 + i * 14;
    if (i === G.menu.sel) highlightRow(x + 5, ry, w - 10);
    const d = ITEMS[e.id];
    drawIcon(d.icon, x + 8, ry - 3, 12);
    drawText(ctx, (i + 1) + '. ' + d.name, x + 24, ry, i === G.menu.sel ? '#ffe080' : '#b8ac98', 1);
    drawRight('X' + e.n, x + w - 8, ry, '#8a8078');
  });
  drawTextCentered(ctx, 'ENTER DRINK   Q OR ESC CLOSE', x + w / 2, y + h - 11, '#544c40', 1);
  drawText(ctx, 'HP ' + Math.ceil(p.hp) + '/' + p.maxHp + '   MP ' + Math.floor(p.mp) + '/' + p.maxMp,
    x + 8, y + 16, '#6a6058', 1);
}

function drawShop() {
  const p = G.player;
  const shop = G.shop;
  drawVignetteOverlay('#000000', 0.62);
  drawPanel(10, 6, W - 20, VIEW_H - 16);
  drawTextCentered(ctx, SHOP_TITLE[shop.kind], W / 2, 12, '#c8a038', 1);
  drawTextCentered(ctx, SHOP_GREETING[shop.kind], W / 2, 24, '#6a6058', 1);
  ctx.fillStyle = '#3a3028';
  ctx.fillRect(18, 34, W - 36, 1);

  shop.stock.forEach((ln, i) => {
    const y = 42 + i * 14;
    const d = ITEMS[ln.id];
    if (i === G.menu.sel) highlightRow(16, y, W - 32);
    const out = ln.n <= 0;
    const dim = out || p.gold < ln.price;
    drawIcon(d.icon, 20, y - 3, 12);
    drawText(ctx, d.name + (ln.bundle > 1 ? ' X' + ln.bundle : ''), 38, y,
      out ? '#4a4238' : (i === G.menu.sel ? '#ffe080' : '#b8ac98'), 1);
    drawRight(out ? 'SOLD OUT' : ln.price + ' G', W - 24, y, out ? '#5a3030' : (dim ? '#7a5a28' : '#e8c040'));
    if (!out && ln.n > 1) drawRight('X' + ln.n, W - 74, y, '#6a6058');
  });

  const sel = shop.stock[G.menu.sel];
  if (sel) {
    const d = ITEMS[sel.id];
    let y = VIEW_H - 46;
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(18, y - 6, W - 36, 1);
    drawText(ctx, itemStatLines(d).join('   '), 20, y, '#8a8078', 1);
    if (d.blurb) drawText(ctx, d.blurb, 20, y + 10, '#5f584e', 1);
  }
  drawText(ctx, 'GOLD ' + p.gold, 20, VIEW_H - 20, '#e8c040', 1);
  drawRight('ENTER BUY   ESC LEAVE', W - 24, VIEW_H - 20, '#544c40');
}
