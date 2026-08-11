// ---- game/overworld: the surface, level 0 ----
// Hand-authored and fixed. Unlike the dungeon below it, nothing here is
// rolled at load: the same shore, village and castle every single run.
'use strict';

//  M mountain   ~ sea      s sand      . grass    t tree
//  r road       H wall     W window    D door     L lamp post
//  C castle     y courtyard  g gate    X the way down
const OW_KINGSHORE = [
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMMMMMM........MMMMMM...MMMMMMMMMMM',
  'MMMMMMMM.....MMMMMM..........MMM.......MMMMMMMM~',
  'MMMMMMM........MM........t........t.....MMMMMM~~',
  'MMMM...t.CCCCCCCCCCC...t......t.......t...MMs~~~',
  'MMMMtt...CyyyyyyyyyC......t........t.t..t.sss~~~',
  'MMMMt....CyyyyXyyyyCtt......t.............sss~~~',
  'MMMM.....CyyyyyyyyyC........t............t.ss~~~',
  'MMMM.....CyyyyyyyyyC..tt...................ss~~~',
  'MMMMM..t.CyyyyyyyyyC..tt.t....t............ss~~~',
  'MMMMM..t.CyyyyyyyyyCt....t...t..t...tt..t..sss~~',
  'MMMMM....CyyyyyyyyyC.........t.t.........t.sss~~',
  'MMMMM..ttCyyyyyyyyyC..................t.....ss~~',
  'MMMM.....CCCCgggCCCC...................t....ss~~',
  'MMM...........r...t....t..t...t....tt.......ss~~',
  'MMM....t......r.t.t.....................tt..ss~~',
  'MMm..t...t....r....................tt.....tsss~~',
  'MMMt.tt...t..Lr...t.............tt.....t..tsss~~',
  'MMMt........t.r.....................t.HWHWHss~~~',
  'MMM.tt....t..tr..t....t...............WHHHWss~~~',
  'MMM.......t...r.t.....HWHWH...HWHWH.t.HHHHHss~~~',
  'MMMM..t..tt.t.rL......WHHHW...WHHHW...HWDWHss~~~',
  'MMMMM.t.......r.....t.HHHHH...HHHHH.......sss~~~',
  'MMMMMt..t..t..r.t.....HWDWH...HWDWH..t....sss~~~',
  'MMMMM.....tt..r...Lt......L...L.....L.....ss~~~~',
  'MMMMM.........rrrrrrrrrrrrrrrrrrrrrrrrrrrrsss~~~',
  'MMMM.....t.....t..L...t...L.r.L....tL.tt.tsss~~~',
  'MMMM.t...............tHWHWH.r.HWHWH.....t.sss~~~',
  'MMM...t.t........t....WHHHW.r.WHHHW...t...sss~~~',
  'MMMM.......t..t..t....HHHHH.rtHHHHH...t..ssss~~~',
  'MMMM..................HWDWH.r.HWDWH.t....ssss~~~',
  'MMMMM........t.............LrLt.....t..sssssss~~',
  'MMMMMM....t.................rtt....t.ssssssss~~~',
  'MMMMMMM..t.....t.........t..rt......sssssssss~~~',
  'MMMMMMM.....t.....t........tr...t..sssssssss~~~~',
  'MMMMMM...........t....t.....rrrrrrrsssssssss~~~~',
  'MMMMM...t...t..t....t............srssssssss~~~~~',
  'MMMM............tt...............srssssss~~~~~~~',
  'MMMsss.....t.....tsss...t.......ssrss~~~~~~~~~~~',
  'MMMssssss......sssssssss.t....ssssr~~~~~~~~~~~~~',
  'MMMsssssssssssssssssssssssssssssss~~~~~~~~~~~~~~',
  'MMM~~~~~ssssssss~~~~~~~ssssssss~~~~~~~~~~~~~~~~~',
  'MMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  'MMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  'MMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];


// ---------- the world is assembled from hand-drawn regions ----------
// Everything not covered by a region is mountain, which is what separates the
// two settlements and what the mine tunnels through.
const OW_W = 96, OW_H = 88;
const KS_X = 48, KS_Y = 30;   // where Kingshore sits in the larger world
const NV_X = 4, NV_Y = 4;     // and the northern vale beyond the range

const OW_NORTHVALE = [
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
  'MMMM......................MMMMMMMM',
  'MMM...t...............t....MMMMMMM',
  'MM.........HWHWH...........MMMMMMM',
  'MM..t......WHHHW....t......MMMMMMM',
  'MM.........HHHHH...........MMMMMMM',
  'MM.........HWDWH......t....MMMMMMM',
  'MM....t.......L............MMMMMMM',
  'MM.........rrrrrrrr........MMMMMMM',
  'MM..HWHWH..r......r..HWHWH.MMMMMMM',
  'MM..WHHHW..r......r..WHHHW.MMMMMMM',
  'MM..HHHHH..r......r..HHHHH.MMMMMMM',
  'MM..HWDWH..r......r..HWDWH.MMMMMMM',
  'MM.....L...r......r....L...MMMMMMM',
  'MM.........rrrrrrrr........MMMMMMM',
  'MM...t.........r......t....MMMMMMM',
  'MMM............r..........MMMMMMMM',
  'MMM....t.......r....t.....MMMMMMMM',
  'MMMM...........r.........MMMMMMMMM',
  'MMMM...........r........MMMMMMMMMM',
  'MMMMM..........n.......MMMMMMMMMMM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
];

const OW_REGIONS = [
  { x: KS_X, y: KS_Y, art: OW_KINGSHORE },
  { x: NV_X, y: NV_Y, art: OW_NORTHVALE },
];

function composeWorld() {
  const rows = [];
  for (let y = 0; y < OW_H; y++) rows.push(new Array(OW_W).fill('M'));
  for (const reg of OW_REGIONS) {
    for (let ry = 0; ry < reg.art.length; ry++) {
      const line = reg.art[ry];
      for (let rx = 0; rx < line.length; rx++) {
        const x = reg.x + rx, y = reg.y + ry;
        if (x >= 0 && y >= 0 && x < OW_W && y < OW_H) rows[y][x] = line[rx];
      }
    }
  }
  return rows.map(row => row.join(''));
}

const OW_LEGEND = {
  'M': [T_MOUNTAIN, T_GRASS],
  '~': [T_WATER, T_SEA],
  's': [0, T_SAND],
  '.': [0, T_GRASS],
  't': [T_TREE, T_GRASS],
  'r': [0, T_ROAD],
  'H': [T_HOUSE, T_GRASS],
  'W': [T_WINDOW, T_GRASS],
  'D': [T_HDOOR, T_GRASS],
  'C': [T_CASTLE, T_COURT],
  'g': [0, T_COURT],
  'y': [0, T_COURT],
  'X': [0, T_COURT],
  'L': [T_LAMP, T_GRASS],
  'm': [0, T_ROAD],   // mine mouth, Kingshore side
  'n': [0, T_ROAD],   // mine mouth, the vale side
};

// Stone flights up onto things. Each names where the low end sits, which way
// it climbs and how many tiles it runs, so a flight of three lifts you three.
// The castle wall walk is reached from inside the courtyard.
const OW_RAMPS = [
  { x: KS_X + 12, y: KS_Y + 12, dir: RAMP_DIR.W, len: 3 }, // courtyard to the rampart
];

// the village crossroads, looking north up the lane between the cottages
const OW_START = { x: KS_X + 28, y: KS_Y + 28, a: -Math.PI / 2 };

const OW_VILLAGERS = [
  [24, 28], [32, 28], [20, 28], [36, 28], [28, 32], [28, 24], [26, 35],
].map(([x, y]) => [KS_X + x, KS_Y + y]).concat([
  // the vale keeps its own people
  [NV_X + 15, NV_Y + 9], [NV_X + 15, NV_Y + 13], [NV_X + 8, NV_Y + 7],
  [NV_X + 22, NV_Y + 8], [NV_X + 15, NV_Y + 17],
]);
// he waits in the courtyard, between the gate and the stair down
const OW_KING = [KS_X + 14, KS_Y + 13];

function buildOverworld() {
  const rows = composeWorld();
  const h = rows.length;
  const w = rows[0].length;
  // a miscounted row would corrupt the whole world; fail loudly instead
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) {
      throw new Error('overworld row ' + y + ' is ' + rows[y].length + ' wide, expected ' + w);
    }
  }

  const map = new Uint8Array(w * h);
  const floorMap = new Uint8Array(w * h);
  const props = [];
  let exit = null, mineA = null, mineB = null;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const def = OW_LEGEND[ch];
      if (!def) throw new Error('unknown overworld glyph "' + ch + '" at ' + x + ',' + y);
      const i = y * w + x;
      map[i] = def[0];
      floorMap[i] = def[1];
      if (ch === 'X') exit = { x, y };
      else if (ch === 'm') mineA = { x, y };
      else if (ch === 'n') mineB = { x, y };
      else if (ch === 't') props.push({ type: 'tree', x: x + 0.5, y: y + 0.5, variant: (x * 7 + y * 13) % 2 });
      else if (ch === 'L') props.push({ type: 'lamp', x: x + 0.5, y: y + 0.5, phase: (x * 3 + y * 5) % 10 });
    }
  }
  if (!exit) throw new Error('overworld has no dungeon entrance');

  const lvl = {
    w, h, map, floorMap, props,
    doors: {},
    tiles: TILE_DEFS,
    mineA, mineB,
    start: { x: OW_START.x, y: OW_START.y },
    startAngle: OW_START.a,
    exit,
    spawns: [],
    items: [],
    torches: [],
    shops: [],
    villagers: OW_VILLAGERS.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, role: 'villager' }))
      .concat([{ x: OW_KING[0] + 0.5, y: OW_KING[1] + 0.5, role: 'king' }]),
    floorNum: 0,
    name: 'THE KINGSHORE',
    hasCrown: false,
    outdoor: true,
  };
  layRamps(lvl, OW_RAMPS, 0);
  return lvl;
}
