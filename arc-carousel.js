'use strict';
/* Кольцо обложек: один настоящий переход на формат, дуга и изгиб только в движении. */
window.TrainerArcCarousel = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let serial = 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const modulo = (value, count) => count ? ((value % count) + count) % count : 0;

  function mount({ track, cards, previous, next, onChange, id = 'cards' }) {
    const nodes = Array.from(cards || []), count = nodes.length;
    const doc = track.ownerDocument || document;
    const raf = typeof requestAnimationFrame === 'function' ? callback => requestAnimationFrame(callback) : null;
    const cancelRaf = typeof cancelAnimationFrame === 'function' ? value => cancelAnimationFrame(value) : () => {};
    const clock = () => typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = () => !!(motion && motion.matches);
    const originalLayout = track.getAttribute('data-layout');
    const original = nodes.map(node => ({
      node,
      attributes: Object.fromEntries(['tabindex', 'aria-hidden', 'data-active'].map(name => [name, node.getAttribute(name)])),
      styles: Object.fromEntries(['transform', 'filter', 'visibility', 'pointer-events', 'z-index', 'opacity'].map(name => [name, node.style.getPropertyValue(name)])),
    }));
    const restoreAttribute = (node, name, value) => value == null ? node.removeAttribute(name) : node.setAttribute(name, value);
    const element = (name, attrs) => {
      const node = doc.createElementNS(NS, name);
      for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
      return node;
    };
    const filterId = 'arc-paper-' + String(id).replace(/[^a-z0-9_-]/gi, '-') + '-' + (++serial);
    const svg = element('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
    const defs = element('defs');
    const filter = element('filter', { id: filterId, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    // A neutral green channel keeps Y fixed. The red channel bends only the middle of the sheet.
    const stops = Array.from({ length: 13 }, (_, index) => {
      const fraction = index / 12, red = Math.round(128 + 127 * Math.sin(Math.PI * fraction));
      return '<stop offset="' + (fraction * 100).toFixed(3) + '%" stop-color="rgb(' + red + ',128,128)"/>';
    }).join('');
    const map = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="130" viewBox="0 0 100 130">'
      + '<defs><linearGradient id="bend" x1="0" x2="0" y1="15" y2="115" gradientUnits="userSpaceOnUse">' + stops
      + '</linearGradient></defs><rect width="100" height="130" fill="url(#bend)"/></svg>';
    const image = element('feImage', { href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(map), preserveAspectRatio: 'none', result: 'bend-map' });
    const displacement = element('feDisplacementMap', { in: 'SourceGraphic', in2: 'bend-map', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' });
    filter.append(image, displacement); defs.append(filter); svg.append(defs); track.append(svg);
    track.setAttribute('data-layout', 'arc');
    track.setAttribute('data-dragging', 'false');

    let destroyed = false, phase = 0, target = 0, bend = 0, selected = -1;
    let frame = 0, lastTime = 0, snapTimer = 0, suppressUntil = 0;
    let width = 360, cardWidth = 170, cardHeight = 230, radius = 720, stride = 220;
    let intersecting = true, dragging = null;
    const step = Math.PI / 10;
    const blocked = () => destroyed || !!doc.hidden || !intersecting;
    const animated = () => !!raf && !reduced() && !blocked();

    function measure() {
      const visible = nodes.find(node => node.offsetWidth > 0) || nodes[0];
      const bounds = typeof track.getBoundingClientRect === 'function' ? track.getBoundingClientRect() : {};
      width = track.clientWidth || bounds.width || width;
      if (visible) {
        let style;
        if (typeof getComputedStyle === 'function') style = getComputedStyle(track);
        const declaredWidth = style && parseFloat(style.getPropertyValue('--arc-card-width'));
        const declaredHeight = style && parseFloat(style.getPropertyValue('--arc-card-height'));
        cardWidth = visible.offsetWidth || declaredWidth || visible.clientWidth || cardWidth;
        cardHeight = visible.offsetHeight || declaredHeight || visible.clientHeight || cardHeight;
      }
      const factor = width < 640 ? 1.3 : 1.82;
      stride = cardWidth * factor;
      radius = stride / Math.sin(step);
      const x = -cardWidth * .45, y = -cardHeight * .15, fw = cardWidth * 1.9, fh = cardHeight * 1.3;
      for (const node of [filter, image]) {
        node.setAttribute('x', String(x)); node.setAttribute('y', String(y));
        node.setAttribute('width', String(fw)); node.setAttribute('height', String(fh));
      }
    }

    function paint() {
      if (destroyed) return;
      const index = count ? modulo(Math.round(phase), count) : 0;
      const warping = !reduced() && Math.abs(bend) >= .2;
      displacement.setAttribute('scale', warping ? (2 * bend).toFixed(3) : '0');
      for (let i = 0; i < count; i++) {
        const node = nodes[i], distance = modulo(i - phase + count / 2, count) - count / 2;
        const theta = distance * step, angle = theta * 180 / Math.PI * 1.2;
        const x = radius * Math.sin(theta), y = 18 + radius * (1 - Math.cos(theta));
        const radians = angle * Math.PI / 180;
        const reach = cardWidth * Math.abs(Math.cos(radians)) / 2 + cardHeight * Math.abs(Math.sin(radians)) / 2;
        const inStage = Math.abs(theta) < Math.PI * .48 && Math.abs(x) - reach < width / 2 + 36;
        const visible = inStage || doc.activeElement === node;
        node.style.setProperty('transform', 'translate3d(' + (x - cardWidth / 2).toFixed(3) + 'px, ' + y.toFixed(3) + 'px, 0) rotateZ(' + angle.toFixed(3) + 'deg) scale(1)');
        node.style.setProperty('z-index', String(100 - Math.round(Math.abs(distance) * 8)));
        node.style.setProperty('visibility', visible ? 'visible' : 'hidden');
        node.style.setProperty('pointer-events', inStage ? 'auto' : 'none');
        node.style.setProperty('filter', warping && inStage ? 'url("#' + filterId + '")' : 'none');
        node.setAttribute('data-active', String(i === index));
        if (visible) {
          restoreAttribute(node, 'aria-hidden', original[i].attributes['aria-hidden']);
          restoreAttribute(node, 'tabindex', original[i].attributes.tabindex);
        } else {
          node.setAttribute('aria-hidden', 'true'); node.setAttribute('tabindex', '-1');
        }
      }
      previous.disabled = next.disabled = count <= 1;
      if (index !== selected) {
        selected = index;
        if (typeof onChange === 'function') onChange(index);
      }
    }

    function stop() {
      if (frame) cancelRaf(frame);
      frame = 0; lastTime = 0;
      track.setAttribute('data-moving', 'false');
    }
    function tick(timestamp) {
      frame = 0;
      if (blocked()) { stop(); return; }
      const dt = clamp(lastTime ? (timestamp - lastTime) / 1000 : 1 / 60, 1 / 240, .04);
      lastTime = timestamp;
      const before = phase;
      phase += (target - phase) * (1 - Math.exp(-14 * dt));
      if (Math.abs(target - phase) < .0008) phase = target;
      const velocity = (phase - before) / dt;
      const wanted = clamp(-velocity * cardWidth * .025, -cardWidth * .3, cardWidth * .3);
      bend += (wanted - bend) * (1 - Math.exp(-18 * dt));
      const resting = phase === target && Math.abs(bend) < .2;
      if (resting) bend = 0;
      paint();
      if (resting) { stop(); return; }
      frame = raf(tick);
    }
    function move(value) {
      if (destroyed || !count || !Number.isFinite(value)) return;
      target = value;
      if (!animated()) {
        stop(); phase = target; bend = 0; paint(); return;
      }
      track.setAttribute('data-moving', 'true');
      if (!frame) frame = raf(tick);
    }
    function cancelSnap() {
      if (snapTimer && typeof clearTimeout === 'function') clearTimeout(snapTimer);
      snapTimer = 0;
    }
    function snapSoon() {
      cancelSnap();
      if (typeof setTimeout === 'function') snapTimer = setTimeout(() => { snapTimer = 0; move(Math.round(target)); }, 110);
      else move(Math.round(target));
    }
    function go(delta, focus = false) {
      if (destroyed || count <= 1) return;
      cancelSnap();
      const destination = Math.round(target) + delta;
      move(destination);
      if (focus) {
        const node = nodes[modulo(destination, count)];
        node.style.setProperty('visibility', 'visible');
        restoreAttribute(node, 'aria-hidden', original[modulo(destination, count)].attributes['aria-hidden']);
        restoreAttribute(node, 'tabindex', original[modulo(destination, count)].attributes.tabindex);
        if (typeof node.focus === 'function') node.focus({ preventScroll: true });
      }
    }
    const backward = () => go(-1), forward = () => go(1);
    const cardIndex = node => nodes.findIndex(card => card === node || (typeof card.contains === 'function' && card.contains(node)));
    function keydown(event) {
      const index = cardIndex(event.target);
      if (count <= 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || index < 0) return;
      const nearest = value => modulo(value + count / 2, count) - count / 2;
      const origin = Math.round(target), focused = origin + nearest(index - modulo(origin, count));
      const destination = event.key === 'ArrowRight' ? focused + 1 : event.key === 'ArrowLeft' ? focused - 1
        : event.key === 'Home' ? focused + nearest(-index) : event.key === 'End' ? focused + nearest(count - 1 - index) : null;
      const delta = destination == null ? null : destination - origin;
      if (delta == null) return;
      event.preventDefault(); go(delta, true);
    }
    function wheel(event) {
      if (count <= 1 || event.ctrlKey || event.metaKey || event.altKey) return;
      const x = Number(event.deltaX) || 0, y = Number(event.deltaY) || 0;
      const horizontal = event.shiftKey && Math.abs(x) < .5 ? y : x;
      if (Math.abs(horizontal) < .5 || (!event.shiftKey && Math.abs(horizontal) <= Math.abs(y) * 1.15)) return;
      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      move(target + horizontal * multiplier / stride); snapSoon();
    }
    function pointerdown(event) {
      if (count <= 1 || event.isPrimary === false || event.button > 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      cancelSnap();
      suppressUntil = 0;
      track.setAttribute('data-dragging', 'false');
      // Grabbing a moving wheel starts from the sheet under the finger, not its old destination.
      move(phase);
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX,
        time: clock(), phase, velocity: 0, active: false, pointerType: event.pointerType };
    }
    function pointermove(event) {
      if (!dragging || dragging.id !== event.pointerId) return;
      if (dragging.pointerType === 'mouse' && event.buttons === 0) { dragging = null; track.setAttribute('data-dragging', 'false'); return; }
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      if (!dragging.active) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { dragging = null; track.setAttribute('data-dragging', 'false'); return; }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
        dragging.active = true;
        track.setAttribute('data-dragging', 'true');
        if (typeof track.setPointerCapture === 'function') {
          try { track.setPointerCapture(event.pointerId); } catch (_) { /* Pointer may already have ended. */ }
        }
      }
      event.preventDefault();
      const time = clock(), dt = Math.max(8, time - dragging.time);
      dragging.velocity = dragging.velocity * .45 + (event.clientX - dragging.lastX) / dt * .55;
      dragging.lastX = event.clientX; dragging.time = time;
      move(dragging.phase - dx / stride);
    }
    function release(event) {
      if (!dragging || dragging.id !== event.pointerId) return;
      const drag = dragging; dragging = null;
      track.setAttribute('data-dragging', 'false');
      if (drag.active) {
        suppressUntil = clock() + 450;
        const recent = clock() - drag.time < 90;
        const inertia = !reduced() && recent && event.type !== 'pointercancel'
          ? clamp(-drag.velocity * 180 / stride, -2.2, 2.2) : 0;
        move(Math.round(target + inertia));
      } else move(Math.round(target));
      if (typeof track.releasePointerCapture === 'function') {
        try { track.releasePointerCapture(drag.id); } catch (_) { /* It may be released by the browser. */ }
      }
    }
    function click(event) {
      if (clock() >= suppressUntil || event.detail === 0 || (event.button != null && event.button !== 0)
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || cardIndex(event.target) < 0) return;
      suppressUntil = 0;
      event.preventDefault(); event.stopPropagation();
    }
    function nativeDrag(event) {
      if (count > 1 && cardIndex(event.target) >= 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) event.preventDefault();
    }
    function pause() {
      cancelSnap();
      if (dragging && typeof track.releasePointerCapture === 'function') {
        try { track.releasePointerCapture(dragging.id); } catch (_) { /* Already released. */ }
      }
      dragging = null; track.setAttribute('data-dragging', 'false');
      stop(); phase = target = Math.round(target); bend = 0; paint();
    }
    function visibility() { if (doc.hidden) pause(); else { measure(); paint(); } }
    function motionChanged() { if (reduced()) pause(); else { measure(); paint(); } }

    previous.addEventListener('click', backward); next.addEventListener('click', forward);
    track.addEventListener('keydown', keydown);
    track.addEventListener('wheel', wheel, { passive: false });
    track.addEventListener('pointerdown', pointerdown, { passive: true });
    track.addEventListener('pointermove', pointermove, { passive: false });
    track.addEventListener('pointerup', release); track.addEventListener('pointercancel', release);
    track.addEventListener('click', click, true);
    track.addEventListener('dragstart', nativeDrag);
    doc.addEventListener('pointerup', release); doc.addEventListener('pointercancel', release);
    doc.addEventListener('visibilitychange', visibility);
    if (motion && motion.addEventListener) motion.addEventListener('change', motionChanged);
    else if (motion && motion.addListener) motion.addListener(motionChanged);
    const resize = window.ResizeObserver ? new window.ResizeObserver(() => { measure(); paint(); }) : null;
    if (resize) resize.observe(track);
    const intersection = window.IntersectionObserver ? new window.IntersectionObserver(entries => {
      for (const entry of entries) if (entry.target === track) intersecting = entry.isIntersecting;
      if (!intersecting) pause(); else { measure(); paint(); }
    }) : null;
    if (intersection) intersection.observe(track);
    measure(); paint();
    return { destroy() {
      if (destroyed) return;
      cancelSnap(); stop(); destroyed = true;
      if (dragging && typeof track.releasePointerCapture === 'function') {
        try { track.releasePointerCapture(dragging.id); } catch (_) { /* Already released. */ }
      }
      dragging = null;
      previous.removeEventListener('click', backward); next.removeEventListener('click', forward);
      track.removeEventListener('keydown', keydown); track.removeEventListener('wheel', wheel);
      track.removeEventListener('pointerdown', pointerdown); track.removeEventListener('pointermove', pointermove);
      track.removeEventListener('pointerup', release); track.removeEventListener('pointercancel', release);
      track.removeEventListener('click', click, true);
      track.removeEventListener('dragstart', nativeDrag);
      doc.removeEventListener('pointerup', release); doc.removeEventListener('pointercancel', release);
      doc.removeEventListener('visibilitychange', visibility);
      if (motion && motion.removeEventListener) motion.removeEventListener('change', motionChanged);
      else if (motion && motion.removeListener) motion.removeListener(motionChanged);
      if (resize) resize.disconnect(); if (intersection) intersection.disconnect();
      displacement.setAttribute('scale', '0');
      if (typeof svg.remove === 'function') svg.remove();
      for (const entry of original) {
        for (const [name, value] of Object.entries(entry.attributes)) restoreAttribute(entry.node, name, value);
        for (const [name, value] of Object.entries(entry.styles)) value ? entry.node.style.setProperty(name, value) : entry.node.style.removeProperty(name);
      }
      restoreAttribute(track, 'data-layout', originalLayout); track.removeAttribute('data-moving'); track.removeAttribute('data-dragging');
      previous.disabled = next.disabled = true;
    } };
  }
  return { mount };
})();
