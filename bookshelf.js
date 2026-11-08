'use strict';
/* Полка «Тренировки»: корешки стоят в ряд, выбранная книга выдвигается и поворачивается
   обложкой. Движение — CSS-переходы по [data-open]: клик посреди поворота разворачивает его,
   а не ставит в очередь. Соседи раздвигаются вместе с книгой, потому что её ширина в потоке.
   Обложки — book-covers.js. Без этого модуля главная показывает прежнюю карусель. */
window.TrainerBookshelf = (() => {
  // ширина корешка и доля высоты обложки: книги на полке разной толщины и роста
  const SIZES = [[56, 0.93], [62, 0.98], [54, 0.9], [64, 1], [52, 0.95], [60, 0.89], [58, 0.96], [54, 0.92]];
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function mount({ id, title, items = [], label = title, open = 0 }) {
    const covers = window.TrainerBookCovers;
    const entries = Array.isArray(items) ? items : [];
    const titleId = `bookshelf-${id}-title`;
    let current = -1;

    const books = entries.map((item, index) => {
      const key = item.cover || item.icon;
      const cover = covers.get(key);
      const [width, height] = SIZES[index % SIZES.length];
      const art = h('span', { class: 'book-cover-art' });
      art.innerHTML = covers.art(key);
      const mark = h('span', { class: 'book-spine-mark' });
      mark.innerHTML = covers.markFor(key);
      const spine = h('button', { type: 'button', class: 'book-spine', 'aria-expanded': 'false',
        'aria-label': `${item.title}: достать книгу`, onclick: () => toggle(index) },
      h('span', { class: 'book-spine-title' }, item.title), mark);
      const coverLink = h('a', { class: 'book-cover', href: item.href, tabindex: '-1', 'aria-hidden': 'true',
        'aria-label': `Начать: ${item.title}`, draggable: 'false' },
      art,
      h('span', { class: 'book-cover-text' },
        h('span', { class: 'book-cover-label' }, item.kicker || 'Тренировка'),
        h('span', { class: 'book-cover-title' }, item.title),
        item.meta ? h('span', { class: 'book-cover-meta' }, item.meta) : null));
      const book = h('div', { class: 'book', role: 'listitem', 'data-open': 'false',
        style: `--book-bg:${cover.bg};--book-ink:${cover.ink};--spine-w:${width}px;--spine-k:${height}` },
      spine, coverLink);
      book.addEventListener('transitionend', event => {
        if (event.target === book && event.propertyName === 'flex-basis' && index === current) center(book);
      });
      return { book, spine, coverLink, item };
    });

    const track = h('div', { class: 'bookshelf-track', role: 'list', 'aria-label': label }, books.map(b => b.book));
    const number = h('span', { class: 'bookshelf-caption-number' });
    const captionTitle = h('h3', { class: 'bookshelf-caption-title' });
    const meta = h('span', { class: 'bookshelf-caption-meta' });
    const start = h('a', { class: 'bookshelf-caption-start' }, 'Начать →');
    const back = h('button', { type: 'button', class: 'bookshelf-caption-back', onclick: () => close(true) }, 'Поставить обратно');
    const description = h('p', { class: 'bookshelf-caption-description' });
    const hint = h('p', { class: 'bookshelf-caption-hint' }, 'Нажмите на корешок, чтобы достать книгу');
    const caption = h('div', { class: 'bookshelf-caption', 'aria-live': 'polite' },
      h('div', { class: 'bookshelf-caption-line' }, number, captionTitle, meta, start, back), description, hint);
    const section = h('section', { class: 'training-home-section bookshelf', 'aria-labelledby': titleId, 'data-home-shelf': id },
      h('div', { class: 'glass-home-section-heading home-shelf-heading' }, h('h2', { id: titleId }, title),
        h('span', { class: 'bookshelf-count' }, plural(entries.length))),
      h('div', { class: 'bookshelf-stage' }, track, h('div', { class: 'bookshelf-ledge', 'aria-hidden': 'true' })), caption);

    function plural(n) {
      const m10 = n % 10, m100 = n % 100;
      const word = m10 === 1 && m100 !== 11 ? 'книга' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'книги' : 'книг';
      return `${n} ${word}`;
    }
    function center(book) {
      if (track.scrollWidth <= track.clientWidth) return;
      const left = book.offsetLeft + book.offsetWidth / 2 - track.clientWidth / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: reduced() ? 'auto' : 'smooth' });
    }
    function setOpen(index, value) {
      const b = books[index];
      if (!b) return;
      b.book.setAttribute('data-open', value ? 'true' : 'false');
      b.spine.setAttribute('aria-expanded', value ? 'true' : 'false');
      b.spine.setAttribute('aria-label', `${b.item.title}: ${value ? 'поставить обратно' : 'достать книгу'}`);
      b.coverLink.setAttribute('tabindex', value ? '0' : '-1');
      b.coverLink.setAttribute('aria-hidden', value ? 'false' : 'true');
    }
    function render() {
      const b = books[current];
      section.setAttribute('data-has-open', b ? 'true' : 'false');
      hint.hidden = !!b;
      caption.querySelector('.bookshelf-caption-line').hidden = !b;
      description.hidden = !b;
      if (!b) return;
      number.textContent = String(current + 1).padStart(2, '0');
      captionTitle.textContent = b.item.title;
      meta.textContent = [b.item.meta, b.item.badge == null ? '' : `оценка ${b.item.badge}`].filter(Boolean).join(' · ');
      start.setAttribute('href', b.item.href);
      description.textContent = b.item.description || '';
    }
    function openBook(index) {
      if (index === current) return;
      if (current >= 0) setOpen(current, false);
      current = index;
      setOpen(index, true);
      render();
      if (reduced()) center(books[index].book);
    }
    function close(focusSpine) {
      if (current < 0) return;
      const was = current;
      setOpen(was, false);
      current = -1;
      render();
      if (focusSpine) books[was].spine.focus();
    }
    function toggle(index) { if (index === current) close(false); else openBook(index); }

    function onKey(event) {
      if (event.key === 'Escape' && current >= 0) { close(true); return; }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const at = books.findIndex(b => b.spine === document.activeElement || b.coverLink === document.activeElement);
      if (at < 0) return;
      event.preventDefault();
      const next = (at + (event.key === 'ArrowRight' ? 1 : -1) + books.length) % books.length;
      openBook(next);
      books[next].coverLink.focus({ preventScroll: true });
    }
    section.addEventListener('keydown', onKey);

    // Первая книга открыта сразу и без анимации; переходы включаются со следующего кадра.
    if (books.length && open >= 0 && open < books.length) { current = open; setOpen(open, true); }
    render();
    const ready = () => section.classList.add('is-ready');
    let frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => { frame = requestAnimationFrame(ready); }) : (ready(), 0);

    section.destroy = () => {
      section.removeEventListener('keydown', onKey);
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    };
    section.openBook = openBook;
    section.closeBook = close;
    return section;
  }

  return { mount };
})();
