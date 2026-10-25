'use strict';
/* Фото всегда приходит с нашего авторизованного API; адреса Telegram в браузер не попадают. */
window.TrainerProfiles = {
  avatar(person, extraClass = '') {
    const name = person && (person.name || person.username) || 'Участник';
    const initialName = person && person.is_test ? name.replace(/^Тест\s*·\s*/u, '') : name;
    const initial = Array.from(initialName.replace(/^@/, '').trim())[0] || '?';
    const node = h('span', { class: `profile-avatar ${extraClass}`, 'aria-hidden': 'true' },
      h('span', { class: 'profile-initial' }, initial.toLocaleUpperCase('ru-RU')));
    if (person && /^\d{1,20}$/.test(String(person.id || person.user_id || '')) && /^[a-f0-9]{64}$/.test(person.avatar_version || '')) {
      const image = h('img', { src: url(`/api/profiles/${person.id || person.user_id}/avatar?v=${person.avatar_version}`),
        alt: '', loading: 'lazy', decoding: 'async', width: 44, height: 44, referrerpolicy: 'no-referrer' });
      image.addEventListener('error', () => image.remove(), { once: true });
      node.append(image);
    }
    return node;
  },
};
