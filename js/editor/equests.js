// ---- editor/equests: quests, and the chain they hang the world on ----
// A quest is a villager, a place, a prize and a promise: the giver asks for
// a relic from a dungeon or a mine, and pays in gold, an item, or the key
// to a sealed portal. Keys are how a designer opens the world up one delve
// at a time: finish the small dungeon, be handed the way into the mine.
'use strict';

function questRewardSummary(q) {
  const parts = [];
  const r = q.reward || {};
  if (r.gold) parts.push(r.gold + ' GOLD');
  if (r.item && ITEMS[r.item]) parts.push(ITEMS[r.item].name);
  if (r.key) {
    const portal = ED.draft.world.portals.find(p => p.id === r.key);
    parts.push('KEY TO ' + (portal ? portal.name : '?'));
  }
  return parts.join(' + ') || 'NOTHING';
}

function refreshQuestPanel() {
  const body = document.querySelector('#quests-table tbody');
  if (!body) return;
  body.textContent = '';
  const world = ED.draft.world;

  for (const q of world.quests) {
    const tr = document.createElement('tr');
    const td = () => { const t = document.createElement('td'); tr.append(t); return t; };

    const name = document.createElement('input');
    name.type = 'text';
    name.value = q.name || '';
    name.placeholder = 'QUEST NAME';
    name.onchange = () => { q.name = name.value.toUpperCase(); commit(); };
    td().append(name);

    // what shape the asking takes
    const kind = document.createElement('select');
    for (const [v, label] of [['relic', 'FETCH'], ['slay', 'SLAY WITCH'], ['exterminate', 'CLEAR OUT']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      o.selected = (q.kind || 'relic') === v;
      kind.append(o);
    }
    kind.onchange = () => { q.kind = kind.value; commit(); };
    td().append(kind);

    const thing = document.createElement('input');
    thing.type = 'text';
    thing.value = q.thing || '';
    thing.placeholder = 'THE LOST RELIC';
    thing.onchange = () => { q.thing = thing.value.toUpperCase(); commit(); };
    td().append(thing);

    // the giver: any villager named by index and place, or the king himself
    const giver = document.createElement('select');
    if (world.king) {
      const o = document.createElement('option');
      o.value = 'king';
      o.textContent = 'THE KING @' + world.king[0] + ',' + world.king[1];
      o.selected = q.giver === 'king';
      giver.append(o);
    }
    world.villagers.forEach((v, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = 'VILLAGER ' + i + ' @' + v[0] + ',' + v[1];
      o.selected = q.giver === i;
      giver.append(o);
    });
    giver.onchange = () => { q.giver = giver.value === 'king' ? 'king' : giver.value | 0; commit(); };
    td().append(giver);

    // where the relic lies -- somewhere with a bottom, never a boat
    const portal = document.createElement('select');
    for (const p of world.portals) {
      if (p.id === 'castle' || p.kind === 'boat') continue; // the castle belongs to the crown
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      o.selected = q.portal === p.id;
      portal.append(o);
    }
    portal.onchange = () => { q.portal = portal.value; commit(); };
    td().append(portal);

    // the promise
    const gold = document.createElement('input');
    gold.type = 'number'; gold.min = 0; gold.max = 9999;
    gold.value = (q.reward && q.reward.gold) || 0;
    gold.onchange = () => { q.reward = q.reward || {}; q.reward.gold = clamp(gold.value | 0, 0, 9999) || undefined; commit(); };
    td().append(gold);

    const item = document.createElement('select');
    const none = document.createElement('option');
    none.value = ''; none.textContent = 'NO ITEM';
    item.append(none);
    for (const id in ITEMS) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = ITEMS[id].name;
      o.selected = !!(q.reward && q.reward.item === id);
      item.append(o);
    }
    item.onchange = () => { q.reward = q.reward || {}; q.reward.item = item.value || undefined; commit(); };
    td().append(item);

    const key = document.createElement('select');
    const noKey = document.createElement('option');
    noKey.value = ''; noKey.textContent = 'NO KEY';
    key.append(noKey);
    for (const p of world.portals) {
      if (p.id === 'castle') continue;
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = 'KEY TO ' + p.name;
      o.selected = !!(q.reward && q.reward.key === p.id);
      key.append(o);
    }
    key.onchange = () => { q.reward = q.reward || {}; q.reward.key = key.value || undefined; commit(); };
    td().append(key);

    // the giver's own words, three speeches of a few lines each
    const words = document.createElement('button');
    words.textContent = q.lines ? 'WORDS +' : 'WORDS';
    words.onclick = () => {
      wordsTr.classList.toggle('hidden');
    };
    td().append(words);

    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'DEL';
    del.onclick = () => {
      world.quests = world.quests.filter(o => o !== q);
      markDirty();
      refreshQuestPanel();
      validateWorld();
    };
    td().append(del);

    function commit() {
      markDirty();
      refreshQuestPanel();
      validateWorld();
    }

    body.append(tr);

    // a second, folded row: what the giver says when offering, reminding,
    // and paying up. One line of dialogue per line of text; empty = stock.
    const wordsTr = document.createElement('tr');
    wordsTr.className = 'quest-words hidden';
    const wtd = document.createElement('td');
    wtd.colSpan = 10;
    for (const [key, label] of [['offer', 'THE OFFER'], ['remind', 'THE REMINDER'], ['done', 'THE PAYOFF']]) {
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'LEAVE EMPTY FOR STOCK WORDS';
      ta.value = (q.lines && q.lines[key] || []).join('\n');
      ta.onchange = () => {
        const lines = ta.value.toUpperCase().split('\n').map(s => s.trim()).filter(Boolean);
        q.lines = q.lines || {};
        if (lines.length) q.lines[key] = lines;
        else delete q.lines[key];
        if (!Object.keys(q.lines).length) q.lines = null;
        markDirty();
        validateWorld();
      };
      wtd.append(lbl, ta);
    }
    wordsTr.append(wtd);
    body.append(wordsTr);
  }
}

function initQuests() {
  document.getElementById('btn-add-quest').onclick = () => {
    const world = ED.draft.world;
    const targets = world.portals.filter(p => p.id !== 'castle' && p.kind !== 'boat');
    if (!targets.length) { alert('ADD A DUNGEON OR A MINE FIRST'); return; }
    if (!world.villagers.length && !world.king) { alert('THE WORLD NEEDS SOMEBODY TO ASK'); return; }
    const id = allocQuestId();
    world.quests.push({
      id,
      kind: 'relic',
      name: 'THE ERRAND ' + id.slice(1).toUpperCase(),
      thing: 'THE LOST RELIC',
      giver: world.villagers.length ? 0 : 'king',
      portal: targets[0].id,
      reward: { gold: 100 },
    });
    markDirty();
    refreshQuestPanel();
    validateWorld();
  };
  refreshQuestPanel();
}
