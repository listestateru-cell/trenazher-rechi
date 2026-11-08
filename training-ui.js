'use strict';
/* Общие значки тренировок. Геометрия остаётся SVG, состояния и движение — в CSS. */
window.TrainerTrainingUI = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const shapes = {
    free: [['path', { d: 'M14 25v14M23 15v34M32 9v46M41 20v24M50 26v12' }]],
    coach: [['path', { d: 'M13 14h38v29H30L18 52v-9h-5Z' }], ['path', { d: 'M26 25a6 6 0 0 1 12 0c0 4-6 4-6 8M32 38v.3' }]],
    minute: [['circle', { cx: 32, cy: 34, r: 19 }], ['path', { d: 'M32 22v13l9 5M26 8h12M32 8v7M45 15l4-4' }]],
    compress: [['path', { d: 'M12 17h40M18 27h28M24 37h16M29 47h6' }]],
    sprint: [['path', { d: 'M36 8 18 34h13l-3 22 20-29H35l1-19Z' }]],
    explain: [['path', { d: 'M24 45h16M27 52h10M21 32a16 16 0 1 1 22 0c-3 2-4 5-4 7H25c0-2-1-5-4-7Z' }], ['path', { d: 'M27 22c1-3 3-4 6-4' }]],
    imagination: [['path', { d: 'M24 44h16M27 51h10M23 32a14 14 0 1 1 18 0c-3 2-4 5-4 7H27c0-2-1-5-4-7Z' }], ['path', { d: 'm12 7 1.5 4.5L18 13l-4.5 1.5L12 19l-1.5-4.5L6 13l4.5-1.5ZM50 37l1.5 4.5L56 43l-4.5 1.5L50 49l-1.5-4.5L44 43l4.5-1.5Z' }]],
    duel: [['path', { d: 'M32 12v41M23 53h18M14 21h36M14 21 6 38a9 9 0 0 0 16 0l-8-17ZM50 21l-8 17a9 9 0 0 0 16 0l-8-17Z' }]],
    conversation: [['path', { d: 'M10 13h33v23H25l-9 7v-7h-6Z' }], ['path', { d: 'M43 24h11v24h-6v7l-10-7H28v-7' }], ['path', { d: 'M19 24h15' }]],
    thought: [['circle', { cx: 15, cy: 19, r: 6 }], ['circle', { cx: 46, cy: 18, r: 6 }], ['circle', { cx: 32, cy: 46, r: 7 }], ['path', { d: 'M22 19h17M18 25l10 14M43 25l-8 14' }]],
    retell: [['path', { d: 'M32 18c-7-5-16-6-23-3v35c7-3 16-2 23 3m0-35c7-5 16-6 23-3v35c-7-3-16-2-23 3V18Z' }], ['path', { d: 'M16 25c3-1 6 0 9 1M16 34c3-1 6 0 9 1M39 26c3-1 6-2 9-1M39 35c3-1 6-2 9-1' }]],
    clarify: [['path', { d: 'M22 10H12v10M42 10h10v10M12 44v10h10M52 44v10H42' }], ['circle', { cx: 32, cy: 32, r: 11 }], ['path', { d: 'M32 25v8M32 38v.2' }]],
    synonyms: [['path', { d: 'M11 32h12c10 0 10-16 21-16h9M46 9l7 7-7 7M23 32c10 0 10 16 21 16h9M46 41l7 7-7 7' }]],
    lexicon: [['path', { d: 'M15 12h31a5 5 0 0 1 5 5v36H17a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5M12 44h39M24 35l8-16 8 16M27 29h10' }]],
    all: [['rect', { x: 12, y: 12, width: 15, height: 15, rx: 3 }], ['rect', { x: 37, y: 12, width: 15, height: 15, rx: 3 }], ['rect', { x: 12, y: 37, width: 15, height: 15, rx: 3 }], ['rect', { x: 37, y: 37, width: 15, height: 15, rx: 3 }]],
    program: [['rect', { x: 13, y: 14, width: 38, height: 39, rx: 7 }], ['path', { d: 'M23 8v12M41 8v12M13 27h38M24 39l6 6 12-12' }]],
    progress: [['path', { d: 'M12 12v40h42M20 39l11-12 10 6 13-18M43 15h11v11' }]],
    assessment: [['circle', { cx: 32, cy: 32, r: 21 }], ['circle', { cx: 32, cy: 32, r: 11 }], ['circle', { cx: 32, cy: 32, r: 2 }], ['path', { d: 'M32 6v7M32 51v7M6 32h7M51 32h7' }]],
    install: [['path', { d: 'M32 10v29M23 30l9 9 9-9M15 36v16h34V36' }]],
  };
  const tones = { free: 'blue', coach: 'coral', minute: 'blue', compress: 'teal', sprint: 'amber', explain: 'green', imagination: 'indigo', duel: 'violet', conversation: 'rose', thought: 'indigo', retell: 'teal', clarify: 'amber', synonyms: 'coral', lexicon: 'violet', all: 'slate', program: 'blue' };
  function svg(tag, attributes, ...children) {
    const element = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes || {})) element.setAttribute(name, String(value));
    element.append(...children);
    return element;
  }
  function icon(name, className = '') {
    return svg('svg', { viewBox: '0 0 64 64', class: `training-icon ${className}`.trim(), 'aria-hidden': 'true', focusable: 'false' },
      ...(shapes[name] || shapes.all).map(([tag, attributes]) => svg(tag, attributes)));
  }
  function tile({ title, href, icon: name = 'all', tone, description = '', badge = null }) {
    const paint = tones[name] || 'blue';
    return h('a', { class: `training-tile training-tone-${tone || paint}`, href,
      'aria-label': description ? `${title}. ${description}` : title, title: description || null },
      h('span', { class: 'training-tile-art' }, icon(name),
        badge == null ? null : h('span', { class: 'training-tile-badge', 'aria-hidden': 'true' }, badge)),
      h('span', { class: 'training-tile-label' }, title));
  }
  function grid(items, label) {
    return h('div', { class: 'training-app-grid', role: 'group', 'aria-label': label }, items);
  }
  function shelf({ id, title, items = [], label = title }) {
    const entries = Array.isArray(items) ? items : [];
    const trackId = `home-shelf-${id}-track`, titleId = `home-shelf-${id}-title`;
    const counter = h('span', { class: 'home-shelf-counter', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const previous = h('button', { type: 'button', class: 'home-shelf-arrow', 'aria-label': `Предыдущая карточка: ${title}`, 'aria-controls': trackId }, window.icon('back'));
    const next = h('button', { type: 'button', class: 'home-shelf-arrow', 'aria-label': `Следующая карточка: ${title}`, 'aria-controls': trackId }, window.icon('arrow'));
    const cards = entries.map((item, index) => h('a', {
      class: `home-shelf-card training-tone-${item.tone || tones[item.icon] || 'blue'}`,
      href: item.href, draggable: 'false',
      'aria-label': [item.title, item.description, item.meta, item.badge == null ? '' : `Прошлая оценка ${item.badge} из 10`]
        .filter(Boolean).map(part => String(part).trim().replace(/\.+$/, '')).join('. '),
      'data-active': index === 0 ? 'true' : 'false',
    },
    h('span', { class: 'home-shelf-cover', 'aria-hidden': 'true' },
      h('span', { class: 'home-shelf-kicker' }, item.kicker || String(index + 1).padStart(2, '0')),
      h('span', { class: 'home-shelf-icon' }, icon(item.icon || 'all'))),
    h('span', { class: 'home-shelf-title' }, item.title),
    item.description ? h('span', { class: 'home-shelf-description' }, item.description) : null,
    h('span', { class: 'home-shelf-meta' }, h('span', null, item.meta || 'Открыть задание'),
      item.badge == null ? null : h('span', { class: 'home-shelf-score' }, 'Оценка ', item.badge))));
    const track = h('div', { id: trackId, class: 'home-shelf-track', role: 'group', 'aria-label': label,
      'aria-roledescription': 'Карусель', 'data-layout': 'fallback' }, cards);
    const currentTitle = h('h3', { class: 'home-shelf-current-title' });
    const currentDescription = h('p', { class: 'home-shelf-current-description' });
    const currentMeta = h('div', { class: 'home-shelf-current-meta' });
    const caption = h('div', { class: 'home-shelf-caption' }, currentTitle, currentDescription, currentMeta);
    const section = h('section', { class: 'training-home-section home-shelf', 'aria-labelledby': titleId, 'data-home-shelf': id },
      h('div', { class: 'glass-home-section-heading home-shelf-heading' }, h('h2', { id: titleId }, title),
        h('div', { class: 'home-shelf-controls', 'aria-label': `Перелистывание: ${title}` }, counter, previous, next)), track, caption);
    let activeCaption = -1, captionAnimation = null;
    function changed(index) {
      if (index === activeCaption) return;
      const animate = activeCaption >= 0;
      activeCaption = index;
      const item = entries[index];
      counter.textContent = item ? `${index + 1} / ${entries.length}` : '0 / 0';
      currentTitle.textContent = item && item.title || '';
      currentDescription.textContent = item && item.description || '';
      currentMeta.replaceChildren(...(item ? [
        h('span', null, item.meta || 'Открыть задание'),
        item.badge == null ? null : h('span', { class: 'home-shelf-score' }, 'Последняя оценка ', item.badge),
      ].filter(Boolean) : []));
      if (captionAnimation) captionAnimation.cancel();
      if (animate && typeof currentTitle.animate === 'function'
        && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        captionAnimation = currentTitle.animate([{ opacity: .25, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
      }
    }
    changed(0);
    let controller = null;
    if (window.TrainerArcCarousel && typeof TrainerArcCarousel.mount === 'function') {
      track.setAttribute('data-layout', 'arc');
      controller = TrainerArcCarousel.mount({ id, track, cards, previous, next, onChange: changed });
    } else {
      previous.hidden = next.hidden = true;
      caption.hidden = true;
    }
    section.destroy = () => { if (controller) controller.destroy(); if (captionAnimation) captionAnimation.cancel(); };
    return section;
  }
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const scoredValue = value => Number.isFinite(value) && value >= 0 && value <= 10;
  function progressSessions(sessions) {
    const seen = new Set();
    return (Array.isArray(sessions) ? sessions : []).filter(session => {
      if (!session || session.demonstration === true || typeof session.exercise !== 'string' || !session.exercise) return false;
      if (session.assessment || /^assessment(?:_|$)/.test(session.exercise)) return false;
      const score = session.summary && session.summary.overall, analysis = session.analysis || {};
      const count = Array.isArray(session.plan) ? session.plan.length : session.plan;
      const takes = session.takes, indexes = analysis.takes;
      const revision = session.transcript_revision == null ? 0 : session.transcript_revision;
      const sourceRevision = analysis.source_revision == null ? 0 : analysis.source_revision;
      if (!scoredValue(score) || analysis.status !== 'done' || analysis.transcript_stale
        || revision !== sourceRevision || !Number.isInteger(count) || count < 1
        || !Array.isArray(takes) || takes.length !== count || takes.some(take => !take || take.status !== 'done')
        || !Array.isArray(indexes) || indexes.length !== count || new Set(indexes).size !== count
        || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= count)
        || !Number.isFinite(Date.parse(session.created))) return false;
      if (session.conversation && session.conversation.phase !== 'finished') return false;
      if (session.id && seen.has(session.id)) return false;
      if (session.id) seen.add(session.id);
      return true;
    }).slice().sort((a, b) => Date.parse(a.created) - Date.parse(b.created) || String(a.id || '').localeCompare(String(b.id || '')));
  }
  function progressPeriods(sessions) {
    const eligible = progressSessions(sessions);
    const recent = eligible.slice(-5), previous = eligible.length >= 10 ? eligible.slice(-10, -5) : [];
    const exercises = [...new Set(recent.map(session => session.exercise))].filter(exercise => previous.some(session => session.exercise === exercise)).sort();
    return { eligible, recent, previous, exercises };
  }
  function scoreTrend(sessions) {
    const { eligible, recent, previous, exercises } = progressPeriods(sessions);
    const result = { value: mean(recent.map(session => session.summary.overall)), previous: undefined, delta: null,
      comparedExercises: [], recentCount: recent.length, previousCount: previous.length, eligibleCount: eligible.length, comparisonReady: false,
      detail: !eligible.length ? 'Оценка появится после полного разбора упражнения.'
        : `Средняя оценка последних разборов (${recent.length} из пяти). Для сравнения нужны десять полных разборов и одинаковые виды упражнений в обеих сериях.` };
    if (eligible.length < 10) return result;
    if (!exercises.length) {
      result.detail = 'Средняя за последние пять тренировок. В предыдущей серии были другие упражнения, поэтому изменение уровня пока не сравниваем.';
      return result;
    }
    const comparableMean = period => mean(exercises.map(exercise => mean(period.filter(session => session.exercise === exercise).map(session => session.summary.overall))));
    result.value = comparableMean(recent); result.previous = comparableMean(previous); result.delta = result.value - result.previous;
    result.comparedExercises = exercises; result.comparisonReady = true;
    result.detail = 'Сравниваем две отдельные серии по пять тренировок. Учитываем только одинаковые виды упражнений в обеих сериях; у каждого вида одинаковый вес.';
    return result;
  }
  function criteriaTrend(sessions, keys) {
    const { eligible, recent, previous, exercises } = progressPeriods(sessions);
    const score = (session, key) => (session.summary.scores || {})[key];
    const values = (period, key, exercise) => period.filter(session => exercise == null || session.exercise === exercise)
      .map(session => score(session, key)).filter(scoredValue);
    const rows = (Array.isArray(keys) ? keys : []).map(key => {
      const shared = exercises.filter(exercise => values(recent, key, exercise).length && values(previous, key, exercise).length);
      const compared = shared.length > 0;
      const value = compared ? mean(shared.map(exercise => mean(values(recent, key, exercise)))) : mean(values(recent, key));
      const before = compared ? mean(shared.map(exercise => mean(values(previous, key, exercise)))) : null;
      let note = null;
      if (value == null) note = 'В последней серии тренер не оценивал этот критерий.';
      else if (eligible.length >= 10 && !compared) note = 'Для этого критерия пока нет оценок одинаковых упражнений в обеих сериях.';
      else if (compared && shared.length < exercises.length) note = 'Сравниваем только виды упражнений, где этот критерий оценён в обеих сериях.';
      return { key, value, previous: before, comparisonReady: compared, comparedExercises: shared, note };
    });
    return { rows, eligibleCount: eligible.length, recentCount: recent.length, previousCount: previous.length,
      comparisonReady: rows.some(row => row.comparisonReady),
      detail: !eligible.length ? 'Оценки появятся после полного разбора упражнения.'
        : eligible.length < 10 ? `Показаны оценки последних разборов (${recent.length} из пяти). Для сравнения нужны десять полных разборов.`
          : !exercises.length ? 'В двух последних сериях по пять тренировок были разные упражнения. Показываем последние оценки без сравнения.'
            : !rows.some(row => row.comparisonReady) ? 'Пока ни по одному критерию нет оценок одинаковых упражнений в обеих сериях. Показываем последние оценки без сравнения.'
              : 'Сравниваем две отдельные серии по пять тренировок. В каждом критерии учитываем одинаковые виды упражнений с оценками в обеих сериях; у каждого вида одинаковый вес. Отсутствующие оценки не считаем нулями.' };
  }
  function programSessions(sessions, state, date) {
    const scope = state.program_scope || (state.program && state.program.scope)
      || (state.competition && state.competition.id ? 'group:' + state.competition.id : 'personal');
    if (scope !== 'personal' && !/^group:.+/.test(scope)) return [];
    const group = scope === 'personal' ? null : scope.slice(6);
    return progressSessions(sessions).filter(session => session.program_day === date && !session.group_duel
      && (!session.program_scope || session.program_scope === scope)
      && (group ? session.group_id === group : !session.group_id));
  }
  const number = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
  function progressGauge({ value = null, previous = null, title = 'Уровень речи', detail = '', max = 10 } = {}) {
    const hasValue = Number.isFinite(value), hasPrevious = Number.isFinite(previous);
    const ceiling = Number.isFinite(max) && max > 0 ? max : 10;
    const ratio = hasValue ? Math.max(0, Math.min(1, value / ceiling)) : 0;
    const angle = Math.PI * (1 - ratio), point = [120 + Math.cos(angle) * 76, 116 - Math.sin(angle) * 76];
    const delta = hasValue && hasPrevious ? value - previous : null;
    const direction = delta == null ? 'unknown' : delta > .049 ? 'up' : delta < -.049 ? 'down' : 'steady';
    const trend = direction === 'unknown' ? 'Для сравнения нужны две серии тренировок'
      : direction === 'steady' ? 'Пока на том же уровне'
        : `${direction === 'up' ? 'Выше' : 'Ниже'} на ${number(Math.abs(delta))} по сравнению с предыдущим периодом`;
    const label = hasValue ? `${title}: ${number(value)} из ${number(ceiling)}. ${trend}.` : `${title}: пока нет оценки.`;
    const gauge = svg('svg', { viewBox: '0 0 240 146', class: 'training-gauge-dial', role: 'img', 'aria-label': label },
      svg('path', { d: 'M24 116a96 96 0 0 1 192 0', class: 'training-gauge-track', pathLength: 100 }),
      ...(hasValue ? [svg('path', { d: 'M24 116a96 96 0 0 1 192 0', class: 'training-gauge-fill', pathLength: 100, 'stroke-dasharray': `${ratio * 100} 100` }),
        svg('path', { d: `M120 116  ${point[0].toFixed(2)} ${point[1].toFixed(2)}`, class: 'training-gauge-needle' }),
        svg('circle', { cx: 120, cy: 116, r: 7, class: 'training-gauge-pivot' })] : []),
      ...[[24, 141, '0'], [120, 13, String(ceiling / 2)], [216, 141, String(ceiling)]].map(([x, y, text]) => {
        const node = svg('text', { x, y, 'text-anchor': 'middle', class: 'training-gauge-tick' }); node.textContent = text; return node;
      }));
    return h('section', { class: `card training-gauge training-gauge-${direction}` },
      h('div', { class: 'training-gauge-copy' }, h('h2', null, title),
        h('p', { class: 'training-gauge-value', 'aria-hidden': 'true' }, hasValue ? number(value) : '—', h('small', null, ` / ${ceiling}`)),
        h('p', { class: 'training-gauge-trend' }, h('span', { 'aria-hidden': 'true' }, direction === 'up' ? '↗ ' : direction === 'down' ? '↘ ' : direction === 'steady' ? '→ ' : ''), hasValue ? trend : 'Появится после первого разбора'),
        detail ? h('p', { class: 'small soft' }, detail) : null), gauge);
  }

  /* Главная использует те же серверные результаты и адреса, что и программа.
     Визуальная карточка не создаёт попытку и не пересчитывает баллы курса. */
  async function homeView(ctx) {
    const [state, sessions] = await Promise.all([api('/api/state'), api('/api/sessions')]);
    if (!ctx.alive()) return null;
    app.state = state;
    if (state.personalization) {
      const personalizedCatalog = await api('/api/catalog');
      if (!ctx.alive()) return null;
      app.catalog = personalizedCatalog;
    }
    if (window.TrainerProfiles) TrainerProfiles.refreshHeader(state);
    const ps = programStatus(sessions, state), course = state.program || {};
    const completed = ps.doneCount, total = ps.steps.length;
    const finished = course.phase === 'finished';
    const nextExercise = ps.next && catalog().exercises[ps.next.exercise];
    const nextTask = ps.next && (course.today_tasks || []).find(task => task.exercise === ps.next.exercise);
    const nextTitle = nextTask && nextTask.title || nextExercise && nextExercise.title || 'Следующее упражнение';
    const nextIndex = ps.next ? ps.steps.findIndex(step => step.exercise === ps.next.exercise) + 1 : null;
    const scopeTitle = state.competition && state.competition.name || course.title || 'Для себя';
    const dayLabel = finished ? '30 дней пройдены' : ps.start && ps.dayN ? `День ${ps.dayN} из 30` : 'Курс на 30 дней';
    const todayTitle = finished ? 'Курс завершён' : ps.next ? nextTitle : 'На сегодня всё';
    const scopeDate = course.today && /^\d{4}-\d{2}-\d{2}$/.test(course.today) ? new Date(course.today + 'T12:00:00') : new Date();
    const dateLabel = scopeDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const ctaLabel = ps.next && !finished ? ps.start ? 'Продолжить' : 'Начать тренировку' : 'Посмотреть прогресс';
    const ctaHref = ps.next && !finished ? programHref(ps.next.exercise, state.competition) : '#/progress';
    const streakValue = Number.isFinite(course.streak) ? course.streak : null;
    const pointsValue = Number.isFinite(course.points) ? course.points : null;
    const dayCaption = finished ? 'Все результаты и календарь сохранены.' : completed === total
      ? 'Все упражнения выполнены. Завтра продолжим.' : `${completed} из ${total} упражнений выполнено`;
    const today = h('section', { class: 'card today-card glass-home-today', 'aria-labelledby': 'home-today-title', 'data-home-today': '' },
      h('div', { class: 'glass-home-today-top' }, h('span', { class: 'glass-home-eyebrow' }, 'Программа дня'), h('span', { class: 'chip' }, dayLabel)),
      h('div', { class: 'glass-home-next' },
        h('span', { class: `glass-home-next-icon training-tone-${tones[ps.next && ps.next.exercise] || 'blue'}`, 'aria-hidden': 'true' }, icon(ps.next && !finished ? ps.next.exercise : 'program')),
        h('div', null, h('p', { class: 'glass-home-next-label' }, finished ? 'Хорошая работа' : ps.next ? `Упражнение ${nextIndex} из ${total}` : 'День закрыт'),
          h('h2', { id: 'home-today-title' }, todayTitle))),
      h('p', { class: 'glass-home-day-caption' }, dayCaption),
      h('div', { class: 'steps glass-home-steps', role: 'img', 'aria-label': `Выполнено ${completed} из ${total} упражнений` }, ps.steps.map(step =>
        h('span', { class: step.done ? 'done' : '', title: `${catalog().exercises[step.exercise]?.title || step.exercise}: ${step.done ? 'выполнено' : 'впереди'}`, 'aria-hidden': 'true' }))),
      h('a', { class: 'btn glass-home-primary', href: ctaHref, 'data-home-continue': '' }, ctaLabel, window.icon('arrow')),
      h('div', { class: 'glass-home-today-bottom' },
        h('p', { class: 'glass-home-course-meta small' }, streakValue == null ? 'Пять коротких упражнений в день' : `Полных дней подряд: ${streakValue}`,
          pointsValue == null ? null : h('span', null, ` · ${pointsValue} баллов`)),
        h('a', { class: 'glass-home-program-link', href: '#/program' }, 'Вся программа', window.icon('arrow'))));
    const lastByEx = {};
    for (const session of doneSessions(sessions).slice().sort((a, b) => Date.parse(b.created) - Date.parse(a.created))) {
      if (!isDemoSession(session) && !lastByEx[session.exercise]) lastByEx[session.exercise] = session;
    }
    const trainingDescriptions = {
      minute: 'Раскройте случайную тему без подготовки.', compress: 'Сохраните главное, сокращая свой ответ.',
      sprint: 'От ассоциаций к истории со всеми словами.', explain: 'Объясните одну тему разным слушателям.',
      duel: 'Посмотрите на вопрос с двух сторон.', coach: 'Ответьте на новый вопрос тренера.',
      free: 'Запишите выступление или свободный рассказ.',
    };
    const trainingItems = catalog().order.map(id => {
      const exercise = catalog().exercises[id], last = lastByEx[id];
      return { title: id === 'duel' ? 'Поединок' : exercise.title, href: `#/ex/${id}`, icon: id,
        description: trainingDescriptions[id] || exercise.hint, kicker: exercise.develops, meta: durLabel(exercise),
        badge: last && Number.isFinite(last.summary.overall) ? f1(last.summary.overall) : null };
    });
    const conversationCard = window.TrainerConversations ? await TrainerConversations.homeCard() : null;
    if (!ctx.alive()) return null;
    if (conversationCard) trainingItems.push({ title: 'Сложный разговор', href: '#/conversation', icon: 'conversation',
      description: 'Потренируйте ответ в сложной ситуации.', kicker: 'Диалог', meta: 'Голосом или текстом' });
    const learningDescriptions = {
      thought: 'Найдите потерю смысла и соберите понятный рассказ.', retell: 'Прочитайте отрывок и перескажите своими словами.',
      clarify: 'Замените расплывчатые слова точной мыслью.', synonyms: 'Выберите подходящие слова и оттенки смысла.',
      lexicon: 'Попробуйте новое слово в своей речи.',
    };
    const lessonItems = window.TrainerLessons ? TrainerLessons.kinds.map(kind => ({
      title: kind.id === 'thought' ? 'Собери мысль' : kind.title, href: `#/lessons/${kind.id}`, icon: kind.id,
      description: learningDescriptions[kind.id] || kind.description, kicker: 'Мысль и слово', meta: 'Голосом или текстом' })) : [];
    const learningItems = LEARNING_KINDS.map(kind => ({ title: kind.id === 'clarify' ? 'Уточни мысль' : kind.title,
      href: `#/learn/${kind.id}`, icon: kind.id, description: learningDescriptions[kind.id] || kind.description,
      kicker: 'Мысль и слово', meta: 'Голосом или текстом' }));
    learningItems.push({ title: 'Все задания', href: '#/learn', icon: 'all', description: 'Полный набор заданий на мысль, слова и пересказ.', meta: 'Открыть каталог' });
    let imaginationData = null;
    if (window.TrainerImagination) {
      try { imaginationData = await api('/api/imagination'); }
      catch (_) { imaginationData = { kinds: [] }; }
      if (!ctx.alive()) return null;
    }
    // Полки главной — книжный шкаф с обложками (bookshelf.js); без него прежние карусели.
    const books = !!(window.TrainerBookshelf && window.TrainerBookCovers);
    const shelfOf = options => books ? TrainerBookshelf.mount(options) : shelf(options);
    const trainingShelf = shelfOf({ id: 'training', title: 'Тренировки', items: trainingItems, label: 'Упражнения для речи' });
    const learningShelf = shelfOf({ id: 'learning', title: 'Мысль и слово', items: [...lessonItems, ...learningItems], label: 'Задания на мысль и слово' });
    const imaginationSection = window.TrainerImagination ? TrainerImagination.homeSection(imaginationData) : null;
    const trend = scoreTrend(sessions);
    const progressNote = !Number.isFinite(trend.value) ? 'После первого полного разбора'
      : trend.comparisonReady ? Math.abs(trend.delta) < .05 ? 'На уровне прошлой серии'
        : `На ${number(Math.abs(trend.delta))} ${trend.delta > 0 ? 'выше' : 'ниже'} прошлой серии`
        : `По последним разборам: ${trend.recentCount} из 5`;
    const progressCard = h('a', { class: 'card glass-home-progress home-bento-card home-bento-progress', href: '#/progress', 'aria-labelledby': 'home-progress-title', 'aria-describedby': 'home-progress-label home-progress-value home-progress-summary' },
      h('div', { class: 'home-bento-card-top' }, h('span', { class: 'home-bento-icon' }, icon('progress')), window.icon('arrow', 'home-bento-arrow')),
      h('h2', { id: 'home-progress-title' }, 'Прогресс'),
      h('div', { class: 'home-bento-score' },
        h('span', { class: 'home-bento-label', id: 'home-progress-label' }, 'Оценка тренера'),
        h('p', { class: 'glass-home-score', id: 'home-progress-value' }, Number.isFinite(trend.value) ? number(trend.value) : '—', h('span', null, ' / 10'))),
      h('p', { class: 'home-bento-note', id: 'home-progress-summary' }, progressNote),
      h('p', { class: 'home-bento-card-action' }, 'Подробнее'));
    const assessment = state.assessment || {};
    const hasBaseline = (Array.isArray(assessment.history) ? assessment.history : []).some(item => item.confirmed || item.confirmed_at || item.phase === 'confirmed');
    const startCard = h('a', { class: 'card home-bento-card home-bento-start', href: '#/assessment', 'aria-labelledby': 'home-start-title', 'aria-describedby': 'home-start-summary' },
      h('div', { class: 'home-bento-card-top' }, h('span', { class: 'home-bento-icon' }, icon('assessment')), window.icon('arrow', 'home-bento-arrow')),
      h('h2', { id: 'home-start-title' }, 'Точка старта'),
      h('p', { class: 'home-bento-description', id: 'home-start-summary' }, hasBaseline ? 'Сравните чтение с первым срезом.' : 'Короткий опрос и минута чтения вслух.'),
      h('p', { class: 'home-bento-card-action' }, hasBaseline ? 'Мои срезы' : 'Пройти срез'));
    const root = h('div', { class: 'glass-home', 'data-glass-home': '' },
      h('header', { class: 'glass-home-heading' },
        h('div', { class: 'glass-home-meta' }, h('p', { class: 'glass-home-date' }, dateLabel),
          h('a', { href: '#/program', class: 'glass-home-scope', 'aria-label': `Программа: ${scopeTitle}. Выбрать программу.` }, scopeTitle, window.icon('arrow'))),
        h('h1', null, 'Пора потренироваться')),
      h('div', { class: 'home-bento', 'data-home-bento': '' }, today, progressCard, startCard),
      window.TrainerProfiles ? TrainerProfiles.invitation(state) : null,
      books ? h('div', { class: 'library', 'data-library': '' }, trainingShelf, learningShelf, imaginationSection)
        : [trainingShelf, learningShelf, imaginationSection],
      h('aside', { class: 'glass-home-install' },
        h('button', { type: 'button', class: 'btn ghost trainer-mobile-install-launch', 'data-trainer-install': '' }, window.icon('upload'), 'Добавить на экран телефона')));
    render(ctx, root);
    return { destroy() {
      trainingShelf.destroy(); learningShelf.destroy();
      if (imaginationSection && typeof imaginationSection.destroy === 'function') imaginationSection.destroy();
    } };
  }
  return { icon, tile, grid, shelf, progressSessions, scoreTrend, criteriaTrend, programSessions, progressGauge, homeView };
})();
