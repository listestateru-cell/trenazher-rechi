'use strict';
/* Фото приходит с авторизованного API, герои — из локального набора. */
window.TrainerProfiles = (() => {
  const characterIds = new Set(['sonic', 'mario', 'crash', 'chip', 'dale', 'gadget', 'zipper', 'monterey-jack', 'darkwing', 'scrooge', 'huey',
    'leonardo', 'donatello', 'tom', 'jerry', 'bugs', 'lola', 'spongebob', 'patrick', 'mr-krabs', 'plankton', 'kim', 'sailor-moon']);

  function avatar(person, extraClass = '') {
    const name = person && (person.name || person.username) || 'Участник';
    const initialName = person && person.is_test ? name.replace(/^Тест\s*·\s*/u, '') : name;
    const initial = Array.from(initialName.replace(/^@/, '').trim())[0] || '?';
    const node = h('span', { class: `profile-avatar ${extraClass}`, 'aria-hidden': 'true' },
      h('span', { class: 'profile-initial' }, initial.toLocaleUpperCase('ru-RU')));
    const character = person && characterIds.has(person.avatar_character) ? person.avatar_character : null;
    const telegramPhoto = person && /^\d{1,20}$/.test(String(person.id || person.user_id || '')) && /^[a-f0-9]{64}$/.test(person.avatar_version || '');
    if (character || telegramPhoto) {
      const image = h('img', { src: character ? `characters/${character}.webp` : url(`/api/profiles/${person.id || person.user_id}/avatar?v=${person.avatar_version}`),
        alt: '', loading: 'lazy', decoding: 'async', width: 44, height: 44, referrerpolicy: 'no-referrer' });
      image.addEventListener('error', () => image.remove(), { once: true });
      node.append(image);
    }
    return node;
  }

  function refreshHeader(state = app.state) {
    const link = document.querySelector('#profile-link');
    if (!link || !state) return;
    link.hidden = false;
    // Герой относится к группе. В общих тренировках всегда личное фото.
    link.replaceChildren(avatar({ ...state, avatar_character: null }, 'profile-small'));
    const active = /^#\/profile(?:\?|$)/.test(location.hash);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  function invitation() { return null; }

  function updateState(profile) {
    const person = profile.user;
    app.state = { ...app.state, user_id: person.id, name: person.name, username: person.username,
      is_test: person.is_test === true, avatar_version: person.avatar_version || null,
      avatar_source: person.avatar_source || (profile.personal_avatar || {}).source || 'telegram',
      avatar_character: null };
    refreshHeader();
  }

  async function view(ctx, parts, params = new URLSearchParams()) {
    let profile = await api('/api/profile');
    if (!ctx.alive()) return null;
    updateState(profile);
    let saving = false, selectedFile = null;
    const preview = h('div', { class: 'profile-preview-image' });
    const previewLabel = h('p', { class: 'profile-preview-label' });
    const status = h('p', { class: 'profile-save-status', role: 'status', 'aria-live': 'polite' });
    const input = h('input', { id: 'profile-photo-file', class: 'profile-photo-file', type: 'file',
      accept: 'image/jpeg,image/png,image/webp', 'aria-describedby': 'profile-photo-hint' });
    const save = h('button', { type: 'submit', class: 'btn profile-save' }, 'Загрузить фото');
    const remove = h('button', { type: 'button', class: 'btn ghost profile-photo-remove', onclick: () => changePhoto(true) }, 'Вернуть фото Telegram');
    const source = () => (profile.personal_avatar || {}).source || profile.user.avatar_source || 'telegram';
    function sync() {
      preview.replaceChildren(avatar({ ...profile.user, avatar_character: null }, 'profile-large'));
      previewLabel.textContent = source() === 'upload' ? 'Ваше фото' : (profile.user.avatar_version ? 'Фото Telegram' : 'Пока показываем букву имени');
      input.disabled = saving;
      save.disabled = saving || !selectedFile;
      save.textContent = saving ? 'Сохраняем…' : 'Загрузить фото';
      remove.disabled = saving;
      remove.hidden = source() !== 'upload';
      remove.textContent = (profile.telegram_avatar || {}).avatar_version ? 'Вернуть фото Telegram' : 'Убрать загруженное фото';
    }
    function fail(message) {
      status.textContent = message;
      status.classList.add('is-error');
    }
    input.addEventListener('change', () => {
      if (saving) return;
      selectedFile = (input.files || [])[0] || null;
      status.textContent = '';
      status.classList.remove('is-error');
      if (selectedFile && !['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
        selectedFile = null;
        fail('Выберите фотографию в формате JPEG, PNG или WebP.');
      } else if (selectedFile && (selectedFile.size <= 0 || selectedFile.size > 2 * 1024 * 1024)) {
        selectedFile = null;
        fail('Файл должен быть не больше 2 МБ. Выберите другое фото.');
      }
      sync();
    });
    async function changePhoto(reset = false) {
      if (saving || !reset && !selectedFile) return;
      saving = true;
      status.textContent = reset ? 'Возвращаем фото Telegram…' : 'Загружаем фото…';
      status.classList.remove('is-error');
      sync();
      try {
        const saved = await api('/api/profile/photo', reset ? { method: 'DELETE' } : { method: 'POST', blob: selectedFile, photo: true });
        if (!ctx.alive()) return;
        profile = saved;
        updateState(profile);
        selectedFile = null;
        input.value = '';
        status.textContent = reset ? (profile.user.avatar_version ? 'Теперь используется фото Telegram.' : 'Фото убрано. Пока показываем букву имени.') : 'Фото сохранено.';
      } catch (error) {
        if (!ctx.alive()) return;
        fail(`${error.message || 'Не удалось сохранить фото.'} Попробуйте ещё раз.`);
      } finally {
        saving = false;
        if (ctx.alive()) sync();
      }
    }
    const form = h('form', { class: 'profile-form profile-photo-form', onsubmit: async (event) => { event.preventDefault(); await changePhoto(); } },
      h('label', { class: 'profile-photo-label', for: input.id }, 'Загрузить своё фото'),
      h('p', { class: 'small soft', id: 'profile-photo-hint' }, 'JPEG, PNG или WebP, до 2 МБ. Фото обрежется по кругу.'),
      input, h('div', { class: 'profile-photo-actions' }, save, remove), status);
    sync();
    render(ctx, h('section', { class: 'profile-page' },
      h('a', { class: 'profile-back', href: '#/' }, icon('back'), 'К тренировкам'),
      params.get('welcome') === '1' ? h('p', { class: 'chip profile-welcome' }, 'Регистрация одобрена') : null,
      h('h1', null, 'Мой профиль'),
      h('p', { class: 'soft profile-intro' }, 'В личных тренировках показываем фото из Telegram. Вы можете загрузить свою фотографию.'),
      h('div', { class: 'card profile-preview' }, preview,
        h('div', { class: 'profile-preview-copy' }, h('p', { class: 'profile-preview-eyebrow' }, 'Личный профиль'),
          h('h2', null, profile.user.name || 'Участник'),
          profile.user.username ? h('p', { class: 'soft' }, `@${profile.user.username.replace(/^@/, '')}`) : null, previewLabel)),
      form,
      window.TrainerAssessment ? TrainerAssessment.profileCard(app.state && app.state.assessment) : null,
      h('section', { class: 'card profile-history' }, h('h2', null, 'История занятий'),
        h('p', { class: 'soft' }, 'Ваши ответы, переделки и разборы тренера. Можно вернуться и сравнить разные попытки.'),
        h('a', { class: 'btn ghost', href: '#/history' }, 'Открыть историю', icon('arrow'))),
      h('aside', { class: 'card profile-group-heroes' }, h('h2', null, 'Герои для игры в группах'),
        h('p', { class: 'soft' }, 'Героя выбирают отдельно в каждой группе. С коллегами можно играть одним персонажем, с друзьями — другим. Внутри группы у каждого свой герой.'),
        h('a', { class: 'btn ghost', href: '#/groups' }, 'Выбрать героя в группе', icon('arrow'))),
      h('p', { class: 'soft profile-footnote' }, 'Имя и ник остаются из Telegram.')));
    return null;
  }

  return { avatar, refreshHeader, invitation, view, hasCharacter: (id) => characterIds.has(id) };
})();
