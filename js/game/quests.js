// ---- game/quests: the journal, the king's story, and villagers' errands ----
// A quest the player holds lives in p.quests.log keyed by id:
//   { done: bool, revealed: n }  -- revealed is how many step lines are known.
// Only one quest is active at a time; p.quests.active holds its id.
// Story quests live in the static QUESTS table; fetch errands are rolled at
// talk time and their defs ride along in p.quests.defs so they survive saves.
'use strict';

const QUESTS = {
  audience: {
    name: 'AN AUDIENCE WITH THE KING',
    hint: 'SEEK THE KING',
    from: 'A ROYAL SUMMONS',
    steps: [
      'THE KING HAS CALLED YOU TO HIS CASTLE.',
      'TAKE THE ROAD WEST, THEN NORTH TO THE GATE.',
      'THE WAY IN IS THE GAP IN THE SOUTH WALL.',
      'YOU HAVE STOOD BEFORE THE KING.',
    ],
    marker: { floor: 0, x: 14, y: 13 },
  },
  crown: {
    name: 'THE CROWN OF THE DEEP',
    hint: 'BRING BACK THE CROWN',
    from: 'THE KING',
    steps: [
      'THE KING BIDS YOU RECOVER THE LOST CROWN.',
      'IT LIES ON FLOOR ' + CROWN_FLOOR + ', THE THRONE OF THE DEEP.',
      'THE STAIR DOWN IS IN THE CASTLE COURTYARD.',
      'THE CROWN IS YOURS.',
    ],
    marker: null, // resolved from the crown itself once you are on its floor
  },
};

function newQuestLog() {
  return { active: null, log: {}, defs: {}, seq: 0 };
}

// static story quests, then the designer's own, then errands rolled this run
function questDef(p, id) {
  return QUESTS[id] || DESIGNER_QUESTS[id]
    || (p.quests && p.quests.defs && p.quests.defs[id]) || null;
}

function questEntry(p, id) { return p.quests && p.quests.log[id]; }
function questHeld(p, id) { return !!questEntry(p, id); }
function questDone(p, id) { const e = questEntry(p, id); return !!(e && e.done); }

// take on a story quest; it becomes active if nothing else is
function questGrant(p, id, msg) {
  if (!QUESTS[id] || questHeld(p, id)) return false;
  p.quests.log[id] = { done: false, revealed: 1 };
  if (!p.quests.active) p.quests.active = id;
  if (msg !== false) addMsg('NEW QUEST: ' + QUESTS[id].name);
  SFX.quest();
  return true;
}

// take on a rolled errand: the def itself is carried in the log
function questGrantDynamic(p, def) {
  if (!p.quests.defs) p.quests.defs = {};
  p.quests.defs[def.id] = def;
  p.quests.log[def.id] = { done: false, revealed: 2, carrying: false };
  if (!p.quests.active) p.quests.active = def.id;
  // floors lay their keepsakes out on load; if the errand points at the floor
  // we are already standing on, it has to be laid out here and now
  if (def.kind === 'fetch' && def.item.floor === p.floor) {
    G.items.push({ type: 'quest', qid: def.id, x: def.item.x + 0.5, y: def.item.y + 0.5, bob: Math.random() * 10 });
  }
  addMsg('NEW QUEST: ' + def.name);
  SFX.quest();
}

// let another line of the story be read in the journal
function questReveal(p, id, upTo) {
  const e = questEntry(p, id);
  const def = questDef(p, id);
  if (!e || !def) return;
  e.revealed = clamp(Math.max(e.revealed, upTo), 1, def.steps.length);
}

function questComplete(p, id) {
  const e = questEntry(p, id);
  const def = questDef(p, id);
  if (!e || e.done || !def) return false;
  e.done = true;
  e.revealed = def.steps.length;
  if (p.quests.active === id) p.quests.active = null;
  addMsg('QUEST COMPLETE: ' + def.name);
  SFX.questDone();
  return true;
}

function questSetActive(p, id) {
  if (!questHeld(p, id) || questDone(p, id)) return false;
  p.quests.active = id;
  return true;
}

// unfinished first, then completed; stable within each group
function questList(p) {
  const ids = Object.keys(p.quests.log);
  ids.sort((a, b) => (questDone(p, a) ? 1 : 0) - (questDone(p, b) ? 1 : 0));
  return ids.map(id => ({ id, def: questDef(p, id), entry: p.quests.log[id] }));
}

