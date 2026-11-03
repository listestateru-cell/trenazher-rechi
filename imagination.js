'use strict';
/* Темы выбирает человек. Ответы и записи не меняют его интересы. */
window.TrainerImagination = (() => {
  const title = 'Мастерская воображения';
  const endpoint = id => `/api/sessions/${encodeURIComponent(id)}`;
  const latestReview = p => [...(p.attempts || [])].reverse().find(a => a.status === 'done' && a.review);
  const mediaOf = p => (p.imagination || {}).media || null;

  function homeCard() {
    return TrainerTrainingUI.tile({ title: 'Воображение', href: '#/imagination', icon: 'imagination',
      description: 'Мастерская воображения. Фантазия и образное мышление: 13 форматов, вопросы тренера и вторая попытка.' });
  }

  async function catalog(ctx) {
    let data = await api('/api/imagination'), busy = false, destroyed = false;
    const owner = window.TrainerDrafts && TrainerDrafts.profile();
    const alive = () => !destroyed && ctx.alive() && (!owner || owner === TrainerDrafts.profile());
    const error = h('p', { class: 'thought-error', role: 'alert', hidden: true });
    const status = h('p', { class: 'small soft', role: 'status' });
    const choices = h('div', { class: 'imagination-interests' });
    const cards = h('div', { class: 'imagination-catalog' });
    const recent = h('div', { class: 'imagination-recent' });
    const root = h('section', { class: 'imagination-view' });
    const save = h('button', { type: 'submit', class: 'btn' }, 'Сохранить темы');
    const reset = h('button', { type: 'button', class: 'btn ghost', onclick: () => preferences([]) }, 'Сбросить');
    const details = h('details', { class: 'card imagination-preferences' },
      h('summary', null, 'Темы по вашим интересам'),
      h('form', { onsubmit: e => { e.preventDefault(); preferences([...choices.querySelectorAll('input:checked')].map(input => input.value)); } },
        h('p', { class: 'soft' }, 'Выберите темы, которые вам сейчас интересны. Это добровольно: без выбора остаётся весь набор заданий.'),
        h('fieldset', null, h('legend', null, 'Мои темы'), choices),
        h('p', { class: 'small soft' }, 'Сохраняем только этот выбор. Содержимое ответов не используем для подбора интересов. Здесь можно всё поменять или сбросить.'),
        h('div', { class: 'row' }, save, reset), status));

    function lock(value) {
      busy = value;
      root.querySelectorAll('button, input').forEach(button => { button.disabled = value; });
    }
    async function preferences(interests) {
      if (busy || !alive()) return;
      lock(true); error.hidden = true;
      try {
        const fresh = await api('/api/imagination/preferences', { method: 'POST', body: { interests } });
        if (!alive()) return;
        data = fresh; draw(); status.textContent = interests.length ? 'Выбранные темы сохранены.' : 'Темы сброшены. Задания снова из всего набора.';
      } catch (e) { if (alive()) { error.textContent = e.message; error.hidden = false; } }
      finally { if (alive()) lock(false); }
    }
    async function start(kind) {
      if (busy || !alive()) return;
      lock(true); error.hidden = true;
      try {
        const session = await api('/api/imagination', { method: 'POST', body: { kind } });
        if (alive()) location.hash = `#/s/${session.id}`;
      } catch (e) { if (alive()) { error.textContent = e.message; error.hidden = false; } }
      finally { if (alive()) lock(false); }
    }
    function draw() {
      const selected = (data.preferences || {}).interests || [];
      choices.replaceChildren(...(data.interests || []).map(interest => h('label', { class: 'imagination-interest' },
        h('input', { type: 'checkbox', value: interest.id, checked: selected.includes(interest.id) }), interest.title)));
      cards.replaceChildren(...(data.kinds || []).map((kind, i) => h('article', { class: 'card imagination-kind' },
        h('span', { class: 'imagination-number', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
        h('h2', null, kind.title), h('p', { class: 'soft' }, kind.description),
        (kind.items || [])[0] ? h('p', { class: 'imagination-example' }, 'Например: ', (kind.items || [])[0].task) : null,
        h('button', { type: 'button', class: 'btn ghost', 'aria-label': `Попробовать: ${kind.title}`, onclick: () => start(kind.id) }, 'Попробовать', icon('arrow')))));
      recent.replaceChildren(...((data.recent || []).length ? [h('h2', null, 'Продолжить своё занятие'),
        h('div', { class: 'imagination-recent-links' }, (data.recent || []).slice(0, 4).map(session => h('a', {
          class: 'btn ghost', href: `#/s/${session.session_id || session.id}` }, session.topic || session.title || 'Открыть занятие', icon('arrow'))))] : []));
    }
    root.append(h('a', { class: 'back', href: '#/' }, icon('back'), 'К тренировкам'),
      h('header', { class: 'imagination-heading' }, h('span', { class: 'chip' }, 'Пробный раздел · все 13 форматов'),
        h('h1', null, title), h('p', { class: 'imagination-subtitle' }, 'Фантазия и образное мышление'),
        h('p', { class: 'soft' }, 'Придумайте своё, расскажите голосом и выберите, куда повернуть мысль после вопросов тренера. Затем попробуйте ещё раз.')),
      details, error, recent, cards,
      h('p', { class: 'small soft' }, 'Тренер разбирает конкретный ответ. Здесь нет рейтинга креативности или единственно правильной истории.'));
    draw(); render(ctx, root);
    return { destroy() { destroyed = true; } };
  }

  async function session(ctx, initial) {
    let saved = initial, destroyed = false, timer = 0, recording = false;
    const owner = window.TrainerDrafts && TrainerDrafts.profile();
    const alive = () => !destroyed && ctx.alive() && (!owner || owner === TrainerDrafts.profile());
    const steps = h('ol', { class: 'imagination-steps', 'aria-label': 'Этапы занятия' });
    const connectionError = h('p', { class: 'thought-error', role: 'status', hidden: true });
    const retryPoll = h('button', { class: 'btn ghost small', type: 'button', hidden: true, onclick: poll }, 'Обновить разбор');
    const workshop = thoughtWorkshop({ session: () => saved, alive, canRecord: () => !recording,
      recordingChanged: value => { recording = value; }, changed: fresh => { if (alive()) { saved = fresh; update(); schedule(); } } });
    function update() {
      const p = (saved.thoughts || [])[0] || {}, reviewed = latestReview(p), compared = (p.attempts || []).filter(a => a.status === 'done').length > 1;
      const stage = compared ? 3 : reviewed ? (p.imagination || {}).selected_direction ? 2 : 1 : 0;
      steps.replaceChildren(...['Свой ответ', 'Вопросы тренера', 'Новый ход', 'Сравнение'].map((name, i) => h('li', {
        class: i === stage ? 'current' : i < stage ? 'complete' : '', ...(i === stage ? { 'aria-current': 'step' } : {}) }, h('span', null, i + 1), name)));
      workshop.update();
    }
    const pending = () => (saved.thoughts || []).some(p => (p.attempts || []).some(a => ['processing', 'reviewing'].includes(a.status)));
    function schedule() { clearTimeout(timer); if (alive() && pending()) timer = setTimeout(poll, 1800); }
    async function poll() {
      clearTimeout(timer); retryPoll.disabled = true;
      try {
        const fresh = await api(endpoint(saved.id));
        if (!alive()) return;
        saved = fresh; connectionError.hidden = retryPoll.hidden = true; update();
      } catch (e) {
        if (alive()) { connectionError.textContent = 'Не удалось обновить разбор. Ответ сохранён на сервере. ' + e.message; connectionError.hidden = retryPoll.hidden = false; }
      } finally { retryPoll.disabled = false; schedule(); }
    }
    const beforeUnload = e => { if (recording) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    const next = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
      if (recording) { toast('Сначала закончите текущую запись.'); return; }
      next.disabled = true;
      try {
        const p = saved.thoughts[0];
        const fresh = await api('/api/imagination', { method: 'POST', body: { kind: p.imagination.kind, exclude: p.imagination.content_id } });
        if (alive()) location.hash = `#/s/${fresh.id}`;
      } catch (e) { if (alive()) toast(e.message); }
      finally { next.disabled = false; }
    } }, 'Другая задача этого формата', icon('redo'));
    render(ctx, h('section', { class: 'imagination-view imagination-session' },
      h('a', { class: 'back', href: '#/imagination' }, icon('back'), title),
      h('header', { class: 'imagination-heading' }, h('span', { class: 'chip' }, 'Фантазия и образное мышление'),
        h('h1', null, saved.topic || saved.title),
        h('p', { class: 'soft' }, 'Первая попытка: до 90 секунд. После разбора выберите один вопрос и ответьте ещё раз, примерно за 30–45 секунд.')),
      steps, connectionError, retryPoll, workshop.el,
      h('div', { class: 'after-actions' }, next, h('a', { class: 'btn ghost', href: '#/imagination' }, 'Все форматы'),
        h('a', { class: 'btn ghost', href: '#/history?ex=imagination' }, 'Мои занятия'))));
    update(); schedule();
    return { retentionOwner: owner, retentionSession: () => recording ? null : saved,
      destroy() { destroyed = true; clearTimeout(timer); workshop.destroy(); window.removeEventListener('beforeunload', beforeUnload); } };
  }

  function review(result, attempt) {
    const finding = (items, name) => (items || []).length ? h('section', { class: 'imagination-findings' }, h('h6', null, name),
      items.map(item => h('div', null, h('blockquote', null, item.quote), h('p', null, item.comment)))) : null;
    const comparison = result.comparison;
    const provider = ({ claude: 'Claude', codex: 'Codex' })[(attempt.meta || {}).provider];
    return h('div', { class: 'thought-review imagination-review' }, h('p', null, result.summary),
      attempt.direction ? h('p', { class: 'small soft' }, 'Выбранный ход: ', attempt.direction.question) : null,
      finding(result.strengths, 'Что уже работает'), finding(result.opportunities, 'Где можно развить мысль'),
      comparison ? h('section', { class: 'imagination-comparison' }, h('h6', null, 'Что изменилось'),
        h('div', null, h('div', null, h('p', { class: 'label' }, 'Предыдущая попытка'), h('blockquote', null, comparison.before_quote)),
          h('div', null, h('p', { class: 'label' }, 'Новая попытка'), h('blockquote', null, comparison.after_quote))), h('p', null, comparison.comment)) : null,
      provider ? h('p', { class: 'small soft' }, 'Разбор по расшифровке · ', provider, (attempt.meta || {}).fallback_from ? ' · резерв' : '') : null);
  }

  // Дополнение к общему диктофону: материалы, новый ход и условие во время речи.
  function practice({ get, live, mutate, controls }) {
    let blocked = false, mediaReady = !mediaOf(get()) || !!(get().attempts || []).length, seeing = false, loaded = false, timer = 0, remaining = 20, revealing = false, revealRequested = false, destroyed = false, directionKey = '';
    const materials = h('div', { class: 'imagination-materials' });
    const directions = h('section', { class: 'imagination-directions', hidden: true, 'aria-label': 'Выберите новый ход мысли' });
    const media = mediaOf(get());
    const notice = h('p', { class: 'small soft', role: 'status' });
    const twist = h('div', { class: 'callout imagination-twist', hidden: true, 'aria-live': 'polite' });
    const questionDraft = 'imagination-question:' + get().id;
    const custom = h('textarea', { id: `imagination-question-${get().id}`, rows: 2, maxlength: 500, placeholder: 'Например: кому такая способность мешает?' });
    const savedQuestion = window.TrainerDrafts && TrainerDrafts.getText(questionDraft);
    if (savedQuestion) custom.value = savedQuestion.text || '';
    const chooseCustom = h('button', { class: 'btn ghost', type: 'button', onclick: () => choose({ custom_question: custom.value.trim() }) }, 'Выбрать свой вопрос');
    custom.addEventListener('input', () => {
      chooseCustom.disabled = blocked || !custom.value.trim();
      if (window.TrainerDrafts) TrainerDrafts.setText(questionDraft, { text: custom.value });
    });
    async function choose(body) {
      if (blocked || !live() || (body.custom_question !== undefined && !body.custom_question)) return;
      await mutate('/imagination/direction', { method: 'POST', body });
    }
    if (media && media.type === 'image') {
      const image = h('img', { src: media.src, alt: media.label || 'Сцена для упражнения на наблюдательность', width: 960, height: 720, hidden: true });
      const show = h('button', { type: 'button', class: 'btn ghost', disabled: true, onclick: () => {
        if (!loaded || blocked) return;
        clearInterval(timer); seeing = true; mediaReady = false; remaining = 20; image.hidden = false; show.hidden = true;
        notice.textContent = 'Рассмотрите сцену. Осталось 20 секунд.'; controls();
        timer = setInterval(() => {
          if (!live() || destroyed) { clearInterval(timer); return; }
          remaining--; notice.textContent = `Рассмотрите сцену. Осталось ${remaining} секунд.`;
          if (remaining <= 0) hideImage();
        }, 1000);
      } }, 'Рассмотреть сцену · 20 секунд');
      const hide = h('button', { type: 'button', class: 'btn ghost small', hidden: true, onclick: hideImage }, 'Скрыть и ответить по памяти');
      function hideImage() {
        clearInterval(timer); seeing = false; mediaReady = true; image.hidden = true; show.hidden = false; hide.hidden = true;
        show.textContent = 'Посмотреть ещё раз'; notice.textContent = 'Сцена скрыта. Расскажите, что запомнили, и добавьте свою историю.'; controls();
      }
      show.addEventListener('click', () => { hide.hidden = false; });
      image.addEventListener('load', () => { loaded = true; show.disabled = blocked; notice.textContent = 'Откройте сцену, а затем расскажите по памяти.'; });
      image.addEventListener('error', () => { loaded = false; show.disabled = true; notice.textContent = 'Изображение не загрузилось. Обновите страницу или выберите другой формат.'; });
      materials.append(h('div', { class: 'imagination-media' }, h('p', null, 'Сначала рассмотрите настоящую иллюстрацию. Потом она скроется.'), image, h('div', { class: 'row' }, show, hide), notice));
    } else if (media && media.type === 'audio') {
      const audio = h('audio', { src: media.src, controls: true, preload: 'metadata', 'aria-label': 'Звук для воображаемой сцены' });
      audio.addEventListener('ended', () => { mediaReady = true; notice.textContent = 'Звук закончился. Придумайте, что могло происходить.'; controls(); });
      audio.addEventListener('error', () => { mediaReady = false; notice.textContent = 'Звук недоступен. Обновите страницу или выберите другой формат.'; controls(); });
      materials.append(h('div', { class: 'imagination-media' }, h('p', null, 'Прослушайте фрагмент целиком. По одному звуку можно придумать разные сцены.'), audio,
        h('p', { class: 'small soft' }, media.credit || 'Звуковая композиция создана локально из синтезированных шумов. Это не полевая запись.'), notice));
    }
    const revealButton = h('button', { type: 'button', class: 'btn ghost small', onclick: async () => {
      if (blocked || !live()) return;
      await mutate('/imagination/condition', { method: 'POST', body: { revealed: true } });
    } }, 'Открыть условие сейчас');
    materials.append(twist);
    function update() {
      const p = get(), meta = p.imagination || {}, latest = latestReview(p);
      twist.hidden = !meta.twist;
      if (meta.twist) twist.replaceChildren(...[h('h4', null, meta.condition_revealed ? 'Новое условие' : 'Условие появится во время речи'),
        h('p', null, meta.condition_revealed ? meta.twist : 'Через 20 секунд после начала записи появится поворот. Продолжайте историю с ним.'),
        meta.condition_revealed ? null : revealButton].filter(Boolean));
      directions.hidden = !latest;
      const key = JSON.stringify([latest && latest.id, latest && latest.review, meta.selected_direction]);
      if (!latest || key === directionKey) return;
      directionKey = key;
      const selected = meta.selected_direction && meta.selected_direction.review_attempt_id === latest.id ? meta.selected_direction : null;
      directions.replaceChildren(h('h4', null, 'Куда повернуть мысль?'), h('p', { class: 'soft' }, 'Выберите один вопрос для следующей попытки. Сохраните то, что вам нравится в своей истории, и попробуйте новый ход.'),
        h('div', { class: 'imagination-direction-list' }, (latest.review.directions || []).map(direction => {
          const on = selected && selected.id === direction.id;
          return h('button', { type: 'button', class: 'imagination-direction' + (on ? ' selected' : ''), 'aria-pressed': String(!!on), disabled: blocked,
            onclick: () => choose({ direction_id: direction.id }) }, h('span', { class: 'label' }, direction.technique),
            h('span', { class: 'imagination-question' }, direction.question), h('span', { class: 'small soft' }, direction.why), on ? h('span', { class: 'imagination-chosen' }, 'Выбрано') : null);
        })),
        h('details', null, h('summary', null, 'Придумать свой ход'), h('label', { for: custom.id }, 'Ваш вопрос к своей истории'), custom, chooseCustom),
        selected ? h('p', { class: 'imagination-selected', role: 'status' }, 'Следующая попытка: ', selected.question) : h('p', { class: 'small soft' }, 'После выбора запись станет доступна.'));
    }
    function ready() {
      const p = get(), latest = latestReview(p), selected = (p.imagination || {}).selected_direction;
      return mediaReady && !seeing && (!latest || !!selected && selected.review_attempt_id === latest.id);
    }
    function setBusy(value) {
      blocked = value;
      directions.querySelectorAll('button, textarea').forEach(button => { button.disabled = value; });
      chooseCustom.disabled = value || !custom.value.trim();
      materials.querySelectorAll('button').forEach(button => { button.disabled = value || (media && media.type === 'image' && !loaded); });
    }
    function beforeVoice() { (materials.closest('.thought-card') || materials).querySelectorAll('audio').forEach(audio => audio.pause()); }
    async function tick(seconds) {
      const meta = get().imagination || {};
      if (!meta.twist || meta.condition_revealed || revealing || revealRequested || seconds < 20) return;
      revealRequested = true;
      revealing = true;
      await mutate('/imagination/condition', { method: 'POST', body: { revealed: true } });
      if (live() && (get().imagination || {}).condition_revealed) toast('Новое условие: ' + get().imagination.twist, 10000);
      revealing = false;
    }
    return { materials, directions, ready, setBusy, update, beforeVoice, tick,
      destroy() { destroyed = true; clearInterval(timer); beforeVoice(); } };
  }
  return { catalog, session, homeCard, review, practice };
})();
