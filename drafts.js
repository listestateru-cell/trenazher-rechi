/* Личные черновики. Только IndexedDB устройства; service worker их не кеширует. */
(function () {
  'use strict';
  const memory = new Map();
  const activeRecordings = new Set();
  let database;
  const connection = () => window.TrainerConnection;
  function profile() {
    const c = connection();
    return (c && c.namespace || location.pathname) + '|' + (c && c.getKey() || 'local-owner');
  }
  const key = (id, owner = profile()) => owner + '|' + id;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB недоступна')); return; }
      const request = indexedDB.open('speech-trainer-drafts-v1', 1);
      let settled = false;
      const timer = typeof setTimeout === 'function' ? setTimeout(() => {
        settled = true; reject(new Error('IndexedDB не ответила вовремя'));
      }, 3000) : null;
      const finish = () => { if (timer !== null) clearTimeout(timer); };
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
      request.onsuccess = () => {
        finish();
        if (settled) { request.result.close(); return; }
        settled = true; resolve(request.result);
      };
      request.onerror = request.onblocked = () => { finish(); settled = true; reject(request.error || new Error('IndexedDB заблокирована')); };
    });
    return database;
  }
  function monitor(tx, resolve, reject) {
    const timer = typeof setTimeout === 'function' ? setTimeout(() => {
      try { tx.abort(); } catch (_) {}
      reject(new Error('Хранилище не ответило вовремя'));
    }, 3000) : null;
    const finish = () => { if (timer !== null) clearTimeout(timer); };
    tx.oncomplete = () => { finish(); resolve(); };
    tx.onerror = tx.onabort = () => { finish(); reject(tx.error || new Error('Не удалось сохранить черновик')); };
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = action(tx.objectStore('drafts'));
      monitor(tx, () => resolve(request.result), reject);
    });
  }
  function changed() { window.dispatchEvent(new Event('trainer:draftschange')); }
  async function get(id, owner = profile()) {
    const full = key(id, owner);
    if (memory.has(full)) return memory.get(full);
    try { return await transaction('readonly', (s) => s.get(full)); } catch (_) { return null; }
  }
  async function put(id, value, owner = profile()) {
    const record = { ...value, id, key: key(id, owner), profile: owner, updated: Date.now(), durable: true };
    memory.set(record.key, record);
    try { await transaction('readwrite', (s) => s.put(record)); }
    catch (_) { record.durable = false; }
    changed();
    return record;
  }
  async function remove(id, expectedRequestId, owner = profile()) {
    const full = key(id, owner);
    const cached = memory.get(full);
    if (cached && expectedRequestId && cached.requestId !== expectedRequestId) {
      if (id.startsWith('audio:')) {
        await clearRecordingReceipts(id.slice(6), expectedRequestId, owner);
        await clearArchivedAudio(id.slice(6), expectedRequestId, owner);
      }
      return;
    }
    memory.delete(full);
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        const request = store.get(full);
        request.onsuccess = () => {
          if (!expectedRequestId || request.result && request.result.requestId === expectedRequestId) store.delete(full);
        };
        monitor(tx, resolve, reject);
      });
    } catch (_) { /* память очищена */ }
    if (id.startsWith('audio:') && expectedRequestId) {
      await clearRecordingReceipts(id.slice(6), expectedRequestId, owner);
      await clearArchivedAudio(id.slice(6), expectedRequestId, owner);
    }
    changed();
  }
  async function list() {
    let all = [];
    try { all = await transaction('readonly', (s) => s.getAll()); } catch (_) { /* приватный режим */ }
    const records = new Map(all.filter((r) => r.profile === profile()).map((r) => [r.key, r]));
    for (const r of memory.values()) if (r.profile === profile()) records.set(r.key, r);
    return [...records.values()];
  }
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  async function operation(method, path, body, headers) {
    const owner = profile();
    const data = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : new TextEncoder().encode(String(body || ''));
    const prefix = new TextEncoder().encode(method + '\n' + path + '\n' + JSON.stringify(Object.entries(headers).sort()) + '\n');
    const combined = new Uint8Array(prefix.length + data.length);
    combined.set(prefix); combined.set(data, prefix.length);
    const digest = await crypto.subtle.digest('SHA-256', combined);
    const id = 'request:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    const full = key(id, owner);
    const proposed = { kind: 'request', requestId: uuid(), id, key: full, profile: owner, updated: Date.now(), durable: true };
    try {
      const db = await open();
      const claimed = await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        let result;
        const request = store.get(full);
        request.onsuccess = () => { result = request.result || proposed; if (!request.result) store.put(result); };
        monitor(tx, () => resolve(result), reject);
      });
      memory.set(full, claimed);
      return claimed;
    } catch (_) {
      const result = memory.get(full) || { ...proposed, durable: false };
      memory.set(full, result);
      return result;
    }
  }
  async function audio(path, blob, headers = {}, requestId, context = {}) {
    const id = 'audio:' + path;
    const value = { kind: 'audio', path, blob, headers, requestId: requestId || uuid(),
      route: context.route || location.hash, label: /\/thoughts\//.test(path) ? 'Ваша новая формулировка' : 'Запись упражнения',
      ...(context.recordingId ? { recordingId: context.recordingId, incomplete: context.incomplete === true } : {}) };
    const owner = context.profile || profile();
    if (!context.recordingId) return put(id, value, owner);
    const record = { ...value, id, key: key(id, owner), profile: owner, updated: Date.now(), durable: true };
    const copies = [];
    function archive(previous) {
      if (!previous || previous.kind !== 'audio' || previous.requestId === record.requestId) return;
      const copyId = 'audio-copy:' + previous.requestId;
      const copy = { ...previous, id: copyId, key: key(copyId, owner), label: previous.label + ' · другая копия' };
      memory.set(copy.key, copy); copies.push(copy);
      return copy;
    }
    archive(memory.get(record.key));
    memory.set(record.key, record);
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        monitor(tx, resolve, reject);
        const read = store.get(record.key);
        read.onsuccess = () => {
          try {
            const copy = archive(read.result);
            if (copy) store.put(copy);
            store.put(record);
          } catch (error) { try { tx.abort(); } catch (_) {} reject(error); }
        };
      });
    } catch (_) {
      record.durable = false;
      for (const copy of copies) copy.durable = false;
    }
    changed();
    return record;
  }
  async function clearArchivedAudio(path, requestId, owner) {
    const copies = new Map((await recordingRows(owner)).map(row => [row.key, row]));
    for (const row of memory.values()) if (row.profile === owner) copies.set(row.key, row);
    for (const row of copies.values()) if (row.kind === 'audio' && row.id.startsWith('audio-copy:') && row.path === path && row.requestId === requestId) {
      await remove(row.id, requestId, owner);
    }
  }

  function recordingTarget(path) {
    const lesson = /^\/api\/sessions\/([a-zA-Z0-9_-]{1,100})\/lesson\/audio\?stage=([0-2])$/.exec(path || '');
    if (lesson) return { sessionId: lesson[1], takeIndex: null, thoughtId: null, lessonStage: Number(lesson[2]) };
    const match = /^\/api\/sessions\/([a-zA-Z0-9_-]{1,100})\/(?:takes\/(\d{1,4})|thoughts\/([a-zA-Z0-9_-]{1,100})\/audio)$/.exec(path || '');
    return match ? { sessionId: match[1], takeIndex: match[2] == null ? null : Number(match[2]), thoughtId: match[3] || null } : null;
  }
  async function writeRecording(metadata, chunk) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
      monitor(tx, resolve, reject);
      try {
        store.put(metadata);
        if (chunk) store.put(chunk);
      } catch (error) {
        try { tx.abort(); } catch (_) {}
        reject(error);
      }
    });
  }
  async function removeRecording(id, expectedRequestId, owner = profile()) {
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        const read = store.get(key(id, owner));
        read.onsuccess = () => {
          const record = read.result;
          if (!record || record.kind !== 'recording' || expectedRequestId && record.requestId !== expectedRequestId) return;
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            const row = item.value;
            if (row.profile === owner && (row.id === id || row.kind === 'recording-chunk' && row.recordingId === id)) item.delete();
            item.continue();
          };
        };
        monitor(tx, resolve, reject);
      });
      changed();
      return true;
    } catch (_) { return false; }
  }
  async function recordingRows(owner) {
    try { return (await transaction('readonly', store => store.getAll())).filter(row => row.profile === owner); }
    catch (_) { return []; }
  }
  async function clearRecordingReceipts(path, requestId, owner) {
    const rows = await recordingRows(owner);
    for (const row of rows) if (row.kind === 'recording' && row.path === path && row.requestId === requestId) {
      await removeRecording(row.id, requestId, owner);
    }
  }
  async function recordings() {
    const owner = profile(), rows = await recordingRows(owner);
    const completed = new Set(rows.filter(row => row.kind === 'audio' && row.recordingId).map(row => row.recordingId + '|' + row.requestId));
    return rows.filter(row => row.kind === 'recording' && recordingTarget(row.path) && row.chunkCount > 0
      && !activeRecordings.has(row.key) && !completed.has(row.id + '|' + row.requestId))
      .map(row => ({ ...row, incomplete: true, playback: 'unverified', mayBeActive: row.state !== 'interrupted' && Date.now() - row.updated < 5000 }));
  }
  async function recoverRecording(id) {
    const owner = profile(), rows = await recordingRows(owner);
    const metadata = rows.find(row => row.id === id && row.key === key(id, owner) && row.kind === 'recording');
    if (!metadata || !recordingTarget(metadata.path) || activeRecordings.has(metadata.key)) return null;
    const parts = new Map(rows.filter(row => row.kind === 'recording-chunk' && row.recordingId === id).map(row => [row.sequence, row]));
    const chunks = [];
    // После разрыва последовательности поздние части не склеиваем: в них может не быть заголовка контейнера.
    for (let index = 0; index < metadata.chunkCount; index++) {
      const row = parts.get(index);
      if (!row || !(row.blob instanceof Blob) || !row.blob.size) break;
      chunks.push(row.blob);
    }
    if (!chunks.length) return null;
    const blob = new Blob(chunks, { type: metadata.mimeType || chunks[0].type || 'application/octet-stream' });
    return { ...metadata, blob, chunkCount: chunks.length, byteLength: blob.size, incomplete: true,
      playback: 'unverified', mayBeActive: metadata.state !== 'interrupted' && Date.now() - metadata.updated < 5000,
      label: 'Восстановлена незавершённая запись',
      notice: 'Восстановлена незавершённая запись. Сохранились только подтверждённые части; конец мог потеряться. Браузер мог не завершить аудиофайл, поэтому воспроизведение нужно проверить.' };
  }
  async function prepareRecovery(id, originalRequestId, claim, headers = {}, owner = profile()) {
    let result = { requestId: claim.requestId, fingerprint: claim.id, headers, durable: false };
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        const read = store.get(key(id, owner));
        read.onsuccess = () => {
          const record = read.result;
          if (!record || record.kind !== 'recording' || record.requestId !== originalRequestId) return;
          const prior = record.recoveryRequest;
          result = { requestId: prior && prior.fingerprint === claim.id ? prior.requestId : claim.requestId,
            fingerprint: claim.id, headers, durable: true };
          store.put({ ...record, recoveryRequest: result });
        };
        monitor(tx, resolve, reject);
      });
    } catch (_) { result.durable = false; }
    return result;
  }
  function beginRecording(options = {}) {
    const context = { profile: options.context && options.context.profile || profile(),
      route: options.context && options.context.route || location.hash };
    const id = 'recording:' + uuid(), requestId = uuid(), target = recordingTarget(options.path);
    const metadata = { kind: 'recording', id, key: key(id, context.profile), profile: context.profile,
      path: options.path, route: context.route, requestId, ...(target || {}), userId: options.userId ?? null,
      headers: { ...(options.headers || {}) }, mimeType: options.mimeType || '', chunkCount: 0, byteLength: 0,
      created: Date.now(), updated: Date.now(), durable: true };
    let failed = !target, closed = false, discarded = false, sequence = 0, finishPromise;
    activeRecordings.add(metadata.key);
    function status() {
      const result = { durable: !failed && !discarded, closed, discarded, chunkCount: metadata.chunkCount, byteLength: metadata.byteLength,
        notice: failed ? 'Не удалось сохранить резервную копию на устройстве. Текущая запись продолжается; не закрывайте страницу до отправки.' : '' };
      try { if (options.onStatus) options.onStatus(result); } catch (_) {}
      return result;
    }
    let queue = (async () => {
      if (!target) return status();
      try { await writeRecording({ ...metadata }); } catch (_) { failed = true; }
      return status();
    })();
    const ready = queue;
    function append(blob) {
      if (closed || !(blob instanceof Blob) || !blob.size) return Promise.resolve(status());
      const index = sequence++;
      queue = queue.then(async () => {
        if (failed || discarded) return status();
        const next = { ...metadata, chunkCount: index + 1, byteLength: metadata.byteLength + blob.size, updated: Date.now(),
          mimeType: metadata.mimeType || blob.type || '' };
        const chunkId = id + ':chunk:' + index;
        const chunk = { kind: 'recording-chunk', id: chunkId, key: key(chunkId, context.profile), profile: context.profile,
          recordingId: id, sequence: index, blob, updated: next.updated };
        try {
          await writeRecording(next, chunk);
          Object.assign(metadata, next);
        } catch (_) { failed = true; }
        return status();
      });
      return queue;
    }
    function finish(blob, extra = {}) {
      if (finishPromise) return finishPromise;
      closed = true;
      finishPromise = (async () => {
        await queue;
        if (discarded || !(blob instanceof Blob) || !blob.size || !target) return null;
        const saved = await audio(metadata.path, blob, { ...metadata.headers, ...(extra.headers || {}) }, requestId,
          { ...context, recordingId: id });
        // Сначала полный файл подтверждён IndexedDB, затем можно удалить его частичный резерв.
        if (saved.durable) await removeRecording(id, requestId, context.profile);
        return saved;
      })().finally(() => { activeRecordings.delete(metadata.key); changed(); });
      return finishPromise;
    }
    async function discard() {
      closed = true; discarded = true;
      await queue;
      if (finishPromise) {
        try { await finishPromise; } catch (_) {}
        await remove('audio:' + metadata.path, requestId, context.profile);
      }
      activeRecordings.delete(metadata.key);
      return removeRecording(id, requestId, context.profile);
    }
    async function seal() {
      closed = true;
      await queue;
      if (!failed && !discarded) {
        try { await writeRecording({ ...metadata, state: 'interrupted', updated: Date.now() }); }
        catch (_) { failed = true; }
      }
      activeRecordings.delete(metadata.key);
      changed();
      return status();
    }
    return { id, requestId, context, ready, append, finish, discard, seal, flush: () => queue };
  }
  function textKey(id) { return 'speech-trainer.text.v1|' + key(id); }
  function getText(id) {
    try { return JSON.parse(localStorage.getItem(textKey(id)) || 'null'); } catch (_) { return null; }
  }
  function setText(id, value) {
    try { localStorage.setItem(textKey(id), JSON.stringify(value)); } catch (_) { /* поле остаётся на экране */ }
  }
  function removeText(id) { try { localStorage.removeItem(textKey(id)); } catch (_) {} }
  window.TrainerDrafts = { get, put, remove, list, operation, audio, getText, setText, removeText, uuid, profile,
    beginRecording, recordings, recoverRecording, prepareRecovery, removeRecording, context: () => ({ profile: profile(), route: location.hash }) };
})();
