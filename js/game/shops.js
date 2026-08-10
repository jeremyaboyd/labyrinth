// ---- game/shops: window-shop stock tables and buying ----
// Stock is rolled from the level's seeded rng, so a save only has to remember
// how many of each line are left; the lines themselves regenerate.
'use strict';

const SHOP_TITLE = { potion: 'THE APOTHECARY', weapon: 'THE WEAPONSMITH', armor: 'THE ARMOURER' };
const SHOP_GREETING = {
  potion: 'DRAUGHTS FOR THE DEEP, DELVER.',
  weapon: 'STEEL PARTS FLESH. GOLD PARTS STEEL.',
  armor: 'BUY MY PLATE OR BUY A GRAVE.',
};

// which tier a floor is selling
function tierOf(floorNum) {
  if (floorNum <= 2) return 0;
  if (floorNum <= 4) return 1;
  return 2;
}

const SWORDS = ['swordBronze', 'swordIron', 'swordSteel'];
const ARROWS = ['arrowBronze', 'arrowIron', 'arrowSteel'];
const ARMORS = ['armorLeather', 'armorIron', 'armorSteel'];

// a stock line is {id, n, price, bundle}
function line(id, n, rng) {
  const d = ITEMS[id];
  const bundle = d.bundle || 1;
  // small per-shop haggle so two shops never feel identical
  const price = Math.max(1, Math.round(d.price * bundle * (0.92 + rng() * 0.2)));
  return { id, n, price, bundle };
}

function makeShopStock(kind, floorNum, rng) {
  const t = tierOf(floorNum);
  const stock = [];
  if (kind === 'weapon') {
    stock.push(line(SWORDS[t], 1, rng));
    if (t < 2 && rng() < 0.45) stock.push(line(SWORDS[t + 1], 1, rng)); // a taste of the next tier
    if (floorNum >= 2) stock.push(line('bow', 1, rng));
    if (floorNum >= 4) stock.push(line('staff', 1, rng));
    stock.push(line(ARROWS[t], 2 + rngInt(rng, 0, 2), rng));
    if (t > 0 && rng() < 0.6) stock.push(line(ARROWS[t - 1], 3, rng));
  } else if (kind === 'armor') {
    stock.push(line(ARMORS[t], 1, rng));
    if (t < 2 && rng() < 0.45) stock.push(line(ARMORS[t + 1], 1, rng));
    if (t > 0) stock.push(line(ARMORS[t - 1], 1, rng));
    stock.push(line('potionRed', 1 + rngInt(rng, 0, 1), rng));
  } else {
    stock.push(line('potionRed', 2 + rngInt(rng, 0, 2), rng));
    stock.push(line('tonicHp', 1, rng));
    // mana is dead weight until the staff shows up on floor 4
    if (floorNum >= 3) stock.push(line('potionBlue', 1 + rngInt(rng, 0, 2), rng));
    if (floorNum >= 4) stock.push(line('tonicMp', 1, rng));
  }
  return stock;
}

// Buy one line. Returns {ok, msg} — the message is always worth showing.
function buyLine(shop, idx) {
  const p = G.player;
  const ln = shop.stock[idx];
  if (!ln) return { ok: false, msg: 'NOTHING THERE' };
  if (ln.n <= 0) return { ok: false, msg: 'SOLD OUT' };
  if (p.gold < ln.price) return { ok: false, msg: 'NOT ENOUGH GOLD' };

  const d = ITEMS[ln.id];
  if (d.kind === 'tonic') {
    p.gold -= ln.price;
    ln.n--;
    if (d.maxHp) { p.maxHp += d.maxHp; p.hp += d.maxHp; }
    if (d.maxMp) { p.maxMp += d.maxMp; p.mp += d.maxMp; }
    SFX.buy();
    return { ok: true, msg: 'YOU DRAIN THE TONIC. ' + (d.maxHp ? 'MAX HP' : 'MAX MP') + ' +' + (d.maxHp || d.maxMp) };
  }

  const qty = ln.bundle || 1;
  if (!invRoomFor(p.inv, ln.id, qty)) return { ok: false, msg: 'YOUR PACK IS FULL' };
  p.gold -= ln.price;
  ln.n--;
  invAdd(p.inv, ln.id, qty);
  // first weapon/armor of its kind arms itself; arrows arm the empty ammo slot
  if (d.kind === 'weapon' && !p.equip.weapon) equipItem(p, ln.id);
  if (d.kind === 'armor' && !p.equip.armor) equipItem(p, ln.id);
  if (d.kind === 'ammo' && !p.equip.ammo) equipItem(p, ln.id);
  SFX.buy();
  return { ok: true, msg: 'BOUGHT ' + (qty > 1 ? qty + ' ' : '') + d.name };
}
