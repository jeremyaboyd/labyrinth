// ---- game/dungeon: procedural labyrinth generation ----
// Uses BALANCE curves from game/config.js and ADJ from engine/grid.js.
'use strict';

function levelName(floorNum, rng) {
  const adj = ['FORGOTTEN', 'SILENT', 'WEEPING', 'SUNKEN', 'ANCIENT', 'CURSED', 'BLACK', 'ENDLESS', 'HOLLOW', 'BURIED'];
  const noun = ['CATACOMBS', 'VAULTS', 'CRYPTS', 'WARRENS', 'HALLS', 'DEPTHS', 'MAZE', 'SANCTUM', 'GALLERIES', 'CISTERNS'];
  if (floorNum === CROWN_FLOOR) return 'THE THRONE OF THE DEEP';
  return 'THE ' + pick(rng, adj) + ' ' + pick(rng, noun);
}

function generateDungeon(floorNum, seed) {
  const rng = makeRng(seed);
  const size = BALANCE.mapSize(floorNum);
  const w = size, h = size;
  const map = new Uint8Array(w * h).fill(T_STONE);
  const at = (x, y) => map[y * w + x];
  const set = (x, y, v) => { map[y * w + x] = v; };
  const inBounds = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;

  // 1) backtracker maze over odd cells
  const stack = [[1, 1]];
  set(1, 1, 0);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const dirs = shuffle(rng, [[2, 0], [-2, 0], [0, 2], [0, -2]]);
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (inBounds(nx, ny) && at(nx, ny) !== 0) {
        set(cx + dx / 2, cy + dy / 2, 0);
        set(nx, ny, 0);
        stack.push([nx, ny]);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }

  // 2) carve rooms on top (creates loops + open combat spaces)
  const roomCount = BALANCE.rooms(floorNum) + rngInt(rng, 0, 2);
  const rooms = [];
  for (let r = 0; r < roomCount * 3 && rooms.length < roomCount; r++) {
    const rw = 3 + rngInt(rng, 0, 2) * 2, rh = 3 + rngInt(rng, 0, 2) * 2;
    const rx = 1 + rngInt(rng, 0, (w - rw - 2) / 2) * 2;
    const ry = 1 + rngInt(rng, 0, (h - rh - 2) / 2) * 2;
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) set(x, y, 0);
  }

  // 3) extra loops: knock out a few walls between two floor cells
  const loopTries = Math.floor(w * h / 40);
  for (let i = 0; i < loopTries; i++) {
    const x = rngInt(rng, 1, w - 2), y = rngInt(rng, 1, h - 2);
    if (at(x, y) === 0) continue;
    if (at(x - 1, y) === 0 && at(x + 1, y) === 0 && at(x, y - 1) !== 0 && at(x, y + 1) !== 0) set(x, y, 0);
    else if (at(x, y - 1) === 0 && at(x, y + 1) === 0 && at(x - 1, y) !== 0 && at(x + 1, y) !== 0) set(x, y, 0);
  }

  // 4) trim some dead ends (reduce tedium)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (at(x, y) !== 0) continue;
      let open = 0;
      for (const [dx, dy] of ADJ) if (at(x + dx, y + dy) === 0) open++;
      if (open <= 1 && rng() < 0.3) set(x, y, T_STONE);
    }
  }

  // BFS distances from a point (doors passable, locked doors optional)
  function bfs(sx, sy, blockLocked) {
    const dist = new Int32Array(w * h).fill(-1);
    const q = [[sx, sy]];
    dist[sy * w + sx] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const [cx, cy] = q[qi];
      for (const [dx, dy] of ADJ) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const c = at(nx, ny);
        const pass = c === 0 || c === T_DOOR || (c === T_DOOR_LOCKED && !blockLocked);
        if (pass && dist[ny * w + nx] === -1) {
          dist[ny * w + nx] = dist[cy * w + cx] + 1;
          q.push([nx, ny]);
        }
      }
    }
    return dist;
  }

  // 5) start = a floor cell near a corner; exit = farthest floor cell
  let start = null;
  outer:
  for (let d = 0; d < w + h; d++) {
    for (let y = 1; y <= d; y++) {
      const x = d - y;
      if (inBounds(x, y) && at(x, y) === 0) { start = { x, y }; break outer; }
    }
  }
  let dist = bfs(start.x, start.y, false);
  let exit = start, best = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) === 0 && dist[y * w + x] > best) { best = dist[y * w + x]; exit = { x, y }; }
  }

  // path start->exit via parent walk on dist field (descend from exit)
  const path = [];
  {
    let cx = exit.x, cy = exit.y;
    while (!(cx === start.x && cy === start.y)) {
      path.push([cx, cy]);
      let stepped = false;
      for (const [dx, dy] of shuffle(rng, ADJ.slice())) {
        const nx = cx + dx, ny = cy + dy;
        if (inBounds(nx, ny) && dist[ny * w + nx] === dist[cy * w + cx] - 1) {
          cx = nx; cy = ny; stepped = true; break;
        }
      }
      if (!stepped) break;
    }
    path.reverse(); // start-side first
  }

  const doors = {}; // idx -> {open,opening,locked,closing timer}
  const isCorridor = (x, y) => {
    const ns = at(x, y - 1) === 0 && at(x, y + 1) === 0 && at(x - 1, y) !== 0 && at(x + 1, y) !== 0;
    const ew = at(x - 1, y) === 0 && at(x + 1, y) === 0 && at(x, y - 1) !== 0 && at(x, y + 1) !== 0;
    return ns || ew;
  };

  // 6) locked door on the far portion of the path + key in the reachable region
  let keyPos = null, lockedIdx = -1;
  for (let i = Math.floor(path.length * 0.85); i > Math.floor(path.length * 0.5); i--) {
    const [px, py] = path[i];
    if (isCorridor(px, py) && Math.abs(px - exit.x) + Math.abs(py - exit.y) > 3) {
      set(px, py, T_DOOR_LOCKED);
      lockedIdx = py * w + px;
      doors[lockedIdx] = { open: 0, opening: false, locked: true };
      break;
    }
  }
  if (lockedIdx >= 0) {
    const kd = bfs(start.x, start.y, true);
    const candidates = [];
    let kmax = 0;
    for (let i = 0; i < w * h; i++) if (at(i % w, Math.floor(i / w)) === 0 && kd[i] > kmax) kmax = kd[i];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const d = kd[y * w + x];
      if (at(x, y) === 0 && d > kmax * 0.55 && !(x === start.x && y === start.y)) candidates.push({ x, y });
    }
    if (candidates.length) keyPos = pick(rng, candidates);
    else { // give up on the lock
      map[lockedIdx] = 0; delete doors[lockedIdx]; lockedIdx = -1;
    }
  }

  // 7) regular doors on corridor cells
  let doorCount = 0;
  const doorMax = BALANCE.doorMax(floorNum);
  for (let y = 1; y < h - 1 && doorCount < doorMax; y++) for (let x = 1; x < w - 1 && doorCount < doorMax; x++) {
    if (at(x, y) !== 0 || !isCorridor(x, y)) continue;
    if (Math.abs(x - start.x) + Math.abs(y - start.y) < 3) continue;
    let nearDoor = false;
    for (const [dx, dy] of ADJ) { const c = at(x + dx, y + dy); if (c === T_DOOR || c === T_DOOR_LOCKED) nearDoor = true; }
    if (nearDoor || rng() > 0.18) continue;
    set(x, y, T_DOOR);
    doors[y * w + x] = { open: 0, opening: false, locked: false };
    doorCount++;
  }

  // recompute distances (doors pass, ignore lock) for spawn placement
  dist = bfs(start.x, start.y, false);

  // 8) wall texture variety for walls that face floor
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) !== T_STONE) continue;
    let facesFloor = false;
    for (const [dx, dy] of ADJ) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && at(nx, ny) === 0) facesFloor = true;
    }
    if (!facesFloor) continue;
    const r = rng();
    if (r < 0.13) set(x, y, T_MOSS);
    else if (r < 0.16) set(x, y, T_RUNE);
    else if (r < 0.19) set(x, y, T_BANNER);
    else if (r < 0.22) set(x, y, T_SKULL);
  }

  // helper: pick free floor cells by min distance from start
  const used = new Set([start.y * w + start.x, exit.y * w + exit.x]);
  if (keyPos) used.add(keyPos.y * w + keyPos.x);
  function freeCell(minDist) {
    for (let tries = 0; tries < 200; tries++) {
      const x = rngInt(rng, 1, w - 2), y = rngInt(rng, 1, h - 2);
      const i = y * w + x;
      if (at(x, y) !== 0 || used.has(i)) continue;
      if (dist[i] < minDist) continue;
      used.add(i);
      return { x, y };
    }
    return null;
  }

  // 9) shop windows. Only walls with a single exposed face qualify, so the
  // window art is never seen from behind, and each gets a flanking torch.
  const shops = [];
  const shopTorches = [];
  {
    const shopN = Math.min(1 + Math.floor(floorNum / 2), 3);
    const kinds = shuffle(rng, ['potion', 'weapon', 'armor']);
    const cands = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const c = at(x, y);
      if (c === 0 || c === T_DOOR || c === T_DOOR_LOCKED) continue;
      let open = 0, fx = 0, fy = 0, nearDoor = false;
      for (const [dx, dy] of ADJ) {
        const nc = at(x + dx, y + dy);
        if (nc === 0) { open++; fx = x + dx; fy = y + dy; }
        else if (nc === T_DOOR || nc === T_DOOR_LOCKED) nearDoor = true;
      }
      if (open !== 1 || nearDoor) continue;
      if (dist[fy * w + fx] < 2) continue;            // not right on the entrance
      if (fx === exit.x && fy === exit.y) continue;   // never blocks the stairs
      cands.push({ x, y, fx, fy });
    }
    shuffle(rng, cands);
    for (const c of cands) {
      if (shops.length >= shopN) break;
      if (shops.some(s => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) < 7)) continue;
      const kind = kinds[shops.length % kinds.length];
      set(c.x, c.y, SHOP_TILE[kind]);
      shops.push({
        idx: c.y * w + c.x, x: c.x, y: c.y, kind, fx: c.fx, fy: c.fy,
        stock: makeShopStock(kind, floorNum, rng),
      });
      used.add(c.fy * w + c.fx); // keep loot off the counter
      const ddx = c.x - c.fx, ddy = c.y - c.fy;
      shopTorches.push({
        x: c.fx + 0.5 + ddx * 0.36 - ddy * 0.3,
        y: c.fy + 0.5 + ddy * 0.36 + ddx * 0.3,
        phase: rng() * 10,
      });
    }
  }

  // 10) enemies
  const spawns = [];
  const ratN = BALANCE.rats(floorNum);
  const skelN = BALANCE.skeletons(floorNum);
  const wraithN = BALANCE.wraiths(floorNum);
  const addEnemy = (type, n, minD) => {
    for (let i = 0; i < n; i++) {
      const c = freeCell(minD);
      if (c) spawns.push({ type, x: c.x + 0.5, y: c.y + 0.5 });
    }
  };
  addEnemy('rat', ratN, 5);
  addEnemy('skeleton', skelN, 8);
  addEnemy('wraith', wraithN, 10);

  // 11) items
  const items = [];
  const potN = BALANCE.potions(floorNum);
  for (let i = 0; i < potN; i++) {
    const c = freeCell(4);
    if (!c) continue;
    const blue = floorNum >= 3 && rng() < 0.3;
    items.push({ type: 'item', item: blue ? 'potionBlue' : 'potionRed', x: c.x + 0.5, y: c.y + 0.5 });
  }
  const goldN = BALANCE.goldPiles(floorNum);
  for (let i = 0; i < goldN; i++) { const c = freeCell(3); if (c) items.push({ type: 'gold', x: c.x + 0.5, y: c.y + 0.5 }); }
  if (keyPos) items.push({ type: 'key', x: keyPos.x + 0.5, y: keyPos.y + 0.5 });
  if (floorNum === CROWN_FLOOR) items.push({ type: 'crown', x: exit.x + 0.5, y: exit.y + 0.5 });

  // 12) torches: floor cells adjacent to a wall, offset toward the wall face
  const torches = [];
  const torchMax = Math.floor(w * h / 26);
  for (let y = 1; y < h - 1 && torches.length < torchMax; y++) {
    for (let x = 1; x < w - 1 && torches.length < torchMax; x++) {
      if (at(x, y) !== 0 || rng() > 0.10) continue;
      const walls = ADJ.filter(([dx, dy]) => {
        const c = at(x + dx, y + dy);
        return c !== 0 && c !== T_DOOR && c !== T_DOOR_LOCKED;
      });
      if (!walls.length) continue;
      const [dx, dy] = pick(rng, walls);
      torches.push({ x: x + 0.5 + dx * 0.38, y: y + 0.5 + dy * 0.38, phase: rng() * 10 });
    }
  }
  torches.push(...shopTorches); // shop lamps are never trimmed by the cap

  return {
    w, h, map, doors, start, exit, spawns, items, torches, shops,
    tiles: TILE_DEFS,
    floorNum,
    name: levelName(floorNum, rng),
    hasCrown: floorNum === CROWN_FLOOR,
  };
}