function activeQuestDef(p) {
  const id = p.quests && p.quests.active;
  return id ? questDef(p, id) : null;
}

// where the active quest points, on this floor only
function questMarker(p) {
  const id = p.quests && p.quests.active;
  if (!id || questDone(p, id)) return null;
  const def = questDef(p, id);
  if (!def) return null;
  if (def.kind === 'fetch') {
    const e = questEntry(p, id);
    if (e.carrying) {
      // homeward: the marker follows the villager who asked
      if (p.floor !== 0) return null;
      const g = G.npcs[def.giver];
      return g ? { floor: 0, x: g.x | 0, y: g.y | 0 } : null;
    }
    // errand floors mean the surface or the castle descent, no other realm
    const here = def.item.floor === 0 ? p.floor === 0
      : p.realm === 'castle' && def.item.floor === p.floor;
    return here ? { floor: p.floor, x: def.item.x, y: def.item.y } : null;
  }
  if (def.kind === 'relic' || def.kind === 'slay' || def.kind === 'exterminate') {
    const e = questEntry(p, id);
    if (e.carrying) {
      // homeward: the marker follows whoever asked
      if (p.floor !== 0) return null;
      const g = def.giver === 'king' ? G.npcs.find(n => n.role === 'king') : G.npcs[def.giver];
      return g ? { floor: 0, x: g.x | 0, y: g.y | 0 } : null;
    }
    if (p.floor === 0) {
      // point at the way in
      const portal = G.portals[def.portal];
      return portal ? { floor: 0, x: portal.x, y: portal.y } : null;
    }
    if (p.realm === def.portal) {
      // inside: the relic on the ground, the boss who carries it, or --
      // for an extermination -- whatever still moves
      const it = G.items.find(i => i.type === 'relic' && i.qid === id);
      if (it) return { floor: p.floor, x: it.x | 0, y: it.y | 0 };
      if (def.kind === 'slay') {
        const boss = G.enemies.find(en => en.qid === id);
        if (boss) return { floor: p.floor, x: boss.x | 0, y: boss.y | 0 };
      }
      if (def.kind === 'exterminate') {
        let best = null, bestD = Infinity;
        for (const en of G.enemies) {
          const d = Math.abs(en.x - p.x) + Math.abs(en.y - p.y);
          if (d < bestD) { bestD = d; best = en; }
        }
        if (best) return { floor: p.floor, x: best.x | 0, y: best.y | 0 };
      }
    }
    return null;
  }
  if (def.marker) return def.marker.floor === p.floor ? def.marker : null;
  if (id === 'crown') {
    const it = G.items.find(i => i.type === 'crown');
    if (it) return { floor: p.floor, x: it.x | 0, y: it.y | 0 };
  }
  return null;
}

// ---------- story beats ----------
function questsOnNewGame(p) {
  p.quests = newQuestLog();
  // a custom world tells its own story through designer quests; the royal
  // summons belongs to the stock Kingshore and points at its castle
  if (typeof CustomData !== 'undefined' && CustomData.world()) return;
  questGrant(p, 'audience', false);
}

// the king's own words, and what they set in motion
function kingDialogue(p) {
  if (!questDone(p, 'audience')) {
    return {
      name: 'THE KING',
      lines: [
        'SO. YOU ANSWERED THE SUMMONS.',
        'A CROWN WAS TAKEN FROM THIS HOUSE, AND',
        'CARRIED DOWN INTO THE LABYRINTH BELOW US.',
        'EIGHT FLOORS DOWN, IF THE OLD MAPS HOLD.',
        'BRING IT BACK AND NAME YOUR REWARD.',
      ],
      onEnd: () => {
        questReveal(p, 'audience', 4);
        questComplete(p, 'audience');
        questGrant(p, 'crown');
        questReveal(p, 'crown', 3);
      },
    };
  }
  if (questHeld(p, 'crown') && !questDone(p, 'crown')) {
    return {
      name: 'THE KING',
      lines: ['THE STAIR IS BEHIND ME. THE CROWN IS BELOW.', 'DO NOT COME BACK EMPTY HANDED.'],
    };
  }
  return { name: 'THE KING', lines: ['THE CROWN IS HOME. THE REALM THANKS YOU.'] };
}

// ---------- the designer's quests: a relic in a realm, a reward for it ----------
// Rebuilt from the world definition whenever the surface is built, so they
// need no place in a save: only the player's log entry travels.
let DESIGNER_QUESTS = {};

