'use strict';
/* Тренажёр речи — интерфейс. Без сборки и внешних библиотек.
   Весь пользовательский текст (расшифровка, ответы тренера) вставляется
   через textContent, никогда через innerHTML. */

/* ===================== утилиты ===================== */
const NS = 'http://www.w3.org/2000/svg';
const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  return add(el, kids);
}
function add(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === true || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, String(v));
  return add(el, kids);
}

const ICONS = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  shuffle: '<path d="M4 7h3c2.2 0 3.2 1.2 4.6 3.7C13 13.2 14 17 17 17h3M4 17h3c1.1 0 2-.4 2.7-1.1M14.3 8.1C15 7.4 15.8 7 17 7h3M17.5 4 20 7l-2.5 3M17.5 14l2.5 3-2.5 3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  redo: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 3h5"/>',
  funnel: '<path d="M4 5.5h16M7 12h10M10 18.5h4"/>',
  bolt: '<path d="M13 2.5 5.5 13.5h5.5l-1 8L17.5 10.5H12l1-8Z"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/>',
  scales: '<path d="M12 4v16M7 20h10M5 7.5h14M5 7.5 2.5 13a2.5 2.5 0 0 0 5 0L5 7.5ZM19 7.5 16.5 13a2.5 2.5 0 0 0 5 0L19 7.5Z"/>',
  ask: '<path d="M4 5h16v11H9.5L4 20V5Z"/><path d="M10 9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2M12 13.8v.2"/>',
  wave: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 11v2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor" stroke="none"/>',
  book: '<path d="M12 5.5C9.5 4 6 4 3.5 5.5V20c2.5-1.5 6-1.5 8.5 0m0-14.5c2.5-1.5 6-1.5 8.5 0V20c-2.5-1.5-6-1.5-8.5 0V5.5Z"/>',
};
function icon(name, cls) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  if (cls) el.setAttribute('class', cls);
  el.innerHTML = ICONS[name] || '';
  return el;
}
const EX_ICON = { minute: 'timer', compress: 'funnel', sprint: 'bolt', explain: 'bulb', duel: 'scales', coach: 'ask', free: 'mic' };
const LEARNING_KINDS = [
  { id: 'clarify', title: 'Уточни расплывчатую мысль', description: 'Назовите главное и сделайте понятным то, что скрывается за «это», «нормально» и «как-нибудь».', icon: 'bulb' },
  { id: 'synonyms', title: 'Синонимы по смыслу', description: 'Тренируйте выбор слов в коротких сообщениях и разговоре. В заданиях меняются ситуация и нужное действие.', icon: 'edit' },
  { id: 'lexicon', title: 'Слово из классики', description: 'Разберите слово в цитате и попробуйте употребить его в собственной современной фразе.', icon: 'book' },
];

const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const f1 = (v) => (v == null || Number.isNaN(v) ? '—' : nf1.format(v));
const pad = (n) => String(n).padStart(2, '0');
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
function mmss(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDay(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(str, n) {
  const d = parseDay(str);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
function dayDiff(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function normWord(t) {
  return String(t).toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я-]+/g, '').replace(/^-+|-+$/g, '');
}
const HES_RE = /^(?:э+(?:-э+)*м*|эм+|м+(?:-м+)*|хм+|а(?:-а+)+|а{3,}|ы+(?:-ы+)*|у(?:-у+)+|о(?:-о+)+|е(?:-е+)+)$/;
const isHes = (n) => !!n && HES_RE.test(n);

const prefs = {
  get(k, d) {
    try { const scope = window.TrainerDrafts ? TrainerDrafts.profile() : location.pathname; const v = localStorage.getItem('speech-trainer.pref|' + scope + '|' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    try { const scope = window.TrainerDrafts ? TrainerDrafts.profile() : location.pathname; localStorage.setItem('speech-trainer.pref|' + scope + '|' + k, JSON.stringify(v)); } catch (e) { /* приватный режим */ }
  },
};

function toast(msg, ms = 3400) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

/* Подтверждение прямо в кнопке: без системных диалогов. */
function confirmButton(label, confirmLabel, onConfirm, cls = 'btn danger small') {
  const btn = h('button', { class: cls, type: 'button' }, label);
  let armed = false, t = 0;
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = confirmLabel;
      t = setTimeout(() => { armed = false; btn.textContent = label; }, 4000);
      return;
    }
    clearTimeout(t);
    onConfirm(btn);
  });
  return btn;
}

/* ===================== API ===================== */
// Страница живёт либо в корне (на маке), либо по личной ссылке /u/<ключ>/ —
// поэтому все адреса строятся от её собственного пути.
const BASE = location.pathname.replace(/[^/]*$/, '');
const url = (path) => window.TrainerConnection ? TrainerConnection.url('/' + String(path).replace(/^\//, '')) : BASE + String(path).replace(/^\//, '');

async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: { ...(opts.headers || {}) } };
  if (opts.signal) init.signal = opts.signal;
  if (init.method !== 'GET') init.headers['X-Trainer'] = '1';
  if (opts.blob) {
    init.body = opts.blob;
    init.headers['Content-Type'] = opts.blob.type || 'application/octet-stream';
  } else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers['Content-Type'] = 'application/json';
  }
  const drafts = window.TrainerDrafts;
  const requestProfile = drafts && drafts.profile();
  let operation, savedAudio;
  if (!['GET', 'HEAD'].includes(init.method) && opts.photo) {
    init.headers['X-Request-ID'] = opts.requestId || crypto.randomUUID();
  } else if (!['GET', 'HEAD'].includes(init.method) && drafts) {
    operation = await drafts.operation(init.method, path, init.body, init.headers);
    if (drafts.profile() !== requestProfile) throw new Error('Профиль изменился. Откройте нужное занятие заново.');
    init.headers['X-Request-ID'] = opts.requestId || operation.requestId;
    if (opts.onRequestId) opts.onRequestId(init.headers['X-Request-ID']);
    if (opts.blob) {
      // Повтор старой копии не перезаписывает новую запись другой вкладки.
      if (opts.requestId) savedAudio = { requestId: opts.requestId };
      else {
        savedAudio = await drafts.audio(path, opts.blob, opts.headers || {}, init.headers['X-Request-ID'], { profile: requestProfile });
        if (!savedAudio.durable) toast('Браузер не смог сохранить запись на устройстве. Не закрывайте страницу до отправки.', 7000);
      }
    }
  }
  if (drafts && drafts.profile() !== requestProfile) throw new Error('Профиль изменился. Повторите действие в нужном профиле.');
  let r, text;
  try {
    r = window.TrainerConnection ? await TrainerConnection.request(path, init) : await fetch(url(path), init);
    text = await r.text();
  } catch (e) {
    // Отмена остаётся отменой; таймаут отправки не доказывает, что Mac выключен.
    if (e.name === 'AbortError') { e.requestId = init.headers['X-Request-ID']; throw e; }
    const read = ['GET', 'HEAD'].includes(init.method);
    const message = read
      ? (e.name === 'TrainerRequestTimeoutError' ? 'Сервер долго не отвечает. Попробуйте ещё раз.' : 'Сейчас нет связи с сервером. Попробуйте ещё раз после подключения.')
      : (opts.photo ? 'Не удалось подтвердить загрузку фотографии. Проверьте связь и попробуйте ещё раз.'
        : opts.blob ? 'Нет подтверждения отправки. Запись сохранена; проверьте связь и повторите отправку.' : 'Нет подтверждения отправки. Проверьте связь и состояние занятия перед повтором.');
    const error = new Error(message);
    error.name = e.name || 'TrainerTransportError';
    error.cause = e;
    error.requestId = init.headers['X-Request-ID'];
    throw error;
  }
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = null; }
  if (!r.ok) {
    if (operation && data && r.status < 500 && !data.request_state) await drafts.remove(operation.id, undefined, requestProfile);
    const error = new Error((data && data.error) || `Ошибка сервера (${r.status})`);
    error.status = r.status;
    error.requestState = data && data.request_state;
    error.requestId = init.headers['X-Request-ID'];
    throw error;
  }
  // Непрочитанный ответ — ошибка, а не пустой объект: пустышка затирала открытую сессию.
  if (data === null) {
    const error = new Error('Сервер ответил непонятно. Проверьте состояние занятия и повторите отправку при необходимости.');
    error.requestId = init.headers['X-Request-ID'];
    throw error;
  }
  if (operation) await drafts.remove(operation.id, undefined, requestProfile);
  if (savedAudio) await drafts.remove('audio:' + path, savedAudio.requestId, requestProfile);
  if (drafts && drafts.profile() !== requestProfile) throw new Error('Профиль изменился. Откройте нужное занятие заново.');
  if (savedAudio) window.dispatchEvent(new CustomEvent('trainer:audiosent', {
    detail: { path, requestId: savedAudio.requestId, profile: requestProfile, session: data },
  }));
  return data;
}

/* Готовая запись переживает закрытие страницы; отправка всегда по нажатию. */
let recoverySerial = 0;
async function showDraftRecovery() {
  if (!window.TrainerDrafts) return;
  const serial = ++recoverySerial;
  const records = (await TrainerDrafts.list()).filter((r) => r.kind === 'audio');
  if (serial !== recoverySerial) return;
  let box = $('#trainer-recovery');
  if (!box) { box = h('section', { id: 'trainer-recovery', class: 'trainer-recovery page', 'aria-label': 'Неотправленные записи' }); $('#app').before(box); }
  box.querySelectorAll('audio').forEach((a) => { a.pause(); if (a.dataset.blobUrl) URL.revokeObjectURL(a.dataset.blobUrl); });
  box.replaceChildren(); box.hidden = !records.length;
  records.forEach((record) => {
    const audioUrl = URL.createObjectURL(record.blob);
    const player = h('audio', { controls: true, preload: 'metadata', src: audioUrl, 'aria-label': 'Неотправленная запись' });
    player.dataset.blobUrl = audioUrl;
    const note = h('p', { class: 'small soft', role: 'status' }, record.durable ? 'Запись сохранена на этом устройстве. Она пока не отправлена либо ожидает подтверждения.' : 'Запись есть только в открытой странице. Браузер не разрешил сохранить её надолго.');
    const retry = h('button', { class: 'btn', type: 'button', onclick: async () => {
      retry.disabled = true; note.textContent = 'Проверяю отправку…';
      try {
        await api(record.path, { method: 'PUT', blob: record.blob, headers: record.headers, requestId: record.requestId });
        location.hash = record.route || '#/history';
        await route(); toast('Запись принята. Проверка продолжится на сервере.');
      } catch (e) { note.textContent = e.message; retry.disabled = false; }
    } }, 'Отправить сохранённую запись');
    const download = h('a', { class: 'btn ghost', href: audioUrl, download: 'речь-' + record.updated + (record.blob.type.includes('mp4') ? '.m4a' : '.webm') }, 'Скачать');
    box.append(h('div', { class: 'card' }, h('h2', null, record.label || 'Неотправленная запись'), note, player,
      h('div', { class: 'row' }, retry, download,
        confirmButton('Убрать копию с устройства', 'Убрать эту копию?', () => TrainerDrafts.remove(record.id, record.requestId)))));
  });
}
window.addEventListener('trainer:draftschange', showDraftRecovery);
const reconnectPlayback = new WeakMap();
window.addEventListener('trainer:backendchange', () => {
  // Переподключение само не включает ни микрофон, ни воспроизведение.
  document.querySelectorAll('audio[src]').forEach((audio) => {
    const address = new URL(audio.src, location.href);
    const at = address.pathname.indexOf('/media/');
    if (at < 0) return;
    const previous = reconnectPlayback.get(audio);
    const state = previous || { time: audio.currentTime, speed: audio.playbackRate };
    reconnectPlayback.set(audio, state);
    audio.pause();
    const adminPath = audio.dataset.trainerAdminMedia;
    const mediaPath = /^\/api\/admin\/users\/\d{1,20}\/sessions\/[A-Za-z0-9-]+\/media\/[A-Za-z0-9._-]+$/.test(adminPath || '')
      ? adminPath : address.pathname.slice(at) + address.search;
    audio.src = url(mediaPath);
    audio.onloadedmetadata = () => {
      if (reconnectPlayback.get(audio) !== state) return;
      audio.currentTime = Math.min(state.time, Number.isFinite(audio.duration) ? audio.duration : state.time);
      audio.playbackRate = state.speed;
      reconnectPlayback.delete(audio);
      audio.onloadedmetadata = null;
    };
    audio.load();
  });
});
document.addEventListener('error', (event) => {
  const media = event.target;
  if (media instanceof HTMLAudioElement && /\/media\//.test(media.currentSrc || media.src || '') && window.TrainerConnection) {
    TrainerConnection.reconnect(true).catch(() => {});
  }
}, true);

/* Вкладка живёт днями, а переходы внутри неё страницу не перезагружают.
   Если код тренажёра обновился, старая страница может говорить с новым сервером
   на разных языках — поэтому сверяем отпечаток версии. */
let webVersion = null;
async function checkVersion(reloadIfStale) {
  let hl;
  try { hl = await api('/api/health'); } catch (e) { return false; }
  if (!hl.web_version) return false;
  if (!webVersion) { webVersion = hl.web_version; return false; }
  if (hl.web_version === webVersion) return false;
  if (reloadIfStale) { location.reload(); return true; }
  const b = $('#banner');
  b.classList.add('info');
  b.replaceChildren(h('span', null, 'Тренажёр обновился. Обновите страницу, чтобы всё работало как надо. '),
    h('button', { class: 'btn small', type: 'button', onclick: () => location.reload() }, 'Обновить'));
  b.hidden = false;
  return true;
}

const app = { catalog: null, state: null };

/* ===================== звук ===================== */
const sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  beep(freq = 880, dur = 0.12, vol = 0.16) {
    if (!prefs.get('sounds', true)) return Promise.resolve();
    try {
      const ctx = this.ensure();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* без звука так без звука */ }
    return wait((dur + 0.03) * 1000);
  },
};

function speak(text, onend) {
  const synth = window.speechSynthesis;
  if (!synth) { onend && onend(false); return false; }
  synth.cancel();
  const voices = synth.getVoices();
  const ru = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ru'));
  if (!ru.length && voices.length) { onend && onend(false); return false; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  u.voice = ru.find((v) => /milena|yuri|katya|катя|милена|юрий/i.test(v.name)) || ru[0] || null;
  let done = false;
  const finish = () => { if (!done) { done = true; onend && onend(true); } };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
  // onend в Chrome иногда не приходит — страхуемся по длине текста.
  setTimeout(finish, 2500 + text.length * 90);
  return true;
}

/* ===================== микрофон и запись ===================== */
const mic = {
  stream: null, src: null, analyser: null, buf: null,
  live() { return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live'); },
  async open() {
    if (this.live()) return this.stream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Браузер не даёт доступ к микрофону. Откройте свою постоянную HTTPS-ссылку в Safari или Chrome.');
    }
    const id = prefs.get('micId', '');
    // Без шумодава и автогромкости: они съедают тихое «м-м» и искажают паузы.
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...base, deviceId: { exact: id } } : base });
    } catch (e) {
      if (id && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        prefs.set('micId', '');
        try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: base }); } catch (e2) { throw micError(e2); }
      } else {
        throw micError(e);
      }
    }
    const ctx = sound.ensure();
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.src.connect(this.analyser);
    return this.stream;
  },
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const db = 20 * Math.log10(Math.sqrt(sum / this.buf.length) + 1e-8);
    return Math.max(0, Math.min(1, (db + 58) / 48));
  },
  close() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.src) this.src.disconnect();
    this.stream = this.src = this.analyser = null;
  },
};
function micError(e) {
  if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
    return new Error('Нет доступа к микрофону. Разрешите его в адресной строке браузера и попробуйте снова. На маке ещё проверьте: Системные настройки → Конфиденциальность и безопасность → Микрофон.');
  }
  if (e.name === 'NotFoundError') return new Error('Микрофон не найден. Подключите его или выберите другой в настройках.');
  if (e.name === 'NotReadableError') return new Error('Микрофон занят другой программой. Закройте её и попробуйте снова.');
  return new Error('Не удалось включить микрофон: ' + (e.message || e.name));
}
function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* дальше */ }
  }
  return '';
}
class Recorder {
  constructor(stream) {
    const mime = pickMime();
    if (mime === null) throw new Error('Этот браузер не умеет записывать звук. Откройте тренажёр в Chrome или Safari.');
    this.chunks = [];
    this.mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 96000 } : undefined);
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
  }
  start() { this.mr.start(250); this.t0 = performance.now(); }
  get elapsed() { return (performance.now() - this.t0) / 1000; }
  stop() {
    return new Promise((res) => {
      const done = () => res(new Blob(this.chunks, { type: (this.mr.mimeType || 'audio/webm').split(';')[0] }));
      if (this.mr.state === 'inactive') return done();
      this.mr.onstop = done;
      this.mr.stop();
    });
  }
  cancel() { try { if (this.mr.state !== 'inactive') this.mr.stop(); } catch (e) { /* уже стоит */ } }
}

/* Бегущая полоска громкости: видно, что тренер вас «слышит». */
function levelMeter(canvas) {
  const g = canvas.getContext('2d');
  const bars = new Array(56).fill(0);
  let raf = 0, running = false, last = 0, color = '#888';
  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < 45) return;
    last = ts;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, canvas.clientWidth * dpr), hh = Math.max(1, canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    bars.push(mic.level());
    bars.shift();
    g.clearRect(0, 0, w, hh);
    g.fillStyle = color;
    const n = bars.length, gap = 2 * dpr, bw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(2 * dpr, bars[i] * hh);
      g.globalAlpha = 0.35 + 0.65 * (i / n);
      g.fillRect(i * (bw + gap), (hh - bh) / 2, bw, bh);
    }
    g.globalAlpha = 1;
  }
  return {
    start() {
      if (running) return;
      color = getComputedStyle(canvas).color;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      bars.fill(0);
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

/* ===================== роутер ===================== */
let current = null;
let routeToken = 0;

async function route() {
  const token = ++routeToken;
  // При переходе между разделами терять нечего — тихо подтягиваем свежую версию.
  if (webVersion) checkVersion(false);
  if (current && current.destroy) current.destroy();
  current = null;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  hideTip();
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');
  const key = parts[0] || 'home';
  if (window.TrainerProfiles) TrainerProfiles.refreshHeader();
  const adminEntry = $('#admin-link');
  if (adminEntry) {
    adminEntry.classList.toggle('active', key === 'admin');
    if (key === 'admin') adminEntry.setAttribute('aria-current', 'page');
    else adminEntry.removeAttribute('aria-current');
  }
  const navKey = { ex: 'home', s: 'home', learn: 'home' }[key] || key;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
  const root = $('#app');
  root.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'spinner', style: 'margin:0 auto' })));
  const ctx = { alive: () => token === routeToken, root };
  try {
    let view;
    if (key === 'profile' && window.TrainerProfiles) view = await TrainerProfiles.view(ctx, parts, params);
    else if (key === 'admin' && window.TrainerAdmin) view = await TrainerAdmin.view(ctx, parts);
    else if (key === 'groups' && parts[2] === 'duels' && window.TrainerDuels) view = await TrainerDuels.view(ctx, parts, params);
    else if (key === 'groups' && window.TrainerGroups) view = await TrainerGroups.view(ctx, parts, params);
    else if (key === 'ex') view = await ExerciseView(ctx, { exId: parts[1], params });
    else if (key === 's') view = await ExerciseView(ctx, { sid: parts[1], params });
    else if (key === 'learn') view = await LearningCatalogView(ctx, parts[1]);
    else if (key === 'program') view = await ProgramView(ctx);
    else if (key === 'history') view = await HistoryView(ctx, params);
    else if (key === 'progress') view = await ProgressView(ctx);
    else view = await HomeView(ctx);
    if (ctx.alive()) current = view;
    else if (view && view.destroy) view.destroy();
  } catch (e) {
    if (ctx.alive()) root.replaceChildren(errorBlock(e));
  }
}
function render(ctx, ...nodes) {
  if (!ctx.alive()) return false;
  ctx.root.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
  window.scrollTo(0, 0);
  return true;
}
function errorBlock(e) {
  return h('div', { class: 'card empty' }, h('h3', null, 'Что-то пошло не так'), h('p', null, e.message || String(e)),
    h('p', { style: 'margin-top:14px' }, h('a', { class: 'btn ghost small', href: '#/' }, 'На главную')));
}

