// ---- game/sfx: labyrinth sound effects + ambient music, built on engine/synth ----
'use strict';

const SFX = {
  swing() { Synth.noise(0.16, 0.25, 300, 2400); },
  hit() { Synth.noise(0.12, 0.4, 120, 700); Synth.tone('square', 160, 60, 0.12, 0.25); },
  kill() { Synth.tone('sawtooth', 220, 30, 0.4, 0.22); Synth.noise(0.3, 0.3, 80, 500); },
  hurt() { Synth.tone('sawtooth', 120, 55, 0.3, 0.35); Synth.noise(0.2, 0.3, 100, 300); },
  // a step sounds like the ground it lands on
  step() {
    const lvl = typeof G !== 'undefined' && G.level;
    if (lvl && lvl.outdoor) Synth.noise(0.07, 0.05, 200, 900);        // grass swish
    else if (lvl && lvl.isMine) Synth.noise(0.07, 0.07, 70, 180);     // packed dirt
    else Synth.noise(0.06, 0.07, 90, 240);                            // flagstones
  },
  pickupGold() { Synth.tone('square', 880, 880, 0.07, 0.16); Synth.tone('square', 1320, 1320, 0.09, 0.16, 0.07); },
  pickupPotion() { Synth.tone('triangle', 300, 600, 0.18, 0.25); Synth.tone('triangle', 450, 900, 0.18, 0.2, 0.09); },
  pickupKey() { Synth.tone('square', 660, 660, 0.08, 0.18); Synth.tone('square', 990, 990, 0.08, 0.18, 0.08); Synth.tone('square', 1320, 1320, 0.12, 0.18, 0.16); },
  doorOpen() { Synth.noise(0.5, 0.3, 60, 220); Synth.tone('sawtooth', 80, 45, 0.5, 0.12); },
  doorLocked() { Synth.tone('square', 110, 100, 0.1, 0.25); Synth.tone('square', 90, 80, 0.14, 0.25, 0.12); },
  unlock() { Synth.tone('square', 500, 500, 0.06, 0.2); Synth.tone('square', 750, 750, 0.1, 0.2, 0.08); Synth.noise(0.2, 0.2, 200, 800, 0.14); },
  stairs() { for (let i = 0; i < 5; i++) Synth.noise(0.12, 0.2, 80, 300, i * 0.14); },
  ratSqueak() { Synth.tone('square', 1400, 900, 0.09, 0.06); },
  skelRattle() { for (let i = 0; i < 3; i++) Synth.noise(0.04, 0.08, 700, 2000, i * 0.06); },
  wraithMoan() { Synth.tone('sine', 140, 90, 1.2, 0.1); Synth.tone('sine', 145, 88, 1.2, 0.08, 0.05); },
  enemyHitPlayer() { Synth.tone('sawtooth', 100, 40, 0.25, 0.3); Synth.noise(0.15, 0.3, 80, 260); },
  pickupMana() { Synth.tone('triangle', 420, 840, 0.18, 0.22); Synth.tone('sine', 630, 1260, 0.2, 0.16, 0.08); },
  pickupItem() { Synth.tone('square', 620, 780, 0.06, 0.14); Synth.noise(0.08, 0.1, 400, 1600, 0.04); },
  denied() { Synth.tone('square', 150, 110, 0.12, 0.2); },
  bowDraw() { Synth.noise(0.18, 0.08, 900, 2600); Synth.tone('sine', 200, 320, 0.2, 0.05); },
  bowLoose() { Synth.tone('triangle', 900, 260, 0.09, 0.2); Synth.noise(0.08, 0.18, 1200, 4000); },
  arrowThud() { Synth.noise(0.09, 0.22, 90, 420); },
  castCharge() { Synth.tone('sine', 260, 620, 0.22, 0.12); },
  castBolt() { Synth.tone('sawtooth', 620, 220, 0.22, 0.2); Synth.noise(0.14, 0.12, 600, 3000); },
  boltHit() { Synth.tone('square', 340, 90, 0.18, 0.24); Synth.noise(0.16, 0.22, 200, 2200); },
  buy() { Synth.tone('square', 780, 780, 0.06, 0.16); Synth.tone('square', 1040, 1040, 0.07, 0.16, 0.06); Synth.tone('square', 1560, 1560, 0.12, 0.14, 0.13); },
  equip() { Synth.noise(0.1, 0.2, 500, 2600); Synth.tone('square', 300, 420, 0.08, 0.14); },
  quest() { [523, 659, 784].forEach((f, i) => Synth.tone('triangle', f, f, 0.16, 0.16, i * 0.09)); },
  questDone() { [659, 784, 988, 1319].forEach((f, i) => Synth.tone('square', f, f, 0.16, 0.15, i * 0.1)); },
  talk() { Synth.tone('square', 300, 360, 0.05, 0.09); Synth.tone('square', 380, 340, 0.05, 0.08, 0.05); },
  menuMove() { Synth.tone('square', 440, 440, 0.04, 0.08); },
  menuSelect() { Synth.tone('square', 660, 660, 0.06, 0.12); Synth.tone('square', 880, 880, 0.08, 0.12, 0.06); },
  victory() {
    const seq = [523, 659, 784, 1047, 784, 1047];
    seq.forEach((f, i) => Synth.tone('square', f, f, 0.22, 0.2, i * 0.18));
  },
  death() {
    const seq = [220, 185, 147, 110, 73];
    seq.forEach((f, i) => Synth.tone('sawtooth', f, f * 0.9, 0.5, 0.2, i * 0.3));
  },
};

