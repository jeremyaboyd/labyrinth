// ---- game/overworld: the surface, level 0 ----
// Hand-authored and fixed. Unlike the dungeon below it, nothing here is
// rolled at load: the same shore, village and castle every single run.
'use strict';

//  M mountain   ~ sea      s sand      . grass    t tree
//  r road       H wall     W window    D door     L lamp post
//  C castle     y courtyard  g gate    X the way down
const OVERWORLD_MAP = [
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
  'MMM..t...t....r....................tt.....tsss~~',
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
};

// Stone flights up onto things. Each names where the low end sits, which way
// it climbs and how many tiles it runs, so a flight of three lifts you three.
// The castle wall walk is reached from inside the courtyard.
const OW_RAMPS = [
  { x: 12, y: 12, dir: RAMP_DIR.W, len: 3 },  // courtyard up to the west rampart
];

// the village crossroads, looking north up the lane between the cottages
const OW_START = { x: 28, y: 28, a: -Math.PI / 2 };

const OW_VILLAGERS = [
  [24, 28], [32, 28], [20, 28], [36, 28], [28, 32], [28, 24], [26, 35],
];
// he waits in the courtyard, between the gate and the stair down
const OW_KING = [14, 13];

function buildOverworld() {
  const h = OVERWORLD_MAP.length;
  const w = OVERWORLD_MAP[0].length;
  // a miscounted row would corrupt the whole world; fail loudly instead
  for (let y = 0; y < h; y++) {
    if (OVERWORLD_MAP[y].length !== w) {
      throw new Error('overworld row ' + y + ' is ' + OVERWORLD_MAP[y].length + ' wide, expected ' + w);
    }
  }

  const map = new Uint8Array(w * h);
  const floorMap = new Uint8Array(w * h);
  const props = [];
  let exit = null;

  for (let y = 0; y < h; y++) {
    const row = OVERWORLD_MAP[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const def = OW_LEGEND[ch];
      if (!def) throw new Error('unknown overworld glyph "' + ch + '" at ' + x + ',' + y);
      const i = y * w + x;
      map[i] = def[0];
      floorMap[i] = def[1];
      if (ch === 'X') exit = { x, y };
      else if (ch === 't') props.push({ type: 'tree', x: x + 0.5, y: y + 0.5, variant: (x * 7 + y * 13) % 2 });
      else if (ch === 'L') props.push({ type: 'lamp', x: x + 0.5, y: y + 0.5, phase: (x * 3 + y * 5) % 10 });
    }
  }
  if (!exit) throw new Error('overworld has no dungeon entrance');

  const lvl = {
    w, h, map, floorMap, props,
    doors: {},
    tiles: TILE_DEFS,
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
