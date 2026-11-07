'use strict';
/* Цифры передают время диктофона. Анимация не управляет записью и её длительностью. */
window.TrainerDottedClock = (() => {
  const TAU = Math.PI * 2, DURATION = 500;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const noise = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const stamp = () => window.performance && window.performance.now ? window.performance.now() : Date.now();
  const numeric = value => String(value == null ? '' : value).replace(/[^0-9:—\- ]/g, '').slice(0, 8);

  function create({ value = '3', label = '', mode = 'timer' } = {}) {
    const el = document.createElement('span');
    el.className = 'dotted-clock';
    el.dataset.mode = mode === 'countdown' ? 'countdown' : 'timer';
    el.dataset.moving = 'false';
    el.setAttribute('role', 'timer');
    el.setAttribute('aria-live', 'off');
    const canvas = document.createElement('canvas');
    canvas.className = 'dotted-clock-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'dotted-clock-text';
    el.append(canvas, text);
    const doc = el.ownerDocument || document;
    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let ctx = null, sampler = null, sample = null;
    try {
      ctx = canvas.getContext && canvas.getContext('2d');
      sample = document.createElement('canvas');
      sampler = sample.getContext && sample.getContext('2d', { willReadFrequently: true });
    } catch (_) { /* Старые webview сохраняют обычное цифровое время. */ }
    const enabled = !!(ctx && sampler && sampler.getImageData);
    canvas.hidden = !enabled;
    el.dataset.renderer = enabled ? 'canvas' : 'text';
    const W = mode === 'countdown' ? 320 : 560, H = 176, SLOT = 76, FONT = 128, BASE = 136;
    canvas.width = W * 2; canvas.height = H * 2;
    if (sample) { sample.width = SLOT; sample.height = H; }
    const cache = new Map();
    let current = numeric(value), previous = current, caption = String(label || '');
    let destroyed = false, raf = 0, started = 0, direction = 1, visible = true, ink = '#244d3d';

    function accessible() {
      el.dataset.value = current;
      text.textContent = current;
      el.setAttribute('aria-label', caption ? caption + ': ' + current : current);
    }
    function color() {
      if (window.getComputedStyle) {
        const next = window.getComputedStyle(el).color;
        if (next) ink = next;
      }
    }
    function glyph(char) {
      if (cache.has(char)) return cache.get(char);
      const points = new Map();
      if (char !== ' ' && enabled) {
        sampler.clearRect(0, 0, SLOT, H);
        sampler.fillStyle = '#000';
        sampler.font = 'italic 900 ' + FONT + 'px Arial, sans-serif';
        sampler.textAlign = 'center'; sampler.textBaseline = 'alphabetic';
        sampler.fillText(char, SLOT / 2 - 2, BASE);
        const pixels = sampler.getImageData(0, 0, SLOT, H).data;
        const pitch = 3.65, rowHeight = pitch * .866;
        for (let row = 0, y = 25; y < 145; row++, y += rowHeight) {
          for (let col = 0, x = 1 + (row % 2) * pitch / 2; x < SLOT - 1; col++, x += pitch) {
            const key = row * 100 + col;
            const px = x + (noise(key + 2) - .5) * 1.35;
            const py = y + (noise(key + 6) - .5) * 1.25;
            if (pixels[(Math.floor(py) * SLOT + Math.floor(px)) * 4 + 3] > 100) {
              const radius = mode === 'timer' ? 1.2 + noise(key + 9) * .25 : .88 + noise(key + 9) * .35;
              points.set(key, { x: px, y: py, r: radius, seed: key });
            }
          }
        }
      }
      cache.set(char, points);
      return points;
    }
    function dot(x, y, radius) { ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, TAU); }
    function draw(progress = 1) {
      if (!enabled || destroyed) return;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = ink;
      const length = Math.max(previous.length, current.length, 1);
      const old = previous.padStart(length, ' '), next = current.padStart(length, ' ');
      const left = (W - length * SLOT) / 2;
      const changed = [];
      for (let i = 0; i < length; i++) if (old[i] !== next[i]) changed.push(i);
      const moving = progress < 1 && changed.length;
      const minX = left + (changed[0] || 0) * SLOT, maxX = left + ((changed[changed.length - 1] || 0) + 1) * SLOT;
      const radius = 68, travel = (maxX - minX) + radius * 2;
      const p = direction > 0 ? progress : 1 - progress;
      const cx = minX - radius + travel * p;
      const cy = 88 - 13 * Math.pow(progress * 2 - 1, 2);
      for (let i = 0; i < length; i++) {
        const x0 = left + i * SLOT;
        const target = glyph(next[i]), origin = moving && old[i] !== next[i] ? glyph(old[i]) : target;
        const all = new Map([...origin, ...target]);
        for (const [key, point] of all) {
          const a = origin.has(key) ? 1 : 0, b = target.has(key) ? 1 : 0;
          let x = x0 + point.x, y = point.y, alpha = b;
          if (moving && old[i] !== next[i]) {
            const crossed = direction > 0 ? (cx - x) / (radius * .9) : (x - cx) / (radius * .9);
            const blend = smooth(.5 + crossed * .5);
            alpha = a * (1 - blend) + b * blend;
            const dx = x - cx, dy = (y - cy) * .8;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const influence = Math.pow(clamp(1 - distance / radius), .8) * Math.sin(Math.PI * progress);
            const angle = Math.atan2(dy, dx) + direction * influence * (1.2 + noise(key) * 1.8);
            x += (Math.cos(angle) * distance - dx) * influence + (noise(key + 17) - .5) * 31 * influence;
            y += (Math.sin(angle) * distance - dy) * influence + (noise(key + 23) - .5) * 31 * influence;
          }
          if (alpha < .025) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath(); dot(x, y, point.r); ctx.fill();
        }
      }
      if (moving) {
        ctx.globalAlpha = Math.min(1, progress * 5, (1 - progress) * 5);
        // Круг и подвес проходят сквозь цифру одним маятниковым движением.
        ctx.beginPath();
        const ringDot = mode === 'timer' ? 1.1 : .8;
        for (let a = 0; a < TAU; a += .052) dot(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, ringDot);
        const tilt = (progress * 2 - 1) * 18 * direction;
        for (let y = cy - radius - 3; y >= -5; y -= 3.8) dot(cx + tilt * (cy - radius - y) / 50, y, ringDot);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; previous = current;
      el.dataset.moving = 'false';
      draw();
    }
    function allowed() { return enabled && !destroyed && !doc.hidden && visible && !(motion && motion.matches); }
    function frame(now) {
      raf = 0;
      if (!allowed()) { stop(); return; }
      const progress = clamp((now - started) / DURATION);
      draw(progress);
      if (progress < 1) raf = requestAnimationFrame(frame);
      else { previous = current; el.dataset.moving = 'false'; }
    }
    function settle() { if (!allowed()) stop(); }
    let observer = null, themeObserver = null;
    if (window.IntersectionObserver) {
      observer = new window.IntersectionObserver(entries => {
        for (const entry of entries) if (entry.target === el) visible = entry.isIntersecting;
        color(); settle(); if (!raf) draw();
      });
      observer.observe(el);
    }
    if (window.MutationObserver && doc.documentElement) {
      themeObserver = new window.MutationObserver(() => { color(); draw(); });
      themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    }
    doc.addEventListener('visibilitychange', settle);
    if (motion) {
      if (motion.addEventListener) motion.addEventListener('change', settle);
      else if (motion.addListener) motion.addListener(settle);
    }
    accessible(); color(); draw();
    return {
      el,
      setValue(value, nextLabel) {
        if (destroyed) return;
        if (typeof nextLabel === 'string') caption = nextLabel;
        const next = numeric(value);
        if (next === current) { accessible(); return; }
        if (raf) cancelAnimationFrame(raf);
        previous = current; current = next; accessible(); color();
        direction *= -1;
        if (!allowed()) { stop(); return; }
        started = stamp(); el.dataset.moving = 'true';
        draw(0); raf = requestAnimationFrame(frame);
      },
      destroy() {
        if (destroyed) return;
        stop(); destroyed = true;
        if (observer) observer.disconnect();
        if (themeObserver) themeObserver.disconnect();
        doc.removeEventListener('visibilitychange', settle);
        if (motion) {
          if (motion.removeEventListener) motion.removeEventListener('change', settle);
          else if (motion.removeListener) motion.removeListener(settle);
        }
        cache.clear();
      },
    };
  }

  function countIn({ seconds = 3, valid = () => true } = {}) {
    const duration = Math.max(1, Math.min(60, Math.ceil(Number(seconds) || 3)));
    const el = document.createElement('div');
    el.className = 'record-count-in'; el.dataset.state = 'preparing';
    const caption = document.createElement('p');
    caption.className = 'record-count-in-label'; caption.textContent = 'Запись начнётся через';
    const clock = create({ value: duration, label: caption.textContent, mode: 'countdown' });
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button'; cancelButton.className = 'btn ghost record-count-in-cancel';
    cancelButton.textContent = 'Отмена';
    el.append(caption, clock.el, cancelButton);
    const doc = el.ownerDocument || document;
    let timer = 0, settled = false, resolve;
    const deadline = stamp() + duration * 1000;
    const finished = new Promise(done => { resolve = done; });
    function acceptable() { try { return !doc.hidden && valid() !== false; } catch (_) { return false; } }
    function end(success) {
      if (settled) return;
      settled = true; clearTimeout(timer); timer = 0;
      doc.removeEventListener('visibilitychange', hidden);
      cancelButton.removeEventListener('click', cancel);
      cancelButton.hidden = true;
      el.dataset.state = success ? 'ready' : 'cancelled';
      clock.destroy();
      if (!success) caption.textContent = 'Подготовка отменена';
      resolve(success);
    }
    function cancel() { end(false); }
    function hidden() { if (doc.hidden) cancel(); }
    function tick() {
      if (settled) return;
      if (!acceptable()) { end(false); return; }
      const left = Math.max(0, Math.ceil((deadline - stamp()) / 1000));
      if (!left) { end(true); return; }
      clock.setValue(left);
      timer = setTimeout(tick, Math.min(100, Math.max(1, deadline - stamp())));
    }
    cancelButton.addEventListener('click', cancel);
    doc.addEventListener('visibilitychange', hidden);
    tick();
    return { el, finished, cancel, destroy: cancel };
  }
  return { create, countIn };
})();
