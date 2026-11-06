// Drag and drop that works with a mouse, touch, and the keyboard.
//
// Draggable things carry data-drag and a payload registered with dnd.register(el, payload).
// Drop zones carry data-zone="<name>". Chips inside a zone carry data-chip.
// Three ways to move a chip:
//   1. drag it (mouse or finger)
//   2. tap/click it, then tap/click a zone
//   3. focus it, press Enter, focus a zone, press Enter (Delete removes a placed chip)

export function createDnd(root, { accepts, onDrop, onRemove, describe, describeZone, announce }) {
  const payloads = new WeakMap();
  let pending = null;
  let drag = null;
  let selected = null;
  let suppressClick = false;

  const zones = () => [...root.querySelectorAll('[data-zone]')];
  const clearCarets = () => root.querySelectorAll('.caret').forEach(c => c.remove());

  function setSelected(elm) {
    root.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
    selected = elm ? { el: elm, payload: payloads.get(elm) } : null;
    if (elm) elm.classList.add('selected');
    zones().forEach(z => {
      z.classList.toggle('can-drop', !!selected && accepts(z.dataset.zone, selected.payload));
    });
  }

  function indexAt(zone, x, y, skip) {
    const chips = [...zone.querySelectorAll(':scope > [data-chip]')].filter(c => c !== skip);
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (y < r.top) return { index: i, before: chips[i] };
      if (y <= r.bottom && x < r.left + r.width / 2) return { index: i, before: chips[i] };
    }
    return { index: chips.length, before: null };
  }

  function zoneAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const zone = hit && hit.closest('[data-zone]');
    return zone && root.contains(zone) ? zone : null;
  }

  function onPointerDown(e) {
    suppressClick = false;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('select, input, textarea, .chip-x')) return;
    const src = e.target.closest('[data-drag]');
    if (!src || !root.contains(src)) return;
    pending = { src, payload: payloads.get(src), x: e.clientX, y: e.clientY, id: e.pointerId };
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', cancel);
  }

  function startDrag(e) {
    const { src } = pending;
    const rect = src.getBoundingClientRect();
    const ghost = src.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('chip-ghost');
    ghost.classList.remove('selected');
    ghost.style.width = `${rect.width}px`;
    document.body.append(ghost);
    src.classList.add('lifted');
    setSelected(null);
    drag = { ...pending, ghost, dx: e.clientX - rect.left, dy: e.clientY - rect.top, zone: null, index: 0 };
    zones().forEach(z => {
      const ok = accepts(z.dataset.zone, drag.payload);
      z.classList.toggle('can-drop', ok);
      z.classList.toggle('cannot-drop', !ok);
    });
  }

  function onPointerMove(e) {
    if (!pending) return;
    if (!drag) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 6) return;
      startDrag(e);
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(-2deg)`;
    const zone = zoneAt(e.clientX, e.clientY);
    root.querySelectorAll('.zone.over').forEach(z => z !== zone && z.classList.remove('over'));
    clearCarets();
    drag.zone = null;
    if (zone && accepts(zone.dataset.zone, drag.payload)) {
      zone.classList.add('over');
      const { index, before } = indexAt(zone, e.clientX, e.clientY, drag.src);
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      zone.insertBefore(caret, before);
      drag.zone = zone.dataset.zone;
      drag.index = index;
    }
    autoScroll(e.clientY);
  }

  function autoScroll(y) {
    const edge = 60;
    if (y < edge) window.scrollBy(0, -12);
    else if (y > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  function finish() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', cancel);
    if (drag) {
      drag.ghost.remove();
      drag.src.classList.remove('lifted');
      zones().forEach(z => z.classList.remove('can-drop', 'cannot-drop', 'over'));
      clearCarets();
    }
    pending = null;
    drag = null;
  }

  function onPointerUp() {
    if (drag) {
      // The browser may fire a click for the drag's release; ignore it until the next press.
      suppressClick = true;
      const { payload, zone, index } = drag;
      finish();
      if (zone) onDrop(payload, zone, index);
      else if (payload.from) onRemove(payload);
      return;
    }
    finish();
  }

  function cancel() { finish(); }

  function placeSelectedIn(zoneEl) {
    const name = zoneEl.dataset.zone;
    if (!accepts(name, selected.payload)) {
      announce(`${describe(selected.payload)} can't go in ${describeZone(name)}.`);
      return;
    }
    const count = zoneEl.querySelectorAll(':scope > [data-chip]').length;
    const { payload } = selected;
    const sameZone = payload.from && payload.from.zone === name;
    setSelected(null);
    onDrop(payload, name, sameZone ? count - 1 : count);
    announce(`Placed ${describe(payload)} in ${describeZone(name)}.`);
  }

  function onClick(e) {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (e.target.closest('select, input, textarea, .chip-x')) return;
    const chip = e.target.closest('[data-drag]');
    if (chip && root.contains(chip)) {
      if (selected && selected.el === chip) { setSelected(null); announce('Put down.'); return; }
      setSelected(chip);
      announce(`Picked up ${describe(payloads.get(chip))}. Now choose where to put it.`);
      return;
    }
    const zone = e.target.closest('[data-zone]');
    if (zone && selected) placeSelectedIn(zone);
  }

  function onKeyDown(e) {
    suppressClick = false;
    const chip = e.target.closest?.('[data-drag]');
    if (e.key === 'Escape' && selected) { setSelected(null); announce('Put down.'); return; }
    if (chip && e.target === chip) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && payloads.get(chip)?.from) {
        e.preventDefault();
        onRemove(payloads.get(chip));
        announce(`Removed ${describe(payloads.get(chip))}.`);
      }
      return;
    }
    const zone = e.target.closest?.('[data-zone]');
    if (zone && e.target === zone && (e.key === 'Enter' || e.key === ' ') && selected) {
      e.preventDefault();
      placeSelectedIn(zone);
    }
  }

  root.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) suppressClick = false; });
  root.addEventListener('click', onClick, true);
  root.addEventListener('keydown', onKeyDown);

  return {
    register(elm, payload) { payloads.set(elm, payload); },
    clearSelection() { setSelected(null); },
  };
}