// each kind's journal steps and its hint, written around the thing wanted
const DESIGNER_KINDS = {
  relic: (thing) => ({
    hint: 'FIND ' + thing,
    steps: [
      'FIND ' + thing + '.',
      'IT LIES IN THE DEPTHS. SEEK THE WAY IN.',
      'YOU HAVE IT. CARRY IT BACK.',
      'RETURNED. THE PROMISE WAS KEPT.',
    ],
  }),
  slay: (thing) => ({
    hint: 'TAKE ' + thing,
    steps: [
      'A WITCH MUST DIE. SEEK HER LAIR.',
      'HER MINIONS WARD HER: FELL THEM FIRST.',
      'SHE IS DEAD. CARRY ' + thing + ' BACK.',
      'DELIVERED. THE PROMISE WAS KEPT.',
    ],
  }),
  exterminate: () => ({
    hint: 'KILL EVERY LAST ONE',
    steps: [
      'VERMIN. KILL EVERY LAST ONE OF THEM.',
      'THE WAY IN IS MARKED. LEAVE NONE ALIVE.',
      'CLEARED OUT. GO AND SAY SO.',
      'DONE, AND PAID FOR.',
    ],
  }),
};

function buildDesignerQuests(list) {
  DESIGNER_QUESTS = {};
  for (const q of list || []) {
    if (!q || !q.id || q.giver == null || !q.portal) continue;
    const id = 'dq_' + q.id;
    const kind = DESIGNER_KINDS[q.kind] ? q.kind : 'relic';
    const thing = (q.thing || 'THE LOST RELIC').toUpperCase();
    const name = (q.name || thing).toUpperCase();
    const shape = DESIGNER_KINDS[kind](thing);
    DESIGNER_QUESTS[id] = {
      id, kind,
      name,
      hint: shape.hint,
      from: q.giver === 'king' ? 'THE KING' : 'A VILLAGER',
      thing,
      // the giver is a villager's index, or the king himself
      giver: q.giver === 'king' ? 'king' : q.giver | 0,
      portal: q.portal,
      boss: kind === 'slay' ? (q.boss || 'witch') : null,
      reward: q.reward || {},
      // a designer may write the giver's own words; each is an array of lines
      lines: q.lines || null,
      steps: shape.steps,
    };
  }
}

// how a reward reads when it is being promised
function rewardText(reward) {
  const parts = [];
  if (reward.gold) parts.push(reward.gold + ' GOLD');
  if (reward.item && ITEMS[reward.item]) parts.push(ITEMS[reward.item].name);
  if (reward.key && G.portals[reward.key]) parts.push('THE KEY TO ' + G.portals[reward.key].name);
  return parts.length ? parts.join(' AND ') : 'MY THANKS';
}

function grantQuestReward(p, def) {
  const r = def.reward || {};
  if (r.gold) { p.gold += r.gold; SFX.pickupGold(); }
  if (r.item && ITEMS[r.item]) {
    if (invRoomFor(p.inv, r.item, 1)) {
      invAdd(p.inv, r.item, 1);
      addMsg('RECEIVED ' + ITEMS[r.item].name);
    } else {
      // no room: it waits on the ground at your feet, like any drop
      G.items.push({ type: 'item', item: r.item, x: p.x, y: p.y, bob: 0 });
      addMsg('YOUR PACK IS FULL - IT LIES AT YOUR FEET');
    }
  }
  if (r.key && G.portals[r.key]) {
    if (!p.portalKeys.includes(r.key)) p.portalKeys.push(r.key);
    addMsg('THE WAY INTO ' + G.portals[r.key].name + ' IS OPEN');
    SFX.unlock();
  }
}

