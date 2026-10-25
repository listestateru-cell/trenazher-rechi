'use strict';
/* Одновременная минута. Сроки, слово и зачёт определяет сервер. */
window.TrainerDuels = (() => {
  const enc = encodeURIComponent;
  const names = { league: 'Встреча недели', semi: 'Полуфинал', semifinal: 'Полуфинал', final: 'Финал · 1–2 место', bronze: 'За 3 место', tiebreak: 'Дополнительная встреча', qualifier: 'Дополнительная встреча' };
  const statuses = { waiting: 'Ожидает готовности', countdown: 'Обратный отсчёт', live: 'Идёт запись', processing: 'Тренер проверяет слова', done: 'Завершён', complete: 'Завершён', expired: 'Нужен повтор', cancelled: 'Не состоялся' };
  const path = (gid) => `/api/groups/${enc(gid)}/duels`;
  const finished = (match) => ['done', 'complete'].includes(match.status);
  const own = (match) => (match.players || []).find((player) => player.is_self);

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
    return { destroy() { stopped = true; clearTimeout(timer); root.querySelectorAll('audio').forEach((audio) => audio.pause()); } };
  }

  async function view(ctx, parts, params) {
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
      const nodes = [
        h('a', { class: 'groups-back', href: `#/groups/${enc(gid)}` }, icon('back'), 'К группе'),
        h('header', { class: 'groups-heading' }, h('div', { class: 'groups-heading-copy' }, h('p', { class: 'groups-eyebrow' }, 'Минута ассоциаций'),
          h('h1', null, 'Поединки недели'), h('p', { class: 'soft' }, data && data.group ? data.group.name : 'Общее слово · 60 секунд · без повторов')),
        action(loading ? 'Обновляю…' : 'Обновить', () => load(), loading || recording || starting)),
        error ? h('p', { class: 'groups-error', role: 'alert' }, error) : null,
        data ? h('p', { class: 'soft' }, data.week && (data.week.label || `${data.week.start} — ${data.week.end}`) || '', ' · ',
          ({ finals: 'Воскресные финалы', qualification_tie: 'Дополнительная встреча за выход в финал', awaiting_results: 'Ждём проверки записанных ответов', finished: data.podium && data.podium.length ? 'Турнир завершён' : 'Финальные встречи не определены' })[data.phase] || 'Встречи каждого с каждым') : null,
        data && data.podium && data.podium.length ? h('div', { class: 'card stack' }, h('h2', null, 'Итог турнира'),
          h('ol', { class: 'duel-podium' }, data.podium.slice(0,3).map((id, index) => h('li', null, h('span', { class: 'num' }, `${index + 1} место`), h('strong', null, ((data.table || []).find((row) => row.user_id === id) || {}).name || 'Участник'))))) : null,
        h('details', { class: 'card duel-rules' }, h('summary', null, 'Как проходит поединок и за что начисляют баллы'),
          h('ol', { class: 'list' }, h('li', null, 'Договоритесь о времени. Оба откройте эту страницу и нажмите «Готов». Сначала браузер проверит микрофон.'),
            h('li', null, 'После подтверждения обоих начнётся общий отсчёт. Слово откроется одновременно с началом минуты. Называйте подходящие слова по одному.'),
            h('li', null, 'Тренер проверит смысловую связь. Повторы, формы одного слова и посторонние слова не учитываются. Разбор своего ответа можно открыть отдельно.'),
            h('li', null, '20–22 подходящих слова дают 1 балл навыка, 23–25 — 2, далее по баллу за каждые 3 слова, максимум 10 за 47 и больше. До 20 слов — 0.'),
            h('li', null, 'Во встрече побеждает тот, кто назвал больше подходящих слов: победа — 3 турнирных очка, ничья — по 1. Это отдельная таблица отбора в финал.'),
            h('li', null, 'В воскресенье четыре лучших играют полуфиналы 1–4 и 2–3. Победители встречаются за первое место, проигравшие — за третье. Незавершённая встреча не превращается в выдуманную победу.')),
          h('p', { class: 'small soft' }, 'Держите экран открытым и не переключайте приложения во время записи. При обрыве связи сохраните запись; несостоявшуюся встречу можно повторить с согласия обоих. Чужие аудио и расшифровки не открываются.')),
        selected ? matchCard(selected, true) : null,
        blob ? h('div', { class: 'card stack', role: 'status' }, h('h2', null, uploadBusy ? 'Отправляю запись…' : 'Запись осталась на устройстве'),
          h('p', { class: 'soft' }, 'Проверка связи не удаляет запись. Для зачёта сервер также проверяет время отправки и фактическую длительность.'),
          h('div', { class: 'row' }, action('Повторить отправку', sendAudio, uploadBusy, true), downloadUrl ? h('a', { class: 'btn ghost', href: downloadUrl, download: 'Поединок.webm' }, 'Скачать запись') : null)) : null,
        privateSession ? privateResult(privateSession) : null,
        !data ? h('div', { class: 'card', role: 'status' }, 'Загружаю встречи…') : [
          h('h2', null, 'Ваши встречи'), mine.length ? h('div', { class: 'duel-match-list' }, mine.filter((match) => !selected || selected.id !== match.id).map((match) => matchCard(match))) : h('div', { class: 'card' }, h('p', { class: 'soft' },
            (data.table || []).length >= 2 ? 'У вас пока нет встреч в этой сетке. Участие и состав группы можно проверить в кабинете. Круговой этап проходит с понедельника по субботу; воскресенье отведено финалам.' : 'Для поединка нужны хотя бы два участника группы. Руководитель может отправить приглашение знакомым.')),
          tableCard(data.table || data.league || []),
          h('details', { class: 'card duel-all' }, h('summary', null, `Все встречи · ${matches.length}`), h('div', { class: 'duel-match-list' }, matches.filter((match) => !inMatch(match)).map((match) => matchCard(match)))),
        ]];
      root.replaceChildren(...nodes.flat(Infinity).filter((node) => node != null && node !== false));
      paintTimer();
    }
    function matchCard(match, selected = false) {
      const self = own(match), done = finished(match);
      const result = match.results || [];
      return h('article', { class: `card duel-match ${selected ? 'duel-selected' : ''}`, 'data-match': match.id },
        h('div', { class: 'row' }, h('span', { class: 'chip' }, names[match.kind || match.stage] || 'Встреча'), h('span', { class: 'small soft' }, statuses[match.status] || match.status)),
        h('h3', null, (match.players || []).map((player) => player.name + (player.is_self ? ' (вы)' : '')).join(' — ')),
        h('div', { class: 'duel-player-status' }, (match.players || []).map((player) => h('span', { class: 'small soft' }, `${player.name}: ${player.completed ? 'ответ принят' : player.ready ? 'готов' : 'ещё не готов'}`))),
        match.topic ? h('p', { class: 'duel-topic' }, 'Общее слово: ', h('strong', null, match.topic)) : h('p', { class: 'small soft' }, 'Слово откроется в момент старта.'),
        match.own_error ? h('p', { class: 'groups-error', role: 'alert' }, match.own_error, ' Подробности — в «Мой ответ».') : null,
        ['countdown', 'live'].includes(match.status) || recording && armedId === match.id ? h('div', { class: 'duel-clock num', 'data-duel-clock': match.id, role: 'timer', 'aria-label': 'Время поединка' }, '—') : null,
        recording && armedId === match.id ? h('p', { class: 'duel-recording', role: 'status' }, 'Идёт запись. Через минуту она отправится автоматически.') : null,
        done ? h('div', { class: 'duel-results' }, result.map((row) => h('p', null,
          ((match.players || []).find((player) => player.id === row.user_id) || {}).name || 'Участник', ': ', `${row.count} слов · ${row.grade} балл. навыка`)),
          h('p', { class: 'soft' }, match.draw ? 'Ничья' : `Победитель: ${((match.players || []).find((player) => player.id === match.winner_id) || {}).name || '—'}`)) : null,
        h('div', { class: 'row duel-actions' },
          self && match.can_ready && !recording && !starting && !blob ? action('Готов · проверить микрофон', () => ready(match), false, true) : null,
          self && self.ready && !match.own_session_id && armedId !== match.id && ['waiting','countdown','live'].includes(match.status) && !recording && !starting && !blob
            ? action('Включить микрофон и продолжить', () => ready(match), false, true) : null,
          self && match.can_cancel && !recording && !starting ? action('Отменить готовность', () => mutate(match, 'cancel')) : null,
          self && match.can_reset && !recording && !starting ? action((match.reset_requested_by || []).includes(self.id) ? 'Ждём согласия соперника' : 'Согласиться на повтор', () => mutate(match, 'reset'), (match.reset_requested_by || []).includes(self.id)) : null,
          match.own_session_id && !recording ? h('a', { class: 'btn ghost', href: `#/s/${enc(match.own_session_id)}` }, 'Мой ответ') : null));
    }
    function tableCard(rows) {
      return h('article', { class: 'card stack' }, h('h2', null, 'Турнирная таблица'), h('p', { class: 'small soft' }, 'Очки встреч определяют выход в воскресные финалы. Общий речевой рейтинг находится в кабинете группы.'),
        rows.length ? h('table', { class: 'groups-ranking' }, h('caption', { class: 'groups-sr-only' }, 'Отбор по результатам поединков'),
          h('thead', null, h('tr', null, ['Место', 'Участник', 'В–Н–П', 'Очки'].map((title) => h('th', { scope: 'col' }, title)))),
          h('tbody', null, rows.map((row) => h('tr', null, h('td', { class: 'num' }, row.rank || '—'), h('th', { scope: 'row' }, row.name), h('td', { class: 'num' }, `${row.wins}–${row.draws}–${row.losses}`), h('td', { class: 'num' }, row.points ?? row.league_points ?? 0)))))
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
          if (match && !starting && !recording && !blob && ['expired', 'cancelled', 'done', 'complete'].includes(match.status)) { armedId = null; closeOwnMic(); }
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
      if (pending || recording || starting || blob) return;
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
      if (pending) return;
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
      if (match && !recording && !starting && !session && now() >= Date.parse(match.start_at) && now() < Date.parse(match.end_at)) startRecording(match);
      if (recording && session && now() >= Date.parse(session.duel_end_at)) finishRecording();
    }
    async function startRecording(match) {
      if (starting || recording || !mic.live()) return;
      starting = true;
      try {
        session = await api(`${path(gid)}/${enc(match.id)}/session`, { method: 'POST', body: {} });
        setClock(session.server_now);
        if (!alive()) { closeOwnMic(); return; }
        if (Date.parse(session.duel_end_at) - now() < 58500) throw new Error('Связь задержала старт. Запись не началась; повторите встречу с согласия соперника.');
        recordingContext = window.TrainerDrafts && TrainerDrafts.context(); recordingStream = mic.stream;
        rec = new Recorder(mic.stream); rec.start(); recording = true;
        const actual = data.matches.find((item) => item.id === match.id);
        if (actual) { actual.topic = session.topic; actual.status = 'live'; }
      } catch (caught) { error = caught.message; closeOwnMic(); }
      starting = false; draw();
    }
    async function finishRecording() {
      if (!recording || !rec) return;
      recording = false;
      const stopped = rec; rec = null;
      blob = await stopped.stop();
      if (mic.stream === recordingStream) mic.close();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      if (!alive()) {
        if (window.TrainerDrafts) await TrainerDrafts.audio(`/api/sessions/${session.id}/takes/0`, blob, { 'X-Duel-Nonce': session.duel_nonce }, undefined, recordingContext || {});
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
    return { destroy() {
      destroyed = true; clearTimeout(pollTimer); clearInterval(ticker); window.removeEventListener('beforeunload', beforeUnload);
      root.querySelectorAll('audio').forEach((audio) => audio.pause());
      if (recording && rec) finishRecording();
      else if (!starting) closeOwnMic();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    } };
  }
  return { view, review };
})();
