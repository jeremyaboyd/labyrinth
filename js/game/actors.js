// ---- game/actors: player simulation and enemy AI ----
'use strict';

function newPlayer() {
  const p = {
    x: 0, y: 0, a: 0,
    z: 0, vz: 0,      // feet height, and the fall in progress
    hp: 100, maxHp: 100,
    mp: START_KIT.mp, maxMp: START_KIT.mp,
    gold: 0, keys: 0, floor: 1, realm: 'castle',
    portalKeys: [], // portal ids whose seals this player has been granted past
    attackT: 0, attackHitDone: false, atkCd: 0,
    bobPhase: 0, moving: false, stepAcc: 0,
    inv: newInventory(),
    equip: { weapon: null, armor: null, ammo: null },
    quests: newQuestLog(),
  };
  invAdd(p.inv, START_KIT.weapon, 1);
  invAdd(p.inv, 'potionRed', START_KIT.potions);
  equipItem(p, START_KIT.weapon);
  return p;
}

// is a movement binding held?
function held(name) { return Input.anyDown(KEYS[name]); }

// ---------- player actions ----------
function startAttack() {
  const p = G.player;
  if (p.atkCd > 0) return;
  const w = weaponDef(p);
  if (!w) { addMsg('YOU HAVE NOTHING TO FIGHT WITH'); return; }

  if (w.wclass === 'bow') {
    if (ammoCount(p) <= 0) p.equip.ammo = bestArrow(p);
    if (ammoCount(p) <= 0) { addMsg('YOUR QUIVER IS EMPTY'); SFX.denied(); p.atkCd = 0.3; return; }
  }
  if (w.wclass === 'staff' && p.mp < w.mana) { addMsg('NOT ENOUGH MANA'); SFX.denied(); p.atkCd = 0.3; return; }

  p.atkCd = w.cd;
  p.attackT = w.swing;
  p.attackHitDone = false;
  if (w.wclass === 'melee') SFX.swing();
  else if (w.wclass === 'bow') SFX.bowDraw();
  else SFX.castCharge();
}

// fired once per swing, at the weapon's hitAt mark
function resolveAttack() {
  const p = G.player;
  const w = weaponDef(p);
  if (!w) return;
  if (w.wclass === 'bow') return looseArrow(w);
  if (w.wclass === 'staff') return castBolt(w);
  return doMeleeHit(w);
}

// A warded enemy cannot be harmed while any of its wards still stands: the
// witch is untouchable until her skeletons are down. Damage callers check
// this and land nothing but the message.
function enemyWarded(e) {
  return !!e.ward && G.enemies.some(o => o !== e && o.type === e.ward && o.hp > 0);
}

function wardDeflect(e) {
  e.painT = 0.12; // she flinches, but nothing lands
  if (!e.wardMsgAt || G.time - e.wardMsgAt > 2.5) {
    addMsg('HER WARD HOLDS WHILE HER MINIONS STAND');
    SFX.denied();
    e.wardMsgAt = G.time;
  }
}

function doMeleeHit(w) {
  const p = G.player;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  let hit = false;
  for (const e of G.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > w.reach) continue;
    const dot = (dx / d) * dirX + (dy / d) * dirY;
    if (dot < 0.75 && d > 0.6) continue;
    if (!lineOfSight(G.level, p.x, p.y, e.x, e.y)) continue;
    if (enemyWarded(e)) { wardDeflect(e); hit = true; continue; }
    e.hp -= w.dmg + Math.random() * w.vary;
    e.painT = 0.18;
    e.state = 'chase';
    // knockback
    tryMove(G.level, e, (dx / d) * 0.3, (dy / d) * 0.3, 0.3);
    hit = true;
  }
  if (hit) SFX.hit();
}

function looseArrow(w) {
  const p = G.player;
  const id = p.equip.ammo;
  const a = itemDef(id);
  if (!a || invRemoveId(p.inv, id, 1) < 1) { addMsg('YOUR QUIVER IS EMPTY'); return; }
  syncEquipment(p);
  spawnProjectile('arrow', a.shot, p.x + Math.cos(p.a) * 0.35, p.y + Math.sin(p.a) * 0.35,
    p.a, a.dmg + w.dmg, a.vary + w.vary);
  SFX.bowLoose();
}

function castBolt(w) {
  const p = G.player;
  if (p.mp < w.mana) return;
  p.mp -= w.mana;
  spawnProjectile('bolt', 'shot_bolt', p.x + Math.cos(p.a) * 0.35, p.y + Math.sin(p.a) * 0.35,
    p.a, w.dmg, w.vary);
  SFX.castBolt();
}

