/* Пульс: журнал поведения для фокус-группы. Какой экран открыт и сколько на нём пробыли,
   куда нажали, что раскрыли, какую фразу выделили, что проиграли, какие ошибки случились.
   Модуль ничего не рисует и ничего не меняет в тренажёре. Сбой сбора не должен задевать
   тренировку: каждый обработчик глотает свои ошибки, очередь ограничена, отправка идёт
   мимо общего api() и черновиков. Значения полей ввода и личный ключ в журнал не попадают. */
(function () {
  'use strict';
  const FLUSH_MS = 15000;          // как часто отдаём события серверу
  const IDLE_MS = 5 * 60 * 1000;   // без касаний дольше — время на экране не считаем
  const MAX_QUEUE = 300, MAX_BATCH = 60;

  const guard = (fn) => function () { try { return fn.apply(this, arguments); } catch (_) { return undefined; } };
  const cut = (value, limit) => String(value == null ? '' : value).replace(/\/u\/[A-Za-z0-9_-]{8,}/g, '/u/…')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
  // Адрес запуска несёт личный ключ («#ключ~раздел»), поэтому экраном считается только «#/…».
  const route = () => {
    const hash = String(location.hash || '');
    return hash === '' || hash === '#' ? '#/' : /^#\//.test(hash) ? hash.slice(0, 160) : 'launch';
  };
  const fileName = (address) => {
    try {
      const parsed = new URL(String(address || ''), location.href);
      if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return parsed.protocol.slice(0, -1);
      return cut(parsed.pathname.split('/').pop(), 80);
    } catch (_) { return ''; }
  };

  const visit = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let queue = [], sent = 0;
  let screen = route(), visible = !document.hidden, since = Date.now(), lastInput = Date.now(), depth = 0;

  function push(kind, data) {
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push(Object.assign({ e: kind, t: Date.now(), r: screen }, data || {}));
  }

  // Списывает время, проведённое на текущем экране: только пока страница видна и человек не ушёл.
  function settle() {
    const now = Date.now();
    if (visible) {
      const ms = Math.min(now, lastInput + IDLE_MS) - since;
      if (ms >= 1000) push('stay', { ms: Math.round(ms), d: depth });
    }
    since = now;
  }

  // Часть переходов тренажёр делает без события hashchange, поэтому экран сверяется и по ходу дела.
  function sync() {
    const next = route();
    if (next === screen) return;
    settle();
    screen = next; depth = 0; lastInput = Date.now();
    push('view');
  }

  const touched = () => { lastInput = Date.now(); };

  function flush() {
    if (!queue.length) return;
    const connection = window.TrainerConnection;
    if (!connection || (connection.isHosted && !connection.getKey())) return;   // до входа человек не опознан
    let address;
    try { address = connection.url('/api/activity'); } catch (_) { return; }
    const batch = queue.splice(0, MAX_BATCH);
    const back = () => { queue = batch.concat(queue).slice(-MAX_QUEUE); };
    try {
      fetch(address, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' },
        body: JSON.stringify({ v: visit, n: ++sent, events: batch }) })
        .then((answer) => { if (answer.status >= 500) back(); }, back);
    } catch (_) { back(); }
  }

  function describe(node) {
    if (!node || !node.closest) return null;
    const el = node.closest('button, a, summary, label, select, input, textarea, [role="button"], [role="tab"], [data-nav]') || node;
    if (el === document.body || el === document.documentElement) return null;
    const tag = String(el.tagName || '').toLowerCase();
    const field = tag === 'input' || tag === 'textarea' || tag === 'select';
    const named = el.getAttribute('aria-label') || el.getAttribute('title')
      || (field ? el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('type') : '');
    // У поля ввода берётся только подпись, у большого блока — только его класс: чужой текст целиком не нужен.
    const own = field ? '' : String(el.textContent || '');
    const out = { tag, txt: cut(named || (own.length > 400 ? '' : own), 80) };
    const cls = cut(typeof el.className === 'string' ? el.className : '', 60);
    if (cls) out.cls = cls;
    const href = el.getAttribute('href');
    if (href && /^#\//.test(href)) out.href = cut(href, 120);
    return out;
  }

  document.addEventListener('click', guard((event) => {
    touched(); sync();
    const what = describe(event.target);
    if (what) push('click', what);
  }), true);

  document.addEventListener('toggle', guard((event) => {
    const box = event.target;
    if (!box || box.tagName !== 'DETAILS') return;
    const title = box.querySelector('summary');
    push('toggle', { txt: cut(title ? title.textContent : '', 80), open: !!box.open });
  }), true);

  const media = (kind) => guard((event) => {
    const player = event.target, tag = String((player && player.tagName) || '').toLowerCase();
    if (tag !== 'video' && tag !== 'audio') return;
    touched();
    push('media', { k: kind, tag, src: fileName(player.currentSrc || player.src), at: Math.round((player.currentTime || 0) * 10) / 10 });
  });
  for (const kind of ['play', 'pause', 'ended']) document.addEventListener(kind, media(kind), true);
  document.addEventListener('timeupdate', touched, true);   // пока идёт ролик или запись, человек здесь

  let selecting = 0, lastPhrase = '';
  const phrase = () => {
    const active = document.activeElement, tag = active && active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return '';
    return cut(document.getSelection ? document.getSelection() : '', 200);
  };
  document.addEventListener('selectionchange', guard(() => {
    clearTimeout(selecting);
    selecting = setTimeout(guard(() => {
      const text = phrase();
      if (text.length < 8 || text === lastPhrase) return;
      lastPhrase = text;
      push('select', { txt: text });
    }), 1200);
  }));
  document.addEventListener('copy', guard(() => { const text = phrase(); if (text) push('copy', { txt: text }); }));

  let measured = 0;
  document.addEventListener('scroll', guard((event) => {
    touched();
    const now = Date.now();
    if (now - measured < 250) return;
    measured = now;
    const box = event.target === document || !event.target.scrollHeight ? document.scrollingElement || document.documentElement : event.target;
    const room = box.scrollHeight - box.clientHeight;
    if (room > 40) depth = Math.max(depth, Math.min(100, Math.round(100 * box.scrollTop / room)));
  }), { capture: true, passive: true });
  for (const kind of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(kind, touched, { capture: true, passive: true });

  window.addEventListener('hashchange', guard(sync));
  document.addEventListener('visibilitychange', guard(() => {
    settle();
    visible = !document.hidden; lastInput = Date.now();
    push(visible ? 'show' : 'hide');
    if (!visible) flush();
  }));
  window.addEventListener('pagehide', guard(() => { settle(); visible = false; flush(); }));

  window.addEventListener('error', guard((event) => {
    if (event && event.message) push('error', { msg: cut(event.message, 200), src: fileName(event.filename) + ':' + (event.lineno || 0) });
  }));
  window.addEventListener('unhandledrejection', guard((event) => {
    const reason = event && event.reason;
    push('error', { msg: cut((reason && reason.message) || reason, 200), src: 'promise' });
  }));

  guard(() => {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    push('open', { ua: cut(navigator.userAgent, 200), pwa: !!standalone, w: window.innerWidth || 0, h: window.innerHeight || 0 });
  })();
  setInterval(guard(() => { sync(); if (visible) settle(); flush(); }), FLUSH_MS);
})();