// ---------- music: one bar every four seconds, styled to where you stand ----------
// The overworld sings in a bright major; the labyrinth tightens as you sink;
// a mine creaks to itself; the title keeps the old drone that names the game.
let musicBarCount = 0;

// one enveloped voice into the music bus; the whole score is made of these
function mnote(type, freq, at, dur, vol, curve) {
  const ac = Synth.ctx, out = Synth.musicOut;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  if (curve === 'pad') {
    g.gain.linearRampToValueAtTime(vol, at + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
  } else {
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  o.connect(g); g.connect(out);
  o.start(at); o.stop(at + dur + 0.05);
}

// ---- the title: the slow minor drone the game has always worn ----
const MUSIC_SCALE = [110, 130.8, 146.8, 164.8, 196, 220, 261.6, 293.7]; // A minor-ish

function titleBar(t) {
  const root = (musicBarCount % 4 < 2) ? 55 : 43.65;
  mnote('triangle', root, t, 3.9, 0.5, 'pad');
  mnote('sine', root * 2.003, t, 3.9, 0.5, 'pad');
  if (musicBarCount % 2 === 1) {
    const n1 = MUSIC_SCALE[(musicBarCount * 3) % MUSIC_SCALE.length];
    const n2 = MUSIC_SCALE[(musicBarCount * 5 + 2) % MUSIC_SCALE.length];
    [n1 * 2, n2 * 2, n1 * 3].forEach((f, i) => mnote('sine', f, t + 0.8 + i * 1.0, 1.4, 0.35));
  }
}

// ---- the overworld: bright, melodic, and gentler after dark ----
// C major pentatonic over a I-vi-IV-V round: nothing in it can land sour,
// so the melody is free to wander a different path every bar.
const OW_PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
const OW_CHORDS = [
  [130.8, 196, 329.6],  // C
  [110, 164.8, 261.6],  // Am
  [87.3, 174.6, 261.6], // F
  [98, 196, 293.7],     // G
];

function overworldBar(t, night) {
  const chord = OW_CHORDS[musicBarCount % OW_CHORDS.length];
  // bass walks the chord in half notes
  mnote('triangle', chord[0], t, 1.9, night ? 0.3 : 0.42, 'pad');
  mnote('triangle', chord[1] / 2, t + 2, 1.9, night ? 0.24 : 0.34, 'pad');
  if (!night) {
    // day: a skipping square lead, eight steps to the bar, resting at whim
    let idx = 2 + ((musicBarCount * 3) % 4);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.22) { idx += (Math.random() < 0.5 ? -1 : 1); continue; } // a breath
      idx = clamp(idx + ((Math.random() * 3) | 0) - 1, 0, OW_PENTA.length - 1);
      const dur = Math.random() < 0.18 ? 0.85 : 0.42;
      mnote('square', OW_PENTA[idx], t + i * 0.5, dur, 0.16);
      if (i % 4 === 0) mnote('sine', OW_PENTA[idx] / 2, t + i * 0.5, 0.5, 0.1); // soft double
    }
  } else {
    // night: three long sine tones drifting down the same scale, half volume
    let idx = 4 + ((musicBarCount * 2) % 3);
    for (let i = 0; i < 3; i++) {
      idx = clamp(idx - ((Math.random() * 2) | 0), 0, OW_PENTA.length - 1);
      mnote('sine', OW_PENTA[idx], t + 0.4 + i * 1.2, 1.6, 0.16);
    }
    // and the chord's fifth held under it like held breath
    mnote('sine', chord[2] / 2, t, 3.8, 0.12, 'pad');
  }
}

