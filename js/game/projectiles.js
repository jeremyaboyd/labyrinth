// ---- game/projectiles: arrows and magic bolts in flight ----
// Sub-stepped so a fast shot cannot tunnel through a wall or a rat.
'use strict';

const PROJ_SPEED = { arrow: 15, bolt: 11 };
const PROJ_HIT_R = 0.42;
const PROJ_SUBSTEPS = 4;

function spawnProjectile(kind, sprite, x, y, a, dmg, vary) {
  G.projectiles.push({
    kind, sprite, x, y,
    vx: Math.cos(a) * PROJ_SPEED[kind],
    vy: Math.sin(a) * PROJ_SPEED[kind],
    dmg, vary, life: 2.5, phase: Math.random() * 10,
  });
}

function projectileImpact(pr, hitFlesh) {
  if (pr.kind === 'bolt') SFX.boltHit();
  else if (hitFlesh) SFX.hit();
  else SFX.arrowThud();
}

function updateProjectiles(dt) {
  const lvl = G.level;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.phase += dt * 14;
    pr.life -= dt;
    if (pr.life <= 0) { G.projectiles.splice(i, 1); continue; }

    let dead = false;
    for (let s = 0; s < PROJ_SUBSTEPS && !dead; s++) {
      pr.x += pr.vx * dt / PROJ_SUBSTEPS;
      pr.y += pr.vy * dt / PROJ_SUBSTEPS;
      if (solidAt(lvl, pr.x, pr.y)) { projectileImpact(pr, false); dead = true; break; }
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) > PROJ_HIT_R) continue;
        e.hp -= pr.dmg + Math.random() * pr.vary;
        e.painT = 0.18;
        e.state = 'chase';
        tryMove(lvl, e, pr.vx * 0.018, pr.vy * 0.018, 0.3); // knockback
        projectileImpact(pr, true);
        dead = true;
        break;
      }
    }
    if (dead) G.projectiles.splice(i, 1);
  }
}

// billboards for the render pass; bolts flicker between two frames
function projectileBillboards(out) {
  for (const pr of G.projectiles) {
    const frames = SPRITES[pr.sprite];
    if (!frames) continue;
    const img = frames[frames.length > 1 ? ((pr.phase | 0) % frames.length) : 0];
    out.push({
      x: pr.x, y: pr.y, img,
      hFrac: pr.kind === 'bolt' ? 0.22 : 0.16,
      zOff: 0.22,
      glow: pr.kind === 'bolt',
    });
  }
}
