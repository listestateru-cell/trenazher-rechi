'use strict';
/* Стартовый срез: текст открывается только при работающем микрофоне. */
window.TrainerAssessment = (() => {
  const list = value => Array.isArray(value) ? value : [];
  const keep = value => value.flat(Infinity).filter(item => item != null && item !== false);
  const enc = encodeURIComponent;
  const base = '/api/assessment';
  const number = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';
  const date = value => {
    if (!value) return '';
    try { return new Date(value.length === 10 ? value + 'T12:00:00+09:00' : value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Yakutsk' }); } catch (_) { return value; }
  };
  const choices = [
    { key: 'age_band', label: 'Ваш возраст', options: [['under11', 'До 11 лет'], ['11_13', '11–13 лет'], ['14_17', '14–17 лет'], ['adult', '18 лет и старше']] },
    { key: 'goal', label: 'Что хочется улучшить в первую очередь?', options: [['clarity', 'Понятно выражать мысли'], ['confidence', 'Увереннее говорить'], ['vocabulary', 'Легче подбирать слова'], ['study', 'Отвечать и выступать на учёбе'], ['work', 'Общаться и выступать на работе']] },
    { key: 'reading_frequency', label: 'Как часто вы читаете книги или длинные статьи?', options: [['rarely', 'Редко'], ['weekly', 'Несколько раз в неделю'], ['daily', 'Каждый день']] },
    { key: 'speaking_experience', label: 'Был ли опыт занятий речью или выступлений?', options: [['none', 'Почти не было'], ['some', 'Иногда занимался или выступал'], ['regular', 'Регулярно занимаюсь или выступаю']] },
  ];
  function card(kind, overview) {
    const done = list(overview && overview.history).some(item => item.confirmed || item.confirmed_at || item.phase === 'confirmed');
    const title = done ? 'Ваши контрольные срезы' : 'Точка старта';
    return h('section', { class: 'card assessment-entry', 'data-assessment-entry': kind }, h('div', { class: 'assessment-entry-icon', 'aria-hidden': 'true' }, icon('mic')),
      h('div', { class: 'stack' }, h('h2', null, title), h('p', { class: 'soft' }, done ? 'Сравните чтение и понимание текста с первым срезом.' : 'Короткий опрос и минута чтения вслух помогут подобрать нагрузку и увидеть изменения через месяц.'),
        h('a', { href: '#/assessment', class: 'btn ghost' }, done ? 'Открыть срезы' : 'Пройти срез', icon('arrow'))));
  }
  async function view(ctx, requestedSession) {
    const root = h('div', { class: 'assessment-page' });
    const owner = window.TrainerDrafts && TrainerDrafts.profile();
    let disposed = false, overview = null, session = null, loading = true, busy = false, stopping = false, error = '', warning = '';
    let recording = null, stream = null, pending = null, shownText = '', startedAt = 0, offset = 0, readSeconds = 0, capture = 0, timer = 0, ticker = 0, poller = 0, archived = false;
    let questionnaire = {}, answers = {}, editing = false, timerNode = null;
    const commandIds = new Map();
    const live = () => !disposed && ctx.alive() && (!window.TrainerDrafts || owner === TrainerDrafts.profile());
    const state = () => session && session.assessment || {};
    const phase = () => state().phase || 'ready';
    const working = () => ['processing', 'reviewing'].includes(phase());
    const locked = () => busy || stopping || !!recording;
    const path = verb => `${base}/${enc(session.id)}/${verb}`;
    const audioPath = () => path('audio');
    const replace = (...children) => root.replaceChildren(...keep(children));
    const button = (label, action, primary = false, disabled = false, data = {}) => h('button', { type: 'button', class: primary ? 'btn' : 'btn ghost', onclick: action, disabled, ...data }, label);
    const remaining = () => Math.max(0, Math.ceil(60 - (performance.now() - startedAt) / 1000));
    const clockText = value => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    const retries = () => Number.isFinite(state().restarts_left) ? state().restarts_left : Number.isFinite(state().attempt_number) ? Math.max(0, 3 - state().attempt_number) : 2;
    const closeMic = (value = stream) => { if (value && mic.stream === value) mic.close(); if (stream === value) stream = null; };
    function clearTimer() { clearTimeout(timer); clearTimeout(ticker); timer = 0; ticker = 0; }
    function clearPending() {
      if (!pending) return;
      pending.player?.pause?.(); pending.controls?.pause?.();
      if (pending.downloadUrl) URL.revokeObjectURL(pending.downloadUrl);
      pending = null;
    }
    async function command(verb, body = {}, sid = session && session.id) {
      const target = sid ? `${base}/${enc(sid)}/${verb}` : `${base}/${verb}`;
      const key = `assessment-command:${target}`;
      let requestId = commandIds.get(key), persistence = Promise.resolve();
      if (!requestId && window.TrainerDrafts) requestId = (await TrainerDrafts.get(key, owner))?.requestId;
      const remember = value => {
        requestId = value; commandIds.set(key, value);
        if (window.TrainerDrafts) persistence = persistence.then(() => TrainerDrafts.put(key, { kind: 'assessment-command', requestId: value, path: target }, owner)).catch(() => {});
      };
      try {
        const value = await api(target, { method: 'POST', body, requestId, onRequestId: remember });
        await persistence; commandIds.delete(key); if (window.TrainerDrafts) await TrainerDrafts.remove(key, requestId, owner);
        return value;
      } catch (caught) {
        if (caught.requestId) remember(caught.requestId);
        await persistence;
        if (caught.status >= 400 && caught.status < 500 && !caught.requestState) {
          commandIds.delete(key); if (window.TrainerDrafts) await TrainerDrafts.remove(key, requestId, owner);
        }
        throw caught;
      }
    }
    function noticeNodes() {
      return keep([error ? h('p', { role: 'alert', class: 'assessment-error' }, error) : null,
        warning ? h('p', { role: 'status', class: 'assessment-notice' }, warning) : null]);
    }
    function field(group, values, prefix, onChange) {
      return h('fieldset', { class: 'assessment-fieldset' }, h('legend', null, group.label),
        h('div', { class: 'assessment-options' }, group.options.map(([value, label], index) => {
          const id = `${prefix}-${group.key}-${index}`;
          return h('label', { for: id, class: 'assessment-option' }, h('input', { type: 'radio', id, name: `${prefix}-${group.key}`, value, checked: values[group.key] === value, disabled: locked(), required: true,
            onchange: () => { values[group.key] = value; onChange(); } }), h('span', null, label));
        })));
    }
    function drawQuestionnaire() {
      const submit = button(busy ? 'Сохраняю…' : 'Сохранить и перейти к чтению', saveQuestionnaire, true, locked() || choices.some(group => !questionnaire[group.key]), { 'data-assessment-save-questionnaire': '' });
      const form = h('form', { class: 'card assessment-questionnaire stack', onsubmit: event => { event.preventDefault(); return saveQuestionnaire(); }, 'aria-label': 'Опрос перед стартовым срезом' },
        h('h2', null, 'Немного о вас'), h('p', { class: 'soft' }, 'Здесь нет правильных ответов. Выберите то, что ближе к вашему обычному опыту.'),
        choices.map(group => field(group, questionnaire, 'assessment', () => { submit.disabled = locked() || choices.some(item => !questionnaire[item.key]); })),
        ...noticeNodes(), submit,
        h('a', { href: '#/', class: 'assessment-later' }, 'Пройти позже и вернуться к тренировкам'));
      return form;
    }
    async function saveQuestionnaire() {
      if (!live() || locked() || choices.some(group => !questionnaire[group.key])) return;
      busy = true; error = ''; draw();
      try { const fresh = await command('questionnaire', { ...questionnaire }, null); if (live()) { overview = fresh; session = fresh.current || null; editing = false; } }
      catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) draw(); }
    }
    function intro() {
      const currentRound = list(overview.rounds).find(round => round.id === state().round_id) || list(overview.rounds).find(round => round.available && !round.confirmed_session_id);
      return h('section', { class: 'card assessment-preparation stack', 'data-assessment-preparation': '' },
        h('span', { class: 'chip' }, currentRound?.title || 'Первый срез'), h('h2', null, 'Минута чтения вслух'),
        h('p', null, 'Сохраним исходные замеры. Через месяц повторим с новым текстом.'),
        h('p', null, 'Выберите тихое место, где вас не отвлекут. Читайте в обычном темпе.'),
        h('p', { class: 'small soft' }, 'Текст откроется после запуска микрофона. На чтение — до 60 секунд.'),
        h('p', { class: 'small soft' }, 'Одна попытка и ещё два повтора, если что-то помешало. При каждом повторе будет новый текст.'),
        button(busy ? 'Готовлю запись…' : 'Начать чтение', beginRecording, true, locked() || !!pending, { 'data-assessment-begin': '' }),
        h('details', null, h('summary', null, 'Как проходит срез'),
          h('ol', { class: 'assessment-instructions' }, h('li', null, 'Нажмите «Начать чтение» и разрешите микрофон. Текст появится, когда запись уже начнётся.'),
            h('li', null, 'Читайте вслух до остановки записи через минуту. Если прочитаете всё раньше, нажмите «Закончил читать».'),
            h('li', null, 'Отправьте запись, затем ответьте на короткие вопросы по прочитанному.')),
          h('p', { class: 'small soft' }, 'Спешить ради скорости не нужно. Этот срез не влияет на место в группе.')),
        button('Изменить ответы опроса', () => { editing = true; draw(); }, false, locked()),
        h('a', { class: 'assessment-later', href: '#/' }, 'Вернуться к тренировкам'));
    }
    function interrupted() {
      return h('section', { class: 'card stack' }, h('h2', null, 'Чтение прервалось'),
        h('p', null, 'Этот текст уже открывался. Чтобы следующий срез был первым чтением, для новой попытки нужен другой текст.'),
        h('p', { class: 'small soft' }, retries() > 0 ? `Повторов осталось: ${retries()}. Если запись сохранилась на устройстве, отправьте её.` : 'Два повтора уже использованы. Если запись сохранилась на устройстве, её можно отправить.'),
        retries() > 0 ? button('Новый текст и повтор', restart, true, locked(), { 'data-assessment-restart': '' }) : null,
        button('Проверить сохранённую запись', refresh, false, locked()), h('a', { href: '#/', class: 'btn ghost' }, 'К тренировкам'));
    }
    function recordingCard() {
      timerNode = h('strong', { class: 'assessment-countdown num', role: 'timer', 'aria-label': 'Время до конца чтения', 'data-assessment-timer': '' }, clockText(remaining()));
      return h('section', { class: 'card assessment-reading stack', 'data-assessment-reading': '' },
        h('div', { class: 'assessment-reading-head' }, h('span', { class: 'assessment-recording-label' }, h('i', { 'aria-hidden': 'true' }), 'Идёт запись'), timerNode),
        h('h2', null, 'Читайте вслух'), h('div', { class: 'assessment-reading-text', tabindex: -1 }, shownText),
        button('Закончил читать', () => stopRecording(true), true, stopping || busy, { 'data-assessment-finish-reading': '' }),
        h('p', { class: 'small soft' }, 'Запись остановится сама через минуту. Можно не успеть прочитать весь текст.'));
    }
    function pendingCard() {
      if (pending.incomplete && typeof recoveredRecordingControls === 'function') {
        pending.sending = locked();
        if (!pending.controls) pending.controls = recoveredRecordingControls(pending, { send: sendAudio, recordAgain: restart, discard: discardPending });
        pending.controls.update();
        pending.controls.el.querySelectorAll?.('button').forEach(control => { if (control.textContent === 'Записать заново') control.disabled = locked() || archived || retries() <= 0; });
        return h('section', { class: 'card stack' }, h('h2', null, 'Восстановлена часть записи'), pending.controls.el, pending.error ? h('p', { class: 'assessment-error', role: 'alert' }, pending.error) : null);
      }
      if (!pending.player) pending.player = h('audio', { controls: true, preload: 'metadata', src: pending.downloadUrl, 'aria-label': 'Ваша запись чтения' });
      return h('section', { class: 'card stack', 'data-assessment-pending': '' }, h('h2', null, 'Запись готова'),
        h('p', { class: 'soft' }, 'Текст скрыт. Можно прослушать запись и отправить её для замера.'), pending.player,
        pending.incomplete ? h('p', { class: 'assessment-notice' }, 'Это часть незавершённой записи. Проверьте её воспроизведение перед отправкой.') : null,
        h('div', { class: 'assessment-actions' }, button(busy ? 'Отправляю…' : pending.error ? 'Повторить отправку' : 'Отправить запись', sendAudio, true, locked() || pending.blob.size < 1200 || pending.incomplete && pending.playback !== 'ready', { 'data-assessment-send-audio': '' }),
          h('a', { class: 'btn ghost', href: pending.downloadUrl, download: pending.blob.type.includes('mp4') ? 'чтение.m4a' : 'чтение.webm' }, 'Скачать запись')),
        pending.error ? h('p', { role: 'alert', class: 'assessment-error' }, pending.error) : null,
        retries() > 0 ? button('Меня отвлекли — другой текст', restart, false, locked(), { 'data-assessment-restart': '' }) : null);
    }
    function resultCard() {
      const data = state(), result = data.result || {}, metrics = result.metrics || {}, comprehension = result.comprehension || {};
      const metric = (label, value, help) => h('div', { class: 'assessment-metric' }, h('strong', { class: 'num' }, value), h('span', null, label), help ? h('small', { class: 'soft' }, help) : null);
      const rate = metrics.recognized_wpm;
      return h('section', { class: 'card assessment-result stack', 'data-assessment-result': '' }, h('h2', null, phase() === 'confirmed' || data.confirmed_at ? 'Срез сохранён' : 'Результат чтения'),
        h('div', { class: 'assessment-metrics' }, metric('слов распознано в минуту', number(rate), 'Темп записи по распознаванию речи'),
          metric('секунд чтения', number(metrics.duration, 1), 'Длительность прочитанной записи'),
          Number.isFinite(metrics.pause_share) ? metric('доля пауз', `${number(metrics.pause_share * 100, 1)}%`, 'Включая смысловые паузы') : null,
          Number.isFinite(comprehension.correct) && Number.isFinite(comprehension.total) ? metric('ответов по смыслу', `${comprehension.correct} из ${comprehension.total}`, '') : null),
        h('p', { class: 'assessment-measure-note small soft' }, 'Скорость сама по себе не показывает, насколько хорошо вы понимаете текст или выражаете мысли. Мы смотрим на чтение вместе с ответами по смыслу. Ошибки распознавания могут повлиять на замер.'),
        list(result.warnings).length ? h('ul', { class: 'assessment-notice-list' }, list(result.warnings).map(value => h('li', null, typeof value === 'string' ? value : value.message || 'Проверьте запись перед сравнением.'))) : null,
        typeof result.recommendation === 'string' ? h('p', null, result.recommendation) : result.recommendation?.summary ? h('p', null, result.recommendation.summary) : null,
        result.transcript || data.transcript || session.takes?.[0]?.transcript_text ? h('details', { class: 'assessment-transcript' }, h('summary', null, 'Как распозналась запись'), h('p', null, result.transcript || data.transcript || session.takes[0].transcript_text)) : null,
        result.comparison ? h('div', { class: 'assessment-comparison stack' }, h('h3', null, 'По сравнению с первым срезом'),
          h('p', null, result.comparison.note || 'Сравнение зависит от условий записи и сложности текста.'),
          result.comparison.status === 'comparable' && Number.isFinite(result.comparison.recognized_wpm_change) ? h('p', { class: 'small soft' }, `Темп распознанной речи: ${result.comparison.recognized_wpm_change > 0 ? '+' : ''}${number(result.comparison.recognized_wpm_change, 1)} слов/мин. Более высокий темп сам по себе не означает лучшего понимания.`) : null,
          result.comparison.status === 'comparable' && Number.isFinite(result.comparison.pause_share_change) ? h('p', { class: 'small soft' }, `Доля пауз: ${result.comparison.pause_share_change > 0 ? '+' : ''}${number(result.comparison.pause_share_change * 100, 1)} п.п. Паузы могут помогать передавать смысл.`) : null,
          result.comparison.status === 'comparable' && Number.isFinite(result.comparison.comprehension_change) ? h('p', { class: 'small soft' }, result.comparison.comprehension_change === 0 ? 'Такой же результат по ответам на вопросы.' : `Результат по ответам на вопросы: ${result.comparison.comprehension_change > 0 ? '+' : ''}${number(result.comparison.comprehension_change * 100, 1)} п.п.`) : null) : null,
        !archived && phase() !== 'confirmed' && !data.confirmed_at && result.usable === false ? h('p', { class: 'assessment-notice' }, 'Эта запись не подходит для надёжного сравнения. Попытка сохранена в истории. Можно взять другой текст, если остались повторы, или продолжить тренировки.') : null,
        !archived && phase() !== 'confirmed' && !data.confirmed_at && result.usable !== false ? list(data.questions).length ? questionsCard()
          : h('div', { class: 'stack' }, h('p', { class: 'small soft' }, 'Для этой записи нет надёжных вопросов по прочитанному. Сохраним замер с этой отметкой.'), button('Сохранить срез', confirm, true, locked(), { 'data-assessment-confirm': '' })) : null,
        !archived && retries() > 0 && !['confirmed', 'processing', 'reviewing'].includes(phase()) ? button('Повторить с другим текстом', restart, false, locked(), { 'data-assessment-restart': '' }) : null);
    }
    function questionsCard() {
      const questions = list(state().questions);
      const submit = button(busy ? 'Сохраняю…' : 'Сохранить срез', confirm, true, locked() || questions.some(item => !Number.isInteger(answers[item.id])), { 'data-assessment-confirm': '' });
      return h('form', { class: 'assessment-comprehension stack', onsubmit: event => { event.preventDefault(); return confirm(); } }, h('h3', null, 'Что запомнилось по смыслу?'),
        h('p', { class: 'small soft' }, 'Ответьте по памяти. Эти вопросы относятся к прочитанной части текста.'),
        questions.map(question => field({ key: question.id, label: question.prompt, options: list(question.options).map((value, index) => [index, value]) }, answers, 'assessment-question', () => { submit.disabled = locked() || questions.some(item => !Number.isInteger(answers[item.id])); })), submit);
    }
    function adaptationCard() {
      const adaptation = overview && overview.adaptation;
      if (!adaptation) return null;
      const title = adaptation.title || adaptation.label || 'Нагрузка для вас';
      const description = adaptation.description || adaptation.reason || adaptation.summary;
      const recommendations = list(adaptation.recommendations);
      return h('section', { class: 'card assessment-adaptation stack' }, h('h2', null, title), description ? h('p', null, description) : null,
        recommendations.length ? h('ul', null, recommendations.map(item => h('li', null, typeof item === 'string' ? item : item.text || item.title || ''))) : null,
        Number.isFinite(adaptation.reading_minutes) ? h('p', null, `Чтение для пересказа: около ${number(adaptation.reading_minutes)} мин.`) : null,
        h('p', { class: 'small soft' }, 'Это начальная настройка сложности. Её можно уточнять по результатам занятий.'));
    }
    function roundsCard() {
      const rounds = list(overview.rounds);
      if (!rounds.length) return null;
      const canRepeat = round => {
        const latest = list(overview.history).filter(item => item.round_id === round.id).at(-1);
        return !archived && !locked() && !pending && !working() && (!session || phase() === 'confirmed')
          && round.confirmed_session_id && round.restarts_left > 0 && latest?.phase === 'confirmed'
          && latest.session_id === round.confirmed_session_id
          && (round.id !== 'baseline' || !rounds.some(item => item.id !== 'baseline' && item.available));
      };
      return h('section', { class: 'card stack assessment-rounds' }, h('h2', null, 'Сравнение с собой'),
        h('ol', null, rounds.map(round => h('li', { class: round.confirmed_session_id ? 'is-done' : round.available ? 'is-available' : '' },
          h('span', { class: 'assessment-round-mark', 'aria-hidden': 'true' }, round.confirmed_session_id ? '✓' : '○'),
          h('div', null, h('strong', null, round.title), h('p', { class: 'small soft' }, round.confirmed_session_id ? 'Срез сохранён' : round.available ? 'Можно пройти' : round.due_at ? 'С ' + date(round.due_at) : 'После первого среза')),
          round.available && !round.confirmed_session_id && !archived && !locked() && !pending && !working() && (!session || phase() === 'confirmed') ? button('Пройти', () => beginRecording(round.id), false, false, { 'data-assessment-round': round.id }) : null,
          canRepeat(round) ? h('div', { class: 'stack' }, button('Повторить с другим текстом', () => repeatConfirmed(round), false, false, { 'data-assessment-repeat-confirmed': round.id }),
            h('p', { class: 'small soft' }, `Повторов осталось: ${round.restarts_left}. Новый текст откроется только после запуска записи.`)) : null))),
        h('p', { class: 'small soft' }, 'Первый срез, затем через один, два и три месяца. Тексты будут новыми, а формат чтения останется тем же.'));
    }
    function historyCard() {
      const history = list(overview.history);
      if (!history.length) return null;
      return h('section', { class: 'card stack assessment-history' }, h('h2', null, 'Все попытки среза'),
        h('ul', null, history.map(item => h('li', null, h('a', { href: `#/assessment?session=${enc(item.session_id || item.id)}` },
          h('span', null, h('strong', null, item.round_title || item.title || 'Чтение вслух'), h('span', { class: 'small soft' }, `${date(item.created || item.created_at)}${item.attempt_number ? ` · попытка ${item.attempt_number}` : ''}`)),
          h('span', { class: 'small' }, item.confirmed || item.confirmed_at || item.phase === 'confirmed' ? 'Сохранён' : item.phase === 'error' ? 'Нужна проверка' : 'Попытка', icon('arrow')))))),
        h('p', { class: 'small soft' }, 'Все попытки остаются в истории. Для сравнения используем сохранённый срез, а не выбираем самый быстрый результат.'));
    }
    function draw() {
      if (!live()) return;
      const heading = h('header', { class: 'assessment-heading stack' }, h('a', { class: 'back', href: archived ? '#/assessment' : '#/profile' }, icon('back'), archived ? 'К срезам' : 'Мой профиль'),
        h('h1', null, 'Точка старта'), h('p', { class: 'soft' }, 'Замеры чтения и понимания текста.'));
      if (!overview) { replace(heading, h('section', { class: 'card stack' }, h('p', { role: loading ? 'status' : 'alert' }, loading ? 'Загружаю срезы…' : error), !loading ? button('Попробовать ещё раз', load) : null)); return; }
      if (!overview.questionnaire || editing) { replace(heading, drawQuestionnaire()); return; }
      let main;
      if (recording && shownText) main = recordingCard();
      else if (recording || busy && !session) main = h('section', { class: 'card stack', role: 'status' }, h('h2', null, 'Готовлю запись…'), h('p', null, 'Текст появится после включения микрофона.'));
      else if (stopping) main = h('section', { class: 'card', role: 'status' }, 'Сохраняю запись на устройстве…');
      else if (pending) main = pendingCard();
      else if (working()) main = h('section', { class: 'card stack', role: 'status' }, h('h2', null, 'Считаю показатели'), h('p', null, 'Запись принята. Можно оставить страницу открытой или вернуться позже.'));
      else if (session && phase() === 'error') main = h('section', { class: 'card stack' }, h('h2', null, 'Не удалось завершить замер'), h('p', { role: 'alert' }, state().error || 'Запись сохранена. Можно повторить её обработку.'), button('Повторить обработку', retry, true, locked()), retries() > 0 ? button('Прочитать другой текст', restart, false, locked()) : null);
      else if (session && state().result) main = resultCard();
      else if (session && phase() === 'recording') main = interrupted();
      else if (archived) main = h('section', { class: 'card' }, h('h2', null, 'Эта попытка не завершена'), h('a', { class: 'btn ghost', href: '#/assessment' }, 'К текущему срезу'));
      else if (list(overview.rounds).every(round => !round.available || round.confirmed_session_id) && list(overview.rounds).length) main = h('section', { class: 'card stack' }, h('h2', null, 'Точка старта сохранена'), h('p', null, overview.next_due ? 'Следующий срез: ' + date(typeof overview.next_due === 'string' ? overview.next_due : overview.next_due.due_at) : 'Следующий срез откроется через месяц.'), h('a', { class: 'btn', href: '#/program' }, 'К программе дня'));
      else main = intro();
      replace(heading, ...noticeNodes(), main, recording || stopping ? null : adaptationCard(), recording || stopping ? null : roundsCard(), recording || stopping ? null : historyCard());
    }
    async function load() {
      if (!live() || locked()) return;
      loading = true; error = ''; draw();
      try {
        const fresh = await api(base); if (!live()) return;
        overview = fresh; questionnaire = { ...(fresh.questionnaire || {}) };
        const selected = requestedSession || new URLSearchParams(location.hash.split('?')[1] || '').get('session');
        if (selected && /^[a-zA-Z0-9_-]{1,100}$/.test(selected)) {
          let detailed;
          try { detailed = await api(`/api/sessions/${enc(selected)}`); }
          catch (caught) {
            const saved = list(fresh.history).find(item => item.session_id === selected && item.deleted);
            if (caught.status !== 404 || !saved) throw caught;
            detailed = { id: selected, exercise: 'assessment', assessment: { phase: saved.phase, round_id: saved.round_id,
              attempt_number: saved.attempt_number, restarts_left: 0, result: saved.result, confirmed_at: saved.confirmed_at } };
          }
          if (!live()) return;
          if (!detailed.assessment) throw new Error('Это занятие не относится к контрольным срезам.');
          session = detailed; archived = !fresh.current || fresh.current.id !== selected;
        } else { session = fresh.current || null; archived = false; }
        await restore();
      } catch (caught) { if (live()) error = caught.message; }
      finally { loading = false; if (live()) { draw(); schedule(); } }
    }
    async function beginRecording(roundId) {
      if (typeof roundId !== 'string') roundId = null;
      if (!live() || locked() || pending || archived || working()) return;
      busy = true; error = ''; warning = ''; shownText = ''; const token = ++capture; draw();
      try {
        if (!session || phase() === 'confirmed' && roundId) { const fresh = await command('start', roundId ? { round_id: roundId } : {}, null); if (!live() || token !== capture) return; session = fresh; answers = {}; }
        if (phase() !== 'ready') throw new Error('Этот текст уже открывался. Возьмите новый текст для повторного среза.');
        const opened = await mic.open(); if (!live() || token !== capture) { closeMic(opened); return; }
        stream = opened;
        recording = new Recorder(opened, { journal: { path: audioPath(), userId: session.user, context: { profile: owner, route: '#/assessment' }, onStatus: value => { if (live() && !value.durable) { warning = value.notice; } } } });
        recording.start();
        const fresh = await command('reveal');
        if (!live() || token !== capture) { recording?.cancel({ preserve: true }); recording = null; closeMic(opened); return; }
        if (!fresh.assessment?.reading?.text) throw new Error('Текст не открылся. Проверьте связь и состояние попытки.');
        session = fresh; shownText = fresh.assessment.reading.text; startedAt = performance.now(); readSeconds = 0; busy = false; draw();
        offset = Math.max(0, recording.elapsed || 0); startedAt = performance.now();
        if (recording.journal?.updateHeaders) recording.journal.updateHeaders({ 'X-Reading-Offset-Seconds': String(offset) }).catch(() => {});
        timer = setTimeout(() => { warning = 'Минута прошла. Запись остановлена и ждёт отправки.'; stopRecording(false); }, 60000);
        function tick() { if (!live() || !recording || !shownText) return; if (timerNode) timerNode.textContent = clockText(remaining()); ticker = setTimeout(tick, 250); }
        ticker = setTimeout(tick, 250);
      } catch (caught) {
        if (recording) { await recording.cancel(); recording = null; }
        closeMic();
        if (live()) { error = caught.message; try { const fresh = await api(base); if (live()) { overview = fresh; session = fresh.current || session; } } catch (_) {} }
      } finally { busy = false; if (live()) draw(); }
    }
    async function stopRecording(finishedEarly) {
      if (!live() || !recording || stopping || !shownText) return;
      const recorder = recording, target = audioPath(); recording = null; stopping = true; readSeconds = Math.min(60, Math.max(0, (performance.now() - startedAt) / 1000)); shownText = ''; clearTimer(); draw();
      const headers = { 'X-Reading-Offset-Seconds': String(offset), 'X-Reading-Duration-Seconds': String(readSeconds) };
      try {
        const blob = await recorder.stop({ headers }); let saved = recorder.savedDraft;
        if (!saved && window.TrainerDrafts) saved = await TrainerDrafts.audio(target, blob, headers, undefined, { profile: owner, route: '#/assessment' });
        if (!live()) return;
        pending = { blob, path: target, headers: saved?.headers || headers, requestId: saved?.requestId, draftId: saved?.id, downloadUrl: URL.createObjectURL(blob) };
        if (!saved?.durable) warning = 'Не закрывайте страницу до отправки или скачивания: браузер не подтвердил сохранение записи на устройстве.';
      } catch (caught) { if (live()) error = caught.message; }
      finally { stopping = false; closeMic(); if (live()) draw(); }
    }
    async function restore() {
      if (!session || !window.TrainerDrafts || !live() || pending) return;
      const target = audioPath();
      const saved = await TrainerDrafts.get('audio:' + target, owner);
      if (!live()) return;
      if (saved?.blob) pending = { ...saved, draftId: saved.id, downloadUrl: URL.createObjectURL(saved.blob) };
      if (!pending && TrainerDrafts.recordings && TrainerDrafts.recoverRecording) {
        const records = (await TrainerDrafts.recordings()).filter(item => item.sessionId === session.id && item.assessment).sort((a, b) => b.updated - a.updated);
        if (records.length) {
          const record = records[0], restored = await TrainerDrafts.recoverRecording(record.id);
          if (restored?.blob && live()) pending = { blob: restored.blob, path: record.path, headers: record.headers || {}, profile: owner, recordingId: record.id, recordingRequestId: record.requestId,
            requestId: null, incomplete: true, playback: 'unverified', downloadUrl: URL.createObjectURL(restored.blob), error: restored.notice };
        }
      }
      await reconcile();
    }
    async function reconcile() {
      if (!pending || !session) return;
      const received = state().client_request_id || session.takes?.[0]?.client_request_id;
      if (received && received === pending.requestId || ['confirmed', 'review', 'complete'].includes(phase()) && state().result) {
        if (window.TrainerDrafts) {
          if (pending.incomplete) await TrainerDrafts.removeRecording(pending.recordingId, pending.recordingRequestId, owner);
          else await TrainerDrafts.remove(pending.draftId || 'audio:' + pending.path, pending.requestId, owner);
        }
        clearPending();
      }
    }
    async function sendAudio() {
      if (!live() || locked() || !pending || pending.incomplete && pending.playback !== 'ready') return;
      const sent = pending; busy = true; error = ''; sent.error = ''; draw();
      try {
        if (sent.incomplete && !sent.requestId && window.TrainerDrafts) {
          const claim = await TrainerDrafts.operation('PUT', sent.path, sent.blob, { ...(sent.headers || {}), 'X-Trainer': '1', 'Content-Type': sent.blob.type || 'application/octet-stream' });
          const prepared = await TrainerDrafts.prepareRecovery(sent.recordingId, sent.recordingRequestId, claim, sent.headers || {}, owner); sent.requestId = prepared.requestId;
        }
        if (!live()) return;
        const fresh = await api(sent.path, { method: 'PUT', blob: sent.blob, headers: sent.headers, requestId: sent.requestId, onRequestId: id => { sent.requestId = id; } });
        if (sent.incomplete && window.TrainerDrafts) await TrainerDrafts.removeRecording(sent.recordingId, sent.recordingRequestId, owner);
        if (!live()) return; session = fresh; if (pending === sent) clearPending();
      } catch (caught) { if (live()) { sent.error = caught.message; if (caught.requestId) sent.requestId = caught.requestId; } }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function discardPending() {
      if (!live() || locked() || !pending) return;
      if (window.TrainerDrafts) {
        if (pending.incomplete) { if (!await TrainerDrafts.removeRecording(pending.recordingId, pending.recordingRequestId, owner)) return; }
        else await TrainerDrafts.remove(pending.draftId || 'audio:' + pending.path, pending.requestId, owner);
      }
      clearPending(); draw();
    }
    async function restart() {
      if (!live() || locked() || archived || !session || retries() <= 0) return;
      if (pending && typeof window.confirm === 'function' && !window.confirm('Начать с другим текстом? Текущая неотправленная запись останется на устройстве.')) return;
      busy = true; error = ''; draw();
      try { const fresh = await command('restart'); if (live()) { clearPending(); session = fresh; answers = {}; shownText = ''; warning = 'Подготовлен другой текст. Он откроется после начала записи.'; } }
      catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function repeatConfirmed(round) {
      if (!live() || locked() || archived || pending || working() || !round.confirmed_session_id || round.restarts_left <= 0) return;
      busy = true; error = ''; draw();
      try {
        const fresh = await command('restart', {}, round.confirmed_session_id);
        if (live()) { session = fresh; answers = {}; shownText = ''; warning = 'Подготовлен другой текст. Он откроется после начала записи.'; }
      } catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function retry() {
      if (!live() || locked() || archived) return;
      busy = true; error = ''; draw();
      try { const fresh = await command('retry'); if (live()) session = fresh; }
      catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function confirm() {
      if (!live() || locked() || archived || state().result?.usable === false || list(state().questions).some(item => !Number.isInteger(answers[item.id]))) return;
      busy = true; error = ''; draw();
      try {
        const fresh = await command('confirm', { answers: { ...answers } });
        if (live()) {
          overview = fresh;
          if (fresh.current && fresh.current.id === session.id) session = fresh.current;
          else { const confirmed = await api(`/api/sessions/${enc(session.id)}`); if (!live()) return; session = confirmed; }
          warning = 'Срез сохранён. Следующий замер будет на новом тексте.';
        }
      } catch (caught) { if (live()) error = caught.message; }
      finally { busy = false; if (live()) { draw(); schedule(); } }
    }
    async function refresh() {
      if (!live() || locked()) return;
      try {
        const fresh = session ? await api(`/api/sessions/${enc(session.id)}`) : null; if (!live()) return;
        if (fresh) session = fresh; await reconcile(); await restore(); error = ''; draw();
      } catch (caught) { if (live()) { error = caught.message; draw(); } }
      schedule();
    }
    function schedule() { clearTimeout(poller); if (live() && (working() || pending?.error)) poller = setTimeout(refresh, 2000); }
    function beforeUnload(event) { if (recording || stopping || busy) { event.preventDefault(); event.returnValue = ''; } }
    function reconnect() { if (!locked()) refresh(); }
    render(ctx, root); await load();
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('trainer:backendchange', reconnect);
    return { retentionOwner: owner, retentionSession: () => locked() || pending ? null : session,
      destroy() { disposed = true; capture++; clearTimer(); clearTimeout(poller); if (recording) recording.cancel({ preserve: true }); closeMic(); recording = null; clearPending(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('trainer:backendchange', reconnect); } };
  }
  return { view, homeCard: overview => card('home', overview), progressCard: overview => card('progress', overview), profileCard: overview => card('profile', overview) };
})();