/* ===================== общие расчёты ===================== */
function durLabel(ex) {
  const lim = ex.takes.map((t) => t.limit);
  if (lim.some((x) => !x)) return 'без лимита';
  if (lim.length > 1 && lim.every((x) => x === lim[0])) return `${lim.length} × ${lim[0]} с`;
  return lim.join(' + ') + ' с';
}
function tempoZone(wpm) {
  if (!wpm) return '';
  if (wpm < 90) return 'медленно';
  if (wpm < 150) return 'комфортно';
  if (wpm < 190) return 'быстро';
  return 'очень быстро';
}
function doneSessions(sessions) {
  return sessions.filter((s) => s.summary && (s.analysis || {}).status === 'done');
}
function programStatus(sessions, state) {
  const competition = state.competition;
  const today = competition ? competition.today : todayStr();
  const start = state.program_start;
  const done = doneSessions(sessions).filter((s) => {
    if (competition ? s.group_id !== competition.id : !!s.group_id) return false;
    const count = Array.isArray(s.plan) ? s.plan.length : s.plan;
    return count > 0 && (s.takes || []).filter((t) => t.status === 'done').length >= count;
  });
  const stepsOn = (day) => {
    const set = new Set();
    for (const s of done) if (s.program_day === day) set.add(s.exercise);
    return catalog().program.filter((p) => set.has(p.exercise)).length;
  };
  const steps = catalog().program.map((p, i) => {
    const ses = done.find((x) => x.program_day === today && x.exercise === p.exercise);
    const shared = competition && (competition.tasks || []).find((task) => task.exercise === p.exercise);
    return { ...p, i, done: shared ? shared.done : !!ses, session: ses, score: shared ? shared.score : null };
  });
  return {
    start,
    dayN: start ? dayDiff(start, today) + 1 : null,
    steps,
    doneCount: steps.filter((x) => x.done).length,
    next: steps.find((x) => !x.done) || null,
    stepsOn,
  };
}
function programHref(exercise, competition) {
  return `#/ex/${exercise}?program=1${competition ? '&group=' + encodeURIComponent(competition.id) : ''}`;
}
async function programForGroup(state, gid) {
  if (!gid || (state.competition && state.competition.id === gid)) return state.competition;
  const group = await api(`/api/groups/${encodeURIComponent(gid)}`);
  if (!group.joined) throw new Error('Для выполнения задания нужно вступить в эту группу.');
  const day = group.daily.find((row) => row.today);
  if (!day) throw new Error('Задания этой группы пока недоступны.');
  return { id: group.id, name: group.name, week: group.week, today: day.date, tasks: day.tasks };
}
function streak(sessions) {
  const days = new Set(doneSessions(sessions).filter((session) => !isDemoSession(session)).map((s) => (s.created || '').slice(0, 10)));
  let d = todayStr();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const catalog = () => app.catalog;

function pickTopic(exId, exclude) {
  const ex = catalog().exercises[exId];
  if (!ex || !ex.bank) return '';
  let pool;
  if (exId === 'coach') {
    const lvl = (app.state && app.state.coach_level) || 1;
    pool = catalog().banks.coach[lvl] || catalog().banks.coach[1];
  } else {
    pool = catalog().banks[ex.bank] || [];
  }
  const recent = prefs.get('recent.' + exId, []);
  const fresh = pool.filter((t) => !recent.includes(t) && t !== exclude);
  const list = fresh.length ? fresh : pool.filter((t) => t !== exclude);
  return list[Math.floor(Math.random() * list.length)] || pool[0] || '';
}
function rememberTopic(exId, topic) {
  const recent = prefs.get('recent.' + exId, []).filter((t) => t !== topic);
  recent.unshift(topic);
  prefs.set('recent.' + exId, recent.slice(0, 15));
}

/* ===================== главная ===================== */
async function HomeView(ctx) {
  const [state, sessions] = await Promise.all([api('/api/state'), api('/api/sessions')]);
  app.state = state;
  if (window.TrainerProfiles) TrainerProfiles.refreshHeader(state);
  const ps = programStatus(sessions, state);
  const lastByEx = {};
  for (const x of doneSessions(sessions)) if (!isDemoSession(x) && !lastByEx[x.exercise]) lastByEx[x.exercise] = x;

  const today = h('div', { class: 'card today-card' },
    h('div', { class: 'row' }, h('h2', null, 'Программа дня'), h('span', { class: 'spacer' }),
      ps.start ? h('span', { class: 'chip' }, ps.dayN > 30 ? 'программа пройдена' : `день ${ps.dayN} из 30`) : null),
    state.competition ? h('p', { class: 'soft' }, h('a', { href: `#/groups/${state.competition.id}` }, state.competition.name), ' · задания общие для всей группы') : null,
    h('p', { class: 'soft' }, ps.start
      ? (ps.doneCount === 5 ? 'Все пять упражнений на сегодня сделаны. Завтра — следующий день.' : `Сделано ${ps.doneCount} из 5. Следующее — «${catalog().exercises[ps.next.exercise].title}».`)
      : '20 минут в день: спринт, минута без подготовки, сокращение мысли, объяснение и поединок. 30 дней подряд.'),
    h('div', { class: 'steps', 'aria-hidden': 'true' }, ps.steps.map((x) => h('span', { class: x.done ? 'done' : '' }))),
    h('div', { class: 'row' },
      ps.next
        ? h('a', { class: 'btn', href: programHref(ps.next.exercise, state.competition) }, ps.start ? 'Продолжить' : 'Начать программу', icon('arrow'))
        : h('a', { class: 'btn ghost', href: '#/progress' }, 'Посмотреть прогресс'),
      h('a', { class: 'btn ghost', href: '#/program' }, 'Вся программа')));

  const nextQ = (state.coach_next && state.coach_next.question) || catalog().first_coach_question;
  const coach = h('div', { class: 'card coach-card' },
    h('div', { class: 'grow' },
      h('div', { class: 'row' }, h('span', { class: 'chip dark' }, `Вопрос тренера · уровень ${state.coach_level}`),
        h('span', { class: 'muted small' }, '30 секунд, без подготовки')),
      h('div', { class: 'q' }, nextQ)),
    h('a', { class: 'btn', href: '#/ex/coach' }, icon('mic'), 'Ответить'));

  const cards = catalog().order.map((id) => {
    const ex = catalog().exercises[id];
    const last = lastByEx[id];
    return h('a', { class: 'ex-card', href: `#/ex/${id}` },
      h('div', { class: 'icon' }, icon(EX_ICON[id])),
      last ? h('span', { class: 'score-pill score-badge', title: 'Средняя оценка в прошлый раз' }, f1(last.summary.overall), h('small', null, '/10')) : null,
      h('h3', null, ex.title),
      h('p', { class: 'soft small' }, ex.hint),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, ex.develops), h('span', null, durLabel(ex))));
  });

  render(ctx,
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('h1', null, 'Говорить быстро, грамотно и убедительно'),
        h('p', null, 'Отвечаете голосом — тренер слышит каждое «ну», «вот» и «э-э», меряет паузы по звуку, находит неточности и показывает, как сказать сильнее.'),
        h('div', { class: 'skills' }, ['Логика', 'Словарный запас', 'Скорость мышления', 'Убедительность', 'Структура речи'].map((x) => h('span', { class: 'chip' }, x)))),
      today),
    window.TrainerProfiles ? TrainerProfiles.invitation(state) : null,
    coach,
    h('div', { class: 'section-title' }, h('h2', null, 'Мысль и слово'), h('a', { href: '#/learn' }, 'Все задания', icon('arrow'))),
    h('p', { class: 'soft learning-intro' }, 'Короткие задания на ясность мысли и точность слов. Можно отвечать текстом или голосом.'),
    h('div', { class: 'ex-grid learning-kinds' }, LEARNING_KINDS.map((kind) => h('a', { class: 'ex-card', href: `#/learn/${kind.id}` },
      h('div', { class: 'icon' }, icon(kind.icon)), h('h3', null, kind.title), h('p', { class: 'soft small' }, kind.description), h('div', { class: 'meta' }, h('span', { class: 'chip' }, 'Сначала своя попытка'), h('span', null, 'без таймера'))))),
    h('div', { class: 'section-title' }, h('h2', null, 'Упражнения'), h('span', { class: 'muted' }, 'каждое — отдельный навык')),
    h('div', { class: 'ex-grid' }, cards),
    h('div', { class: 'note-row' },
      h('div', { class: 'card' }, h('h3', null, 'Быстро говорить'), h('p', { class: 'soft small' }, 'Произносить много слов за короткое время. Полезно, но не главное.')),
      h('div', { class: 'card' }, h('h3', null, 'Быстро мыслить'), h('p', { class: 'soft small' }, 'Находить нужные аргументы и формулировки без долгих пауз. Сюда — главный приоритет.')),
      h('div', { class: 'card' }, h('h3', null, 'Убедительно говорить'), h('p', { class: 'soft small' }, 'Доносить мысль так, чтобы её сразу поняли. Короткая осмысленная пауза здесь помогает, а не мешает.'))));
  return null;
}

/* ===================== мысль и слово ===================== */
function isDemoSession(sess) {
  return !!sess && sess.demonstration === true;
}

function demoResultNotice(sess) {
  if (!isDemoSession(sess)) return null;
  return h('aside', { class: 'card callout', role: 'note', 'aria-label': 'Демонстрационный результат' },
    h('h2', null, 'Демонстрационный результат'),
    h('p', null, 'Оценки заданы для примера; аудиозаписи и анализа тренера не было.'),
    h('p', { class: 'small soft' }, 'Темп, паузы и другие замеры не проводились.'));
}

