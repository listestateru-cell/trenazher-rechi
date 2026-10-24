/* Личные черновики. Только IndexedDB устройства; service worker их не кеширует. */
(function () {
  'use strict';
  const memory = new Map();
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
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить черновик'));
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
    if (cached && expectedRequestId && cached.requestId !== expectedRequestId) return;
    memory.delete(full);
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        const request = store.get(full);
        request.onsuccess = () => {
          if (!expectedRequestId || request.result && request.result.requestId === expectedRequestId) store.delete(full);
        };
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } catch (_) { /* память очищена */ }
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
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error);
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
    return put(id, { kind: 'audio', path, blob, headers, requestId: requestId || uuid(),
      route: context.route || location.hash, label: /\/thoughts\//.test(path) ? 'Ваша новая формулировка' : 'Запись упражнения' }, context.profile || profile());
  }
  function textKey(id) { return 'speech-trainer.text.v1|' + key(id); }
  function getText(id) {
    try { return JSON.parse(localStorage.getItem(textKey(id)) || 'null'); } catch (_) { return null; }
  }
  function setText(id, value) {
    try { localStorage.setItem(textKey(id), JSON.stringify(value)); } catch (_) { /* поле остаётся на экране */ }
  }
  function removeText(id) { try { localStorage.removeItem(textKey(id)); } catch (_) {} }
  window.TrainerDrafts = { get, put, remove, list, operation, audio, getText, setText, removeText, uuid, profile, context: () => ({ profile: profile(), route: location.hash }) };
})();