// the shop a wall cell belongs to, or null
function shopAtCell(lvl, x, y) {
  if (!lvl.shops) return null;
  const idx = (y | 0) * lvl.w + (x | 0);
  return lvl.shops.find(s => s.idx === idx) || null;
}

// the nearest person the player is actually looking at
function npcInFront() {
  const p = G.player;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  let best = null, bestD = 1.8;
  for (const v of G.npcs) {
    const dx = v.x - p.x, dy = v.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    if (d > 0.4 && (dx / d) * dirX + (dy / d) * dirY < 0.55) continue;
    best = v; bestD = d;
  }
  return best;
}

// Which staircase the player is standing on, if any. Both are taken with E:
// stepping onto one used to be enough for the way down, but arriving back up
// lands you squarely on it, and that would drop you straight through again.
function stairsUnderFoot() {
  const p = G.player, lvl = G.level;
  if (lvl.isMine || lvl.floorNum === 0) return null; // mouths and portals, not stairs
  if ((!lvl.hasCrown || G.crownTaken) && !lvl.noDeeper
      && Math.hypot(lvl.exit.x + 0.5 - p.x, lvl.exit.y + 0.5 - p.y) < 0.6) return 'down';
  if (lvl.floorNum > 0
      && Math.hypot(lvl.start.x + 0.5 - p.x, lvl.start.y + 0.5 - p.y) < 0.6) return 'up';
  return null;
}

// either way, the stairwell asks how far you mean to go
function takeStairs(dir) { openStairs(dir); }

function onSpot(spot, reach) {
  const p = G.player;
  return spot && Math.hypot(spot.x + 0.5 - p.x, spot.y + 0.5 - p.y) < (reach || 0.7);
}

// The portal the player is standing on, out on the surface. A mine is
// entered from either mouth; a dungeon from its one shaft.
function portalUnderFoot() {
  const lvl = G.level;
  if (lvl.floorNum !== 0 || !lvl.portals) return null;
  for (const portal of lvl.portals) {
    if (onSpot(portal)) return { portal, side: 'enter' };
    // a mine has a mouth at each end, a boat a dock at each shore
    if ((portal.kind === 'mine' || portal.kind === 'boat') && onSpot(portal.exit)) {
      return { portal, side: 'exit' };
    }
  }
  return null;
}

// a locked portal opens only to a key some quest has granted
function portalSealed(portal) {
  return !!portal.locked && !G.player.portalKeys.includes(portal.id);
}

// Inside a mine, either mouth carries you back to its spot on the surface.
function mineMouthUnderFoot() {
  const lvl = G.level;
  if (!lvl.isMine) return null;
  const portal = G.portals[G.realm];
  if (!portal) return null;
  if (onSpot(lvl.start)) return { spot: { x: portal.x, y: portal.y }, text: 'LEAVE THE MINE' };
  if (onSpot(lvl.exit)) return { spot: { x: portal.exit.x, y: portal.exit.y }, text: 'LEAVE THE MINE' };
  return null;
}