function isLearningSession(sess) {
  return !!sess && LEARNING_KINDS.some((k) => k.id === (sess.learning_kind || sess.exercise)) && !(sess.takes || []).length && !(sess.plan || []).length;
}
function successfulThought(p) {
  return (p.attempts || []).some((a) => a.status === 'done' && a.review && a.review.assessment === 'improved' && a.review.meaning_preserved === 'yes' && (!a.review.goal_met || a.review.goal_met === 'yes'));
}
function learningProgress(thoughts) {
  const base = thoughts.filter((p) => !p.transfer_from || p.transfer_type === 'new_exercise');
  const transfer = thoughts.filter((p) => p.transfer_from && p.transfer_type !== 'new_exercise');
  return {
    completed: base.filter(successfulThought).length, total: base.length,
    transfer_completed: transfer.filter(successfulThought).length, transfer_total: transfer.length,
    independent_transfers: transfer.filter((p) => (p.attempts || []).some((a) => a.hints_used === 0 && successfulThought({ attempts: [a] }))).length,
  };
}
function learningProgressText(progress) {
  if (!progress) return '';
  return `Основное задание: ${progress.completed || 0} · перенос на другую тему: ${progress.transfer_completed || 0} · самостоятельно: ${progress.independent_transfers || 0}`;
}
function learningTaskPreview(task) {
  const text = String(task || '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  if (chars.length <= 170) return text;
  return chars.slice(0, 167).join('').replace(/\s+\S*$/, '') + '…';
}
async function LearningCatalogView(ctx, kindId) {
  const data = await api('/api/learning');
  const kinds = data.kinds || [];
  const selected = kindId ? kinds.find((k) => k.id === kindId) : null;
  const description = (kind) => kind.id === 'synonyms' ? LEARNING_KINDS.find((k) => k.id === 'synonyms').description : kind.description;
  if (kindId && !selected) throw new Error('Такого учебного раздела нет.');
  const guide = selected && typeof window.createLearningGuide === 'function'
    ? window.createLearningGuide(selected.id) : null;
  const error = h('p', { class: 'thought-error', role: 'alert', hidden: true });
  const buttons = [];
  let starting = false;
  async function start(kind, contentId, button) {
    if (starting) return;
    starting = true;
    error.hidden = true;
    buttons.forEach((b) => { b.disabled = true; });
    const old = button.textContent;
    button.textContent = 'Открываю задание…';
    try {
      const sess = await api('/api/learning', { method: 'POST', body: { kind, content_id: contentId } });
      if (ctx.alive()) location.hash = `#/s/${sess.id}`;
    } catch (e) {
      if (ctx.alive()) { error.textContent = e.message + ' Попробуйте ещё раз.'; error.hidden = false; }
    } finally {
      starting = false;
      buttons.forEach((b) => { b.disabled = false; });
      button.textContent = old;
    }
  }
  let recommended = null;
  if (selected && selected.id === 'synonyms') {
    const button = h('button', { class: 'btn', type: 'button' }, 'Дать короткое задание', icon('arrow'));
    button.addEventListener('click', () => start('synonyms', undefined, button));
    buttons.push(button);
    recommended = h('section', { class: 'learning-recommendation', 'aria-label': 'Короткая тренировка' },
      h('div', null, h('h2', null, 'Одна ситуация — ваша реплика'),
        h('p', null, 'Ответьте готовой репликой. Тренер подскажет, если нужна правка. После успеха будут новая ситуация и другие слова.')),
      button);
  }
  const body = selected ? h('div', { class: 'learning-items' }, (selected.items || []).map((item) => {
    const previous = item.progress && item.progress.last_session_id;
    const button = h('button', { class: 'btn' + (previous ? ' ghost' : ''), type: 'button' }, previous ? 'Начать заново' : 'Начать задание', icon('arrow'));
    button.addEventListener('click', () => start(selected.id, item.id, button));
    buttons.push(button);
    return h('article', { class: 'card learning-item' },
      item.practice_format && item.practice_format.label ? h('span', { class: 'chip learning-format-label' }, item.practice_format.label) : null,
      h('h2', null, item.title),
      item.vocabulary && item.vocabulary.register ? h('p', { class: 'small soft' }, item.vocabulary.register) : null,
      item.topic ? h('p', { class: 'soft' }, item.topic) : null,
      item.practice_format && item.task ? h('p', { class: 'learning-task-preview' }, learningTaskPreview(item.task)) : null,
      item.citation ? h('p', { class: 'small soft' }, `${item.citation.author} · ${item.citation.work}`) : null,
      item.progress && item.progress.created ? h('p', { class: 'small soft' }, item.progress.independent_transfer ? 'Перенос на новую тему получился самостоятельно.' : item.progress.transfer_completed ? 'Перенос получился с подсказками.' : item.progress.used ? 'Основное задание выполнено.' : 'Вы уже открывали это задание. Ваши попытки сохранены.') : null,
      h('div', { class: 'row learning-item-actions' }, previous ? h('a', { class: 'btn', href: `#/s/${previous}` }, 'Продолжить', icon('arrow')) : null, button));
  })) : h('div', { class: 'ex-grid learning-kinds' }, kinds.map((kind) => h('a', { class: 'ex-card', href: `#/learn/${kind.id}` },
    h('div', { class: 'icon' }, icon((LEARNING_KINDS.find((k) => k.id === kind.id) || {}).icon || 'bulb')),
    h('h2', null, kind.title), h('p', { class: 'soft' }, description(kind)),
    kind.progress ? h('p', { class: 'small soft' }, learningProgressText(kind.progress)) : null,
    h('div', { class: 'meta' }, h('span', { class: 'chip' }, `${(kind.items || []).length} ${plural((kind.items || []).length, 'задание', 'задания', 'заданий')}`), h('span', null, 'Выбрать', icon('arrow'))))));
  render(ctx,
    h('a', { class: 'back', href: selected ? '#/learn' : '#/' }, icon('back'), selected ? 'Мысль и слово' : 'Все упражнения'),
    h('div', { class: 'ex-head' }, h('h1', null, selected ? selected.title : 'Мысль и слово'), h('span', { class: 'chip' }, 'Без таймера')),
    h('p', { class: 'soft learning-intro' }, selected ? description(selected) : 'Учитесь формулировать мысль и выбирать точные слова. После своей попытки получите подсказку, а затем примените приём в другой ситуации.'),
    selected && selected.id === 'synonyms' ? null : h('div', { class: 'learning-principle' }, icon('info'), h('p', null, 'Удачная правка и самостоятельный ответ на новой теме учитываются отдельно. Близкие слова не всегда взаимозаменяемы: важны ситуация и нужный оттенок.')),
    recommended, guide ? guide.el : null, error, body);
  return guide ? { destroy() { guide.destroy(); } } : null;
}

async function LearningSessionView(ctx, initial) {
  let sess = initial, destroyed = false, pollT = 0, recording = false, progressKey = '';
  const kind = LEARNING_KINDS.find((k) => k.id === (sess.learning_kind || sess.exercise));
  const formattedSynonyms = kind.id === 'synonyms' && (sess.thoughts || []).some((p) => p.practice_format);
  const legacySynonyms = kind.id === 'synonyms' && !(sess.thoughts || []).some((p) => p.practice_format);
  const legacyNotice = legacySynonyms ? h('aside', { class: 'learning-legacy-notice', 'aria-label': 'Прежний формат задания' },
    icon('info'), h('div', null, h('h2', null, 'Это прежний формат. Ваши попытки сохранены.'),
      h('p', null, 'Здесь остаётся прежнее условие: две замены, объяснение разницы и своё предложение. В новых заданиях нужно составить готовую реплику для конкретной ситуации.'),
      h('a', { class: 'btn ghost', href: '#/learn/synonyms' }, 'Посмотреть новые задания', icon('arrow')))) : null;
  const guide = !legacySynonyms && typeof window.createLearningGuide === 'function'
    ? window.createLearningGuide(kind.id, { canOpen: () => !recording }) : null;
  const progress = h('section', { class: 'card learning-progress', 'aria-label': 'Прогресс задания' });
  const workshop = thoughtWorkshop({
    session: () => sess,
    alive: () => !destroyed && ctx.alive(),
    canRecord: () => !recording,
    recordingChanged: (value) => { recording = value; },
    changed: (fresh) => { if (!destroyed && fresh && fresh.id) { sess = fresh; update(); schedulePoll(); } },
  });
  const pending = () => (sess.thoughts || []).some((p) => (p.attempts || []).some((a) => ['processing', 'reviewing'].includes(a.status)));
  function schedulePoll() {
    clearTimeout(pollT);
    if (!destroyed && pending()) pollT = setTimeout(poll, 1000);
  }
  async function poll() {
    try {
      const fresh = await api(`/api/sessions/${sess.id}`);
      if (destroyed) return;
      sess = fresh;
      update();
    } catch (e) { /* сохранённая проверка будет доступна после восстановления связи */ }
    schedulePoll();
  }
  function update() {
    progress.hidden = formattedSynonyms && !(sess.thoughts || []).some((p) => (p.attempts || []).some((a) => a.status === 'done' && a.review && a.review.assessment));
    const p = learningProgress(sess.thoughts || []);
    const key = JSON.stringify(p);
    if (key !== progressKey) {
      progressKey = key;
      progress.replaceChildren(h('h2', null, 'Что уже получилось'),
        h('div', { class: 'learning-progress-grid' },
          h('div', null, h('h3', null, 'Основное задание'), h('p', null, p.completed ? ({ clarify: 'Формулировка стала яснее', synonyms: 'Слово выбрано по смыслу', lexicon: 'Слово употреблено по смыслу' }[kind.id] || 'Задание выполнено') : 'Пока тренируемся'), h('p', { class: 'small soft' }, p.completed ? 'Тренер подтвердил, что ответ подходит по смыслу и выполняет условие.' : 'Сначала ответьте своими словами. Если нужно, откройте подсказку.')),
          h('div', null, h('h3', null, 'На другой теме'), h('p', null, p.independent_transfers ? 'Получилось самостоятельно' : p.transfer_completed ? 'Получилось с помощью' : p.transfer_total ? 'Проверяем перенос' : 'Ещё не проверяли'), h('p', { class: 'small soft' }, p.independent_transfers ? 'Удачный ответ на новой теме без открытых подсказок.' : p.transfer_completed ? 'Подсказки помогли. Это отдельный шаг; самостоятельный перенос пока не подтверждён.' : 'После удачного ответа можно попробовать тот же приём в другой ситуации.'))));
    }
    workshop.update();
  }
  const onUnload = (e) => { if (recording) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onUnload);
  if (!render(ctx,
    h('a', { class: 'back', href: `#/learn/${kind.id}` }, icon('back'), kind.title),
    h('div', { class: 'ex-head' }, h('h1', null, sess.title || kind.title), h('span', { class: 'chip' }, 'Мысль и слово')),
    h('p', { class: 'soft learning-intro' }, formattedSynonyms ? 'Прочитайте ситуацию и ответьте так, как сказали бы собеседнику.' : legacySynonyms ? 'Продолжайте по сохранённому условию. Ниже доступны ваши прежние ответы и отзывы.' : kind.description),
    legacyNotice, guide ? guide.el : null, progress, workshop.el,
    h('div', { class: 'after-actions' }, h('a', { class: 'btn ghost', href: `#/learn/${kind.id}` }, 'Выбрать другое задание', icon('arrow')), h('span', { class: 'spacer' }), confirmButton('Удалить занятие', 'Точно удалить?', async () => {
      try { await api(`/api/sessions/${sess.id}`, { method: 'DELETE' }); location.hash = '#/history'; } catch (e) { toast(e.message); }
    })))) {
    workshop.destroy();
    if (guide) guide.destroy();
    window.removeEventListener('beforeunload', onUnload);
    return null;
  }
  update();
  schedulePoll();
  return { destroy() { destroyed = true; clearTimeout(pollT); workshop.destroy(); if (guide) guide.destroy(); mic.close(); window.removeEventListener('beforeunload', onUnload); } };
}

function learningMaterials(p) {
  if (!p.vocabulary && !p.citation) return null;
  const vocab = p.vocabulary || {};
  const citation = p.citation || {};
  const source = /^https?:\/\//i.test(citation.source_url || '') ? citation.source_url : null;
  return h('div', { class: 'learning-material' },
    citation.excerpt ? h('figure', { class: 'learning-citation' },
      h('blockquote', null, citation.excerpt),
      h('figcaption', null, citation.author, citation.work ? ` · «${citation.work}»` : '',
        source ? h('a', { href: source, target: '_blank', rel: 'noopener noreferrer' }, 'Источник', icon('arrow')) : null),
      citation.context ? h('p', { class: 'soft' }, citation.context) : null) : null,
    vocab.word ? h('div', { class: 'learning-word' }, h('h4', null, vocab.word),
      vocab.lemma && vocab.lemma !== vocab.word ? h('p', { class: 'small soft' }, `Словарная форма: ${vocab.lemma}`) : null,
      vocab.meaning ? h('p', null, vocab.meaning) : null,
      vocab.plain_equivalent ? h('p', { class: 'small soft' }, 'Привычными словами: ', vocab.plain_equivalent) : null,
      vocab.register ? h('p', { class: 'small soft' }, 'Как звучит: ', vocab.register) : null) : null,
    (vocab.usage_pairs || []).length ? h('div', null, h('h4', null, 'Как меняется оттенок'),
      h('p', { class: 'small soft' }, 'Обе формулировки могут быть уместны. Выбирайте ту, которая точнее передаёт вашу мысль.'),
      h('div', { class: 'learning-usage-pairs' }, vocab.usage_pairs.map((pair) => h('div', { class: 'learning-usage-pair' },
        h('div', null, h('span', { class: 'small soft' }, 'Привычная формулировка'), h('p', null, pair.plain)),
        h('div', null, h('span', { class: 'small soft' }, 'С новым словом'), h('p', null, pair.precise)),
        pair.note ? h('p', { class: 'small soft learning-pair-note' }, pair.note) : null)))) : null,
    (vocab.near_synonyms || []).length ? h('div', null, h('h4', null, 'Близкие слова и оттенки'),
      h('dl', { class: 'learning-nuances' }, vocab.near_synonyms.map((item) => [h('dt', null, item.word), h('dd', null, item.nuance)])),
      h('p', { class: 'small soft' }, 'Проверьте, подходит ли оттенок к вашей ситуации. Близкие слова не всегда взаимозаменяемы.')) : null,
    (vocab.everyday_examples || []).length ? h('div', null, h('h4', null, 'Примеры в современных ситуациях'), h('ul', { class: 'learning-examples' }, vocab.everyday_examples.map((text) => h('li', null, text)))) : null);
}

/* ===================== упражнение ===================== */
const STOP_SHORT = new Set([
  'это', 'так', 'вот', 'еще', 'или', 'как', 'что', 'где', 'там', 'тут', 'для', 'при', 'над', 'под', 'без', 'его', 'она',
  'они', 'оно', 'мой', 'моя', 'наш', 'ваш', 'все', 'уже', 'тоже', 'также', 'очень', 'когда', 'потом', 'нет', 'чтобы',
  'тебя', 'тебе', 'меня', 'мне', 'себя', 'есть', 'был', 'была', 'было', 'были', 'будет', 'который', 'которая', 'которое',
  'которые', 'которую', 'такой', 'такая', 'такое', 'такие', 'этот', 'эта', 'эти', 'того', 'тоже', 'надо', 'нужно',
  'можно', 'если', 'потому', 'чем', 'тем', 'про', 'через', 'после', 'ещё', 'просто', 'вообще', 'значит',
]);

function sprintWords(take) {
  const skip = new Set();
  (take.fillers_final || take.fillers_pre || []).forEach((sp) => { for (let k = 0; k < sp.len; k++) skip.add(sp.start + k); });
  const seen = new Set(), out = [];
  (take.words || []).forEach((w, i) => {
    if (skip.has(i)) return;
    const n = normWord(w.t);
    if (n.length < 3 || STOP_SHORT.has(n) || isHes(n) || seen.has(n)) return;
    seen.add(n);
    out.push(w.t.replace(/[.,!?…:;«»"()]/g, ''));
  });
  return out;
}

async function ExerciseView(ctx, { exId, sid, params }) {
  const v = {
    session: null, exId, ex: null, topic: '', stage: 'idle', stageError: '', rec: null, recIndex: 0,
    forceIndex: null, pollT: 0, raf: 0, cards: new Map(), destroyed: false, editing: false,
    anKey: '', afterKey: '', waitPolls: 0, sessionsCache: null, scrolledToResult: false, prepShown: null,
    thoughtMicBusy: false, pendingTake: null, reviewing: null,
  };
  const [state, sess] = await Promise.all([api('/api/state'), sid ? api(`/api/sessions/${sid}`) : Promise.resolve(null)]);
  app.state = state;
  if (sess) { v.session = sess; v.exId = sess.exercise; }
  if (sess && isLearningSession(sess)) return LearningSessionView(ctx, sess);
  if (sess && sess.group_duel && window.TrainerDuels) return TrainerDuels.review(ctx, sess);
  if (sess) await restorePendingTake();
  v.ex = catalog().exercises[v.exId];
  if (!v.ex) throw new Error('Нет такого упражнения.');
  const legacySprint = v.exId === 'sprint' && v.session && v.session.plan[1] &&
    (v.session.plan[1].mode === 'sentences' || (!v.session.plan[1].mode && /предложен/i.test(v.session.plan[1].label || '')));
  if (legacySprint) v.ex = { ...v.ex,
    hint: '30 секунд — слова, 90 секунд — предложения',
    howto: ['За 30 секунд назовите слова, связанные с темой. Только слова, без предложений.',
      'Затем за 90 секунд составьте с каждым названным словом короткое осмысленное предложение.',
      'У этой сохранённой попытки осталось прежнее задание. В новом спринте слова нужно соединить в одну историю.'],
  };
  v.programDay = v.session ? v.session.program_day : (params.get('program') ? todayStr() : null);
  const exerciseProgram = !v.session && (v.programDay || params.get('group'))
    ? await programForGroup(state, params.get('group')) : null;
  v.groupId = v.session ? v.session.group_id : (exerciseProgram ? exerciseProgram.id : null);
  const sharedTask = !v.session && exerciseProgram && exerciseProgram.tasks.find((task) => task.exercise === v.exId);
  if (sharedTask) {
    v.programDay = exerciseProgram.today;
    v.ex = { ...v.ex, takes: sharedTask.plan || v.ex.takes, prep: sharedTask.prep ?? v.ex.prep,
      howto: sharedTask.howto || v.ex.howto, hint: sharedTask.hint || v.ex.hint };
  }
  if (v.session && v.groupId) v.ex = { ...v.ex, prep: v.session.group_prep ?? v.ex.prep,
    howto: v.session.group_howto || v.ex.howto, hint: v.session.group_hint || v.ex.hint };
  v.topic = v.session ? v.session.topic : (v.exId === 'coach'
    ? ((state.coach_next && state.coach_next.question) || catalog().first_coach_question)
    : pickTopic(v.exId));
  if (sharedTask) v.topic = sharedTask.topic;
  const isFree = v.exId === 'free';
  const plan = () => (v.session ? v.session.plan : v.ex.takes);

  const takeAt = (i) => (v.session ? v.session.takes[i] : null);
  const firstMissing = () => {
    const p = plan();
    for (let i = 0; i < p.length; i++) {
      const t = takeAt(i);
      if (!t || t.status === 'missing' || t.status === 'error') return i;
    }
    return null;
  };
  const nextIndex = () => (v.forceIndex != null ? v.forceIndex : firstMissing());
  const allUploaded = () => !!v.session && v.session.takes.length >= plan().length &&
    plan().every((_, i) => takeAt(i) && !['missing', 'error'].includes(takeAt(i).status));
  const busy = () => v.thoughtMicBusy || ['prep', 'rec', 'upload', 'asking', 'starting'].includes(v.stage);

  /* ---- шапка и тема ---- */
  const backHref = v.groupId ? `#/groups/${v.groupId}` : (v.programDay ? '#/program' : (sid ? '#/history' : '#/'));
  const backText = v.groupId ? 'К группе' : (v.programDay ? 'Программа дня' : (sid ? 'История' : 'Все упражнения'));
  const firstVisit = !prefs.get('seen.' + v.exId, false);
  prefs.set('seen.' + v.exId, true);

  const topicTextEl = h('div', { class: 'topic-text' });
  const topicTools = h('div', { class: 'topic-tools' });
  const extraBox = h('div', { class: 'stack', style: 'gap:10px' });
  const stepperEl = h('div', { class: 'stepper' });
  const topicHint = h('div', { class: 'hint-line' }, icon('info'), v.ex.hint);
  const topicCard = h('section', { class: 'card topic-card' },
    h('div', { class: 'topic-label' }, v.exId === 'coach' ? `${v.ex.topic_label} · уровень ${v.session ? v.session.level : state.coach_level} из 5` : v.ex.topic_label),
    topicTextEl, topicTools,
    topicHint,
    stepperEl, extraBox);

  function renderTopic() {
    topicTextEl.replaceChildren();
    topicTools.replaceChildren();
    const locked = !!v.session || !!v.groupId;
    if (isFree) {
      if (locked) topicTextEl.textContent = v.topic || 'Свободная речь';
      else {
        const inp = h('input', { class: 'topic-edit', type: 'text', placeholder: 'О чём речь — необязательно', value: v.topic, maxlength: 300 });
        inp.addEventListener('input', () => { v.topic = inp.value; });
        topicTextEl.append(inp);
      }
      return;
    }
    if (v.editing && !locked) {
      const inp = h('input', { class: 'topic-edit', type: 'text', value: v.topic, maxlength: 300, 'aria-label': 'Своя тема' });
      const save = () => { const val = inp.value.trim(); if (val) v.topic = val; v.editing = false; renderTopic(); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { v.editing = false; renderTopic(); } });
      topicTextEl.append(inp);
      topicTools.append(h('button', { class: 'btn small', type: 'button', onclick: save }, 'Готово'));
      setTimeout(() => inp.focus(), 0);
      return;
    }
    topicTextEl.textContent = v.topic;
    if (v.groupId) topicTools.append(h('span', { class: 'small soft' }, 'Общая тема группы. В зачёт идёт одно выполнение задания за день.'));
    if (!locked) {
      topicTools.append(
        h('button', { class: 'btn quiet small', type: 'button', onclick: () => { v.topic = pickTopic(v.exId, v.topic); renderTopic(); } }, icon('shuffle'), v.exId === 'coach' ? 'Другой вопрос' : 'Другая тема'),
        h('button', { class: 'btn quiet small', type: 'button', onclick: () => { v.editing = true; renderTopic(); } }, icon('edit'), 'Своя'));
    }
    topicTools.append(h('button', { class: 'btn quiet small', type: 'button', onclick: () => speak(v.topic) || toast('В системе нет русского голоса для чтения вслух') }, icon('speaker'), 'Прочитать вслух'));
  }

  function renderStepper() {
    stepperEl.replaceChildren();
    const p = plan();
    if (p.length < 2) return;
    const nxt = nextIndex();
    p.forEach((st, i) => {
      const t = takeAt(i);
      let cls = 'st';
      if (t && t.status === 'error') cls += ' err';
      else if (t && t.status !== 'missing') cls += ' done';
      if (i === nxt && !allUploaded()) cls += ' current';
      if (v.stage === 'rec' && i === v.recIndex) cls = 'st current';
      stepperEl.append(h('span', { class: cls }, `${i + 1}. ${st.label}`));
    });
  }

  function renderExtras() {
    extraBox.replaceChildren();
    if (v.exId === 'sprint') {
      const t0 = takeAt(0);
      if (t0 && t0.status === 'done') {
        const ws = sprintWords(t0);
        const story = plan()[1] && plan()[1].mode === 'story';
        extraBox.append(h('div', { class: 'small soft' }, ws.length
          ? (story ? `Ваши ассоциации (${ws.length}). Соедините их в одну связную историю. Можно говорить несколькими предложениями и менять формы слов:` : `Ваши слова из первой фазы (${ws.length}). Во второй — по предложению с каждым:`)
          : 'В первой фазе слов не распознано.'),
          h('div', { class: 'word-chips' }, ws.map((w) => h('span', { class: 'chip' }, w))));
      } else if (t0 && t0.status === 'processing') {
        extraBox.append(h('div', { class: 'small muted pulse' }, 'Распознаю слова из первой фазы…'));
      }
    }
    if (isFree && !v.session) {
      const file = h('input', { type: 'file', accept: 'audio/*,video/*,.oga,.ogg,.opus,.m4a', hidden: true });
      const zone = h('div', { class: 'dropzone', role: 'button', tabindex: 0 }, icon('upload'), ' Или загрузите готовую запись — диктофон, голосовое из мессенджера, видео');
      zone.addEventListener('click', () => file.click());
      zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); });
      file.addEventListener('change', () => { if (file.files[0]) uploadFile(file.files[0]); });
      extraBox.append(zone, file);
    }
  }

  /* ---- сцена записи ---- */
  const R = 106, C = 2 * Math.PI * R;
  const ringFill = s('circle', { class: 'ring-fill', cx: 118, cy: 118, r: R, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C });
  const ring = s('svg', { class: 'ring', viewBox: '0 0 236 236', 'aria-hidden': 'true' },
    s('circle', { class: 'ring-track', cx: 118, cy: 118, r: R, fill: 'none', 'stroke-width': 9 }), ringFill);
  const center = h('div', { class: 'ring-center' });
  const stageTitle = h('div', { class: 'stage-title' });
  const stageSub = h('div', { class: 'stage-sub' });
  const stageActions = h('div', { class: 'stage-actions' });
  const canvas = h('canvas', { class: 'level', 'aria-hidden': 'true', style: 'color:var(--ink-3)' });
  const stage = h('section', { class: 'card stage', 'aria-live': 'polite' },
    h('div', { class: 'ring-wrap' }, ring, center), stageTitle, stageSub, canvas, stageActions);
  const recordingDetails = h('details', { class: 'recording-details', open: true },
    h('summary', null, 'Запись упражнения'), stage);
  const workspace = h('div', { class: 'workspace' }, topicCard, recordingDetails);
  const meter = levelMeter(canvas);
  const setRing = (p) => ringFill.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0, Math.min(1, p)))));

  function currentLimit() {
    const p = plan()[v.recIndex];
    return p ? p.limit : null;
  }

  function renderStage() {
    syncReviewLayout();
    stage.dataset.mode = v.stage;
    stage.classList.remove('ending');
    center.replaceChildren();
    stageActions.replaceChildren();
    stageTitle.textContent = '';
    stageSub.textContent = '';
    canvas.hidden = !['rec', 'prep', 'asking'].includes(v.stage);
    const p = plan();
    const idx = nextIndex();
    const label = idx != null && p[idx] ? (p.length > 1 ? `Попытка ${idx + 1} из ${p.length} · ${p[idx].label}` : p[idx].label) : '';

    if (v.stage === 'prep') {
      center.append(h('div', null, h('div', { class: 'big-count' }, String(v.prepShown || '')), h('div', { class: 'stage-sub' }, 'готовьтесь')));
      stageTitle.textContent = label;
      stageActions.append(h('button', { class: 'btn ghost small', type: 'button', onclick: cancelPrep }, 'Отмена'));
      return;
    }
    if (v.stage === 'asking') {
      setRing(0);
      center.append(h('div', { class: 'pulse' }, icon('speaker', 'big-ico')));
      stageTitle.textContent = 'Тренер задаёт вопрос…';
      stageSub.append('Запись начнётся сразу после вопроса. ', h('span', { class: 'kbd' }, 'Пробел'), ' — начать сейчас');
      return;
    }
    if (v.stage === 'rec') {
      const lim = currentLimit();
      v.timeEl = h('div', { class: 'big-time' }, lim ? String(lim) : '0:00');
      const stopBtn = h('button', { class: 'rec-btn stop', type: 'button', 'aria-label': 'Остановить запись', onclick: finishTake }, h('span', { class: 'sq' }));
      center.append(stopBtn);
      stageTitle.append(v.timeEl);
      stageSub.textContent = lim ? 'секунд осталось · пробел — закончить раньше' : 'идёт запись · пробел — закончить';
      return;
    }
    if (v.pendingTake) {
      const pending = v.pendingTake;
      setRing(0);
      center.append(pending.sending ? h('div', { class: 'spinner' }) : icon('upload', 'big-ico'));
      stageTitle.textContent = pending.sending ? 'Отправляю запись…' : 'Запись ждёт отправки';
      stageSub.textContent = pending.sending ? 'Сохраняю эту попытку. Повторно записывать её не нужно.' : (pending.error || 'Подтверждение ещё не получено. Можно повторить отправку этой записи.');
      stageActions.append(
        h('button', { class: 'btn', type: 'button', disabled: pending.sending, onclick: retryPendingTake }, pending.sending ? 'Отправляю…' : 'Повторить отправку'),
        h('a', { class: 'btn ghost', href: pending.downloadUrl, download: 'речь-' + (pending.idx + 1) + (pending.blob.type.includes('mp4') ? '.m4a' : '.webm') }, 'Скачать запись'));
      return;
    }
    if (v.stage === 'upload') {
      setRing(0);
      center.append(h('div', { class: 'spinner' }));
      stageTitle.textContent = 'Отправляю запись…';
      return;
    }
    // idle / between / complete / error
    setRing(0);
    if (v.stage === 'error') {
      stageSub.append(h('span', { style: 'color:var(--bad-ink)' }, v.stageError));
    }
    if (isDemoSession(v.session)) {
      stageTitle.textContent = 'Демонстрационное выполнение';
      stageSub.textContent = 'Пример для проверки рейтинга. Аудиозаписей нет.';
      stageActions.append(h('a', { class: 'btn ghost small', href: freshHref() }, 'Выполнить упражнение самому'));
      return;
    }
    if (idx == null) {
      center.append(h('div', null, h('div', { style: 'font-size:44px;line-height:1' }, '✓')));
      stageTitle.textContent = p.length > 1 ? 'Все попытки записаны' : 'Запись готова';
      stageSub.textContent = v.session && v.session.analysis && v.session.analysis.status === 'done' ? 'Разбор ниже' : 'Тренер разбирает речь — это секунд двадцать';
      stageActions.append(h('a', { class: 'btn ghost small', href: freshHref() }, icon('shuffle'), isFree ? 'Новая запись' : 'Новая тема'));
      return;
    }
    const startLabel = v.stage === 'between' ? 'Дальше' : (isFree ? 'Запись' : 'Начать');
    const btn = h('button', { class: 'rec-btn', type: 'button', disabled: v.thoughtMicBusy, onclick: startTake }, icon('mic'), startLabel);
    center.append(btn);
    stageTitle.textContent = label || 'Запись';
    stageSub.append(h('span', { class: 'kbd' }, 'Пробел'), v.ex.prep ? ` — старт, ${v.ex.prep} с на подготовку` : ' — старт');
    if (v.stage === 'between' && v.session) {
      const prev = v.session.takes.filter((t) => t.status !== 'missing').length - 1;
      if (prev >= 0) stageActions.append(h('button', { class: 'btn ghost small', type: 'button', onclick: () => rerecord(prev) }, icon('redo'), 'Перезаписать прошлую'));
    }
    const doneCount = v.session ? v.session.takes.filter((t) => t.status === 'done').length : 0;
    if (v.session && !allUploaded() && doneCount > 0 && p.length > 1) {
      stageActions.append(h('button', { class: 'btn ghost small', type: 'button', onclick: analyzePartial }, 'Разобрать то, что есть'));
    }
  }

  const freshHref = () => `#/ex/${v.exId}${v.programDay ? '?program=1' : ''}${v.groupId ? '&group=' + encodeURIComponent(v.groupId) : ''}`;

  async function ensureSession() {
    if (v.session) return true;
    try {
      v.session = await api('/api/sessions', { method: 'POST', body: { exercise: v.exId, topic: v.topic, program_day: v.programDay, group_id: v.groupId } });
    } catch (e) {
      toast(e.message);
      return false;
    }
    history.replaceState(null, '', `#/s/${v.session.id}`);
    prefs.set('lastRoute', `#/s/${v.session.id}`);
    if (!isFree) rememberTopic(v.exId, v.topic);
    if (v.programDay && !app.state.program_start) {
      api('/api/state', { method: 'POST', body: { program_start: v.programDay } }).then((st) => { app.state = { ...app.state, ...st }; }).catch(() => {});
    }
    v.topic = v.session.topic;
    v.groupId = v.session.group_id || null;
    renderTopic();
    renderExtras();
    return true;
  }

  async function startTake() {
    if (isDemoSession(v.session)) return;
    if (v.pendingTake) { renderStage(); return; }
    if (busy() || v.destroyed) return;
    const idx = nextIndex();
    if (idx == null) return;
    try {
      await mic.open();
    } catch (e) {
      v.stage = 'error';
      v.stageError = e.message;
      renderStage();
      return;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (!(await ensureSession())) return;
    v.recIndex = idx;
    renderStepper();
    if (v.exId === 'coach' && prefs.get('readQuestion', true)) {
      v.stage = 'asking';
      renderStage();
      meter.start();
      const spoke = speak(v.topic, () => { if (v.stage === 'asking') beginRecording(); });
      if (!spoke) beginRecording();
      return;
    }
    const prep = v.ex.prep || 0;
    if (prep > 0) runPrep(prep);
    else beginRecording();
  }

  function runPrep(sec) {
    v.stage = 'prep';
    v.prepShown = sec;
    renderStage();
    meter.start();
    const t0 = performance.now();
    const step = (now) => {
      if (v.stage !== 'prep') return;
      const el = (now - t0) / 1000;
      setRing(el / sec);
      const n = Math.ceil(sec - el);
      if (n !== v.prepShown && n > 0) {
        v.prepShown = n;
        const big = center.querySelector('.big-count');
        if (big) big.textContent = String(n);
        sound.beep(520, 0.05, 0.07);
      }
      if (el >= sec) { beginRecording(); return; }
      v.raf = requestAnimationFrame(step);
    };
    sound.beep(520, 0.05, 0.07);
    v.raf = requestAnimationFrame(step);
  }

  function cancelPrep() {
    if (v.stage !== 'prep' && v.stage !== 'asking') return;
    cancelAnimationFrame(v.raf);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    meter.stop();
    v.forceIndex = null;  // отменили перезапись — возвращаемся к обычному порядку
    if (nextIndex() == null) v.stage = 'complete';
    else v.stage = v.session && v.session.takes.some((t) => t.status !== 'missing') ? 'between' : 'idle';
    renderStage();
    renderStepper();
  }

  async function beginRecording() {
    if (v.destroyed || !['prep', 'asking', 'idle', 'between', 'complete', 'error'].includes(v.stage)) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    cancelAnimationFrame(v.raf);
    v.stage = 'starting';
    await sound.beep(880, 0.14);
    await wait(130); // сигнал не должен попасть в запись
    if (v.destroyed) return;
    try {
      v.recordingContext = window.TrainerDrafts && TrainerDrafts.context();
      v.recordingStream = mic.stream;
      v.rec = new Recorder(mic.stream);
      v.rec.start();
    } catch (e) {
      v.stage = 'error';
      v.stageError = e.message;
      meter.stop();
      renderStage();
      return;
    }
    v.stage = 'rec';
    renderStage();
    renderStepper();
    meter.start();
    tick();
  }

  function tick() {
    if (v.stage !== 'rec' || !v.rec) return;
    const el = v.rec.elapsed;
    const lim = currentLimit();
    if (lim) {
      const left = Math.max(0, lim - el);
      setRing(left / lim);
      if (v.timeEl) v.timeEl.textContent = String(Math.ceil(left));
      stage.classList.toggle('ending', left <= 5);
      if (left <= 0) { finishTake(); return; }
    } else {
      setRing((el % 60) / 60);
      if (v.timeEl) v.timeEl.textContent = mmss(el);
      if (el >= 20 * 60) { finishTake(); return; }
    }
    v.raf = requestAnimationFrame(tick);
  }

  async function finishTake() {
    if (v.stage !== 'rec') return;
    v.stage = 'upload';
    cancelAnimationFrame(v.raf);
    meter.stop();
    renderStage();
    const blob = await v.rec.stop();
    v.rec = null;
    if (mic.stream === v.recordingStream) mic.close();
    const context = v.recordingContext;
    if (context && window.TrainerDrafts && (v.destroyed || context.profile !== TrainerDrafts.profile())) {
      await TrainerDrafts.audio(`/api/sessions/${v.session.id}/takes/${v.recIndex}`, blob, {}, undefined, context);
      return;
    }
    sound.beep(660, 0.09).then(() => sound.beep(495, 0.16));
    await sendTake(v.recIndex, blob, '');
  }

  async function sendTake(idx, blob, name) {
    if (v.pendingTake && (v.pendingTake.sending || v.pendingTake.blob !== blob || v.pendingTake.idx !== idx)) return;
    let pending = v.pendingTake;
    let failed = false;
    try {
      if (blob.size < 1200) throw new Error('Запись получилась пустой — проверьте микрофон в настройках.');
      if (!pending) {
        pending = v.pendingTake = { idx, blob, name, requestId: null, sending: false, error: '',
          profile: window.TrainerDrafts && TrainerDrafts.profile(), downloadUrl: URL.createObjectURL(blob), lastReconcile: 0 };
      }
      if (window.TrainerDrafts && pending.profile !== TrainerDrafts.profile()) throw new Error('Профиль изменился. Откройте нужное занятие заново.');
      pending.sending = true;
      v.stage = 'upload';
      renderStage();
      const q = name ? `?name=${encodeURIComponent(name)}` : '';
      const fresh = await api(`/api/sessions/${v.session.id}/takes/${idx}${q}`, { method: 'PUT', blob,
        requestId: pending.requestId || undefined, onRequestId: (id) => { pending.requestId = id; } });
      v.session = fresh;
      if (v.pendingTake === pending) { URL.revokeObjectURL(pending.downloadUrl); v.pendingTake = null; }
      v.forceIndex = null;
      v.waitPolls = 0;
      v.stage = nextIndex() == null ? 'complete' : 'between';
      v.stageError = '';
    } catch (e) {
      failed = e.name !== 'AbortError';
      if (pending) {
        if (e.requestId) pending.requestId = e.requestId;
        pending.error = e.name === 'AbortError' ? 'Отправка отменена. Запись сохранена; её можно отправить снова.' : e.message;
      }
      v.stage = 'error';
      v.stageError = e.message;
      mic.close();
    } finally {
      if (pending) pending.sending = false;
    }
    renderStage();
    renderDynamic();
    schedulePoll();
    if (failed && pending && !v.destroyed) reconcilePendingTake(pending);
    if (v.stage === 'complete') {
      mic.close();
      const card = v.cards.get(idx);
      if (card) card.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function restorePendingTake() {
    if (!v.session || !window.TrainerDrafts || v.pendingTake) return;
    const prefix = `/api/sessions/${v.session.id}/takes/`;
    const records = await TrainerDrafts.list();
    if (v.destroyed || v.pendingTake) return;
    for (const record of records) {
      if (record.kind !== 'audio' || !record.path.startsWith(prefix) || !record.blob || record.blob.size < 1200) continue;
      const match = /^(\d{1,2})(?:\?(.*))?$/.exec(record.path.slice(prefix.length));
      if (!match || !v.session.plan[Number(match[1])]) continue;
      v.pendingTake = { idx: Number(match[1]), blob: record.blob, name: new URLSearchParams(match[2] || '').get('name') || '',
        requestId: record.requestId, profile: record.profile || TrainerDrafts.profile(), sending: false, lastReconcile: 0,
        error: 'На этом устройстве осталась запись без подтверждения. Можно повторить её отправку.', downloadUrl: URL.createObjectURL(record.blob) };
      break;
    }
  }

  function retryPendingTake() {
    const pending = v.pendingTake;
    if (!pending || pending.sending || v.destroyed) return;
    return sendTake(pending.idx, pending.blob, pending.name);
  }

  async function reconcilePendingTake(pending = v.pendingTake) {
    if (!pending || v.destroyed || pending.sending || pending.reconciling || Date.now() - pending.lastReconcile < 3000) return;
    if (window.TrainerDrafts && pending.profile !== TrainerDrafts.profile()) return;
    pending.lastReconcile = Date.now();
    pending.reconciling = true;
    try {
      const fresh = await api(`/api/sessions/${v.session.id}`);
      if (v.destroyed || v.pendingTake !== pending || pending.sending) return;
      v.session = fresh;
      // Чужая вкладка или старая попытка могла заполнить тот же индекс.
      // Копию удаляет только подтверждённый PUT с нашим X-Request-ID.
      renderDynamic();
      renderStage();
      schedulePoll();
    } catch (e) { /* одна сверка; следующий шанс — восстановление связи или ручной повтор */ }
    finally { pending.reconciling = false; }
  }

  async function uploadFile(file) {
    if (busy()) return;
    if (!(await ensureSession())) return;
    v.stage = 'upload';
    renderStage();
    await sendTake(0, file, file.name || 'запись');
  }

  function rerecord(i) {
    if (isDemoSession(v.session)) return;
    if (busy() || v.pendingTake) return;
    v.forceIndex = i;
    v.stage = 'between';
    renderStage();
    renderStepper();
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startTake();
  }

  async function analyzePartial() {
    if (isDemoSession(v.session)) return;
    try {
      v.session = await api(`/api/sessions/${v.session.id}/analyze`, { method: 'POST', body: { partial: true } });
      v.anKey = '';
      renderDynamic();
      schedulePoll();
    } catch (e) { toast(e.message); }
  }

  async function reanalyze() {
    if (isDemoSession(v.session)) return;
    try {
      v.session = await api(`/api/sessions/${v.session.id}/analyze`, { method: 'POST', body: { partial: !allUploaded() } });
      v.anKey = '';
      v.scrolledToResult = false;
      renderDynamic();
      schedulePoll();
    } catch (e) { toast(e.message); }
  }

  /* ---- опрос сервера ---- */
  function needsPoll() {
    const sess = v.session;
    if (!sess) return false;
    if (sess.takes.some((t) => t.status === 'processing')) return true;
    if ((sess.thoughts || []).some((p) => (p.attempts || []).some((a) => ['processing', 'reviewing'].includes(a.status)))) return true;
    const st = sess.analysis && sess.analysis.status;
    if (st === 'running') return true;
    if (st === 'waiting' && allUploaded() && v.waitPolls < 12) { v.waitPolls++; return true; }
    return false;
  }
  function schedulePoll() {
    clearTimeout(v.pollT);
    if (!v.destroyed && needsPoll()) v.pollT = setTimeout(poll, 1000);
  }
  async function poll() {
    if (v.destroyed || !v.session) return;
    try {
      const fresh = await api(`/api/sessions/${v.session.id}`);
      if (v.destroyed) return;
      v.session = fresh;
      renderDynamic();
    } catch (e) { /* сервер мог перезапускаться — попробуем ещё */ }
    schedulePoll();
  }

  /* ---- разбор ---- */
  const analysisBox = h('section', { class: 'analysis', id: 'analysis' });
  const takesBox = h('section', { class: 'takes' });
  const afterBox = h('div', { class: 'after-actions' });
  const nextLink = h('a', { class: 'btn exercise-next-link' });
  const nextDock = h('nav', { class: 'exercise-next-dock', 'aria-label': 'Продолжить тренировку', hidden: true }, nextLink);
  const nextResize = window.ResizeObserver ? new ResizeObserver((entries) => {
    const height = entries[0].contentRect.height;
    if (height > 0) document.body.style.setProperty('--exercise-next-height', Math.ceil(height) + 'px');
  }) : null;
  if (nextResize) nextResize.observe(nextDock);
  function setNextAction(href, label) {
    nextLink.href = href;
    nextLink.replaceChildren(h('span', null, label), icon('arrow'));
  }
  function syncReviewLayout() {
    const analysis = v.session && v.session.analysis;
    const reviewing = !!(analysis && analysis.status === 'done' && analysis.result && allUploaded()
      && !v.pendingTake && !busy() && v.forceIndex == null);
    if (reviewing !== v.reviewing) {
      v.reviewing = reviewing;
      recordingDetails.open = !reviewing;
      if (reviewing) howto.open = false;
      howto.hidden = reviewing;
      workspace.classList.toggle('is-reviewed', reviewing);
      recordingDetails.classList.toggle('is-reviewed', reviewing);
      topicHint.hidden = topicTools.hidden = stepperEl.hidden = extraBox.hidden = reviewing;
    }
    nextDock.hidden = !reviewing;
    document.body.classList.toggle('has-exercise-next', reviewing);
  }
  const thoughts = thoughtWorkshop({
    session: () => v.session,
    alive: () => !v.destroyed,
    canRecord: () => !busy() && !v.pendingTake,
    recordingChanged: (recording) => { v.thoughtMicBusy = recording; renderStage(); },
    // Ответ без номера сессии — не сессия: не даём ему затереть открытую.
    changed: (session) => { if (!v.destroyed && session && session.id) { v.session = session; renderDynamic(); schedulePoll(); } },
  });

  function renderAnalysis() {
    const sess = v.session;
    const an = sess && sess.analysis;
    const st = an ? an.status : 'none';
    const someProcessing = sess && sess.takes.some((t) => t.status === 'processing');
    const stillWaiting = st === 'waiting' && allUploaded() && (someProcessing || v.waitPolls < 12);
    const key = [st, an && an.gen, an && !!an.result, allUploaded(), someProcessing, an && an.error, an && an.refresh_error, stillWaiting].join('|');
    if (key === v.anKey) return;
    v.anKey = key;
    analysisBox.replaceChildren();
    if (!sess) return;
    if (st === 'running' || stillWaiting) {
      const started = an.started ? new Date(an.started) : new Date();
      const timer = h('span', { class: 'num' });
      const upd = () => { timer.textContent = st === 'running' ? ` · ${Math.max(0, Math.round((Date.now() - started) / 1000))} с` : ''; };
      upd();
      const iv = setInterval(() => { if (!timer.isConnected) clearInterval(iv); else upd(); }, 1000);
      analysisBox.append(h('div', { class: 'card analysis-loading' },
        h('div', { class: 'dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
        h('div', null,
          h('div', { style: 'font-weight:600' }, someProcessing ? 'Расшифровываю запись' : 'Тренер разбирает речь', timer),
          h('div', { class: 'small muted' }, someProcessing
            ? 'Распознаю слова и меряю паузы по звуку.'
            : 'Проверяет каждого паразита в контексте, ищет недочёты и пишет сильную версию. Обычно 15–40 секунд.'))));
      return;
    }
    if (st === 'error') {
      analysisBox.append(h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', null, 'Разбор не получился')),
        h('p', { class: 'soft' }, an.error || 'Неизвестная ошибка.'),
        h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', onclick: reanalyze }, icon('redo'), 'Разобрать заново'))));
      return;
    }
    if (st === 'waiting' && sess.takes.length && !allUploaded()) return;
    if (st === 'waiting' && allUploaded() && !someProcessing) {
      analysisBox.append(h('div', { class: 'card row' }, h('span', { class: 'soft' }, 'Записи готовы, разбор ещё не запускался.'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onclick: reanalyze }, 'Разобрать')));
      return;
    }
    if (st !== 'done' || !an.result) return;
    analysisBox.append(resultCard(an));
    if (!v.scrolledToResult && v.justFinished) {
      v.scrolledToResult = true;
      setTimeout(() => analysisBox.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  }

  function resultCard(an) {
    const r = an.result;
    const meta = an.meta || {};
    const demo = isDemoSession(v.session);
    const coachLabel = demo ? 'Демонстрация' : (meta.provider === 'codex' ? 'Codex · резерв' : (meta.model === 'opus' ? 'Opus' : 'Sonnet'));
    const crit = [['logic', 'Логика'], ['vocabulary', 'Словарный запас'], ['thinking_speed', 'Скорость мышления'], ['persuasiveness', 'Убедительность'], ['structure', 'Структура речи']];
    const deltas = h('div', { class: 'deltas' });
    const card = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, demo ? 'Пример результата' : 'Разбор тренера'),
        h('span', { class: 'chip' }, coachLabel + (meta.seconds ? ` · ${f1(meta.seconds)} с` : '')),
        h('span', { class: 'spacer' }),
        demo ? null : h('button', { class: 'btn ghost small', type: 'button', onclick: reanalyze, title: 'Попросить тренера разобрать ещё раз' }, icon('redo'), 'Разобрать заново')),
      an.refresh_error ? h('div', { class: 'warn-line' },
        h('p', { role: 'status' }, 'Обновить разбор не удалось. Показываем предыдущий сохранённый разбор.'),
        h('details', { class: 'howto' }, h('summary', null, 'Подробности'), h('p', { class: 'small soft' }, an.refresh_error))) : null,
      h('div', { class: 'verdict-grid' },
        h('div', { class: 'hero-score' }, h('div', { class: 'val' }, f1(r.overall), h('small', null, ' / 10')), h('div', { class: 'small muted' }, 'средняя по пяти критериям')),
        h('div', null, h('p', { class: 'verdict' }, r.verdict), deltas)),
      h('div', { class: 'meters' }, crit.map(([k, name]) => meterRow(name, r.scores[k], r.score_notes[k]))),
      h('div', { class: 'cols' },
        r.strengths.length ? h('div', null, h('h3', null, 'Сильные стороны'), h('ul', { class: 'list good' }, r.strengths.map((x) => h('li', null, x)))) : null,
        r.growth.length ? h('div', null, h('h3', null, 'Точки роста'), h('ul', { class: 'list grow' }, r.growth.map((x) => h('li', null, x)))) : null),
      r.exercise_feedback ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Разбор упражнения'), h('p', null, r.exercise_feedback)) : null,
      r.sprint_words && r.sprint_words.length ? h('div', { class: 'callout' },
        h('div', { class: 'label' }, `Названо понятий: ${r.sprint_words.length}`),
        h('div', { class: 'word-chips' }, r.sprint_words.map((w) => h('span', { class: 'chip' }, w)))) : null,
      r.tip ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Совет на следующую попытку'), h('p', null, r.tip)) : null,
      v.exId === 'coach' && r.next_question ? h('div', { class: 'callout next' },
        h('div', { class: 'label' }, 'Следующий вопрос тренера'), h('div', { class: 'q' }, r.next_question),
        h('div', { class: 'row', style: 'margin-top:6px' }, h('a', { class: 'btn', href: '#/ex/coach' }, icon('mic'), 'Ответить'))) : null);
    fillDeltas(deltas);
    return card;
  }

  async function fillDeltas(box) {
    if (isDemoSession(v.session)) return;
    try {
      if (!v.sessionsCache) v.sessionsCache = await api('/api/sessions');
    } catch (e) { return; }
    const mine = v.session;
    const prev = doneSessions(v.sessionsCache).find((x) => !isDemoSession(x) && x.exercise === mine.exercise && x.id < mine.id);
    const now = mine.summary;
    if (!prev || !now) return;
    const p = prev.summary;
    const items = [
      ['Оценка', now.overall, p.overall, 'up'],
      ['Паразитов в минуту', now.fillers_per_min, p.fillers_per_min, 'down'],
      ['Заминок в минуту', now.pauses_hes_per_min, p.pauses_hes_per_min, 'down'],
      ['Темп', now.wpm, p.wpm, null],
    ];
    box.append(h('span', { class: 'small muted', style: 'align-self:center' }, 'С прошлого раза:'));
    for (const [label, a, b, better] of items) {
      if (a == null || b == null) continue;
      const diff = a - b;
      let cls = 'delta', word = '';
      if (better && Math.abs(diff) >= 0.05) {
        const good = better === 'up' ? diff > 0 : diff < 0;
        cls += good ? ' up' : ' down';
        word = good ? ' — лучше' : ' — хуже';
      }
      box.append(h('span', { class: cls }, `${label}: `, h('b', null, f1(a)), ` (было ${f1(b)})${word}`));
    }
  }

  /* ---- карточки попыток ---- */
  function renderTakes() {
    const sess = v.session;
    if (!sess) return;
    const an = sess.analysis || {};
    const res = an.status === 'done' ? an.result : null;
    sess.takes.forEach((t, i) => {
      if (t.status === 'missing') return;
      const pos = res ? (an.takes || []).indexOf(i) : -1;
      const rt = pos >= 0 ? res.takes[pos] : null;
      const key = [t.status, t.upload_id, t.error, rt ? an.gen : 0, (t.fillers_final || []).length].join('|');
      const old = v.cards.get(i);
      if (old && old.key === key) return;
      const card = buildTakeCard(t, i, rt);
      card.key = key;
      if (old) { old.destroy(); old.el.replaceWith(card.el); } else {
        const after = [...v.cards.entries()].filter(([k]) => k > i).sort((a, b) => a[0] - b[0])[0];
        if (after) takesBox.insertBefore(card.el, after[1].el); else takesBox.append(card.el);
      }
      v.cards.set(i, card);
    });
  }

  function buildTakeCard(t, i, rt) {
    const p = plan();
    const demo = isDemoSession(v.session);
    const cleanup = [];
    const el = h('article', { class: 'card', id: `take-${i}` });
    const head = h('div', { class: 'take-head' },
      h('h3', null, demo ? `Пример ответа${p.length > 1 ? ` ${i + 1} · ${t.label}` : ''}` : (p.length > 1 ? `Попытка ${i + 1} · ${t.label}` : (isFree && t.source && t.source !== 'микрофон' ? `Запись · ${t.source}` : 'Ваша речь'))));
    if (!demo && t.status === 'done' && t.metrics) head.append(h('span', { class: 'chip num' }, `${f1(t.metrics.speech_time)} с речи`));
    if (t.status === 'processing') head.append(h('span', { class: 'chip pulse' }, 'расшифровываю…'));
    if (t.status === 'error') head.append(h('span', { class: 'chip bad' }, 'ошибка'));
    head.append(h('span', { class: 'spacer' }));
    if (!demo && t.status !== 'processing' && !(isFree && t.source && t.source !== 'микрофон')) {
      head.append(h('button', { class: 'btn ghost small', type: 'button', onclick: () => rerecord(i) }, icon('redo'), 'Перезаписать'));
    }
    el.append(head);

    if (t.status === 'processing') {
      el.append(h('p', { class: 'muted' }, 'Распознаю речь дословно и меряю паузы по звуку. Несколько секунд.'));
      return { el, destroy() {} };
    }
    if (t.status === 'error') {
      el.append(h('div', { class: 'take-error' }, t.error || 'Не получилось обработать запись.'));
      return { el, destroy() {} };
    }
    for (const w of t.warnings || []) el.append(h('div', { class: 'warn-line' }, w));
    if (!demo && t.metrics && t.metrics.cut_by_timer) el.append(h('div', { class: 'warn-line' }, 'У границы времени в записи слышна речь. По этому признаку нельзя определить, закончена ли мысль.'));

    const words = t.words || [];
    let player = null;
    const wordEls = [];
    if (t.audio) {
      player = makePlayer(url(`media/${v.session.id}/${t.audio}`), t.duration, (time) => highlight(time));
      cleanup.push(() => player.destroy());
      el.append(player.el);
    }
    let nowIdx = -1;
    function highlight(time) {
      if (!words.length) return;
      let lo = 0, hi = words.length - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (words[mid].s <= time + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      if (ans !== -1 && time > words[ans].e + 0.6) ans = -1;
      if (ans === nowIdx) return;
      if (nowIdx >= 0 && wordEls[nowIdx]) wordEls[nowIdx].classList.remove('now');
      nowIdx = ans;
      if (nowIdx >= 0 && wordEls[nowIdx]) wordEls[nowIdx].classList.add('now');
    }
    const tr = demo ? { el: h('p', { class: 'transcript' }, t.text || words.map((word) => word.t).join(' ')) }
      : renderTranscript(t, rt, wordEls, (idx) => { if (player) player.seek(Math.max(0, words[idx].s - 0.2)); });
    el.append(tr.el);
    if (tr.legend) el.append(tr.legend);
    if (demo) el.append(h('p', { class: 'small soft' }, 'Текст для примера. Аудиозаписи нет; замеры речи не проводились.'));
    else el.append(tilesFor(t, rt));
    if (rt) el.append(takeAnalysis(rt, t, wordEls, player, demo ? null : (issueIndex) => thoughts.start(i, issueIndex)));
    return { el, destroy() { cleanup.forEach((f) => f()); } };
  }

  /* ---- после разбора ---- */
  async function renderAfter() {
    const sess = v.session;
    const done = sess && sess.analysis && sess.analysis.status === 'done';
    const key = [done, sess && sess.id].join('|');
    if (key === v.afterKey) return;
    v.afterKey = key;
    const tok = (v.afterTok = (v.afterTok || 0) + 1);
    if (!sess) { afterBox.replaceChildren(); return; }
    const btns = [];
    if (isDemoSession(sess)) {
      setNextAction(v.groupId ? `#/groups/${v.groupId}` : '#/history', v.groupId ? 'К рейтингу группы' : 'К истории');
      afterBox.replaceChildren(h('a', { class: 'btn ghost', href: freshHref() }, 'Выполнить упражнение самому'));
      return;
    }
    if (done) {
      setNextAction(v.programDay ? (v.groupId ? `#/groups/${v.groupId}` : '#/program') : freshHref(), v.programDay ? 'К программе дня' : (v.exId === 'coach' ? 'Следующий вопрос' : isFree ? 'Новая запись' : 'Ещё раз с новой темой'));
      if (v.exId === 'coach' && !v.programDay) setNextAction('#/ex/coach', 'Следующий вопрос');
      if (v.programDay) {
        btns.push(h('a', { class: 'btn ghost', href: freshHref() }, icon('shuffle'), v.groupId ? 'Повторить задание' : 'Ещё раз с новой темой'));
        try {
          v.sessionsCache = await api('/api/sessions');
          const latestState = v.groupId ? await api('/api/state') : app.state;
          const competition = v.groupId ? await programForGroup(latestState, v.groupId) : null;
          const ps = programStatus(v.sessionsCache, { ...latestState, competition });
          if (tok !== v.afterTok || v.destroyed) return;
          if (ps.next) {
            const href = `#/ex/${ps.next.exercise}?program=1${v.groupId ? '&group=' + encodeURIComponent(v.groupId) : ''}`, label = `Дальше: ${catalog().exercises[ps.next.exercise].title}`;
            setNextAction(href, label);
          } else {
            setNextAction(v.groupId ? `#/groups/${v.groupId}` : '#/program', 'Программа дня выполнена');
          }
        } catch (e) { /* без кнопки программы */ }
      }
    }
    if (tok !== v.afterTok || v.destroyed) return;  // пока ждали, пришло новое состояние
    btns.push(h('span', { class: 'spacer' }));
    btns.push(confirmButton('Удалить запись', 'Точно удалить?', async () => {
      try {
        await api(`/api/sessions/${sess.id}`, { method: 'DELETE' });
        toast('Удалено');
        location.hash = v.programDay ? '#/program' : '#/history';
      } catch (e) { toast(e.message); }
    }));
    afterBox.replaceChildren();
    add(afterBox, btns);
  }

  function renderDynamic() {
    if (v.destroyed) return;
    const wasDone = v.lastAnStatus === 'done';
    const st = v.session && v.session.analysis ? v.session.analysis.status : null;
    if (st === 'done' && !wasDone && v.lastAnStatus) v.justFinished = true;
    v.lastAnStatus = st;
    if (v.session && !busy()) {
      const nxt = nextIndex();
      if (nxt == null) v.stage = 'complete';
      else if (v.stage === 'complete') v.stage = 'between';
    }
    renderStepper();
    renderExtras();
    renderAnalysis();
    thoughts.update();
    renderTakes();
    renderAfter();
    if (!busy()) renderStage();
  }

  /* ---- клавиатура ---- */
  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'SUMMARY', 'A'].includes(tag) || (e.target && e.target.isContentEditable)) return;
    if ($('#settings').open) return;
    if (v.thoughtMicBusy) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (v.stage === 'rec') finishTake();
      else if (v.stage === 'asking') beginRecording();
      else if (v.stage === 'prep') return;
      else startTake();
    } else if (e.key === 'Escape') {
      cancelPrep();
    }
  }
  document.addEventListener('keydown', onKey);
  function onAudioSent(event) {
    const pending = v.pendingTake, sent = event.detail || {};
    if (!pending || pending.sending || v.destroyed || sent.requestId !== pending.requestId || sent.profile !== pending.profile) return;
    if (typeof sent.path !== 'string' || sent.path.split('?')[0] !== `/api/sessions/${v.session.id}/takes/${pending.idx}`) return;
    URL.revokeObjectURL(pending.downloadUrl);
    v.pendingTake = null;
    if (sent.session && sent.session.id === v.session.id) v.session = sent.session;
    v.forceIndex = null;
    v.stage = nextIndex() == null ? 'complete' : 'between';
    v.stageError = '';
    renderDynamic();
    renderStage();
    schedulePoll();
  }
  const onConnectionRestored = () => { if (v.pendingTake) reconcilePendingTake(); };
  window.addEventListener('trainer:audiosent', onAudioSent);
  window.addEventListener('trainer:backendchange', onConnectionRestored);
  window.addEventListener('trainer:connectionrestored', onConnectionRestored);
  const onUnload = (e) => { if (v.stage === 'rec' || v.thoughtMicBusy) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onUnload);

  /* ---- сборка страницы ---- */
  const howto = h('details', { class: 'howto', open: firstVisit || null }, h('summary', null, 'Как выполнять'),
    h('ol', null, v.ex.howto.map((x) => h('li', null, x))));
  const head = h('div', null,
    h('a', { class: 'back', href: backHref }, icon('back'), backText),
    h('div', { class: 'ex-head' }, h('h1', null, isDemoSession(v.session) ? `Демо · ${v.ex.title}` : v.ex.title), h('span', { class: 'chip' }, v.ex.develops),
      v.programDay ? h('span', { class: 'chip dark' }, 'Программа дня') : null),
    demoResultNotice(v.session),
    howto);

  if (!render(ctx, head, workspace, analysisBox, thoughts.el, takesBox, afterBox, nextDock)) {
    if (nextResize) nextResize.disconnect();
    thoughts.destroy();
    if (v.pendingTake) URL.revokeObjectURL(v.pendingTake.downloadUrl);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('trainer:audiosent', onAudioSent);
    window.removeEventListener('trainer:backendchange', onConnectionRestored);
    window.removeEventListener('trainer:connectionrestored', onConnectionRestored);
    window.removeEventListener('beforeunload', onUnload);
    return null;
  }
  v.lastAnStatus = v.session && v.session.analysis ? v.session.analysis.status : null;
  renderTopic();
  if (v.session) {
    v.stage = nextIndex() == null ? 'complete' : (v.session.takes.some((t) => t.status !== 'missing') ? 'between' : 'idle');
  }
  renderDynamic();
  renderStage();
  schedulePoll();
  if (params.get('thought')) setTimeout(() => { if (!v.destroyed) thoughts.focus(); }, 150);

  return {
    destroy() {
      v.destroyed = true;
      document.body.classList.remove('has-exercise-next');
      document.body.style.removeProperty('--exercise-next-height');
      if (nextResize) nextResize.disconnect();
      clearTimeout(v.pollT);
      cancelAnimationFrame(v.raf);
      if (v.rec) v.rec.cancel();
      thoughts.destroy();
      meter.stop();
      mic.close();
      if (v.pendingTake) URL.revokeObjectURL(v.pendingTake.downloadUrl);
      v.cards.forEach((c) => c.destroy());
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('trainer:audiosent', onAudioSent);
      window.removeEventListener('trainer:backendchange', onConnectionRestored);
      window.removeEventListener('trainer:connectionrestored', onConnectionRestored);
      window.removeEventListener('beforeunload', onUnload);
    },
  };
}