// ---------- the mine ----------
// One level, cut through the range between Kingshore and the vale. It is a
// dungeon like any other -- a maze, its monsters, its loot -- but it is not
// part of the descent, so it carries its own floor number and never appears
// in the stairwell's list of floors.
const MINE_FLOOR = -1;

function buildMine(seed) {
  const lvl = generateDungeon(1, seed);
  lvl.floorNum = MINE_FLOOR;
  lvl.name = 'THE DEEPCUT MINE';
  lvl.hasCrown = false;

  // A mine is cut, not built: the masonry the generator laid becomes packed
  // earth, shored with timber at regular intervals along the galleries. Doors
  // and shop windows keep their own art -- a jamb set into the dirt.
  for (let y = 0; y < lvl.h; y++) {
    for (let x = 0; x < lvl.w; x++) {
      const i = y * lvl.w + x;
      const c = lvl.map[i];
      if (c !== T_STONE && c !== T_MOSS && c !== T_RUNE && c !== T_BANNER && c !== T_SKULL) continue;
      // shore the wall wherever it faces open ground on a regular beat
      let open = false;
      for (const [dx, dy] of ADJ) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < lvl.w && ny < lvl.h && lvl.map[ny * lvl.w + nx] === 0) { open = true; break; }
      }
      lvl.map[i] = open && (x + y) % 3 === 0 ? T_MINE_SUPPORT : T_DIRT;
    }
  }
  // the ground is trodden earth and the roof is boards, not vaulted stone
  lvl.floorTex = T_DIRT_FLOOR;
  lvl.ceilTex = T_PLANK_CEIL;
  return lvl;
}
