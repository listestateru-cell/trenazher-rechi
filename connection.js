/* Постоянная оболочка остаётся на Pages; меняется только адрес API и личных медиа. */
(() => {
  'use strict';
  if (window.TrainerConnection) return;
  const config = window.TRAINER_CONNECTION_CONFIG || {};
  const hosted = config.hosted === true;
  const nativeFetch = window.fetch.bind(window);
  const localShell = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const shell = new URL('./', location.href);
  const namespace = 'speech.' + encodeURIComponent(shell.pathname) + '.';
  const KEY_STORE = namespace + 'launch.key.v1';
  const ENDPOINT_STORE = namespace + 'endpoint.v1';
  const validKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);
  const read = name => { try { return localStorage.getItem(name) || ''; } catch (_) { return ''; } };
  const write = (name, value) => { try { localStorage.setItem(name, value); } catch (_) { /* приватный режим */ } };
  const safeRoute = value => {
    const route = String(value || '').replace(/^#/, '');
    if (!route || route === 'home') return '/';
    const normalized = route.startsWith('/') ? route : '/' + route;
    return /^\/(?!\/)[^\s#]*$/.test(normalized) ? normalized : '/';
  };
  const fragment = location.hash.slice(1).split('~');
  const pathKey = /^\/u\/([A-Za-z0-9_-]{16,64})(?:\/|$)/.exec(location.pathname)?.[1] || '';
  const suppliedKey = validKey(fragment[0]) ? fragment[0] : '';
  let key = suppliedKey || pathKey || (hosted && validKey(read(KEY_STORE)) ? read(KEY_STORE) : '');
  if (key) write(KEY_STORE, key);
  if (suppliedKey) history.replaceState(null, '', location.pathname + location.search + '#' + safeRoute(fragment[1]));

  let base = hosted ? '' : location.origin;
  let connecting = null, ready = false, retryTimer = 0, retryCount = 0;
  let cover = null, note = null, lastDiscovery = 0;
  let resolveReady;
  const readyPromise = new Promise(resolve => { resolveReady = resolve; });

  function normalizeEndpoint(raw) {
    const value = String(raw || '').trim();
    if (/[\u0000-\u0020\u007f]/.test(value)) throw new Error('Неверный адрес подключения.');
    const endpoint = new URL(value);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
        !['', '/'].includes(endpoint.pathname)) throw new Error('Неверный адрес подключения.');
    const tunnel = endpoint.protocol === 'https:' && !endpoint.port &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(endpoint.hostname);
    const local = localShell && ['http:', 'https:'].includes(endpoint.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (!tunnel && !local) throw new Error('Адрес подключения не подходит тренажёру.');
    return endpoint.origin;
  }

  async function timedText(address, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await nativeFetch(address, {
        cache: 'no-store', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        redirect: 'error', signal: controller.signal,
      });
      if (!response.ok) throw new Error('Адрес компьютера пока недоступен.');
      return await response.text();
    } finally { clearTimeout(timer); }
  }

  async function alive(candidate) {
    try { return await timedText(candidate + '/healthz', 5500) === 'ok'; }
    catch (_) { return false; }
  }

  function manifest() {
    if (!hosted || !base || !key) return;
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.append(link); }
    link.crossOrigin = 'anonymous';
    link.href = url('/api/manifest.webmanifest');
  }

  function activate(candidate) {
    const oldBase = base;
    base = candidate;
    write(ENDPOINT_STORE, base);
    manifest();
    if (oldBase && oldBase !== base) window.dispatchEvent(new CustomEvent('trainer:backendchange', {
      detail: { oldBase, newBase: base },
    }));
    note?.remove(); note = null;
    return base;
  }

  async function discover() {
    lastDiscovery = Date.now();
    const candidates = [];
    if (typeof config.contentsUrl === 'string') candidates.push(async () => {
      const address = new URL(config.contentsUrl);
      if (address.protocol !== 'https:' || address.hostname !== 'api.github.com' || address.username || address.password)
        throw new Error('Неверная настройка постоянного адреса.');
      address.searchParams.set('_speech', String(Date.now()));
      const result = JSON.parse(await timedText(address.href));
      if (result.encoding !== 'base64' || typeof result.content !== 'string') throw new Error('Нет адреса компьютера.');
      return atob(result.content.replace(/\s/g, ''));
    });
    candidates.push(async () => {
      const address = new URL(config.urlFile || 'url.txt', shell);
      address.searchParams.set('_speech', String(Date.now()));
      return timedText(address.href);
    });
    for (const candidate of candidates) {
      try {
        const endpoint = normalizeEndpoint(await candidate());
        if (await alive(endpoint)) return endpoint;
      } catch (_) { /* резервный источник или следующий цикл */ }
    }
    throw new Error('Связи с Mac пока нет. Проверьте, что компьютер включён и тренажёр запущен.');
  }

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function ensureCover() {
    if (cover?.isConnected) return cover;
    cover = element('section', 'speech-connection-cover');
    cover.id = 'speech-connection-cover';
    cover.setAttribute('aria-label', 'Подключение к тренажёру');
    const card = element('div', 'speech-connection-card');
    const heading = element('h1', '', 'Тренажёр речи');
    const status = element('p', 'speech-connection-status', 'Подключаемся к Mac…');
    status.id = 'speech-connection-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const detail = element('p', 'speech-connection-detail', 'Записи и прогресс хранятся на вашем компьютере.');
    const retry = element('button', 'btn', 'Подключиться ещё раз');
    retry.id = 'speech-connection-retry'; retry.type = 'button'; retry.hidden = true;
    retry.onclick = () => connectAndReady(true);
    const form = element('form', 'speech-connection-login');
    form.id = 'speech-connection-login'; form.hidden = !!key;
    const label = element('label', '', 'Ваша личная ссылка или ключ'); label.htmlFor = 'speech-connection-key';
    const input = element('input'); input.id = 'speech-connection-key'; input.type = 'text';
    input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
    input.placeholder = 'Вставьте личную ссылку из бота'; input.setAttribute('aria-describedby', 'speech-connection-status');
    const submit = element('button', 'btn', 'Открыть мой тренажёр'); submit.type = 'submit';
    form.append(label, input, submit);
    form.onsubmit = event => {
      event.preventDefault();
      try { setKey(input.value); input.value = ''; }
      catch (_) { status.textContent = 'Вставьте полную личную ссылку из бота или свой ключ доступа.'; input.focus(); }
    };
    card.append(heading, status, detail, retry, form);
    cover.append(card); document.body.append(cover);
    return cover;
  }

  function showStatus(message, canRetry = false) {
    const target = ensureCover();
    target.querySelector('#speech-connection-status').textContent = message;
    target.querySelector('#speech-connection-retry').hidden = !canRetry;
    target.querySelector('#speech-connection-login').hidden = !!key;
  }

  function connectionNote(message) {
    if (!note?.isConnected) {
      note = element('aside', 'speech-connection-note'); note.setAttribute('role', 'status');
      const text = element('span'); const retry = element('button', 'btn ghost', 'Повторить');
      retry.type = 'button'; retry.onclick = () => reconnect(true).catch(() => {});
      note.append(text, retry); document.body.append(note);
    }
    note.querySelector('span').textContent = message;
  }

  async function reconnect(force = true) {
    if (!hosted) return base;
    if (connecting) return connecting;
    connecting = (async () => {
      if (!force) {
        try {
          const cached = normalizeEndpoint(base || read(ENDPOINT_STORE));
          if (await alive(cached)) return activate(cached);
        } catch (_) { /* не отправляем ключ на непроверенный сохранённый адрес */ }
      }
      return activate(await discover());
    })().catch(error => {
      if (ready) connectionNote('Связь с Mac прервалась. Ответ остаётся на экране; отправку можно повторить после подключения.');
      throw error;
    }).finally(() => { connecting = null; });
    return connecting;
  }

  async function connectAndReady(force = false) {
    clearTimeout(retryTimer);
    if (!hosted) {
      ready = true; resolveReady({ base, key }); return;
    }
    if (!key) { showStatus('Откройте свой профиль по личной ссылке.'); return; }
    if (!ready) showStatus('Подключаемся к Mac…');
    try {
      await reconnect(force);
      retryCount = 0;
      if (!ready) { ready = true; cover?.remove(); resolveReady({ base, key }); }
    } catch (error) {
      if (!ready) showStatus(error.message, true);
      retryCount++;
      retryTimer = setTimeout(() => { if (!document.hidden) connectAndReady(true); }, Math.min(60000, 10000 * retryCount));
    }
  }

  function inputKey(value) {
    const text = String(value || '').trim();
    if (validKey(text)) return text;
    const link = new URL(text);
    if (link.username || link.password) throw new Error('Неверная личная ссылка.');
    const expected = new URL(config.pagesUrl || shell.href);
    const isShell = link.origin === expected.origin && link.pathname === expected.pathname;
    let candidate;
    if (isShell) candidate = link.hash.slice(1).split('~')[0];
    else {
      normalizeEndpoint(link.origin);
      candidate = /^\/u\/([A-Za-z0-9_-]{16,64})\/?$/.exec(link.pathname)?.[1];
    }
    if (!validKey(candidate)) throw new Error('Неверная личная ссылка.');
    return candidate;
  }

  function setKey(value) {
    const nextKey = inputKey(value);
    const changed = key !== nextKey;
    key = nextKey; write(KEY_STORE, key);
    history.replaceState(null, '', location.pathname + location.search + '#/');
    if (ready && changed) { location.reload(); return; }
    if (!ready) connectAndReady(false);
  }

  function relativePath(input) {
    const address = new URL(input, shell);
    // Accept an already-composed URL after reconnection, but never an arbitrary host.
    if (address.origin !== location.origin && address.origin !== base) normalizeEndpoint(address.origin);
    let path = address.pathname;
    if (address.origin === location.origin && path.startsWith(shell.pathname)) {
      const shellRelative = '/' + path.slice(shell.pathname.length);
      if (/^\/(?:api|media)(?:\/|$)/.test(shellRelative)) path = shellRelative;
    }
    const prefix = /^\/u\/([A-Za-z0-9_-]{16,64})(?=\/|$)/.exec(path);
    if (prefix) {
      if (key && prefix[1] !== key) throw new Error('Запрос относится к другому профилю.');
      path = path.slice(prefix[0].length) || '/';
    }
    if (!/^\/(?:api|media)(?:\/|$)/.test(path)) throw new Error('Этот адрес не относится к API тренажёра.');
    return path + address.search;
  }

  function url(path) {
    if (!base) throw new Error('Сначала дождитесь подключения к Mac.');
    const relative = relativePath(path);
    return base + (key ? '/u/' + key : '') + relative;
  }

  async function request(input, init) {
    const isRequest = typeof Request !== 'undefined' && input instanceof Request;
    const source = isRequest ? new Request(input, init) : new Request(new URL(String(input), shell), init);
    const path = relativePath(source.url);
    if (!ready) await abortable(readyPromise, source.signal);
    if (source.signal.aborted) throw source.signal.reason || new DOMException('Aborted', 'AbortError');
    const safe = ['GET', 'HEAD'].includes(source.method);
    const body = safe || source.body === null ? undefined : await source.arrayBuffer();
    const options = {
      method: source.method, headers: source.headers, body, signal: source.signal,
      cache: source.cache, redirect: source.redirect, integrity: source.integrity,
      keepalive: source.keepalive, mode: hosted ? 'cors' : source.mode,
      credentials: hosted ? 'omit' : source.credentials,
      referrer: hosted ? '' : source.referrer,
      referrerPolicy: hosted ? 'no-referrer' : source.referrerPolicy,
    };
    if ('priority' in source) options.priority = source.priority;
    let failure;
    try {
      const response = await nativeFetch(url(path), options);
      if (![502, 503, 504, 530].includes(response.status) || !hosted) return response;
      failure = new Error('Соединение с Mac прервалось.');
    } catch (error) {
      if (source.signal.aborted || !hosted) throw error;
      failure = error;
    }
    try { await abortable(reconnect(true), source.signal); }
    catch (_) {
      if (source.signal.aborted) throw source.signal.reason || new DOMException('Aborted', 'AbortError');
      throw failure;
    }
    if (source.signal.aborted) throw source.signal.reason || new DOMException('Aborted', 'AbortError');
    // A write may already have reached the Mac. Never repeat an upload or mutation here.
    if (safe) return nativeFetch(url(path), options);
    const error = new Error('Не удалось подтвердить отправку. Проверьте, появился ли результат, прежде чем отправлять ещё раз.');
    error.name = 'TrainerAmbiguousRequestError';
    throw error;
  }

  function abortable(promise, signal) {
    if (signal.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
      const aborted = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', aborted, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    });
  }

  window.TrainerConnection = Object.freeze({
    readyPromise, request, url, getKey: () => key, getBase: () => base,
    reconnect, setKey, isHosted: hosted, namespace, normalizeEndpoint,
  });
  const start = () => {
    connectAndReady(false);
    if (hosted && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('online', () => connectAndReady(true));
  window.addEventListener('hashchange', () => {
    const incoming = location.hash.slice(1).split('~');
    if (!validKey(incoming[0])) return;
    const nextKey = incoming[0], route = safeRoute(incoming[1]);
    if (nextKey !== key) {
      key = nextKey; write(KEY_STORE, key);
      if (hosted) {
        history.replaceState(null, '', location.pathname + location.search + '#' + route);
        location.reload();
      } else location.href = location.origin + '/u/' + encodeURIComponent(key) + '/#' + route;
    } else history.replaceState(null, '', location.pathname + location.search + '#' + route);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastDiscovery > 60000) connectAndReady(true);
  });
  if (hosted) setInterval(() => {
    if (ready && !document.hidden && Date.now() - lastDiscovery > 60000) reconnect(true).catch(() => {});
  }, 60000);
})();