// ---- the labyrinth: a tension that keeps pace with your depth ----
// A minor with a phrygian shadow. The flat second and the tritone join the
// pool as you sink, so the deep does not just play quieter dread -- it plays
// wronger notes.
const DG_CALM = [220, 261.6, 293.7, 329.6];        // A C D E
const DG_DREAD = [233.1, 311.1, 349.2, 415.3];     // Bb Eb F Ab

function dungeonBar(t, depth) {
  const menace = clamp(depth / 8, 0.1, 1); // floor 8 is full dread
  // the root and its octave: the octave is what small speakers actually hear
  const low = (musicBarCount % 4 < 2) ? 55 : 41.2; // A1 / E1
  mnote('triangle', low, t, 3.9, 0.4, 'pad');
  mnote('triangle', low * 2, t, 3.9, 0.3, 'pad');
  // a pair a couple of hertz apart: the beating is the unease
  mnote('sine', 220, t, 3.9, 0.07 + menace * 0.08, 'pad');
  mnote('sine', 220 + 1.5 + menace * 2.5, t, 3.9, 0.07 + menace * 0.08, 'pad');
  // a heartbeat that quickens as you sink; square for the audible knock
  const beats = 1 + Math.round(menace * 3);
  for (let i = 0; i < beats; i++) {
    const bt = t + i * (4 / beats);
    mnote('square', 82, bt, 0.1, 0.16);
    mnote('sine', 55, bt, 0.18, 0.4);
    mnote('square', 73, bt + 0.24, 0.09, 0.11);
    mnote('sine', 49, bt + 0.24, 0.16, 0.28);
  }
  // the motif: four slow notes every bar, drawn more from the dread pool
  // the deeper you stand. This is the part you hear as music.
  for (let i = 0; i < 4; i++) {
    if (i > 0 && Math.random() < 0.18) continue; // a held breath
    const pool = Math.random() < 0.25 + menace * 0.45 ? DG_DREAD : DG_CALM;
    const f = pool[(Math.random() * pool.length) | 0];
    mnote('triangle', f, t + i * 1.0 + 0.1, 1.3, 0.3);
    if (Math.random() < menace * 0.5) mnote('sine', f * 2, t + i * 1.0 + 0.1, 1.0, 0.08);
  }
  // sparse high bells, minor and -- deeper down -- tritone-sour
  if (Math.random() < 0.5) {
    const sour = Math.random() < menace;
    const f = sour ? 440 * 1.414 : 440 * 1.189; // tritone : minor third off A
    mnote('sine', f, t + 1 + Math.random() * 2, 1.6, 0.16 + menace * 0.08);
  }
}

// ---- a mine: timber settling in the dark, barely music at all ----
function mineBar(t) {
  mnote('triangle', 41.2, t, 3.9, 0.4, 'pad');  // E1, the rock itself
  mnote('triangle', 82.4, t, 3.9, 0.22, 'pad'); // and the octave you can hear
  // a slow creak: a saw bending downward through a semitone
  if (Math.random() < 0.6) {
    const ac = Synth.ctx;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const at = t + Math.random() * 2;
    o.frequency.setValueAtTime(90 + Math.random() * 40, at);
    o.frequency.exponentialRampToValueAtTime(70, at + 1.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.06, at + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, at + 1.4);
    o.connect(g); g.connect(Synth.musicOut);
    o.start(at); o.stop(at + 1.5);
  }
  // one hollow knock, somewhere off in the galleries
  if (Math.random() < 0.4) {
    const kt = t + 1 + Math.random() * 2.5;
    mnote('square', 165, kt, 0.08, 0.1);
    mnote('sine', 82, kt, 0.3, 0.24);
  }
}

