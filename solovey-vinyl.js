'use strict';
/* Декоративная пластинка. Состояние задаёт диктофон; звук здесь не запрашивается. */
window.TrainerSoloveyVinyl = (() => {
  function create() {
    const el = document.createElement('div');
    el.className = 'solovey-vinyl';
    el.setAttribute('aria-hidden', 'true');
    el.dataset.recording = 'false';
    el.dataset.spinning = 'false';

    const part = (name, text) => {
      const node = document.createElement('span');
      node.className = 'solovey-vinyl-' + name;
      if (text) node.textContent = text;
      return node;
    };
    const body = part('case');
    const carrier = part('carrier');
    carrier.append(part('disc'));
    const pocket = part('pocket');
    const logo = part('logo', 'Соловей');
    const stamp = part('stamp');
    stamp.append(part('stamp-top', 'ЗАПИСЬ'), part('stamp-main', 'ЖИВАЯ РЕЧЬ'), part('stamp-bottom', 'ВАШ ГОЛОС'));
    el.append(body, carrier, pocket, logo, stamp);

    const doc = el.ownerDocument || document;
    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let recording = false, destroyed = false, intersecting = true;
    function update() {
      if (destroyed) return;
      el.dataset.recording = String(recording);
      el.dataset.spinning = String(recording && !doc.hidden && intersecting
        && el.isConnected !== false && !(motion && motion.matches));
    }
    let observer;
    if (window.IntersectionObserver) {
      observer = new window.IntersectionObserver(entries => {
        for (const entry of entries) if (entry.target === el) intersecting = entry.isIntersecting;
        update();
      });
      observer.observe(el);
    }
    doc.addEventListener('visibilitychange', update);
    if (motion) {
      if (motion.addEventListener) motion.addEventListener('change', update);
      else if (motion.addListener) motion.addListener(update);
    }
    return {
      el,
      setRecording(value) {
        if (destroyed) return;
        recording = value === true;
        update();
      },
      destroy() {
        if (destroyed) return;
        recording = false;
        update();
        destroyed = true;
        if (observer) observer.disconnect();
        doc.removeEventListener('visibilitychange', update);
        if (motion) {
          if (motion.removeEventListener) motion.removeEventListener('change', update);
          else if (motion.removeListener) motion.removeListener(update);
        }
      },
    };
  }
  return { create };
})();
