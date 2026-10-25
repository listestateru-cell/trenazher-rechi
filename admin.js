'use strict';
/* Просмотр занятий владельцем. Здесь нет смены профиля или запросов на запись. */
window.TrainerAdmin = (() => {
  const enc = (value) => encodeURIComponent(String(value));
  const userPath = (uid) => `/api/admin/users/${enc(uid)}`;
  const userRoute = (uid) => `#/admin/users/${enc(uid)}`;
  const list = (value) => Array.isArray(value) ? value : [];
  const nameOf = (user) => user.name || (user.username ? `@${user.username}` : `Пользователь ${user.id}`);
  const roleOf = (role) => ({ owner: 'Владелец', member: 'Участник', pending: 'Ожидает доступа', blocked: 'Доступ закрыт' }[role] || 'Участник');
  const number = (value) => Number.isFinite(value) ? value.toLocaleString('ru-RU') : '—';

  function date(value, short = false) {
    if (!value) return 'Пока нет';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Дата не указана';
    return parsed.toLocaleString('ru-RU', short
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function exerciseTitle(session) {
    return session.title || ((catalog().exercises || {})[session.exercise] || {}).title
      || ({ clarify: 'Уточни расплывчатую мысль', synonyms: 'Синонимы по смыслу', lexicon: 'Слово из классики' }[session.learning_kind || session.exercise]) || 'Занятие';
  }

  function statusOf(session) {
    const analysis = session.analysis || {};
    const takes = list(session.takes);
    const count = Array.isArray(session.plan) ? session.plan.length : Number(session.plan) || 0;
    const recorded = takes.filter((take) => take.status === 'done').length;
    if (takes.some((take) => take.status === 'processing')) return { text: 'Речь распознаётся', kind: 'warn' };
    if (analysis.status === 'running') return { text: 'Тренер разбирает', kind: 'warn' };
    if (analysis.status === 'error') return { text: 'Разбор не завершился', kind: 'bad' };
    if (takes.some((take) => take.status === 'error')) return { text: 'Ошибка обработки записи', kind: 'bad' };
    if (session.learning_kind || analysis.status === 'practice') {
      const progress = session.learning_progress || (Array.isArray(session.thoughts) ? learningProgress(session.thoughts) : {});
      if (progress.total && progress.completed >= progress.total) return { text: 'Учебное задание выполнено', kind: 'good' };
      return { text: progress.completed ? `Выполнено заданий: ${progress.completed}` : 'Учебное задание начато', kind: '' };
    }
    if (analysis.status === 'done') return { text: count && recorded < count ? `Частичный разбор · записано ${recorded} из ${count}` : 'Разбор готов', kind: 'good' };
    return { text: count ? `Записано ${recorded} из ${count}` : 'Занятие начато', kind: '' };
  }

  function stat(label, value, suffix) {
    return h('div', { class: 'admin-stat' }, h('div', { class: 'admin-stat-value num' }, value, suffix ? h('small', null, suffix) : null), h('div', { class: 'admin-stat-label' }, label));
  }

  function crumbs(items) {
    return h('nav', { class: 'admin-crumbs', 'aria-label': 'Навигация по пользователям' }, items.map((item, index) => [
      index ? h('span', { 'aria-hidden': 'true', class: 'admin-crumb-divider' }, '/') : null,
      item.href ? h('a', { href: item.href }, item.label) : h('span', { 'aria-current': 'page' }, item.label),
    ]));
  }

  function header(title, subtitle, refresh, extra) {
    return h('header', { class: 'admin-heading' }, h('div', { class: 'admin-heading-copy' },
      h('div', { class: 'admin-eyebrow' }, 'Доступ владельца'), h('h1', null, title), subtitle ? h('p', { class: 'soft' }, subtitle) : null),
    h('div', { class: 'admin-heading-actions' }, extra, refresh));
  }

  function media(uid, sid, filename, label, start) {
    if (!filename) return null;
    const path = `${userPath(uid)}/sessions/${enc(sid)}/media/${enc(filename)}`;
    const audio = h('audio', { controls: true, preload: 'none', src: url(path), 'aria-label': label, 'data-trainer-admin-media': path });
    if (Number(start) > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = Number(start); }, { once: true });
    return audio;
  }

  function pauseMedia(root) {
    root.querySelectorAll('audio').forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
  }

  function errorNotice(error) {
    return h('div', { class: 'admin-error', role: 'alert' }, error.message || 'Не удалось загрузить данные. Нажмите «Обновить», чтобы попробовать снова.');
  }

  async function view(ctx, parts) {
    // Условие в интерфейсе дополнено обязательной серверной проверкой каждого GET.
    if (!app.state || app.state.is_owner !== true) {
      render(ctx, h('section', { class: 'admin-view card empty' }, h('h1', null, 'Этот раздел доступен владельцу'), h('p', { class: 'soft' }, 'Откройте тренажёр по своей личной ссылке.'), h('a', { class: 'btn ghost', href: '#/' }, 'К упражнениям')));
      return null;
    }
    const uid = parts[1] === 'users' && parts[2] ? decodeURIComponent(parts[2]) : null;
    const sid = uid && parts[3] === 'sessions' && parts[4] ? decodeURIComponent(parts[4]) : null;
    const root = h('section', { class: 'admin-view stack' });
    let destroyed = false, loading = false, data = null, error = null, query = '';
    let searchFocus = false, searchSelection = null;
    const alive = () => !destroyed && ctx.alive();
    const refresh = h('button', { class: 'btn ghost admin-refresh', type: 'button', onclick: () => load() }, icon('redo'), 'Обновить');
    render(ctx, root);

    function draw() {
      if (!alive()) return;
      pauseMedia(root);
      refresh.disabled = loading;
      refresh.setAttribute('aria-busy', String(loading));
      refresh.replaceChildren(icon('redo'), loading ? 'Обновляю…' : 'Обновить');
      root.replaceChildren(...(sid ? sessionPage() : uid ? detailPage() : usersPage()).flat(Infinity).filter((node) => node != null && node !== false));
      if (searchFocus) {
        const input = root.querySelector('#admin-user-search');
        if (input) { input.focus({ preventScroll: true }); if (searchSelection) input.setSelectionRange(...searchSelection); }
        searchFocus = false;
      }
    }

    async function load() {
      if (loading || !alive()) return;
      loading = true; error = null;
      draw();
      try { data = await api(sid ? `${userPath(uid)}/sessions/${enc(sid)}` : uid ? userPath(uid) : '/api/admin/users'); }
      catch (caught) { error = caught; }
      loading = false;
      if (alive()) draw();
    }

    function loadingOrEmpty() {
      return h('div', { class: 'card admin-empty', role: 'status' }, loading ? 'Загружаю сохранённые данные…' : 'Данные пока не загружены. Нажмите «Обновить».');
    }

    function usersPage() {
      const users = list(data && data.users);
      const needle = query.trim().toLocaleLowerCase('ru-RU').replace(/^@/, '');
      const filtered = users.filter((user) => `${nameOf(user)} ${user.username || ''} ${user.id} ${roleOf(user.role)}`.toLocaleLowerCase('ru-RU').includes(needle));
      const input = h('input', { id: 'admin-user-search', class: 'admin-search', type: 'search', value: query, placeholder: 'Имя или @username', autocomplete: 'off', oninput: (event) => {
        query = event.target.value; searchFocus = true; searchSelection = [event.target.selectionStart, event.target.selectionEnd]; draw();
      } });
      return [header('Пользователи', 'Занятия, записи и обратная связь каждого участника.', refresh),
        error ? errorNotice(error) : null,
        data ? h('div', { class: 'admin-summary' }, stat('Профилей', number(users.length)), stat('Завершено занятий', number(users.reduce((sum, user) => sum + ((user.stats || {}).completed || 0), 0))), stat('Сохранено записей', number(users.reduce((sum, user) => sum + ((user.stats || {}).recordings || 0), 0)))) : null,
        data ? h('div', { class: 'admin-search-field' }, h('label', { for: 'admin-user-search' }, 'Найти пользователя'), input, h('p', { class: 'small soft', role: 'status' }, `Показано: ${filtered.length} из ${users.length}`)) : null,
        h('p', { class: 'small soft admin-activity-note' }, 'Время последнего действия берётся из сохранённых занятий.'),
        !data ? loadingOrEmpty() : filtered.length ? h('div', { class: 'admin-user-grid' }, filtered.map((user) => {
          const stats = user.stats || {};
          return h('a', { class: 'card admin-user-card', href: userRoute(user.id), 'data-admin-user': user.id },
            h('div', { class: 'admin-user-top' }, window.TrainerProfiles ? TrainerProfiles.avatar(user, 'admin-avatar') : h('span', { class: 'admin-avatar', 'aria-hidden': 'true' }, Array.from(nameOf(user).replace(/^@/, '')).slice(0, 1).join('').toLocaleUpperCase('ru-RU')), h('div', { class: 'admin-user-identity' }, h('h2', null, nameOf(user)), user.username ? h('p', { class: 'small soft' }, `@${user.username}`) : null, user.is_test ? h('span', { class: 'profile-test-label' }, 'Тестовый профиль') : null), h('span', { class: 'chip' }, roleOf(user.role))),
            h('div', { class: 'admin-mini-stats' }, stat('Занятий', number(stats.sessions)), stat('Завершено', number(stats.completed)), stat('Последняя оценка', f1(stats.last_score), '/ 10')),
            h('div', { class: 'admin-card-bottom' }, h('div', null, h('p', { class: 'small soft' }, 'Последняя сохранённая активность'), h('p', { class: 'small' }, date(stats.last_activity, true))), icon('arrow')));
        })) : h('div', { class: 'card admin-empty' }, h('h2', null, users.length ? 'Никого не нашли' : 'Пользователей пока нет'), h('p', { class: 'soft' }, users.length ? 'Попробуйте другую часть имени или username.' : 'После входа в бот участники появятся здесь.'))];
    }

    function detailPage() {
      const user = data && data.user;
      const sessions = list(data && data.sessions);
      const stats = user && user.stats || {};
      const state = data && data.state || {};
      const program = data ? programStatus(sessions, state) : null;
      return [crumbs([{ label: 'Пользователи', href: '#/admin' }, { label: user ? nameOf(user) : 'Участник' }]),
        header(user ? nameOf(user) : 'Занятия участника', user && user.username ? `@${user.username} · ${roleOf(user.role)}` : user ? roleOf(user.role) : null, refresh),
        error ? errorNotice(error) : null,
        !data ? loadingOrEmpty() : [
          h('div', { class: 'admin-summary admin-summary-detail' }, stat('Всего занятий', number(stats.sessions)), stat('Завершено', number(stats.completed)), stat('Разборов тренера', number(stats.analyses == null ? stats.completed : stats.analyses)), stat('Записей', number(stats.recordings)), stat('Средняя оценка', f1(stats.average_score), '/ 10'), stat('Дней с активностью', number(stats.active_days))),
          h('div', { class: 'card admin-progress-card' }, h('div', { class: 'card-head' }, h('h2', null, 'Прогресс обучения')),
            h('div', { class: 'admin-progress-facts' }, h('p', null, h('span', { class: 'soft' }, 'Последняя сохранённая активность: '), date(stats.last_activity)),
              h('p', null, h('span', { class: 'soft' }, 'Последняя оценка: '), stats.last_score == null ? 'Пока нет' : `${f1(stats.last_score)} / 10`),
              h('p', null, h('span', { class: 'soft' }, '«Мысль и слово»: '), `выполнено заданий ${stats.learning_completed || 0}, сохранено ответов ${stats.thought_attempts || 0}`),
              h('p', null, h('span', { class: 'soft' }, 'Уровень вопросов тренера: '), state.coach_level || 1)),
            h('div', { class: 'admin-today' }, h('div', { class: 'row' }, h('h3', null, 'Программа сегодня'), h('span', { class: 'chip num' }, `${program.doneCount} из ${program.steps.length}`)),
              program.start ? h('p', { class: 'small soft' }, `День ${Math.max(1, program.dayN)} · начало ${new Date(program.start + 'T12:00:00').toLocaleDateString('ru-RU')}`) : h('p', { class: 'small soft' }, 'Программа ещё не начата.'),
              h('ul', { class: 'admin-program-list' }, program.steps.map((step) => h('li', null, h('span', { class: `admin-step-mark ${step.done ? 'done' : ''}`, 'aria-hidden': 'true' }, step.done ? '✓' : step.i + 1),
                h('span', null, step.title || ((catalog().exercises || {})[step.exercise] || {}).title || 'Упражнение'), h('span', { class: 'small soft' }, step.done ? 'Готово' : 'Не завершено')))))),
          h('div', { class: 'admin-section-heading' }, h('h2', null, 'Сохранённые занятия'), h('span', { class: 'small soft' }, `${sessions.length}`)),
          sessions.length ? h('div', { class: 'admin-session-list' }, sessions.map((session) => {
            const status = statusOf(session);
            return h('a', { class: 'card admin-session-card', href: `${userRoute(uid)}/sessions/${enc(session.id)}`, 'data-admin-session': session.id },
              h('div', { class: 'admin-session-top' }, h('h3', null, exerciseTitle(session)), h('span', { class: `chip ${status.kind}` }, status.text)),
              session.topic ? h('p', { class: 'admin-session-topic' }, session.topic) : null,
              h('div', { class: 'admin-session-bottom' }, h('span', { class: 'small soft' }, date(session.created, true)), session.summary && session.summary.overall != null ? h('span', { class: 'score-pill' }, f1(session.summary.overall), h('small', null, '/10')) : null, icon('arrow')));
          })) : h('div', { class: 'card admin-empty' }, h('h3', null, 'Занятий пока нет'), h('p', { class: 'soft' }, 'Здесь появятся отправленные записи и начатые учебные задания.')),
        ]];
    }

    function sessionPage() {
      const session = data;
      const analysis = session && session.analysis || {};
      const result = analysis.result;
      const status = session && statusOf(session);
      const thoughts = list(session && session.thoughts);
      return [crumbs([{ label: 'Пользователи', href: '#/admin' }, { label: 'Занятия участника', href: userRoute(uid) }, { label: session ? exerciseTitle(session) : 'Занятие' }]),
        header(session ? exerciseTitle(session) : 'Просмотр занятия', session ? date(session.created) : null, refresh),
        error ? errorNotice(error) : null,
        !session ? loadingOrEmpty() : [
          h('div', { class: 'card admin-session-intro' }, h('div', { class: 'row' }, h('span', { class: `chip ${status.kind}` }, status.text), h('span', { class: 'small soft' }, 'Только просмотр')),
            session.topic ? h('div', { class: 'admin-topic' }, h('h2', null, 'Задание'), h('p', null, session.topic)) : null,
            analysis.error ? h('p', { class: 'admin-error' }, analysis.error) : null,
            analysis.refresh_error ? h('p', { class: 'small soft' }, 'Повторный разбор не завершился. Ниже — сохранённый результат.') : null),
          result ? coachCard(result) : null,
          list(session.takes).some((take) => take.status !== 'missing') ? h('div', { class: 'admin-section-heading' }, h('h2', null, 'Записи и расшифровки')) : null,
          list(session.takes).map((take, index) => take.status === 'missing' ? null : takeCard(session, take, index, analysis)),
          thoughts.length ? h('div', { class: 'admin-section-heading' }, h('h2', null, session.learning_kind ? 'Учебные задания и ответы' : 'Работа над формулировками')) : null,
          thoughts.map((thought, index) => thoughtCard(session, thought, index)),
          !list(session.takes).length && !thoughts.length ? h('div', { class: 'card admin-empty' }, h('h2', null, 'Ответов ещё нет'), h('p', { class: 'soft' }, 'Занятие создано. Отправленных записей и текстовых ответов пока нет.')) : null,
        ]];
    }

    function coachCard(result) {
      const criteria = [['logic', 'Логика'], ['vocabulary', 'Словарный запас'], ['thinking_speed', 'Скорость мышления'], ['persuasiveness', 'Убедительность'], ['structure', 'Структура речи']];
      return h('article', { class: 'card admin-coach' }, h('div', { class: 'card-head' }, h('h2', null, 'Разбор тренера')),
        h('div', { class: 'verdict-grid' }, h('div', { class: 'hero-score' }, h('div', { class: 'val' }, f1(result.overall), h('small', null, ' / 10')), h('div', { class: 'small soft' }, 'Общая оценка')), h('p', { class: 'verdict' }, result.verdict)),
        h('div', { class: 'meters' }, criteria.filter(([key]) => Number.isFinite((result.scores || {})[key])).map(([key, title]) => meterRow(title, result.scores[key], (result.score_notes || {})[key]))),
        h('div', { class: 'cols' }, list(result.strengths).length ? h('div', null, h('h3', null, 'Сильные стороны'), h('ul', { class: 'list good' }, result.strengths.map((text) => h('li', null, text)))) : null,
          list(result.growth).length ? h('div', null, h('h3', null, 'Точки роста'), h('ul', { class: 'list grow' }, result.growth.map((text) => h('li', null, text)))) : null),
        result.exercise_feedback ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Разбор упражнения'), h('p', null, result.exercise_feedback)) : null,
        list(result.sprint_words).length ? h('div', { class: 'callout' }, h('div', { class: 'label' }, `Названо понятий: ${result.sprint_words.length}`), h('div', { class: 'word-chips' }, result.sprint_words.map((word) => h('span', { class: 'chip' }, word)))) : null,
        result.tip ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Совет на следующую попытку'), h('p', null, result.tip)) : null,
        result.next_question ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Следующий вопрос тренера'), h('p', null, result.next_question)) : null);
    }

    function takeCard(session, take, index, analysis) {
      const takeIndex = take.index == null ? index : take.index;
      // При частичном разборе result.takes не совпадает с индексами записей.
      const resultIndex = list(analysis.takes).indexOf(takeIndex);
      const raw = resultIndex >= 0 && analysis.result && list(analysis.result.takes)[resultIndex];
      const review = raw ? { ...raw, issues: list(raw.issues) } : null;
      const audio = media(uid, session.id, take.audio, `Запись ${index + 1}`);
      const wordEls = [];
      const player = audio ? { seek(time) { audio.currentTime = Math.max(0, time); const playing = audio.play(); if (playing) playing.catch(() => {}); } } : null;
      const transcript = list(take.words).length ? renderTranscript(take, review, wordEls, (wordIndex) => { if (player) player.seek(Math.max(0, take.words[wordIndex].s - 0.2)); }) : null;
      const transcriptDetails = transcript ? h('details', { class: 'admin-transcript' }, h('summary', null, 'Текст записи с отметками'), transcript.el, transcript.legend)
        : take.text ? h('details', { class: 'admin-transcript' }, h('summary', null, 'Текст записи'), h('p', { class: 'admin-body-text' }, take.text)) : null;
      const analysisBox = review ? takeAnalysis(review, take, wordEls, player, null) : null;
      // Открываем текст до обработчика цитаты, который прокручивает к словам.
      if (analysisBox && transcriptDetails) analysisBox.addEventListener('click', (event) => {
        const quote = event.target.closest && event.target.closest('.issue .quote button');
        if (quote && analysisBox.contains(quote)) transcriptDetails.open = true;
      }, true);
      return h('article', { class: 'card admin-take', 'data-admin-take': takeIndex }, h('div', { class: 'card-head' }, h('h3', null, `Запись ${index + 1}${take.label ? ` · ${take.label}` : ''}`),
        h('span', { class: 'chip' }, ({ done: 'Обработана', processing: 'Распознаётся', error: 'Ошибка обработки' }[take.status] || 'Сохранена'))),
      audio, take.duration != null ? h('p', { class: 'small soft' }, `Длительность: ${mmss(take.duration)}`) : null,
      take.error ? h('p', { class: 'admin-error' }, take.error) : null,
      list(take.warnings).map((warning) => h('p', { class: 'warn-line' }, warning)),
      take.metrics ? tilesFor(take, review) : null,
      transcriptDetails || h('p', { class: 'small soft' }, take.status === 'processing' ? 'Текст появится после распознавания. Нажмите «Обновить» позже.' : 'Расшифровки пока нет.'),
      analysisBox);
    }

    function thoughtCard(session, thought, index) {
      const original = thought.original || {};
      const attempts = list(thought.attempts);
      const issuedHints = list(thought.hints).slice(0, Math.max(0, Number(thought.hint_count) || 0));
      return h('article', { class: 'card admin-thought', 'data-admin-thought': thought.id },
        h('div', { class: 'card-head' }, h('h3', null, thought.title || thought.goal || `Формулировка ${index + 1}`), thought.transfer_from ? h('span', { class: 'chip' }, thought.transfer_type === 'new_exercise' ? 'Отдельное задание' : 'Перенос на другую тему') : null),
        thought.topic ? h('p', { class: 'small soft' }, thought.topic) : null,
        thought.task ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Условие'), h('p', null, thought.task)) : null,
        h('div', { class: 'admin-original' }, h('h4', null, thought.source === 'learning' ? 'Исходная ситуация' : 'Исходная фраза'), h('p', { class: 'admin-body-text' }, original.text),
          original.context && original.context !== original.text ? h('p', { class: 'small soft admin-body-text' }, original.context) : null,
          media(uid, session.id, original.audio, 'Исходная запись', original.start),
          original.audio && original.start != null ? h('p', { class: 'small soft' }, `Исходный фрагмент с ${mmss(original.start)}. В плеере доступна вся запись.`) : null),
        thought.vocabulary || thought.citation ? h('details', { class: 'admin-reference' }, h('summary', null, 'Материалы задания'), learningMaterials(thought)) : null,
        h('div', { class: 'admin-attempts' }, h('h4', null, `Сохранённые ответы · ${attempts.length}`), attempts.length ? attempts.map((attempt, attemptIndex) => {
          const review = attempt.review || {};
          const assessment = { improved: 'Стало яснее', needs_work: 'Можно доработать', unclear: 'Нужно уточнить смысл' }[review.assessment];
          return h('section', { class: 'admin-attempt' }, h('div', { class: 'row' }, h('h5', null, `Вариант ${attemptIndex + 1}`), assessment ? h('span', { class: `chip ${review.assessment === 'improved' ? 'good' : ''}` }, thought.learning_kind && review.assessment === 'improved' ? 'Задание выполнено' : assessment) : null),
            h('p', { class: 'small soft' }, date(attempt.created, true)),
            attempt.text ? h('p', { class: 'admin-body-text admin-answer' }, attempt.text) : h('p', { class: 'small soft' }, attempt.status === 'processing' ? 'Запись распознаётся.' : 'Распознанного текста нет.'),
            media(uid, session.id, attempt.audio, `Запись ответа, вариант ${attemptIndex + 1}`),
            attempt.intended_meaning ? h('p', { class: 'small admin-body-text' }, h('b', null, 'Уточнение автора: '), attempt.intended_meaning) : null,
            attempt.hints_used != null ? h('p', { class: 'small soft' }, `Использовано подсказок и предыдущих отзывов: ${attempt.hints_used}`) : null,
            review.feedback ? h('div', { class: 'admin-review' }, h('h5', null, 'Отзыв тренера'), h('p', { class: 'admin-body-text' }, review.feedback),
              review.meaning_preserved ? h('p', { class: 'small soft' }, ({ yes: 'Смысл сохранён.', no: 'Тренер отметил изменение смысла.', unclear: 'Смысл требует уточнения.' }[review.meaning_preserved])) : null,
              review.goal_met ? h('p', { class: 'small soft' }, ({ yes: 'Учебная цель выполнена.', no: 'Учебная цель пока не выполнена.', unclear: 'Для проверки цели нужно уточнение.' }[review.goal_met])) : null,
              review.next_hint ? h('div', { class: 'callout' }, h('div', { class: 'label' }, 'Подсказка тренера'), h('p', null, review.next_hint)) : null) : null,
            attempt.status === 'reviewing' ? h('p', { class: 'small soft' }, 'Тренер проверяет ответ. Нажмите «Обновить» позже.') : null,
            attempt.error ? h('p', { class: 'admin-error' }, attempt.error) : null);
        }) : h('p', { class: 'soft' }, 'Ответ ещё не отправлен.')),
        issuedHints.length ? h('details', { class: 'admin-reference' }, h('summary', null, `Открытые подсказки · ${issuedHints.length}`), issuedHints.map((text, hintIndex) => h('div', { class: 'callout' }, h('div', { class: 'label' }, `Подсказка ${hintIndex + 1}`), h('p', null, text)))) : null);
    }

    await load();
    return { destroy() { destroyed = true; pauseMedia(root); } };
  }

  return { view };
})();