// where a relic lies: the far end of a finite dungeon's last floor, or --
// in a mine, whose far end is just the other mouth -- the open cell farthest
// from both mouths, so the delve cuts into the dark either way
function relicSpotFor(lvl) {
  if (!lvl.isMine) return { x: lvl.exit.x, y: lvl.exit.y };
  let best = null, bestScore = -1;
  for (let y = 1; y < lvl.h - 1; y++) {
    for (let x = 1; x < lvl.w - 1; x++) {
      if (lvl.map[y * lvl.w + x] !== 0) continue;
      const s = Math.min(
        Math.abs(x - lvl.start.x) + Math.abs(y - lvl.start.y),
        Math.abs(x - lvl.exit.x) + Math.abs(y - lvl.exit.y));
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
  }
  return best || { x: lvl.exit.x, y: lvl.exit.y };
}

// the floor of a realm where its prizes lie: a mine's single level, or a
// finite dungeon's deepest floor. An endless dungeon has no such floor.
function realmPrizeFloor(portal) {
  return portal.kind === 'mine' ? 1 : (portal.floors > 0 ? portal.floors : -1);
}

// called by loadFloor: lay out whatever a held quest owes this floor of this
// realm -- a relic on the ground, or a boss carrying it
function layQuestRelic(lvl, realm, n) {
  const p = G.player;
  if (!realm || !p || !p.quests) return;
  const portal = G.portals[realm];
  if (!portal || n !== realmPrizeFloor(portal)) return;
  for (const id in DESIGNER_QUESTS) {
    const def = DESIGNER_QUESTS[id];
    if (def.portal !== realm || def.kind === 'exterminate') continue;
    const e = questEntry(p, id);
    if (!e || e.done || e.carrying) continue;
    const spot = relicSpotFor(lvl);
    if (def.kind === 'slay') {
      // the prize walks: a boss carrying it, warded by her own minions
      const boss = makeEnemy(def.boss, spot.x + 0.5, spot.y + 0.5);
      boss.qid = id;
      boss.ward = 'skeleton';
      G.enemies.push(boss);
    } else {
      G.items.push({ type: 'relic', qid: id, x: spot.x + 0.5, y: spot.y + 0.5, bob: Math.random() * 10 });
    }
  }
}

// called whenever an enemy falls: an exterminate quest is fulfilled the
// moment its realm has nothing left alive in it
function checkExterminateQuests() {
  const p = G.player;
  if (!p || !p.quests || !G.realm || G.enemies.length) return;
  for (const id in DESIGNER_QUESTS) {
    const def = DESIGNER_QUESTS[id];
    if (def.kind !== 'exterminate' || def.portal !== G.realm) continue;
    const e = questEntry(p, id);
    if (!e || e.done || e.carrying) continue;
    e.carrying = true; // nothing to carry but the news
    questReveal(p, id, 3);
    addMsg('EVERY LAST ONE. GO AND CLAIM YOUR DUE.');
    SFX.questDone();
  }
}

// picking the relic up off the ground
function relicPickup(p, qid) {
  const def = questDef(p, qid);
  const e = questEntry(p, qid);
  if (!def || !e || e.carrying) return;
  e.carrying = true;
  questReveal(p, qid, 3);
  addMsg('YOU FOUND ' + def.thing);
  SFX.quest();
}

// the giver's designer quest that still wants something of the player.
// The giver is a villager matched by index, or the king matched by role.
function designerQuestFromGiver(p, v) {
  const who = v.role === 'king' ? 'king' : v.line;
  for (const id in DESIGNER_QUESTS) {
    if (DESIGNER_QUESTS[id].giver === who && !questDone(p, id)) return id;
  }
  return null;
}

// what the giver says: the offer, the reminder, or the handover. A designer
// may have written the giver's own words; otherwise each kind has stock ones.
function designerQuestTalk(p, v, qid) {
  const def = DESIGNER_QUESTS[qid];
  const name = villagerName(v);
  const where = G.portals[def.portal] ? G.portals[def.portal].name : 'THE DEPTHS';
  const said = (key, fallback) =>
    (def.lines && Array.isArray(def.lines[key]) && def.lines[key].length) ? def.lines[key] : fallback;
  if (!questHeld(p, qid)) {
    const stock = def.kind === 'slay' ? [
      'A WITCH LAIRS IN ' + where + '.',
      'HER MINIONS WARD HER: FELL THEM FIRST.',
      'BRING ME ' + def.thing + ' SHE CARRIES AND',
      rewardText(def.reward) + ' IS YOURS.',
    ] : def.kind === 'exterminate' ? [
      'VERMIN HAVE TAKEN ' + where + '.',
      'KILL EVERY LAST ONE OF THEM.',
      'DO THAT AND ' + rewardText(def.reward) + ' IS YOURS.',
    ] : [
      'I NEED ' + def.thing + '.',
      'IT LIES IN ' + where + '.',
      'BRING IT BACK AND ' + rewardText(def.reward) + ' IS YOURS.',
    ];
    return {
      name,
      lines: said('offer', stock),
      onEnd: () => {
        p.quests.log[qid] = { done: false, revealed: 2, carrying: false };
        if (!p.quests.active) p.quests.active = qid;
        addMsg('NEW QUEST: ' + def.name);
        SFX.quest();
      },
    };
  }
  if (questEntry(p, qid).carrying) {
    const stock = def.kind === 'exterminate'
      ? ['NOT ONE LEFT? YOU ARE A WONDER.', 'AS PROMISED: ' + rewardText(def.reward) + '.']
      : ['YOU HAVE IT! ' + def.thing + '!', 'AS PROMISED: ' + rewardText(def.reward) + '.'];
    return {
      name,
      lines: said('done', stock),
      onEnd: () => { grantQuestReward(p, def); questComplete(p, qid); },
    };
  }
  const stock = def.kind === 'exterminate'
    ? ['STILL SCRATCHING IN ' + where + '.', 'EVERY LAST ONE, REMEMBER.']
    : ['ANY SIGN OF ' + def.thing + '?', 'IT LIES IN ' + where + '.'];
  return { name, lines: said('remind', stock) };
}

const VILLAGER_LINES = [
  ['GOOD DAY TO YOU, DELVER.'],
  ['THEY SAY THE STAIR UNDER THE CASTLE', 'GOES DOWN FOREVER.'],
  ['MY BROTHER WENT BELOW. THAT WAS SPRING.'],
  ['THE LAMPS LIGHT THEMSELVES AT DUSK.', 'NOBODY KNOWS WHO TENDS THEM.'],
  ['BUY SOMETHING FROM THE WINDOWS BELOW.', 'GOLD IS NO USE TO THE DEAD.'],
];

const VILLAGER_NAMES = ['MARA', 'TOMM', 'ELSBETH', 'BRAN', 'HILDA', 'OSRIC', 'WENNA'];

function villagerName(v) {
  if (v.role === 'king') return 'THE KING';
  return VILLAGER_NAMES[v.line % VILLAGER_NAMES.length];
}

function villagerDialogue(v) {
  return { name: villagerName(v), lines: VILLAGER_LINES[v.line % VILLAGER_LINES.length] };
}

// ---------- villagers' errands: go and fetch ----------
const TRINKETS = [
  { thing: 'A SILVER LOCKET', qname: 'THE LOST LOCKET', hint: 'FIND THE LOCKET' },
  { thing: 'A CARVED BONE PIPE', qname: 'THE CARVED PIPE', hint: 'FIND THE PIPE' },
  { thing: 'A TARNISHED RING', qname: "A MOTHER'S RING", hint: 'FIND THE RING' },
  { thing: 'A TIN SOLDIER', qname: 'THE TIN SOLDIER', hint: 'FIND THE SOLDIER' },
  { thing: 'A BRASS SPYGLASS', qname: 'THE BRASS SPYGLASS', hint: 'FIND THE SPYGLASS' },
  { thing: 'A WEDDING SHAWL', qname: 'THE WEDDING SHAWL', hint: 'FIND THE SHAWL' },
];

const FETCH_CAP = 3; // outstanding errands at once, so the journal stays sane

function fetchOutstanding(p) {
  let n = 0;
  for (const id in p.quests.log) {
    const def = questDef(p, id);
    if (def && def.kind === 'fetch' && !p.quests.log[id].done) n++;
  }
  return n;
}

// the giver's own outstanding errand, if they have one
function fetchFromGiver(p, v) {
  for (const id in p.quests.log) {
    const def = questDef(p, id);
    if (def && def.kind === 'fetch' && def.giver === v.line && !p.quests.log[id].done) return id;
  }
  return null;
}

// a walkable spot on the given floor, well away from where the player enters.
// The layout regenerates deterministically, so building it here to pick a cell
// gives exactly the cell the player will find when they walk in.
function fetchSpot(floor) {
  const lvl = floor === 0 ? buildOverworld() : generateDungeon(floor, (G.baseSeed + floor * 7919) >>> 0);
  // flood out from the entrance so the keepsake never lands in a sealed pocket
  const pass = (c) => c === 0 || c === T_DOOR || c === T_DOOR_LOCKED;
  const seen = new Uint8Array(lvl.w * lvl.h);
  const q = [lvl.start.y * lvl.w + lvl.start.x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % lvl.w, y = (i / lvl.w) | 0;
    for (const [dx, dy] of ADJ) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= lvl.w || ny >= lvl.h) continue;
      const j = ny * lvl.w + nx;
      if (!seen[j] && pass(lvl.map[j])) { seen[j] = 1; q.push(j); }
    }
  }
  for (let tries = 0; tries < 400; tries++) {
    const x = 1 + ((Math.random() * (lvl.w - 2)) | 0);
    const y = 1 + ((Math.random() * (lvl.h - 2)) | 0);
    const i = y * lvl.w + x;
    if (lvl.map[i] !== 0 || !seen[i]) continue;
    if (Math.hypot(x - lvl.start.x, y - lvl.start.y) < 8) continue;
    return { x, y };
  }
  return { x: lvl.exit.x, y: lvl.exit.y }; // desperate fallback: by the stairs
}