/* ---- самостоятельная переделка фразы ---- */
function thoughtWorkshop({ session, alive, canRecord, recordingChanged, changed }) {
  const el = h('section', { class: 'thought-workshop', id: 'thought-practice', 'aria-label': 'Потренировать эту мысль', tabindex: -1 });
  const entry = h('div');
  const list = h('div', { class: 'thought-list' });
  const cards = new Map();
  let entryKey = '', creating = false, createError = '', active = null, destroyed = false;
  const live = () => !destroyed && alive();
  el.append(entry, list);

  function refreshControls() { cards.forEach((c) => c.controls()); }
  function renderEntry() {
    const sess = session();
    const ready = sess && (sess.takes || []).map((t, i) => ({ t, i })).filter(({ t }) => t.status === 'done' && (t.text || (t.words || []).length));
    const available = !!(ready && ready.length && sess.analysis && sess.analysis.status === 'done' && !isDemoSession(sess));
    const key = JSON.stringify([available, ready && ready.map(({ i, t }) => [i, t.label]), creating, createError]);
    if (key === entryKey) return;
    entryKey = key;
    entry.replaceChildren();
    if (!available) return;
    const pick = ready.length > 1 ? h('select', { 'aria-label': 'Из какой попытки выбрать мысль', disabled: creating }, ready.map(({ i, t }) => h('option', { value: i }, t.label || `Попытка ${i + 1}`))) : null;
    entry.append(h('div', { class: 'card thought-entry' },
      h('div', null, h('h2', null, 'Потренировать эту мысль'), h('p', { class: 'soft' }, 'Выберите одну мысль из своей записи и сформулируйте её яснее. Тренер даст подсказку и сравнит вашу новую версию с исходной.')),
      h('div', { class: 'thought-entry-actions' }, pick, h('button', { class: 'btn', type: 'button', disabled: creating, onclick: () => start(pick ? Number(pick.value) : ready[0].i) }, icon('edit'), creating ? 'Выбираю фрагмент…' : 'Выбрать мысль и потренироваться')),
      createError ? h('p', { class: 'thought-error', role: 'alert' }, createError, ' Попробуйте ещё раз.') : null));
  }

  async function start(takeIndex, issueIndex) {
    if (creating || !session() || !live()) return;
    creating = true;
    createError = '';
    renderEntry();
    const oldIds = new Set((session().thoughts || []).map((p) => p.id));
    try {
      const fresh = await api(`/api/sessions/${session().id}/thoughts`, { method: 'POST', body: { take_index: takeIndex, issue_index: issueIndex } });
      if (!live()) return;
      changed(fresh);
      const practice = (fresh.thoughts || []).find((p) => !oldIds.has(p.id)) || (fresh.thoughts || []).find((p) => p.take_index === takeIndex && (issueIndex == null || p.issue_index === issueIndex));
      const card = practice && cards.get(practice.id);
      if (card) { card.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); card.focus(); }
    } catch (e) {
      if (live()) { createError = e.message; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } finally {
      creating = false;
      if (live()) renderEntry();
    }
  }

  function makeCard(initial) {
    let p = initial, sending = false, mode = 'text', rec = null, recordTimer = 0, captureToken = 0, discardToken = 0, recordingContext = null, blob = null, previewUrl = '', contentKey = '';
    const card = h('article', { class: 'card thought-card', id: `thought-${p.id}` });
    const title = h('h3', { tabindex: -1 });
    const topicLabel = h('p', { class: 'learning-topic soft', hidden: true });
    const task = h('p', { class: 'thought-task' });
    const materials = h('div');
    const phase = h('span', { class: 'chip' });
    const comparisons = h('div', { class: 'thought-comparison' });
    const hints = h('div', { class: 'thought-hints', 'aria-live': 'polite' });
    const err = h('p', { class: 'thought-error', role: 'alert', hidden: true });
    const statusText = h('p', { role: 'status', 'aria-live': 'polite' });
    const viewResult = h('button', { class: 'btn ghost small', type: 'button', hidden: true, onclick: () => {
      const attempts = p.attempts || [];
      const latest = attempts[attempts.length - 1];
      const result = latest && card.querySelector(`#thought-attempt-${p.id}-${latest.id}`);
      if (result) { result.scrollIntoView({ behavior: 'smooth', block: 'center' }); result.focus({ preventScroll: true }); }
    } }, 'Посмотреть отзыв');
    const status = h('div', { class: 'thought-status', hidden: true }, statusText, viewResult);
    const hintButton = h('button', { class: 'btn ghost', type: 'button', onclick: () => mutate(`/thoughts/${p.id}/hint`, { method: 'POST', body: {} }) }, icon('bulb'), 'Дать подсказку');
    const textButton = h('button', { type: 'button', onclick: () => { mode = 'text'; controls(); } }, icon('edit'), 'Написать');
    const voiceButton = h('button', { type: 'button', onclick: () => { mode = 'voice'; controls(); } }, icon('mic'), 'Сказать голосом');
    const answerId = `thought-answer-${p.id}`, meaningId = `thought-meaning-${p.id}`;
    const answer = h('textarea', { id: answerId, class: 'thought-input', rows: 3, maxlength: 2000, placeholder: 'Скажите то же самое своими словами', required: true });
    const intent = h('textarea', { id: meaningId, class: 'thought-input', rows: 2, maxlength: 1000, placeholder: 'Если в исходной фразе это было неясно' });
    const draftId = `thought:${session().id}:${p.id}`;
    const savedText = window.TrainerDrafts && TrainerDrafts.getText(draftId);
    if (savedText) { answer.value = savedText.text || ''; intent.value = savedText.meaning || ''; }
    const saveText = () => { if (window.TrainerDrafts) TrainerDrafts.setText(draftId, { text: answer.value, meaning: intent.value }); };
    answer.addEventListener('input', saveText); intent.addEventListener('input', saveText);
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Проверить мою версию', icon('arrow'));
    const answerLabel = h('label', { for: answerId }, 'Ваша новая формулировка');
    const intentSummary = h('summary', null, 'Уточнить, что я хотел сказать');
    const intentLabel = h('label', { for: meaningId }, 'Какой смысл важно сохранить?');
    const answerFormat = h('div', { class: 'learning-answer-format', id: `thought-format-${p.id}`, hidden: true });
    const textBox = h('div', { class: 'field' }, answerLabel, answer, submit);
    const recordStatus = h('span', { class: 'num', role: 'status' });
    const recordButton = h('button', { class: 'btn ghost', type: 'button', onclick: beginVoice }, icon('mic'), 'Начать запись');
    const stopButton = h('button', { class: 'btn', type: 'button', hidden: true, onclick: finishVoice }, icon('pause'), 'Закончить запись');
    const cancelButton = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: cancelVoice }, 'Отменить запись');
    const sendAudio = h('button', { class: 'btn', type: 'button', hidden: true, onclick: submitVoice }, 'Отправить запись тренеру', icon('arrow'));
    const preview = h('div', { class: 'thought-preview' });
    const voiceInstruction = h('p', { class: 'small soft' }, 'Произнесите новую версию. До 90 секунд: закончите запись, когда выразили мысль.');
    const voiceBox = h('div', { class: 'thought-voice', hidden: true },
      voiceInstruction,
      h('div', { class: 'row' }, recordButton, stopButton, cancelButton, recordStatus), preview, sendAudio);
    const form = h('form', { class: 'thought-form', onsubmit: submitText },
      answerFormat,
      h('div', { class: 'seg thought-modes', role: 'group', 'aria-label': 'Как ответить' }, textButton, voiceButton),
      h('details', { class: 'thought-meaning' }, intentSummary, h('div', { class: 'field' }, intentLabel, intent)),
      textBox, voiceBox, err, status);
    const transferButton = h('button', { class: 'btn ghost', type: 'button', onclick: transfer }, 'Применить на другой теме', icon('arrow'));
    const transferMessage = h('p');
    const nextAction = h('a', { class: 'btn', href: '#/learn/synonyms', hidden: true }, 'Выбрать другое действие', icon('arrow'));
    const transferArea = h('div', { class: 'learning-transfer', hidden: true }, transferMessage, transferButton, nextAction);
    card.append(h('div', { class: 'card-head' }, title, h('span', { class: 'spacer' }), phase), topicLabel, materials, task, comparisons, hints, h('div', { class: 'row' }, hintButton), form, transferArea);
    const path = (suffix) => `/api/sessions/${session().id}${suffix}`;
    const pending = () => (p.attempts || []).some((a) => ['processing', 'reviewing'].includes(a.status));

    async function mutate(suffix, opts, saved) {
      if (sending || !live()) return;
      sending = true;
      err.hidden = true;
      controls();
      try {
        const fresh = await api(path(suffix), opts);
        if (!live()) return;
        if (saved) saved(fresh);
        changed(fresh);
      } catch (e) {
        if (live()) { err.textContent = e.message + ' Ваша версия осталась здесь. Попробуйте ещё раз.'; err.hidden = false; }
      } finally { sending = false; if (live()) controls(); }
    }

    function submitText(e) {
      e.preventDefault();
      if (sending || pending() || active) return;
      const text = answer.value.trim();
      if (!text) { answer.focus(); return; }
      mutate(`/thoughts/${p.id}/attempts`, { method: 'POST', body: { text, intended_meaning: intent.value.trim() } }, () => {
        answer.value = ''; if (window.TrainerDrafts) TrainerDrafts.removeText(draftId);
      });
    }

    function transfer() {
      const existing = (session().thoughts || []).find((item) => item.transfer_from === p.id);
      const show = (id) => { const next = cards.get(id); if (next) { next.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); next.focus(); } };
      if (existing) { show(existing.id); return; }
      mutate(`/thoughts/${p.id}/transfer`, { method: 'POST', body: {} }, (fresh) => {
        const next = (fresh.thoughts || []).find((item) => item.transfer_from === p.id);
        if (next) setTimeout(() => { if (live()) show(next.id); }, 0);
      });
    }

    async function beginVoice() {
      if (active || sending || pending()) return;
      if (!canRecord()) { err.textContent = 'Сначала закончите текущую запись упражнения.'; err.hidden = false; return; }
      const token = ++captureToken;
      active = controller;
      recordingChanged(true);
      recordStatus.textContent = 'Включаю микрофон…';
      refreshControls();
      try {
        await mic.open();
        if (!live() || token !== captureToken) { if (active === controller) releaseMic(); return; }
        clearPreview();
        if (window.TrainerDrafts) await TrainerDrafts.remove('audio:' + path(`/thoughts/${p.id}/audio`));
        if (!live() || token !== captureToken) { if (active === controller) releaseMic(); return; }
        discardToken++;
        recordingContext = window.TrainerDrafts ? { ...TrainerDrafts.context(), path: path(`/thoughts/${p.id}/audio`) } : null;
        rec = new Recorder(mic.stream);
        rec.start();
        recordStatus.textContent = 'Запись · 0:00';
        recordTimer = setInterval(() => {
          if (!rec) return;
          recordStatus.textContent = `Запись · ${mmss(rec.elapsed)}`;
          if (rec.elapsed >= 90) finishVoice();
        }, 250);
        err.hidden = true;
      } catch (e) {
        releaseMic();
        err.textContent = e.message;
        err.hidden = false;
      }
      if (live()) refreshControls();
    }

    function releaseMic() {
      clearInterval(recordTimer);
      if (active === controller) { active = null; mic.close(); recordingChanged(false); }
      recordStatus.textContent = '';
    }
    function clearPreview() {
      preview.querySelectorAll('audio').forEach((a) => a.pause());
      preview.replaceChildren();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      blob = null;
    }
    function cancelVoice(discard = true) {
      captureToken++;
      if (discard !== false) discardToken++;
      if (rec) rec.cancel();
      rec = null;
      releaseMic();
      clearPreview();
      if (discard !== false && window.TrainerDrafts) TrainerDrafts.remove('audio:' + path(`/thoughts/${p.id}/audio`));
      refreshControls();
    }
    async function finishVoice() {
      if (!rec) return;
      const token = captureToken;
      const expectedDiscard = discardToken, context = recordingContext;
      const headers = intent.value.trim() ? { 'X-Thought-Meaning': encodeURIComponent(intent.value.trim()) } : {};
      const recording = rec;
      rec = null;
      clearInterval(recordTimer);
      recordStatus.textContent = 'Сохраняю запись…';
      refreshControls();
      const recorded = await recording.stop();
      releaseMic();
      let saved;
      if (recorded.size >= 1200 && expectedDiscard === discardToken && context && window.TrainerDrafts) {
        saved = await TrainerDrafts.audio(context.path, recorded, headers, undefined, context);
      }
      if (!live() || token !== captureToken) return;
      if (recorded.size < 1200) { err.textContent = 'Запись получилась пустой. Проверьте микрофон и попробуйте снова.'; err.hidden = false; }
      else {
        blob = recorded;
        previewUrl = URL.createObjectURL(blob);
        preview.append(h('audio', { controls: true, src: previewUrl, 'aria-label': 'Послушать новую формулировку перед отправкой' }));
        if (saved && !saved.durable) { err.textContent = 'Запись есть на этой странице, но сохранить её на устройстве не удалось. Не закрывайте страницу до отправки.'; err.hidden = false; }
      }
      refreshControls();
    }
    function submitVoice() {
      if (!blob || sending || pending() || active) return;
      const headers = intent.value.trim() ? { 'X-Thought-Meaning': encodeURIComponent(intent.value.trim()) } : {};
      mutate(`/thoughts/${p.id}/audio`, { method: 'PUT', blob, headers }, clearPreview);
    }

    function controls() {
      const blocked = sending || pending() || !!active;
      const recording = active === controller;
      answer.disabled = blocked;
      intent.disabled = blocked;
      submit.disabled = blocked || !answer.value.trim();
      hintButton.disabled = sending || pending() || !!active || (p.hint_count || 0) >= (p.hints || []).length;
      hintButton.hidden = (p.hint_count || 0) >= (p.hints || []).length;
      textButton.disabled = sending || !!active;
      voiceButton.disabled = sending || !!active;
      textButton.classList.toggle('on', mode === 'text');
      voiceButton.classList.toggle('on', mode === 'voice');
      textButton.setAttribute('aria-pressed', String(mode === 'text'));
      voiceButton.setAttribute('aria-pressed', String(mode === 'voice'));
      textBox.hidden = mode !== 'text';
      voiceBox.hidden = mode !== 'voice';
      recordButton.hidden = recording;
      recordButton.disabled = blocked;
      recordButton.replaceChildren(icon('mic'), blob ? 'Записать заново' : 'Начать запись');
      stopButton.hidden = !recording || !rec;
      cancelButton.hidden = !recording && !blob;
      sendAudio.hidden = !blob;
      sendAudio.disabled = blocked;
      card.querySelectorAll('[data-thought-retry]').forEach((b) => { b.disabled = blocked; });
      const newSynonyms = p.learning_kind === 'synonyms' && !!p.practice_format;
      transferArea.hidden = !successfulThought(p) || (!!p.transfer_from && !newSynonyms);
      transferButton.disabled = blocked;
      transferButton.hidden = !!p.transfer_from;
      transferButton.classList.toggle('ghost', !newSynonyms);
      nextAction.hidden = !newSynonyms || !p.transfer_from;
      const hasNext = (session().thoughts || []).some((item) => item.transfer_from === p.id);
      transferMessage.textContent = newSynonyms
        ? p.transfer_from ? 'Получилось и в другой ситуации. Можно попробовать другое речевое действие.'
          : hasNext ? 'Следующая ситуация уже открыта ниже. Примените тот же приём с другими словами.'
            : 'Реплика подошла. Теперь примените тот же приём в другой ситуации с новыми словами.'
        : p.learning_kind ? 'Получилось. Попробуйте тот же приём в другой ситуации, чтобы проверить его самостоятельно.' : 'Фраза стала яснее. Можно попробовать отдельное задание на уточнение мысли в другой ситуации.';
      transferButton.replaceChildren(newSynonyms ? 'Другая ситуация — новые слова' : p.learning_kind ? (hasNext ? 'Открыть задание на другой теме' : 'Применить на другой теме') : (hasNext ? 'Открыть задание на уточнение' : 'Попробовать задание на уточнение'), icon('arrow'));
      const attempts = p.attempts || [];
      const latest = attempts[attempts.length - 1];
      const finished = latest && ['done', 'error'].includes(latest.status);
      const message = sending ? 'Сохраняю…' : pending() ? 'Тренер проверяет вашу версию. Обычно это занимает до минуты. Можно остаться на этой странице или вернуться позже.'
        : finished ? `Вариант ${attempts.length} сохранён. ` + (latest.status === 'done' ? 'Отзыв тренера готов.' : 'Проверка не завершилась. Можно повторить её, ваша версия останется.') : '';
      status.hidden = !message;
      if (statusText.textContent !== message) statusText.textContent = message;
      viewResult.hidden = !finished || sending || pending();
      viewResult.textContent = latest && latest.status === 'error' ? 'Посмотреть ошибку' : 'Посмотреть отзыв';
    }
    answer.addEventListener('input', controls);

    function update(next) {
      p = next;
      const key = JSON.stringify(p);
      if (key !== contentKey) {
        contentKey = key;
        title.textContent = (p.learning_kind ? p.title : null) || p.goal || 'Сформулируйте мысль яснее';
        topicLabel.hidden = !p.learning_kind || !p.topic;
        topicLabel.textContent = p.topic ? (p.transfer_from && p.transfer_type !== 'new_exercise' ? 'Новая тема: ' : 'Ситуация: ') + p.topic : '';
        task.textContent = p.task || 'Сохраните исходный смысл и попробуйте выразить его яснее.';
        phase.textContent = p.transfer_type === 'new_exercise' ? 'Отдельное задание' : p.transfer_from ? 'Другая тема' : p.source === 'learning' ? 'Учебное задание' : 'Своя формулировка';
        materials.replaceChildren(...[learningMaterials(p)].filter(Boolean));
        const format = p.practice_format;
        answerLabel.textContent = format && format.answer_label ? format.answer_label : p.learning_kind === 'lexicon' ? 'Ваше предложение с этим словом' : p.source === 'learning' ? 'Ваш ответ' : 'Ваша новая формулировка';
        answerFormat.hidden = p.learning_kind !== 'synonyms';
        if (p.learning_kind === 'synonyms') {
          answerFormat.replaceChildren(...(format ? [
            h('h4', null, format.label || 'Что отправить тренеру'),
            h('p', null, format.answer_hint || 'Составьте готовую реплику по условию задания.'),
            h('p', { class: 'small soft' }, 'Можно написать или сказать голосом.'),
          ] : [
            h('h4', null, 'Что отправить тренеру'),
            h('ol', null, h('li', null, 'Два варианта замены слова или выражения.'),
              h('li', null, 'Короткое объяснение: чем они отличаются.'),
              h('li', null, 'Ваше предложение с одним из вариантов по условию задания.')),
            h('p', { class: 'small soft' }, 'Всё одним сообщением. Можно написать или сказать голосом.'),
          ]));
          answer.setAttribute('aria-describedby', answerFormat.id);
        } else answer.removeAttribute('aria-describedby');
        answer.placeholder = format && format.placeholder ? format.placeholder : p.learning_kind === 'lexicon' ? 'Придумайте свою фразу для указанной ситуации' : p.source === 'learning' ? 'Сформулируйте ответ своими словами' : 'Скажите то же самое своими словами';
        submit.replaceChildren(format ? 'Проверить мою реплику' : 'Проверить мою версию', icon('arrow'));
        voiceInstruction.textContent = format ? 'Произнесите готовую реплику по условию. До 90 секунд: закончите запись, когда выразили мысль.' : 'Произнесите новую версию. До 90 секунд: закончите запись, когда выразили мысль.';
        intentSummary.textContent = p.source === 'learning' ? 'Добавить пояснение к ответу' : 'Уточнить, что я хотел сказать';
        intentLabel.textContent = p.source === 'learning' ? 'Что вы хотели выразить?' : 'Какой смысл важно сохранить?';
        comparisons.querySelectorAll('audio').forEach((a) => a.pause());
        const original = p.original || {};
        const originalAudio = original.audio ? h('audio', { controls: true, preload: 'metadata', src: url(`media/${session().id}/${original.audio}`), 'aria-label': 'Исходная запись' }) : null;
        if (originalAudio && original.start > 0) originalAudio.addEventListener('loadedmetadata', () => { originalAudio.currentTime = original.start; }, { once: true });
        const before = h('div', { class: 'thought-version' }, h('h4', null, p.source === 'learning' ? 'Учебная ситуация' : 'Исходная фраза'), h('p', { class: 'thought-quote' }, original.text), originalAudio,
          originalAudio ? h('p', { class: 'small soft' }, original.start != null ? `Фрагмент с ${mmss(original.start)}. Доступна вся исходная запись.` : 'Доступна вся исходная запись.') : null,
          original.context && original.context !== original.text ? (p.source === 'learning'
            ? h('div', { class: 'learning-context' }, h('h5', null, 'Условия'), h('p', { class: 'thought-context' }, original.context))
            : h('details', null, h('summary', null, 'Контекст'), h('p', { class: 'thought-context' }, original.context))) : null);
        const attempts = p.attempts || [];
        const after = h('div', { class: 'thought-versions' }, h('h4', null, attempts.length ? (p.source === 'learning' ? 'Ваши ответы' : 'Ваши новые версии') : 'Здесь появится ваш ответ'),
          !attempts.length ? h('p', { class: 'soft' }, 'Напишите или произнесите новую формулировку ниже. Исходная фраза останется для сравнения.') : null,
          [...attempts].reverse().map((a, reverseIndex) => {
            const review = a.review || {};
            const label = { improved: p.source === 'learning' ? 'Задание выполнено' : 'Стало яснее', needs_work: 'Можно доработать', unclear: 'Нужно уточнить смысл' }[review.assessment];
            return h('div', { class: 'thought-version thought-attempt', id: `thought-attempt-${p.id}-${a.id}`, tabindex: -1 }, h('div', { class: 'row' }, h('h5', null, `Вариант ${attempts.length - reverseIndex}`), label ? h('span', { class: 'chip' }, label) : null),
              a.text ? h('p', { class: 'thought-quote' }, a.text) : h('p', { class: 'soft' }, a.status === 'processing' ? 'Распознаю запись…' : 'Текст пока не распознан.'),
              a.audio ? h('audio', { controls: true, preload: 'metadata', src: url(`media/${session().id}/${a.audio}`), 'aria-label': `Запись новой формулировки, вариант ${attempts.length - reverseIndex}` }) : null,
              a.intended_meaning ? h('p', { class: 'small soft' }, 'Вы уточнили смысл: ', a.intended_meaning) : null,
              a.status === 'done' ? h('div', { class: 'thought-review' },
                h('p', null, review.feedback),
                review.meaning_preserved ? h('p', { class: 'small soft' }, (p.source === 'learning'
                  ? { yes: 'Ответ соответствует смыслу задания.', no: 'Сверьтесь со смыслом задания.', unclear: 'Смысл ответа требует уточнения.' }
                  : { yes: 'Смысл сохранён.', no: 'Смысл изменился. Сверьтесь с исходной фразой.', unclear: 'Сохранение смысла требует уточнения.' })[review.meaning_preserved]) : null,
                p.transfer_from && p.transfer_type !== 'new_exercise' && a.status === 'done' ? h('p', { class: 'small soft' }, a.hints_used === 0 ? 'Попытка на новой теме без открытых подсказок.' : 'Попытка на новой теме с помощью подсказок. Самостоятельный перенос пока не подтверждён.') : null,
                review.next_hint ? h('p', { class: 'thought-next-hint' }, review.next_hint) : null) : null,
              ['processing', 'reviewing'].includes(a.status) ? h('p', { class: 'small soft', role: 'status' }, a.status === 'processing' ? 'Распознаю речь…' : 'Тренер сравнивает формулировки…') : null,
              a.status === 'error' ? h('div', null, h('p', { class: 'thought-error' }, a.error || 'Проверка не завершилась. Ваша версия сохранена.'), h('button', { class: 'btn ghost small', type: 'button', 'data-thought-retry': true, onclick: () => mutate(`/thoughts/${p.id}/attempts/${a.id}/retry`, { method: 'POST', body: {} }) }, icon('redo'), 'Повторить проверку')) : null);
          }));
        comparisons.replaceChildren(before, after);
        hints.replaceChildren(...(p.hints || []).slice(0, p.hint_count || 0).map((text, i) => h('div', { class: 'callout' }, h('div', { class: 'label' }, `Подсказка ${i + 1}`), h('p', null, text))));
      }
      controls();
    }
    const controller = { el: card, update, controls, focus: () => title.focus({ preventScroll: true }), destroy() { cancelVoice(false); clearPreview(); card.querySelectorAll('audio').forEach((a) => a.pause()); } };
    update(initial);
    return controller;
  }

  function update() {
    renderEntry();
    for (const p of (session() && session().thoughts) || []) {
      let card = cards.get(p.id);
      if (!card) { card = makeCard(p); cards.set(p.id, card); list.append(card.el); }
      else card.update(p);
    }
    el.hidden = !entry.childElementCount && !cards.size;
  }
  return { el, update, start, isRecording: () => !!active, focus() { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); }, destroy() { destroyed = true; cards.forEach((c) => c.destroy()); } };
}

