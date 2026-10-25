'use strict';
/* Групповые занятия: только общие результаты. Записи и разборы здесь не загружаются. */
window.TrainerGroups = (() => {
  const enc = (value) => encodeURIComponent(String(value));
  const list = (value) => Array.isArray(value) ? value : [];
  const groupRoute = (id, week) => `#/groups/${enc(id)}${week ? `?week=${enc(week)}` : ''}`;
  const groupPath = (id) => `/api/groups/${enc(id)}`;
  const count = (value) => Number.isFinite(value) ? value.toLocaleString('ru-RU') : '0';
  const score = (value) => value == null || !Number.isFinite(value) ? 'Пока нет' : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const rating = (value) => value == null || !Number.isFinite(value) ? 'Пока нет' : value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const nameOf = (user) => user && (user.name || (user.username ? `@${user.username}` : 'Участник')) || 'Участник';
  const avatar = (user, size = '') => window.TrainerProfiles ? TrainerProfiles.avatar(user, size) : h('span', { class: 'groups-person-mark', 'aria-hidden': 'true' }, nameOf(user).slice(0, 1).toUpperCase());
  const shortDate = (day, weekday = false) => {
    const parsed = new Date(`${day}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(weekday ? { weekday: 'long' } : {}) });
  };
  const joinNotice = 'Участники группы увидят ваше имя, число выполненных заданий, дни занятий, место в рейтинге, оценки тренера и общие результаты поединков. Аудио, расшифровки и подробные разборы доступны вам и владельцу тренажёра.';

  function sectionHeading(title, aside) {
    return h('div', { class: 'groups-section-heading' }, h('h2', null, title), aside);
  }
  function stat(label, value, suffix) {
    return h('div', { class: 'groups-stat' }, h('div', { class: 'groups-stat-value num' }, value, suffix ? h('small', null, suffix) : null), h('div', { class: 'groups-stat-label' }, label));
  }
  function crumb(label, href) {
    return h('a', { class: 'groups-back', href: href || '#/groups' }, icon('back'), label);
  }
  function errorNotice(error) {
    return h('div', { class: 'groups-error', role: 'alert' }, error.message || 'Не удалось загрузить группу. Нажмите «Обновить» и попробуйте ещё раз.');
  }
  function field(label, control, hint) {
    return h('div', { class: 'groups-field' }, h('label', { for: control.id }, label), control, hint ? h('p', { class: 'small soft', id: `${control.id}-hint` }, hint) : null);
  }
  function copyLink(value, label, hint) {
    if (!value) return h('p', { class: 'soft small' }, 'Ссылка пока недоступна. Нажмите «Обновить» позже.');
    const input = h('input', { class: 'groups-input groups-link-input', type: 'text', readonly: true, value, 'aria-label': label, spellcheck: 'false', autocapitalize: 'off' });
    const status = h('p', { class: 'small soft', role: 'status' });
    const button = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard');
        await navigator.clipboard.writeText(value);
        status.textContent = 'Ссылка скопирована.';
        toast('Ссылка скопирована');
      } catch (error) {
        input.focus(); input.select();
        status.textContent = 'Выделили ссылку. Скопируйте её через меню телефона или клавишами.';
      }
    } }, icon('copy'), 'Копировать');
    return h('div', { class: 'groups-copy' }, h('div', { class: 'groups-copy-controls' }, input, button), hint ? h('p', { class: 'small soft' }, hint) : null, status);
  }

  async function view(ctx, parts, params) {
    const isJoin = parts[1] === 'join';
    const code = isJoin && parts[2] ? decodeURIComponent(parts[2]) : null;
    const gid = !isJoin && parts[1] ? decodeURIComponent(parts[1]) : null;
    const weekQuery = params && params.get ? params.get('week') : new URLSearchParams((location.hash.split('?')[1] || '')).get('week');
    const root = h('section', { class: 'groups-view stack' });
    let destroyed = false, loading = false, pending = false, data = null, error = null;
    let createOpen = false, createName = '', createLeader = '', createError = null, leaders = null;
    let inviteLink = null, leaveArmed = false;
    let peopleQuery = '', people = null, peopleBusy = false, peopleError = null;
    let testOpen = false, testUsers = null, testBusy = false, testError = null;
    const testLinks = new Map();
    const alive = () => !destroyed && ctx.alive();
    const refresh = h('button', { class: 'btn ghost groups-refresh', type: 'button', onclick: () => load() }, icon('redo'), 'Обновить');
    render(ctx, root);

    function header(title, description, extra) {
      return h('header', { class: 'groups-heading' }, h('div', { class: 'groups-heading-copy' },
        h('p', { class: 'groups-eyebrow' }, 'Вместе тренировать речь'), h('h1', null, title), description ? h('p', { class: 'soft' }, description) : null),
      h('div', { class: 'groups-heading-actions' }, extra, refresh));
    }
    function loadingCard() {
      return h('div', { class: 'card groups-empty', role: 'status' }, loading ? 'Загружаю группы…' : 'Данные пока не загружены. Нажмите «Обновить».');
    }
    function draw() {
      if (!alive()) return;
      refresh.disabled = loading || pending;
      refresh.setAttribute('aria-busy', String(loading));
      refresh.replaceChildren(icon('redo'), loading ? 'Обновляю…' : 'Обновить');
      root.replaceChildren(...(isJoin ? joinPage() : gid ? detailPage() : indexPage()).flat(Infinity).filter((node) => node != null && node !== false));
    }
    async function load() {
      if (loading || pending || !alive()) return;
      loading = true; error = null; draw();
      try {
        if (isJoin) {
          if (!code) throw new Error('В приглашении не хватает кода. Попросите руководителя отправить ссылку ещё раз.');
          data = await api('/api/groups/resolve', { method: 'POST', body: { code } });
          const currentGroup = app.state && app.state.competition;
          if (!data.joined && (!currentGroup || currentGroup.id === data.id)) {
            const joined = await api(`${groupPath(data.id)}/join`, { method: 'POST', body: { invite: code } });
            await syncState(joined);
            if (alive()) location.hash = groupRoute(joined.id);
          } else if (data.joined && alive()) location.hash = groupRoute(data.id);
        } else data = await api(gid ? `${groupPath(gid)}${weekQuery ? `?week=${enc(weekQuery)}` : ''}` : '/api/groups');
      } catch (caught) { error = caught; }
      loading = false;
      if (alive()) draw();
    }
    async function syncState(group, left = false) {
      // Программа дня должна сразу учитывать вступление, без перезапуска приложения.
      if (alive() && app.state) {
        if (left) app.state.competition = null;
        else if (group && group.joined) {
          const today = list(group.daily).find((day) => day.today);
          if (today) app.state.competition = { id: group.id, name: group.name, week: group.week, today: today.date, tasks: today.tasks };
        }
      }
      try {
        const state = await api('/api/state');
        if (alive() && state && typeof state.is_owner === 'boolean') app.state = state;
      } catch (caught) { /* Общие задания уже взяты из подтверждённого ответа группы. */ }
    }

    function indexPage() {
      const groups = list(data && data.groups), referral = data && data.referral || {};
      return [header('Группы и друзья', 'Приглашайте знакомых и проходите общую программу. В каждой группе начинается новое соревнование по понедельникам.',
        h('button', { class: 'btn', type: 'button', disabled: pending, onclick: () => { createOpen = !createOpen; draw(); if (createOpen) loadLeaders(); } }, createOpen ? 'Закрыть форму' : 'Создать группу')),
      error ? errorNotice(error) : null,
      !data ? loadingCard() : [
        data.pending_invite ? h('div', { class: 'card groups-pending-invite' }, h('div', null, h('h2', null, data.pending_invite.requires_switch ? 'Приглашение в другую группу' : 'Вас пригласили в группу'), h('p', { class: 'soft' }, data.pending_invite.name || 'Совместная тренировка')),
          h('a', { class: 'btn ghost', href: `#/groups/join/${enc(data.pending_invite.code || '')}` }, 'Открыть группу', icon('arrow'))) : null,
        createOpen ? createForm() : null,
        sectionHeading(app.state && app.state.is_owner ? 'Группы тренажёра' : 'Мои группы', h('span', { class: 'small soft' }, count(groups.length))),
        groups.length ? h('div', { class: 'groups-card-grid' }, groups.map((group) => groupCard(group)))
          : h('div', { class: 'card groups-empty' }, h('h2', null, 'Пока вы занимаетесь самостоятельно'), h('p', { class: 'soft' }, 'Создайте группу или откройте приглашение от знакомого. В группе у всех одинаковые задания дня и общий рейтинг.'),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { createOpen = true; draw(); loadLeaders(); } }, 'Создать первую группу')),
        app.state && app.state.is_owner ? testPanel() : null,
        h('article', { class: 'card groups-friends' }, sectionHeading('Мои друзья', h('span', { class: 'small soft' }, count(list(referral.friends).length))),
          h('p', { class: 'soft' }, 'Отправьте свою ссылку. Приглашённый появится среди друзей. Если вы руководитель группы, после получения доступа он также вступит в неё автоматически.'),
          copyLink(referral.url, 'Ваша ссылка для приглашения в тренажёр', 'Новый участник сначала ждёт одобрения владельца. Зарегистрированному достаточно открыть приглашение. Эта ссылка не открывает ваш личный профиль.'),
          referral.invited_by ? h('p', { class: 'small soft' }, 'Вас пригласил(а): ', nameOf(referral.invited_by)) : null,
          list(referral.friends).length ? h('ul', { class: 'groups-friend-list' }, referral.friends.map((friend) => h('li', null,
            avatar(friend),
            h('span', { class: 'groups-person-name' }, nameOf(friend), friend.username ? h('small', { class: 'soft' }, ` @${friend.username}`) : null, friend.is_test ? h('small', { class: 'profile-test-label' }, 'Тест') : null),
            h('span', { class: 'small soft' }, friend.status === 'pending' ? 'Ожидает доступа' : ['blocked', 'closed'].includes(friend.status) ? 'Доступ закрыт' : 'В тренажёре'))))
            : h('p', { class: 'small soft' }, 'Здесь появятся люди, которые зарегистрируются по вашей ссылке.')),
      ]];
    }
    function testPanel() {
      return h('article', { class: 'card groups-tests' }, sectionHeading('Тестовые профили', h('button', { class: 'btn ghost', type: 'button', onclick: () => { testOpen = !testOpen; draw(); if (testOpen && !testUsers) loadTests(); } }, testOpen ? 'Свернуть' : 'Открыть')),
        h('p', { class: 'small soft' }, 'Доступны только вам. Это отдельные профили для проверки приложения; сообщения в Telegram им не отправляются.'),
        testOpen ? h('div', { class: 'stack' },
          testError ? errorNotice(testError) : null,
          testBusy ? h('p', { role: 'status' }, 'Загружаю тестовые профили…') : null,
          testUsers && testUsers.length ? h('ul', { class: 'groups-test-list' }, testUsers.map((user) => h('li', null,
            h('div', { class: 'profile-identity' }, avatar(user), h('div', null, h('strong', null, nameOf(user)), h('p', { class: 'small soft' }, `@${user.username}`, ' · тестовый профиль'))),
            testLinks.has(user.id) ? h('a', { class: 'btn ghost', href: testLinks.get(user.id), target: '_blank', rel: 'noopener noreferrer' }, 'Открыть профиль', icon('arrow'))
              : h('button', { class: 'btn ghost', type: 'button', disabled: testBusy, onclick: () => openTest(user) }, 'Получить ссылку входа')))) : null,
          h('button', { class: 'btn ghost', type: 'button', disabled: testBusy, onclick: createTests }, 'Создать три тестовых профиля'),
          h('p', { class: 'small soft' }, 'Для добавления в вашу группу найдите их по началу ника test_. Чтобы пройти упражнение за тестового участника, откройте его отдельный профиль.')) : null);
    }
    async function loadTests() {
      if (testBusy || !alive()) return;
      testBusy = true; testError = null; draw();
      try { const result = await api('/api/admin/test-users'); testUsers = list(result.users); }
      catch (caught) { testError = caught; }
      testBusy = false; draw();
    }
    async function createTests() {
      if (testBusy) return;
      testBusy = true; testError = null; draw();
      try { const result = await api('/api/admin/test-users', { method: 'POST', body: { count: 3 } }); testUsers = list(result.users); }
      catch (caught) { testError = caught; }
      testBusy = false; draw();
    }
    async function openTest(user) {
      if (testBusy) return;
      testBusy = true; testError = null; draw();
      try {
        const result = await api(`/api/admin/test-users/${enc(user.id)}/open`, { method: 'POST', body: {} });
        const link = new URL(result.url, location.href);
        if (link.protocol !== 'https:' && !(link.protocol === 'http:' && ['localhost','127.0.0.1'].includes(link.hostname))) throw new Error('Не удалось открыть ссылку тестового профиля.');
        testLinks.set(user.id, link.href);
      } catch (caught) { testError = caught; }
      testBusy = false; draw();
    }
    function groupCard(group) {
      return h('a', { class: 'card groups-group-card', href: groupRoute(group.id), 'data-group-id': group.id },
        h('div', { class: 'groups-card-top' }, h('h3', null, group.name), h('span', { class: `chip ${group.is_leader ? 'good' : ''}` }, group.is_leader ? 'Вы руководитель' : group.joined ? 'Вы участвуете' : 'Просмотр владельца')),
        h('p', { class: 'soft' }, 'Руководитель: ', nameOf(group.leader)),
        h('div', { class: 'groups-card-foot' }, h('span', { class: 'small soft' }, `${count(group.member_count)} ${plural(group.member_count || 0, 'участник', 'участника', 'участников')}`),
          group.joined && Number.isFinite(group.rating) ? h('span', { class: 'groups-points num' }, `${rating(group.rating)} / 100`) : null, icon('arrow')));
    }
    async function loadLeaders() {
      if (!app.state || !app.state.is_owner || leaders) return;
      try {
        const result = await api('/api/admin/users');
        leaders = list(result.users).filter((user) => ['owner', 'member'].includes(user.role));
        if (alive() && createOpen) draw();
      } catch (caught) { /* Создать свою группу можно и без списка владельца. */ }
    }
    function createForm() {
      const nameInput = h('input', { id: 'groups-create-name', class: 'groups-input', value: createName, type: 'text', required: true, maxlength: '80', placeholder: 'Например, Речевая практика', autocomplete: 'off', 'aria-describedby': 'groups-create-name-hint', oninput: (event) => { createName = event.target.value; } });
      const leaderSelect = app.state && app.state.is_owner && leaders && leaders.length ? h('select', { id: 'groups-create-leader', class: 'groups-input', value: createLeader, onchange: (event) => { createLeader = event.target.value; } },
        h('option', { value: '' }, 'Я буду руководителем'), leaders.filter((user) => user.role !== 'owner').map((user) => h('option', { value: user.id, selected: String(user.id) === createLeader }, nameOf(user)))) : null;
      return h('form', { class: 'card groups-create', onsubmit: async (event) => {
        event.preventDefault();
        if (pending) return;
        const name = createName.trim();
        if (!name) { createError = new Error('Напишите название группы.'); draw(); root.querySelector('#groups-create-name').focus(); return; }
        createError = null; pending = true; draw();
        try {
          const body = { name };
          if (createLeader && app.state && app.state.is_owner) body.leader_id = Number(createLeader);
          const result = await api('/api/groups', { method: 'POST', body });
          await syncState(result);
          if (alive()) { toast('Группа создана'); location.hash = groupRoute(result.id); }
        } catch (caught) { createError = caught; }
        pending = false; if (alive()) draw();
      } }, h('h2', null, 'Новая группа'),
      field('Название группы', nameInput, 'Его будут видеть все участники.'),
      leaderSelect ? field('Руководитель', leaderSelect, 'Руководитель тоже участвует в рейтинге на общих условиях.') : null,
      h('p', { class: 'small soft' }, 'После создания вы получите ссылку: она автоматически добавляет приглашённых в группу. Новый пользователь сначала ждёт одобрения владельца.'),
      createError ? errorNotice(createError) : null,
      h('div', { class: 'groups-form-actions' }, h('button', { class: 'btn', type: 'submit', disabled: pending }, pending ? 'Создаю…' : 'Создать группу'),
        h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: () => { createOpen = false; draw(); } }, 'Отмена')));
    }

    function detailPage() {
      if (!data) return [crumb('Все группы'), header('Группа', null), error ? errorNotice(error) : null, loadingCard()];
      const group = data, week = group.week || {}, daily = list(group.daily), today = daily.find((day) => day.today);
      const self = list(group.leaderboard).find((person) => person.is_self);
      const ownInvite = inviteLink || group.invite && group.invite.url;
      return [crumb('Все группы'), header(group.name, `Руководитель: ${nameOf(group.leader)}. Участвует в соревновании наравне со всеми.`),
        error ? errorNotice(error) : null,
        weekBar(group),
        !group.joined ? h('div', { class: 'card groups-consent' }, h('h2', null, 'Вы смотрите группу как владелец'), h('p', { class: 'soft' }, 'Чтобы выполнять общие задания и появиться в рейтинге, вступите в группу.'),
          h('p', { class: 'small soft' }, joinNotice), h('button', { class: 'btn', type: 'button', disabled: pending || !group.invite || !group.invite.code, onclick: () => joinGroup(group.id, group.invite.code) }, pending ? 'Вступаю…' : 'Вступить и участвовать')) : null,
        self ? h('article', { class: 'groups-self-result' }, sectionHeading('Ваш результат недели', h('span', { class: 'small soft' }, self.rank ? `Место: ${self.rank}` : 'Место пока не определено')),
          h('div', { class: 'groups-personal-summary' }, stat('Итоговый рейтинг', rating(self.rating), '/ 100'), stat('Оценка тренера', score(self.trainer_average == null ? self.average_score : self.trainer_average), '/ 10'),
            stat('Слова в поединках', score(self.vocabulary_grade), '/ 10'), stat('Регулярность', count(self.training_points), '/ 14')),
          h('p', { class: 'small soft' }, `Выполнено упражнений: ${count(self.completed)} из 35. Полных дней: ${count(self.completed_days)}.`, self.vocabulary_count == null ? '' : ` В словесных раундах в среднем зачтено ${score(self.vocabulary_count)} слов.`, self.provisional ? ' Рейтинг предварительный: пока есть не все виды результатов.' : ''),
          ratingBreakdown(self)) : null,
        week.current && today ? todayCard(group, today) : null,
        duelsCard(group),
        leaderboard(group),
        group.is_leader || app.state && app.state.is_owner ? peoplePanel() : null,
        !self ? ratingBreakdown(null) : null,
        weekDays(group, daily),
        h('details', { class: 'card groups-rules' }, h('summary', null, 'Как устроено соревнование'),
          h('ul', { class: 'groups-rule-list' }, (list(group.rules).length ? group.rules : [
            'Каждый день у всех одинаковые пять упражнений, темы и слова. Выбрать другую тему в зачёт группы нельзя.',
            'Рейтинг складывается из оценки тренера (до 60), словесных поединков (до 30) и регулярности (до 10).',
            'Пять выполненных заданий за день дают 2 балла регулярности. За неделю можно набрать 14. Неполный день дополнительных баллов не даёт.',
            'В словесном раунде за 60 секунд 20 зачтённых слов дают оценку 1, 23 слова — 2. Каждые следующие три слова добавляют единицу, до 10. Меньше 20 слов — 0.',
            'Место зависит от итогового рейтинга. При равных результатах участники делят место. Дополнительных требований для попадания в рейтинг нет.',
            'В понедельник начинается новая неделя с нуля. Результаты прошлых недель остаются в архиве.',
          ]).map((rule) => h('li', null, rule))), h('p', { class: 'small soft groups-privacy' }, joinNotice)),
        group.is_leader || app.state && app.state.is_owner ? h('article', { class: 'card groups-invite-card' }, sectionHeading('Пригласить в группу'),
          h('p', { class: 'soft' }, 'Отправьте ссылку друзьям: после входа они автоматически появятся в этой группе. Зарегистрированный участник использует свой профиль, новый сначала ждёт одобрения владельца.'),
          ownInvite ? copyLink(ownInvite, 'Ссылка для вступления в эту группу') : h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: makeInvite }, pending ? 'Готовлю ссылку…' : 'Получить приглашение')) : null,
        group.joined && !group.is_leader ? h('details', { class: 'groups-leave' }, h('summary', null, 'Участие в группе'), h('p', { class: 'small soft' }, 'Вы сможете снова вступить по приглашению. Ваши личные занятия останутся в истории.'),
          h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: leaveGroup }, pending ? 'Выхожу…' : leaveArmed ? 'Подтвердить выход' : 'Выйти из группы')) : null,
      ];
    }
    function peoplePanel() {
      const input = h('input', { id: 'groups-find-person', class: 'groups-input', type: 'search', value: peopleQuery,
        placeholder: '@nickname', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, minlength: 2, maxlength: 33,
        oninput: (event) => { peopleQuery = event.target.value; } });
      return h('article', { class: 'card groups-people stack' }, h('h2', null, 'Добавить по Telegram-нику'),
        h('p', { class: 'soft' }, 'Найдите человека, которому владелец уже открыл доступ к тренажёру. В группе будут видны имя, фото и общие результаты; личные записи остаются закрытыми.'),
        h('form', { class: 'groups-people-search', onsubmit: async (event) => { event.preventDefault(); await searchPeople(); } },
          field('Telegram-ник', input, 'Введите хотя бы две буквы ника. Можно без @.'),
          h('button', { class: 'btn ghost', type: 'submit', disabled: peopleBusy }, peopleBusy ? 'Ищу…' : 'Найти')),
        peopleError ? errorNotice(peopleError) : null,
        people ? people.length ? h('ul', { class: 'groups-test-list' }, people.map((person) => h('li', null,
          h('div', { class: 'profile-identity' }, avatar(person), h('div', null, h('strong', null, nameOf(person)),
            h('p', { class: 'small soft' }, `@${person.username}`, person.is_test ? ' · тестовый профиль' : ''))),
          person.already_joined ? h('span', { class: 'chip' }, 'Уже в группе') : person.in_other_group ? h('span', { class: 'small soft' }, 'Участвует в другой группе')
            : h('button', { class: 'btn ghost', type: 'button', disabled: peopleBusy || pending, onclick: () => addPerson(person) }, 'Добавить'))))
          : h('p', { class: 'small soft', role: 'status' }, 'Никого не нашли. Проверьте ник: человек должен сначала зарегистрироваться в боте и получить доступ.') : null);
    }
    async function searchPeople() {
      if (peopleBusy || pending) return;
      if (peopleQuery.trim().replace(/^@/, '').length < 2) { peopleError = new Error('Введите хотя бы две буквы Telegram-ника.'); draw(); return; }
      peopleBusy = true; peopleError = null; draw();
      try { const result = await api(`${groupPath(gid)}/people?q=${enc(peopleQuery.trim())}`); people = list(result.users); }
      catch (caught) { peopleError = caught; }
      peopleBusy = false; draw();
    }
    async function addPerson(person) {
      if (peopleBusy || pending) return;
      peopleBusy = true; peopleError = null; draw();
      try {
        await api(`${groupPath(gid)}/members`, { method: 'POST', body: { user_id: person.id } });
        person.already_joined = true;
        data = await api(groupPath(gid));
        if (alive()) toast(`${nameOf(person)} добавлен в группу`);
      } catch (caught) { peopleError = caught; }
      peopleBusy = false; draw();
    }
    function weekBar(group) {
      const week = group.week || {};
      return h('div', { class: 'card groups-week-bar' }, h('div', { class: 'groups-week-title' }, h('span', { class: `chip ${week.current ? 'good' : ''}` }, week.current ? 'Эта неделя' : 'Архив недели'),
        h('h2', null, week.label || `${shortDate(week.start)} — ${shortDate(week.end)}`),
        h('p', { class: 'small soft' }, `С понедельника по воскресенье · ${week.timezone || 'Asia/Yakutsk'}`)),
      h('nav', { class: 'groups-week-nav', 'aria-label': 'Выбор недели' },
        week.previous_start ? h('a', { class: 'btn ghost groups-week-arrow', href: groupRoute(group.id, week.previous_start), 'aria-label': 'Предыдущая неделя' }, icon('back')) : h('button', { class: 'btn ghost groups-week-arrow', disabled: true, type: 'button', 'aria-label': 'Предыдущей недели пока нет' }, icon('back')),
        !week.current ? h('a', { class: 'btn ghost', href: groupRoute(group.id) }, 'Текущая') : null,
        week.next_start ? h('a', { class: 'btn ghost groups-week-arrow', href: groupRoute(group.id, week.next_start), 'aria-label': 'Следующая неделя' }, icon('arrow')) : h('button', { class: 'btn ghost groups-week-arrow', disabled: true, type: 'button', 'aria-label': 'Следующая неделя ещё не началась' }, icon('arrow'))));
    }
    function ratingBreakdown(person) {
      const components = person && person.rating_components || {};
      return h('details', { class: 'card groups-rating-formula' }, h('summary', null, 'Из чего складывается рейтинг'),
        person ? h('div', { class: 'groups-component-list' },
          h('p', null, h('span', null, 'Тренер'), h('strong', { class: 'num' }, `${rating(components.trainer)} / 60`)),
          h('p', null, h('span', null, 'Слова в поединках'), h('strong', { class: 'num' }, `${rating(components.vocabulary)} / 30`)),
          h('p', null, h('span', null, 'Регулярность'), h('strong', { class: 'num' }, `${rating(components.training)} / 10`))) : null,
        h('p', { class: 'groups-formula-text' }, 'Итог = средняя оценка тренера × 6 + средняя оценка словесных раундов × 3 + баллы регулярности ÷ 14 × 10.'),
        h('p', { class: 'small soft' }, 'Пять полностью выполненных заданий за день дают 2 балла регулярности. Максимум — 14 за неделю. Повторные попытки не добавляют баллов.'),
        h('h3', null, 'Сколько слов нужно за 60 секунд'),
        h('p', { class: 'small soft' }, 'Эта шкала относится к словесному раунду поединка. Меньше 20 зачтённых слов дают 0. Начиная с 20, каждые следующие три слова добавляют единицу, до 10.'),
        h('div', { class: 'groups-word-thresholds', 'aria-label': 'Число слов и оценка словесного раунда' }, Array.from({ length: 10 }, (_, index) => h('div', null,
          h('span', { class: 'num' }, `${20 + index * 3}${index === 9 ? '+' : ''} слов`), h('strong', { class: 'num' }, `${index + 1} / 10`)))),
        h('p', { class: 'small soft' }, 'Для общего рейтинга берём среднюю оценку словесных раундов этой недели. Задания обычного словесного спринта оцениваются отдельно.'),
        h('p', { class: 'small soft' }, 'В рейтинг можно попасть с любым числом выполненных заданий. Если результатов ещё мало, показываем предварительный итог.'));
    }
    function duelsCard(group) {
      const week = group.week || {};
      const route = `#/groups/${enc(group.id)}/duels${week.current || !week.start ? '' : `?week=${enc(week.start)}`}`;
      return h('article', { class: 'card groups-duels-card' },
        h('div', { class: 'groups-duels-heading' }, icon('scales'), h('h2', null, 'Поединки недели')),
        h('p', { class: 'soft' }, 'В течение недели участники встречаются друг с другом. В воскресенье четверо лучших играют полуфиналы: первое место с четвёртым, второе с третьим. Затем финал и матч за третье место.'),
        h('p', { class: 'small soft' }, 'У соперников одинаковые условия. Словесный раунд длится 60 секунд и влияет на общий рейтинг. Другим участникам доступны общие результаты, записи и тексты остаются личными.'),
        h('a', { class: 'btn ghost', href: route }, week.current ? 'Открыть поединки' : 'Поединки этой недели', icon('arrow')));
    }
    function todayCard(group, day) {
      const tasks = list(day.tasks), done = tasks.filter((task) => task.done).length;
      return h('article', { class: 'card groups-today' }, sectionHeading('Общие задания на сегодня', h('span', { class: 'chip num' }, `${done} из ${tasks.length}`)),
        h('p', { class: 'soft' }, shortDate(day.date, true), '. Темы одинаковые для всех участников.'),
        taskList(group, day, true),
        done === tasks.length && tasks.length ? h('p', { class: 'groups-all-done' }, 'Все пять заданий выполнены: 2 балла за регулярность. Новые общие темы появятся завтра.') : h('p', { class: 'small soft' }, 'Завершите все пять заданий с разбором тренера, чтобы получить 2 балла за регулярность. За неполный день баллы регулярности не начисляются.'));
    }
    function taskList(group, day, currentDay) {
      return h('ol', { class: 'groups-task-list' }, list(day.tasks).map((task, index) => {
        const canStart = currentDay && group.joined && !task.done;
        const href = task.session_id ? `#/s/${enc(task.session_id)}` : canStart ? `#/ex/${enc(task.exercise)}?program=1&group=${enc(group.id)}` : null;
        return h('li', { class: `groups-task ${task.done ? 'done' : ''}` },
          h('span', { class: 'groups-task-mark', 'aria-hidden': 'true' }, task.done ? '✓' : index + 1),
          h('div', { class: 'groups-task-copy' }, h('h3', null, task.title || 'Упражнение'), h('p', { class: 'groups-task-topic' }, task.topic || 'Общая тема группы'),
            h('span', { class: `small ${task.done ? 'groups-task-status' : 'soft'}` }, task.done ? task.session_id ? 'Упражнение выполнено' : 'Запись удалена, результат сохранён.' : task.session_id ? 'Занятие начато' : currentDay ? 'Ещё не выполнено' : 'Не выполнено')),
          href ? h('a', { class: 'btn ghost groups-task-action', href, 'aria-label': `${task.done ? 'Посмотреть результат' : task.session_id ? 'Продолжить' : 'Начать'}: ${task.title || 'упражнение'}` }, task.done ? 'Результат' : task.session_id ? 'Продолжить' : 'Начать', icon('arrow')) : null);
      }));
    }
    function leaderboard(group) {
      const rows = list(group.leaderboard);
      return h('article', { class: 'card groups-leaderboard' }, sectionHeading('Рейтинг недели', h('span', { class: 'small soft' }, `${count(rows.length)} ${plural(rows.length, 'участник', 'участника', 'участников')}`)),
        h('p', { class: 'small soft' }, 'Место зависит от итогового рейтинга. Более высокая оценка тренера может вывести вперёд даже при меньшем числе упражнений. При равных результатах место общее.'),
        rows.length ? h('table', { class: 'groups-ranking' }, h('caption', { class: 'groups-sr-only' }, 'Общий рейтинг участников'),
          h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'groups-rank-col', 'aria-label': 'Место' }, '№'), h('th', { scope: 'col' }, 'Участник'), h('th', { scope: 'col', class: 'groups-numeric-col' }, 'Рейтинг'), h('th', { scope: 'col', class: 'groups-numeric-col' }, 'Тренер'))),
          h('tbody', null, rows.map((person) => h('tr', { class: person.is_self ? 'groups-self' : '' },
            h('td', { class: 'groups-rank num' }, person.rank || '—'),
            h('th', { scope: 'row', class: 'groups-ranking-person' }, h('div', { class: 'profile-identity' }, avatar(person, 'profile-small'), h('div', null, h('span', null, nameOf(person)), person.is_test ? h('span', { class: 'profile-test-label' }, 'Тест') : null)), h('span', { class: 'groups-person-label small' }, [person.is_self ? 'Вы' : '', person.is_leader ? 'Руководитель' : ''].filter(Boolean).join(' · ')),
              h('span', { class: 'groups-person-label small' }, `Упражнений: ${count(person.completed)} · Дней: ${count(person.active_days)}`),
              h('span', { class: 'groups-person-label small' }, `Слова: ${score(person.vocabulary_grade)} / 10 · Регулярность: ${count(person.training_points)} / 14`),
              person.provisional ? h('span', { class: 'groups-person-label small' }, 'Предварительный рейтинг') : null),
            h('td', { class: 'groups-ranking-points num' }, rating(person.rating), h('span', { class: 'groups-ranking-denominator small' }, ' / 100')),
            h('td', { class: 'groups-ranking-score num' }, person.average_score == null ? h('span', { 'aria-label': 'Оценки пока нет' }, '—') : score(person.average_score), person.average_score == null ? null : h('span', { class: 'groups-ranking-denominator small' }, ' / 10'))))))
          : h('p', { class: 'soft' }, 'Рейтинг появится, когда в группу вступят участники.'));
    }
    function weekDays(group, days) {
      const rest = days.filter((day) => !group.week.current || !day.today);
      if (!rest.length) return null;
      const today = days.find((day) => day.today);
      return h('details', { class: 'card groups-week-days' }, h('summary', null, group.week.current ? 'Остальные дни недели' : 'Задания прошедшей недели'),
        h('div', { class: 'groups-days' }, rest.map((day) => {
          const future = group.week.current && today && day.date > today.date;
          return h('details', { class: 'groups-day' }, h('summary', null, h('span', null, shortDate(day.date, true)), h('span', { class: 'small soft' }, future ? 'Впереди' : `${list(day.tasks).filter((task) => task.done).length} из ${list(day.tasks).length}`)),
            future ? h('p', { class: 'small soft' }, 'Откроются в этот день. Все участники получат одинаковые темы.') : taskList(group, day, false));
        })));
    }
    function joinPage() {
      const currentGroup = app.state && app.state.competition;
      const conflict = currentGroup && data && currentGroup.id !== data.id;
      return [crumb('К моим группам'), header('Вступление по приглашению', 'Ссылка автоматически добавляет в группу после получения доступа к тренажёру.'), error ? errorNotice(error) : null,
        !data ? loadingCard() : h('article', { class: 'card groups-join-card' }, h('span', { class: 'groups-eyebrow' }, 'Совместная речевая практика'), h('h2', null, data.name),
          h('p', { class: 'soft' }, 'Руководитель: ', nameOf(data.leader)), h('p', { class: 'small soft' }, `${count(data.member_count)} ${plural(data.member_count || 0, 'участник', 'участника', 'участников')}`),
          h('div', { class: 'groups-join-about' }, h('h3', null, 'Одна программа для всей группы'), h('p', null, 'Пять общих заданий в день и поединки между участниками. Рейтинг учитывает оценки тренера, словесные раунды и регулярность занятий. С понедельника начинается новая неделя, прошлые результаты сохраняются.')),
          h('p', { class: 'groups-join-privacy' }, joinNotice),
          conflict ? h('div', { class: 'stack' }, h('p', { class: 'soft' }, `Сейчас вы участвуете в группе «${currentGroup.name || 'Текущая группа'}». Сначала выйдите из неё, затем откройте приглашение снова.`),
            h('a', { class: 'btn ghost', href: groupRoute(currentGroup.id) }, 'Открыть текущую группу')) : data.joined ? h('a', { class: 'btn', href: groupRoute(data.id) }, 'Открыть мою группу', icon('arrow'))
            : h('button', { class: 'btn', type: 'button', disabled: pending, onclick: () => joinGroup(data.id, code) }, pending ? 'Вступаю…' : 'Вступить в группу'),
          h('a', { class: 'groups-decline', href: '#/groups' }, 'К моим группам'))];
    }
    async function joinGroup(id, invite) {
      if (pending) return;
      pending = true; error = null; draw();
      try {
        const joined = await api(`${groupPath(id)}/join`, { method: 'POST', body: { invite } });
        await syncState(joined);
        if (alive()) { toast('Вы вступили в группу'); location.hash = groupRoute(id); if (!isJoin) data = await api(groupPath(id)); }
      } catch (caught) { error = caught; }
      pending = false; if (alive()) draw();
    }
    async function makeInvite() {
      if (pending) return;
      pending = true; error = null; draw();
      try { const result = await api(`${groupPath(gid)}/invite`, { method: 'POST', body: {} }); inviteLink = result.url; }
      catch (caught) { error = caught; }
      pending = false; if (alive()) draw();
    }
    async function leaveGroup() {
      if (pending) return;
      if (!leaveArmed) { leaveArmed = true; draw(); return; }
      pending = true; error = null; draw();
      try { await api(`${groupPath(gid)}/leave`, { method: 'POST', body: {} }); await syncState(null, true); if (alive()) { toast('Вы вышли из группы'); location.hash = '#/groups'; } }
      catch (caught) { error = caught; }
      pending = false; if (alive()) draw();
    }

    await load();
    return { destroy() { destroyed = true; } };
  }

  return { view };
})();
