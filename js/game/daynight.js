// ---- game/daynight: the surface clock, sky and lighting ----
// One real minute is one hour underneath the sky. Dawn breaks at 6, full day
// runs 7 to 21, dusk falls at 21, and night holds from 22 until dawn.
'use strict';

const HOURS_PER_SECOND = 1 / 60;
const CLOCK_START = 8;          // a new run opens mid-morning
const DAWN = 6, DAY = 7, DUSK = 21, NIGHT = 22;
const LAMPS_ON = DUSK, LAMPS_OFF = DAWN;
const WINDOWS_ON = 18, WINDOWS_OFF = 23;

const NIGHT_AMBIENT = 0.30;
const NIGHT_FOG_K = 0.020;      // night closes in around you
const DAY_FOG_K = 0.0035;       // daylight opens the view to the hills

// 0 at night, 1 in full day, ramping across dawn and dusk
function daylight(h) {
  if (h >= DAY && h < DUSK) return 1;
  if (h >= DAWN && h < DAY) return h - DAWN;
  if (h >= DUSK && h < NIGHT) return 1 - (h - DUSK);
  return 0;
}

function dayPhase(h) {
  if (h >= DAY && h < DUSK) return 'DAY';
  if (h >= DAWN && h < DAY) return 'DAWN';
  if (h >= DUSK && h < NIGHT) return 'DUSK';
  return 'NIGHT';
}

function ambientLight(h) { return lerp(NIGHT_AMBIENT, 1, daylight(h)); }
function ambientFogK(h) { return lerp(NIGHT_FOG_K, DAY_FOG_K, daylight(h)); }
function lampsLit(h) { return h >= LAMPS_ON || h < LAMPS_OFF; }
function windowsLit(h) { return h >= WINDOWS_ON && h < WINDOWS_OFF; }

function clockText(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}

// ---------- sky panorama ----------
const SKY_W = 256, SKY_H = 64; // width must be a power of two
const SkyTex = { w: SKY_W, h: SKY_H, data: new Uint32Array(SKY_W * SKY_H) };

// zenith and horizon colours through the day; the last entry wraps to the first
const SKY_KEYS = [
  { h: 0,    zenith: [8, 10, 30],    horizon: [18, 22, 48] },
  { h: 5,    zenith: [14, 18, 46],   horizon: [46, 36, 62] },
  { h: 6,    zenith: [44, 58, 112],  horizon: [214, 112, 68] },
  { h: 7.5,  zenith: [72, 124, 202], horizon: [176, 204, 232] },
  { h: 13,   zenith: [56, 118, 212], horizon: [148, 190, 228] },
  { h: 18,   zenith: [64, 116, 196], horizon: [196, 192, 186] },
  { h: 21,   zenith: [58, 60, 130],  horizon: [232, 118, 58] },
  { h: 22,   zenith: [18, 20, 54],   horizon: [62, 42, 72] },
  { h: 24,   zenith: [8, 10, 30],    horizon: [18, 22, 48] },
];

const STARS = [];
const CLOUD = new Float32Array(SKY_W * SKY_H);
let skyBuiltAt = -99;

function initSky() {
  const rng = makeRng(0x5EED5C1);
  STARS.length = 0;
  for (let i = 0; i < 150; i++) {
    STARS.push({
      u: (rng() * SKY_W) | 0,
      v: (rng() * SKY_H * 0.82) | 0,
      b: 0.35 + rng() * 0.65,
    });
  }
  // banded cloud, thinning toward the zenith
  for (let v = 0; v < SKY_H; v++) for (let u = 0; u < SKY_W; u++) {
    const n = Math.sin(u * 0.06 + Math.sin(v * 0.14) * 2) * Math.cos(v * 0.22 + Math.sin(u * 0.03) * 3);
    let c = clamp((n * 0.5 + 0.5 - 0.55) / 0.45, 0, 1);
    c = c * c;
    CLOUD[v * SKY_W + u] = c * clamp((v / SKY_H) * 1.7, 0, 1);
  }
}

