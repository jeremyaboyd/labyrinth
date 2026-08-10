// ---- game/save: 3-slot localStorage persistence ----
// A save is a full mid-floor snapshot. The dungeon layout itself is not
// stored: it regenerates deterministically from (baseSeed, floor), then
// runtime state (player, enemies, items, doors, explored) is applied on top.
'use strict';

const SaveSys = (() => {
  const SLOTS = 3;
  const key = (i) => 'labyrinth.save' + i;

  function encodeExplored(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function decodeExplored(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  const r2 = (n) => Math.round(n * 100) / 100;

  // full snapshot of the current run
  function snapshot() {
    const p = G.player;
    return {
      v: 1,
      t: Date.now(),
      baseSeed: G.baseSeed,
      floor: p.floor,
      floorName: G.level.name,
      crownTaken: G.crownTaken,
      kills: G.stats.kills,
      player: { x: r2(p.x), y: r2(p.y), a: r2(p.a), hp: Math.ceil(p.hp), maxHp: p.maxHp, gold: p.gold, keys: p.keys },
      enemies: G.enemies.map(e => [e.type, r2(e.x), r2(e.y), Math.ceil(e.hp), e.state === 'chase' ? 1 : 0]),
      items: G.items.map(it => [it.type, r2(it.x), r2(it.y)]),
      doors: Object.entries(G.level.doors).map(([k, d]) => [+k, r2(d.open), d.locked ? 1 : 0]),
      explored: encodeExplored(G.explored),
    };
  }

  function write(slot) {
    try {
      localStorage.setItem(key(slot), JSON.stringify(snapshot()));
      return true;
    } catch (err) {
      return false;
    }
  }

  function read(slot) {
    try {
      const raw = localStorage.getItem(key(slot));
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d.v !== 1 || !d.player || !Number.isFinite(d.baseSeed)) return null;
      return d;
    } catch (err) {
      return null;
    }
  }

  function list() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) out.push(read(i));
    return out;
  }

  function mostRecentSlot() {
    let best = -1, bestT = -1;
    list().forEach((d, i) => { if (d && d.t > bestT) { bestT = d.t; best = i; } });
    return best;
  }

  // rebuild the run from a snapshot; returns false on bad data
  function restore(d) {
    if (!d) return false;
    G.baseSeed = d.baseSeed;
    G.player = newPlayer();
    G.crownTaken = !!d.crownTaken;
    G.stats.kills = d.kills | 0;
    loadFloor(d.floor); // deterministic layout; runtime state overwritten below
    const p = G.player;
    p.x = d.player.x; p.y = d.player.y; p.a = d.player.a;
    p.hp = d.player.hp; p.maxHp = d.player.maxHp;
    p.gold = d.player.gold; p.keys = d.player.keys;
    p.floor = d.floor;
    G.enemies = d.enemies.map(([type, x, y, hp, chase]) => {
      const e = makeEnemy(type, x, y);
      e.hp = hp;
      e.state = chase ? 'chase' : 'idle';
      return e;
    });
    G.items = d.items.map(([type, x, y]) => ({ type, x, y, bob: Math.random() * 10 }));
    for (const [idx, open, locked] of d.doors) {
      const door = G.level.doors[idx];
      if (!door) continue;
      door.open = open;
      door.opening = open > 0;
      door.locked = !!locked;
      if (!door.locked && G.level.map[idx] === T_DOOR_LOCKED) G.level.map[idx] = T_DOOR;
    }
    try {
      const ex = decodeExplored(d.explored);
      if (ex.length === G.level.w * G.level.h) G.explored = ex;
    } catch (err) { /* keep fresh explored */ }
    G.messages = [];
    return true;
  }

  return { SLOTS, write, read, list, mostRecentSlot, restore };
})();
