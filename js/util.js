// ---- small utilities shared by all modules ----
'use strict';

// Deterministic seeded RNG (mulberry32)
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, lo, hi) { // inclusive
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }

// pack r,g,b (0-255) into little-endian ABGR uint32 for ImageData buffers
function rgb(r, g, b) {
  return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}

// posterize a channel to chunky DOS-ish steps
function post(v) { return clamp(Math.round(v / 16) * 16, 0, 255); }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// grab Uint32 pixel view of a canvas
function canvasPixels(c) {
  const g = c.getContext('2d');
  const id = g.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: new Uint32Array(id.data.buffer) };
}