/* ---- расшифровка с подсветкой ---- */
function renderTranscript(t, rt, wordEls, onWord) {
  const words = t.words || [];
  if (!words.length) return { el: h('p', { class: 'transcript empty-transcript' }, 'Речь не распознана. Проверьте, тот ли микрофон выбран, и запишите заново.') };
  const spans = t.fillers_final || t.fillers_pre || [];
  const fillerAt = new Map(spans.map((sp) => [sp.start, sp.len]));
  const rep = new Set();
  (t.repeats || []).forEach((r) => { for (let k = 0; k < r.len; k++) rep.add(r.start + k); });
  const iss = new Map();
  ((rt && rt.issues) || []).forEach((it) => {
    if (!it.loc) return;
    for (let k = 0; k < it.loc.len; k++) if (!iss.has(it.loc.start + k)) iss.set(it.loc.start + k, it);
  });
  const gapsAfter = new Map();
  (t.gaps || []).forEach((g) => { if (!gapsAfter.has(g.after)) gapsAfter.set(g.after, []); gapsAfter.get(g.after).push(g); });
  const used = new Set();

  const p = h('p', { class: 'transcript' });
  const m = t.metrics || {};
  if (m.start_delay != null) {
    p.append(h('span', { class: 'gap start' + (m.start_delay > 2.5 ? ' hes' : ''), title: 'Сколько прошло от сигнала до первого слова' }, `старт ${f1(m.start_delay)} с`), ' ');
  }
  (gapsAfter.get(-1) || []).forEach((g) => { p.append(gapChip(g), ' '); used.add(g.kind); });

  const wordEl = (i) => {
    const w = words[i];
    let cls = 'w';
    const it = iss.get(i);
    if (it) { cls += ' iss'; used.add('iss'); }
    if (rep.has(i)) { cls += ' rep'; used.add('rep'); }
    const el = h('span', { class: cls, 'data-i': i, title: it ? `${it.kind}: ${it.fix}` : (rep.has(i) ? 'Повтор-запинка' : null) }, w.t);
    el.addEventListener('click', () => onWord(i));
    wordEls[i] = el;
    return el;
  };
  let i = 0;
  while (i < words.length) {
    const len = fillerAt.get(i);
    if (len) {
      const hes = isHes(normWord(words[i].t));
      used.add(hes ? 'hes' : 'filler');
      const mark = h('mark', { class: 'filler' + (hes ? ' hes' : ''), title: hes ? 'Мычание, записанное буквами' : 'Слово-паразит' });
      for (let k = 0; k < len && i + k < words.length; k++) { if (k) mark.append(' '); mark.append(wordEl(i + k)); }
      p.append(mark);
      for (let k = 0; k < len; k++) (gapsAfter.get(i + k) || []).forEach((g) => { p.append(' ', gapChip(g)); used.add(g.kind); });
      i += len;
    } else {
      p.append(wordEl(i));
      (gapsAfter.get(i) || []).forEach((g) => { p.append(' ', gapChip(g)); used.add(g.kind); });
      i += 1;
    }
    p.append(' ');
  }
  const items = [
    ['filler', 'f', 'слово-паразит'], ['hes', 'h', 'э-э, м-м в тексте'], ['мычание', 'h', 'мычание без слов'],
    ['заминка', 'ph', 'пауза внутри фразы'], ['провал', 'pl', 'пауза от 2 с'], ['длинная пауза', 'pl', 'пауза от 2 с'], ['смысловая', 'ps', 'пауза у границы фразы'],
    ['неопределённая', 'ps', 'пауза'], ['перед началом', 'ps', 'пауза перед началом'],
    ['iss', 'iss', 'недочёт'], ['rep', 'rep', 'повтор'],
  ].filter(([k]) => used.has(k));
  const legend = items.length ? h('div', { class: 'legend' }, items.map(([, c, l]) => h('span', null, h('i', { class: c }), l)), h('span', null, '· нажмите на слово, чтобы послушать'), h('span', { class: 'pause-note' }, 'Паузы отмечены автоматически. Их длительность и положение сами по себе не означают ошибку.')) : null;
  return { el: p, legend };
}

