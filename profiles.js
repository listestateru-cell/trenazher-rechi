'use strict';
/* Фото приходит с авторизованного API, герои — из локального набора. */
window.TrainerProfiles = (() => {
  const characterIds = new Set(['sonic', 'mario', 'crash', 'chip', 'dale', 'gadget', 'darkwing', 'scrooge',
    'leonardo', 'donatello', 'shrek', 'fiona', 'tom', 'jerry', 'bugs', 'lola', 'spongebob', 'kim', 'sailor-moon']);

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
    link.replaceChildren(avatar(state, 'profile-small'));
    const active = /^#\/profile(?:\?|$)/.test(location.hash);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  function invitation(state) {
    if (!state || state.avatar_choice_made !== false) return null;
    return h('aside', { class: 'card profile-invitation', 'aria-labelledby': 'profile-invitation-title' },
      avatar(state),
      h('div', null, h('h2', { id: 'profile-invitation-title' }, 'Как вас показывать?'),
        h('p', { class: 'soft' }, 'Оставьте фото Telegram или выберите героя для профиля и таблицы участников.')),
      h('a', { class: 'btn ghost', href: '#/profile?welcome=1' }, 'Выбрать образ'));
  }

  function updateState(profile) {
    const person = profile.user;
    app.state = { ...app.state, user_id: person.id, name: person.name, username: person.username,
      is_test: person.is_test === true, avatar_version: person.avatar_version || null,
      avatar_character: person.avatar_character || null, avatar_choice_made: profile.avatar_choice_made === true };
    refreshHeader();
  }

  async function view(ctx, parts, params = new URLSearchParams()) {
    const profile = await api('/api/profile');
    if (!ctx.alive()) return null;
    updateState(profile);
    const characters = (profile.characters || []).filter((character) => characterIds.has(character.id));
    const telegram = { ...profile.telegram_avatar, avatar_character: null };
    const original = profile.avatar_choice && profile.avatar_choice.source === 'character' && characterIds.has(profile.avatar_choice.character_id)
      ? profile.avatar_choice.character_id : null;
    let chosen = original, made = profile.avatar_choice_made === true, saving = false;
    const controls = [];
    const preview = h('div', { class: 'profile-preview-image' });
    const previewLabel = h('p', { class: 'profile-preview-label', role: 'status', 'aria-live': 'polite' });
    const status = h('p', { class: 'profile-save-status', role: 'status', 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn profile-save' }, 'Сохранить');
    let savedChoice = original;
    const choiceName = () => chosen ? (characters.find((character) => character.id === chosen) || {}).name || 'Герой' : 'Фото Telegram';
    function sync() {
      const person = chosen ? { ...profile.user, avatar_character: chosen } : telegram;
      preview.replaceChildren(avatar(person, 'profile-large'));
      previewLabel.textContent = choiceName();
      for (const control of controls) {
        const selected = control.id === chosen;
        control.input.checked = selected;
        control.input.disabled = saving;
        control.label.classList.toggle('is-selected', selected);
        control.marker.textContent = selected ? '✓ Выбрано' : '';
      }
      save.disabled = saving || (made && chosen === savedChoice);
      save.textContent = saving ? 'Сохраняем…' : 'Сохранить';
    }
    function option(id, name, image, hint) {
      const input = h('input', { type: 'radio', name: 'profile-avatar-choice', value: id || 'telegram', checked: chosen === id });
      const marker = h('span', { class: 'profile-choice-marker', 'aria-hidden': 'true' });
      const label = h('label', { class: `profile-choice${id ? '' : ' profile-choice-telegram'}` }, input,
        image, h('span', { class: 'profile-choice-copy' }, h('span', { class: 'profile-choice-name' }, name),
          hint ? h('span', { class: 'profile-choice-hint' }, hint) : null), marker);
      controls.push({ id, input, label, marker });
      input.addEventListener('change', () => {
        if (saving || !input.checked) return;
        chosen = id;
        status.textContent = '';
        status.classList.remove('is-error');
        sync();
      });
      return label;
    }
    const telegramChoice = option(null, 'Фото Telegram', avatar(telegram, 'profile-choice-avatar'),
      telegram.avatar_version ? 'Использовать фотографию из Telegram' : 'Фото недоступно. Пока покажем букву вашего имени.');
    const grid = h('div', { class: 'profile-character-grid' }, characters.map((character) => option(character.id, character.name,
      avatar({ ...profile.user, avatar_character: character.id }, 'profile-choice-avatar'))));
    const form = h('form', { class: 'profile-form' },
      h('fieldset', { class: 'profile-options' }, h('legend', null, 'Фото или герой'), telegramChoice,
        h('p', { class: 'soft profile-gallery-note' }, 'Герои из девяностых и двухтысячных'), grid),
      h('div', { class: 'profile-save-row' }, save, status));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving || (made && chosen === savedChoice)) return;
      saving = true;
      status.textContent = '';
      status.classList.remove('is-error');
      sync();
      try {
        const saved = await api('/api/profile', { method: 'POST', body: chosen ? { source: 'character', character_id: chosen } : { source: 'telegram' } });
        updateState(saved);
        if (!ctx.alive()) return;
        made = true;
        savedChoice = chosen;
        status.textContent = 'Сохранено. Этот образ виден в группах и поединках.';
      } catch (error) {
        if (!ctx.alive()) return;
        status.textContent = `${error.message || 'Не удалось сохранить выбор.'} Выбранный образ остался здесь. Попробуйте сохранить ещё раз.`;
        status.classList.add('is-error');
      } finally {
        saving = false;
        if (ctx.alive()) sync();
      }
    });
    sync();
    render(ctx, h('section', { class: 'profile-page' },
      h('a', { class: 'profile-back', href: '#/' }, icon('back'), 'К тренировкам'),
      params.get('welcome') === '1' ? h('p', { class: 'chip profile-welcome' }, 'Регистрация одобрена') : null,
      h('h1', null, 'Мой профиль'),
      h('p', { class: 'soft profile-intro' }, 'Выберите, как вас увидят другие участники. Образ можно поменять в любое время.'),
      h('div', { class: 'card profile-preview' }, preview,
        h('div', { class: 'profile-preview-copy' }, h('p', { class: 'profile-preview-eyebrow' }, 'В таблице и поединках'),
          h('h2', null, profile.user.name || 'Участник'),
          profile.user.username ? h('p', { class: 'soft' }, `@${profile.user.username.replace(/^@/, '')}`) : null, previewLabel)),
      form,
      h('p', { class: 'soft profile-footnote' }, 'Ник и имя остаются из Telegram. Выбор героя не влияет на баллы. ',
        h('a', { href: 'characters/credits.html', target: '_blank', rel: 'noopener' }, 'Источники изображений'))));
    return null;
  }

  return { avatar, refreshHeader, invitation, view };
})();
