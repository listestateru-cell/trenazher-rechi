'use strict';
/* Историю и этап разговора хранит сервер. На устройстве остаются только неотправленные записи. */
window.TrainerConversations = (() => {
  const enc = encodeURIComponent;
  const href = id => id ? `#/conversation/${enc(id)}` : '#/conversation';
  const endpoint = id => `/api/sessions/${enc(id)}`;
  const phaseNames = { awaiting_user: 'Ваш ответ', processing: 'Распознаю ответ', opponent_pending: 'Собеседник отвечает',
    opponent_error: 'Ответ собеседника не получен', ready_for_analysis: 'Можно перейти к разбору', finished: 'Разговор завершён' };
  const criteria = [['logic', 'Логика'], ['vocabulary', 'Словарный запас'], ['thinking_speed', 'Скорость мышления'],
    ['persuasiveness', 'Убедительность'], ['structure', 'Структура речи']];
  const findings = [['goal', 'Удалось ли достичь цели'], ['position', 'Понятна ли ваша позиция'], ['relevance', 'Ответ по существу'],
    ['explanations', 'Объяснения и оправдания'], ['conflict', 'Отношение к собеседнику']];
  const assessmentNames = { achieved: 'Получилось', partly: 'Частично', not_achieved: 'Есть что доработать', unclear: 'Недостаточно данных' };
  const autoVoiceSessions = new Set();
  const conversation = session => session && session.conversation || {};
  const userMessages = session => (conversation(session).messages || []).filter(message => message.role === 'user');
  const currentIndex = session => Math.max(0, (session.plan || []).length - 1);
  const isWorking = session => ['processing', 'opponent_pending'].includes(conversation(session).phase)
    || ((session.analysis || {}).status === 'running' && ['finished', 'ready_for_analysis'].includes(conversation(session).phase));
  const scenarioTitle = session => (conversation(session).scenario || {}).title || session.title || 'Сложный разговор';

  async function homeCard() {
    try {
      const data = await api('/api/conversations');
      if (!data.available) return null;
      return h('a', { class: 'ex-card conversation-entry', href: href() }, h('div', { class: 'icon' }, icon('ask')),
        h('h3', null, 'Сложный разговор'), h('p', { class: 'soft small' }, 'Откажите, ответьте на критику или обозначьте границу. Собеседник реагирует на ваши слова.'),
        h('div', { class: 'meta' }, h('span', { class: 'chip' }, 'Диалог'), h('span', null, 'до трёх ответов · без таймера')));
    } catch (_) { return null; }
  }

  async function view(ctx, parts, params, initial) {
    if (!parts[1]) return catalogView(ctx);
    return sessionView(ctx, initial || await api(endpoint(parts[1])));
  }

  async function catalogView(ctx) {
    const data = await api('/api/conversations');
    let selected = (data.scenarios || [])[0], busy = false, destroyed = false;
    const root = h('section', { class: 'conversation-view stack' });
    const error = h('p', { class: 'conversation-error', role: 'alert', hidden: true });
    const details = h('div', { class: 'conversation-scenario-details stack' });
    const start = h('button', { type: 'button', class: 'btn', disabled: !selected, onclick: begin }, 'Начать разговор', icon('arrow'));
    const selectId = 'conversation-scenario';
    const select = h('select', { id: selectId, onchange: () => {
      selected = (data.scenarios || []).find(item => item.id === select.value); drawDetails();
    } }, (data.scenarios || []).map(item => h('option', { value: item.id }, item.title)));
    function drawDetails() {
      details.replaceChildren(...(selected ? [h('p', null, selected.context),
        h('div', { class: 'conversation-goal' }, h('h3', null, 'Ваша цель'), h('p', null, selected.user_goal)),
        h('p', { class: 'small soft' }, 'Собеседник: ', selected.opponent_role)] : []));
    }
    async function begin() {
      if (busy || !selected) return;
      busy = true; start.disabled = select.disabled = true; error.hidden = true; start.textContent = 'Открываю разговор…';
      try {
        const saved = await api('/api/conversations', { method: 'POST', body: { scenario_id: selected.id } });
        if (!destroyed && ctx.alive()) { autoVoiceSessions.add(saved.id); location.hash = href(saved.id); }
      } catch (caught) { if (!destroyed && ctx.alive()) { error.textContent = caught.message; error.hidden = false; } }
      finally { busy = false; if (!destroyed && ctx.alive()) { start.disabled = select.disabled = false; start.replaceChildren('Начать разговор', icon('arrow')); } }
    }
    const recent = data.recent || [];
    root.append(h('a', { class: 'back', href: '#/' }, icon('back'), 'К упражнениям'),
      h('header', { class: 'conversation-heading' }, h('p', { class: 'label' }, 'Практика диалога'), h('h1', null, 'Сложный разговор'),
        h('p', { class: 'soft' }, 'Собеседник возражает и задаёт вопросы. Отвечайте своими словами; после разговора тренер разберёт ваши реплики.')));
    if (data.available) {
      drawDetails();
      root.append(h('section', { class: 'card stack' }, h('h2', null, 'Выберите ситуацию'),
        h('div', { class: 'field' }, h('label', { for: selectId }, 'Сценарий'), select), details,
        h('p', { class: 'small soft' }, 'Обычно три ответа голосом. Можно закончить раньше и получить разбор.'), start, error));
    } else root.append(h('div', { class: 'card' }, h('h2', null, 'Разговоры для взрослых'),
      h('p', { class: 'soft' }, data.reason || 'В выбранной группе этот режим недоступен.'), h('a', { class: 'btn ghost', href: '#/' }, 'К упражнениям')));
    if (recent.length) {
      const items = recent.map(item => h('a', { class: 'card conversation-recent-item', href: href(item.session_id) },
        h('div', null, h('h3', null, item.title || 'Сложный разговор'), h('p', { class: 'small soft' }, phaseNames[item.phase] || 'Сохранённый разговор', ' · ответов: ', item.user_turns || 0)),
        h('span', { class: 'small soft' }, item.created ? new Date(item.created).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''), icon('arrow')));
      root.append(h('section', { class: 'stack' }, h('h2', null, 'Ваши разговоры'), h('div', { class: 'conversation-recent' }, items)));
    }

    render(ctx, root);
    return { destroy() { destroyed = true; } };
  }

  async function sessionView(ctx, initial) {
    let session = initial, destroyed = false, busy = false, loading = false, error = '', pollTimer = 0, pendingChecks = 0;
    let recorder = null, stopping = null, openingMic = false, recordStream = null, recordContext = null, startToken = 0, pending = null, recordWarning = '';
    let allowAutoVoice = autoVoiceSessions.delete(session.id), lastMessages = '', lastReview = '';
    const owner = window.TrainerDrafts && TrainerDrafts.profile();
    const root = h('section', { class: 'conversation-view stack' });
    const title = h('h1', null, 'Сложный разговор');
    const stage = h('p', { class: 'conversation-stage', role: 'status', 'aria-live': 'polite' });
    const errorBox = h('div', { class: 'conversation-error', role: 'alert', hidden: true });
    const contextBox = h('details', { class: 'card conversation-context', open: true });
    const history = h('ol', { class: 'conversation-messages', 'aria-label': 'История разговора' });
    const composer = h('section', { class: 'card conversation-composer stack', 'aria-label': 'Ваш ответ' });
    const review = h('section', { class: 'stack', 'aria-label': 'Разбор разговора' });
    const messages = new Map();
    const live = () => !destroyed && ctx.alive() && (!owner || !window.TrainerDrafts || owner === TrainerDrafts.profile());
    const takePath = index => `${endpoint(session.id)}/takes/${index}`;
    const actionPath = verb => `${endpoint(session.id)}/conversation/${verb}`;
    const closeMic = () => { if (recordStream && mic.stream === recordStream) mic.close(); recordStream = null; };
    const pauseAudio = () => root.querySelectorAll('audio').forEach(audio => audio.pause());
    const answerCount = () => userMessages(session).length;
    function button(label, click, primary = false, disabled = false) {
      return h('button', { class: `btn ${primary ? '' : 'ghost'}`, type: 'button', onclick: click, disabled }, label);
    }
    function stageText() {
      if (recorder) return 'Идёт запись вашего ответа. Закончите, когда выразите мысль.';
      if (stopping) return 'Сохраняю запись на устройстве…';
      if (pending && pending.sending) return 'Отправляю ваш ответ…';
      if (busy) return 'Сохраняю…';
      const phase = conversation(session).phase;
      if ((session.analysis || {}).status === 'running') return 'Тренер разбирает разговор. История уже сохранена.';
      if (phase === 'awaiting_user') return `Ваш ответ ${answerCount() + 1} из ${conversation(session).max_responses || 3}. Говорите без ограничения времени.`;
      return phaseNames[phase] || 'Разговор сохранён';
    }
    function draw() {
      if (!live()) return;
      title.textContent = scenarioTitle(session);
      const nextStage = stageText();
      if (stage.textContent !== nextStage) stage.textContent = nextStage;
      errorBox.hidden = !error;
      if (error) errorBox.textContent = error;
      drawMessages(); drawComposer(); drawReview();
      for (const value of messages.values()) if (value.button) value.button.disabled = !!recorder || !!stopping || openingMic;
    }
    function voiceFor(message) {
      const player = h('audio', { preload: 'none', src: url(`${endpoint(session.id)}/conversation/voice/${enc(message.id)}`) });
      const note = h('p', { class: 'small soft', role: 'status', hidden: true });
      const play = button('Послушать реплику', async () => {
        if (recorder || stopping || openingMic) return;
        if (!player.paused) { player.pause(); return; }
        await playVoice();
      });
      play.prepend(icon('speaker'));
      async function playVoice() {
        if (!live() || recorder || stopping || openingMic) return;
        pauseAudio(); note.hidden = true;
        try { if (player.error) player.load(); await player.play(); }
        catch (_) { if (live()) { note.textContent = 'Нажмите «Послушать реплику», чтобы включить звук. Можно ответить и по тексту.'; note.hidden = false; } }
      }
      player.addEventListener('play', () => play.replaceChildren(icon('pause'), 'Пауза'));
      player.addEventListener('pause', () => play.replaceChildren(icon('speaker'), 'Послушать реплику'));
      player.addEventListener('ended', () => play.replaceChildren(icon('speaker'), 'Послушать ещё раз'));
      player.addEventListener('error', () => {
        if (!live()) return;
        note.textContent = 'Озвучка сейчас недоступна. Можно повторить её или ответить по тексту.'; note.hidden = false;
        play.replaceChildren(icon('speaker'), 'Повторить озвучку');
      });
      return { player, button: play, note, play: playVoice };
    }
    function drawMessages() {
      const list = conversation(session).messages || [];
      const key = JSON.stringify(list) + JSON.stringify((session.takes || []).map(take => [take.audio, take.status]));
      if (key === lastMessages) return;
      lastMessages = key;
      let newOpponent = null;
      const nodes = list.map(message => {
        const signature = JSON.stringify(message) + (message.role === 'user' ? ((session.takes || [])[message.take_index] || {}).audio || '' : ''), old = messages.get(message.id);
        if (old && old.signature === signature) return old.node;
        const isUser = message.role === 'user';
        const node = h('li', { class: `conversation-message ${isUser ? 'is-user' : 'is-opponent'}` },
          h('div', { class: 'conversation-role' }, isUser ? `Вы · ответ ${(message.take_index ?? 0) + 1}` : 'Собеседник'), h('p', null, message.text));
        const item = { node, signature };
        if (!isUser) {
          Object.assign(item, voiceFor(message));
          node.append(h('div', { class: 'conversation-message-audio' }, item.player, item.button, item.note));
          if (!old) newOpponent = item;
        } else {
          const take = (session.takes || [])[message.take_index];
          if (take && take.audio) node.append(h('audio', { controls: true, preload: 'none', src: url(`/media/${enc(session.id)}/${enc(take.audio)}`), 'aria-label': `Ваша запись, ответ ${message.take_index + 1}` }));
        }
        messages.set(message.id, item); return node;
      });
      history.replaceChildren(...nodes);
      if (newOpponent && allowAutoVoice && !recorder && !stopping) {
        allowAutoVoice = false; newOpponent.play();
        if (newOpponent.node.scrollIntoView) newOpponent.node.scrollIntoView({ block: 'center', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    }
    function drawComposer() {
      composer.replaceChildren(); composer.hidden = false;
      const phase = conversation(session).phase, locked = busy || loading || !!stopping;
      if (recorder) {
        composer.append(h('h2', null, 'Ваш ответ'), h('p', { class: 'conversation-recording', role: 'status' }, icon('mic'), 'Идёт запись'),
          h('div', { class: 'row' }, button('Закончить и отправить', stopRecording, true), button('Отменить запись', cancelRecording)));
        if (recordWarning) composer.append(h('p', { class: 'small soft', role: 'status' }, recordWarning));
        return;
      }
      if (pending) {
        composer.append(h('h2', null, pending.incomplete ? 'Восстановлена незавершённая запись' : 'Запись вашего ответа'));
        if (pending.incomplete) {
          if (!pending.controls) pending.controls = recoveredRecordingControls(pending, {
            send: sendAnswer, recordAgain: recordAgain, discard: discardPending,
          });
          pending.controls.update(); composer.append(pending.controls.el);
        } else {
          if (!pending.player) pending.player = h('audio', { controls: true, preload: 'metadata', src: pending.downloadUrl, 'aria-label': 'Неотправленный ответ' });
          composer.append(pending.player, h('div', { class: 'row' }, button(pending.sending ? 'Отправляю…' : 'Отправить ответ', sendAnswer, true, pending.sending || pending.blob.size < 1200),
            h('a', { class: 'btn ghost', href: pending.downloadUrl, download: 'ответ' + (pending.blob.type.includes('mp4') ? '.m4a' : '.webm') }, 'Скачать запись'),
            button('Записать заново', recordAgain, false, pending.sending), confirmButton('Убрать копию', 'Убрать эту запись?', discardPending)));
          if (pending.blob.size < 1200) composer.append(h('p', { class: 'small soft' }, 'Запись слишком короткая для отправки. Её можно скачать или записать заново.'));
        }
        if (pending.error) composer.append(h('p', { class: 'conversation-error', role: 'status' }, pending.error));
        return;
      }
      const takeError = phase === 'awaiting_user' && ((session.takes || [])[conversation(session).active_take ?? currentIndex(session)] || {}).status === 'error';
      const analysisError = (session.analysis || {}).status === 'error';
      if (phase === 'opponent_error' || takeError || analysisError) {
        composer.append(h('h2', null, takeError ? 'Не удалось распознать ответ' : analysisError ? 'Разбор пока не готов' : 'Собеседник пока не ответил'),
          h('p', { class: 'soft' }, conversation(session).error || (session.analysis || {}).error || (session.takes || []).find(take => take.error)?.error || 'История сохранена. Можно повторить этот шаг.'),
          button(takeError ? 'Попробовать ответить ещё раз' : 'Повторить этот шаг', () => mutate('retry'), true, locked));
      } else if (phase === 'awaiting_user') {
        composer.append(h('h2', null, 'Ваш ответ'), h('p', { class: 'soft' }, 'Ответьте на последнюю реплику собеседника своими словами.'),
          button('Ответить голосом', beginRecording, true, locked));
      } else if (isWorking(session) || stopping) composer.append(h('p', { role: 'status' }, stageText()));
      else if (phase === 'ready_for_analysis' && (session.analysis || {}).status !== 'done') composer.append(button('Получить разбор', () => mutate('finish'), true, locked));
      else composer.hidden = true;
      if (answerCount() > 0 && ['awaiting_user', 'opponent_error', 'opponent_pending'].includes(phase)) {
        composer.append(button('Завершить и получить разбор', () => mutate('finish'), false, locked));
      }
      if (composer.childElementCount) composer.hidden = false;
    }
    function drawReview() {
      const analysis = session.analysis || {}, result = analysis.result;
      if (analysis.status !== 'done' || !result) { review.replaceChildren(); lastReview = ''; return; }
      const key = JSON.stringify(result);
      if (key === lastReview) return;
      lastReview = key;
      contextBox.open = false;
      const feedback = result.conversation_feedback || {};
      const sourceQuote = (index) => ((session.takes || [])[index] || {}).text || (userMessages(session).find(message => message.take_index === index) || {}).text || '';
      const standard = h('article', { class: 'card stack' }, h('h2', null, 'Разбор тренера'),
        h('div', { class: 'verdict-grid' }, h('div', { class: 'hero-score' }, h('div', { class: 'val' }, f1(result.overall), h('small', null, ' / 10')),
          h('p', { class: 'small soft' }, 'средняя по пяти критериям')), h('p', { class: 'verdict' }, result.verdict)),
        h('div', { class: 'meters' }, criteria.map(([id, name]) => meterRow(name, (result.scores || {})[id], (result.score_notes || {})[id]))),
        h('div', { class: 'cols' }, (result.strengths || []).length ? h('div', null, h('h3', null, 'Сильные стороны'), h('ul', { class: 'list good' }, result.strengths.map(value => h('li', null, value)))) : null,
          (result.growth || []).length ? h('div', null, h('h3', null, 'Точки роста'), h('ul', { class: 'list grow' }, result.growth.map(value => h('li', null, value)))) : null));
      const qualitative = h('article', { class: 'card stack conversation-findings' }, h('h2', null, 'Как прошёл разговор'),
        findings.filter(([id]) => feedback[id]).map(([id, label]) => {
          const finding = feedback[id];
          const cited = (finding.quotes || []).filter(item => item.quote && sourceQuote(item.take_index).includes(item.quote));
          return h('section', null, h('h3', null, label), finding.assessment ? h('p', { class: 'small soft' }, assessmentNames[finding.assessment] || finding.assessment) : null,
            h('p', null, finding.comment), cited.map(item => h('blockquote', null, item.quote)));
        }), h('p', { class: 'small soft' }, 'Это качественный разбор диалога. Оценки речи выше используют прежние пять критериев.'));
      const hasSelectedRewrite = Object.prototype.hasOwnProperty.call(result, 'conversation_rewrite');
      const legacyIndex = (result.takes || []).findIndex(take => take.stronger);
      const legacy = legacyIndex >= 0 && result.takes[legacyIndex];
      const proposed = hasSelectedRewrite ? result.conversation_rewrite : legacy ? { take_index: legacyIndex, quote: sourceQuote(legacyIndex), text: legacy.stronger, why: legacy.stronger_explanation } : null;
      const improved = proposed && proposed.quote && sourceQuote(proposed.take_index).includes(proposed.quote) && proposed.text ? proposed : null;
      const practice = h('article', { class: 'card stack' }, h('h2', null, 'На следующую попытку'),
        result.tip ? h('div', { class: 'callout' }, h('h3', null, 'Главный совет'), h('p', null, result.tip)) : null,
        improved ? h('div', { class: 'conversation-rewrite stack' }, h('h3', null, 'Как сказать сильнее'),
          h('div', null, h('p', { class: 'label' }, 'Ваша реплика'), h('blockquote', null, improved.quote)),
          h('div', null, h('p', { class: 'label' }, 'Вариант с тем же смыслом'), h('p', null, improved.text)),
          improved.why ? h('section', { class: 'stronger-explanation', 'aria-label': 'Как устроен этот ответ' }, h('h3', null, 'Как устроен этот ответ'), h('p', null, improved.why)) : null) : null,
        h('div', { class: 'row' }, button('Повторить этот разговор', () => mutate('repeat'), true), button('Тот же совет в другой ситуации', () => mutate('transfer'))));
      review.replaceChildren(standard, qualitative, practice);
    }
    async function refresh() {
      if (!live() || loading) return;
      loading = true;
      try { const fresh = await api(endpoint(session.id)); if (live()) { session = fresh; error = ''; draw(); } }
      catch (caught) { if (live()) { error = caught.message; draw(); } }
      finally { loading = false; draw(); schedulePoll(); }
    }
    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!live()) return;
      const queuedReview = conversation(session).phase === 'ready_for_analysis' && (session.analysis || {}).status === 'waiting';
      if (isWorking(session) || queuedReview || (pending && pending.error && pendingChecks++ < 3)) pollTimer = setTimeout(refresh, 2000);
    }
    async function mutate(verb) {
      if (!live() || busy || recorder || stopping || pending) return;
      busy = true; error = ''; pauseAudio(); draw();
      try {
        const fresh = await api(actionPath(verb), { method: 'POST', body: {} });
        if (!live()) return;
        if (['repeat', 'transfer'].includes(verb)) { autoVoiceSessions.add(fresh.id); location.hash = href(fresh.id); }
        else { session = fresh; allowAutoVoice = verb === 'retry'; draw(); }
      } catch (caught) { if (live()) { error = caught.message; draw(); } }
      finally { busy = false; draw(); schedulePoll(); }
    }
    async function beginRecording() {
      if (!live() || recorder || stopping || pending || busy || conversation(session).phase !== 'awaiting_user') return;
      const token = ++startToken, index = currentIndex(session);
      busy = true; openingMic = true; error = ''; recordWarning = ''; pauseAudio(); draw();
      try {
        const stream = await mic.open();
        if (!live() || token !== startToken || conversation(session).phase !== 'awaiting_user') { if (mic.stream === stream) mic.close(); return; }
        recordStream = stream;
        recordContext = window.TrainerDrafts && TrainerDrafts.context();
        recorder = new Recorder(recordStream, { journal: { path: takePath(index), userId: session.user ?? (app.state && app.state.user_id), context: recordContext,
          onStatus: status => { if (!status.durable && status.notice && status.notice !== recordWarning && live()) { recordWarning = status.notice; draw(); } } } });
        recorder.start();
      } catch (caught) { error = caught.message; if (recorder) recorder.cancel({ preserve: true }); recorder = null; closeMic(); }
      finally { busy = false; openingMic = false; draw(); }
    }
    async function stopRecording() {
      if (!recorder || stopping) return;
      const stopped = recorder, index = currentIndex(session), context = recordContext;
      recorder = null; stopping = stopped; draw();
      try {
        const recorded = await stopped.stop();
        let saved = stopped.savedDraft;
        if (!saved && window.TrainerDrafts && recorded.size) saved = await TrainerDrafts.audio(takePath(index), recorded, {}, undefined, context || {});
        if (!live()) return;
        pending = { index, idx: index, blob: recorded, requestId: saved && saved.requestId, profile: saved && saved.profile || owner,
          draftId: saved && saved.id, path: takePath(index), downloadUrl: URL.createObjectURL(recorded), headers: saved && saved.headers || {}, sending: false, error: '' };
        if (saved && !saved.durable) pending.error = 'Запись есть в открытой странице, но браузер не смог сохранить её надолго. Не закрывайте страницу до отправки или скачивания.';
      } catch (caught) { if (live()) error = caught.message; }
      finally { stopping = null; closeMic(); draw(); }
      if (live() && pending && pending.blob.size >= 1200) await sendAnswer();
    }
    function cancelRecording() {
      startToken++;
      if (recorder) recorder.cancel();
      recorder = null; closeMic(); draw();
    }
    function clearPending() {
      if (!pending) return;
      if (pending.controls) pending.controls.pause();
      if (pending.player) pending.player.pause();
      URL.revokeObjectURL(pending.downloadUrl); pending = null;
    }
    function recordAgain() {
      if (!pending || pending.sending) return;
      clearPending(); draw();
      if (conversation(session).phase === 'awaiting_user') beginRecording();
    }
    async function discardPending() {
      const old = pending;
      if (!old || old.sending || !window.TrainerDrafts) return;
      if (old.incomplete) {
        const removed = await TrainerDrafts.removeRecording(old.recordingId, old.recordingRequestId, old.profile);
        if (!removed) { old.error = 'Не удалось убрать копию с устройства. Попробуйте ещё раз.'; draw(); return; }
      } else await TrainerDrafts.remove(old.draftId || 'audio:' + old.path, old.requestId, old.profile);
      if (pending === old && live()) { clearPending(); draw(); }
    }
    async function sendAnswer() {
      const current = pending;
      if (!live() || !current || current.sending || current.blob.size < 1200 || (current.incomplete && current.playback !== 'ready')) return;
      current.sending = true; current.error = ''; pauseAudio(); draw();
      try {
        if (current.incomplete && !current.requestId && window.TrainerDrafts) {
          const claim = await TrainerDrafts.operation('PUT', current.path, current.blob, { ...(current.headers || {}), 'X-Trainer': '1', 'Content-Type': current.blob.type || 'application/octet-stream' });
          const prepared = TrainerDrafts.prepareRecovery ? await TrainerDrafts.prepareRecovery(current.recordingId, current.recordingRequestId, claim, current.headers || {}, current.profile) : claim;
          current.requestId = prepared.requestId;
        }
        if (!live()) return;
        const fresh = await api(current.path, { method: 'PUT', blob: current.blob, headers: current.headers, requestId: current.requestId,
          onRequestId: id => { current.requestId = id; } });
        if (current.incomplete && window.TrainerDrafts) await TrainerDrafts.removeRecording(current.recordingId, current.recordingRequestId, current.profile);
        if (!live()) return;
        if (pending === current) clearPending();
        session = fresh; error = ''; allowAutoVoice = true; pendingChecks = 0;
      } catch (caught) { if (live()) { current.error = caught.message; if (caught.requestId) current.requestId = caught.requestId; } }
      finally { current.sending = false; draw(); schedulePoll(); }
    }
    async function restoreAudio() {
      if (!window.TrainerDrafts) return;
      const prefix = endpoint(session.id) + '/takes/';
      const records = (await TrainerDrafts.list()).filter(record => record.kind === 'audio' && record.path.startsWith(prefix) && record.blob)
        .sort((a, b) => b.updated - a.updated);
      if (!live()) return;
      const saved = records.find(record => /^\d+$/.test(record.path.slice(prefix.length)) && (session.plan || [])[Number(record.path.slice(prefix.length))]);
      if (saved) {
        const index = Number(saved.path.slice(prefix.length));
        pending = { index, idx: index, blob: saved.blob, requestId: saved.requestId, profile: saved.profile, draftId: saved.id,
          path: saved.path, downloadUrl: URL.createObjectURL(saved.blob), headers: saved.headers || {}, sending: false, error: 'Этот ответ сохранился на устройстве. Отправка произойдёт только после нажатия кнопки.' };
        return;
      }
      if (!TrainerDrafts.recordings || !TrainerDrafts.recoverRecording) return;
      const list = (await TrainerDrafts.recordings()).filter(record => record.sessionId === session.id && record.takeIndex != null && (session.plan || [])[record.takeIndex]).sort((a, b) => b.updated - a.updated);
      for (const record of list) {
        const restored = await TrainerDrafts.recoverRecording(record.id);
        if (!live()) return;
        if (!restored || !restored.blob || !restored.blob.size) continue;
        pending = { index: record.takeIndex, idx: record.takeIndex, blob: restored.blob, requestId: null, profile: restored.profile,
          path: record.path, headers: record.headers || {}, recordingId: record.id, recordingRequestId: record.requestId,
          incomplete: true, playback: 'unverified', downloadUrl: URL.createObjectURL(restored.blob), sending: false, error: restored.notice };
        break;
      }
    }
    function onReconnect() { if (live() && !recorder && !stopping) refresh(); }
    function beforeUnload(event) { if (recorder || stopping || pending) { event.preventDefault(); event.returnValue = ''; } }
    const scenario = conversation(session).scenario || {};
    const practiceTip = (conversation(session).practice || {}).source_tip || conversation(session).source_tip;
    contextBox.append(h('summary', null, 'Контекст и ваша цель'), h('div', { class: 'stack' }, h('p', null, scenario.context || session.topic),
      h('div', { class: 'conversation-goal' }, h('h2', null, 'Ваша цель'), h('p', null, scenario.user_goal)), h('p', { class: 'small soft' }, 'Собеседник: ', scenario.opponent_role),
      practiceTip ? h('div', { class: 'callout' }, h('p', { class: 'label' }, 'Совет из предыдущего разговора'), h('p', null, practiceTip)) : null));
    root.append(h('a', { class: 'back', href: href() }, icon('back'), 'К ситуациям'), h('header', { class: 'conversation-heading' }, h('p', { class: 'label' }, 'Сложный разговор'), title, stage),
      contextBox, errorBox, history, composer, review);
    render(ctx, root);
    await restoreAudio(); draw(); schedulePoll();
    window.addEventListener('trainer:backendchange', onReconnect);
    window.addEventListener('beforeunload', beforeUnload);
    return { destroy() {
      destroyed = true; startToken++; clearTimeout(pollTimer);
      window.removeEventListener('trainer:backendchange', onReconnect); window.removeEventListener('beforeunload', beforeUnload);
      pauseAudio();
      if (recorder) recorder.cancel({ preserve: true }); recorder = null;
      closeMic(); clearPending();
    } };
  }
  return { view, homeCard };
})();