function gapChip(g) {
  const parts = [];
  if (g.pause >= 0.45) parts.push(`⏸ ${f1(g.pause)}`);
  if (g.hums) parts.push(g.hums > 1 ? `м-м ×${g.hums}` : 'м-м');
  const cls = { 'провал': 'long', 'длинная пауза': 'long', 'заминка': 'hes', 'мычание': 'hum' }[g.kind] || '';
  let title = {
    'смысловая': `Пауза у границы фразы: ${f1(g.pause)} с. Автоматическая отметка по расшифровке.`,
    'заминка': `Пауза внутри фразы: ${f1(g.pause)} с. Может быть нужна для формулировки мысли.`,
    'провал': `Длинная пауза: ${f1(g.pause)} с. Сама по себе не означает ошибку.`,
    'длинная пауза': `Длинная пауза: ${f1(g.pause)} с. Сама по себе не означает ошибку.`,
    'неопределённая': `Пауза ${f1(g.pause)} с. Автоматически определить её роль нельзя.`,
    'перед началом': `Пауза перед началом речи: ${f1(g.pause)} с. Можно обдумать ответ.`,
    'мычание': `Мычание без слов, ${f1(g.hum)} с — слышно по звуку, в тексте его нет`,
  }[g.kind] || '';
  if (g.hums && g.kind !== 'мычание') title += ` + мычание ${f1(g.hum)} с`;
  return h('span', { class: `gap ${cls}`, title }, parts.join(' · '));
}

