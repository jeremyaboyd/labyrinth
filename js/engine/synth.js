// ---- engine/synth: generic WebAudio synthesis kit ----
// No game knowledge: exposes enveloped oscillators, filtered noise bursts,
// a master/music bus, and a pluggable music scheduler callback.
'use strict';

const Synth = (() => {
  let ac = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  let enabled = true;
  let musicTimer = null;
  let musicFn = null;
  let musicMs = 4000;
  // slider positions, 0..1; kept here so they can be set before the context
  // exists and applied the moment it does
  let musicVol = 0.7;
  let sfxVol = 0.6;

  function applyVolumes() {
    // music tops out at 4x its old fixed level, effects at 2x theirs
    if (musicGain) musicGain.gain.value = musicVol * 0.64;
    if (sfxGain) sfxGain.gain.value = sfxVol * 2;
  }

  function startMusicTimer() {
    if (musicTimer || !musicFn || !ac) return;
    musicFn();
    musicTimer = setInterval(() => { if (enabled) musicFn(); }, musicMs);
  }

  // idempotent; call from a user-gesture handler so the context may start
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
    musicGain.connect(master);
    sfxGain = ac.createGain();
    sfxGain.connect(master);
    applyVolumes();
    // shared noise buffer
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusicTimer();
  }

  // register the music bar callback; starts once the context exists
  function setMusic(fn, intervalMs) {
    musicFn = fn;
    musicMs = intervalMs || 4000;
    startMusicTimer();
  }

  function now() { return ac ? ac.currentTime : 0; }

  // basic enveloped oscillator sweep
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
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // bandpass-swept noise burst
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
    src.connect(bp); bp.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // hear the music level while dragging its slider: one short bright tone
  // through the music bus itself
  function musicBlip() {
    if (!ac || !enabled) return;
    const t = now();
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 440;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.35);
  }

  function setVolumes(music01, sfx01) {
    musicVol = clamp(music01, 0, 1);
    sfxVol = clamp(sfx01, 0, 1);
    applyVolumes();
  }

  function toggle() {
    enabled = !enabled;
    if (master) master.gain.value = enabled ? 0.5 : 0;
    return enabled;
  }

  return {
    init, setMusic, now, tone, noise, toggle, setVolumes, musicBlip,
    get ready() { return !!ac; },
    get enabled() { return enabled; },
    get ctx() { return ac; },
    get musicOut() { return musicGain; },
  };
})();
