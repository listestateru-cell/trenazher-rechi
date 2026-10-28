'use strict';
/* Одновременная минута. Сроки, слово и зачёт определяет сервер. */
window.TrainerDuels = (() => {
  const enc = encodeURIComponent;
  const names = { league: 'Встреча недели', semi: 'Полуфинал', semifinal: 'Полуфинал', final: 'Финал · 1–2 место', bronze: 'За 3 место', tiebreak: 'Дополнительная встреча', qualifier: 'Дополнительная встреча' };
  const statuses = { waiting: 'Ожидает готовности', countdown: 'Обратный отсчёт', live: 'Идёт запись', processing: 'Тренер проверяет слова', done: 'Завершён', complete: 'Завершён', expired: 'Нужен повтор', cancelled: 'Не состоялся' };
  const path = (gid) => `/api/groups/${enc(gid)}/duels`;
  const finished = (match) => ['done', 'complete'].includes(match.status);
  const own = (match) => (match.players || []).find((player) => player.is_self);
  const demonstration = (match) => match.demonstration === true;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—';
  const avatar = (person) => window.TrainerProfiles ? TrainerProfiles.avatar(person, 'duel-person-avatar') : null;
  const identity = (person, className = 'duel-podium-identity') => h('span', { class: className }, avatar(person), h('strong', null, person.name || 'Участник'));

  function judgement(session) {
    return ((session.analysis || {}).result || {}).word_judgement || null;
  }
  function privateResult(session, retry) {
    const take = (session.takes || [])[0] || {};
    const result = (session.analysis || {}).result || {};
    const words = judgement(session);
    const accepted = words && words.accepted || result.sprint_words || [];
    const label = (word) => typeof word === 'string' ? word : word.word || word.text || '';
    return h('article', { class: 'card duel-private stack' }, h('h2', null, 'Ваш результат'),
      h('p', { class: 'soft' }, 'Слово: ', session.topic || '—'),
      words && words.recognition_notice ? h('p', { class: 'groups-error', role: 'status' }, words.recognition_notice) : null,
      (session.analysis || {}).status !== 'done' ? h('p', { role: 'status' }, (session.analysis || {}).error || take.error || 'Тренер проверяет подходящие слова. Результат появится после разбора.') : null,
      words || accepted.length ? [h('p', null, `Подходящих неповторяющихся слов: ${accepted.length}`),
        h('div', { class: 'word-chips' }, accepted.map((word) => h('span', { class: 'chip' }, label(word)))),
        (words && words.repeated || []).length ? h('p', { class: 'soft small' }, 'Повторы и формы одного слова: ', words.repeated.map(label).join(', ')) : null,
        (words && words.rejected || []).length ? h('details', null, h('summary', null, 'Почему часть слов не засчитана'), h('ul', { class: 'list' }, words.rejected.map((word) => h('li', null, label(word), word.reason ? `: ${word.reason}` : '')))) : null] : null,
      take.audio ? h('audio', { controls: true, preload: 'none', src: url(`/media/${enc(session.id)}/${enc(take.audio)}`), 'aria-label': 'Ваша запись поединка' }) : null,
      take.text ? h('details', null, h('summary', null, 'Ваша расшифровка'), h('p', { class: 'duel-text' }, take.text)) : null,
      result.verdict ? h('p', { class: 'soft' }, result.verdict) : null,
      retry && take.status === 'done' && ((session.analysis || {}).status === 'error' || (session.analysis || {}).status === 'done' && !words)
        ? h('button', { class: 'btn ghost', type: 'button', onclick: retry }, 'Повторить проверку слов') : null,
      h('p', { class: 'small soft' }, 'Эту запись и подробности видите вы и владелец тренажёра. В таблице поединка другим участникам доступны только числовые результаты.'));
  }

  async function review(ctx, session) {
    const retentionOwner = window.TrainerDrafts && TrainerDrafts.profile();
    const gid = session.duel_group_id;
    const root = h('section', { class: 'duels-view stack' });
    let stopped = false, timer = 0, error = '', busy = false;
    function draw() {
      if (stopped || !ctx.alive()) return;
      root.replaceChildren(...[h('a', { class: 'groups-back', href: gid ? `#/groups/${enc(gid)}/duels` : '#/history' }, icon('back'), 'К поединкам'),
        h('h1', null, 'Минута ассоциаций'), error ? h('p', { class: 'groups-error', role: 'alert' }, error) : null,
        busy ? h('p', { role: 'status' }, 'Запускаю проверку…') : privateResult(session, retry)].filter(Boolean));
    }
    async function retry() {
      if (busy) return;
      busy = true; error = ''; draw();
      try { session = await api(`/api/sessions/${enc(session.id)}/analyze`, { method: 'POST', body: {} }); }
      catch (caught) { error = caught.message; }
      busy = false; draw(); poll();
    }
    async function poll() {
      clearTimeout(timer);
      if (stopped || !ctx.alive() || !['waiting','running'].includes((session.analysis || {}).status)) return;
      timer = setTimeout(async () => {
        try { session = await api(`/api/sessions/${enc(session.id)}`); }
        catch (caught) { error = caught.message; }
        draw(); poll();
      }, 2000);
    }
    draw(); poll();
    render(ctx, root);
    return { retentionOwner, retentionSession: () => busy ? null : session,
      destroy() { stopped = true; clearTimeout(timer); root.querySelectorAll('audio').forEach((audio) => audio.pause()); } };
  }

  async function view(ctx, parts, params) {
    const retentionOwner = window.TrainerDrafts && TrainerDrafts.profile();
    const gid = parts[1], week = params && params.get('week');
    const root = h('section', { class: 'duels-view stack' });
    let data = null, error = '', destroyed = false, loading = false, pending = false;
    let armedId = null, session = null, rec = null, blob = null, uploadRequest = null, uploadBusy = false;
    let recording = false, starting = false, recordingContext = null, recordingStream = null, armedStream = null;
    let serverMs = Date.now(), clockAt = performance.now(), pollTimer = 0, ticker = 0, downloadUrl = '';
    let focus = params && params.get('match'), privateSession = null;
    const alive = () => !destroyed && ctx.alive();
    const now = () => serverMs + performance.now() - clockAt;
    const setClock = (stamp) => { const value = Date.parse(stamp); if (Number.isFinite(value)) { serverMs = value; clockAt = performance.now(); } };
    const closeOwnMic = () => {
      const streams = new Set([armedStream, recordingStream].filter(Boolean));
      for (const stream of streams) {
        if (mic.stream === stream) mic.close();
        else if (stream.getTracks) stream.getTracks().forEach((track) => track.stop());
      }
      armedStream = null;
    };
    const inMatch = (match) => !!own(match);
    const beforeUnload = (event) => { if (recording || starting || blob) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    render(ctx, root);

    function action(label, onClick, disabled = false, primary = false) {
      return h('button', { class: `btn ${primary ? '' : 'ghost'}`, type: 'button', disabled: disabled || pending, onclick: onClick }, label);
    }
    function draw() {
      if (!alive()) return;
      const matches = data && data.matches || [], mine = matches.filter(inMatch);
      const selected = matches.find((match) => match.id === (armedId || focus));
      const demoWeek = data && ['demo', 'demo_finished'].includes(data.phase);
      const demoFinals = demoWeek && data.phase === 'demo_finished' && data.demo_completed === true;
      const nodes = [
        h('a', { class: 'groups-back', href: `#/groups/${enc(gid)}` }, icon('back'), 'К группе'),
        h('header', { class: 'groups-heading' }, h('div', { class: 'groups-heading-copy' }, h('p', { class: 'groups-eyebrow' }, 'Минута ассоциаций'),
          h('h1', null, 'Поединки недели'), h('p', { class: 'soft' }, data && data.group ? data.group.name : 'Общее слово · 60 секунд · без повторов')),
        action(loading ? 'Обновляю…' : 'Обновить', () => load(), loading || recording || starting)),
        error ? h('p', { class: 'groups-error', role: 'alert' }, error) : null,
        data ? h('p', { class: 'soft' }, data.week && (data.week.label || `${data.week.start} — ${data.week.end}`) || '', ' · ',
          ({ scheduled: 'Ожидаем субботу', demo: 'Демонстрационный круговой этап', demo_finished: 'Демонстрация завершённой недели', finals: 'Воскресные финалы', qualification_tie: 'Дополнительная встреча за выход в финал', awaiting_results: 'Ждём завершения начатых встреч и проверки ответов', finished: data.podium && data.podium.length ? 'Турнир завершён' : 'Финальные встречи не определены' })[data.phase] || 'Встречи каждого с каждым') : null,
        data && !demoWeek && data.phase === 'scheduled' ? h('section', { class: 'card stack', role: 'status', 'aria-label': 'Расписание поединков' },
          h('h2', null, 'Поединки — в выходные'),
          h('p', null, 'В субботу каждый играет с каждым. В воскресенье — полуфиналы, финал и матч за третье место. Сейчас можно посмотреть соперников и договориться о времени.'),
          data.schedule && data.schedule.league_date && data.schedule.finals_date ? h('p', { class: 'small soft' },
            `Круговой этап: ${data.schedule.league_date.split('-').reverse().join('.')}. Финалы: ${data.schedule.finals_date.split('-').reverse().join('.')}.`) : null) : null,
        data && (data.demonstration || matches.some(demonstration)) ? h('aside', { class: 'card groups-demo-notice', 'aria-label': 'Демонстрационные поединки' },
          h('h2', null, 'Демонстрационные поединки'), h('p', null, 'Количество слов задано для примера. Микрофон, записи и тренер не использовались.'),
          h('p', { class: 'small soft' }, 'Баллы навыка меняют общий рейтинг группы. Турнирные очки показывают, кто выиграл встречи.')) : null,
        demoFinals ? finalWeek(matches) : null,
        data && !demoWeek && data.podium && data.podium.length ? h('div', { class: 'card stack' }, h('h2', null, 'Итог турнира'),
          h('ol', { class: 'duel-podium' }, data.podium.slice(0,3).map((id, index) => h('li', null, h('span', { class: 'num' }, `${index + 1} место`), identity((data.table || []).find((row) => String(row.user_id) === String(id)) || { name: 'Участник' }))))) : null,
        h('details', { class: 'card duel-rules' }, h('summary', null, 'Как проходит поединок и за что начисляют баллы'),
          h('ol', { class: 'list' }, h('li', null, 'Круговой этап проходит в субботу, финальные встречи — в воскресенье. Договоритесь о времени. В день встречи оба откройте эту страницу и нажмите «Готов». Сначала браузер проверит микрофон.'),
            h('li', null, 'После подтверждения обоих начнётся общий отсчёт. Слово откроется одновременно с началом минуты. Называйте подходящие слова по одному.'),
            h('li', null, 'Тренер проверит смысловую связь. Повторы, формы одного слова и посторонние слова не учитываются. Разбор своего ответа можно открыть отдельно.'),
            h('li', null, '20–22 подходящих слова дают 1 балл навыка, 23–25 — 2, далее по баллу за каждые 3 слова, максимум 10 за 47 и больше. До 20 слов — 0.'),
            h('li', null, 'Во встрече побеждает тот, кто назвал больше подходящих слов: победа — 3 турнирных очка, ничья — по 1. Это отдельная таблица отбора в финал.'),
            h('li', null, 'В воскресенье четыре лучших играют полуфиналы 1–4 и 2–3. Победители встречаются за первое место, проигравшие — за третье. Незавершённая встреча не превращается в выдуманную победу.')),
          h('p', { class: 'small soft' }, 'Держите экран открытым и не переключайте приложения во время записи. При обрыве связи сохраните запись; несостоявшуюся встречу можно повторить с согласия обоих. Чужие аудио и расшифровки не открываются.')),
        selected && !demoWeek ? matchCard(selected, true) : null,
        blob ? h('div', { class: 'card stack', role: 'status' }, h('h2', null, uploadBusy ? 'Отправляю запись…' : 'Запись осталась на устройстве'),
          h('p', { class: 'soft' }, 'Проверка связи не удаляет запись. Для зачёта сервер также проверяет время отправки и фактическую длительность.'),
          h('div', { class: 'row' }, action('Повторить отправку', sendAudio, uploadBusy, true), downloadUrl ? h('a', { class: 'btn ghost', href: downloadUrl, download: 'Поединок.webm' }, 'Скачать запись') : null)) : null,
        privateSession ? privateResult(privateSession) : null,
        !data ? h('div', { class: 'card', role: 'status' }, 'Загружаю встречи…') : demoWeek ? [
          tableCard(data.table || data.league || []),
          demoFinals ? h('details', { class: 'card duel-all' }, h('summary', null, `Встречи кругового этапа · ${matches.filter((match) => match.kind === 'league').length}`),
            h('div', { class: 'duel-match-list' }, matches.filter((match) => match.kind === 'league').map((match) => matchCard(match)))) : [
            h('h2', null, 'Демонстрационные встречи'), h('div', { class: 'duel-match-list' }, matches.map((match) => matchCard(match)))],
        ] : [
          h('h2', null, 'Ваши встречи'), mine.length ? h('div', { class: 'duel-match-list' }, mine.filter((match) => !selected || selected.id !== match.id).map((match) => matchCard(match))) : h('div', { class: 'card' }, h('p', { class: 'soft' },
            (data.table || []).length >= 2 ? 'У вас пока нет встреч в этой сетке. Участие и состав группы можно проверить в кабинете. Круговой этап проходит в субботу; воскресенье отведено финалам.' : 'Для поединка нужны хотя бы два участника группы. Руководитель может отправить приглашение знакомым.')),
          tableCard(data.table || data.league || []),
          h('details', { class: 'card duel-all' }, h('summary', null, `Все встречи · ${matches.length}`), h('div', { class: 'duel-match-list' }, matches.filter((match) => !inMatch(match)).map((match) => matchCard(match)))),
        ]];
      root.replaceChildren(...nodes.flat(Infinity).filter((node) => node != null && node !== false));
      paintTimer();
    }
    function finalWeek(matches) {
      const participants = new Map(matches.flatMap((match) => match.players || []).map((player) => [player.id, player]));
      const person = (id) => participants.get(id) || (data.table || []).find((row) => row.user_id === id) || { name: 'Участник' };
      const semis = matches.filter((match) => ['semi', 'semifinal'].includes(match.kind));
      const final = matches.find((match) => match.kind === 'final');
      const bronze = matches.find((match) => match.kind === 'bronze');
      const qualification = data.qualification_table || [];
      const seeds = data.seeds || qualification.map((row) => row.user_id);
      return [h('section', { class: 'card stack duel-week-result', 'aria-label': 'Демонстрационный итог недели' },
        h('div', { class: 'row' }, h('h2', null, 'Итог недели'), h('span', { class: 'groups-demo-label' }, 'Демо')),
        h('p', { class: 'small soft' }, 'Финал определил 1–2 места. Матч за третье место — 3–4. Общий рейтинг группы считается отдельно.'),
        h('ol', { class: 'duel-podium duel-podium-final' }, (data.podium || []).slice(0, 4).map((id, index) => h('li', null,
          h('span', { class: 'duel-place num' }, `${index + 1} место`), identity(person(id)),
          h('span', { class: 'small soft' }, ['Победитель недели', 'Финалист', 'Победа в матче за 3 место', 'Участник полуфинала'][index]))))),
      h('section', { class: 'card stack duel-bracket', 'aria-label': 'Демонстрационная сетка финалов' },
        h('h2', null, 'Сетка финалов'),
        h('p', { class: 'small soft' }, 'Четыре участника после кругового этапа: 1-й играет с 4-м, 2-й — с 3-м.'),
        h('div', { class: 'duel-bracket-rounds' },
          h('section', { class: 'duel-bracket-round', 'aria-label': 'Полуфиналы' }, h('h3', null, 'Полуфиналы'),
            semis.map((match, index) => bracketMatch(match, `Полуфинал ${index + 1}`)),
            h('p', { class: 'duel-bracket-flow small soft' }, 'Победители → финал', h('br'), 'Проигравшие → матч за 3 место')),
          h('section', { class: 'duel-bracket-round', 'aria-label': 'Матчи за места' }, h('h3', null, 'Матчи за места'),
            final ? bracketMatch(final, 'Финал · 1–2 место') : null, bronze ? bracketMatch(bronze, 'Матч за 3 место') : null)),
        seeds.length && qualification.length ? h('details', { class: 'duel-qualification' }, h('summary', null, 'Как распределились пары полуфиналов'),
          h('p', { class: 'small soft' }, 'Это результаты отбора до полуфиналов. Финальные встречи их не меняют.'),
          h('ol', { class: 'duel-seeds' }, seeds.map((id, index) => {
            const row = qualification.find((item) => item.user_id === id) || {};
            return h('li', null, h('span', null, `${index + 1}. ${person(id).name}`), h('span', { class: 'num' }, `Очки: ${number(row.points ?? row.league_points)}`));
          }))) : null)];
    }
    function bracketMatch(match, title) {
      const players = match.players || [], result = match.results || [];
      return h('article', { class: 'duel-bracket-match', 'data-match': match.id, 'data-stage': match.kind },
        h('div', { class: 'duel-bracket-match-head' }, h('h4', null, title), h('span', { class: 'groups-demo-label' }, 'Демо')),
        h('p', { class: 'small soft' }, 'Слово: ', h('strong', null, match.topic || '—')),
        h('ol', { class: 'duel-bracket-players' }, players.map((player) => {
          const row = result.find((item) => item.user_id === player.id) || {}, won = match.winner_id === player.id;
          return h('li', { class: won ? 'duel-bracket-winner' : '' },
            h('div', { class: 'duel-bracket-identity' }, avatar(player), h('div', { class: 'duel-bracket-person' }, h('strong', null, player.name),
              h('span', { class: 'small soft' }, `Навык: ${number(row.grade)}/10`, won ? ' · Победа' : ''))),
            h('div', { class: 'duel-bracket-count num' }, h('strong', null, number(row.count)), h('span', { class: 'small soft' }, 'Слова')));
        })),
        h('p', { class: 'duel-bracket-outcome small' }, match.draw ? 'Ничья' : `Победитель: ${(players.find((player) => player.id === match.winner_id) || {}).name || '—'}`));
    }
    function matchCard(match, selected = false) {
      const self = own(match), demo = demonstration(match), done = finished(match) || demo;
      const waitingOpen = !data || data.phase !== 'scheduled';
      const result = match.results || [];
      return h('article', { class: `card duel-match ${selected ? 'duel-selected' : ''}`, 'data-match': match.id },
        h('div', { class: 'row' }, h('span', { class: 'chip' }, names[match.kind || match.stage] || 'Встреча'), demo ? h('span', { class: 'groups-demo-label' }, 'Демо') : null,
          h('span', { class: 'small soft' }, demo ? 'Пример результата' : statuses[match.status] || match.status)),
        h('h3', { class: 'duel-match-heading' }, (match.players || []).flatMap((player, index) => [
          index ? h('span', { 'aria-hidden': 'true' }, '—') : null,
          h('span', { class: 'duel-match-person' }, avatar(player), h('span', null, player.name + (player.is_self ? ' (вы)' : '')))])),
        !demo ? h('div', { class: 'duel-player-status' }, (match.players || []).map((player) => h('span', { class: 'small soft' }, `${player.name}: ${player.completed ? 'ответ принят' : player.ready ? 'готов' : 'ещё не готов'}`))) : null,
        match.topic ? h('p', { class: 'duel-topic' }, 'Общее слово: ', h('strong', null, match.topic)) : h('p', { class: 'small soft' }, 'Слово откроется в момент старта.'),
        !demo && match.own_error ? h('p', { class: 'groups-error', role: 'alert' }, match.own_error, ' Подробности — в «Мой ответ».') : null,
        !demo && (['countdown', 'live'].includes(match.status) || recording && armedId === match.id) ? h('div', { class: 'duel-clock num', 'data-duel-clock': match.id, role: 'timer', 'aria-label': 'Время поединка' }, '—') : null,
        recording && armedId === match.id ? h('p', { class: 'duel-recording', role: 'status' }, 'Идёт запись. Через минуту она отправится автоматически.') : null,
        done ? h('div', { class: 'duel-results' }, result.map((row) => h('div', { class: 'duel-result-row' },
          h('strong', null, ((match.players || []).find((player) => player.id === row.user_id) || {}).name || 'Участник'),
          h('p', { class: 'num' }, `Слова: ${number(row.count)} · Навык: ${number(row.grade)}/10`),
          h('p', { class: 'small soft' }, `Турнирные очки: ${number(row.league_points ?? (match.draw ? 1 : match.winner_id === row.user_id ? 3 : 0))}`))),
          h('p', { class: 'soft' }, match.draw ? 'Ничья' : `Победитель: ${((match.players || []).find((player) => player.id === match.winner_id) || {}).name || '—'}`)) : null,
        !demo ? h('div', { class: 'row duel-actions' },
          self && match.can_ready && waitingOpen && !recording && !starting && !blob ? action('Готов · проверить микрофон', () => ready(match), false, true) : null,
          self && self.ready && !match.own_session_id && armedId !== match.id && (['countdown','live'].includes(match.status) || waitingOpen && match.status === 'waiting') && !recording && !starting && !blob
            ? action('Включить микрофон и продолжить', () => ready(match), false, true) : null,
          self && match.can_cancel && !recording && !starting ? action('Отменить готовность', () => mutate(match, 'cancel')) : null,
          self && match.can_reset && !recording && !starting ? action((match.reset_requested_by || []).includes(self.id) ? 'Ждём согласия соперника' : 'Согласиться на повтор', () => mutate(match, 'reset'), (match.reset_requested_by || []).includes(self.id)) : null,
          match.own_session_id && !recording ? h('a', { class: 'btn ghost', href: `#/s/${enc(match.own_session_id)}` }, 'Мой ответ') : null) : null);
    }
    function tableCard(rows) {
      const demoFinals = data.phase === 'demo_finished' && data.demo_completed === true;
      const qualification = new Map((demoFinals && data.qualification_table || []).map((row) => [row.user_id, row]));
      const frozenOrder = qualification.size > 0;
      if (frozenOrder) rows = rows.map((row) => {
        const saved = qualification.get(row.user_id);
        return { ...row, rank: saved ? saved.rank : null, ...(saved ? {
          points: saved.points ?? saved.league_points ?? row.points,
          wins: saved.wins ?? row.wins, draws: saved.draws ?? row.draws, losses: saved.losses ?? row.losses,
        } : {}) };
      }).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
      return h('article', { class: 'card stack' }, h('h2', null, 'Турнирная таблица'),
        h('p', { class: 'small soft' }, demoFinals ? 'Круговой этап: победа — 3 очка, ничья — 1, поражение — 0. ' + (frozenOrder ? 'Места отбора и турнирные очки зафиксированы до полуфиналов. ' : '') + 'Итоговые места недели определили финальные встречи выше.' : data.phase === 'demo' ? 'Пример кругового этапа: победа — 3 очка, ничья — 1, поражение — 0. Финалы в этом примере не разыграны.' : 'Очки встреч определяют выход в воскресные финалы.'),
        h('p', { class: 'small soft' }, 'В–Н–П: победы, ничьи, поражения.', demoFinals ? ' Средний балл навыка включает круговой этап и финальные встречи. Его умножают на 3 и добавляют к общему рейтингу в кабинете группы.' : ' Средний балл навыка за поединки умножается на 3 и добавляется к общему рейтингу в кабинете группы.'),
        frozenOrder && rows.some((row) => !qualification.has(row.user_id)) ? h('p', { class: 'small soft' }, 'Прочерк в колонке «Отбор» — участник не играл в демонстрационном круговом этапе.') : null,
        rows.length ? h('table', { class: 'groups-ranking duel-ranking' }, h('caption', { class: 'groups-sr-only' }, 'Отбор по результатам поединков'),
          h('thead', null, h('tr', null, [ [frozenOrder ? 'Отбор' : 'Место', 'duel-rank-col'], ['Участник', ''], ['В–Н–П', 'duel-record-col'], ['Очки', 'duel-points-col'] ].map(([title, className]) => h('th', { scope: 'col', class: className }, title)))),
          h('tbody', null, rows.map((row) => h('tr', null, h('td', { class: 'num' }, row.rank || '—'),
            h('th', { scope: 'row', class: 'duel-ranking-person' }, identity(row, 'duel-ranking-identity'), row.demonstration ? h('span', { class: 'groups-demo-label' }, 'Демо') : null,
              row.words_average != null || row.accepted_average != null ? h('span', { class: 'duel-ranking-detail small soft' }, `В среднем слов: ${number(row.words_average ?? row.accepted_average)}`) : null,
              row.skill_score != null ? h('span', { class: 'duel-ranking-detail small soft' }, `Навык: ${number(row.skill_score)}/10`) : null,
              row.combined_rating != null ? h('span', { class: 'duel-ranking-detail small soft' }, `Общий рейтинг: ${number(row.combined_rating)}/100`) : null),
            h('td', { class: 'num' }, `${row.wins ?? 0}–${row.draws ?? 0}–${row.losses ?? 0}`), h('td', { class: 'num' }, row.points ?? row.league_points ?? 0)))))
          : h('p', { class: 'soft' }, 'Результаты появятся после первой завершённой встречи.'));
    }
    async function load() {
      if (loading || !alive()) return;
      loading = true;
      try {
        data = await api(path(gid) + (week ? `?week=${enc(week)}` : ''));
        setClock(data.server_now);
        if (armedId) {
          const match = data.matches.find((item) => item.id === armedId);
          if (match && !starting && !recording && !blob && (demonstration(match) || ['expired', 'cancelled', 'done', 'complete'].includes(match.status))) { armedId = null; closeOwnMic(); }
        }
        if (session && !recording && !blob && (session.analysis || {}).status !== 'done') {
          const fresh = await api(`/api/sessions/${enc(session.id)}`);
          session = fresh; privateSession = fresh;
        }
      } catch (caught) { error = caught.message; }
      loading = false;
      if (alive()) {
        if (!Array.from(root.querySelectorAll('audio')).some((audio) => !audio.paused)) draw();
        schedule();
      }
    }
    function schedule() {
      clearTimeout(pollTimer);
      const match = data && data.matches.find((item) => item.id === armedId);
      const ms = match && ['countdown', 'live'].includes(match.status) ? 250 : armedId || session && (session.analysis || {}).status !== 'done' ? 1200 : 5000;
      pollTimer = setTimeout(load, ms);
    }
    async function ready(match) {
      if (demonstration(match) || pending || recording || starting || blob) return;
      if (data && data.phase === 'scheduled' && match.status === 'waiting') return;
      pending = true; error = ''; draw();
      const profile = window.TrainerDrafts && TrainerDrafts.profile && TrainerDrafts.profile();
      try {
        armedStream = await mic.open();
        if (!alive() || profile && profile !== TrainerDrafts.profile()) { closeOwnMic(); return; }
        if (!(own(match) || {}).ready) await api(`${path(gid)}/${enc(match.id)}/ready`, { method: 'POST', body: {} });
        if (!alive()) {
          closeOwnMic();
          if (!profile || profile === TrainerDrafts.profile()) {
            try { await api(`${path(gid)}/${enc(match.id)}/cancel`, { method: 'POST', body: {} }); } catch (_) { /* Старт уже прошёл; сервер предложит повтор. */ }
          }
          return;
        }
        armedId = match.id; focus = match.id; session = null; privateSession = null;
      } catch (caught) {
        error = caught.message;
        let confirmed = false;
        if (alive() && (!profile || profile === TrainerDrafts.profile())) {
          try {
            const fresh = await api(path(gid));
            const saved = (fresh.matches || []).find((item) => item.id === match.id);
            if (saved && mic.live() && (own(saved) || {}).ready && ['waiting','countdown','live'].includes(saved.status)) {
              data = fresh; setClock(fresh.server_now); armedId = match.id; focus = match.id; confirmed = true; error = '';
            }
          } catch (_) { /* Нет подтверждения, запись ещё не начинается. */ }
        }
        if (!confirmed) closeOwnMic();
      }
      pending = false; if (alive()) await load();
    }
    async function mutate(match, verb) {
      if (demonstration(match) || pending) return;
      pending = true; error = ''; draw();
      try {
        await api(`${path(gid)}/${enc(match.id)}/${verb}`, { method: 'POST', body: {} });
        if (verb === 'cancel') { armedId = null; closeOwnMic(); }
        if (verb === 'reset') focus = match.id;
      } catch (caught) { error = caught.message; }
      pending = false; if (alive()) await load();
    }
    function paintTimer() {
      if (!alive()) return;
      root.querySelectorAll('[data-duel-clock]').forEach((node) => {
        const match = data && data.matches.find((item) => item.id === node.dataset.duelClock);
        if (!match) return;
        const start = Date.parse(match.start_at), end = Date.parse(match.end_at);
        node.textContent = now() < start ? `Старт через ${Math.max(0, Math.ceil((start - now()) / 1000))}` : `${Math.max(0, Math.ceil((end - now()) / 1000))} с`;
      });
      const match = data && data.matches.find((item) => item.id === armedId);
      if (match && !demonstration(match) && !recording && !starting && !session && now() >= Date.parse(match.start_at) && now() < Date.parse(match.end_at)) startRecording(match);
      if (recording && session && now() >= Date.parse(session.duel_end_at)) finishRecording();
    }
    async function startRecording(match) {
      if (demonstration(match)) return;
      if (starting || recording || !mic.live()) return;
      starting = true;
      try {
        session = await api(`${path(gid)}/${enc(match.id)}/session`, { method: 'POST', body: {} });
        setClock(session.server_now);
        if (!alive()) { closeOwnMic(); return; }
        if (Date.parse(session.duel_end_at) - now() < 58500) throw new Error('Связь задержала старт. Запись не началась; повторите встречу с согласия соперника.');
        recordingContext = window.TrainerDrafts && TrainerDrafts.context(); recordingStream = mic.stream;
        rec = new Recorder(mic.stream, { journal: {
          path: `/api/sessions/${session.id}/takes/0`, userId: (own(match) || {}).id, context: recordingContext,
          headers: { 'X-Duel-Nonce': session.duel_nonce },
        } }); rec.start(); recording = true;
        const actual = data.matches.find((item) => item.id === match.id);
        if (actual) { actual.topic = session.topic; actual.status = 'live'; }
      } catch (caught) { error = caught.message; closeOwnMic(); }
      starting = false; draw();
    }
    async function finishRecording() {
      if (!recording || !rec) return;
      recording = false;
      const stopped = rec, recordedSession = session, context = recordingContext; rec = null;
      const headers = { 'X-Duel-Nonce': recordedSession.duel_nonce };
      blob = await stopped.stop({ headers });
      uploadRequest = stopped.savedDraft && stopped.savedDraft.requestId || uploadRequest;
      if (mic.stream === recordingStream) mic.close();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      if (!alive() || (context && window.TrainerDrafts && TrainerDrafts.profile && context.profile !== TrainerDrafts.profile())) {
        if (window.TrainerDrafts && !stopped.savedDraft) await TrainerDrafts.audio(`/api/sessions/${recordedSession.id}/takes/0`, blob, headers, undefined, context || {});
        return;
      }
      await sendAudio();
    }
    async function sendAudio() {
      if (!blob || !session || uploadBusy) return;
      uploadBusy = true; error = ''; draw();
      try {
        session = await api(`/api/sessions/${enc(session.id)}/takes/0`, { method: 'PUT', blob,
          headers: { 'X-Duel-Nonce': session.duel_nonce }, requestId: uploadRequest, onRequestId: (id) => { uploadRequest = id; } });
        blob = null; privateSession = session; uploadRequest = null;
        if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
      } catch (caught) { error = caught.message; if (caught.requestId) uploadRequest = caught.requestId; }
      uploadBusy = false; if (alive()) await load();
    }
    await load();
    ticker = setInterval(paintTimer, 100);
    return { retentionOwner, retentionSession: () => recording || starting || blob || uploadBusy || pending ? null : privateSession || session,
      destroy() {
      destroyed = true; clearTimeout(pollTimer); clearInterval(ticker); window.removeEventListener('beforeunload', beforeUnload);
      root.querySelectorAll('audio').forEach((audio) => audio.pause());
      if (recording && rec) finishRecording();
      else if (!starting) closeOwnMic();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    } };
  }
  return { view, review };
})();
