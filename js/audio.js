// ---- WebAudio: retro synth sfx + dark ambient loop ----
'use strict';

const AudioSys = (() => {
  let ac = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let noiseBuf = null;
  let enabled = true;

  function init() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    // shared noise buffer
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function now() { return ac ? ac.currentTime : 0; }

  // basic enveloped oscillator
  function tone(type, f0, f1, dur, vol, delay) {
    if (!ac || !enabled) return;
    const t = now() + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, fLo, fHi, delay) {
    if (!ac || !enabled) return;
    const t = now() + (delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fHi, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, fLo), t + dur);
    bp.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // ---------- sfx ----------
  const sfx = {
    swing() { noise(0.16, 0.25, 300, 2400); },
    hit() { noise(0.12, 0.4, 120, 700); tone('square', 160, 60, 0.12, 0.25); },
    kill() { tone('sawtooth', 220, 30, 0.4, 0.22); noise(0.3, 0.3, 80, 500); },
    hurt() { tone('sawtooth', 120, 55, 0.3, 0.35); noise(0.2, 0.3, 100, 300); },
    step() { noise(0.06, 0.07, 90, 240); },
    pickupGold() { tone('square', 880, 880, 0.07, 0.16); tone('square', 1320, 1320, 0.09, 0.16, 0.07); },
    pickupPotion() { tone('triangle', 300, 600, 0.18, 0.25); tone('triangle', 450, 900, 0.18, 0.2, 0.09); },
    pickupKey() { tone('square', 660, 660, 0.08, 0.18); tone('square', 990, 990, 0.08, 0.18, 0.08); tone('square', 1320, 1320, 0.12, 0.18, 0.16); },
    doorOpen() { noise(0.5, 0.3, 60, 220); tone('sawtooth', 80, 45, 0.5, 0.12); },
    doorLocked() { tone('square', 110, 100, 0.1, 0.25); tone('square', 90, 80, 0.14, 0.25, 0.12); },
    unlock() { tone('square', 500, 500, 0.06, 0.2); tone('square', 750, 750, 0.1, 0.2, 0.08); noise(0.2, 0.2, 200, 800, 0.14); },
    stairs() { for (let i = 0; i < 5; i++) noise(0.12, 0.2, 80, 300, i * 0.14); },
    ratSqueak() { tone('square', 1400, 900, 0.09, 0.06); },
    skelRattle() { for (let i = 0; i < 3; i++) noise(0.04, 0.08, 700, 2000, i * 0.06); },
    wraithMoan() { tone('sine', 140, 90, 1.2, 0.1); tone('sine', 145, 88, 1.2, 0.08, 0.05); },
    enemyHitPlayer() { tone('sawtooth', 100, 40, 0.25, 0.3); noise(0.15, 0.3, 80, 260); },
    victory() {
      const seq = [523, 659, 784, 1047, 784, 1047];
      seq.forEach((f, i) => tone('square', f, f, 0.22, 0.2, i * 0.18));
    },
    death() {
      const seq = [220, 185, 147, 110, 73];
      seq.forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.5, 0.2, i * 0.3));
    },
  };

  // ---------- ambient music: slow minor drone + sparse arpeggio ----------
  const SCALE = [110, 130.8, 146.8, 164.8, 196, 220, 261.6, 293.7]; // A minor-ish
  let barCount = 0;

  function scheduleBar() {
    if (!ac || !enabled) return;
    const t = now();
    // deep drone root, alternating A / F
    const root = (barCount % 4 < 2) ? 55 : 43.65;
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
    if (barCount % 2 === 1) {
      const n1 = SCALE[(barCount * 3) % SCALE.length];
      const n2 = SCALE[(barCount * 5 + 2) % SCALE.length];
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
    barCount++;
  }

  function startMusic() {
    if (musicTimer) return;
    scheduleBar();
    musicTimer = setInterval(scheduleBar, 4000);
  }

  function toggle() {
    enabled = !enabled;
    if (master) master.gain.value = enabled ? 0.5 : 0;
    return enabled;
  }

  return { init, sfx, toggle, get enabled() { return enabled; } };
})();
