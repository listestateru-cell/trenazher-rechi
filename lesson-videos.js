// Ролики-уроки: короткое видео «как выполнять» на каждый шаг упражнения, снятое с настоящего экрана.
// Сами файлы лежат на сервере в /lessons/ (их туда кладёт tools/server/deploy.sh) и в оболочку не входят:
// они тяжёлые, и сервис-воркер не должен качать их заранее каждому.
(function () {
  'use strict';

  const LESSONS = {
    sprint: [['sprint-1', 51], ['sprint-2', 55]],
    explain: [['explain-1', 42], ['explain-2', 37], ['explain-3', 46]],
    duel: [['duel-1', 42], ['duel-2', 36], ['duel-3', 47]],
    compress: [['compress-1', 40], ['compress-2', 36], ['compress-3', 46]],
    minute: [['minute', 63]],
  };

  function mediaBase() {
    const config = window.TRAINER_CONNECTION_CONFIG || {};
    const hosts = Array.isArray(config.endpointHosts) ? config.endpointHosts : [];
    if (hosts.includes(location.hostname)) return location.origin + '/lessons/';
    // Прежняя оболочка на GitHub Pages берёт ролики с того же сервера.
    return hosts.length ? 'https://' + hosts[0] + '/lessons/' : '';
  }

  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const clock = (seconds) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

  window.createLessonVideo = function (exerciseId, options) {
    const lessons = LESSONS[exerciseId];
    const base = mediaBase();
    if (!lessons || !base) return null;
    options = options || {};
    const labels = Array.isArray(options.labels) ? options.labels : [];
    const many = lessons.length > 1;
    let step = 0, dialog = null, video = null, tabs = [], destroyed = false;

    const el = node('section', 'lesson-video');
    const open = node('button', 'lesson-video-open');
    open.type = 'button';
    const thumb = node('span', 'lesson-video-thumb');
    const badge = node('span', 'lesson-video-play');
    badge.innerHTML = PLAY;
    thumb.append(badge);
    const text = node('span', 'lesson-video-text');
    const title = node('span', 'lesson-video-title');
    const note = node('span', 'lesson-video-note');
    text.append(title, note);
    open.append(thumb, text);
    el.append(open);

    const stepTitle = (index) => (many ? `Шаг ${index + 1}` + (labels[index] ? ` · ${labels[index]}` : '') : 'Всё упражнение');

    function paint() {
      const [name, seconds] = lessons[step];
      thumb.style.backgroundImage = `url("${base}${name}.jpg")`;
      title.textContent = 'Видео: как выполнять';
      note.textContent = `${stepTitle(step)} · ${clock(seconds)}`;
      open.setAttribute('aria-label', `Смотреть видео: как выполнять. ${stepTitle(step)}, ${clock(seconds)}`);
    }

    function load(index, play) {
      step = index;
      paint();
      if (!video) return;
      const [name] = lessons[index];
      tabs.forEach((tab, i) => { tab.classList.toggle('is-active', i === index); tab.setAttribute('aria-selected', String(i === index)); });
      status.hidden = true;
      video.poster = `${base}${name}.jpg`;
      video.src = `${base}${name}.mp4`;
      if (play) video.play().catch(() => {});
    }

    let status = null;
    function build() {
      dialog = node('dialog', 'lesson-video-dialog');
      dialog.setAttribute('aria-label', 'Видео: как выполнять упражнение');
      const bar = node('div', 'lesson-video-bar');
      const heading = node('p', 'lesson-video-heading', 'Как выполнять');
      const close = node('button', 'lesson-video-close', 'Закрыть');
      close.type = 'button';
      close.addEventListener('click', () => dialog.close());
      bar.append(heading, close);
      dialog.append(bar);
      if (many) {
        const row = node('div', 'lesson-video-tabs');
        row.setAttribute('role', 'tablist');
        tabs = lessons.map((_, index) => {
          const tab = node('button', 'lesson-video-tab', `Шаг ${index + 1}`);
          tab.type = 'button';
          tab.setAttribute('role', 'tab');
          tab.addEventListener('click', () => load(index, true));
          row.append(tab);
          return tab;
        });
        dialog.append(row);
      }
      video = node('video', 'lesson-video-player');
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.preload = 'metadata';
      status = node('p', 'lesson-video-status', 'Не удалось загрузить видео. Проверьте интернет и попробуйте ещё раз.');
      status.hidden = true;
      video.addEventListener('error', () => { status.hidden = false; });
      // Следующий шаг сам не включается: человек сначала делает свой.
      dialog.append(video, status);
      dialog.addEventListener('close', () => { video.pause(); });
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      document.body.append(dialog);
    }

    open.addEventListener('click', () => {
      if (destroyed) return;
      if (!dialog) build();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      load(step, true);
    });

    // Сцена упражнения сообщает режим в data-mode. На подготовке и записи ролик замолкает, чтобы его звук
    // не попал в запись; между попытками карточка переключается на ролик следующего шага.
    let watcher = null;
    function follow() {
      const mode = options.stage && options.stage.dataset ? options.stage.dataset.mode : '';
      if (mode === 'prep' || mode === 'rec') api.pause();
      else if (typeof options.currentStep === 'function') {
        let index = null;
        try { index = options.currentStep(); } catch (_) { index = null; }
        if (index != null) api.setStep(index);
      }
    }
    if (options.stage && typeof MutationObserver === 'function') {
      watcher = new MutationObserver(follow);
      watcher.observe(options.stage, { attributes: true, attributeFilter: ['data-mode'] });
    }

    paint();
    const api = {
      el,
      setStep(index) {
        if (!Number.isInteger(index) || index < 0 || index >= lessons.length || index === step) return;
        if (dialog && dialog.open) return;  // идущий ролик не подменяем
        step = index;
        paint();
      },
      pause() { if (video) video.pause(); if (dialog && dialog.open) dialog.close(); },
      destroy() {
        destroyed = true;
        if (watcher) watcher.disconnect();
        if (video) { video.pause(); video.removeAttribute('src'); }
        if (dialog) dialog.remove();
      },
    };
    follow();
    return api;
  };
})();
