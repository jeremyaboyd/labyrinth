// ---- game/quests: the journal, and what the king wants of you ----
// A quest the player holds lives in p.quests.log keyed by id:
//   { done: bool, revealed: n }  -- revealed is how many step lines are known.
// Only one quest is active at a time; p.quests.active holds its id.
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
  return { active: null, log: {} };
}

function questEntry(p, id) { return p.quests && p.quests.log[id]; }
function questHeld(p, id) { return !!questEntry(p, id); }
function questDone(p, id) { const e = questEntry(p, id); return !!(e && e.done); }

// take on a quest; it becomes active if nothing else is
function questGrant(p, id, msg) {
  if (!QUESTS[id] || questHeld(p, id)) return false;
  p.quests.log[id] = { done: false, revealed: 1 };
  if (!p.quests.active) p.quests.active = id;
  if (msg !== false) addMsg('NEW QUEST: ' + QUESTS[id].name);
  SFX.quest();
  return true;
}

// let another line of the story be read in the journal
function questReveal(p, id, upTo) {
  const e = questEntry(p, id);
  if (!e) return;
  e.revealed = clamp(Math.max(e.revealed, upTo), 1, QUESTS[id].steps.length);
}

function questComplete(p, id) {
  const e = questEntry(p, id);
  if (!e || e.done) return false;
  e.done = true;
  e.revealed = QUESTS[id].steps.length;
  if (p.quests.active === id) p.quests.active = null;
  addMsg('QUEST COMPLETE: ' + QUESTS[id].name);
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
  return ids.map(id => ({ id, def: QUESTS[id], entry: p.quests.log[id] }));
}

function activeQuestDef(p) {
  const id = p.quests && p.quests.active;
  return id ? QUESTS[id] : null;
}

// where the active quest points, on this floor only
function questMarker(p) {
  const id = p.quests && p.quests.active;
  if (!id || questDone(p, id)) return null;
  const def = QUESTS[id];
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

function villagerDialogue(v) {
  return { name: 'VILLAGER', lines: VILLAGER_LINES[v.line % VILLAGER_LINES.length] };
}