function skyStops(h) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i].h && h <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = (h - a.h) / ((b.h - a.h) || 1);
  const mix = (key) => [0, 1, 2].map(k => lerp(a[key][k], b[key][k], t));
  return { zenith: mix('zenith'), horizon: mix('horizon') };
}

// paint a sun or moon, wrapping around the seam
function skyBody(az, el, r, core, halo) {
  const d = SkyTex.data;
  const cu = (az / TAU) * SKY_W, cv = (1 - el) * (SKY_H - 1);
  const reach = Math.ceil(r * 2.2);
  for (let dv = -reach; dv <= reach; dv++) {
    const v = Math.round(cv + dv);
    if (v < 0 || v >= SKY_H) continue;
    for (let du = -reach; du <= reach; du++) {
      const dist = Math.hypot(du, dv);
      if (dist > reach) continue;
      let u = Math.round(cu + du) % SKY_W;
      if (u < 0) u += SKY_W;
      const i = v * SKY_W + u;
      const c = d[i];
      const inside = dist <= r;
      const k = inside ? 1 : clamp(1 - (dist - r) / (reach - r), 0, 1) * 0.55;
      const col = inside ? core : halo;
      d[i] = rgb(
        post(lerp(c & 255, col[0], k)),
        post(lerp((c >> 8) & 255, col[1], k)),
        post(lerp((c >> 16) & 255, col[2], k)));
    }
  }
}

function buildSky(h) {
  const { zenith, horizon } = skyStops(h);
  const day = daylight(h);
  const d = SkyTex.data;
  const cloudLit = 0.3 + day * 0.7;
  for (let v = 0; v < SKY_H; v++) {
    const t = Math.pow(v / (SKY_H - 1), 0.8);
    const r0 = lerp(zenith[0], horizon[0], t);
    const g0 = lerp(zenith[1], horizon[1], t);
    const b0 = lerp(zenith[2], horizon[2], t);
    for (let u = 0; u < SKY_W; u++) {
      const cl = CLOUD[v * SKY_W + u] * (0.3 + day * 0.7);
      d[v * SKY_W + u] = rgb(
        post(clamp(lerp(r0, 214 * cloudLit, cl), 0, 255)),
        post(clamp(lerp(g0, 210 * cloudLit, cl), 0, 255)),
        post(clamp(lerp(b0, 206 * cloudLit, cl), 0, 255)));
    }
  }

  const starA = 1 - day;
  if (starA > 0.04) {
    for (const s of STARS) {
      const i = s.v * SKY_W + s.u;
      const c = d[i], k = s.b * starA;
      d[i] = rgb(
        post(lerp(c & 255, 255, k)),
        post(lerp((c >> 8) & 255, 255, k)),
        post(lerp((c >> 16) & 255, 248, k)));
    }
  }

  if (h >= DAWN && h <= DUSK) {
    const t = (h - DAWN) / (DUSK - DAWN);
    skyBody(Math.PI * t, Math.sin(Math.PI * t) * 0.92, 5, [255, 246, 200], [255, 210, 120]);
  } else {
    const t = (h >= DUSK ? h - DUSK : h + (24 - DUSK)) / (24 - DUSK + DAWN);
    skyBody(Math.PI * t, Math.sin(Math.PI * t) * 0.85, 4, [230, 232, 242], [140, 150, 190]);
  }
  skyBuiltAt = h;
}

// the sea rolls, the windows warm up, the lamps take the sky's cue
function updateSurfaceLighting() {
  const h = G.clock;
  if (Math.abs(h - skyBuiltAt) > 0.02 || skyBuiltAt < 0) buildSky(h);
  if (SeaFrames.length) Textures[T_SEA] = SeaFrames[((G.time * 2) | 0) % SeaFrames.length];
  const lit = windowsLit(h);
  Textures[T_WINDOW] = lit ? WindowArt.lit : WindowArt.dark;
  TILE_DEFS[T_WINDOW].glow = lit;
}
