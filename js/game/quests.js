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

// static story quests first, then any errand rolled during this run
function questDef(p, id) {
  return QUESTS[id] || (p.quests && p.quests.defs && p.quests.defs[id]) || null;
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
    return def.item.floor === p.floor ? { floor: p.floor, x: def.item.x, y: def.item.y } : null;
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
  // the stairwell holds you to.
  const floor = Math.random() < 0.5
    ? 0
    : 1 + ((Math.random() * clamp(G.deepest + 1, 1, CROWN_FLOOR)) | 0);
  const spot = fetchSpot(floor);
  const reward = 40 + floor * 30 + ((Math.random() * 20) | 0);
  const name = villagerName(v);
  const where = floor === 0 ? 'SOMEWHERE ABOUT KINGSHORE' : 'ON FLOOR ' + floor + ' OF THE LABYRINTH';
  p.quests.seq = (p.quests.seq || 0) + 1;
  return {
    id: 'fetch' + p.quests.seq,
    kind: 'fetch',
    name: t.qname,
    hint: t.hint,
    from: name + ' OF KINGSHORE',
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
        def.item.floor === 0 ? 'IT IS SOMEWHERE ABOUT KINGSHORE.' : 'IT WAS CARRIED DOWN TO FLOOR ' + def.item.floor + '.'],
    };
  }
  if (fetchOutstanding(p) < FETCH_CAP && Math.random() < 0.45) {
    const def = makeFetchQuest(p, v);
    return {
      name,
      lines: [
        'I LOST ' + def.thing + ', AND IT PAINS ME.',
        def.item.floor === 0 ? 'IT IS SOMEWHERE ABOUT KINGSHORE.' : 'IT WAS CARRIED DOWN TO FLOOR ' + def.item.floor + '.',
        'BRING IT BACK AND ' + def.reward + ' GOLD IS YOURS.',
      ],
      onEnd: () => questGrantDynamic(p, def),
    };
  }
  return villagerDialogue(v);
}
