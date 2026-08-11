// ---- game/touch: gamepad-style touch controls for coarse-pointer devices ----
// An 8-way pad on the left walks, a rocker on the right turns, A/B/X/Y do
// use/attack/map/journal, and a MENU pill above them is Tab. Everything is
// fed through Input.setDown as synthetic key codes, so every screen keeps its
// keyboard semantics untouched. One deviation, per the design: B is BACK (Tab)
// inside any screen that is not play, the way a gamepad's B usually is.
// Multi-touch: each control tracks its own touch by identifier, so walking,
// turning and firing all at once works.
// Both orientations play: portrait stacks the screen over the pads, landscape
// sets the pads either side of it. Safe-area insets are honoured both ways, so
// nothing lands under a notch or a home indicator.
'use strict';

// assigned onto window so main.js's fitCanvas can probe it safely at any time
window.TouchUI = (() => {
  // phones and tablets have a coarse primary pointer; ?touch=1/0 overrides
  const qs = location.search;
  const active = /[?&]touch=1/.test(qs)
    || (!/[?&]touch=0/.test(qs)
      && window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if (!active) return { active: false, reserve: () => ({ x: 0, y: 0 }) };

  const SIDE = 156;  // width reserved each side of the screen, landscape
  const CLUSTER = 204; // height of the right-hand cluster: MENU, ABXY, rocker
  // the left column is the taller of the two: pad well plus the shoulder row
  const LEFTCOL = 233;
  const COLUMN = Math.max(CLUSTER, LEFTCOL);
  const LIFT = 56;   // how far the pads sit off the bottom edge, portrait
  const LIFT_L = 28; // ditto landscape, where there is less height to give

  function portrait() { return window.innerHeight > window.innerWidth; }

  // The notch and the home indicator, measured rather than guessed: env() is
  // only legible to CSS, so a hidden probe wearing them as padding reports all
  // four back. Landscape needs the side insets as much as portrait needs the
  // bottom one — in landscape the notch is beside the left-hand pad.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;'
    + 'pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px)'
    + ' env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  document.body.appendChild(probe);
  function insets() {
    const s = getComputedStyle(probe);
    return {
      r: Math.round(parseFloat(s.paddingRight) || 0),
      b: Math.round(parseFloat(s.paddingBottom) || 0),
      l: Math.round(parseFloat(s.paddingLeft) || 0),
    };
  }

  function reserve() {
    const i = insets();
    return portrait()
      ? { x: 12 + i.l + i.r, y: LIFT + COLUMN + 12 + i.b }
      : { x: SIDE * 2 + 16 + i.l + i.r, y: 12 + i.b };
  }

  // ---------- chrome ----------
  // Styled after the 90s pads this game grew up with: a round recessed well
  // holding a molded cross on the left, convex round buttons on a dished
  // plate on the right, and a little START-style pill on the bezel. Dark
  // charcoal over dark brown, lit from the upper left the way molded plastic
  // catches the light.
  const style = document.createElement('style');
  style.textContent = `
    .tui { position: fixed; z-index: 10; user-select: none; -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent; }
    /* touch-action does not inherit, and every part of a pad must swallow
       scrolling and double-tap zoom, not just its outer box */
    .tui, .tui * { touch-action: none; }
    /* the round well the d-pad sits in, dished into the body. Its centre lines
       up with the middle of the ABXY diamond so both thumbs sit at one height. */
    #tuiMove { left: calc(10px + var(--tui-safe-l, 0px)); bottom: calc(var(--tui-lift, 24px) + 43px);
      width: 132px; height: 132px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #241b12, #15100a 60%, #0c0906);
      border: 2px solid #060404;
      box-shadow: inset 0 3px 5px rgba(0,0,0,0.8), inset 0 -2px 3px rgba(190,150,90,0.05),
        0 4px 12px rgba(0,0,0,0.6); }
    /* the cross itself: raised, rounded, lit from above */
    #tuiMove .arm { position: absolute; border-radius: 10px; border: 1px solid #0a0806;
      background: linear-gradient(160deg, #38302a 0%, #2a231d 45%, #1c1712 100%);
      box-shadow: 0 3px 5px rgba(0,0,0,0.55), inset 0 1px 1px rgba(220,190,140,0.10); }
    #tuiMove .h { left: 8px; right: 8px; top: 44px; height: 44px; }
    #tuiMove .v { top: 8px; bottom: 8px; left: 44px; width: 44px; }
    /* pivot dimple in the middle of the cross */
    #tuiMove .cap { position: absolute; left: 51px; top: 51px; width: 30px; height: 30px;
      border-radius: 50%; border: none;
      background: radial-gradient(circle at 40% 35%, #16110c, #241d17 70%, #2a231d);
      box-shadow: inset 0 2px 3px rgba(0,0,0,0.6); }
    #tuiMove .dot { position: absolute; width: 10px; height: 10px; border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, #9c8452, #5a4a30);
      left: 61px; top: 61px; transition: transform 60ms; }
    /* molded direction arrows on the cross tips */
    #tuiMove .tip { position: absolute; width: 0; height: 0; border: 7px solid transparent; }
    #tuiMove .tN { left: 59px; top: 14px; border-bottom: 10px solid #171310; border-top: none; }
    #tuiMove .tS { left: 59px; bottom: 14px; border-top: 10px solid #171310; border-bottom: none; }
    #tuiMove .tW { top: 59px; left: 14px; border-right: 10px solid #171310; border-left: none; }
    #tuiMove .tE { top: 59px; right: 14px; border-left: 10px solid #171310; border-right: none; }
    /* right cluster: dished plate, MENU on top, ABXY diamond, the turn rocker
       under the thumb */
    #tuiRight { right: calc(10px + var(--tui-safe-r, 0px)); bottom: var(--tui-lift, 24px);
      width: 136px; height: 204px; }
    #tuiRight::before { content: ''; position: absolute; inset: -8px; border-radius: 40px;
      background: radial-gradient(circle at 35% 25%, #221a11, #140f09 65%, #0c0906);
      border: 2px solid #060404;
      box-shadow: inset 0 3px 5px rgba(0,0,0,0.8), inset 0 -2px 3px rgba(190,150,90,0.05),
        0 4px 12px rgba(0,0,0,0.6); }
    /* convex buttons: molded plastic, letters engraved */
    .tuiBtn { position: absolute; width: 46px; height: 46px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #453b32, #2b241d 60%, #1a140f);
      border: 1px solid #080604; color: #b0a084;
      font: bold 15px 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
      text-shadow: 0 -1px 0 rgba(0,0,0,0.8), 0 1px 1px rgba(230,190,130,0.14);
      box-shadow: 0 3px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(230,190,130,0.12),
        inset 0 -2px 3px rgba(0,0,0,0.45); }
    #tuiY { left: 45px; top: 34px; }  #tuiX { left: 0;  top: 72px; }
    #tuiB { left: 90px; top: 72px; }  #tuiA { left: 45px; top: 110px; }
    /* shoulder row, sat on top of the pad well the way a pad's L and R sit on
       the top edge of the shell. Pack and quick items, which had no button. */
    #tuiShoulder { left: calc(10px + var(--tui-safe-l, 0px));
      bottom: calc(var(--tui-lift, 24px) + 189px); width: 132px; height: 44px; }
    #tuiShoulder .sh { width: 62px; height: 44px; border-radius: 22px;
      font-size: 13px; letter-spacing: 1px; }
    #tuiL1 { left: 0; top: 0; }  #tuiL2 { right: 0; left: auto; top: 0; }
    /* the rocker: one convex pill, a groove down the middle */
    #tuiRock { position: absolute; left: 0; right: 0; bottom: 0; height: 40px;
      display: flex; border: 1px solid #080604; border-radius: 20px; overflow: hidden;
      box-shadow: 0 3px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(230,190,130,0.10),
        inset 0 -2px 3px rgba(0,0,0,0.45); }
    #tuiRock div { flex: 1; color: #b0a084; display: flex; align-items: center;
      justify-content: center; font: bold 15px 'Courier New', monospace;
      background: linear-gradient(160deg, #38302a 0%, #2a231d 50%, #1c1712 100%);
      text-shadow: 0 -1px 0 rgba(0,0,0,0.8), 0 1px 1px rgba(230,190,130,0.14); }
    #tuiRock div:first-child { border-right: 2px solid #0c0906; }
    /* START-style pill, recessed into the plate above the buttons */
    #tuiMenu { position: absolute; left: 50%; transform: translateX(-50%); top: 0;
      width: 88px; height: 26px; border-radius: 13px; border: 1px solid #080604;
      background: linear-gradient(170deg, #332b23, #201a14 60%, #171310);
      color: #a09070; font: bold 10px 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center; letter-spacing: 3px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.55), inset 0 1px 1px rgba(230,190,130,0.10),
        0 0 0 4px #0e0b08, 0 0 0 5px #060404; }
    /* pressed: the plastic goes down and the letter lights amber */
    .tui .on, .tuiBtn.on { color: #ffe080 !important; transform: translateY(1px);
      background: radial-gradient(circle at 40% 40%, #2a231d, #17120d 70%) !important;
      box-shadow: inset 0 3px 5px rgba(0,0,0,0.7) !important; }
    #tuiMove .arm.on { transform: none; }
    /* the pill is centred by a transform, so its pressed state has to keep it */
    #tuiMenu.on { transform: translateX(-50%) translateY(1px); }
    #tuiRock div.on { transform: none;
      background: linear-gradient(160deg, #1c1712, #241d17) !important;
      box-shadow: inset 0 3px 5px rgba(0,0,0,0.7); }
    /* the screen sits in a bezel, centred in whatever the pads leave over */
    body.tui-on #screen { border: 5px solid #14100c; border-radius: 4px; }
    body.tui-on { cursor: default; }
    body.tui-portrait #frame { padding-bottom: var(--tui-resy, 0px); }
    body.tui-landscape #frame { padding-left: var(--tui-resx, 0px);
      padding-right: var(--tui-resx, 0px); }
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
    '<div class="arm h"></div><div class="arm v"></div>'
    + '<div class="tip tN"></div><div class="tip tS"></div>'
    + '<div class="tip tW"></div><div class="tip tE"></div>'
    + '<div class="cap"></div><div class="dot"></div>');
  const right = el('tuiRight', 'tui',
    '<div id="tuiMenu">MENU</div>'
    + '<div id="tuiY" class="tuiBtn">Y</div><div id="tuiX" class="tuiBtn">X</div>'
    + '<div id="tuiB" class="tuiBtn">B</div><div id="tuiA" class="tuiBtn">A</div>'
    + '<div id="tuiRock"><div id="tuiL">&lt;</div><div id="tuiR">&gt;</div></div>');
  const menu = right.querySelector('#tuiMenu');
  const shoulder = el('tuiShoulder', 'tui',
    '<div id="tuiL1" class="tuiBtn sh">L1</div><div id="tuiL2" class="tuiBtn sh">L2</div>');

  let wasPortrait = null;
  function layout() {
    const p = portrait(), r = reserve(), i = insets();
    const b = document.body;
    b.classList.add('tui-on');
    b.classList.toggle('tui-portrait', p);
    b.classList.toggle('tui-landscape', !p);
    // the pads jump to the other layout under whatever thumbs are down, so a
    // turn of the device starts from a clean slate rather than a stuck key
    if (wasPortrait !== null && wasPortrait !== p) releaseAll();
    wasPortrait = p;
    b.style.setProperty('--tui-lift', (p ? LIFT : LIFT_L) + i.b + 'px');
    b.style.setProperty('--tui-safe-l', i.l + 'px');
    b.style.setProperty('--tui-safe-r', i.r + 'px');
    b.style.setProperty('--tui-resy', r.y + 'px');
    b.style.setProperty('--tui-resx', (r.x / 2) + 'px');
    fitCanvas();
  }
  // Missing a turn of the device now leaves the game visibly wrong -- a canvas
  // sized for the other orientation, hanging off the screen -- so this does not
  // rest on events alone. resize is the normal path, but mobile browsers vary
  // on whether a pure rotation fires it, and orientationchange is deprecated.
  // The poll is the backstop: it costs two integer compares and only does work
  // on the tick where the viewport actually changed.
  let lastW = 0, lastH = 0;
  function relayout() {
    if (innerWidth === lastW && innerHeight === lastH) return;
    lastW = innerWidth; lastH = innerHeight;
    layout();
  }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  setInterval(relayout, 250);

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
    return { A: 'KeyE', X: 'KeyM', Y: 'KeyJ', L1: 'KeyI', L2: 'KeyQ', MENU: 'Tab' }[name];
  }

  let bHeld = false; // for hold-to-keep-shooting
  const releasers = []; // one per control, for letting go of everything at once
  function wireButton(node, name) {
    const held = {}; // touch id -> code it pressed
    releasers.push(() => {
      for (const id of Object.keys(held)) { Input.setDown(held[id], false); delete held[id]; }
      node.classList.remove('on');
      if (name === 'B') bHeld = false;
    });
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
  wireButton(shoulder.querySelector('#tuiL1'), 'L1');
  wireButton(shoulder.querySelector('#tuiL2'), 'L2');
  wireButton(menu, 'MENU');

  // let go of every synthetic key at once, however many touches are down
  function releaseAll() {
    moveTouch = null; setMoveCodes([]); dot.style.transform = '';
    rockTouch = null;
    if (rockCode) Input.setDown(rockCode, false);
    rockCode = null;
    rockL.classList.remove('on');
    rockR.classList.remove('on');
    for (const f of releasers) f();
  }

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
