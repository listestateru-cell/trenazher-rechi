/* Мобильная компоновка и установка. Подключение к Mac и личные ключи
   остаются в TrainerConnection; этот файл не отправляет запросы и не пишет данные. */
(function () {
  'use strict';
  if (window.TrainerMobile) return;
  const root = document.documentElement;
  const narrow = matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)');
  const appMode = matchMedia('(display-mode: standalone)');
  const NS = 'http://www.w3.org/2000/svg';
  let installPrompt = null, installedHere = false, frame = 0, dialog = null;
  let returnFocus = null, previousOverflow = '', keyboardWasOpen = false;
  const paths = {
    home: 'M4 13V8M8 9V17M12 5V21M16 9V17M20 12V14',
    program: 'M7 3V7M17 3V7M4 10H20M5 5H19A1 1 0 0 1 20 6V20H4V6A1 1 0 0 1 5 5ZM8 14H10M14 14H16M8 17H10',
    history: 'M4 5V10H9M4 10A8 8 0 1 1 5 18M12 8V13L15 15',
    progress: 'M4 19H20M6 15 10 11 14 13 19 6M15 6H19V10',
    install: 'M12 3V15M8 11 12 15 16 11M4 15V21H20V15',
    close: 'M6 6 18 18M18 6 6 18',
  };
  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function icon(name) {
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', paths[name] || paths.install);
    el.append(path); return el;
  }
  function isStandalone() { return installedHere || appMode.matches || navigator.standalone === true; }
  function editable(el) {
    return !!el && el.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]),[contenteditable="true"]');
  }
  function updateViewport() {
    const body = document.body;
    if (!body) return;
    const viewport = window.visualViewport;
    const visibleHeight = viewport ? viewport.height : innerHeight;
    const layoutHeight = document.documentElement.clientHeight || innerHeight;
    const obscured = viewport ? Math.max(0, layoutHeight - viewport.height - viewport.offsetTop) : 0;
    const keyboard = narrow.matches && editable(document.activeElement) && obscured > 120 && (!viewport || viewport.scale < 1.2);
    root.style.setProperty('--trainer-mobile-visible-height', `${Math.round(visibleHeight)}px`);
    root.style.setProperty('--trainer-mobile-keyboard-offset', keyboard ? `${Math.round(obscured)}px` : '0px');
    body.classList.toggle('trainer-mobile-keyboard-open', keyboard);
    body.dataset.trainerMobile = String(narrow.matches);
    root.dataset.trainerStandalone = String(isStandalone());
    if (keyboard && !keyboardWasOpen) {
      const focused = document.activeElement;
      const box = focused.getBoundingClientRect();
      const top = viewport ? viewport.offsetTop : 0;
      if (box.top < top + 12 || box.bottom > top + visibleHeight - 16) focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }
    keyboardWasOpen = keyboard;
  }
  function enhanceNav() {
    document.querySelectorAll('.nav a[data-nav]').forEach((link) => {
      if (!link.querySelector('svg')) link.prepend(icon(link.dataset.nav));
      if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  function enhanceHome() {
    const hero = document.querySelector('#app .hero-text');
    document.querySelectorAll('.trainer-mobile-install-launch').forEach((el) => { if (!hero || !hero.contains(el) || isStandalone()) el.remove(); });
    if (!hero || isStandalone() || hero.querySelector('.trainer-mobile-install-launch')) return;
    const button = node('button', 'btn ghost trainer-mobile-install-launch');
    button.type = 'button'; button.dataset.trainerInstall = '';
    button.append(icon('install'), node('span', '', 'Добавить на экран телефона'));
    hero.append(button);
  }
  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0; updateViewport(); enhanceNav(); enhanceHome();
    });
  }
  function closeInstall() {
    if (!dialog) return;
    const previous = dialog; dialog = null;
    previous.close(); previous.remove();
    document.body.style.overflow = previousOverflow;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  function instruction(title, steps, source, sourceTitle) {
    const section = node('section', 'trainer-mobile-install-platform');
    const list = node('ol');
    steps.forEach((text) => list.append(node('li', '', text)));
    const link = node('a', 'trainer-mobile-install-source', sourceTitle);
    link.href = source; link.target = '_blank'; link.rel = 'noopener noreferrer';
    section.append(node('h3', '', title), list, link);
    return section;
  }
  function updateInstallButton() {
    if (!dialog) return;
    const native = dialog.querySelector('.trainer-mobile-install-native');
    native.hidden = !installPrompt || isStandalone();
    native.disabled = false;
  }
  function showInstall() {
    if (!document.body || isStandalone()) return null;
    if (dialog) return dialog;
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    dialog = node('dialog', 'trainer-mobile-install-dialog');
    dialog.id = 'trainer-mobile-install-dialog';
    dialog.setAttribute('aria-labelledby', 'trainer-mobile-install-title');
    const header = node('header', 'trainer-mobile-install-head');
    const title = node('h2', '', 'Тренажёр на экране телефона'); title.id = 'trainer-mobile-install-title';
    const close = node('button', 'trainer-mobile-install-close'); close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть инструкцию'); close.append(icon('close'));
    close.addEventListener('click', closeInstall); header.append(title, close);
    const intro = node('p', 'trainer-mobile-install-intro', 'Откройте свою личную ссылку в браузере и добавьте значок. Он будет открывать тренажёр как приложение.');
    const native = node('button', 'btn trainer-mobile-install-native', 'Установить тренажёр'); native.type = 'button';
    const status = node('p', 'trainer-mobile-install-status'); status.setAttribute('role', 'status');
    native.addEventListener('click', async () => {
      const prompt = installPrompt;
      if (!prompt) return;
      installPrompt = null; native.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (!dialog) return;
        if (choice && choice.outcome === 'accepted') {
          status.textContent = 'Браузер принял запрос на установку. Дождитесь завершения и откройте значок тренажёра.';
        } else status.textContent = 'Установку можно повторить через меню браузера.';
      } catch (_) {
        if (dialog) status.textContent = 'Браузер не открыл установку. Добавьте значок через его меню по инструкции ниже.';
      } finally { updateInstallButton(); }
    });
    const apple = instruction('iPhone и iPad · Safari', [
      'Откройте личную ссылку в Safari. Найдите «Поделиться»; в некоторых видах Safari она находится в меню страницы.',
      'Выберите «На экран “Домой”». Если есть переключатель «Открыть как веб-приложение», включите его.',
      'Нажмите «Добавить», затем откройте новый значок.',
    ], 'https://support.apple.com/ru-ru/guide/iphone/iph42ab2f3a7/ios', 'Инструкция Apple');
    const android = instruction('Android · Chrome', [
      'Откройте личную ссылку в Chrome и нажмите меню с тремя точками.',
      'Выберите «Установить приложение» или «Установить и создать ярлык», затем подтвердите установку. В некоторых версиях пункт называется «Добавить на главный экран».',
    ], 'https://support.google.com/chrome/answer/9658361?hl=ru&co=GENIE.Platform%3DAndroid', 'Инструкция Chrome');
    const note = node('aside', 'trainer-mobile-install-note');
    note.append(node('h3', '', 'Mac должен оставаться включённым'),
      node('p', '', 'Для распознавания речи, проверки ответов и доступа к прогрессу Mac должен быть включён и подключён к интернету. После сна восстановление связи может занять время.'),
      node('p', '', 'Без связи может открыться сохранённый интерфейс. Распознавание речи и анализ заданий офлайн не работают.'));
    dialog.append(header, intro, native, status, apple, android, note);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeInstall(); });
    const created = dialog;
    dialog.addEventListener('close', () => { if (dialog === created) closeInstall(); });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeInstall();
    });
    document.body.append(dialog); updateInstallButton();
    document.body.style.overflow = 'hidden';
    dialog.showModal(); close.focus({ preventScroll: true });
    return dialog;
  }
  function setManifest(value) {
    let target;
    try { target = new URL(value, location.href); } catch (_) { return false; }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    if ((target.protocol !== 'https:' && !(target.protocol === 'http:' && loopback)) || target.username || target.password || target.hash || !target.pathname.endsWith('/manifest.webmanifest')) return false;
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.append(link); }
    link.crossOrigin = 'anonymous'; link.href = target.href;
    return true;
  }
  window.TrainerMobile = Object.freeze({ showInstall, closeInstall, refresh, setManifest, isStandalone, updateViewport });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); installPrompt = event; updateInstallButton(); refresh();
  });
  window.addEventListener('appinstalled', () => { installedHere = true; installPrompt = null; closeInstall(); refresh(); });
  window.addEventListener('hashchange', () => { closeInstall(); refresh(); });
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('orientationchange', refresh, { passive: true });
  window.visualViewport?.addEventListener('resize', refresh, { passive: true });
  window.visualViewport?.addEventListener('scroll', refresh, { passive: true });
  narrow.addEventListener?.('change', refresh); appMode.addEventListener?.('change', refresh);
  document.addEventListener('focusin', refresh);
  document.addEventListener('focusout', () => { refresh(); setTimeout(refresh, 180); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-trainer-install]')) { event.preventDefault(); showInstall(); }
  });
  function init() {
    if (document.body && typeof MutationObserver !== 'undefined') {
      const app = document.getElementById('app');
      if (app) new MutationObserver(refresh).observe(app, { subtree: true, childList: true });
    }
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
}());
