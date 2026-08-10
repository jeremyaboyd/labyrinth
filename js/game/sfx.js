// ---- game/sfx: labyrinth sound effects + ambient music, built on engine/synth ----
'use strict';

const SFX = {
  swing() { Synth.noise(0.16, 0.25, 300, 2400); },
  hit() { Synth.noise(0.12, 0.4, 120, 700); Synth.tone('square', 160, 60, 0.12, 0.25); },
  kill() { Synth.tone('sawtooth', 220, 30, 0.4, 0.22); Synth.noise(0.3, 0.3, 80, 500); },
  hurt() { Synth.tone('sawtooth', 120, 55, 0.3, 0.35); Synth.noise(0.2, 0.3, 100, 300); },
  step() { Synth.noise(0.06, 0.07, 90, 240); },
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

// ---------- ambient music: slow minor drone + sparse arpeggio ----------
const MUSIC_SCALE = [110, 130.8, 146.8, 164.8, 196, 220, 261.6, 293.7]; // A minor-ish
let musicBarCount = 0;

function musicBar() {
  if (!Synth.ready || !Synth.enabled) return;
  const ac = Synth.ctx, musicGain = Synth.musicOut;
  const t = Synth.now();
  // deep drone root, alternating A / F
  const root = (musicBarCount % 4 < 2) ? 55 : 43.65;
  const o = ac.createOscillator(); o.type = 'triangle';
  const o2 = ac.createOscillator(); o2.type = 'sine';
  o.frequency.value = root; o2.frequency.value = root * 2.003;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 1.2);
  g.gain.linearRampToValueAtTime(0.0001, t + 3.9);
  o.connect(g); o2.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 4); o2.start(t); o2.stop(t + 4);
  // sparse bell arpeggio every other bar
  if (musicBarCount % 2 === 1) {
    const n1 = MUSIC_SCALE[(musicBarCount * 3) % MUSIC_SCALE.length];
    const n2 = MUSIC_SCALE[(musicBarCount * 5 + 2) % MUSIC_SCALE.length];
    [n1 * 2, n2 * 2, n1 * 3].forEach((f, i) => {
      const ot = ac.createOscillator(); ot.type = 'sine';
      ot.frequency.value = f;
      const gt = ac.createGain();
      const tt = t + 0.8 + i * 1.0;
      gt.gain.setValueAtTime(0.0001, tt);
      gt.gain.exponentialRampToValueAtTime(0.35, tt + 0.02);
      gt.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      ot.connect(gt); gt.connect(musicGain);
      ot.start(tt); ot.stop(tt + 1.5);
    });
  }
  musicBarCount++;
}

// call from a user-gesture handler; idempotent
function initAudio() {
  Synth.setMusic(musicBar, 4000);
  Synth.init();
}