// E: take the stairs you are on, speak to whoever is there, else open the
// door or shop window ahead
function useFront() {
  const p = G.player;
  const lvl = G.level;

  // standing at a way off the surface
  const at = portalUnderFoot();
  if (at) {
    if (portalSealed(at.portal)) {
      addMsg(at.portal.kind === 'boat'
        ? 'YOU HAVE NO PASSAGE. SOMEONE MUST BOOK IT.'
        : 'SEALED. SOMEONE HOLDS THE KEY.');
      SFX.doorLocked();
      return;
    }
    if (at.portal.kind === 'boat') {
      // the crossing itself is elided: a fade, and you are at the far dock
      const dest = at.side === 'exit' ? at.portal : at.portal.exit;
      SFX.sail();
      G.state = 'transition';
      G.transT = 0;
      p.x = dest.x + 0.5;
      p.y = dest.y + 0.5;
      addMsg('YOU SAIL ACROSS THE WATER');
      return;
    }
    if (at.portal.id === 'castle') {
      // the castle's descent keeps its stairwell and its list of floors
      takeStairs('down');
      return;
    }
    SFX.stairs();
    G.state = 'transition';
    G.transT = 0;
    changeFloor(1, at.side === 'exit' ? 'exit' : 'start', at.portal.id);
    return;
  }

  // standing at a mine mouth, on the way back out
  const mine = mineMouthUnderFoot();
  if (mine) {
    SFX.stairs();
    G.state = 'transition';
    G.transT = 0;
    changeFloor(0, mine.spot);
    return;
  }

  const stair = stairsUnderFoot();
  if (stair) { takeStairs(stair); return; }

  const npc = npcInFront();
  if (npc) {
    // the king holds his scripted audience -- unless a designer gave him a
    // quest of his own, which then speaks for him. A custom king with no
    // quest has nothing to say about a labyrinth his world may not have.
    if (npc.role === 'king') {
      const dqid = designerQuestFromGiver(p, npc);
      if (dqid) startDialogue(designerQuestTalk(p, npc, dqid));
      else if (typeof CustomData !== 'undefined' && CustomData.world()) {
        startDialogue({ name: 'THE KING', lines: ['BE WELCOME IN MY TOWN, TRAVELER.'] });
      } else startDialogue(kingDialogue(p));
    }
    else openNpcMenu(npc);
    return;
  }

  for (const reach of [0.9, 1.4]) {
    const cx = p.x + Math.cos(p.a) * reach, cy = p.y + Math.sin(p.a) * reach;
    const c = cellAt(lvl, cx, cy);

    if (shopKindAt(c)) {
      const shop = shopAtCell(lvl, cx, cy);
      if (shop && (p.x | 0) === shop.fx && (p.y | 0) === shop.fy) { openShop(shop); return; }
      continue;
    }

    if (c !== T_DOOR && c !== T_DOOR_LOCKED) continue;
    const idx = (cy | 0) * lvl.w + (cx | 0);
    const d = lvl.doors[idx];
    if (!d) continue;
    if (d.locked) {
      if (p.keys > 0) {
        p.keys--;
        d.locked = false;
        d.opening = true;
        lvl.map[idx] = T_DOOR;
        addMsg('THE KEY TURNS. THE WAY IS OPEN.');
        SFX.unlock();
      } else {
        addMsg("LOCKED. FIND THE KEY.");
        SFX.doorLocked();
      }
    } else if (d.open < 0.1 && !d.opening) {
      d.opening = true;
      SFX.doorOpen();
    }
    return;
  }
}

