'use strict';
/* Командный сезон в кабинете группы: недели, баллы, призёры и срезы.
   Баллы, места, окна срезов и права считает сервер; здесь только отображение.
   Имена участников попадают в разметку текстом, не HTML. */
window.TrainerSeason = (() => {
  const enc = (value) => encodeURIComponent(String(value));
  const list = (value) => Array.isArray(value) ? value : [];
  const whole = (value) => Number.isFinite(value) ? value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '0';
  const mark = (value) => Number.isFinite(value) ? value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
  const signed = (value) => !Number.isFinite(value) ? '' : value > 0 ? `+${mark(value)}` : value < 0 ? `−${mark(Math.abs(value))}` : '0,0';
  const points = (value) => `${whole(value)} ${plural(value || 0, 'балл', 'балла', 'баллов')}`;
  const days = (value) => `${whole(value)} ${plural(value || 0, 'день', 'дня', 'дней')}`;
  const shortDay = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8) + '.' + iso.slice(5, 7) : '';
  const longDay = (iso) => {
    const date = new Date(`${iso}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };
  const weekday = (iso) => {
    const date = new Date(`${iso}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
  };
  const share = (value, maximum) => `${Math.max(0, Math.min(100, maximum > 0 ? value / maximum * 100 : 0)).toFixed(2)}%`;
  const heading = (title, aside) => h('div', { class: 'groups-section-heading' }, h('h2', null, title), aside);
  const duelsRoute = (group) => `#/groups/${enc(group.id)}/duels${group.week && !group.week.current && group.week.start ? `?week=${enc(group.week.start)}` : ''}`;
  const self = (group) => list(group.leaderboard).find((person) => person.is_self && person.season) || null;
  const active = (group) => !!(group && group.season && group.season.exists && group.season.week_number);
  const upcoming = (group) => !!(group && group.season && group.season.exists && group.season.status === 'upcoming'
    && (!group.week || group.week.current));

  function heroTitle(season) {
    if (season.status === 'upcoming') {
      const left = season.days_to_start;
      return left <= 0 ? 'Старт сегодня' : left === 1 ? 'Старт завтра' : `До старта ${days(left)}`;
    }
    if (season.status === 'finished' && !season.week_number) return 'Сезон завершён';
    return `Неделя ${season.week_number || season.current_week_number} из ${season.weeks}`;
  }
  function weekStop(group, week, tools) {
    const champions = list(week.podium).filter((person) => person.place === 1);
    const result = week.state === 'past'
      ? champions.length
        ? h('span', { class: 'season-week-result' }, tools.avatar(champions[0], 'season-week-avatar'),
          h('span', { class: 'season-week-champion' }, h('span', { class: 'season-week-tag' }, 'Чемпион'),
            h('span', null, tools.nameOf(champions[0]), champions.length > 1 ? ` и ещё ${champions.length - 1}` : '')))
        : h('span', { class: 'season-week-result soft small' }, 'Без результатов')
      : h('span', { class: 'season-week-result soft small' }, week.state === 'current' ? 'Идёт сейчас' : 'Впереди');
    const body = [h('span', { class: 'season-week-number' }, `Неделя ${week.number}`),
      h('span', { class: 'season-week-dates small' }, week.label), result];
    const state = { class: 'season-week', 'data-state': week.state, 'data-chosen': String(!!week.chosen) };
    return week.state !== 'future' && week.has_results
      ? h('li', state, h('a', { class: 'season-week-link', href: tools.route(group.id, week.state === 'current' ? null : week.start),
        'aria-current': week.chosen ? 'true' : null }, body))
      : h('li', state, h('div', { class: 'season-week-link' }, body));
  }
  function hero(group, tools) {
    const season = group.season;
    const note = season.status === 'upcoming'
      ? `Первая неделя начнётся ${longDay(season.start)}. До старта можно пройти стартовый срез и размяться на заданиях дня: баллы начнут считаться с понедельника.`
      : season.status === 'finished'
        ? 'Результаты недель и срезы сохранены. Руководитель может запустить следующий сезон.'
        : 'Каждая неделя — отдельный забег. В понедельник баллы обнуляются, а чемпион и призёры остаются в истории сезона.';
    return h('section', { class: 'card season-hero', 'data-status': season.status, 'aria-label': 'Командный сезон' },
      h('div', { class: 'season-hero-copy' },
        h('p', { class: 'season-eyebrow' }, `Командный сезон · ${season.label}`),
        h('h2', null, heroTitle(season)), h('p', { class: 'soft' }, note)),
      h('ol', { class: 'season-weeks', 'aria-label': 'Недели сезона' }, list(season.timeline).map((week) => weekStop(group, week, tools))));
  }

  function dayStrip(group) {
    return h('ol', { class: 'season-days', 'aria-label': 'Задания по дням недели' }, list(group.daily).map((item) => {
      const total = list(item.tasks).length || 5, done = item.completed || 0;
      return h('li', { class: 'season-day', 'data-today': String(!!item.today), 'data-full': String(done >= total),
        'data-future': String(!!group.today && item.date > group.today),
        'aria-label': `${longDay(item.date)}: ${whole(done)} из ${whole(total)}, ${points(item.season_points || 0)}` },
      h('span', { class: 'season-day-bar', 'aria-hidden': 'true' }, h('span', { style: `height:${share(done, total)}` })),
      h('span', { class: 'season-day-name', 'aria-hidden': 'true' }, weekday(item.date)));
    }));
  }
  function bonusNote(group, daily, steps) {
    const next = steps.find((step) => step.days > daily.full_days);
    if (!next) return 'Все ступени бонуса взяты.';
    if (!group.week || !group.week.current) return `Полных дней: ${whole(daily.full_days)}.`;
    const open = list(group.daily).filter((item) => item.date >= group.today && (item.completed || 0) < (list(item.tasks).length || 5)).length;
    const need = next.days - daily.full_days;
    return need > open ? `Полных дней: ${whole(daily.full_days)}. Следующая ступень на этой неделе уже недоступна.`
      : `Полных дней: ${whole(daily.full_days)}. До +${whole(next.bonus)} — ещё ${days(need)}.`;
  }
  function score(group, tools) {
    const own = self(group), policy = group.score_policy || {};
    if (!own) return null;
    const mine = own.season, daily = mine.daily, fights = mine.battles;
    const steps = list(policy.full_day_bonus), battle = policy.battle || {};
    const total = list(group.leaderboard).length;
    const waiting = list(group.season.battles && group.season.battles.waiting);
    // Три кольца недели, как в «Фитнесе»: у каждой части свой потолок, а не общий максимум.
    const taskLimit = (policy.task || 2) * (list(group.daily).reduce((sum, item) => sum + (list(item.tasks).length || 5), 0) || 35);
    const bonusLimit = steps.reduce((best, step) => Math.max(best, step.bonus || 0), 0) || 30;
    const battleLimit = (battle.win || 10) * Math.max(1, total - 1);
    const ringShare = (value, limit) => Math.round(Math.max(0, Math.min(1, limit > 0 ? (value || 0) / limit : 0)) * 1000) / 10;
    const ring = (part, value, limit) => h('span', { class: 'fit-ring', 'data-part': part,
      'data-empty': String(!(value > 0)), style: `--p:${ringShare(value, limit)}` });
    return h('section', { class: 'card season-score', 'aria-label': 'Ваши баллы недели' },
      heading(group.week && group.week.current ? 'Ваши баллы недели' : 'Ваши баллы за эту неделю',
        h('span', { class: 'small soft' }, own.rank ? `Место ${whole(own.rank)} из ${whole(total)}` : 'Место пока не определено')),
      h('div', { class: 'season-summary' },
        h('div', { class: 'fit-rings season-rings', role: 'img',
          'aria-label': `Задания ${whole(daily.task_points)} из ${whole(taskLimit)}, бонус ${whole(daily.bonus)} из ${whole(bonusLimit)}, битвы ${whole(fights.points)} из ${whole(battleLimit)}` },
        ring('tasks', daily.task_points, taskLimit), ring('bonus', daily.bonus, bonusLimit), ring('battles', fights.points, battleLimit)),
        h('div', { class: 'season-total' }, h('strong', { class: 'num' }, whole(mine.total)),
          h('span', { class: 'soft' }, `${plural(mine.total, 'балл', 'балла', 'баллов')} из ${whole(policy.maximum)} возможных`))),
      h('div', { class: 'season-tiles' },
        h('article', { class: 'season-tile', 'data-part': 'tasks' },
          h('h3', null, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'Задания дня', h('strong', { class: 'num' }, whole(daily.task_points))),
          dayStrip(group),
          h('p', { class: 'small soft' }, `${whole(daily.tasks)} из ${whole(list(group.daily).reduce((sum, item) => sum + (list(item.tasks).length || 5), 0) || 35)} заданий. Каждое — ${points(policy.task || 2)}.`)),
        h('article', { class: 'season-tile', 'data-part': 'bonus' },
          h('h3', null, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'Бонус за полные дни', h('strong', { class: 'num' }, whole(daily.bonus))),
          h('ol', { class: 'season-steps', 'aria-label': 'Ступени бонуса' }, steps.map((step) => h('li', { 'data-reached': String(daily.full_days >= step.days) },
            h('strong', { class: 'num' }, `+${whole(step.bonus)}`), h('span', { class: 'small' }, days(step.days))))),
          h('p', { class: 'small soft' }, bonusNote(group, daily, steps))),
        h('article', { class: 'season-tile', 'data-part': 'battles' },
          h('h3', null, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'Битвы', h('strong', { class: 'num' }, whole(fights.points))),
          h('dl', { class: 'season-record' },
            h('div', null, h('dt', null, 'Победы'), h('dd', { class: 'num' }, whole(fights.wins))),
            h('div', null, h('dt', null, 'Ничьи'), h('dd', { class: 'num' }, whole(fights.draws))),
            h('div', null, h('dt', null, 'Поражения'), h('dd', { class: 'num' }, whole(fights.losses)))),
          h('p', { class: 'small soft' }, `Сыграно ${whole(fights.played)} из ${whole(Math.max(0, total - 1))}. Победа — ${whole(battle.win)}, ничья — ${whole(battle.draw)}, поражение — ${whole(battle.loss)}.`))),
      waiting.length && group.week && group.week.current ? h('p', { class: 'season-waiting', role: 'status' },
        h('span', { class: 'season-waiting-people' }, waiting.slice(0, 3).map((person) => tools.avatar(person, 'season-waiting-avatar'))),
        h('span', null, waiting.length === 1 ? `${tools.nameOf(waiting[0])} ждёт вас в битве.` : `Вас ждут в битве: ${waiting.map(tools.nameOf).join(', ')}.`),
        h('a', { class: 'btn', href: duelsRoute(group) }, 'Принять битву', icon('arrow'))) : null);
  }

  function podium(group, tools) {
    const previous = group.season.previous_week;
    if (!previous) {
      return group.season.status === 'active' && group.season.current_week_number === 1 && group.week && group.week.current
        ? h('section', { class: 'card season-podium season-podium-empty' }, h('h2', null, 'Первый чемпион — в понедельник'),
          h('p', { class: 'soft' }, 'Неделя закончится в воскресенье в 23:59. Тот, кто наберёт больше всех баллов, станет чемпионом недели; здесь появятся три призёра.'))
        : null;
    }
    const titles = ['Чемпион недели', 'Второе место', 'Третье место'];
    return h('section', { class: 'card season-podium', 'aria-label': `Итоги недели ${previous.number}` },
      heading(`Итоги недели ${previous.number}`, h('span', { class: 'small soft' }, previous.label)),
      h('ol', { class: 'season-stage' }, [1, 2, 3].map((place) => {
        const people = list(previous.podium).filter((person) => person.place === place);
        return h('li', { class: 'season-stage-step', 'data-place': place, 'data-empty': String(!people.length) },
          h('div', { class: 'season-stage-people' }, people.length ? people.map((person) => h('div', { class: 'season-stage-person' },
            tools.avatar(person, 'season-stage-avatar'),
            h('strong', null, tools.nameOf(person), person.is_self ? h('span', { class: 'season-you' }, ' · вы') : null),
            h('span', { class: 'num small soft' }, points(person.total)))) : null),
          h('div', { class: 'season-stage-block' }, h('span', { class: 'season-stage-place num' }, place), h('span', { class: 'small' }, titles[place - 1])));
      })),
      h('a', { class: 'groups-award-link', href: tools.route(group.id, previous.start) }, `Все результаты недели ${previous.number}`, icon('arrow')));
  }

  function trackStep(item) {
    const done = item.state === 'done';
    const caption = done ? mark(item.score) : item.state === 'open' ? 'сейчас' : item.state === 'missed' ? 'пропущен' : shortDay(item.opens);
    const trend = !Number.isFinite(item.delta) ? null : item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : 'flat';
    return h('li', { class: 'season-track-step', 'data-state': item.state,
      'aria-label': `${item.title}: ${done ? `${mark(item.score)} из 10${trend ? `, изменение ${signed(item.delta)}` : ''}` : item.state === 'open' ? 'открыт' : item.state === 'missed' ? 'пропущен' : `откроется ${longDay(item.opens)}`}` },
    h('span', { class: 'season-track-delta num', 'data-trend': trend || 'none', 'aria-hidden': 'true' }, trend ? signed(item.delta) : ''),
    h('span', { class: 'season-track-bar', 'aria-hidden': 'true' }, h('span', { style: `height:${share(done ? item.score : 0, 10)}` })),
    h('strong', { class: 'season-track-score num', 'aria-hidden': 'true' }, caption),
    h('span', { class: 'season-track-name small', 'aria-hidden': 'true' }, item.short),
    done && item.session_id ? h('a', { class: 'season-track-link small', href: `#/s/${enc(item.session_id)}` }, 'Разбор') : null);
  }
  function checkpoints(group, tools) {
    const view = group.season.checkpoints;
    if (!view || !group.joined && !list(view.own).some((item) => item.state === 'done')) return null;
    const current = view.current, items = list(view.own), seconds = view.seconds || 60;
    return h('section', { class: 'card season-checkpoint', 'aria-label': 'Срез команды' },
      heading('Срез', h('span', { class: 'chip' }, 'Видите только вы')),
      h('p', { class: 'soft' }, `Один текст и один вопрос для всей команды: ${seconds} секунд на пересказ и ${seconds} на ответ. Баллов срез не даёт. Он показывает, как меняется ваша оценка тренера от недели к неделе.`),
      current ? h('div', { class: 'season-checkpoint-call' },
        h('div', null, h('strong', null, current.title),
          h('p', { class: 'small soft' }, `Открыт по ${longDay(current.closes)} включительно. Проходится один раз, занимает около трёх минут.`)),
        h('button', { class: 'btn', type: 'button', disabled: tools.pending, onclick: tools.onCheckpoint },
          tools.pending ? 'Открываю…' : current.session_id ? 'Продолжить срез' : 'Пройти срез', icon('arrow'))) : null,
      h('ol', { class: 'season-track' }, items.map(trackStep)),
      Number.isFinite(view.change) ? h('p', { class: 'season-track-summary' }, 'С первого среза: ',
        h('strong', { class: 'num', 'data-trend': view.change > 0 ? 'up' : view.change < 0 ? 'down' : 'flat' }, signed(view.change)),
        ` · было ${mark(view.first_score)}, стало ${mark(view.last_score)}`) : null,
      h('p', { class: 'small soft' }, view.privacy || ''));
  }
  function team(group, tools) {
    const view = group.season.checkpoints, rows = list(view && view.team), columns = list(view && view.own);
    if (!view || !Array.isArray(view.team)) return null;
    return h('details', { class: 'card season-team' }, h('summary', null, 'Срезы команды · видит только владелец'),
      rows.length ? h('div', { class: 'season-team-scroll' }, h('table', { class: 'groups-ranking season-team-table' },
        h('caption', { class: 'groups-sr-only' }, 'Оценка тренера в срезах по участникам'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Участник'), columns.map((item) => h('th', { scope: 'col', class: 'num' }, item.short)),
          h('th', { scope: 'col', class: 'num' }, 'Изменение'))),
        h('tbody', null, rows.map((person) => h('tr', null,
          h('th', { scope: 'row' }, h('span', { class: 'season-team-person' }, tools.avatar(person, 'season-team-avatar'), h('span', null, tools.nameOf(person)))),
          columns.map((item) => {
            const result = person.results && person.results[item.id];
            return h('td', { class: 'num' }, result ? mark(result.score) : '—');
          }),
          h('td', { class: 'num season-team-change', 'data-trend': !Number.isFinite(person.change) ? 'none' : person.change > 0 ? 'up' : person.change < 0 ? 'down' : 'flat' },
            Number.isFinite(person.change) ? signed(person.change) : '—'))))))
        : h('p', { class: 'soft' }, 'Срезы появятся, когда участники их пройдут.'));
  }

  function boardRows(group, person, index, tools) {
    const key = String(person.user_id ?? index), id = `season-result-${enc(group.id)}-${enc(key)}`;
    const mine = person.season || { total: 0, daily: {}, battles: {} }, daily = mine.daily || {}, fights = mine.battles || {};
    const maximum = Math.max((group.score_policy || {}).maximum || 0, ...list(group.leaderboard).map((row) => row.season ? row.season.total : 0), 1);
    const opened = tools.expanded.has(key);
    const metric = (title, value, note) => h('div', null, h('dt', null, title), h('dd', { class: 'num' }, value, note ? h('span', { class: 'small soft' }, ` ${note}`) : null));
    const detail = h('tr', { class: 'groups-standing-details', hidden: !opened }, h('td', { colspan: 3 },
      h('section', { id, class: 'groups-participant-results', role: 'region', 'aria-label': `Баллы недели: ${tools.nameOf(person)}` },
        h('dl', { class: 'groups-participant-metrics' },
          metric('Задания дня', points(daily.task_points || 0), `${whole(daily.tasks || 0)} шт.`),
          metric('Бонус за полные дни', `+${whole(daily.bonus || 0)}`, `полных дней: ${whole(daily.full_days || 0)}`),
          metric('Битвы', points(fights.points || 0), `${whole(fights.wins || 0)}–${whole(fights.draws || 0)}–${whole(fights.losses || 0)}`),
          metric('Оценка тренера', person.trainer_average == null ? 'Пока нет' : `${mark(person.trainer_average)} / 10`)),
        h('p', { class: 'small soft' }, 'Битвы показаны как победы–ничьи–поражения. Оценка тренера баллов не даёт: она решает спор при равных баллах и победах.'))));
    detail.hidden = !opened;
    const trigger = h('button', { class: 'groups-standing-trigger', type: 'button', 'aria-expanded': String(opened), 'aria-controls': id,
      'aria-label': `Баллы недели: ${tools.nameOf(person)}`, onclick: () => {
        const show = !tools.expanded.has(key);
        if (show) tools.expanded.add(key); else tools.expanded.delete(key);
        detail.hidden = !show;
        trigger.setAttribute('aria-expanded', String(show));
      } }, tools.avatar(person, 'groups-standing-avatar'),
    h('span', { class: 'groups-standing-identity' },
      h('span', { class: 'groups-standing-name' }, tools.nameOf(person), person.is_self ? h('span', { class: 'groups-standing-self small' }, ' · вы') : null),
      h('span', { class: 'season-meter season-meter-small', 'aria-hidden': 'true' },
        h('span', { 'data-part': 'tasks', style: `width:${share(daily.task_points || 0, maximum)}` }),
        h('span', { 'data-part': 'bonus', style: `width:${share(daily.bonus || 0, maximum)}` }),
        h('span', { 'data-part': 'battles', style: `width:${share(fights.points || 0, maximum)}` }))),
    h('span', { class: 'groups-standing-chevron', 'aria-hidden': 'true' }));
    return [h('tr', { class: `groups-standing-row${person.is_self ? ' groups-self' : ''}`, 'data-participant': key },
      h('td', { class: 'groups-rank num' }, h('span', { class: 'groups-rank-badge season-place', 'data-place': mine.total > 0 && person.rank <= 3 ? person.rank : '' }, person.rank || '—')),
      h('th', { scope: 'row', class: 'groups-ranking-person' }, trigger),
      h('td', { class: 'groups-ranking-points num', 'aria-label': points(mine.total) }, whole(mine.total))), detail];
  }
  function board(group, tools) {
    const rows = list(group.leaderboard);
    return h('article', { class: 'card groups-leaderboard season-board' },
      heading(group.week && group.week.current ? 'Таблица недели' : 'Итоговая таблица недели',
        h('span', { class: 'small soft' }, `${whole(rows.length)} ${plural(rows.length, 'участник', 'участника', 'участников')}`)),
      h('p', { class: 'small soft season-legend' },
        h('span', { 'data-part': 'tasks' }, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'задания'),
        h('span', { 'data-part': 'bonus' }, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'бонус'),
        h('span', { 'data-part': 'battles' }, h('span', { class: 'season-dot', 'aria-hidden': 'true' }), 'битвы'),
        h('span', null, 'Нажмите на участника, чтобы увидеть разбивку.')),
      rows.length ? h('table', { class: 'groups-ranking groups-standings season-standings' },
        h('caption', { class: 'groups-sr-only' }, 'Место, участник и баллы недели. Разбивка раскрывается по нажатию на имя.'),
        h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'groups-rank-col', 'aria-label': 'Место' }, '№'),
          h('th', { scope: 'col' }, 'Участник'), h('th', { scope: 'col', class: 'groups-numeric-col' }, 'Баллы'))),
        h('tbody', null, rows.flatMap((person, index) => boardRows(group, person, index, tools))))
        : h('p', { class: 'soft' }, 'Таблица появится, когда в группу вступят участники.'));
  }

  function battles(group) {
    const view = group.season.battles, policy = (group.score_policy || {}).battle || {};
    return h('article', { class: 'card groups-duels-card' },
      h('div', { class: 'groups-duels-heading' }, icon('scales'), h('h2', null, 'Битвы недели')),
      h('p', { class: 'soft' }, 'С каждым участником команды — одна битва в неделю, в любой день. Обоим достаётся одно слово и одна минута: побеждает тот, у кого больше подходящих слов без повторов.'),
      h('p', { class: 'small soft' }, view ? `Сыграно ${whole(view.played)} из ${whole(view.total)}. ` : '',
        `Победа — ${whole(policy.win ?? 10)}, ничья — ${whole(policy.draw ?? 5)}, поражение — ${whole(policy.loss ?? 2)}. Записи и списки слов остаются личными.`),
      h('a', { class: 'btn ghost', href: duelsRoute(group) }, group.week && group.week.current ? 'К битвам' : 'Битвы этой недели', icon('arrow')));
  }

  function pointsTable(policy) {
    const battle = policy.battle || {}, row = (what, value) => h('tr', null, h('th', { scope: 'row' }, what), h('td', { class: 'num' }, value));
    return h('table', { class: 'season-rules-table' }, h('caption', { class: 'groups-sr-only' }, 'За что начисляются баллы недели'),
      h('tbody', null,
        row('Задание дня с разбором тренера', `+${whole(policy.task ?? 2)}`),
        row(`Полный день: ${whole(policy.tasks_per_day ?? 5)} заданий`, `${whole(policy.day ?? 10)}`),
        list(policy.full_day_bonus).map((step) => row(`${days(step.days)} без пропусков за неделю`, `+${whole(step.bonus)}`)),
        row('Победа в битве', `+${whole(battle.win ?? 10)}`), row('Ничья в битве', `+${whole(battle.draw ?? 5)}`),
        row('Поражение в сыгранной битве', `+${whole(battle.loss ?? 2)}`)));
  }
  function rules(group, privacy) {
    const policy = group.score_policy && group.score_policy.mode === 'season' ? group.score_policy : null;
    return h('details', { class: 'card groups-rules season-rules' }, h('summary', null, 'Как начисляются баллы'),
      policy ? [pointsTable(policy),
        h('p', { class: 'season-rules-max' }, `Максимум недели в этой команде: ${whole(policy.daily_maximum)} за задания и ${whole(policy.battle_maximum)} за ${whole(policy.battles)} ${plural(policy.battles || 0, 'битву', 'битвы', 'битв')} — всего ${whole(policy.maximum)}.`)] : null,
      h('ul', { class: 'groups-rule-list' }, list(group.rules).map((rule) => h('li', null, rule))),
      privacy ? h('p', { class: 'small soft groups-privacy' }, privacy) : null);
  }

  function manage(group, tools, form) {
    const season = group.season || {};
    if (!season.can_manage) return null;
    if (season.exists && season.status !== 'finished') {
      if (!season.can_cancel) return null;
      return h('details', { class: 'groups-leave season-manage' }, h('summary', null, 'Управление сезоном'),
        h('p', { class: 'small soft' }, season.status === 'upcoming'
          ? 'До старта сезон можно отменить и назначить заново. Пройденные стартовые срезы останутся в истории.'
          : 'Остановка сезона возвращает группе обычный недельный рейтинг. Зачёт заданий и сыгранные битвы сохраняются.'),
        h('button', { class: 'btn ghost', type: 'button', disabled: tools.pending, onclick: tools.onCancel },
          tools.pending ? 'Сохраняю…' : form.cancelArmed ? 'Подтвердить отмену сезона' : season.status === 'upcoming' ? 'Отменить сезон' : 'Остановить сезон'));
    }
    const options = list(season.start_options), start = form.start || season.default_start || options[0] || '';
    const weeks = form.weeks || season.default_weeks || 4;
    const range = Array.from({ length: Math.max(1, (season.max_weeks || 6) - (season.min_weeks || 1) + 1) }, (_, index) => (season.min_weeks || 1) + index);
    const startSelect = h('select', { id: 'season-start', class: 'groups-input', value: start, onchange: (event) => tools.onForm({ start: event.target.value }) },
      options.map((value, index) => h('option', { value, selected: value === start }, `${longDay(value)}${index === 0 ? ' — эта неделя' : ''}`)));
    const weeksSelect = h('select', { id: 'season-weeks', class: 'groups-input', value: String(weeks), onchange: (event) => tools.onForm({ weeks: Number(event.target.value) }) },
      range.map((value) => h('option', { value, selected: value === weeks }, `${value} ${plural(value, 'неделя', 'недели', 'недель')}`)));
    // Значения берём из полей в момент отправки: выбор мог измениться после отрисовки.
    return h('form', { class: 'card season-manage season-start-form', onsubmit: (event) => {
      event.preventDefault();
      return tools.onStart({ start: startSelect.value || start, weeks: Number(weeksSelect.value) || weeks });
    } },
      h('h2', null, season.exists ? 'Следующий сезон' : 'Командный сезон'),
      h('p', { class: 'soft' }, 'Сезон превращает группу в недельное соревнование: баллы за задания дня и битвы, чемпион каждой недели и общий срез команды. В понедельник счёт начинается с нуля.'),
      h('div', { class: 'groups-profile-fields' },
        h('div', { class: 'groups-field' }, h('label', { for: 'season-start' }, 'Первая неделя'), startSelect,
          h('p', { class: 'small soft' }, 'Сезон начинается с понедельника. Если выбрать идущую неделю, уже выполненные задания войдут в зачёт.')),
        h('div', { class: 'groups-field' }, h('label', { for: 'season-weeks' }, 'Длительность'), weeksSelect,
          h('p', { class: 'small soft' }, 'Месяц — это четыре недели и пять срезов: стартовый и в конце каждой недели.'))),
      form.error ? h('div', { class: 'groups-error', role: 'alert' }, form.error) : null,
      h('div', { class: 'groups-form-actions' }, h('button', { class: 'btn', type: 'submit', disabled: tools.pending }, tools.pending ? 'Запускаю…' : 'Запустить сезон')));
  }

  function cardBadge(group) {
    const badge = group.season_badge;
    if (!badge) return null;
    const text = badge.status === 'upcoming' ? `Сезон с ${shortDay(badge.start)}` : badge.status === 'finished' ? 'Сезон завершён'
      : `Сезон · неделя ${badge.week || '—'} из ${badge.weeks}`;
    return h('span', { class: `chip season-chip${badge.status === 'active' ? ' good' : ''}` }, text);
  }

  return { active, upcoming, hero, score, podium, checkpoints, team, board, battles, rules, manage, cardBadge, points };
})();
