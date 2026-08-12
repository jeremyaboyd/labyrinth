#!/usr/bin/env node
// ---- tools/make-custom-game: bakes the shipped adventure into custom-data.js ----
// The first custom game, "The Sundered Shore": shipwrecked on an island, through
// the Hollow Mine to Ashford, the king's true crown from the Old Keep, a booked
// ferry to the capitol, the witch of the Westwood, the Treasure Vault, the North
// Mine, and a storeroom full of rats. Run with:  node tools/make-custom-game.js
//
// The output is exactly the object the game consumes as window.CUSTOM -- the
// same shape the level designer saves as its draft -- so the shipped world and
// a designer's world walk in through the same door.
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- the glyph legend (stock tile ids from js/game/tiles.js) ----------
const LEGEND = {
  'M': [20, 102], // mountain on grass
  '~': [27, 104], // sea
  's': [0, 103],  // sand
  '.': [0, 102],  // grass
  't': [25, 102], // tree
  'r': [0, 105],  // road
  'H': [21, 102], // cottage wall
  'W': [22, 102], // cottage window
  'D': [23, 102], // cottage door
  'C': [24, 106], // keep/hall wall on courtyard
  'y': [0, 106],  // courtyard
  'L': [26, 102], // lamp post
};
function isOpen(ch) { return ch === 's' || ch === '.' || ch === 'r' || ch === 'y'; }

// ---------- the canvas ----------
const W = 120, H = 100;
const grid = [];
for (let y = 0; y < H; y++) grid.push(new Array(W).fill('M'));

const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? grid[y][x] : 'M';
const set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = ch; };
function rect(x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch);
}
function ellipse(cx, cy, rx, ry, ch, inner) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) set(x, y, inner && d <= 0.62 ? inner : ch);
    }
  }
}
// a cottage: the same 5x4 the stock world builds, door on the south face
function cottage(x, y) {
  const art = ['HWHWH', 'WHHHW', 'HHHHH', 'HWDWH'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) set(x + c, y + r, art[r][c]);
}
// a keep or hall: castle walls around a courtyard, one gate on the south
function hall(x0, y0, x1, y1, gateX) {
  rect(x0, y0, x1, y1, 'y');
  for (let x = x0; x <= x1; x++) { set(x, y0, 'C'); set(x, y1, 'C'); }
  for (let y = y0; y <= y1; y++) { set(x0, y, 'C'); set(x1, y, 'C'); }
  set(gateX, y1, 'y'); // the gap in the wall
}
function road(points) {
  // orthogonal legs between waypoints, drawn cell by cell
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i];
    while (x !== tx) { set(x, y, 'r'); x += Math.sign(tx - x); }
    while (y !== ty) { set(x, y, 'r'); y += Math.sign(ty - y); }
    set(tx, ty, 'r');
  }
}
// deterministic scatter, so every run of this script bakes the same world
let rngState = 0xC0FFEE;
function rng() {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function scatterTrees(x0, y0, x1, y1, density) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (at(x, y) === '.' && rng() < density) set(x, y, 't');
    }
  }
}

// ================= THE WORLD =================

// ---- the sea: a south-west ocean and the strait that splits the land ----
rect(0, 56, 47, 99, '~');
rect(46, 14, 57, 95, '~');

// ---- the island: a small beach, a mountain, and a mine on the mountain ----
ellipse(22, 80, 15, 13, 's', '.');
rect(14, 60, 30, 72, 'M');       // the island's mountain...
rect(18, 50, 27, 60, 'M');       // ...climbing into the range as an isthmus
rect(16, 73, 28, 74, '.');       // a clear walk along the mountain's foot
set(22, 73, '.'); // the Hollow Mine's island mouth stands here
scatterTrees(14, 75, 30, 84, 0.08);
rect(17, 85, 27, 91, 's');       // the beach the wreck washed onto
const MOUTH_ISLAND = [22, 73];
const START = { x: 22, y: 88, a: -1.5708 }; // washed up on the south beach, facing the mountain