// ---------- per-frame play update ----------
function updatePlay(dt) {
  const p = G.player;
  const lvl = G.level;

  // turning
  if (held('turnL')) p.a -= 2.7 * dt;
  if (held('turnR')) p.a += 2.7 * dt;

  // movement
  const run = held('run');
  const speed = (run ? 3.6 : 2.5) * dt;
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  let mx = 0, my = 0;
  if (held('forward')) { mx += dirX; my += dirY; }
  if (held('back')) { mx -= dirX; my -= dirY; }
  if (held('strafeL')) { mx += dirY; my -= dirX; }
  if (held('strafeR')) { mx -= dirY; my += dirX; }
  const ml = Math.hypot(mx, my);
  p.moving = ml > 0;
  if (ml > 0) {
    tryMove(lvl, p, (mx / ml) * speed, (my / ml) * speed, 0.24);
    p.bobPhase += dt * (run ? 11 : 8);
    p.stepAcc += dt * (run ? 11 : 8);
    if (p.stepAcc > Math.PI) { p.stepAcc -= Math.PI; SFX.step(); }
  }
  // ground follows you: up a ramp, down off a ledge
  settleZ(lvl, p, dt);

  // attack timeline
  if (p.atkCd > 0) p.atkCd -= dt;
  if (p.attackT > 0) {
    const w = weaponDef(p);
    p.attackT -= dt;
    if (!p.attackHitDone && p.attackT < (w ? w.hitAt : 0.2)) {
      p.attackHitDone = true;
      resolveAttack();
    }
  }

  // mana trickles back on its own; blue draughts are for emergencies
  if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + MANA_REGEN * dt);

  // doors animate
  for (const k in lvl.doors) {
    const d = lvl.doors[k];
    if (d.opening && d.open < 1) d.open = Math.min(1, d.open + dt * 1.6);
  }

  // explored map
  const px = p.x | 0, py = p.y | 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = px + dx, y = py + dy;
    if (x >= 0 && y >= 0 && x < lvl.w && y < lvl.h && dx * dx + dy * dy <= 12) {
      G.explored[y * lvl.w + x] = 1;
    }
  }

  // items
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    it.bob += dt * 3;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < 0.55) {
      if (it.type === 'item') {
        const def = ITEMS[it.item];
        if (!def) { G.items.splice(i, 1); continue; }
        if (invRoomFor(p.inv, it.item, 1)) {
          invAdd(p.inv, it.item, 1);
          if (def.kind === 'ammo' && !p.equip.ammo) equipItem(p, it.item);
          addMsg('PICKED UP ' + def.name);
          SFX.pickupItem();
        } else if (def.heal && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + def.heal);
          addMsg('PACK FULL - YOU DRINK IT. +' + def.heal);
          SFX.pickupPotion();
        } else if (def.mana && p.mp < p.maxMp) {
          p.mp = Math.min(p.maxMp, p.mp + def.mana);
          addMsg('PACK FULL - YOU DRINK IT. +' + def.mana);
          SFX.pickupMana();
        } else {
          if (!it.warned) { addMsg('YOUR PACK IS FULL'); it.warned = true; }
          continue; // leave it lying there
        }
      } else if (it.type === 'gold') {
        const v = ECONOMY.pileMin + ((Math.random() * ECONOMY.pileVary) | 0);
        p.gold += v;
        addMsg('PICKED UP ' + v + ' GOLD');
        SFX.pickupGold();
      } else if (it.type === 'key') {
        p.keys++;
        addMsg('YOU FOUND AN IRON KEY');
        SFX.pickupKey();
      } else if (it.type === 'quest') {
        fetchPickup(p, it.qid); // somebody's keepsake, carried, not packed
      } else if (it.type === 'relic') {
        relicPickup(p, it.qid); // a designer quest's prize, carried the same way
      } else if (it.type === 'portalkey') {
        // a key to somewhere: laid as a realm's prize, it unseals its portal
        const portal = G.portals[it.portal];
        if (portal && !p.portalKeys.includes(it.portal)) p.portalKeys.push(it.portal);
        addMsg(portal ? 'YOU FOUND THE KEY TO ' + portal.name : 'YOU FOUND A STRANGE KEY');
        SFX.pickupKey();
      } else if (it.type === 'crown') {
        G.crownTaken = true;
        markStairways(G.level); // the way deeper opens in the floor
        questComplete(p, 'crown');
        G.state = 'win';
        SFX.victory(); // the delve carries on, so the mouse stays captured
      }
      G.items.splice(i, 1);
    }
  }
  if (G.state !== 'play') return; // crown pickup may have ended the run

  G.clock = (G.clock + dt * HOURS_PER_SECOND) % 24;

  // the world mutters to itself now and then: birds, drips, worse
  G.ambientT -= dt;
  if (G.ambientT <= 0) {
    playAmbient();
    G.ambientT = 6 + Math.random() * 9;
  }

  updateVillagers(dt);
  updateEnemies(dt);
  updateProjectiles(dt);

  if (G.hurtT > 0) G.hurtT -= dt;
  if (G.shakeT > 0) G.shakeT -= dt;

  if (p.hp <= 0) {
    G.state = 'dead';
    SFX.death(); // released when Enter drops back to the title
  }
}

// ---------- villagers: they mill about, and that is all ----------
function makeVillager(x, y, i, role) {
  return {
    x, y, role: role || 'villager', kind: i % 3, line: i,
    dir: (i * 1.7) % (Math.PI * 2), dirT: 0,
    walkPhase: i, moving: false, idle: false,
    still: role === 'king', // the king does not pace about
  };
}

function updateVillagers(dt) {
  const lvl = G.level;
  for (const v of G.npcs) {
    if (v.still) { v.moving = false; continue; }
    v.dirT -= dt;
    if (v.dirT <= 0) {
      v.dir = Math.random() * Math.PI * 2;
      v.dirT = 1.5 + Math.random() * 3.5;
      v.idle = Math.random() < 0.35; // pause for a chat now and then
    }
    if (v.idle) { v.moving = false; continue; }
    const ox = v.x, oy = v.y;
    tryMove(lvl, v, Math.cos(v.dir) * 0.85 * dt, Math.sin(v.dir) * 0.85 * dt, 0.28);
    settleZ(lvl, v, dt);
    v.moving = Math.abs(v.x - ox) + Math.abs(v.y - oy) > 0.0005;
    if (!v.moving) v.dirT = 0; // walked into a wall, try somewhere else
    else v.walkPhase += dt * 5;
  }
}