function tile(label, value, unit, sub, pre) {
  return h('div', { class: 'tile' },
    h('div', { class: 't-label' }, label),
    h('div', { class: 't-val' }, value == null ? '—' : String(value), unit ? h('small', null, unit) : null),
    sub ? h('div', { class: 't-sub' }, sub) : null,
    pre ? h('div', { class: 'pre' }, pre) : null);
}
function tilesFor(t, rt) {
  const m = t.metrics || {};
  const final = !!t.fillers_final;
  const bd = Object.entries(m.filler_breakdown || {}).slice(0, 4).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(' · ');
  const freq = (t.frequent || []).slice(0, 3).map((x) => `«${x.w}» ×${x.n}`).join(', ');
  const reps = [...new Set((t.repeats || []).map((r) => `«${r.word}»`))].slice(0, 3).join(', ');
  const repSub = [reps ? `подряд: ${reps}` : '', freq ? `часто: ${freq}` : ''].filter(Boolean).join(' · ') || 'запинок-повторов нет';
  const hums = (m.hums_audio || 0) + (m.hes_words || 0);
  const box = h('div', { class: 'tiles' },
    tile('Темп', m.wpm, 'слов/мин', [tempoZone(m.wpm), m.articulation_wpm ? `без пауз ${m.articulation_wpm}` : ''].filter(Boolean).join(' · ')),
    tile('Слова-паразиты', m.fillers, '', [m.fillers_per_min != null && m.fillers ? `${f1(m.fillers_per_min)} в минуту` : '', bd || 'не найдено'].filter(Boolean).join(' · '), final ? null : 'предварительно, до разбора'),
    tile('Паузы внутри фраз', m.pauses_hes, '', `самая долгая ${f1(m.longest_pause)} с · у границ фраз ${m.pauses_sem || 0}`, 'автоматическая разметка, не оценка ошибки'),
    tile('Мычание', hums, '', `по звуку ${m.hums_audio || 0} · в тексте ${m.hes_words || 0}`),
    tile('Старт', f1(m.start_delay), 'с', 'от сигнала до первого слова'),
    tile('Повторы', m.repeats, '', repSub));
  if (rt) {
    const kinds = {};
    rt.issues.forEach((x) => { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
    box.append(
      tile('Недочёты', rt.issues.length, '', Object.entries(kinds).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(' · ') || 'чисто'),
      tile('Мысли', rt.complete_thoughts, `/ ${rt.broken_thoughts}`, 'законченных / оборванных'));
  }
  return box;
}

function takeAnalysis(rt, t, wordEls, player, onPractice) {
  const box = h('div', { class: 'take-analysis' });
  if (rt.main_idea) box.append(h('p', { class: 'main-idea' }, h('b', null, 'Главная мысль: '), rt.main_idea));
  const st = rt.structure || {};
  const keys = [['thesis', 'Тезис'], ['explanation', 'Объяснение'], ['example', 'Пример'], ['conclusion', 'Вывод']];
  if (keys.some(([k]) => st[k])) {
    box.append(h('div', null, h('h3', { style: 'margin-bottom:8px' }, 'Структура'),
      h('div', { class: 'structure' }, keys.map(([k, name]) => h('div', { class: 's ' + (st[k] ? 'ok' : 'miss') },
        h('span', { class: 'k' }, name), h('span', { class: 'q' }, st[k] || 'не было'))))));
  }
  if (rt.issues.length) {
    box.append(h('details', { class: 'issue-details' }, h('summary', null, `Недочёты по фразам · ${rt.issues.length}`),
      h('div', { class: 'issues' }, rt.issues.map((it, issueIndex) => {
        const q = h('button', { type: 'button', title: it.loc ? 'Показать в тексте и послушать' : 'Цитата' }, it.quote);
        q.addEventListener('click', () => {
          if (!it.loc) return;
          const els = [];
          for (let k = 0; k < it.loc.len; k++) if (wordEls[it.loc.start + k]) els.push(wordEls[it.loc.start + k]);
          if (!els.length) return;
          els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          els.forEach((e) => e.classList.add('flash'));
          setTimeout(() => els.forEach((e) => e.classList.remove('flash')), 1800);
          if (player) player.seek(Math.max(0, t.words[it.loc.start].s - 0.3));
        });
        return h('div', { class: 'issue' },
          h('div', { class: 'kind' }, h('span', { class: 'chip' }, it.kind)),
          h('div', { class: 'quote' }, q),
          h('div', { class: 'fix' }, it.fix),
          it.why ? h('div', { class: 'why' }, it.why) : null,
          onPractice && it.loc ? h('div', { class: 'issue-practice' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => onPractice(issueIndex) }, icon('edit'), 'Переделать самому')) : null);
      }))));
  }
  if (rt.stronger) {
    const explanation = typeof rt.stronger_explanation === 'string' ? rt.stronger_explanation.trim() : '';
    const readBtn = h('button', { class: 'btn quiet small', type: 'button' }, icon('speaker'), 'Послушать');
    readBtn.addEventListener('click', () => { if (!speak(rt.stronger)) toast('В системе нет русского голоса для чтения вслух'); });
    const copyBtn = h('button', { class: 'btn quiet small', type: 'button' }, icon('copy'), 'Копировать');
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(rt.stronger); toast('Скопировано'); } catch (e) { toast('Не получилось скопировать'); }
    });
    box.append(h('div', { class: 'stronger' },
      h('div', { class: 'label' }, 'Как сказать сильнее', h('span', { class: 'spacer' })),
      h('p', null, rt.stronger),
      h('div', { class: 'row', style: 'margin-top:10px' }, readBtn, copyBtn),
      explanation ? h('section', { class: 'stronger-explanation', 'aria-label': 'Как устроен этот ответ' },
        h('h3', null, 'Как устроен этот ответ'), h('p', null, explanation)) : null));
  }
  return box;
}

function meterRow(name, value, note, before) {
  const pct = Math.max(0, Math.min(100, value * 10));
  return h('div', { class: 'meter-row' },
    h('div', { class: 'meter-top' }, h('span', { class: 'name' }, name), h('span', { class: 'v' }, f1(value), h('span', { class: 'muted small' }, ' / 10'))),
    h('div', { class: 'meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 10, 'aria-valuenow': value, 'aria-label': name },
      h('i', { style: `width:${pct}%` }),
      before != null ? h('b', { style: `left:calc(${Math.max(0, Math.min(100, before * 10))}% - 1px)`, title: `было ${f1(before)}` }) : null),
    note ? h('div', { class: 'meter-note' }, note) : null);
}

/* ---- плеер ---- */
function makePlayer(src, durationHint, onTime) {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = src;
  const btn = h('button', { class: 'play', type: 'button', 'aria-label': 'Слушать запись' }, icon('play'));
  const fill = h('i'), knob = h('b');
  const scrub = h('div', { class: 'scrub', role: 'slider', tabindex: 0, 'aria-label': 'Позиция в записи', 'aria-valuemin': 0 }, fill, knob);
  const time = h('span', { class: 'p-time' }, `0:00 / ${mmss(durationHint || 0)}`);
  const dur = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationHint || 0);
  let raf = 0;
  function paint() {
    const d = dur();
    const p = d ? Math.min(1, audio.currentTime / d) : 0;
    fill.style.width = `${p * 100}%`;
    knob.style.left = `${p * 100}%`;
    time.textContent = `${mmss(audio.currentTime)} / ${mmss(d)}`;
    scrub.setAttribute('aria-valuenow', String(Math.round(audio.currentTime)));
    onTime && onTime(audio.currentTime);
  }
  function loop() { paint(); if (!audio.paused) raf = requestAnimationFrame(loop); }
  audio.addEventListener('play', () => { btn.replaceChildren(icon('pause')); btn.setAttribute('aria-label', 'Пауза'); loop(); });
  audio.addEventListener('pause', () => { btn.replaceChildren(icon('play')); btn.setAttribute('aria-label', 'Слушать запись'); cancelAnimationFrame(raf); paint(); });
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('ended', () => { onTime && onTime(-10); });
  btn.addEventListener('click', () => {
    if (audio.paused) {
      document.querySelectorAll('audio').forEach((a) => { if (a !== audio) a.pause(); });
      audio.play().catch(() => toast('Не получилось воспроизвести запись'));
    } else audio.pause();
  });
  function seekTo(clientX) {
    const r = scrub.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    audio.currentTime = p * dur();
    paint();
  }
  scrub.addEventListener('pointerdown', (e) => {
    seekTo(e.clientX);
    scrub.setPointerCapture(e.pointerId);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => { scrub.removeEventListener('pointermove', move); scrub.removeEventListener('pointerup', up); };
    scrub.addEventListener('pointermove', move);
    scrub.addEventListener('pointerup', up);
  });
  scrub.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(dur(), audio.currentTime + 3); paint(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 3); paint(); e.preventDefault(); }
  });
  // держим элемент в DOM, чтобы «пауза для всех» его находила
  audio.hidden = true;
  const el = h('div', { class: 'player' }, btn, scrub, time, audio);
  return {
    el,
    seek(t) {
      document.querySelectorAll('audio').forEach((a) => { if (a !== audio) a.pause(); });
      audio.currentTime = t;
      audio.play().catch(() => {});
    },
    destroy() { audio.pause(); cancelAnimationFrame(raf); audio.removeAttribute('src'); audio.load(); },
  };
}

/* ===================== программа ===================== */
async function ProgramView(ctx) {
  const [state, sessions] = await Promise.all([api('/api/state'), api('/api/sessions')]);
  app.state = state;
  const ps = programStatus(sessions, state);
  const today = state.competition ? state.competition.today : todayStr();

  const startBtn = h('button', { class: 'btn', type: 'button' }, 'Начать сегодня', icon('arrow'));
  startBtn.addEventListener('click', async () => {
    try { await api('/api/state', { method: 'POST', body: { program_start: today } }); route(); } catch (e) { toast(e.message); }
  });

  const joinedGroups = state.competitions || [];
  let groupPicker = null;
  if (joinedGroups.length > 1) {
    const select = h('select', { id: 'program-group-select', class: 'groups-select' },
      joinedGroups.map((group) => h('option', { value: group.id }, group.name)));
    select.value = state.competition ? state.competition.id : '';
    const status = h('p', { class: 'small soft', role: 'status', 'aria-live': 'polite' },
      'У каждой группы свои задания и зачёт. Выберите, где занимаетесь сейчас.');
    select.addEventListener('change', async () => {
      select.disabled = true;
      status.textContent = 'Загружаем задания группы…';
      try {
        await api(`/api/groups/${encodeURIComponent(select.value)}/select`, { method: 'POST', body: {} });
        if (ctx.alive()) route();
      } catch (e) {
        select.disabled = false;
        select.value = state.competition ? state.competition.id : '';
        status.textContent = e.message;
      }
    });
    groupPicker = h('div', { class: 'card stack' }, h('label', { for: 'program-group-select' }, 'Задания какой группы?'), select, status);
  }
  const head = h('div', { class: 'stack', style: 'margin-bottom:22px' },
    h('h1', null, 'Программа на 30 дней'),
    groupPicker,
    state.competition ? h('div', { class: 'card' }, h('h2', null, state.competition.name), h('p', { class: 'soft' }, 'Сегодняшние темы одинаковые внутри этой группы. Задания засчитываются только здесь.'), h('a', { class: 'btn ghost', href: `#/groups/${state.competition.id}` }, 'Рейтинг и задания группы', icon('arrow'))) : null,
    h('p', { class: 'soft', style: 'max-width:680px' }, '20 минут в день, пять упражнений по таблице. Выполняйте ежедневно месяц. Записи 1-го, 15-го и 30-го дня — контрольные: на странице «Прогресс» они сравниваются по темпу, паузам, повторам, паразитам и законченным мыслям.'));

  const stepRows = ps.steps.map((st) => {
    const ex = catalog().exercises[st.exercise];
    const href = st.done ? (st.session ? `#/s/${st.session.id}` : `#/groups/${state.competition.id}`) : programHref(st.exercise, state.competition);
    return h('a', { class: 'step-row' + (st.done ? ' done' : ''), href },
      h('span', { class: 'n' }, st.done ? '✓' : String(st.i + 1)),
      h('span', null, h('div', { class: 't' }, ex.title), h('div', { class: 'small muted' }, `${st.minutes} мин · ${st.develops}`)),
      st.done ? h('span', { class: 'score-pill' }, f1(st.score ?? (st.session && st.session.summary && st.session.summary.overall)), h('small', null, '/10')) : h('span', { class: 'muted' }, icon('arrow')));
  });

  const todayCard = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, ps.start ? (ps.dayN > 30 ? 'Программа пройдена' : `Сегодня · день ${ps.dayN} из 30`) : 'Сегодняшние упражнения'),
      h('span', { class: 'spacer' }), h('span', { class: 'chip' }, `${ps.doneCount} из 5`)),
    h('div', { class: 'steps-list' }, stepRows),
    h('div', { class: 'row', style: 'margin-top:14px' },
      ps.start ? (ps.next ? h('a', { class: 'btn', href: programHref(ps.next.exercise, state.competition) }, 'Следующий шаг', icon('arrow')) : h('span', { class: 'chip good' }, 'На сегодня всё сделано')) : startBtn));

  let calCard;
  if (ps.start) {
    const cs = getComputedStyle(document.documentElement);
    const fills = [0, 1, 2, 3].map((k) => cs.getPropertyValue(`--ord-${k}`).trim());
    const cells = [];
    for (let k = 1; k <= 30; k++) {
      const date = addDays(ps.start, k - 1);
      const n = date <= today ? ps.stepsOn(date) : 0;
      const lvl = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3;
      const isCheck = catalog().checkpoint_days.includes(k);
      const bg = fills[lvl];
      const label = `День ${k}, ${parseDay(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${date > today ? 'впереди' : `${n} из 5 упражнений`}${isCheck ? ', контрольный' : ''}`;
      cells.push(h('div', {
        class: 'd' + (date === today ? ' today' : '') + (isCheck ? ' check' : ''),
        style: lvl ? `background:${bg};color:${inkOn(bg)}` : (date > today ? 'opacity:.55' : ''),
        title: label, 'aria-label': label, tabindex: 0,
      }, String(k)));
    }
    const resetBtn = confirmButton('Начать заново', 'Сбросить и начать с сегодняшнего дня?', async () => {
      try { await api('/api/state', { method: 'POST', body: { program_start: today } }); route(); } catch (e) { toast(e.message); }
    }, 'btn ghost small');
    calCard = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, '30 дней'), h('span', { class: 'spacer' }), h('span', { class: 'chip' }, `серия ${streak(sessions)} ${plural(streak(sessions), 'день', 'дня', 'дней')}`)),
      h('div', { class: 'cal' }, cells),
      h('div', { class: 'cal-legend' },
        [[0, 'нет'], [1, '1–2'], [2, '3–4'], [3, 'все 5']].map(([k, l]) => h('span', null, h('i', { style: `background:${fills[k]}` }), l)),
        h('span', null, h('i', { style: 'background:var(--serious);width:8px;height:8px;border-radius:50%' }), 'контрольный день')),
      h('div', { class: 'row', style: 'margin-top:14px' }, h('a', { class: 'btn ghost small', href: '#/progress' }, 'Прогресс и контрольные дни'), h('span', { class: 'spacer' }), resetBtn));
  } else {
    calCard = h('div', { class: 'card' }, h('h2', null, 'Как это работает'),
      h('ul', { class: 'list grow' },
        h('li', null, 'Каждый день — пять коротких упражнений, около 20 минут.'),
        h('li', null, 'Тренер разбирает каждое: паразиты, паузы, недочёты, оценки по пяти критериям.'),
        h('li', null, 'Дни 1, 15 и 30 — контрольные. Сравнение покажет, что изменилось за месяц.')));
  }
  render(ctx, head, h('div', { class: 'prog-grid' }, todayCard, calCard));
  return null;
}

/* Белый или тёмный текст поверх цветной клетки — что контрастнее. */
function inkOn(color) {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return 'inherit';
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const cWhite = 1.05 / (L + 0.05), cInk = (L + 0.05) / 0.0545;
  return cWhite >= cInk ? '#ffffff' : '#0b0b0b';
}