// ---- Ashford: the village on the other side of the mountain ----
rect(8, 24, 43, 45, '.');        // the village bowl; mountains all around it
rect(42, 24, 45, 45, 's');       // its eastern shore
cottage(12, 28); cottage(19, 28); cottage(12, 40); cottage(19, 40);
rect(24, 34, 30, 38, 'y');       // the market square the king stands in
road([[27, 39], [27, 44]]);      // lane south, toward the mine
road([[24, 36], [10, 36]]);      // lane west, between the cottages
road([[30, 36], [43, 36], [43, 38], [46, 38]]); // lane east, onto the pier
set(45, 38, 'r'); set(46, 38, 'r'); // the pier reaches into the strait
hall(33, 26, 39, 31, 36);        // the Old Keep, east of town
set(11, 35, 'L'); set(31, 39, 'L'); set(41, 37, 'L');
set(27, 45, '.');                // the Hollow Mine's Ashford mouth
scatterTrees(8, 24, 43, 45, 0.05);
const MOUTH_ASHFORD = [27, 45];
const KING = [27, 36];
const KEEP_SPOT = [36, 28];      // the way down, inside the keep's court
const DOCK_ASHFORD = [46, 38];

// ---- the capitol: a large city, a forest, a cave, a vault, a mine ----
rect(58, 28, 114, 78, '.');      // the city's land
rect(58, 28, 60, 78, 's');       // its western shore
road([[56, 46], [60, 46]]);      // the pier it keeps
set(56, 46, 'r'); set(57, 46, 'r');
const DOCK_CAPITOL = [56, 46];
// the Westwood, and the witch's cave in its rocks
scatterTrees(62, 32, 78, 74, 0.34);
rect(64, 52, 70, 57, 'M');       // the outcrop
rect(63, 58, 71, 60, '.');       // clear ground at the cave mouth
set(67, 58, '.');
const CAVE_SPOT = [67, 58];
// the city proper
rect(90, 48, 100, 56, 'y');      // the great plaza
hall(90, 40, 100, 47, 95);       // the hall of the mayor
const VAULT_SPOT = [95, 43];     // the treasure vault, under the hall
cottage(80, 32); cottage(104, 32); cottage(78, 50); cottage(104, 50);
cottage(84, 62); cottage(96, 64); cottage(104, 62); cottage(88, 30);
road([[60, 46], [78, 46], [78, 52], [90, 52]]);  // dock road into the plaza
road([[100, 52], [108, 52], [108, 60], [98, 60], [98, 57]]); // east lanes
road([[86, 60], [86, 57]]);
road([[95, 57], [95, 60], [86, 60]]);
road([[95, 39], [95, 28]]);      // the north road, to the mine in the range
set(89, 47, 'L'); set(101, 47, 'L'); set(89, 57, 'L'); set(101, 57, 'L');
set(61, 45, 'L'); set(79, 51, 'L'); set(96, 61, 'L');
set(95, 27, '.');                // the North Mine's capitol mouth
const MOUTH_NORTH_CAPITOL = [95, 27];

// ---- the mining village, past the northern range ----
rect(80, 3, 110, 12, '.');
hall(92, 4, 98, 8, 95);          // the village hall
const STOREROOM_SPOT = [95, 6];  // and its storeroom, below
cottage(84, 5); cottage(101, 5);
road([[86, 10], [104, 10]]);
road([[95, 9], [95, 12]]);
set(87, 10, 'L'); set(103, 10, 'L');
set(95, 12, '.');                // the North Mine's village mouth
const MOUTH_NORTH_VILLAGE = [95, 12];

// ---------- the people ----------
// Ashford keeps five villagers, the capitol ten (the first is the mayor),
// the mining village four (the first cries about the rats).
const VILLAGERS = [
  [25, 37], [29, 35], [26, 41], [31, 37], [14, 35],                    // 0-4 Ashford
  [95, 50],                                                            // 5 the mayor
  [92, 52], [98, 52], [91, 54], [100, 50], [85, 58],                   // 6-10 capitol
  [105, 58], [95, 61], [82, 48], [107, 55],                            // 11-14 capitol
  [95, 10], [88, 9], [100, 9], [93, 11],                               // 15-18 mining village
];
const MAYOR = 5, RATCRIER = 15;

