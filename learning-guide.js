/* Короткие примеры учебных упражнений. Все действия внутри окна показательные:
   плеер не записывает микрофон, не отправляет ответы и не меняет прогресс. */
(function () {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  let serial = 0;
  let active = null;

  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function svg(tag, attrs, ...children) {
    const el = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, value);
    el.append(...children);
    return el;
  }
  function icon(name) {
    const paths = {
      play: 'M9 5 19 12 9 19Z',
      pause: 'M8 5V19M16 5V19',
      close: 'M6 6 18 18M18 6 6 18',
      back: 'M14 6 8 12 14 18',
      next: 'M10 6 16 12 10 18',
      replay: 'M5 8a8 8 0 1 1-1 7M5 3V9H11',
      sound: 'M11 4 6 8H3V16H6L11 20ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
      mute: 'M11 4 6 8H3V16H6L11 20ZM16 9 22 15M22 9 16 15',
      check: 'M5 12 10 17 20 6',
    };
    return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      svg('path', { d: paths[name] || paths.play }));
  }
  function button(label, cls, onClick, symbol) {
    const el = node('button', cls);
    el.type = 'button';
    if (symbol) el.append(icon(symbol));
    if (label) el.append(node('span', '', label));
    if (onClick) el.addEventListener('click', onClick);
    return el;
  }
  function actor(learner) {
    return svg('svg', { viewBox: '0 0 190 240', 'aria-hidden': 'true', class: `guide-person ${learner ? 'guide-learner' : 'guide-coach'}` },
      svg('ellipse', { class: 'guide-person-shadow', cx: '92', cy: '224', rx: '60', ry: '7' }),
      svg('g', { class: 'guide-person-body' },
        svg('path', { class: 'guide-person-ink', d: 'M71 180 62 221H81L93 184 102 221H122L113 177ZM61 116Q50 132 45 165L62 171 75 139ZM113 115Q130 121 139 144L155 127 164 136Q145 177 128 164L110 140Z' }),
        svg('path', { class: 'guide-person-shirt', d: 'M72 107Q93 99 114 108L122 181Q91 194 61 179L64 126Z' }),
        svg('rect', { class: 'guide-person-face', x: '81', y: '86', width: '24', height: '28', rx: '9' }),
        svg('ellipse', { class: 'guide-person-face', cx: '92', cy: '65', rx: '35', ry: '41' }),
        svg('path', { class: 'guide-person-ink', d: learner ? 'M58 58Q44 22 73 16Q112 3 127 39L127 62 113 39Q93 53 58 58Z' : 'M57 58Q44 16 83 13Q127 9 128 57L113 44Q89 46 76 31L65 59Z' }),
        svg('path', { class: 'guide-person-feature', d: 'M75 63H78M103 63H106M90 68 87 78H94' }),
        svg('path', { class: 'guide-person-mouth', d: 'M82 88Q92 95 102 87' }),
        svg('path', { class: 'guide-person-accent', d: learner ? 'M73 112 92 124 111 111 107 136 78 134Z' : 'M68 111 90 123 116 111 110 131 86 134 76 123 70 148 61 144Z' }),
        svg('path', { class: 'guide-person-feature', d: 'M66 222H83M101 222H124M151 129 158 119M157 132 166 124' })
      ));
  }
  function labelled(label, text, cls) {
    const el = node('div', `guide-example ${cls || ''}`);
    el.append(node('div', 'guide-example-label', label), node('p', 'guide-example-text', text));
    return el;
  }
  function shownAnswer(text) {
    const el = node('div', 'guide-example guide-answer');
    const line = node('p', 'guide-example-text');
    const words = String(text).split(/(\s+)/);
    words.forEach((word, i) => {
      const piece = node('span', 'guide-written', word);
      piece.style.setProperty('--guide-order', Math.min(i, 40));
      line.append(piece);
    });
    line.append(node('span', 'guide-caret', '|'));
    el.append(node('div', 'guide-example-label', 'Пишем или говорим свой вариант'), line);
    const submit = node('div', 'guide-demo-submit', 'Отправить тренеру');
    submit.setAttribute('aria-hidden', 'true');
    submit.append(svg('svg', { class: 'guide-demo-pointer', viewBox: '0 0 28 36' },
      svg('path', { d: 'M4 2 24 19 15 20 12 31 4 2Z' })));
    el.append(submit);
    return el;
  }

  window.createLearningGuide = function (kind, options) {
    options = options || {};
    const content = (window.LEARNING_GUIDES || {})[kind];
    const el = node('section', 'guide-entry');
    if (!content || !Array.isArray(content.scenes) || !content.scenes.length) return { el, destroy() {} };
    const id = `learning-guide-${++serial}`;
    const scenes = content.scenes;
    const base = new URL('./', location.href);
    const entryText = node('div', 'guide-entry-text');
    entryText.append(node('p', 'guide-entry-title', 'Как выполнять упражнение'),
      node('p', 'guide-entry-description', 'Посмотрите короткий пример: от первой фразы до задания на другую тему.'));
    const trigger = button('Показать на примере', 'btn quiet guide-open', open, 'play');
    const entryStatus = node('p', 'guide-entry-status');
    entryStatus.setAttribute('role', 'status');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', id);
    el.append(entryText, trigger, entryStatus);

    let dialog = null, audio = null, voice = null, timer = 0, tickAt = 0;
    let index = 0, elapsed = 0, duration = 9, playing = false, muted = false;
    let audioReady = false, usingClock = false, ended = false, generation = 0, loadStarted = 0;
    let oldFocus = null, oldOverflow = '', destroyed = false;
    let stage, title, caption, step, toggle, sound, previous, next, progress, track, status, chapters;

    function clearClock() { if (timer) clearInterval(timer); timer = 0; }
    function stopMedia() {
      clearClock();
      if (audio) {
        audio.pause();
        audio.onloadedmetadata = null; audio.onended = null; audio.onerror = null;
        audio.removeAttribute('src'); audio.load(); audio = null;
      }
      audioReady = false;
    }
    function update() {
      if (!dialog) return;
      toggle.replaceChildren(icon(ended ? 'replay' : playing ? 'pause' : 'play'),
        node('span', '', ended ? 'Ещё раз' : playing ? 'Пауза' : 'Продолжить'));
      sound.replaceChildren(icon(muted ? 'mute' : 'sound'));
      sound.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
      sound.setAttribute('aria-pressed', String(!muted));
      sound.title = muted ? 'Включить звук' : 'Выключить звук';
      dialog.classList.toggle('guide-playing', playing);
      previous.disabled = index === 0;
      next.replaceChildren(node('span', '', index === scenes.length - 1 ? 'К своему заданию' : 'Дальше'), icon('next'));
      step.textContent = `${index + 1} из ${scenes.length}`;
      const ratio = Math.min(1, elapsed / Math.max(duration, 0.1));
      progress.style.transform = `scaleX(${(index + ratio) / scenes.length})`;
      track.setAttribute('aria-valuenow', String(Math.round((index + ratio) / scenes.length * 100)));
      track.setAttribute('aria-valuetext', `Шаг ${index + 1} из ${scenes.length}: ${scenes[index].title}`);
      chapters.forEach((b, i) => {
        b.classList.toggle('guide-chapter-current', i === index);
        b.classList.toggle('guide-chapter-done', i < index);
        if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
    }
    function clock() {
      clearClock(); tickAt = performance.now();
      timer = setInterval(() => {
        const now = performance.now();
        if (usingClock) elapsed += (now - tickAt) / 1000;
        else if (audio && audioReady) elapsed = audio.currentTime;
        else if (audio && now - loadStarted > 5000) fallback(true);
        tickAt = now; update();
        if (usingClock && elapsed >= duration) advance();
      }, 120);
    }
    function fallback(message) {
      if (!dialog) return;
      usingClock = true;
      if (audio) audio.pause();
      if (message) status.textContent = 'Озвучка недоступна. Пример продолжается с подписями.';
      if (playing) clock();
    }
    function start() {
      if (!dialog || destroyed) return;
      if (ended) { show(0, true); return; }
      playing = true;
      if (audio && !usingClock) {
        loadStarted = performance.now();
        const expected = generation;
        audio.muted = muted;
        const play = audio.play();
        if (play && play.catch) play.catch(() => { if (expected === generation && playing) fallback(true); });
      }
      clock(); update();
    }
    function pause() {
      playing = false; clearClock();
      if (audio) audio.pause();
      update();
    }
    function advance() {
      if (!dialog || !playing) return;
      if (index + 1 < scenes.length) show(index + 1, true);
      else { elapsed = duration; ended = true; pause(); status.textContent = 'Пример закончился. Теперь попробуйте на своей теме.'; }
    }
    function renderScene(scene) {
      const data = scene.data || {};
      const illustration = node('div', 'guide-actors');
      const coach = node('div', 'guide-character guide-character-coach');
      coach.append(actor(false), node('span', 'guide-character-name', 'Тренер'));
      const learner = node('div', 'guide-character guide-character-learner');
      learner.append(actor(true), node('span', 'guide-character-name', 'Ученик'));
      illustration.append(coach, learner);
      const board = node('div', `guide-board guide-visual-${scene.visual || 'intro'}`);
      board.append(node('p', 'guide-scene-kicker', `Шаг ${index + 1}`), node('h3', 'guide-scene-title', scene.title));
      if (data.source) board.append(labelled(scene.visual === 'source' ? 'Исходная фраза' : 'В примере', data.source, 'guide-source'));
      if (Array.isArray(data.options) && data.options.length) {
        const list = node('div', 'guide-options');
        data.options.forEach((item, i) => {
          const row = node('div', 'guide-option');
          row.style.setProperty('--guide-order', i);
          row.append(node('span', 'guide-option-number', String(i + 1)),
            node('div', 'guide-option-copy'));
          row.lastChild.append(node('strong', '', item.label || ''), node('p', '', item.detail || ''));
          list.append(row);
        });
        board.append(list);
      }
      if (data.answer) board.append(shownAnswer(data.answer));
      if (data.feedback) {
        const feedback = labelled('Ответ тренера', data.feedback, 'guide-feedback');
        feedback.firstChild.prepend(icon('check'));
        board.append(feedback);
      }
      if (data.topic) board.append(labelled('Другая тема для самостоятельной попытки', data.topic, 'guide-new-topic'));
      if (!data.source && !data.answer && !data.feedback && !data.topic && !(data.options || []).length) {
        const cue = node('div', 'guide-intro-cue');
        cue.append(node('span', 'guide-intro-mark', 'А'),
          icon('next'), node('span', 'guide-intro-mark guide-intro-mark-after', 'А′'));
        board.append(cue, node('p', 'guide-intro-caption', scene.caption));
      }
      stage.dataset.visual = scene.visual || 'intro';
      stage.replaceChildren(illustration, board);
    }
    function show(i, play) {
      if (!dialog) return;
      generation++; stopMedia();
      index = Math.max(0, Math.min(i, scenes.length - 1));
      const scene = scenes[index];
      elapsed = 0; ended = false; playing = false; usingClock = !scene.audio;
      duration = Number(scene.duration) || Math.max(6, String(scene.narration || scene.caption || '').split(/\s+/).length / 2.35 + 1.5);
      title.textContent = content.title;
      caption.textContent = scene.narration || scene.caption || '';
      status.textContent = '';
      renderScene(scene);
      if (scene.audio) {
        // Один элемент сохраняет разрешение на звук между главами на мобильных браузерах.
        if (!voice) voice = new Audio();
        audio = voice; audio.preload = 'auto'; audio.muted = muted;
        const expected = generation;
        audio.onloadedmetadata = () => {
          if (generation !== expected || !dialog) return;
          audioReady = true;
          if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
          update();
        };
        audio.onended = () => { if (generation === expected) advance(); };
        audio.onerror = () => { if (generation === expected) fallback(true); };
        audio.src = new URL(String(scene.audio).replace(/^\//, ''), base).href;
      }
      update();
      if (play) start();
    }
    function close(notify) {
      if (!dialog) return;
      generation++; playing = false; stopMedia();
      const old = dialog; dialog = null;
      old.close(); old.remove();
      document.body.style.overflow = oldOverflow;
      if (active === close) active = null;
      if (oldFocus && oldFocus.isConnected) oldFocus.focus({ preventScroll: true });
      if (notify !== false && typeof options.onClose === 'function') options.onClose();
    }
    function open() {
      if (destroyed || dialog) return;
      if (typeof options.canOpen === 'function' && !options.canOpen()) {
        entryStatus.textContent = 'Сначала закончите запись, затем откройте пример.';
        return;
      }
      entryStatus.textContent = '';
      if (active) active(false);
      active = close;
      oldFocus = document.activeElement;
      oldOverflow = document.body.style.overflow;
      dialog = node('dialog', 'guide-dialog'); dialog.id = id;
      dialog.setAttribute('aria-labelledby', `${id}-title`);
      const shell = node('div', 'guide-shell');
      const head = node('header', 'guide-header');
      const heading = node('div');
      title = node('h2', 'guide-title'); title.id = `${id}-title`;
      heading.append(node('p', 'guide-eyebrow', 'Смотрим, как это работает'), title);
      const dismiss = button('', 'guide-icon-button', () => close(), 'close');
      dismiss.setAttribute('aria-label', 'Закрыть пример');
      head.append(heading, dismiss);
      stage = node('div', 'guide-stage');
      stage.tabIndex = 0;
      stage.setAttribute('aria-label', 'Показательный пример. Пробел — пауза; стрелки — сменить шаг.');
      const subtitles = node('div', 'guide-subtitles');
      caption = node('p', 'guide-caption');
      subtitles.append(caption);
      track = node('div', 'guide-progress');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', 'Ход примера');
      track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
      progress = node('div', 'guide-progress-fill'); track.append(progress);
      const controls = node('div', 'guide-controls');
      previous = button('', 'guide-icon-button', () => show(index - 1, playing), 'back');
      previous.setAttribute('aria-label', 'Предыдущий шаг');
      toggle = button('', 'btn guide-toggle', () => playing ? pause() : start());
      next = button('Дальше', 'btn ghost guide-next', () => index === scenes.length - 1 ? close() : show(index + 1, playing), 'next');
      step = node('span', 'guide-step');
      sound = button('', 'guide-icon-button guide-sound', () => { muted = !muted; if (audio) audio.muted = muted; update(); });
      controls.append(previous, toggle, next, step, sound);
      const chapterList = node('nav', 'guide-chapters');
      chapterList.setAttribute('aria-label', 'Шаги примера');
      chapters = scenes.map((scene, i) => {
        const b = button(String(i + 1), 'guide-chapter', () => show(i, playing));
        b.setAttribute('aria-label', `Шаг ${i + 1}: ${scene.title}`);
        b.title = scene.title; chapterList.append(b); return b;
      });
      status = node('p', 'guide-status'); status.setAttribute('role', 'status');
      const note = node('p', 'guide-note', 'Это разобранный пример. В вашем задании будет другая тема.');
      shell.append(head, stage, subtitles, track, controls, chapterList, status, note);
      dialog.append(shell); document.body.append(dialog);
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      });
      dialog.addEventListener('keydown', (event) => {
        if (event.target.closest('button, a, input, textarea, select')) return;
        if (event.key === ' ') { event.preventDefault(); playing ? pause() : start(); }
        if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); show(index - 1, playing); }
        if (event.key === 'ArrowRight' && index < scenes.length - 1) { event.preventDefault(); show(index + 1, playing); }
      });
      document.body.style.overflow = 'hidden';
      dialog.showModal(); show(0, true); dismiss.focus({ preventScroll: true });
    }
    const pageHidden = () => { if (document.hidden && playing) pause(); };
    const routeChanged = () => close(false);
    document.addEventListener('visibilitychange', pageHidden);
    window.addEventListener('hashchange', routeChanged);
    return {
      el,
      destroy() {
        destroyed = true; close(false);
        voice = null;
        document.removeEventListener('visibilitychange', pageHidden);
        window.removeEventListener('hashchange', routeChanged);
      },
    };
  };
}());