/* ===================== история ===================== */
async function HistoryView(ctx, params) {
  const sessions = await api('/api/sessions');
  const filter = params.get('ex') || '';
  const sel = h('select', { 'aria-label': 'Упражнение' },
    h('option', { value: '' }, 'Все упражнения'),
    catalog().order.map((id) => h('option', { value: id, selected: id === filter }, catalog().exercises[id].title)),
    LEARNING_KINDS.map((kind) => h('option', { value: kind.id, selected: kind.id === filter }, kind.title)));
  sel.addEventListener('change', () => { location.hash = sel.value ? `#/history?ex=${sel.value}` : '#/history'; });
  const list = sessions.filter((x) => !filter || x.exercise === filter);
  const groups = new Map();
  for (const x of list) {
    const day = (x.created || '').slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(x);
  }
  const body = [];
  if (!list.length) {
    body.push(h('div', { class: 'card empty' }, h('h3', null, filter ? 'В этом упражнении пока пусто' : 'Пока ни одной тренировки'),
      h('p', null, 'После первой попытки здесь появятся ваши занятия и обратная связь.'),
      h('p', { style: 'margin-top:14px' }, h('a', { class: 'btn', href: '#/' }, 'К упражнениям'))));
  }
  for (const [day, items] of groups) {
    const raw = parseDay(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
    const title = raw.charAt(0).toUpperCase() + raw.slice(1);
    body.push(h('div', { class: 'day-group' }, h('h3', null, title), h('div', { class: 'hist-list' }, items.map((x) => {
      const sm = x.summary;
      const st = (x.analysis || {}).status;
      const recorded = (x.takes || []).filter((t) => t.status === 'done').length;
      const stats = h('span', { class: 'stats' });
      if (isDemoSession(x)) {
        stats.append(h('span', { class: 'chip' }, 'Демонстрация'), sm ? h('span', { class: 'score-pill' }, f1(sm.overall), h('small', null, '/10')) : null);
      } else if (sm) {
        stats.append(h('span', { class: 'chip num' }, `${f1(sm.fillers_per_min)} паразит./мин`), sm.wpm ? h('span', { class: 'chip num' }, `${sm.wpm} сл/мин`) : '',
          h('span', { class: 'score-pill' }, f1(sm.overall), h('small', null, '/10')));
      } else if (x.learning_kind || st === 'practice') {
        const p = x.learning_progress;
        stats.append(h('span', { class: 'chip' }, p && p.completed ? 'формулировка получилась' : 'учебное задание'));
        if (p && p.independent_transfers) stats.append(h('span', { class: 'chip' }, 'перенос самостоятельно'));
        else if (p && p.transfer_completed) stats.append(h('span', { class: 'chip' }, 'перенос с помощью'));
      } else if (st === 'error') stats.append(h('span', { class: 'chip bad' }, 'разбор не удался'));
      else if (st === 'running') stats.append(h('span', { class: 'chip pulse' }, 'разбирается'));
      else stats.append(h('span', { class: 'chip' }, recorded < x.plan ? `записано ${recorded} из ${x.plan}` : 'без разбора'));
      return h('a', { class: 'hist-row', href: `#/s/${x.id}` },
        h('span', { class: 'time' }, (x.created || '').slice(11, 16)),
        h('span', { class: 'ex' }, x.title || (catalog().exercises[x.exercise] || LEARNING_KINDS.find((k) => k.id === x.exercise) || {}).title || 'Занятие'),
        h('span', { class: 'topic' }, x.topic || '—'),
        stats);
    }))));
  }
  render(ctx, h('div', { class: 'ex-head' }, h('h1', null, 'История'), h('span', { class: 'chip' }, `${list.length} ${plural(list.length, 'запись', 'записи', 'записей')}`)),
    h('div', { class: 'filters' }, sel), body);
  return null;
}

/* ===================== прогресс ===================== */
function niceTicks(min, max, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let x = lo; x <= hi + step / 2; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

const tipEl = () => $('#tooltip');
function showTip(x, y, value, label) {
  const t = tipEl();
  t.replaceChildren(h('div', { class: 'tv' }, h('span', { class: 'key' }), value), h('div', { class: 'tl' }, label));
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y - r.height - 10;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top < 8) top = y + 16;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${top}px`;
}
function hideTip() { const t = tipEl(); if (t) t.hidden = true; }

function lineChart(points, { format = f1, title, sub }) {
  const W = 520, H = 196, L = 40, Rp = 54, T = 12, B = 28;
  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals), 4);
  const min = ticks[0], max = ticks[ticks.length - 1];
  const n = points.length;
  const x = (i) => (n === 1 ? (L + W - Rp) / 2 : L + (i * (W - L - Rp)) / (n - 1));
  const y = (val) => T + (H - T - B) * (1 - (val - min) / (max - min || 1));
  const grid = s('g', { class: 'grid' }, ticks.map((tk) => s('line', { x1: L, x2: W - Rp + 8, y1: y(tk), y2: y(tk) })));
  const yLabels = s('g', null, ticks.map((tk) => s('text', { x: L - 8, y: y(tk) + 4, 'text-anchor': 'end' }, format(tk))));
  const xIdx = n <= 2 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];
  const xLabels = s('g', null, [...new Set(xIdx)].map((i) => s('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, points[i].short)));
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  const line = s('path', { class: 'line', d: 'M' + pts.join('L') });
  const area = s('path', { class: 'area', d: `M${x(0).toFixed(1)},${y(min)}L${pts.join('L')}L${x(n - 1).toFixed(1)},${y(min)}Z` });
  const dots = s('g', null, points.map((p, i) => (n <= 40 || i === n - 1 ? s('circle', { class: 'dot', cx: x(i), cy: y(p.value), r: 4 }) : null)));
  const last = points[n - 1];
  const endLabel = s('text', { class: 'end-label', x: x(n - 1) + 9, y: y(last.value) + 4 }, format(last.value));
  const cross = s('line', { class: 'cross', y1: T, y2: H - B, visibility: 'hidden' });
  const hot = s('circle', { class: 'hot', r: 5.5, visibility: 'hidden' });
  const hit = s('rect', { x: L - 10, y: 0, width: W - L - Rp + 20, height: H, fill: 'transparent' });
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: 0, 'aria-label': `${title}: ${points.map((p) => `${p.label} — ${format(p.value)}`).join('; ')}` },
    grid, s('g', { class: 'axis' }, s('line', { x1: L, x2: W - Rp + 8, y1: y(min), y2: y(min) })), yLabels, xLabels, area, line, dots, endLabel, cross, hot, hit);
  let focus = n - 1;
  function show(i, clientX, clientY) {
    focus = i;
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    hot.setAttribute('cx', x(i)); hot.setAttribute('cy', y(points[i].value)); hot.setAttribute('visibility', 'visible');
    const box = svgEl.getBoundingClientRect();
    const px = clientX != null ? clientX : box.left + (x(i) / W) * box.width;
    const py = clientY != null ? clientY : box.top + (y(points[i].value) / H) * box.height;
    showTip(px, py, format(points[i].value), points[i].label);
  }
  function hide() { cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); hideTip(); }
  svgEl.addEventListener('pointermove', (e) => {
    const box = svgEl.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    show(best, e.clientX, e.clientY);
  });
  svgEl.addEventListener('pointerleave', hide);
  svgEl.addEventListener('focus', () => show(focus));
  svgEl.addEventListener('blur', hide);
  svgEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { show(Math.max(0, focus - 1)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(Math.min(n - 1, focus + 1)); e.preventDefault(); }
  });
  return h('div', { class: 'card chart-card flat' },
    h('div', { class: 'c-title' }, title), sub ? h('div', { class: 'c-sub' }, sub) : null,
    h('div', { class: 'chart' }, svgEl));
}

async function ProgressView(ctx) {
  const [sessions, state] = await Promise.all([api('/api/sessions'), api('/api/state')]);
  app.state = state;
  const realSessions = sessions.filter((session) => !isDemoSession(session));
  const demoNotice = realSessions.length < sessions.length ? h('p', { class: 'small soft' },
    'Демонстрационные прохождения не учитываются в личном прогрессе. Их результаты доступны в рейтингах групп.') : null;
  const done = doneSessions(realSessions).slice().reverse();
  if (!done.length) {
    render(ctx, h('h1', { style: 'margin-bottom:18px' }, 'Прогресс'),
      demoNotice,
      h('div', { class: 'card empty' }, h('h3', null, 'Пока нечего сравнивать'), h('p', null, 'После первых разборов здесь появятся графики: паразиты, заминки, темп и оценки.'),
        h('p', { style: 'margin-top:14px' }, h('a', { class: 'btn', href: '#/' }, 'К упражнениям'))));
    return null;
  }
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const first = done.slice(0, 5), recent = done.slice(-5);
  const avgFirst = avg(first.map((x) => x.summary.overall)), avgRecent = avg(recent.map((x) => x.summary.overall));
  const minutes = done.reduce((a, x) => a + (x.summary.speech_time || 0), 0) / 60;
  const days = new Set(done.map((x) => x.created.slice(0, 10))).size;
  const st = streak(realSessions);
  const delta = done.length >= 6 ? avgRecent - avgFirst : null;

  const kpi = (label, val, sub, subCls) => h('div', { class: 'kpi' }, h('div', { class: 'k-label' }, label), h('div', { class: 'k-val' }, val), sub ? h('div', { class: 'k-sub', style: subCls || '' }, sub) : null);
  const kpis = h('div', { class: 'kpis' },
    kpi('Тренировок', String(done.length), `за ${days} ${plural(days, 'день', 'дня', 'дней')}`),
    kpi('Минут речи', f1(minutes), 'наговорено и разобрано'),
    kpi('Дней подряд', String(st), st ? 'серия продолжается' : 'начните серию сегодня'),
    kpi('Средняя оценка', f1(avgRecent), delta == null ? 'за последние пять' : `${delta >= 0 ? '+' : '−'}${f1(Math.abs(delta))} к первым пяти${delta >= 0.05 ? ' — растёт' : delta <= -0.05 ? ' — просела' : ''}`,
      delta == null ? '' : `color:${delta >= 0.05 ? 'var(--good-ink)' : delta <= -0.05 ? 'var(--bad-ink)' : 'var(--ink-2)'}`));

  // Если все тренировки в один день, на оси полезнее время, а не дата.
  const oneDay = days === 1;
  const pt = (x, val) => {
    const d = new Date(x.created);
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return {
      value: val,
      short: oneDay ? time : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      label: `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${time} · ${(catalog().exercises[x.exercise] || {}).title || x.title}`,
    };
  };
  const series = (key) => done.filter((x) => x.summary[key] != null).map((x) => pt(x, x.summary[key]));
  const charts = [
    ['fillers_per_min', 'Слова-паразиты в минуту', 'меньше — лучше'],
    ['pauses_hes_per_min', 'Паузы-заминки в минуту', 'меньше — лучше'],
    ['wpm', 'Темп речи, слов в минуту', 'комфортно 90–150, быстро 150–190'],
    ['overall', 'Средняя оценка тренера', 'из 10, больше — лучше'],
  ].map(([k, title, sub]) => {
    const pts = series(k);
    if (pts.length < 2) return h('div', { class: 'card chart-card flat' }, h('div', { class: 'c-title' }, title), h('div', { class: 'c-sub' }, 'Нужно хотя бы две тренировки с разбором.'));
    return lineChart(pts, { title, sub, format: k === 'wpm' ? (v) => String(Math.round(v)) : f1 });
  });

  const crit = [['logic', 'Логика'], ['vocabulary', 'Словарный запас'], ['thinking_speed', 'Скорость мышления'], ['persuasiveness', 'Убедительность'], ['structure', 'Структура речи']];
  const critAvg = (list, k) => avg(list.map((x) => x.summary.scores[k]));
  const critCard = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, 'Пять критериев'), h('span', { class: 'muted small' }, done.length >= 6 ? 'полоса — последние пять тренировок, риска — первые пять' : 'среднее по всем тренировкам')),
    h('div', { class: 'meters', style: 'margin-top:4px' }, crit.map(([k, name]) => meterRow(name, critAvg(done.length >= 6 ? recent : done, k), null, done.length >= 6 ? critAvg(first, k) : null))));

  let checkCard = null;
  if (state.program_start) {
    const cols = catalog().checkpoint_days.map((dayN) => {
      const date = addDays(state.program_start, dayN - 1);
      const list = done.filter((x) => x.program_day === date);
      if (!list.length) return { dayN, date, empty: true };
      const speech = list.reduce((a, x) => a + (x.summary.speech_time || 0), 0) / 60;
      const sum = (k) => list.reduce((a, x) => a + (x.summary[k] || 0), 0);
      const words = list.reduce((a, x) => a + (x.summary.wpm || 0) * (x.summary.speech_time || 0) / 60, 0);
      const ct = sum('complete_thoughts'), bt = sum('broken_thoughts');
      return {
        dayN, date,
        wpm: speech ? words / speech : null,
        pauses: speech ? sum('pauses_hes') / speech : null,
        repeats: speech ? sum('repeats') / speech : null,
        fillers: speech ? sum('fillers') / speech : null,
        thoughts: ct + bt ? (100 * ct) / (ct + bt) : null,
        overall: avg(list.map((x) => x.summary.overall)),
      };
    });
    const rows = [
      ['Темп, слов в минуту', 'wpm', (v) => String(Math.round(v))],
      ['Паузы-заминки в минуту', 'pauses', f1],
      ['Повторы в минуту', 'repeats', f1],
      ['Слова-паразиты в минуту', 'fillers', f1],
      ['Законченные мысли', 'thoughts', (v) => `${Math.round(v)}%`],
      ['Средняя оценка', 'overall', f1],
    ];
    checkCard = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Контрольные дни'), h('span', { class: 'muted small' }, 'всё, что сделано в программе в этот день')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, h('th', null, ''), cols.map((c) => h('th', { class: 'n' }, `День ${c.dayN}`)))),
        h('tbody', null, rows.map(([label, k, fmt]) => h('tr', null, h('td', null, label),
          cols.map((c) => h('td', { class: 'n' }, c.empty || c[k] == null ? (c.date > todayStr() ? 'впереди' : '—') : fmt(c[k])))))))));
  }

  const tableBox = h('div', { class: 'table-wrap' },
    h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['Дата', 'Упражнение', 'Оценка', 'Паразиты/мин', 'Заминки/мин', 'Темп'].map((x, i) => h('th', { class: i > 1 ? 'n' : '' }, x)))),
      h('tbody', null, done.slice().reverse().map((x) => h('tr', null,
        h('td', null, new Date(x.created).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        h('td', null, catalog().exercises[x.exercise].title),
        h('td', { class: 'n' }, f1(x.summary.overall)),
        h('td', { class: 'n' }, f1(x.summary.fillers_per_min)),
        h('td', { class: 'n' }, f1(x.summary.pauses_hes_per_min)),
        h('td', { class: 'n' }, x.summary.wpm == null ? '—' : String(x.summary.wpm)))))));
  const tableCard = h('div', { class: 'card flat', style: 'margin-top:14px', hidden: true }, tableBox);
  const tableBtn = h('button', { class: 'btn ghost small', type: 'button', 'aria-expanded': 'false' }, 'Показать таблицей');
  tableBtn.addEventListener('click', () => {
    tableCard.hidden = !tableCard.hidden;
    tableBtn.textContent = tableCard.hidden ? 'Показать таблицей' : 'Скрыть таблицу';
    tableBtn.setAttribute('aria-expanded', String(!tableCard.hidden));
  });

  render(ctx,
    h('div', { class: 'ex-head' }, h('h1', null, 'Прогресс')),
    demoNotice,
    kpis,
    h('div', { class: 'section-title' }, h('h2', null, 'Динамика'), h('span', { class: 'muted' }, 'каждая точка — тренировка с разбором'), h('span', { class: 'spacer' }), tableBtn),
    h('div', { class: 'charts' }, charts),
    tableCard,
    h('div', { style: 'height:14px' }),
    critCard,
    checkCard ? h('div', { style: 'height:14px' }) : null,
    checkCard);
  return null;
}

/* ===================== настройки ===================== */
async function openSettings() {
  const dlg = $('#settings');
  let state = app.state;
  try { state = await api('/api/state'); app.state = state; } catch (e) { /* покажем то, что есть */ }
  const seg = (options, currentVal, onPick) => {
    const box = h('div', { class: 'seg', role: 'radiogroup' });
    const draw = (val) => {
      box.replaceChildren(...options.map(([k, label]) => {
        const b = h('button', { type: 'button', class: k === val ? 'on' : '', role: 'radio', 'aria-checked': String(k === val) }, label);
        b.addEventListener('click', () => { draw(k); onPick(k); });
        return b;
      }));
    };
    draw(currentVal);
    return box;
  };
  const models = Object.entries((state && state.models) || { sonnet: 'Sonnet — быстрее', opus: 'Opus — глубже' });
  const modelSeg = seg(models, state ? state.model : 'sonnet', async (k) => {
    try { app.state = { ...app.state, ...(await api('/api/state', { method: 'POST', body: { model: k } })) }; } catch (e) { toast(e.message); }
  });
  const themeNow = (() => { try { return localStorage.getItem('tr.theme') || 'auto'; } catch (e) { return 'auto'; } })();
  const themeSeg = seg([['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], themeNow, (k) => {
    try { if (k === 'auto') localStorage.removeItem('tr.theme'); else localStorage.setItem('tr.theme', k); } catch (e) { /* ничего */ }
    if (k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k;
  });
  const micSel = h('select', { 'aria-label': 'Микрофон' }, h('option', { value: '' }, 'Системный по умолчанию'));
  async function fillMics() {
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      const cur = prefs.get('micId', '');
      micSel.replaceChildren(h('option', { value: '' }, 'Системный по умолчанию'),
        devs.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || `Микрофон ${i + 1}`)));
    } catch (e) { /* без списка */ }
  }
  micSel.addEventListener('change', () => { prefs.set('micId', micSel.value); mic.close(); });
  const bar = h('i');
  const testBtn = h('button', { class: 'btn quiet small', type: 'button' }, 'Проверить микрофон');
  let testing = false;
  testBtn.addEventListener('click', async () => {
    if (testing) return;
    try { await mic.open(); } catch (e) { toast(e.message, 6000); return; }
    testing = true;
    fillMics();
    testBtn.textContent = 'Говорите…';
    const t0 = performance.now();
    const loop = () => {
      bar.style.width = `${Math.round(mic.level() * 100)}%`;
      if (performance.now() - t0 < 6000 && dlg.open) requestAnimationFrame(loop);
      else { testing = false; bar.style.width = '0'; testBtn.textContent = 'Проверить микрофон'; if (!current || !current.destroy) mic.close(); }
    };
    loop();
  });
  const sw = (key, def, label) => {
    const inp = h('input', { type: 'checkbox', checked: prefs.get(key, def) });
    inp.addEventListener('change', () => prefs.set(key, inp.checked));
    return h('label', { class: 'switch' }, inp, label);
  };
  const lvl = state ? state.coach_level : 1;
  const resetLvl = confirmButton('Сбросить на первый', 'Точно сбросить уровень?', async (b) => {
    try { app.state = { ...app.state, ...(await api('/api/state', { method: 'POST', body: { coach_reset: true } })) }; b.textContent = 'Сброшено'; b.disabled = true; } catch (e) { toast(e.message); }
  }, 'btn ghost small');
  const isOwner = !state || state.is_owner !== false;
  const coachField = isOwner
    ? h('div', { class: 'field' }, h('div', { class: 'label' }, 'Модель Claude'), modelSeg,
      h('div', { class: 'help' }, 'Основной тренер работает через подписку Claude Code: Sonnet быстрее, Opus думает дольше. При ошибке Claude разбор подхватит Codex через подписку ChatGPT. Ключи API не нужны. Для участников бота в Claude используется Sonnet.'))
    : h('div', { class: 'field' }, h('div', { class: 'label' }, state.name ? `Вы: ${state.name}` : 'Ваш профиль'),
      h('div', { class: 'help' }, state.analyses_left == null ? 'Разборов без ограничений.'
        : `Разборов на сегодня осталось: ${state.analyses_left}. Лимит обновляется каждый день.`));
  dlg.replaceChildren(h('div', { class: 'dialog-in' },
    h('div', { class: 'row' }, h('h2', { id: 'settings-title' }, 'Настройки'), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Закрыть', onclick: () => dlg.close() }, '✕')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Мой профиль'),
      h('a', { class: 'btn ghost', href: '#/profile', onclick: () => dlg.close() }, 'Личная фотография')),
    coachField,
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Совместные тренировки'),
      h('a', { class: 'btn ghost', href: '#/groups', onclick: () => dlg.close() }, 'Группы и приглашения')),
    state && state.is_owner === true ? h('div', { class: 'field' }, h('div', { class: 'label' }, 'Администрирование'),
      h('a', { class: 'btn ghost', href: '#/admin', onclick: () => dlg.close() }, 'Пользователи и их занятия')) : null,
    h('div', { class: 'field' }, h('label', null, 'Микрофон'), micSel,
      h('div', { class: 'row' }, testBtn, h('div', { class: 'mic-test', style: 'flex:1' }, bar)),
      h('div', { class: 'help' }, 'Шумоподавление и автогромкость выключены специально: они съедают тихое «м-м» и искажают паузы.')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Тема'), themeSeg),
    h('div', { class: 'field' }, sw('sounds', true, 'Звуковые сигналы старта и конца записи'), sw('readQuestion', true, 'Тренер зачитывает вопрос вслух перед ответом')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, `Уровень вопросов тренера: ${lvl} из 5`), h('div', { class: 'row' }, resetLvl)),
    h('div', { class: 'help' }, isOwner
      ? 'Записи и разборы хранятся на этом компьютере, в папке data рядом с тренажёром. Распознавание локальное. Тренеру отправляются только текст расшифровки и замеры: обычно в Claude, при его ошибке в Codex. Звук им не передаётся.'
      : 'Записи хранятся на компьютере владельца тренажёра. Они доступны вам и владельцу; другие участники их не видят. Распознавание локальное. Тренеру отправляются только текст расшифровки и замеры: обычно в Claude, при его ошибке в Codex. Звук им не передаётся.')));
  if (!dlg.open) dlg.showModal();
  fillMics();
}

/* ===================== старт ===================== */
function showHealth(hl) {
  const b = $('#banner');
  if (!hl || hl.ok) { b.hidden = true; return; }
  const names = { ffmpeg: 'ffmpeg', whisper: 'распознаватель whisper-cli', model: 'модель распознавания', coach: 'тренер Claude / Codex', claude: 'Claude Code' };
  b.replaceChildren(h('b', null, 'Не всё установлено: '), Object.entries(hl.hints).map(([k, hint]) => h('span', null, `${names[k] || k} — `, h('code', null, hint), '. ')));
  b.hidden = false;
}

async function boot() {
  if (window.TrainerConnection) await TrainerConnection.readyPromise;
  const savedRoute = prefs.get('lastRoute', '');
  if ((!location.hash || location.hash === '#/') && /^#\/(s|ex|learn|program|progress|history)(\/|$)/.test(savedRoute)) history.replaceState(null, '', savedRoute);
  $('#settings-btn').addEventListener('click', openSettings);
  try {
    [app.catalog, app.state] = await Promise.all([api('/api/catalog'), api('/api/state')]);
    if (window.TrainerProfiles) TrainerProfiles.refreshHeader();
    const adminEntry = $('#admin-link');
    if (adminEntry) adminEntry.hidden = app.state.is_owner !== true;
  } catch (e) {
    $('#app').replaceChildren(errorBlock(e));
    return;
  }
  api('/api/health').then((hl) => { webVersion = hl.web_version || null; showHealth(hl); }).catch(() => {});
  if (window.speechSynthesis) window.speechSynthesis.getVoices();
  window.addEventListener('hashchange', () => { prefs.set('lastRoute', location.hash); route(); });
  // Внутри раздела страницу не перезагружаем сами (можно потерять запись) — только плашка.
  setInterval(() => { if (webVersion) checkVersion(false); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && webVersion) checkVersion(false); });
  route();
  showDraftRecovery();
  if (window.TrainerMobile) TrainerMobile.refresh();
}
boot();
