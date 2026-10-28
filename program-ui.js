'use strict';
/* Календарь, зачёт и выбранную программу хранит сервер. Клиент их не пересчитывает. */
window.TrainerProgramUI = (() => {
  const list = value => Array.isArray(value) ? value : [];
  const safe = value => Number.isFinite(value) ? value : 0;
  const score = value => Number.isFinite(value) ? value.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : '—';
  const dayWord = value => {
    const n = Math.abs(value) % 100, last = n % 10;
    return n > 10 && n < 20 ? 'дней' : last === 1 ? 'день' : last > 1 && last < 5 ? 'дня' : 'дней';
  };
  const date = value => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : String(value || '');
  };
  const stateLabels = { full: 'Всё выполнено', partial: 'Часть упражнений', missed: 'Пропущен', today: 'Сегодня', future: 'Впереди' };
  const keep = values => values.flat(Infinity).filter(value => value != null && value !== false);

  async function view(ctx) {
    const owner = window.TrainerDrafts && TrainerDrafts.profile();
    let disposed = false, data = null, busy = false, loading = true, error = '', notice = '', selectedDate = null;
    const live = () => !disposed && ctx.alive() && (!owner || !window.TrainerDrafts || TrainerDrafts.profile() === owner);
    const root = h('section', { class: 'program-ui stack', 'data-program-view': '' });
    const uiIcon = name => window.TrainerTrainingUI ? TrainerTrainingUI.icon(name) : icon(name);
    function currentScope() { return data && data.scope || 'personal'; }
    function dayStatus(day) { return data.phase === 'not_started' ? 'future' : stateLabels[day.status] ? day.status : 'future'; }
    function calendarLabel(day) {
      const status = dayStatus(day);
      return `День ${day.day}, ${date(day.date)}. ${stateLabels[status]}. Выполнено ${safe(day.completed)} из ${safe(day.total) || 5}. Баллы: ${safe(day.points)}${day.bonus ? ` и ${day.bonus} за серию` : ''}.`;
    }
    async function load() {
      if (busy || !live()) return;
      loading = true; error = ''; draw();
      try { const saved = await api('/api/program'); if (live()) { data = saved; selectedDate = null; } }
      catch (caught) { if (live()) error = caught.message || 'Не удалось загрузить программу.'; }
      finally { loading = false; if (live()) draw(); }
    }
    async function mutate(action, scope) {
      if (busy || !data || !live()) return;
      if (action === 'start' && data.phase !== 'not_started') return;
      if (action === 'select' && (!list(data.options).some(item => item.scope === scope) || scope === currentScope())) return;
      busy = true; error = ''; notice = action === 'select' ? 'Открываем выбранную программу…' : 'Начинаем программу…'; draw();
      try {
        const saved = await api('/api/program', { method: 'POST', body: { action, scope } });
        if (!live()) return;
        data = saved; selectedDate = null;
        notice = action === 'select' ? `Выбрана программа «${data.title}».` : 'Курс начался. Можно перейти к первому упражнению.';
      } catch (caught) { if (live()) { error = (caught.message || 'Не удалось сохранить программу.') + ' Ваши результаты сохранены. Попробуйте ещё раз.'; notice = ''; } }
      finally { busy = false; if (live()) draw(action === 'select' ? 'scope' : 'start'); }
    }
    function stat(label, value, extra = '') {
      return h('div', { class: 'program-stat' }, h('strong', { class: 'program-stat-value num' }, value), h('span', null, label), extra ? h('small', { class: 'soft' }, extra) : null);
    }
    function dayDetails(day) {
      const state = dayStatus(day);
      return h('div', { class: 'program-day-details', id: 'program-day-details', role: 'status', 'aria-live': 'polite', 'data-program-day-details': day.date },
        h('h3', null, `День ${day.day} · ${date(day.date)}`),
        h('p', null, `${stateLabels[state]}. Выполнено ${safe(day.completed)} из ${safe(day.total) || 5} упражнений.`),
        h('p', { class: 'small soft' }, data.phase === 'not_started' ? 'Календарь начнётся в день старта программы.'
          : state === 'full' ? `За день: ${safe(day.points)} баллов${day.bonus ? `. Бонус за серию: +${day.bonus}` : ''}.`
            : state === 'future' ? 'Этот день ещё не наступил.'
              : day.today ? '10 баллов за день появятся, когда тренер разберёт все пять упражнений.'
                : 'День не закрыт полностью. Отдельные результаты сохранены; продолжайте с сегодняшних заданий.'));
    }
    function draw(focusKey = '') {
      if (!live()) return;
      const focusTargets = new Map();
      const heading = h('header', { class: 'program-heading stack' }, h('h1', null, 'Программа на 30 дней'),
        h('p', { class: 'soft' }, 'Пять упражнений в день. Календарь поможет держать ритм и видеть, сколько уже пройдено.'));
      if (!data) {
        const retry = h('button', { type: 'button', class: 'btn ghost', onclick: load, disabled: loading }, 'Попробовать ещё раз');
        root.replaceChildren(heading, h('div', { class: 'card stack', role: loading ? 'status' : 'alert' },
          h('p', null, loading ? 'Загружаем программу…' : error), ...keep([loading ? null : retry])));
        return;
      }
      const options = list(data.options);
      const picker = h('select', { id: 'program-scope', 'data-program-scope': '', disabled: busy,
        onchange: event => mutate('select', event.target.value) }, options.map(item => h('option', { value: item.scope },
        `${item.title}${item.age_band === 'under14' ? ' · до 14 лет' : item.age_band === 'adults' ? ' · 14+' : ''}`)));
      picker.value = currentScope(); focusTargets.set('scope', picker);
      const selectedOption = options.find(item => item.scope === currentScope());
      const pickerCard = h('section', { class: 'card program-scope stack' }, h('label', { for: 'program-scope' }, 'Где тренируемся?'), picker,
        h('p', { class: 'small soft' }, data.group_id ? 'У этой группы свои темы и отдельный календарь. Задания общие для всех её участников.'
          : 'Личный курс. Его результаты считаются отдельно от программ ваших групп.'),
        selectedOption && selectedOption.age_band === 'under14' ? h('p', { class: 'small soft' }, 'Темы этой группы рассчитаны на детей до 14 лет.') : null,
        data.group_id ? h('a', { href: `#/groups/${encodeURIComponent(data.group_id)}`, class: 'program-group-link' }, 'Открыть группу', icon('arrow')) : null);
      const status = h('div', { class: 'program-status', 'aria-live': 'polite' },
        ...keep([error ? h('p', { role: 'alert', class: 'program-error' }, error) : null,
          notice ? h('p', { role: 'status', class: 'small soft' }, notice) : null]));
      const fullDays = safe(data.completed_days), totalDays = safe(data.policy && data.policy.days) || 30;
      const overview = h('section', { class: 'card program-overview stack', 'data-program-overview': currentScope() },
        h('div', { class: 'row' }, h('h2', null, data.phase === 'finished' ? 'Курс завершён' : data.phase === 'not_started' ? 'Ваши следующие 30 дней' : `День ${data.day_number} из ${totalDays}`),
          h('span', { class: 'spacer' }), data.start ? h('span', { class: 'small soft' }, `${date(data.start)} — ${date(data.end)}`) : null),
        h('div', { class: 'program-completion-label' }, h('span', null, 'Полностью пройдено дней'), h('strong', { class: 'num', 'data-program-completed': '' }, `${fullDays} / ${totalDays}`)),
        h('progress', { class: 'program-progress', value: fullDays, max: totalDays, 'aria-label': `Полностью пройдено ${fullDays} из ${totalDays} дней` }),
        h('div', { class: 'program-stats' },
          stat('баллов курса', `${safe(data.points)} / ${safe(data.maximum_points) || 320}`, `Бонусы за серии: ${safe(data.bonus_points)}`),
          stat('подряд сейчас', `${safe(data.streak)} ${dayWord(safe(data.streak))}`, `Лучшая серия: ${safe(data.best_streak)}`),
          stat('полных дней', String(fullDays), `Из ${totalDays}`),
          stat('неполных и пропусков', String(safe(data.missed_days)), 'Только прошедшие дни')),
        h('p', { class: 'program-motivation small' }, data.phase === 'finished' ? 'Календарь и заработанные баллы остаются здесь. Посмотрите, как изменилась речь, на странице прогресса.'
          : data.phase === 'not_started' ? 'Начните сегодня. Полный день из пяти разобранных упражнений принесёт 10 баллов.'
            : data.completed_today === 5 ? safe(data.day_number) >= totalDays ? 'Последний день курса выполнен. Все заработанные баллы сохранены.' : 'На сегодня всё выполнено. Баллы за день сохранены; завтра продолжится серия.'
              : safe(data.streak) > 0 ? `До следующего бонуса +5: ${safe(data.next_bonus_in)} ${dayWord(safe(data.next_bonus_in))} с полностью выполненными заданиями.`
                : safe(data.missed_days) > 0 ? 'Серия начинается заново, а заработанные баллы и оценки остаются. Можно продолжить сегодня.'
                  : 'Закройте все пять упражнений сегодня, чтобы начать серию.'));
      const awards = h('section', { class: 'program-awards', 'aria-label': 'Награды за серии' }, [7, 14, 30].map(days => {
        const earned = safe(data.best_streak) >= days;
        return h('div', { class: `program-award${earned ? ' earned' : ''}`, 'data-program-award': String(days), 'data-earned': String(earned) },
          uiIcon('program'), h('strong', null, `${days} дней подряд`), h('span', { class: 'small' }, earned ? 'Получено' : 'Впереди'));
      }));
      const calendar = list(data.calendar);
      const selectedDay = calendar.find(day => day.date === selectedDate) || calendar.find(day => day.today) || calendar[calendar.length - 1];
      const calendarCard = h('section', { class: 'card program-calendar-card stack' }, h('h2', null, 'Календарь'),
        h('p', { class: 'small soft' }, 'Нажмите на день, чтобы посмотреть его результат.'),
        h('div', { class: 'program-calendar', role: 'group', 'aria-label': '30 дней программы' }, calendar.map(day => {
          const state = dayStatus(day), chosen = selectedDay && selectedDay.date === day.date;
          const cell = h('button', { type: 'button', class: `program-calendar-day is-${state}${day.today && data.phase !== 'not_started' ? ' is-today' : ''}`,
            'data-program-day': String(day.day), 'data-date': day.date, 'data-status': state,
            'aria-label': calendarLabel(day), 'aria-pressed': String(!!chosen), 'aria-controls': 'program-day-details',
            'aria-current': day.today && data.phase !== 'not_started' ? 'date' : null,
            onclick: () => { selectedDate = day.date; draw('day:' + day.date); } },
          h('span', { class: 'program-calendar-number' }, String(day.day)), h('span', { class: 'program-calendar-mark', 'aria-hidden': 'true' }, state === 'full' ? '✓' : state === 'partial' ? `${safe(day.completed)}/5` : state === 'missed' ? '−' : state === 'today' ? '•' : ''));
          focusTargets.set('day:' + day.date, cell); return cell;
        })),
        h('div', { class: 'program-calendar-legend' }, Object.entries(stateLabels).map(([state, label]) => h('span', null, h('i', { class: 'is-' + state, 'aria-hidden': 'true' }), label))),
        selectedDay ? dayDetails(selectedDay) : null);
      const group = data.group_id ? { id: data.group_id } : null;
      const tasks = list(data.today_tasks);
      const next = tasks.find(task => !task.done);
      const start = h('button', { type: 'button', class: 'btn', disabled: busy, 'data-program-start': '', onclick: () => mutate('start', currentScope()) }, 'Начать сегодня', icon('arrow'));
      focusTargets.set('start', start);
      const today = data.phase === 'finished' ? h('section', { class: 'card stack program-finished' }, h('h2', null, '30 дней позади'),
        h('p', { class: 'soft' }, 'Этот курс завершён. Его календарь не сбрасывается.'),
        h('a', { class: 'btn', href: '#/progress' }, 'Посмотреть прогресс', icon('arrow')))
        : h('section', { class: 'card program-today stack', 'data-program-today': data.today },
          h('div', { class: 'row' }, h('h2', null, 'Сегодня · ' + date(data.today)), h('span', { class: 'spacer' }), h('span', { class: 'chip' }, `${safe(data.completed_today)} из 5`)),
          h('ol', { class: 'program-task-list' }, tasks.map(task => {
            const content = [h('span', { class: `program-task-icon training-tone-${({ minute: 'blue', sprint: 'amber', compress: 'teal', explain: 'green', duel: 'violet' })[task.exercise] || 'blue'}`, 'aria-hidden': 'true' }, uiIcon(task.exercise)),
              h('span', { class: 'program-task-copy' }, h('strong', null, task.title), h('span', { class: 'small soft' }, task.done ? task.session_id ? 'Выполнено · открыть разбор' : 'Выполнено · результат сохранён' : data.phase === 'not_started' ? 'Доступно после старта программы' : 'Ещё не выполнено')),
              task.done ? h('span', { class: 'program-task-score num' }, score(task.score), h('small', null, '/10')) : icon('arrow')];
            const href = task.done ? task.session_id ? `#/s/${encodeURIComponent(task.session_id)}` : null : data.phase === 'active' && !busy ? programHref(task.exercise, group) : null;
            return h('li', { 'data-program-task': task.exercise, class: task.done ? 'is-done' : '' }, href ? h('a', { class: 'program-task-row', href }, content) : h('div', { class: 'program-task-row' }, content));
          })),
          h('div', { class: 'row program-primary' }, data.phase === 'not_started' ? start
            : next ? busy ? h('span', { class: 'btn program-link-pending', 'aria-disabled': 'true' }, 'Подождите…') : h('a', { class: 'btn', href: programHref(next.exercise, group), 'data-program-continue': '' }, 'Продолжить', icon('arrow'))
              : h('span', { class: 'chip good' }, 'Пять упражнений выполнены')));
      const rules = h('details', { class: 'card program-rules' }, h('summary', null, 'Как начисляются баллы'),
        h('ul', null, list(data.rules).map(rule => h('li', null, rule))),
        h('p', { class: 'small soft' }, 'Баллы курса показывают регулярность. Оценка тренера и недельный рейтинг группы считаются отдельно.'));
      root.replaceChildren(...keep([heading, pickerCard, status, overview, awards, h('div', { class: 'program-layout' }, today, calendarCard), rules]));
      if (focusKey) focusTargets.get(focusKey)?.focus?.();
    }
    render(ctx, root); await load();
    return { destroy() { disposed = true; } };
  }
  return { view };
})();
