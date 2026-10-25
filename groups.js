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
  const avatar = (user, size = '') => window.TrainerProfiles ? TrainerProfiles.avatar(user, size) : h('span', { class: `groups-person-mark${size ? ` ${size}` : ''}`, 'aria-hidden': 'true' }, nameOf(user).slice(0, 1).toUpperCase());
  const shortDate = (day, weekday = false) => {
    const parsed = new Date(`${day}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(weekday ? { weekday: 'long' } : {}) });
  };
  const joinNotice = 'В группе видны имя, баллы, дни занятий и средняя оценка. Записи, тексты и разборы доступны вам; другие участники и руководитель их не видят.';
  const categories = [{ id: 'general', label: 'Разные темы' }, { id: 'work', label: 'Коллеги' }, { id: 'friends', label: 'Друзья' }, { id: 'family', label: 'Семья' }];
  const ageBands = [{ id: 'adults', label: 'Взрослые и подростки 14+' }, { id: 'under14', label: 'С детьми до 14 лет' }];
  const profileLabel = (group) => [group.category_label || categories.find((item) => item.id === group.category)?.label, group.age_label || (group.age_band === 'under14' ? 'С детьми до 14 лет' : '')].filter(Boolean).join(' · ');

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
    let createOpen = false, createName = '', createLeader = '', createCategory = 'general', createAge = 'adults', createError = null, leaders = null;
    let inviteLink = null, leaveArmed = false;
    let peopleQuery = '', people = null, peopleBusy = false, peopleError = null;
    let circleOpen = false, circlePeople = null, circleBusy = false;
    const invitedPeople = new Set();
    let testOpen = false, testUsers = null, testBusy = false, testError = null;
    const testLinks = new Map();
    const expandedResults = new Set();
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
          if (!data.joined) {
            const joined = await api(`${groupPath(data.id)}/join`, { method: 'POST', body: { invite: code } });
            await syncState(joined);
            if (alive()) location.hash = groupRoute(joined.id);
          } else if (data.joined && alive()) location.hash = groupRoute(data.id);
        } else {
          data = await api(gid ? `${groupPath(gid)}${weekQuery ? `?week=${enc(weekQuery)}` : ''}` : '/api/groups');
          // Обновление сбрасывает локальные отметки: адресат мог принять или
          // отклонить приглашение с момента предыдущего поиска.
          invitedPeople.clear(); people = null; circlePeople = null; circleOpen = false;
        }
      } catch (caught) { error = caught; }
      loading = false;
      if (alive()) draw();
    }
    async function syncState(group, left = false) {
      // Программа дня должна сразу учитывать вступление, без перезапуска приложения.
      if (alive() && app.state) {
        if (left && app.state.competition && app.state.competition.id === gid) app.state.competition = null;
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
      const groups = list(data && data.groups), referral = data && (data.circle || data.referral) || {};
      return [header('Мой круг и группы', 'Знакомые остаются в вашем круге. Для соревнований создавайте отдельные группы: у каждой свои задания и рейтинг.',
        h('button', { class: 'btn', type: 'button', disabled: pending, onclick: () => { createOpen = !createOpen; draw(); if (createOpen) loadLeaders(); } }, createOpen ? 'Закрыть форму' : 'Создать группу')),
      error ? errorNotice(error) : null,
      !data ? loadingCard() : [
        list(data.invitations).length ? invitationPanel(data.invitations) : null,
        data.pending_invite ? h('div', { class: 'card groups-pending-invite' }, h('div', null, h('h2', null, 'Приглашение по ссылке'), h('p', { class: 'soft' }, data.pending_invite.name || 'Совместная тренировка')),
          h('a', { class: 'btn ghost', href: `#/groups/join/${enc(data.pending_invite.code || '')}` }, 'Открыть группу', icon('arrow'))) : null,
        createOpen ? createForm() : null,
        circlePanel(referral),
        sectionHeading(app.state && app.state.is_owner ? 'Группы тренажёра' : 'Мои группы', h('span', { class: 'small soft' }, count(groups.length))),
        groups.length ? h('p', { class: 'small soft groups-list-hint' }, 'Можно участвовать в нескольких группах. Задания каждой группы проходите отдельно; результаты засчитываются только в ней.') : null,
        groups.length ? h('div', { class: 'groups-card-grid' }, groups.map((group) => groupCard(group)))
          : h('div', { class: 'card groups-empty' }, h('h2', null, 'Пока вы занимаетесь самостоятельно'), h('p', { class: 'soft' }, 'Создайте группу или откройте приглашение от знакомого. В группе у всех одинаковые задания дня и общий рейтинг.'),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { createOpen = true; draw(); loadLeaders(); } }, 'Создать первую группу')),
        app.state && app.state.is_owner ? testPanel() : null,
      ]];
    }
    function circlePanel(circle) {
      const friends = list(circle.friends);
      return h('article', { class: 'card groups-friends' }, sectionHeading('Мой круг', h('span', { class: 'chip num' }, count(friends.length))),
        h('p', { class: 'soft' }, 'Пригласите знакомых в свой круг, а затем соберите из них нужные группы для соревнований.'),
        h('details', { class: 'groups-circle-link' }, h('summary', null, 'Пригласить в мой круг'),
          copyLink(circle.url, 'Ссылка для приглашения в мой круг', 'По этой ссылке человек попадает в ваш круг. Группу для соревнований вы выбираете отдельно. Новый пользователь сначала получает доступ у владельца.')),
        circle.invited_by ? h('p', { class: 'small soft' }, 'Вас пригласил(а): ', nameOf(circle.invited_by)) : null,
        friends.length ? h('details', { class: 'groups-circle-people' }, h('summary', null, `Люди в моём круге · ${count(friends.length)}`),
          h('ul', { class: 'groups-friend-list' }, friends.map((friend) => h('li', null, avatar(friend),
            h('span', { class: 'groups-person-name' }, nameOf(friend), friend.username ? h('small', { class: 'soft' }, ` @${friend.username}`) : null, friend.is_test ? h('small', { class: 'profile-test-label' }, 'Тест') : null),
            h('span', { class: 'small soft' }, friend.status === 'pending' ? 'Ожидает доступа' : ['blocked', 'closed'].includes(friend.status) ? 'Доступ закрыт' : 'В тренажёре')))))
          : h('p', { class: 'small soft' }, 'Пока здесь никого. Отправьте знакомому ссылку «Пригласить в мой круг».'));
    }
    function invitationPanel(invitations) {
      return h('article', { class: 'card groups-invitations stack' }, sectionHeading('Приглашения в группы', h('span', { class: 'chip num' }, count(invitations.length))),
        h('p', { class: 'small soft' }, 'Присоединяйтесь к тем соревнованиям, в которых хотите участвовать. Ваши остальные группы сохранятся.'),
        h('ul', { class: 'groups-invitation-list' }, list(invitations).map((invitation) => {
          const group = invitation.group || invitation;
          return h('li', null, h('div', { class: 'stack groups-invitation-copy' }, h('h3', null, group.name || invitation.group_name || 'Группа'),
            h('p', { class: 'small soft' }, 'Приглашает: ', nameOf(invitation.invited_by || group.leader)),
            profileLabel(group) ? h('p', { class: 'small soft' }, profileLabel(group)) : null),
          h('div', { class: 'groups-form-actions' }, h('button', { class: 'btn', type: 'button', disabled: pending, onclick: () => respondInvitation(invitation, 'accept') }, 'Принять'),
            h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: () => respondInvitation(invitation, 'decline') }, 'Отклонить')));
        })), h('details', null, h('summary', null, 'Что увидят участники группы'), h('p', { class: 'small soft' }, joinNotice)));
    }
    async function respondInvitation(invitation, action) {
      if (pending) return;
      pending = true; error = null; draw();
      try {
        const result = await api(`/api/groups/invitations/${enc(invitation.id)}/${action}`, { method: 'POST', body: {} });
        if (action === 'accept') await syncState(result);
        data = await api('/api/groups');
        if (alive()) toast(action === 'accept' ? 'Вы вступили в группу' : 'Приглашение отклонено');
      } catch (caught) { error = caught; }
      pending = false; draw();
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
        h('div', { class: 'groups-card-tags' }, profileLabel(group) ? h('span', { class: 'small soft' }, profileLabel(group)) : null,
          group.demonstration ? h('span', { class: 'groups-demo-label' }, 'Демо-результаты') : null,
          group.is_selected || data.current_group_id === group.id ? h('span', { class: 'chip good' }, 'Выбрана для программы дня') : null),
        h('p', { class: 'soft' }, 'Руководитель: ', nameOf(group.leader)),
        standingsPreview(group),
        h('div', { class: 'groups-card-foot' }, h('span', { class: 'small soft' }, `${count(group.member_count)} ${plural(group.member_count || 0, 'участник', 'участника', 'участников')}`), icon('arrow')));
    }
    function standingsPreview(group) {
      const preview = group.standings_preview;
      if (!preview) return h('p', { class: 'small soft groups-card-preview-empty' }, 'Рейтинг доступен внутри группы.');
      const top = list(preview.top).slice(0, 3), self = preview.self, gap = preview.gap_to_leader;
      let selfLabel = '';
      if (preview.has_results && self) {
        const place = Number.isInteger(self.rank) && self.rank > 0 ? self.rank : null;
        if (place === 1 && gap === 0) selfLabel = top.filter((person) => person.rank === 1).length > 1 ? 'Делите первое место' : 'Вы лидируете';
        else if (place) {
          selfLabel = `Ваше место: ${count(place)}`;
          if (Number.isFinite(gap) && gap >= 0) selfLabel += ` · До лидера: ${rating(gap)} ${Number.isInteger(gap) ? plural(gap, 'балл', 'балла', 'баллов') : 'балла'}`;
        }
      } else if (!self && group.joined === false) selfLabel = 'Вы не участвуете';
      return h('div', { class: 'groups-card-preview' },
        h('div', { class: 'groups-card-preview-heading' }, h('span', null, 'Рейтинг недели'), h('span', { class: 'small soft' }, 'из 100')),
        preview.has_results && top.length ? h('ol', { class: 'groups-card-standings' }, top.map((person) => h('li', null,
          h('span', { class: 'groups-card-place num', 'aria-label': `Место: ${person.rank || '—'}` }, person.rank || '—'),
          avatar(person, 'groups-card-avatar'),
          h('span', { class: 'groups-card-person' }, h('span', null, nameOf(person), person.is_self ? h('span', { class: 'groups-card-person-self' }, ' · вы') : null),
            person.demonstration ? h('span', { class: 'groups-card-preview-demo' }, 'Демо') : null),
          h('span', { class: 'groups-card-rating num', 'aria-label': Number.isFinite(person.rating) ? `${rating(person.rating)} из 100` : 'Рейтинг пока не рассчитан' }, Number.isFinite(person.rating) ? rating(person.rating) : '—'))))
          : h('p', { class: 'small soft groups-card-preview-empty' }, 'Пока нет результатов'),
        selfLabel ? h('p', { class: 'groups-card-self small' }, selfLabel) : null);
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
      const options = data && data.profile_options || {};
      const categoryOptions = list(options.categories).length ? options.categories : categories;
      const ageOptions = list(options.age_bands).length ? options.age_bands : ageBands;
      const categorySelect = h('select', { id: 'groups-create-category', class: 'groups-input', value: createCategory, 'aria-describedby': 'groups-create-category-hint', onchange: (event) => { createCategory = event.target.value; draw(); root.querySelector('#groups-create-category').focus(); } },
        categoryOptions.map((item) => h('option', { value: item.id, selected: item.id === createCategory }, item.label)));
      const ageSelect = h('select', { id: 'groups-create-age', class: 'groups-input', value: createAge, 'aria-describedby': 'groups-create-age-hint', onchange: (event) => { createAge = event.target.value; draw(); root.querySelector('#groups-create-age').focus(); } },
        ageOptions.map((item) => h('option', { value: item.id, selected: item.id === createAge }, item.label)));
      const leaderSelect = app.state && app.state.is_owner && leaders && leaders.length ? h('select', { id: 'groups-create-leader', class: 'groups-input', value: createLeader, onchange: (event) => { createLeader = event.target.value; } },
        h('option', { value: '' }, 'Я буду руководителем'), leaders.filter((user) => user.role !== 'owner').map((user) => h('option', { value: user.id, selected: String(user.id) === createLeader }, nameOf(user)))) : null;
      return h('form', { class: 'card groups-create', onsubmit: async (event) => {
        event.preventDefault();
        if (pending) return;
        const name = createName.trim();
        if (!name) { createError = new Error('Напишите название группы.'); draw(); root.querySelector('#groups-create-name').focus(); return; }
        createError = null; pending = true; draw();
        try {
          const body = { name, category: createCategory, age_band: createAge };
          if (createLeader && app.state && app.state.is_owner) body.leader_id = Number(createLeader);
          const result = await api('/api/groups', { method: 'POST', body });
          await syncState(result);
          if (alive()) { toast('Группа создана'); location.hash = groupRoute(result.id); }
        } catch (caught) { createError = caught; }
        pending = false; if (alive()) draw();
      } }, h('h2', null, 'Новая группа'),
      field('Название группы', nameInput, 'Его будут видеть все участники.'),
      h('div', { class: 'groups-profile-fields' }, field('С кем тренируетесь', categorySelect, 'От этого зависят темы и слова заданий.'),
        field('Для кого подбирать задания', ageSelect, 'Взрослые тоже могут участвовать в группе с детьми.')),
      h('p', { class: 'groups-profile-note small' }, createAge === 'under14' ? 'Задания будут о знакомом детям: школе, играх, животных и повседневной жизни. Общую программу выполняют и дети, и взрослые.' : createCategory === 'work' ? 'В заданиях будут рабочие ситуации: общение с коллегами, объяснение идей и совместные решения.' : createCategory === 'family' ? 'Слова и темы будут о семье, домашних делах и совместных планах.' : createCategory === 'friends' ? 'Слова и темы будут о дружбе, увлечениях, встречах и общих планах.' : 'У группы будут свои слова и темы. Все её участники получают одинаковые условия.'),
      leaderSelect ? field('Руководитель', leaderSelect, 'Руководитель тоже участвует в рейтинге на общих условиях.') : null,
      h('p', { class: 'small soft' }, 'После создания пригласите людей из своего круга или отправьте ссылку этой группы. В других группах у них останутся отдельные задания и результаты.'),
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
        h('div', { class: 'groups-context' }, profileLabel(group) ? h('span', { class: 'chip' }, profileLabel(group)) : null,
          h('p', { class: 'small soft' }, 'Задания и результаты этой группы учитываются отдельно от других групп.')),
        weekBar(group),
        group.demonstration && group.demo_note ? h('aside', { class: 'card groups-demo-notice', 'aria-label': 'Демонстрационные результаты' },
          h('h2', null, 'Демо-результаты'), h('p', null, group.demo_note)) : null,
        !group.joined ? h('div', { class: 'card groups-consent' }, h('h2', null, 'Вы смотрите группу как владелец'), h('p', { class: 'soft' }, 'Чтобы выполнять общие задания и появиться в рейтинге, вступите в группу.'),
          h('p', { class: 'small soft' }, joinNotice), h('button', { class: 'btn', type: 'button', disabled: pending || !group.invite || !group.invite.code, onclick: () => joinGroup(group.id, group.invite.code) }, pending ? 'Вступаю…' : 'Вступить и участвовать')) : null,
        self ? h('article', { class: 'groups-self-result' }, sectionHeading('Ваш результат недели', h('span', { class: 'small soft' }, self.rank ? `Место: ${self.rank}` : 'Место пока не определено')),
          h('div', { class: 'groups-personal-summary' }, stat('Итоговый рейтинг', rating(self.rating), '/ 100'), stat('Оценка тренера', score(self.trainer_average == null ? self.average_score : self.trainer_average), '/ 10'),
            stat('Слова в поединках', score(self.vocabulary_grade), '/ 10'), stat('Регулярность', count(self.training_points), '/ 14')),
          h('p', { class: 'small soft' }, `Выполнено упражнений: ${count(self.completed)} из 35. Полных дней: ${count(self.completed_days)}.`, self.vocabulary_count == null ? '' : ` В словесных раундах в среднем зачтено ${score(self.vocabulary_count)} слов.`, self.provisional ? ' Рейтинг предварительный: пока есть не все виды результатов.' : ''),
          ratingBreakdown(self)) : null,
        week.current && today ? todayCard(group, today) : null,
        duelsCard(group),
        weekAwards(group),
        leaderboard(group),
        group.is_leader || app.state && app.state.is_owner ? peoplePanel() : null,
        !self ? ratingBreakdown(null) : null,
        weekDays(group, daily),
        h('details', { class: 'card groups-rules' }, h('summary', null, 'Как устроено соревнование'),
          h('ul', { class: 'groups-rule-list' }, (list(group.rules).length ? group.rules : [
            'Каждый день у участников этой группы одинаковые пять упражнений, темы и слова. В других группах задания свои. Выбрать другую тему в зачёт группы нельзя.',
            'Рейтинг складывается из оценки тренера (до 60), словесных поединков (до 30) и регулярности (до 10).',
            'Пять выполненных заданий за день дают 2 балла регулярности. За неделю можно набрать 14. Неполный день дополнительных баллов не даёт.',
            'В словесном раунде за 60 секунд 20 зачтённых слов дают оценку 1, 23 слова — 2. Каждые следующие три слова добавляют единицу, до 10. Меньше 20 слов — 0.',
            'Место зависит от итогового рейтинга. При равных результатах участники делят место. У турнира поединков свой победитель, его определяет финал.',
            'В понедельник начинается новая неделя с нуля. Результаты прошлых недель остаются в архиве.',
          ]).map((rule) => h('li', null, rule))), h('p', { class: 'small soft groups-privacy' }, joinNotice)),
        group.is_leader || app.state && app.state.is_owner ? h('article', { class: 'card groups-invite-card' }, sectionHeading('Пригласить в эту группу'),
          h('p', { class: 'soft' }, 'Отправьте ссылку друзьям: после входа они автоматически появятся в этой группе. Зарегистрированный участник использует свой профиль, новый сначала ждёт одобрения владельца.'),
          ownInvite ? copyLink(ownInvite, 'Ссылка для вступления в эту группу', 'Ссылка добавляет именно в эту группу. Для знакомства в «Моём круге» есть отдельная ссылка.') : h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: makeInvite }, pending ? 'Готовлю ссылку…' : 'Получить ссылку группы')) : null,
        group.joined && !group.is_leader ? h('details', { class: 'groups-leave' }, h('summary', null, 'Участие в группе'), h('p', { class: 'small soft' }, 'Вы сможете снова вступить по приглашению. Ваши личные занятия останутся в истории.'),
          h('button', { class: 'btn ghost', type: 'button', disabled: pending, onclick: leaveGroup }, pending ? 'Выхожу…' : leaveArmed ? 'Подтвердить выход' : 'Выйти из группы')) : null,
      ];
    }
    function peoplePanel() {
      const input = h('input', { id: 'groups-find-person', class: 'groups-input', type: 'search', value: peopleQuery,
        placeholder: '@nickname', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, minlength: 2, maxlength: 33,
        oninput: (event) => { peopleQuery = event.target.value; } });
      return h('article', { class: 'card groups-people stack' }, h('h2', null, 'Пригласить участников'),
        h('p', { class: 'soft' }, 'Выберите знакомых из своего круга или найдите их по Telegram-нику. Каждый получит приглашение в приложении и сам решит, вступать ли в группу.'),
        h('button', { class: 'btn ghost groups-circle-toggle', type: 'button', disabled: circleBusy, 'aria-expanded': String(circleOpen), onclick: async () => { circleOpen = !circleOpen; draw(); if (circleOpen && !circlePeople) await loadCircle(); } }, circleBusy ? 'Загружаю круг…' : circleOpen ? 'Свернуть мой круг' : 'Из моего круга'),
        circleOpen ? circlePeople ? circlePeople.length ? h('ul', { class: 'groups-test-list' }, circlePeople.map(invitablePerson)) : h('p', { class: 'small soft' }, 'В вашем круге пока нет доступных участников. Пригласите знакомых по ссылке круга или найдите ниже по нику.')
          : circleBusy ? h('p', { class: 'small soft', role: 'status' }, 'Загружаю участников…')
            : h('button', { class: 'btn ghost groups-circle-toggle', type: 'button', onclick: loadCircle }, 'Повторить загрузку круга') : null,
        h('form', { class: 'groups-people-search', onsubmit: async (event) => { event.preventDefault(); await searchPeople(); } },
          field('Telegram-ник', input, 'Введите хотя бы две буквы ника. Можно без @.'),
          h('button', { class: 'btn ghost', type: 'submit', disabled: peopleBusy }, peopleBusy ? 'Ищу…' : 'Найти')),
        peopleError ? errorNotice(peopleError) : null,
        people ? people.length ? h('ul', { class: 'groups-test-list' }, people.map(invitablePerson))
          : h('p', { class: 'small soft', role: 'status' }, 'Никого не нашли. Проверьте ник: человек должен сначала зарегистрироваться в боте и получить доступ.') : null);
    }
    function invitablePerson(person) {
      const joined = person.already_joined || list(data && data.leaderboard).some((member) => Number(member.user_id) === Number(person.id));
      const invited = person.invite_pending || invitedPeople.has(Number(person.id));
      return h('li', null, h('div', { class: 'profile-identity' }, avatar(person), h('div', null, h('strong', null, nameOf(person)),
        h('p', { class: 'small soft' }, person.username ? `@${person.username}` : 'Участник тренажёра', person.is_test ? ' · тестовый профиль' : ''))),
      joined ? h('span', { class: 'chip' }, 'Уже в группе') : invited ? h('span', { class: 'chip' }, 'Приглашение отправлено')
        : h('button', { class: 'btn ghost', type: 'button', disabled: peopleBusy || pending, onclick: () => addPerson(person) }, 'Пригласить'));
    }
    async function loadCircle() {
      if (circleBusy || !alive()) return;
      circleBusy = true; peopleError = null; draw();
      try {
        const overview = await api('/api/groups');
        circlePeople = list((overview.circle || overview.referral || {}).friends).filter((person) => !['pending', 'blocked', 'closed'].includes(person.status));
      } catch (caught) { peopleError = caught; }
      circleBusy = false; draw();
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
        const result = await api(`${groupPath(gid)}/members`, { method: 'POST', body: { user_id: person.id } });
        person.already_joined = result.already_joined === true;
        if (!person.already_joined) { person.invite_pending = true; invitedPeople.add(Number(person.id)); }
        data = await api(groupPath(gid));
        if (alive()) toast(person.already_joined ? 'Участник уже в группе' : 'Приглашение отправлено');
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
        h('p', { class: 'small soft' }, 'Пока есть не все виды результатов, рейтинг считается предварительным.'));
    }
    function duelsCard(group) {
      const week = group.week || {};
      const route = `#/groups/${enc(group.id)}/duels${week.current || !week.start ? '' : `?week=${enc(week.start)}`}`;
      return h('article', { class: 'card groups-duels-card' },
        h('div', { class: 'groups-duels-heading' }, icon('scales'), h('h2', null, 'Поединки недели')),
        h('p', { class: 'soft' }, 'В субботу участники играют друг с другом в круговом этапе. В воскресенье четверо лучших проводят полуфиналы: первое место с четвёртым, второе с третьим. Затем финал и матч за третье место.'),
        h('p', { class: 'small soft' }, 'У соперников одинаковые условия. Словесный раунд длится 60 секунд и влияет на общий рейтинг. Другим участникам доступны общие результаты, записи и тексты остаются личными.'),
        h('a', { class: 'btn ghost', href: route }, week.current ? 'Открыть поединки' : 'Поединки этой недели', icon('arrow')));
    }
    function todayCard(group, day) {
      const tasks = list(day.tasks), done = tasks.filter((task) => task.done).length;
      return h('article', { class: 'card groups-today' }, sectionHeading('Общие задания на сегодня', h('span', { class: 'chip num' }, `${done} из ${tasks.length}`)),
        h('p', { class: 'soft' }, shortDate(day.date, true), '. Темы одинаковые для участников этой группы.'),
        group.joined ? h('button', { class: 'btn ghost groups-program', type: 'button', disabled: pending, onclick: () => selectProgram(group) }, pending ? 'Открываю…' : 'Программа этой группы', icon('arrow')) : null,
        taskList(group, day, true),
        done === tasks.length && tasks.length ? h('p', { class: 'groups-all-done' }, 'Все пять заданий выполнены: 2 балла за регулярность. Новые общие темы появятся завтра.') : h('p', { class: 'small soft' }, 'Завершите все пять заданий с разбором тренера, чтобы получить 2 балла за регулярность. За неполный день баллы регулярности не начисляются.'));
    }
    async function selectProgram(group) {
      if (pending) return;
      pending = true; error = null; draw();
      try {
        const selected = await api(`${groupPath(group.id)}/select`, { method: 'POST', body: {} });
        if (alive() && app.state && selected && selected.id === group.id && Array.isArray(selected.tasks)) app.state.competition = selected;
        await syncState(group);
        if (alive()) location.hash = '#/program';
      } catch (caught) { error = caught; }
      pending = false; draw();
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
    function weekAwards(group) {
      const rows = list(group.leaderboard), week = group.week || {}, tournament = group.competition || {};
      const leaders = rows.filter((person) => person.rank === 1);
      const hasResults = leaders.some((person) => person.rating > 0 || person.completed > 0 || person.duels_played > 0);
      const winner = tournament.finished === true && tournament.winner_id != null
        ? list(tournament.podium).find((person) => String(person.id ?? person.user_id) === String(tournament.winner_id))
          || rows.find((person) => String(person.user_id) === String(tournament.winner_id)) : null;
      const route = `#/groups/${enc(group.id)}/duels${week.current || !week.start ? '' : `?week=${enc(week.start)}`}`;
      const identity = (person) => h('div', { class: 'groups-award-person' }, avatar(person, 'groups-award-avatar'), h('strong', null, nameOf(person)));
      return h('section', { class: 'groups-week-awards', 'aria-label': 'Два зачёта недели' },
        h('h2', null, 'Два зачёта недели'),
        h('p', { class: 'small soft' }, 'У рейтинга и турнира свои победители. В поединках решает результат финала.'),
        h('div', { class: 'groups-award-grid' },
          h('article', { class: 'card groups-award', 'data-award': 'rating' },
            h('div', { class: 'groups-award-heading' }, h('h3', null, 'Рейтинг недели'), week.current ? h('span', { class: 'chip' }, 'Предварительно') : null,
              hasResults && leaders.some((person) => person.demonstration) ? h('span', { class: 'groups-demo-label' }, 'Демо') : null),
            hasResults ? h('ul', { class: 'groups-award-winners' }, leaders.map((person) => h('li', null, identity(person), h('span', { class: 'groups-award-score num' }, rating(person.rating), h('small', null, ' / 100')))))
              : h('p', { class: 'small soft' }, 'Первые результаты определят лидера рейтинга.'),
            hasResults ? h('p', { class: 'small soft' }, leaders.length > 1 ? 'Участники делят первое место по баллам.' : week.current ? 'Лидер по баллам на данный момент.' : 'Первое место по итоговым баллам.') : null),
          h('article', { class: 'card groups-award', 'data-award': 'tournament' },
            h('div', { class: 'groups-award-heading' }, h('h3', null, 'Турнир поединков'), tournament.demonstration ? h('span', { class: 'groups-demo-label' }, 'Демо') : null),
            winner ? [identity(winner), h('p', { class: 'small soft' }, 'Первое место за победу в финале.')]
              : h('p', { class: 'small soft' }, tournament.finished ? 'Итог турнира доступен в сетке.' : week.current ? 'Победитель определится в воскресенье.' : 'Финал этой недели не завершён.'),
            h('a', { class: 'groups-award-link', href: route }, 'Турнирная сетка', icon('arrow')))));
    }
    function leaderboard(group) {
      const rows = list(group.leaderboard);
      return h('article', { class: 'card groups-leaderboard' }, sectionHeading('Рейтинг недели', h('span', { class: 'small soft' }, `${count(rows.length)} ${plural(rows.length, 'участник', 'участника', 'участников')}`)),
        h('p', { class: 'small soft' }, 'Нажмите на участника, чтобы посмотреть результаты за неделю.'),
        rows.length ? h('table', { class: 'groups-ranking groups-standings' }, h('caption', { class: 'groups-sr-only' }, 'Место, участник и рейтинг из 100. Подробности раскрываются по нажатию на имя.'),
          h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'groups-rank-col', 'aria-label': 'Место' }, '№'), h('th', { scope: 'col' }, 'Участник'),
            h('th', { scope: 'col', class: 'groups-numeric-col' }, 'Рейтинг', h('span', { class: 'groups-standing-scale' }, 'из 100')))),
          h('tbody', null, rows.flatMap((person, index) => participantRows(group, person, index))))
          : h('p', { class: 'soft' }, 'Рейтинг появится, когда в группу вступят участники.'));
    }
    function participantRows(group, person, index) {
      const key = String(person.user_id ?? index), id = `groups-result-${enc(group.id)}-${enc(key)}`;
      const opened = expandedResults.has(key);
      const ratingValue = Number.isFinite(person.rating) ? rating(person.rating) : '—';
      const panel = h('section', { id, class: 'groups-participant-results', role: 'region', 'aria-label': `Результаты за неделю: ${nameOf(person)}` }, participantResults(person));
      const detailRow = h('tr', { class: 'groups-standing-details', hidden: !opened }, h('td', { colspan: 3 }, panel));
      detailRow.hidden = !opened;
      const trigger = h('button', { class: 'groups-standing-trigger', type: 'button', 'aria-expanded': String(opened), 'aria-controls': id,
        'aria-label': `Результаты за неделю: ${nameOf(person)}`, onclick: () => {
          const show = !expandedResults.has(key);
          if (show) expandedResults.add(key); else expandedResults.delete(key);
          detailRow.hidden = !show;
          trigger.setAttribute('aria-expanded', String(show));
        } }, avatar(person, 'groups-standing-avatar'),
      h('span', { class: 'groups-standing-identity' }, h('span', { class: 'groups-standing-name' }, nameOf(person), person.is_self ? h('span', { class: 'groups-standing-self small' }, ' · вы') : null),
        person.demonstration ? h('span', { class: 'groups-demo-label' }, 'Демо') : null),
      h('span', { class: 'groups-standing-chevron', 'aria-hidden': 'true' }));
      return [h('tr', { class: `groups-standing-row${person.is_self ? ' groups-self' : ''}`, 'data-participant': key },
        h('td', { class: 'groups-rank num' }, h('span', { class: person.rank === 1 ? 'groups-rank-badge groups-rank-first' : 'groups-rank-badge' }, person.rank || '—')),
        h('th', { scope: 'row', class: 'groups-ranking-person' }, trigger),
        h('td', { class: 'groups-ranking-points num', 'aria-label': Number.isFinite(person.rating) ? `Рейтинг: ${ratingValue} из 100` : 'Рейтинг пока не рассчитан' }, ratingValue)), detailRow];
    }
    function participantResults(person) {
      const components = person.rating_components || {};
      const trainer = person.trainer_average ?? person.average_score;
      const metric = (title, value) => h('div', null, h('dt', null, title), h('dd', { class: 'num' }, value));
      return [h('div', { class: 'groups-participant-heading' }, h('h3', null, 'Результаты за неделю'),
        person.is_test ? h('span', { class: 'profile-test-label' }, 'Тестовый профиль') : null),
      h('p', { class: 'small soft' }, [person.username ? `@${person.username}` : '', person.is_leader ? 'Руководитель группы' : '', person.is_self ? 'Ваш результат' : ''].filter(Boolean).join(' · ')),
      person.demonstration ? h('p', { class: 'small soft' }, 'Демонстрационные результаты. Аудиозаписей и анализа тренера не было.') : null,
      h('dl', { class: 'groups-participant-metrics' },
        metric('Упражнения', `${count(person.completed)} из 35`), metric('Полные дни', `${count(person.completed_days)} из 7`),
        metric('Дни занятий', count(person.active_days)), metric('Оценка тренера', trainer == null ? 'Пока нет' : `${score(trainer)} / 10`),
        metric('Словарный навык', `${score(person.vocabulary_grade)} / 10`), metric('Регулярность', `${count(person.training_points)} / 14`),
        person.duels_played != null ? metric('Поединки', count(person.duels_played)) : null,
        person.vocabulary_count != null ? metric('В среднем слов за раунд', score(person.vocabulary_count)) : null),
      h('div', { class: 'groups-participant-components' }, h('h4', null, 'Баллы рейтинга'),
        h('dl', null, metric('Тренер', `${rating(components.trainer)} / 60`), metric('Слова в поединках', `${rating(components.vocabulary)} / 30`), metric('Регулярность', `${rating(components.training)} / 10`))),
      person.provisional ? h('p', { class: 'small soft' }, 'Рейтинг предварительный: пока есть не все виды результатов.') : null];
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
      return [crumb('К моим группам'), header('Вступление по приглашению', 'Ссылка автоматически добавляет в группу после получения доступа к тренажёру.'), error ? errorNotice(error) : null,
        !data ? loadingCard() : h('article', { class: 'card groups-join-card' }, h('span', { class: 'groups-eyebrow' }, 'Совместная речевая практика'), h('h2', null, data.name),
          h('p', { class: 'soft' }, 'Руководитель: ', nameOf(data.leader)), h('p', { class: 'small soft' }, `${count(data.member_count)} ${plural(data.member_count || 0, 'участник', 'участника', 'участников')}`),
          profileLabel(data) ? h('p', { class: 'small soft' }, profileLabel(data)) : null,
          h('div', { class: 'groups-join-about' }, h('h3', null, 'Одна программа для всей группы'), h('p', null, 'Пять общих заданий в день и поединки между участниками. Рейтинг учитывает оценки тренера, словесные раунды и регулярность занятий. С понедельника начинается новая неделя, прошлые результаты сохраняются.')),
          h('p', { class: 'small soft' }, 'Можно участвовать в нескольких группах. Задания и результаты этой группы учитываются отдельно.'),
          h('p', { class: 'groups-join-privacy' }, joinNotice),
          data.joined ? h('a', { class: 'btn', href: groupRoute(data.id) }, 'Открыть мою группу', icon('arrow'))
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