// ---------- enemy AI ----------
function updateEnemies(dt) {
  const p = G.player;
  const lvl = G.level;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const st = ENEMY_STATS[e.type];

    if (e.hp <= 0) {
      G.stats.kills++;
      SFX.kill();
      if (Math.random() < st.drop) {
        G.items.push({ type: 'gold', x: e.x, y: e.y, bob: 0 });
      }
      // a slay quest's boss carries its prize; it falls where she does
      if (e.qid) {
        G.items.push({ type: 'relic', qid: e.qid, x: e.x, y: e.y, bob: Math.random() * 10 });
        addMsg('SOMETHING FALLS FROM HER HAND');
      }
      G.enemies.splice(i, 1);
      checkExterminateQuests(); // an emptied floor may finish an errand
      continue;
    }

    if (e.painT > 0) e.painT -= dt;
    if (e.cdT > 0) e.cdT -= dt;
    e.bob += dt * 4;

    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);

    // wake up on sight
    if (e.state === 'idle') {
      if (d < st.sight && lineOfSight(lvl, e.x, e.y, p.x, p.y)) {
        e.state = 'chase';
        if (d < 9) SFX[st.sfx]();
      } else {
        // slow wander
        e.dirT -= dt;
        if (e.dirT <= 0) { e.dir = Math.random() * Math.PI * 2; e.dirT = 1.5 + Math.random() * 2.5; }
        const ox = e.x, oy = e.y;
        tryMove(lvl, e, Math.cos(e.dir) * st.speed * 0.25 * dt, Math.sin(e.dir) * st.speed * 0.25 * dt, 0.28);
        settleZ(lvl, e, dt);
        if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < 0.001) e.dirT = 0;
        e.walkPhase += dt * 3;
        continue;
      }
    }

    // attack wind-up in progress: a swing about to land, or a hex gathering
    if (e.atkT > 0) {
      e.atkT -= dt;
      if (e.atkT <= 0) {
        if (e.casting) {
          e.casting = false;
          if (lineOfSight(lvl, e.x, e.y, p.x, p.y)) {
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            spawnProjectile('hex', 'shot_hex',
              e.x + Math.cos(a) * 0.4, e.y + Math.sin(a) * 0.4, a, st.bolt.dmg, st.bolt.vary);
            SFX.hexLoose();
          }
          e.cdT = st.bolt.cd;
        } else {
          if (d < st.range + 0.35) {
            p.hp -= st.dmg * (0.8 + Math.random() * 0.4) * (1 - armorSoak(p));
            G.hurtT = 0.35;
            G.shakeT = 0.25;
            SFX.enemyHitPlayer();
          }
          e.cdT = st.cd;
        }
      }
      continue;
    }

    // chase
    if (d > st.range) {
      // a caster stops to hurl her hex once you are in her sight and reach
      if (st.bolt && e.cdT <= 0 && d > 1.6 && d < st.bolt.range
          && lineOfSight(lvl, e.x, e.y, p.x, p.y)) {
        e.atkT = 0.55;
        e.casting = true;
        continue;
      }
      const hasLos = lineOfSight(lvl, e.x, e.y, p.x, p.y);
      let vx = dx / d, vy = dy / d;
      if (!hasLos) {
        // hug along walls: keep last dir with a drift toward player
        vx = Math.cos(e.dir) * 0.6 + vx * 0.4;
        vy = Math.sin(e.dir) * 0.6 + vy * 0.4;
        const vl = Math.hypot(vx, vy) || 1;
        vx /= vl; vy /= vl;
      } else {
        e.dir = Math.atan2(vy, vx);
      }
      // separation from other enemies
      for (const o of G.enemies) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        if (od > 0.001 && od < 0.7) { vx += (ox / od) * 0.5; vy += (oy / od) * 0.5; }
      }
      const vl = Math.hypot(vx, vy) || 1;
      const beforeX = e.x, beforeY = e.y;
      tryMove(lvl, e, (vx / vl) * st.speed * dt, (vy / vl) * st.speed * dt, 0.28);
      settleZ(lvl, e, dt);
      if (Math.abs(e.x - beforeX) + Math.abs(e.y - beforeY) < st.speed * dt * 0.2) {
        // stuck: pick a perpendicular escape direction
        e.dir += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2) + (Math.random() - 0.5);
      }
      e.walkPhase += dt * 7;
      // occasional growl
      e.soundT -= dt;
      if (e.soundT <= 0 && d < 8) { SFX[st.sfx](); e.soundT = 4 + Math.random() * 6; }
    } else if (e.cdT <= 0) {
      e.atkT = 0.35; // wind up
    }
  }
}
