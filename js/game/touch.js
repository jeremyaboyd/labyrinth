// ---- game/touch: gamepad-style touch controls for coarse-pointer devices ----
// An 8-way pad on the left walks, a rocker on the right turns, A/B/X/Y do
// use/attack/map/journal, and a MENU pill on the bezel is Tab. Everything is
// fed through Input.setDown as synthetic key codes, so every screen keeps its
// keyboard semantics untouched. One deviation, per the design: B is BACK (Tab)
// inside any screen that is not play, the way a gamepad's B usually is.
// Multi-touch: each control tracks its own touch by identifier, so walking,
// turning and firing all at once works.
'use strict';

// assigned onto window so main.js's fitCanvas can probe it safely at any time
window.TouchUI = (() => {
  // phones and tablets have a coarse primary pointer; ?touch=1/0 overrides
  const qs = location.search;
  const active = /[?&]touch=1/.test(qs)
    || (!/[?&]touch=0/.test(qs)
      && window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if (!active) return { active: false, reserve: () => ({ x: 0, y: 0 }) };

  const SIDE = 156;   // width reserved each side of the screen, landscape
  const BOTTOM = 190; // height reserved under the screen, portrait
  const BEZEL = 44;   // bezel strip that carries the MENU pill

  function portrait() { return window.innerHeight > window.innerWidth; }
  function reserve() {
    return portrait() ? { x: 12, y: BOTTOM + BEZEL } : { x: SIDE * 2 + 16, y: BEZEL };
  }

  // ---------- chrome ----------
  const style = document.createElement('style');
  style.textContent = `
    .tui { position: fixed; z-index: 10; user-select: none; -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent; touch-action: none; }
    #tuiMove { left: 10px; bottom: 24px; width: 132px; height: 132px; }
    #tuiRight { right: 10px; bottom: 24px; width: 136px; height: 168px; }
    /* the 8-way pad: a classic cross, lit per-arm from JS */
    #tuiMove .arm { position: absolute; background: #1c1712; border: 1px solid #3a3028;
      border-radius: 6px; }
    #tuiMove .h { left: 0; right: 0; top: 44px; height: 44px; }
    #tuiMove .v { top: 0; bottom: 0; left: 44px; width: 44px; }
    #tuiMove .cap { position: absolute; left: 50px; top: 50px; width: 32px; height: 32px;
      border-radius: 50%; background: #0e0b08; border: 1px solid #3a3028; }
    #tuiMove .dot { position: absolute; width: 10px; height: 10px; border-radius: 50%;
      background: #6a5a40; left: 61px; top: 61px; transition: transform 60ms; }
    /* right cluster: ABXY diamond above, the turn rocker under the thumb */
    .tuiBtn { position: absolute; width: 46px; height: 46px; border-radius: 50%;
      background: #1c1712; border: 1px solid #3a3028; color: #8a8078;
      font: bold 16px monospace; display: flex; align-items: center; justify-content: center; }
    #tuiY { left: 45px; top: 0; }    #tuiX { left: 0;  top: 38px; }
    #tuiB { left: 90px; top: 38px; } #tuiA { left: 45px; top: 76px; }
    #tuiRock { position: absolute; left: 0; right: 0; bottom: 0; height: 40px;
      display: flex; border: 1px solid #3a3028; border-radius: 8px; overflow: hidden; }
    #tuiRock div { flex: 1; background: #1c1712; color: #8a8078; display: flex;
      align-items: center; justify-content: center; font: bold 15px monospace; }
    #tuiRock div:first-child { border-right: 1px solid #3a3028; }
    #tuiMenu { left: 50%; transform: translateX(-50%); bottom: 8px; width: 88px;
      height: 26px; border-radius: 13px; background: #1c1712; border: 1px solid #3a3028;
      color: #8a8078; font: bold 11px monospace; display: flex; align-items: center;
      justify-content: center; letter-spacing: 2px; }
    .tui .on, .tuiBtn.on { background: #3a3028 !important; color: #ffe080 !important;
      border-color: #6a5a40 !important; }
    /* the screen sits in a bezel between the pads */
    body.tui-on #screen { border: 5px solid #14100c; border-radius: 4px; }
    body.tui-on { cursor: default; }
    body.tui-portrait #frame { align-items: flex-start; padding-top: 10px; }
  `;
  document.head.appendChild(style);

  const el = (id, cls, html, parent) => {
    const d = document.createElement('div');
    d.id = id;
    if (cls) d.className = cls;
    if (html) d.innerHTML = html;
    (parent || document.body).appendChild(d);
    return d;
  };

  const move = el('tuiMove', 'tui',
    '<div class="arm h"></div><div class="arm v"></div><div class="cap"></div><div class="dot"></div>');
  const right = el('tuiRight', 'tui',
    '<div id="tuiY" class="tuiBtn">Y</div><div id="tuiX" class="tuiBtn">X</div>'
    + '<div id="tuiB" class="tuiBtn">B</div><div id="tuiA" class="tuiBtn">A</div>'
    + '<div id="tuiRock"><div id="tuiL">&lt;</div><div id="tuiR">&gt;</div></div>');
  const menu = el('tuiMenu', 'tui', 'MENU');

  function layout() {
    document.body.classList.add('tui-on');
    document.body.classList.toggle('tui-portrait', portrait());
    fitCanvas();
  }
  window.addEventListener('resize', layout);

  // ---------- the 8-way walking pad ----------
  // octants from +x clockwise (screen y grows downward)
  const DIRS = [
    ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'],
    ['KeyA'], ['KeyW', 'KeyA'], ['KeyW'], ['KeyW', 'KeyD'],
  ];
  let moveTouch = null;   // touch identifier driving the pad
  let moveCodes = [];     // codes currently held by the pad
  const dot = move.querySelector('.dot');

  function setMoveCodes(codes) {
    for (const c of moveCodes) if (!codes.includes(c)) Input.setDown(c, false);
    for (const c of codes) if (!moveCodes.includes(c)) Input.setDown(c, true);
    moveCodes = codes;
  }

  function padPoint(t) {
    const r = move.getBoundingClientRect();
    const dx = t.clientX - (r.left + r.width / 2);
    const dy = t.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) { setMoveCodes([]); dot.style.transform = ''; return; }
    const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    setMoveCodes(DIRS[oct]);
    const a = oct * Math.PI / 4;
    dot.style.transform = 'translate(' + Math.round(Math.cos(a) * 34) + 'px,' + Math.round(Math.sin(a) * 34) + 'px)';
  }

  move.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (moveTouch === null) { moveTouch = e.changedTouches[0].identifier; padPoint(e.changedTouches[0]); }
  }, { passive: false });
  move.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === moveTouch) padPoint(t);
  }, { passive: false });
  const moveEnd = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === moveTouch) { moveTouch = null; setMoveCodes([]); dot.style.transform = ''; }
    }
  };
  move.addEventListener('touchend', moveEnd, { passive: false });
  move.addEventListener('touchcancel', moveEnd, { passive: false });

  // ---------- the turn rocker ----------
  const rock = right.querySelector('#tuiRock');
  const rockL = right.querySelector('#tuiL'), rockR = right.querySelector('#tuiR');
  let rockTouch = null, rockCode = null;

  function rockSide(t) {
    const r = rock.getBoundingClientRect();
    const code = t.clientX < r.left + r.width / 2 ? 'ArrowLeft' : 'ArrowRight';
    if (code !== rockCode) {
      if (rockCode) Input.setDown(rockCode, false);
      Input.setDown(code, true);
      rockCode = code;
      rockL.classList.toggle('on', code === 'ArrowLeft');
      rockR.classList.toggle('on', code === 'ArrowRight');
    }
  }

  rock.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (rockTouch === null) { rockTouch = e.changedTouches[0].identifier; rockSide(e.changedTouches[0]); }
  }, { passive: false });
  rock.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === rockTouch) rockSide(t);
  }, { passive: false });
  const rockEnd = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === rockTouch) {
        rockTouch = null;
        if (rockCode) Input.setDown(rockCode, false);
        rockCode = null;
        rockL.classList.remove('on');
        rockR.classList.remove('on');
      }
    }
  };
  rock.addEventListener('touchend', rockEnd, { passive: false });
  rock.addEventListener('touchcancel', rockEnd, { passive: false });

  // ---------- buttons ----------
  // The code is decided at press time: B is attack in play, BACK anywhere else.
  // Whatever a touch pressed is what it releases, even if the state changed.
  function buttonCode(name) {
    if (name === 'B') return G.state === 'play' ? 'Space' : 'Tab';
    return { A: 'KeyE', X: 'KeyM', Y: 'KeyJ', MENU: 'Tab' }[name];
  }

  let bHeld = false; // for hold-to-keep-shooting
  function wireButton(node, name) {
    const held = {}; // touch id -> code it pressed
    node.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const code = buttonCode(name);
        held[t.identifier] = code;
        Input.setDown(code, true);
        if (name === 'B') bHeld = true;
        node.classList.add('on');
      }
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const code = held[t.identifier];
        if (code === undefined) continue;
        delete held[t.identifier];
        Input.setDown(code, false);
      }
      if (!Object.keys(held).length) {
        node.classList.remove('on');
        if (name === 'B') bHeld = false;
      }
    };
    node.addEventListener('touchend', end, { passive: false });
    node.addEventListener('touchcancel', end, { passive: false });
  }
  wireButton(right.querySelector('#tuiA'), 'A');
  wireButton(right.querySelector('#tuiB'), 'B');
  wireButton(right.querySelector('#tuiX'), 'X');
  wireButton(right.querySelector('#tuiY'), 'Y');
  wireButton(menu, 'MENU');

  // a held B keeps loosing; startAttack gates itself on the weapon's cooldown.
  // (Held keyboard space does not repeat, but a held trigger should.)
  setInterval(() => {
    if (bHeld && G.state === 'play' && Input.isDown('Space')) startAttack();
  }, 90);

  // no pointer lock on a touch screen: swallow the canvas click that asks for
  // it before Input's own listener sees it
  document.addEventListener('click', (e) => {
    if (e.target === canvas) e.stopPropagation();
  }, true);

  return { active: true, reserve, layout };
})();

// first layout runs after the assignment above, so fitCanvas sees the reserve
if (TouchUI.active) TouchUI.layout();