function makeFetchQuest(p, v) {
  const t = TRINKETS[(Math.random() * TRINKETS.length) | 0];
  // half the errands stay under the sky; the rest went below with somebody.
  // Nothing is hidden deeper than one floor past your deepest, the same bound
  // the stairwell holds you to. A world without the castle's endless descent
  // keeps every errand under the sky.
  const floor = Math.random() < 0.5 || !G.portals.castle
    ? 0
    : 1 + ((Math.random() * clamp(realmState('castle').deepest + 1, 1, CROWN_FLOOR)) | 0);
  const spot = fetchSpot(floor);
  const reward = 40 + floor * 30 + ((Math.random() * 20) | 0);
  const name = villagerName(v);
  const where = floor === 0 ? 'SOMEWHERE ABOUT ' + G.surfaceName : 'ON FLOOR ' + floor + ' OF THE LABYRINTH';
  p.quests.seq = (p.quests.seq || 0) + 1;
  return {
    id: 'fetch' + p.quests.seq,
    kind: 'fetch',
    name: t.qname,
    hint: t.hint,
    from: name + ' OF ' + G.surfaceName,
    thing: t.thing,
    reward,
    giver: v.line,
    item: { floor, x: spot.x, y: spot.y },
    steps: [
      name + ' ASKS YOU TO FIND ' + t.thing + '.',
      'IT WAS LOST ' + where + '.',
      'YOU HAVE IT. BRING IT BACK TO ' + name + '.',
      'RETURNED, FOR ' + reward + ' GOLD.',
    ],
    marker: null, // resolved from the item, or the giver, in questMarker
  };
}

