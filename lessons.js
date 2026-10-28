'use strict';
/* Этапы и проверенные ответы хранит сервер. Черновики привязаны к профилю и этапу. */
window.TrainerLessons = (() => {
  const kinds = [
    { id: 'thought', title: 'Собери понятную мысль', icon: 'bulb', description: 'Найдите, где теряется смысл, соберите рассказ из фактов и попробуйте на другой теме.' },
    { id: 'retell', title: 'Пересказ классики', icon: 'book', description: 'Прочитайте текст из классики и передайте его своими словами. Тренер проверит, что сохранилось по смыслу.' },
  ];
  const enc = encodeURIComponent;
  const href = kind => `#/lessons/${kind}`;
  const metadata = kind => kinds.find(item => item.id === kind) || kinds[0];
  const list = value => Array.isArray(value) ? value : [];
  const compact = nodes => nodes.flat(Infinity).filter(node => node != null && node !== false);
  const replace = (node, ...children) => node.replaceChildren(...compact(children));
  const append = (node, ...children) => node.append(...compact(children));
  const isPoetry = genre => genre === 'poetry' || (/стих/i.test(genre || '') && !/прозе/i.test(genre || ''));
  const button = (label, action, primary = false, disabled = false) => h('button', { type: 'button', class: primary ? 'btn' : 'btn ghost', onclick: action, disabled }, label);
  function entryCards() {
    return kinds.map(kind => h('a', { class: 'ex-card lesson-entry', href: href(kind.id) },
      h('div', { class: 'icon' }, icon(kind.icon)), h('h3', null, kind.title), h('p', { class: 'soft small' }, kind.description),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, kind.id === 'thought' ? 'Урок в три шага' : 'Проза и поэзия'), h('span', null, 'Без таймера'))));
  }
  function citationNode(citation) {
    if (!citation) return null;
    let link = null;
    try { const source = new URL(citation.source_url); if (source.protocol === 'https:') link = h('a', { href: source.href, target: '_blank', rel: 'noopener noreferrer' }, 'Полный текст и источник', icon('arrow')); } catch (_) {}
    return h('div', { class: 'lesson-citation' }, h('p', null, [citation.author, citation.work].filter(Boolean).join(' · ')),
      citation.location ? h('p', { class: 'small soft' }, citation.location) : null, link);
  }
  async function catalogView(ctx, kindId) {
    const data = await api('/api/lessons');
    const selected = list(data.kinds).find(item => item.id === kindId);
    if (!selected) throw new Error('Такого учебного раздела нет. Вернитесь к выбору упражнений.');
    const meta = metadata(kindId), controls = [], error = h('p', { role: 'alert', class: 'thought-error', hidden: true });
    let busy = false, startRequestId = null, startContentId = null;
    async function start(item) {
      if (busy) return; busy = true; error.hidden = true; controls.forEach(control => { control.disabled = true; });
      const contentId = item && item.id || null;
      if (contentId !== startContentId) { startContentId = contentId; startRequestId = null; }
      try { const saved = await api('/api/lessons', { method: 'POST', body: item ? { kind: kindId, content_id: item.id } : { kind: kindId }, requestId: startRequestId,
        onRequestId: id => { startRequestId = id; } }); if (ctx.alive()) location.hash = `#/s/${saved.id}`; }
      catch (caught) { if (caught.status >= 400 && caught.status < 500 && !caught.requestState) startRequestId = null; else if (caught.requestId) startRequestId = caught.requestId;
        if (ctx.alive()) { error.textContent = caught.message; error.hidden = false; } }
      finally { busy = false; controls.forEach(control => { control.disabled = false; }); }
    }
    if (kindId === 'retell') {
      const launch = button('Получить текст', () => start(), true); controls.push(launch);
      render(ctx, h('div', { class: 'lesson-page' }, h('a', { class: 'back', href: '#/learn' }, icon('back'), 'Мысль и слово'),
        h('h1', null, meta.title), h('p', { class: 'soft learning-intro' }, meta.description),
        h('section', { class: 'card lesson-blind-start' }, h('span', { class: 'chip' }, 'Около пяти минут чтения'),
          h('h2', null, 'Новый отрывок'),
          h('p', null, 'Приложение само выберет текст. Он откроется после начала занятия.'),
          h('p', null, 'Читайте в своём темпе. Автор и название произведения будут под текстом.'),
          h('p', null, 'Когда закончите читать, текст скроется. Расскажите, что запомнили, голосом или письменно. Время пересказа не ограничено.'),
          selected.resumable ? h('a', { class: 'btn ghost', href: `#/s/${enc(selected.resumable)}` }, 'Продолжить начатый пересказ', icon('arrow')) : null,
          error, launch)));
      return null;
    }
    const items = list(selected.items).map(item => {
      const progress = item.progress || {}, previous = progress.last_session_id;
      const launch = button(previous ? 'Начать заново' : kindId === 'retell' ? 'Читать и пересказать' : 'Начать урок', () => start(item), !previous);
      controls.push(launch);
      const citation = item.citation || (item.author ? { author: item.author, work: item.work, source_url: item.source_url, location: item.location } : null);
      return h('article', { class: 'card lesson-catalog-item' },
        h('div', { class: 'row' }, h('span', { class: 'chip' }, kindId === 'thought' ? 'Три шага' : item.genre || 'Проза'), item.word_count ? h('span', { class: 'small soft' }, `${item.word_count} ${plural(item.word_count, 'слово', 'слова', 'слов')}`) : null),
        h('h2', null, item.title), citation ? citationNode(citation) : null,
        item.topic ? h('p', { class: 'soft' }, item.topic) : null,
        item.description ? h('p', null, item.description) : null,
        previous ? h('p', { class: 'small soft' }, progress.completed ? 'Вы завершили это занятие. Ответы и разбор сохранены.' : 'Вы уже открывали это занятие. Можно продолжить с того же места.') : null,
        h('div', { class: 'row' }, previous ? h('a', { class: 'btn', href: `#/s/${previous}` }, 'Открыть занятие', icon('arrow')) : null, launch));
    });
    render(ctx, h('a', { class: 'back', href: '#/learn' }, icon('back'), 'Мысль и слово'),
      h('div', { class: 'ex-head' }, h('h1', null, meta.title), h('span', { class: 'chip' }, 'Без таймера')),
      h('p', { class: 'soft learning-intro' }, meta.description),
      h('p', { class: 'lesson-intro-note' }, kindId === 'thought'
        ? 'На каждом шаге сначала ответьте сами. После ответа тренер объяснит, что помогает слушателю понять вашу мысль.'
        : 'Читайте в своём темпе. Затем отрывок скроется, и вы перескажете его по памяти, голосом или текстом. Дословно повторять не нужно.'), error,
      h('div', { class: 'lesson-catalog' }, items));
    return null;
  }

  async function sessionView(ctx, initial) {
    let session = initial, disposed = false, busy = false, recording = null, recordStream = null, stopping = false, pending = null, error = '', warning = '';
    let pollTimer = 0, recordTimer = 0, captureToken = 0, inputStage = null, draft = {}, textQueue = Promise.resolve(), lastTask = '', lastReviews = '', lastSteps = '';
    const owner = window.TrainerDrafts && TrainerDrafts.profile(), base = `/api/sessions/${enc(session.id)}/lesson`;
    const live = () => !disposed && ctx.alive() && (!window.TrainerDrafts || owner === TrainerDrafts.profile());
    const lesson = () => session.lesson || {};
    const textLimit = () => Number(lesson().limits && lesson().limits.text_characters) || (lesson().kind === 'retell' ? 50000 : 6000);
    const audioLimit = () => lesson().kind === 'retell' ? null : Number(lesson().limits && lesson().limits.audio_seconds) || 90;
    const currentStage = () => Number(lesson().stage || 0);
    const endpoint = verb => `${base}/${verb}`;
    const textKey = stage => `lesson-text:${session.id}:${stage}`;
    const audioPath = stage => `${endpoint('audio')}?stage=${stage}`;
    const attempts = () => list(lesson().attempts);
    const working = () => lesson().phase === 'reviewing' || attempts().some(attempt => ['processing', 'reviewing'].includes(attempt.status));
    const canAnswer = () => ['answer', 'review'].includes(lesson().phase) && !working();
    const controlsLocked = () => busy || stopping || !!recording || working();
    function closeMic(stream = recordStream) { if (stream && mic.stream === stream) mic.close(); if (recordStream === stream) recordStream = null; }
    const header = h('div', { class: 'ex-head' });
    const steps = h('ol', { class: 'lesson-steps', 'aria-label': 'Ход занятия' });
    const task = h('section', { class: 'card lesson-task', tabindex: -1 });
    const feedback = h('section', { class: 'lesson-feedback', 'aria-label': 'Ответы и обратная связь' });
    const composer = h('section', { class: 'card lesson-composer' });
    const alert = h('p', { class: 'thought-error', role: 'alert', hidden: true });
    const status = h('p', { class: 'small soft', role: 'status', hidden: true });
    const label = h('label', { for: 'lesson-answer' }, 'Ваш ответ');
    const input = h('textarea', { id: 'lesson-answer', rows: 5, maxlength: textLimit(), 'aria-describedby': 'lesson-answer-help', oninput: () => {
      if (busy || draft.submittedText || !live()) return;
      draft = { text: input.value }; persistText(); updateComposer();
    } });
    const help = h('p', { id: 'lesson-answer-help', class: 'small soft' }, 'Можно написать ответ или записать голосом. Отправка начинается только по вашей кнопке.');
    const send = button('Отправить ответ', sendText, true);
    const micButton = button('Ответить голосом', beginRecording); micButton.prepend(icon('mic'));
    const textComposer = h('div', { class: 'stack' }, label, input, help, h('div', { class: 'row' }, send, micButton));

    function loadText() {
      if (inputStage === currentStage()) return;
      inputStage = currentStage(); draft = window.TrainerDrafts && TrainerDrafts.getText(textKey(inputStage)) || { text: '' }; input.value = draft.text || '';
    }
    function persistText() {
      if (!window.TrainerDrafts || !live()) return Promise.resolve();
      const stage = inputStage, value = { ...draft };
      TrainerDrafts.setText(textKey(stage), value);
      textQueue = textQueue.then(() => TrainerDrafts.put(textKey(stage), { kind: 'lesson-text', session_id: session.id, stage, ...value }, owner)).then(saved => {
        if (live() && !saved.durable) { warning = 'Не удалось сохранить черновик надолго. Не закрывайте страницу до отправки или скопируйте текст.'; drawStatus(); }
      }).catch(() => {});
      return textQueue;
    }
    async function clearText(stage, requestId) {
      if (!window.TrainerDrafts) return;
      await textQueue;
      const saved = TrainerDrafts.getText(textKey(stage));
      if (live() && saved && saved.requestId === requestId) TrainerDrafts.removeText(textKey(stage));
      await TrainerDrafts.remove(textKey(stage), requestId, owner);
    }
    async function reconcile() {
      if (draft.requestId && attempts().some(attempt => attempt.client_request_id === draft.requestId)) {
        await clearText(inputStage, draft.requestId); draft = { text: '' }; input.value = '';
      }
      if (pending && attempts().some(attempt => attempt.client_request_id === pending.requestId)) {
        if (window.TrainerDrafts) {
          if (pending.incomplete) await TrainerDrafts.removeRecording(pending.recordingId, pending.recordingRequestId, owner);
          else await TrainerDrafts.remove(pending.draftId || 'audio:' + pending.path, pending.requestId, owner);
        }
        clearPending();
      }
    }
    function drawStatus() {
      alert.hidden = !error; alert.textContent = error;
      status.hidden = !warning; status.textContent = warning;
    }
    async function mutate(verb, body = {}) {
      if (!live() || controlsLocked() || pending || draft.submittedText) return;
      busy = true; error = ''; draw();
      try {
        const fresh = await api(endpoint(verb), { method: 'POST', body });
        if (live()) {
          session = fresh; loadText(); draw();
          const target = verb === 'read' ? composer : lesson().phase === 'complete' ? feedback : task;
          if (['next', 'read', 'reopen-read'].includes(verb) && target.scrollIntoView) target.scrollIntoView({ block: 'start' });
        }
      }
      catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    function draw() {
      if (!live()) return;
      loadText(); const data = lesson(), meta = metadata(data.kind), current = data.current || {};
      replace(header, h('h1', null, data.kind === 'retell' ? meta.title : session.title || meta.title), data.kind === 'retell' ? null : h('span', { class: 'chip' }, meta.title));
      const stepNames = data.kind === 'retell' ? ['Чтение', 'Пересказ', 'Разбор'] : ['Найти разрыв', 'Собрать рассказ', 'Новая тема'];
      const position = data.phase === 'complete' ? 3 : data.kind === 'retell' ? data.phase === 'reading' ? 0 : data.phase === 'answer' ? 1 : 2 : currentStage();
      const stepKey = JSON.stringify([stepNames, position]);
      if (stepKey !== lastSteps) { lastSteps = stepKey; replace(steps, ...stepNames.map((name, index) => h('li', { class: index < position ? 'is-done' : index === position ? 'is-current' : '', ...(index === position ? { 'aria-current': 'step' } : {}) }, h('span', { 'aria-hidden': 'true' }, index < position ? '✓' : String(index + 1)), name))); }
      const taskKey = JSON.stringify([current, data.phase, data.reading_count, data.source_text]);
      if (taskKey !== lastTask) {
        lastTask = taskKey;
        if (data.kind === 'retell') {
          replace(task, h('h2', null, data.phase === 'reading' ? 'Читайте в своём темпе' : 'Пересказ своими словами'),
            data.phase === 'reading' ? h('p', { class: 'small soft' }, current.reading_minutes ? 'Примерно пять минут чтения. Перейдите к пересказу, когда будете готовы.' : 'Перейдите к пересказу, когда будете готовы.') : null,
            data.phase === 'reading' && current.context ? h('p', { class: 'small soft' }, current.context) : null,
            data.phase === 'reading' ? h('div', { class: `lesson-excerpt ${isPoetry(current.genre) ? 'is-poetry' : ''}` }, current.text || '') : h('p', { class: 'soft' }, 'Отрывок скрыт. Передайте своими словами то, что вы запомнили.'),
            data.phase === 'reading' ? citationNode(current.citation) : null,
            data.phase === 'reading' ? button('Закончил читать — перейти к пересказу', () => mutate('read'), true, controlsLocked()) : null,
            data.phase !== 'reading' && data.phase !== 'complete' ? button('Прочитать отрывок ещё раз', () => mutate('reopen-read'), false, controlsLocked() || !!pending || !!draft.submittedText) : null,
            Number(data.reading_count) > 1 ? h('p', { class: 'small soft' }, 'Вы перечитали отрывок. Тренер отметит это в новой попытке.') : null);
        } else {
          replace(task, h('p', { class: 'lesson-step-label' }, `Шаг ${currentStage() + 1} из ${data.stage_count || 3}`), h('h2', null, current.title || ''),
            current.context ? h('p', null, current.context) : null, current.text ? h('blockquote', { class: 'lesson-source-phrase' }, current.text) : null,
            list(current.facts).length ? h('ul', { class: 'lesson-facts' }, current.facts.map(fact => h('li', null, fact))) : null,
            current.audience ? h('p', { class: 'small soft' }, `Кому вы отвечаете: ${current.audience}`) : null, h('p', { class: 'lesson-task-instruction' }, current.task || ''));
        }
      }
      task.querySelectorAll('button').forEach(control => { control.disabled = controlsLocked() || !!pending || !!draft.submittedText; });
      drawReviews(); updateComposer(); drawStatus();
    }
    function drawReviews() {
      const data = lesson(), key = JSON.stringify([data.attempts, data.phase, data.stage, data.source_text, busy, controlsLocked(), !!pending, !!draft.submittedText]);
      if (key === lastReviews) return; lastReviews = key;
      const nodes = attempts().map((attempt, index) => {
        const review = attempt.review, latest = index === attempts().length - 1, current = attempt.stage === currentStage();
        const content = h('div', { class: 'stack lesson-attempt-body' }, h('p', { class: 'small soft' }, `${attempt.input_kind === 'audio' ? 'Голосом' : 'Написано'}${attempt.reading_count > 1 ? ' · после повторного чтения' : ''}`),
          h('p', { class: 'lesson-own-answer' }, attempt.text || (attempt.status === 'processing' ? 'Распознаю запись…' : '')),
          attempt.audio ? h('audio', { controls: true, preload: 'none', src: url(`/media/${enc(session.id)}/${enc(attempt.audio)}`), 'aria-label': `Ваша запись, попытка ${index + 1}` }) : null);
        if (!current && attempt.condition) content.prepend(h('details', { class: 'lesson-previous-task' }, h('summary', null, 'Условие этого шага'),
          h('h4', null, attempt.task_title || ''), attempt.condition.context ? h('p', null, attempt.condition.context) : null,
          attempt.condition.text ? h('blockquote', null, attempt.condition.text) : null,
          list(attempt.condition.facts).length ? h('ul', { class: 'lesson-facts' }, attempt.condition.facts.map(fact => h('li', null, fact))) : null,
          attempt.condition.audience ? h('p', { class: 'small soft' }, `Кому вы отвечали: ${attempt.condition.audience}`) : null,
          h('p', null, attempt.task || '')));
        if (review) {
          append(content, h('h3', null, review.passed ? 'Получилось' : 'Что можно доработать'), h('p', null, review.summary || ''),
            list(review.strengths).length ? h('ul', { class: 'list good' }, review.strengths.map(value => h('li', null, value))) : null,
            list(review.improvements).length ? h('ul', { class: 'list grow' }, review.improvements.map(value => h('li', null, value))) : null);
          if (data.kind === 'retell' && list(review.semantic_units).length) {
            const names = { preserved: 'Передано', partial: 'Частично', missing: 'Не прозвучало', distorted: 'Смысл изменился' };
            const units = list(review.semantic_units), count = units.filter(unit => unit.status === 'preserved').length;
            append(content, h('section', { class: 'lesson-meaning' }, h('h3', null, 'Что сохранилось по смыслу'),
              h('p', { class: 'lesson-coverage' }, `Полностью передано ${count} из ${units.length} смысловых опор`),
              h('p', { class: 'small soft' }, 'Оценка тренера по этому ответу. Дословное совпадение и рифма не нужны; важны смысл и связи.'),
              h('details', { class: 'lesson-units-details' }, h('summary', null, 'Показать смысловые опоры'),
                h('ul', { class: 'lesson-semantic-units' }, units.map(unit => h('li', null, h('div', { class: 'row' }, h('strong', null, unit.label || ''), h('span', { class: `lesson-unit-status is-${unit.status}` }, names[unit.status] || 'Нужно уточнить')),
                  unit.evidence ? h('blockquote', null, unit.evidence) : null, unit.comment ? h('p', { class: 'small soft' }, unit.comment) : null))))));
          }
          const notice = data.kind === 'thought' && attempt.stage === 0;
          if (review.criteria) append(content, h('div', { class: 'lesson-criteria' }, [['core', notice ? 'Разрыв смысла' : 'Главная мысль'], ['relations', notice ? 'Ясность объяснения' : 'Связи'], ['accuracy', data.kind === 'thought' ? 'Опора на условие' : 'Точность']].map(([id, title]) => {
            const value = review.criteria[id]; if (!value) return null;
            return h('section', null, h('h4', null, title), h('p', null, typeof value === 'string' ? value : value.comment || value.summary || ''));
          })));
          if (review.structure_explanation) append(content, h('section', { class: 'stronger-explanation' }, h('h3', null, 'Почему так понятнее слушателю'), h('p', null, review.structure_explanation)));
          if (review.next_tip) append(content, h('aside', { class: 'callout' }, h('h3', null, 'Попробуйте в следующий раз'), h('p', null, review.next_tip)));
          if (latest && current && data.phase === 'review') append(content, h('div', { class: 'row lesson-review-actions' },
            review.passed || data.kind === 'retell' ? button(data.kind === 'retell' ? 'Завершить пересказ' : currentStage() === 2 ? 'Завершить урок' : currentStage() === 0 ? 'Дальше: собрать рассказ' : 'Дальше: новая тема', () => mutate('next', { stage: currentStage() }), true, controlsLocked() || !!pending || !!draft.submittedText) : h('p', { class: 'small soft' }, 'Попробуйте переделать ответ ниже. Прежняя версия останется для сравнения.')));
        } else if (attempt.status === 'error') append(content, h('p', { class: 'thought-error' }, attempt.error || 'Разбор не получился. Ответ сохранён.'), button('Повторить проверку', () => mutate('retry', { attempt_id: attempt.id }), true, controlsLocked()));
        else append(content, h('p', { role: 'status', class: 'soft' }, 'Тренер проверяет ответ. Он уже сохранён.'));
        return h('details', { class: 'card lesson-attempt', open: latest && current }, h('summary', null, `Попытка ${index + 1}${data.kind === 'thought' ? ` · шаг ${attempt.stage + 1}` : ''}`), content);
      });
      if (data.source_text && ['review', 'complete'].includes(data.phase)) nodes.push(h('details', { class: 'card lesson-original' }, h('summary', null, 'Сравнить с исходным отрывком'), data.current && data.current.context ? h('p', { class: 'small soft' }, data.current.context) : null, h('div', { class: `lesson-excerpt ${isPoetry((data.current || {}).genre) ? 'is-poetry' : ''}` }, data.source_text), citationNode((data.current || {}).citation)));
      if (data.phase === 'complete') nodes.push(h('section', { class: 'card lesson-complete' }, h('h2', null, 'Занятие завершено'), h('p', null, 'Ваши ответы и разборы сохранены. Вы можете вернуться к ним в истории.'),
        h('a', { class: 'btn', href: href(data.kind) }, data.kind === 'retell' ? 'Получить новый текст' : 'Выбрать следующий урок', icon('arrow'))));
      replace(feedback, ...nodes);
    }
    function updateComposer() {
      if (!live()) return;
      const disabled = controlsLocked();
      composer.hidden = !canAnswer() && !recording && !pending && !stopping;
      if (recording) { replace(composer, h('h2', null, 'Идёт запись ответа'), h('p', { role: 'status' }, audioLimit() ? `Закончите запись, когда выразите мысль. До ${audioLimit()} секунд.` : 'Рассказывайте в своём темпе. Когда закончите, остановите запись и отправьте её.'), h('div', { class: 'row' }, button('Закончить запись', stopRecording, true), button('Отменить запись', cancelRecording))); return; }
      if (stopping) { replace(composer, h('p', { role: 'status' }, 'Сохраняю запись на устройстве…')); return; }
      if (pending) {
        if (pending.incomplete) {
          pending.sending = disabled || !canAnswer();
          if (!pending.controls) pending.controls = recoveredRecordingControls(pending, { send: sendAudio, recordAgain: () => { if (!canAnswer() || controlsLocked()) return; clearPending(); draw(); beginRecording(); }, discard: discardAudio });
          pending.controls.update(); composer.hidden = false;
          replace(composer, h('h2', null, 'Восстановлена незавершённая запись'), pending.controls.el, pending.error ? h('p', { class: 'thought-error' }, pending.error) : null); return;
        }
        if (!pending.player) pending.player = h('audio', { controls: true, preload: 'metadata', src: pending.downloadUrl, 'aria-label': 'Неотправленный ответ' });
        composer.hidden = false; replace(composer, h('h2', null, 'Ваша запись'), pending.player, h('div', { class: 'row' }, button(busy ? 'Отправляю…' : pending.error ? 'Повторить отправку' : 'Отправить запись', sendAudio, true, disabled || pending.blob.size < 1200 || !canAnswer()),
          h('a', { class: 'btn ghost', href: pending.downloadUrl, download: pending.blob.type.includes('mp4') ? 'пересказ.m4a' : 'ответ.webm' }, 'Скачать запись'),
          confirmButton('Убрать запись', 'Убрать эту запись?', discardAudio)), pending.error ? h('p', { class: 'thought-error' }, pending.error) : null); return;
      }
      input.disabled = disabled; input.readOnly = !!draft.submittedText;
      input.maxLength = textLimit();
      label.textContent = lesson().kind === 'retell' ? 'Ваш пересказ' : currentStage() === 0 ? 'Где теряется смысл и чего не хватает слушателю?' : 'Ваш рассказ';
      send.disabled = disabled || !input.value.trim(); send.textContent = busy ? 'Отправляю…' : draft.submittedText ? 'Повторить отправку' : 'Отправить ответ';
      micButton.disabled = disabled || !!draft.submittedText;
      if (composer.firstElementChild !== textComposer) replace(composer, textComposer);
    }
    async function sendText() {
      if (!live() || controlsLocked() || pending || !canAnswer()) return;
      const text = draft.submittedText || input.value.trim(); if (!text) return;
      const stage = currentStage(); busy = true; error = ''; draft = { ...draft, text, submittedText: text }; draw();
      try {
        await persistText();
        const fresh = await api(endpoint('answer'), { method: 'POST', body: { stage, text }, requestId: draft.requestId,
          onRequestId: requestId => { draft.requestId = requestId; persistText(); } });
        await clearText(stage, draft.requestId); if (!live()) return;
        draft = { text: '' }; input.value = ''; session = fresh; await reconcile();
      } catch (caught) {
        if (!live()) return; error = caught.message;
        if (caught.status >= 400 && caught.status < 500 && !caught.requestState) draft = { text };
        else if (caught.requestId) draft.requestId = caught.requestId;
        await persistText();
      } finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function beginRecording() {
      if (!live() || controlsLocked() || pending || draft.submittedText || !canAnswer()) return;
      const token = ++captureToken, stage = currentStage(); busy = true; error = ''; warning = ''; draw();
      try {
        feedback.querySelectorAll('audio').forEach(audio => audio.pause());
        const stream = await mic.open(); if (!live() || token !== captureToken) { closeMic(stream); return; }
        recordStream = stream;
        recording = new Recorder(stream, { journal: { path: audioPath(stage), userId: session.user, context: window.TrainerDrafts && TrainerDrafts.context(), onStatus: value => { if (live() && !value.durable) { warning = value.notice; drawStatus(); } } } });
        recording.start();
        const seconds = audioLimit();
        if (seconds) recordTimer = setTimeout(() => { warning = `Прошло ${seconds} секунд. Запись остановлена и ждёт отправки.`; stopRecording(); }, seconds * 1000);
      } catch (caught) { error = caught.message; closeMic(); }
      finally { busy = false; if (live()) draw(); }
    }
    async function stopRecording() {
      if (!recording || stopping) return;
      const recorder = recording, stage = currentStage(), recordOwner = owner; recording = null; stopping = true; clearTimeout(recordTimer); draw();
      try {
        const blob = await recorder.stop(); let saved = recorder.savedDraft;
        if (!saved && window.TrainerDrafts) saved = await TrainerDrafts.audio(audioPath(stage), blob, {}, undefined, { profile: recordOwner, route: location.hash });
        if (!live()) return;
        pending = { stage, blob, path: audioPath(stage), requestId: saved && saved.requestId, draftId: saved && saved.id, headers: saved && saved.headers || {}, downloadUrl: URL.createObjectURL(blob) };
        if (saved && !saved.durable) warning = 'Запись осталась в этой странице. Не закрывайте её до отправки или скачивания.';
      } catch (caught) { if (live()) error = caught.message; }
      finally { stopping = false; closeMic(); if (live()) draw(); }
    }
    function cancelRecording() { captureToken++; clearTimeout(recordTimer); if (recording) recording.cancel(); recording = null; closeMic(); draw(); }
    function clearPending() { if (!pending) return; if (pending.player) pending.player.pause(); if (pending.controls) pending.controls.pause(); URL.revokeObjectURL(pending.downloadUrl); pending = null; }
    async function discardAudio() {
      if (controlsLocked() || !pending) return;
      if (window.TrainerDrafts) {
        if (pending.incomplete) { if (!await TrainerDrafts.removeRecording(pending.recordingId, pending.recordingRequestId, owner)) return; }
        else await TrainerDrafts.remove(pending.draftId || 'audio:' + pending.path, pending.requestId, owner);
      }
      clearPending(); draw();
    }
    async function sendAudio() {
      if (!live() || controlsLocked() || !pending || !canAnswer() || (pending.incomplete && pending.playback !== 'ready')) return;
      busy = true; const sent = pending; sent.error = ''; draw();
      try {
        if (sent.incomplete && !sent.requestId && window.TrainerDrafts) {
          const claim = await TrainerDrafts.operation('PUT', sent.path, sent.blob, { ...(sent.headers || {}), 'X-Trainer': '1', 'Content-Type': sent.blob.type || 'application/octet-stream' });
          const prepared = await TrainerDrafts.prepareRecovery(sent.recordingId, sent.recordingRequestId, claim, sent.headers || {}, owner);
          sent.requestId = prepared.requestId;
        }
        if (!live()) return;
        const fresh = await api(sent.path, { method: 'PUT', blob: sent.blob, headers: sent.headers || {}, requestId: sent.requestId, onRequestId: id => { sent.requestId = id; } });
        if (sent.incomplete && window.TrainerDrafts) await TrainerDrafts.removeRecording(sent.recordingId, sent.recordingRequestId, owner);
        if (!live()) return; if (pending === sent) clearPending(); session = fresh;
      } catch (caught) { if (live()) { sent.error = caught.message; if (caught.requestId) sent.requestId = caught.requestId; } }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function refresh() {
      if (!live() || busy || recording || stopping) return;
      try { const fresh = await api(`/api/sessions/${enc(session.id)}`); if (!live()) return; session = fresh; await reconcile(); error = ''; draw(); }
      catch (caught) { if (live()) { error = caught.message; drawStatus(); } }
      schedule();
    }
    function schedule() { clearTimeout(pollTimer); if (live() && (working() || draft.submittedText || pending && pending.error)) pollTimer = setTimeout(refresh, 2000); }
    function beforeUnload(event) { if (recording || stopping || busy) { event.preventDefault(); event.returnValue = ''; } }
    function reconnect() { if (!recording && !stopping && !busy) refresh(); }
    loadText();
    if (window.TrainerDrafts) {
      const stage = currentStage(), textBackup = await TrainerDrafts.get(textKey(stage), owner);
      if (!draft.text && textBackup) { draft = textBackup; input.value = draft.text || ''; }
      const saved = await TrainerDrafts.get('audio:' + audioPath(stage), owner);
      if (saved && saved.blob && live()) pending = { ...saved, stage, draftId: saved.id, downloadUrl: URL.createObjectURL(saved.blob) };
      if (!pending && TrainerDrafts.recordings && TrainerDrafts.recoverRecording) {
        const interrupted = (await TrainerDrafts.recordings()).filter(record => record.sessionId === session.id && record.lessonStage === stage).sort((a, b) => b.updated - a.updated);
        if (interrupted.length) {
          const record = interrupted[0], restored = await TrainerDrafts.recoverRecording(record.id);
          if (restored && restored.blob && live()) pending = { stage, idx: stage, blob: restored.blob, path: record.path, headers: record.headers || {}, profile: owner,
            recordingId: record.id, recordingRequestId: record.requestId, requestId: null, incomplete: true, playback: 'unverified', downloadUrl: URL.createObjectURL(restored.blob), error: restored.notice };
        }
      }
      await reconcile();
    }
    render(ctx, h('div', { class: 'lesson-page' }, h('a', { class: 'back', href: href(lesson().kind) }, icon('back'), metadata(lesson().kind).title), header, steps, task, alert, status, feedback, composer,
      h('div', { class: 'after-actions' }, h('a', { class: 'btn ghost', href: href(lesson().kind) }, 'К другим заданиям'), h('a', { class: 'btn ghost', href: '#/history' }, 'История'))));
    draw(); schedule();
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('trainer:backendchange', reconnect);
    return { destroy() { disposed = true; captureToken++; clearTimeout(pollTimer); clearTimeout(recordTimer); if (recording) recording.cancel({ preserve: true }); closeMic(); recording = null; if (pending) clearPending(); feedback.querySelectorAll('audio').forEach(audio => audio.pause()); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('trainer:backendchange', reconnect); } };
  }
  return { kinds, entryCards, catalog: catalogView, session: sessionView };
})();
