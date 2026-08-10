// ---- game/items: item registry, 10-slot inventory, equipment ----
// An inventory slot is null or {id, n}. Equipped gear is referenced by item
// id (equipment stays in the pack), so equipping never shuffles slots.
'use strict';

const INV_SLOTS = 10;

// kind: weapon | ammo | armor | potion | tonic
//   weapon.wclass: melee | bow | staff
//   swing = overlay animation length, hitAt = time left when the blow lands,
//   frames = progress fractions at which the overlay advances a frame
const ITEMS = {
  swordBronze:  { name: 'BRONZE SWORD', kind: 'weapon', wclass: 'melee', dmg: 18, vary: 8,  cd: 0.44, reach: 1.5, swing: 0.32, hitAt: 0.20, frames: [0.25, 0.60], price: 60,  icon: 'iconSwordBronze', fp: 'swordBronze', blurb: 'A dull barracks blade' },
  swordIron:    { name: 'IRON SWORD',   kind: 'weapon', wclass: 'melee', dmg: 28, vary: 10, cd: 0.40, reach: 1.6, swing: 0.30, hitAt: 0.19, frames: [0.25, 0.60], price: 150, icon: 'iconSwordIron',   fp: 'swordIron',   blurb: 'Keen and well balanced' },
  swordSteel:   { name: 'STEEL SWORD',  kind: 'weapon', wclass: 'melee', dmg: 42, vary: 14, cd: 0.36, reach: 1.7, swing: 0.28, hitAt: 0.18, frames: [0.25, 0.60], price: 360, icon: 'iconSwordSteel',  fp: 'swordSteel',  blurb: 'Folded steel, cold to hold' },
  bow:          { name: 'HUNTING BOW',  kind: 'weapon', wclass: 'bow',   dmg: 4,  vary: 4,  cd: 0.75, swing: 0.34, hitAt: 0.15, frames: [0.55, 0.78], price: 180, icon: 'iconBow',   fp: 'bow',   blurb: 'Looses the arrows you carry' },
  staff:        { name: 'ARCANE STAFF', kind: 'weapon', wclass: 'staff', dmg: 38, vary: 10, cd: 0.65, swing: 0.34, hitAt: 0.17, frames: [0.45, 0.72], mana: 10, price: 420, icon: 'iconStaff', fp: 'staff', blurb: 'Costs 10 MP a bolt' },

  arrowBronze:  { name: 'BRONZE ARROW', kind: 'ammo', dmg: 18, vary: 6,  stack: 60, price: 2, bundle: 10, icon: 'iconArrowBronze', shot: 'shot_arrowBronze' },
  arrowIron:    { name: 'IRON ARROW',   kind: 'ammo', dmg: 28, vary: 8,  stack: 60, price: 4, bundle: 10, icon: 'iconArrowIron',   shot: 'shot_arrowIron' },
  arrowSteel:   { name: 'STEEL ARROW',  kind: 'ammo', dmg: 42, vary: 10, stack: 60, price: 8, bundle: 10, icon: 'iconArrowSteel',  shot: 'shot_arrowSteel' },

  armorLeather: { name: 'LEATHER MAIL', kind: 'armor', soak: 0.15, price: 110, icon: 'iconArmorLeather', blurb: 'Boiled hide over a jerkin' },
  armorIron:    { name: 'IRON MAIL',    kind: 'armor', soak: 0.30, price: 270, icon: 'iconArmorIron',    blurb: 'Heavy, and worth the weight' },
  armorSteel:   { name: 'STEEL PLATE',  kind: 'armor', soak: 0.45, price: 560, icon: 'iconArmorSteel',   blurb: 'Little short of a walking wall' },

  potionRed:    { name: 'CRIMSON DRAUGHT', kind: 'potion', heal: 30, stack: 9, price: 25, icon: 'iconPotionRed',  blurb: 'Tastes of iron and ash' },
  potionBlue:   { name: 'BLUE DRAUGHT',    kind: 'potion', mana: 30, stack: 9, price: 30, icon: 'iconPotionBlue', blurb: 'Cold, and faintly humming' },

  tonicHp:      { name: 'VITALITY TONIC', kind: 'tonic', maxHp: 10, price: 160, icon: 'iconTonicHp', blurb: 'Drunk the moment it is bought' },
  tonicMp:      { name: 'ARCANE TONIC',   kind: 'tonic', maxMp: 10, price: 160, icon: 'iconTonicMp', blurb: 'Drunk the moment it is bought' },
};

