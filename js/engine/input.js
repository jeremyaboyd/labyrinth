// ---- engine/input: raw device layer (keys, mouse, pointer lock) ----
// No game semantics: the game maps codes to meanings per state via the
// onPress callback and isDown queries.
'use strict';

const Input = (() => {
  const down = {};
  let locked = false;
  let canvas = null;
  let h = {}; // handlers

  function init(cv, handlers) {
    canvas = cv;
    h = handlers || {};
    const prevent = new Set(h.preventCodes || []);

    window.addEventListener('keydown', (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      down[e.code] = true;
      if (h.onPress) h.onPress(e.code, e);
    });
    window.addEventListener('keyup', (e) => { down[e.code] = false; });

    canvas.addEventListener('click', () => {
      if (!locked && canvas.requestPointerLock && h.shouldLock && h.shouldLock()) {
        canvas.requestPointerLock();
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (h.onMouseButton) h.onMouseButton(e.button);
    });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (locked && h.onMouseMove) h.onMouseMove(e.movementX, e.movementY);
    });
  }

  function isDown(code) { return !!down[code]; }
  function anyDown(codes) {
    for (const c of codes) if (down[c]) return true;
    return false;
  }
  // Pointer Lock is desktop-only: Safari on iPhone ships neither half of the
  // API, so an unguarded call here is a TypeError, not a no-op.
  function exitLock() { if (document.exitPointerLock) document.exitPointerLock(); }

  // synthetic input (touch controls): hold or release a code as if it were a
  // key, firing the same press callback so game semantics stay in one place
  function setDown(code, on) {
    if (on && !down[code]) {
      down[code] = true;
      if (h.onPress) h.onPress(code, { code, synthetic: true });
    } else if (!on) {
      down[code] = false;
    }
  }

  return { init, isDown, anyDown, setDown, exitLock, get locked() { return locked; } };
})();