function musicBar() {
  if (!Synth.ready || !Synth.enabled) return;
  const t = Synth.now();
  const lvl = typeof G !== 'undefined' && G.level;
  const onTitle = !lvl || G.state === 'title'
    || (G.menu.cameFrom === 'title' && ['options', 'help', 'loadmenu'].includes(G.state));
  if (onTitle) {
    titleBar(t);
  } else if (lvl.outdoor) {
    overworldBar(t, lampsLit(G.clock));
  } else if (lvl.isMine) {
    mineBar(t);
  } else {
    dungeonBar(t, lvl.floorNum || 1);
  }
  musicBarCount++;
}

// ---------- ambient one-shots: the world muttering to itself ----------
// Called from the play loop on a random timer; picks a sound that belongs
// to wherever the player is standing. All of them are quiet and distant.
const AMBIENT = {
  // under the sky
  bird() {
    const base = 1800 + Math.random() * 900;
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      Synth.tone('sine', base + Math.random() * 400, base - 200, 0.07, 0.05, i * (0.09 + Math.random() * 0.05));
    }
  },
  breeze() { Synth.noise(1.6, 0.03, 150, 500); },
  gullsAndWaves() { Synth.noise(2.2, 0.035, 90, 320); Synth.tone('sine', 1100, 700, 0.25, 0.03, 0.4); },
  cricket() {
    for (let i = 0; i < 6; i++) Synth.tone('square', 4200, 4100, 0.03, 0.018, i * 0.09);
  },
  owl() { Synth.tone('sine', 340, 300, 0.28, 0.05); Synth.tone('sine', 320, 280, 0.4, 0.05, 0.35); },
  wolf() { Synth.tone('sine', 380, 520, 0.5, 0.03); Synth.tone('sine', 520, 300, 1.1, 0.03, 0.5); },
  // under the ground
  drip() {
    Synth.tone('sine', 1200, 700, 0.05, 0.09);
    Synth.tone('sine', 900, 500, 0.08, 0.05, 0.13);
  },
  rumble() { Synth.noise(2.4, 0.06, 40, 110); },
  moan() { Synth.tone('sine', 120 + Math.random() * 40, 75, 1.8, 0.045); },
  chains() { for (let i = 0; i < 4; i++) Synth.noise(0.05, 0.045, 900, 2600, i * (0.1 + Math.random() * 0.08)); },
  whisper() { Synth.noise(0.9, 0.028, 2200, 5200); },
  skitter() { for (let i = 0; i < 5; i++) Synth.noise(0.03, 0.03, 500, 1600, i * 0.05); },
  // in a mine
  creak() { Synth.tone('sawtooth', 130, 85, 0.9, 0.035); },
  pebbles() { for (let i = 0; i < 4; i++) Synth.noise(0.04, 0.05, 300 + i * 150, 900, i * 0.07 + Math.random() * 0.03); },
};

function pickAmbient(list) { return AMBIENT[list[(Math.random() * list.length) | 0]]; }

function playAmbient() {
  if (!Synth.ready || !Synth.enabled) return;
  const lvl = G.level;
  if (!lvl) return;
  if (lvl.outdoor) {
    const night = lampsLit(G.clock);
    pickAmbient(night ? ['cricket', 'cricket', 'owl', 'breeze', 'wolf']
      : ['bird', 'bird', 'bird', 'breeze', 'gullsAndWaves'])();
  } else if (lvl.isMine) {
    pickAmbient(['creak', 'creak', 'pebbles', 'drip', 'drip', 'rumble'])();
  } else {
    // the deep gets less water and more voices
    const deep = clamp((lvl.floorNum || 1) / 8, 0, 1);
    const list = Math.random() < 0.45 - deep * 0.25
      ? ['drip', 'drip', 'skitter']
      : ['moan', 'chains', 'whisper', 'rumble', 'skitter'];
    pickAmbient(list)();
  }
}

// call from a user-gesture handler; idempotent
function initAudio() {
  Synth.setMusic(musicBar, 4000);
  Synth.init();
}