const ARROW_IDS = ['arrowSteel', 'arrowIron', 'arrowBronze']; // best first

function itemDef(id) { return id ? ITEMS[id] : null; }
function stackMax(id) { const d = ITEMS[id]; return (d && d.stack) || 1; }

// ---------- inventory ----------
function newInventory() { return new Array(INV_SLOTS).fill(null); }

function invCount(inv, id) {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

// add up to n; returns how many actually fit
function invAdd(inv, id, n) {
  const max = stackMax(id);
  let left = n;
  if (max > 1) {
    for (const s of inv) {
      if (left <= 0) break;
      if (!s || s.id !== id || s.n >= max) continue;
      const room = max - s.n;
      const take = Math.min(room, left);
      s.n += take; left -= take;
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i]) continue;
    const take = Math.min(max, left);
    inv[i] = { id, n: take };
    left -= take;
  }
  return n - left;
}

// take n from a specific slot; empties the slot when it runs out
function invTake(inv, slot, n) {
  const s = inv[slot];
  if (!s) return 0;
  const take = Math.min(s.n, n);
  s.n -= take;
  if (s.n <= 0) inv[slot] = null;
  return take;
}

// take n of an id from anywhere; returns how many were removed
function invRemoveId(inv, id, n) {
  let left = n;
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i] && inv[i].id === id) left -= invTake(inv, i, left);
  }
  return n - left;
}

// can n of id fit? (used before a purchase or a floor pickup)
function invRoomFor(inv, id, n) {
  const max = stackMax(id);
  let room = 0;
  for (const s of inv) {
    if (!s) room += max;
    else if (s.id === id && s.n < max) room += max - s.n;
    if (room >= n) return true;
  }
  return room >= n;
}

// ---------- equipment ----------
function equippedAs(p, id) {
  if (p.equip.weapon === id) return 'weapon';
  if (p.equip.armor === id) return 'armor';
  if (p.equip.ammo === id) return 'ammo';
  return null;
}

const SLOT_FOR_KIND = { weapon: 'weapon', armor: 'armor', ammo: 'ammo' };

function equipItem(p, id) {
  const d = ITEMS[id];
  const slot = d && SLOT_FOR_KIND[d.kind];
  if (!slot) return false;
  p.equip[slot] = id;
  return true;
}

function unequipItem(p, id) {
  const slot = equippedAs(p, id);
  if (!slot) return false;
  p.equip[slot] = null;
  return true;
}

// dropping the last of an item must not leave it "equipped"
function syncEquipment(p) {
  for (const slot of ['weapon', 'armor', 'ammo']) {
    const id = p.equip[slot];
    if (id && invCount(p.inv, id) <= 0) p.equip[slot] = null;
  }
  if (!p.equip.ammo) p.equip.ammo = bestArrow(p) || null;
}

function bestArrow(p) {
  for (const id of ARROW_IDS) if (invCount(p.inv, id) > 0) return id;
  return null;
}

function weaponDef(p) { return itemDef(p.equip.weapon); }
function armorSoak(p) { const d = itemDef(p.equip.armor); return d ? d.soak : 0; }

// arrows available for the equipped bow
function ammoCount(p) { return p.equip.ammo ? invCount(p.inv, p.equip.ammo) : 0; }

// ---------- consuming ----------
// drink/apply the item in a slot; returns a message or null when unusable
function useSlot(p, slot) {
  const s = p.inv[slot];
  const d = s && ITEMS[s.id];
  if (!d) return null;
  if (d.kind === 'potion') {
    if (d.heal) {
      if (p.hp >= p.maxHp) return 'YOU ARE UNHURT';
      p.hp = Math.min(p.maxHp, p.hp + d.heal);
      invTake(p.inv, slot, 1);
      syncEquipment(p);
      SFX.pickupPotion();
      return 'YOU DRINK THE CRIMSON DRAUGHT. +' + d.heal;
    }
    if (d.mana) {
      if (p.mp >= p.maxMp) return 'YOUR MIND IS ALREADY CLEAR';
      p.mp = Math.min(p.maxMp, p.mp + d.mana);
      invTake(p.inv, slot, 1);
      syncEquipment(p);
      SFX.pickupMana();
      return 'YOU DRINK THE BLUE DRAUGHT. +' + d.mana;
    }
  }
  return null;
}

function isUsable(id) {
  const d = ITEMS[id];
  return !!(d && d.kind === 'potion');
}

function isEquippable(id) {
  const d = ITEMS[id];
  return !!(d && SLOT_FOR_KIND[d.kind]);
}
