'use strict';
/* Световая волна показывает уровень микрофона, не оценивая качество речи. */
window.TrainerVoiceLight = (() => {
  const NOOP = { start() {}, stop() {}, destroy() {} };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function create(canvas, { level = () => 0 } = {}) {
    let context;
    try { context = canvas && canvas.getContext && canvas.getContext('2d'); } catch (_) { return NOOP; }
    if (!context || !window.requestAnimationFrame || !window.cancelAnimationFrame) return NOOP;

    const doc = canvas.ownerDocument || document;
    const history = new Float32Array(52);
    const grain = new Float32Array(64 * 15);
    for (let i = 0; i < grain.length; i++) {
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      grain[i] = seed - Math.floor(seed);
    }
    const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    let active = false, destroyed = false, failed = false, intersecting = true;
    let raf = 0, last = null, phase = 0, envelope = 0, width = 0, height = 0, color = '';

    function resetSignal() {
      history.fill(0); envelope = 0; phase = 0; last = null;
    }
    function clear() {
      try { context.clearRect(0, 0, width, height); } catch (_) { /* Запись продолжается и без графики. */ }
    }
    function visible() {
      return !doc.hidden && intersecting && !canvas.hidden && canvas.isConnected !== false
        && canvas.clientWidth > 0 && canvas.clientHeight > 0;
    }
    function cancel() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }
    function schedule() {
      if (active && !destroyed && !failed && visible() && !raf) raf = window.requestAnimationFrame(frame);
    }
    function paintColor() {
      try {
        const style = window.getComputedStyle(canvas);
        color = style.getPropertyValue('--voice-light-ink').trim() || style.color;
      } catch (_) { color = ''; }
    }
    function size() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!(w > 0 && h > 0)) return false;
      const ratio = clamp(Number(window.devicePixelRatio) || 1, 1, 2);
      const pw = Math.max(1, Math.round(w * ratio)), ph = Math.max(1, Math.round(h * ratio));
      if (canvas.width !== pw || canvas.height !== ph || width !== w || height !== h) {
        canvas.width = pw; canvas.height = ph; width = w; height = h;
        context.setTransform(pw / w, 0, 0, ph / h, 0, 0);
      }
      return true;
    }
    function sample() {
      let value;
      try { value = Number(level()); } catch (_) { return 0; }
      return Number.isFinite(value) && value > .008 ? clamp(value, 0, 1) : 0;
    }
    function paint(minimal) {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color || 'currentColor';
      const columns = clamp(Math.floor(width / 5.5), 24, 64);
      const gap = (width - 28) / (columns - 1), cy = height / 2;
      const amplitude = height * .29;
      for (let column = 0; column < columns; column++) {
        const x = 14 + column * gap, nx = (column / (columns - 1)) * 2 - 1;
        const edge = Math.pow(Math.max(0, 1 - nx * nx), .8);
        const value = minimal ? envelope : history[Math.round(column * (history.length - 1) / (columns - 1))] * .75 + envelope * .25;
        const wave = minimal ? 0 : (Math.sin(nx * 8.6 - phase) * .65 + Math.sin(nx * 15.8 + phase * .35) * .25) * amplitude * value * edge;
        const spread = minimal ? 0 : 2 + value * 15 * edge;
        for (let row = -7; row <= 7; row++) {
          if (minimal && row !== 0) continue;
          const band = row === 0 ? 1 : Math.exp(-Math.pow(row * 3 / spread, 2) * 1.8);
          if (band < .035 || (value < .002 && row !== 0)) continue;
          const texture = grain[column * 15 + row + 7];
          const power = band * (.22 + edge * .78);
          context.globalAlpha = minimal
            ? .16 + .68 * envelope * edge
            : power * (.16 + texture * .4 + value * .38);
          context.beginPath();
          context.arc(x, cy + wave + row * 3, minimal ? 1 : .5 + power * (.35 + texture * .45) + value * .3, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }
    function frame(timestamp) {
      raf = 0;
      if (!active || destroyed || failed || !visible()) return;
      const minimal = !!(reduced && reduced.matches), interval = minimal ? 100 : 1000 / 30;
      if (last !== null && timestamp - last < interval) { schedule(); return; }
      const elapsed = last === null ? interval : Math.min(100, timestamp - last);
      last = timestamp;
      try {
        if (!size()) return;
        const value = sample();
        envelope += (value - envelope) * (value > envelope ? .46 : .19);
        if (envelope < .001) envelope = 0;
        if (minimal) history.fill(0);
        else {
          history.copyWithin(0, 1); history[history.length - 1] = envelope;
          if (envelope > .002) phase += elapsed / 1000 * (1.4 + envelope * 1.8);
          else if (!history.some(item => item > .002)) { history.fill(0); phase = 0; }
        }
        paint(minimal);
      } catch (_) {
        failed = true; clear();
      }
      schedule();
    }
    function visibilityChanged() {
      if (!visible()) { cancel(); resetSignal(); }
      else { paintColor(); schedule(); }
    }
    function resized() {
      paintColor();
      if (active) visibilityChanged();
    }
    function motionChanged() {
      resetSignal(); cancel(); schedule();
    }
    function listen(query, handler) {
      if (!query) return;
      if (query.addEventListener) query.addEventListener('change', handler);
      else if (query.addListener) query.addListener(handler);
    }
    function unlisten(query, handler) {
      if (!query) return;
      if (query.removeEventListener) query.removeEventListener('change', handler);
      else if (query.removeListener) query.removeListener(handler);
    }
    let resizeObserver, intersectionObserver, themeObserver;
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(resized); resizeObserver.observe(canvas);
    } else window.addEventListener('resize', resized);
    if (window.IntersectionObserver) {
      intersectionObserver = new window.IntersectionObserver(entries => {
        for (const entry of entries) if (entry.target === canvas) intersecting = entry.isIntersecting;
        visibilityChanged();
      });
      intersectionObserver.observe(canvas);
    }
    if (window.MutationObserver && doc.documentElement) {
      themeObserver = new window.MutationObserver(paintColor);
      themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    }
    doc.addEventListener('visibilitychange', visibilityChanged);
    listen(reduced, motionChanged); listen(scheme, paintColor); paintColor();
    return {
      start() {
        if (destroyed || failed) return;
        if (active) { schedule(); return; }
        active = true; resetSignal(); paintColor(); schedule();
      },
      stop() {
        active = false; cancel(); resetSignal(); clear();
      },
      destroy() {
        if (destroyed) return;
        active = false; destroyed = true; cancel(); resetSignal(); clear();
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', resized);
        if (intersectionObserver) intersectionObserver.disconnect();
        if (themeObserver) themeObserver.disconnect();
        doc.removeEventListener('visibilitychange', visibilityChanged);
        unlisten(reduced, motionChanged); unlisten(scheme, paintColor);
      },
    };
  }
  return { create };
})();