// ---------- the ways off the surface ----------
const PORTALS = [
  { id: 'hollowmine', kind: 'mine', name: 'THE HOLLOW MINE',
    x: MOUTH_ISLAND[0], y: MOUTH_ISLAND[1],
    exit: { x: MOUTH_ASHFORD[0], y: MOUTH_ASHFORD[1] } },
  { id: 'oldkeep', kind: 'dungeon', name: 'THE OLD KEEP', floors: 2,
    x: KEEP_SPOT[0], y: KEEP_SPOT[1] },
  { id: 'ferry', kind: 'boat', name: 'THE FERRY', locked: true,
    x: DOCK_ASHFORD[0], y: DOCK_ASHFORD[1],
    exit: { x: DOCK_CAPITOL[0], y: DOCK_CAPITOL[1] } },
  { id: 'westwood', kind: 'dungeon', name: 'THE WESTWOOD CAVE', floors: 1,
    x: CAVE_SPOT[0], y: CAVE_SPOT[1],
    enemies: { rat: 0, skeleton: 6, wraith: 0 } },
  { id: 'vault', kind: 'dungeon', name: 'THE TREASURE VAULT', floors: 3, locked: true,
    x: VAULT_SPOT[0], y: VAULT_SPOT[1],
    prize: 'northmine' },
  { id: 'northmine', kind: 'mine', name: 'THE NORTH MINE', locked: true,
    x: MOUTH_NORTH_CAPITOL[0], y: MOUTH_NORTH_CAPITOL[1],
    exit: { x: MOUTH_NORTH_VILLAGE[0], y: MOUTH_NORTH_VILLAGE[1] } },
  { id: 'storeroom', kind: 'dungeon', name: 'THE STOREROOM', floors: 1,
    x: STOREROOM_SPOT[0], y: STOREROOM_SPOT[1],
    enemies: { rat: 12, skeleton: 0, wraith: 0 } },
];

// ---------- the story, quest by quest ----------
// Every line must live within the game's 5x7 font: A-Z 0-9 and . , : ! ? - + / ( ) " > <
const QUESTS = [
  {
    id: 'crown', kind: 'relic', name: 'THE TRUE CROWN', thing: 'THE TRUE CROWN',
    giver: 'king', portal: 'oldkeep',
    reward: { key: 'ferry' },
    lines: {
      offer: [
        'THROUGH THE HOLLOW MINE? FROM A WRECK?',
        'YOU ARE EXACTLY WHO I NEED. LISTEN:',
        'THE CROWN I WEAR IS A FACSIMILE. THE',
        'TRUE ONE WAS STOLEN INTO THE OLD KEEP,',
        'EAST OF TOWN, TWO FLOORS DOWN.',
        'FETCH IT BACK BEFORE MY VILLAGERS',
        'NOTICE, AND I WILL BOOK YOUR PASSAGE',
        'EAST BY BOAT.',
      ],
      remind: [
        'THE OLD KEEP, EAST OF TOWN. TWO FLOORS.',
        'AND NOT A WORD TO THE VILLAGERS.',
      ],
      done: [
        'THE TRUE CROWN! AND NOBODY THE WISER.',
        'AS PROMISED, YOUR PASSAGE IS BOOKED:',
        'THE FERRY WAITS AT THE DOCK EAST OF',
        'TOWN. SEEK THE MAYOR IN THE CAPITOL.',
      ],
    },
  },
  {
    id: 'witch', kind: 'slay', name: 'THE WITCH OF THE WESTWOOD', thing: 'HER BLACK CHARM',
    giver: MAYOR, portal: 'westwood',
    reward: { key: 'vault' },
    lines: {
      offer: [
        'SO THE KING SENT YOU. GOOD, WE NEED YOU:',
        'A WITCH HIDES IN A CAVE WEST OF TOWN,',
        'DEEP IN THE WESTWOOD, AND HER SKELETONS',
        'PROWL IT. PUT THE MINIONS DOWN FIRST:',
        'HER WARD BREAKS WHEN THE LAST ONE FALLS.',
        'BRING ME HER BLACK CHARM AND THE',
        'TREASURE VAULT UNDER THIS HALL IS YOURS',
        'TO EMPTY.',
      ],
      remind: [
        'THE CAVE IS WEST, PAST THE WESTWOOD.',
        'MINIONS FIRST. THEN THE WITCH.',
      ],
      done: [
        'HER BLACK CHARM. SO SHE IS TRULY DEAD.',
        'THE VAULT UNDER THIS HALL IS OPEN TO',
        'YOU: WHATEVER LIES AT ITS BOTTOM IS',
        'YOURS TO KEEP. THEY SAY A KEY RUSTS',
        'DOWN THERE, TOO...',
      ],
    },
  },
  {
    id: 'rats', kind: 'exterminate', name: 'THE STOREROOM SIEGE', thing: 'THE RAT PLAGUE',
    giver: RATCRIER, portal: 'storeroom',
    reward: { gold: 300 },
    lines: {
      offer: [
        'RATS! OUR WHOLE WINTER STORE IS UNDER',
        'SIEGE IN THE STOREROOM BELOW THE HALL!',
        'KILL EVERY LAST ONE OF THEM.',
        '300 GOLD IS YOURS IF NONE ARE LEFT.',
      ],
      remind: [
        'STILL SQUEAKING DOWN THERE.',
        'EVERY LAST ONE, DELVER.',
      ],
      done: [
        'EVERY LAST RAT? YOU ARE A WONDER!',
        '300 GOLD, HARD EARNED. AND OUR THANKS.',
        'THAT IS ALL THE TROUBLE WE HAVE...',
        'FOR TODAY.',
      ],
    },
  },
];