// picking the keepsake up off the ground
function fetchPickup(p, qid) {
  const def = questDef(p, qid);
  const e = questEntry(p, qid);
  if (!def || !e || e.carrying) return;
  e.carrying = true;
  questReveal(p, qid, 3);
  addMsg('YOU FOUND ' + def.thing);
  SFX.quest();
}

// what a villager has to say when you TALK: their errand first, then perhaps
// a new one, else small talk
function villagerTalk(v) {
  const p = G.player;
  const name = villagerName(v);
  // a villager the designer gave a quest speaks of nothing else until it
  // is finished
  const dqid = designerQuestFromGiver(p, v);
  if (dqid) return designerQuestTalk(p, v, dqid);
  const qid = fetchFromGiver(p, v);
  if (qid) {
    const def = questDef(p, qid);
    if (questEntry(p, qid).carrying) {
      return {
        name,
        lines: ['YOU FOUND IT! OH, BLESS YOU, DELVER.', 'HERE - ' + def.reward + ' GOLD, AS PROMISED.'],
        onEnd: () => { p.gold += def.reward; questComplete(p, qid); SFX.pickupGold(); },
      };
    }
    return {
      name,
      lines: ['ANY SIGN OF ' + def.thing + '?',
        def.item.floor === 0 ? 'IT IS SOMEWHERE ABOUT ' + G.surfaceName + '.' : 'IT WAS CARRIED DOWN TO FLOOR ' + def.item.floor + '.'],
    };
  }
  if (fetchOutstanding(p) < FETCH_CAP && Math.random() < 0.45) {
    const def = makeFetchQuest(p, v);
    return {
      name,
      lines: [
        'I LOST ' + def.thing + ', AND IT PAINS ME.',
        def.item.floor === 0 ? 'IT IS SOMEWHERE ABOUT ' + G.surfaceName + '.' : 'IT WAS CARRIED DOWN TO FLOOR ' + def.item.floor + '.',
        'BRING IT BACK AND ' + def.reward + ' GOLD IS YOURS.',
      ],
      onEnd: () => questGrantDynamic(p, def),
    };
  }
  return villagerDialogue(v);
}