// ================= VALIDATION =================
const problems = [];
function mustBeOpen(name, x, y) {
  if (!isOpen(at(x, y))) problems.push(name + ' AT ' + x + ',' + y + ' SITS ON "' + at(x, y) + '"');
}
for (const p of PORTALS) {
  mustBeOpen(p.id, p.x, p.y);
  if (p.exit) mustBeOpen(p.id + ' exit', p.exit.x, p.exit.y);
}
VILLAGERS.forEach(([x, y], i) => mustBeOpen('villager ' + i, x, y));
mustBeOpen('king', KING[0], KING[1]);
mustBeOpen('start', START.x, START.y);

// each stretch of the road must actually connect on foot
function reachable(ax, ay, bx, by) {
  const seen = new Uint8Array(W * H);
  const q = [[ax, ay]];
  seen[ay * W + ax] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    if (x === bx && y === by) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (seen[ny * W + nx] || !isOpen(at(nx, ny))) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return false;
}
const LEGS = [
  ['start > island mine mouth', [START.x, START.y], MOUTH_ISLAND],
  ['ashford mouth > king', MOUTH_ASHFORD, KING],
  ['king > old keep', KING, KEEP_SPOT],
  ['king > ashford dock', KING, DOCK_ASHFORD],
  ['capitol dock > mayor', DOCK_CAPITOL, VILLAGERS[MAYOR]],
  ['mayor > witch cave', VILLAGERS[MAYOR], CAVE_SPOT],
  ['mayor > vault', VILLAGERS[MAYOR], VAULT_SPOT],
  ['mayor > north mine mouth', VILLAGERS[MAYOR], MOUTH_NORTH_CAPITOL],
  ['north mine exit > rat crier', MOUTH_NORTH_VILLAGE, VILLAGERS[RATCRIER]],
  ['rat crier > storeroom', VILLAGERS[RATCRIER], STOREROOM_SPOT],
];
for (const [name, a, b] of LEGS) {
  if (!reachable(a[0], a[1], b[0], b[1])) problems.push('NO PATH: ' + name);
}
// the island must NOT reach ashford on foot -- the mine is the only way
if (reachable(START.x, START.y, KING[0], KING[1])) {
  problems.push('THE ISLAND LEAKS: you can walk from the wreck to ashford');
}
// nor ashford the capitol -- that is the ferry's whole purpose
if (reachable(KING[0], KING[1], VILLAGERS[MAYOR][0], VILLAGERS[MAYOR][1])) {
  problems.push('THE STRAIT LEAKS: you can walk from ashford to the capitol');
}
// the font has no lowercase and no apostrophes; catch a bad line before it ships
const FONT_OK = /^[A-Z0-9 .,:!?\-+/()">< ]*$/;
for (const q of QUESTS) {
  for (const key in q.lines) {
    for (const line of q.lines[key]) {
      if (!FONT_OK.test(line)) problems.push('BAD GLYPH IN ' + q.id + '.' + key + ': "' + line + '"');
      if (line.length > 42) problems.push('LINE TOO LONG (' + line.length + ') IN ' + q.id + '.' + key + ': "' + line + '"');
    }
  }
}

if (problems.length) {
  console.error('world did not bake:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

// ================= EMIT =================
const world = {
  name: 'THE SUNDERED SHORE',
  rows: grid.map(r => r.join('')),
  legend: LEGEND,
  ramps: [],
  start: START,
  king: KING,
  villagers: VILLAGERS,
  portals: PORTALS,
  quests: QUESTS,
};
const data = { version: 2, world, tiles: {}, textures: {} };

const out = '// generated by tools/make-custom-game.js -- edit that, then re-run it.\n'
  + '// This is the shipped adventure: the game boots into it instead of the\n'
  + '// stock Kingshore. Set it back to null to get the old world.\n'
  + 'window.CUSTOM = ' + JSON.stringify(data) + ';\n';
const dest = path.join(__dirname, '..', 'custom-data.js');
fs.writeFileSync(dest, out);
console.log('baked ' + W + 'x' + H + ' world into ' + dest + ' (' + out.length + ' bytes)');
