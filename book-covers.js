'use strict';
/* Обложки книг на полке «Тренировки». Палитра бренда «Соловей»: красный #E8483A,
   кремовый, чернила; у каждой книги свой цвет корешка. Картинки — статичный SVG (200×200),
   без пользовательских данных, поэтому их можно вставлять разметкой. */
window.TrainerBookCovers = (() => {
  const RED = '#E8483A';
  const CREAM = '#F1E8D4';
  const INK = '#171717';

  const covers = {
    minute: {
      bg: '#1F3D33', ink: CREAM,
      art: `
        <rect x="88" y="30" width="24" height="13" rx="4" fill="${CREAM}"/>
        <path d="M100 43v9M147 63l9-9" stroke="${CREAM}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="100" cy="116" r="62" fill="none" stroke="${CREAM}" stroke-width="7"/>
        <path d="M100 116 100 66A50 50 0 1 1 50 116Z" fill="${RED}"/>
        <path d="M100 116 57 116" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="100" cy="116" r="7" fill="${CREAM}"/>`,
    },
    compress: {
      bg: '#C9922E', ink: INK,
      art: `
        <rect x="24" y="44" width="152" height="26" rx="13" fill="${INK}"/>
        <rect x="24" y="88" width="96" height="26" rx="13" fill="${INK}"/>
        <rect x="24" y="132" width="46" height="26" rx="13" fill="${INK}"/>
        <text x="40" y="63" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="${CREAM}">60</text>
        <text x="40" y="107" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="${CREAM}">30</text>
        <text x="36" y="151" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="${CREAM}">15</text>
        <circle cx="92" cy="145" r="11" fill="${RED}"/>`,
    },
    sprint: {
      bg: '#1D2B45', ink: CREAM,
      art: `
        <path d="M28 52C52 22 70 30 82 42S150 46 142 72 70 92 62 110 112 134 122 122 176 120 166 144 66 150 44 162 92 188 104 170"
          fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9"/>
        <path d="m97 164 9 5-10 4" fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${[[28, 52], [82, 42], [142, 72], [62, 110], [122, 122], [166, 144], [44, 162]].map(([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="7" fill="${CREAM}"/>`).join('')}
        <g font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="12" fill="${CREAM}" opacity=".85">
          <text x="38" y="34">ветер</text><text x="150" y="60">дом</text><text x="20" y="128">море</text>
          <text x="132" y="112">ключ</text><text x="146" y="170">огонь</text></g>`,
    },
    explain: {
      bg: '#E9DFC8', ink: INK,
      art: `
        <circle cx="100" cy="46" r="17" fill="none" stroke="${RED}" stroke-width="6"/>
        <path d="M92 70h16M94 78h12M100 18v-8M128 46h8M64 46h8M120 26l6-6M80 26l-6-6" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="46" cy="136" r="10" fill="${INK}"/>
        <rect x="35" y="150" width="22" height="30" rx="10" fill="${INK}"/>
        <circle cx="100" cy="118" r="12" fill="${INK}"/>
        <rect x="86" y="134" width="28" height="46" rx="12" fill="${INK}"/>
        <circle cx="154" cy="98" r="14" fill="${INK}"/>
        <rect x="137" y="116" width="34" height="64" rx="14" fill="${INK}"/>
        <path d="M22 182h156" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    },
    duel: {
      bg: '#B8432F', ink: CREAM,
      art: `
        <path d="M20 44h66a14 14 0 0 1 14 14v22a14 14 0 0 1-14 14H70l-8 14-4-14H20A14 14 0 0 1 6 80V58a14 14 0 0 1 14-14Z" fill="${CREAM}"/>
        <text x="53" y="78" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="22" fill="#B8432F">ЗА</text>
        <path d="M114 96h66a14 14 0 0 1 14 14v22a14 14 0 0 1-14 14h-38l-4 14-8-14h-16a14 14 0 0 1-14-14v-22a14 14 0 0 1 14-14Z" fill="${INK}"/>
        <text x="147" y="129" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="15" fill="${CREAM}">ПРОТИВ</text>
        <path d="M52 186 98 140M58 140l40 46" stroke="${CREAM}" stroke-width="5" stroke-linecap="round"/>
        <path d="M46 146l14 0M44 180l14 0" stroke="${CREAM}" stroke-width="5" stroke-linecap="round" opacity=".7"/>`,
    },
    coach: {
      bg: '#161616', ink: CREAM,
      art: `
        <path d="M60 70C58 38 82 22 104 22c26 0 44 18 44 42 0 26-28 34-40 50-6 8-7 16-7 26"
          fill="none" stroke="${RED}" stroke-width="18" stroke-linecap="butt" stroke-linejoin="round"/>
        <circle cx="101" cy="172" r="12" fill="${CREAM}"/>
        <path d="M150 150c10 2 18 10 20 20M156 136c18 4 30 18 32 36" fill="none" stroke="${CREAM}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
    },
    free: {
      bg: '#2C5F5D', ink: CREAM,
      art: `
        <path d="M100 0 34 196h132Z" fill="${CREAM}" opacity=".1"/>
        <rect x="83" y="46" width="34" height="62" rx="17" fill="${CREAM}"/>
        <path d="M89 64h22M89 76h22M89 88h22" stroke="#2C5F5D" stroke-width="3" stroke-linecap="round" opacity=".55"/>
        <path d="M68 92a32 32 0 0 0 64 0M100 124v38M78 164h44" fill="none" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
        <path d="M56 58a52 52 0 0 0 0 64M144 58a52 52 0 0 1 0 64" fill="none" stroke="#F2C14E" stroke-width="5" stroke-linecap="round"/>
        <path d="M38 44a76 76 0 0 0 0 92M162 44a76 76 0 0 1 0 92" fill="none" stroke="#F2C14E" stroke-width="5" stroke-linecap="round" opacity=".5"/>`,
    },
    conversation: {
      bg: '#4A2A45', ink: CREAM,
      art: `
        <path d="M30 34h96a20 20 0 0 1 20 20v40a20 20 0 0 1-20 20H64l-24 20 4-20H30a20 20 0 0 1-20-20V54a20 20 0 0 1 20-20Z" fill="${CREAM}"/>
        <circle cx="52" cy="74" r="7" fill="#4A2A45"/><circle cx="78" cy="74" r="7" fill="#4A2A45"/><circle cx="104" cy="74" r="7" fill="#4A2A45"/>
        <path d="M128 98l10 16 18-10 2 20 20 4-14 14 12 16-20 2-2 20-16-12-14 14-6-20-20 2 8-18-16-12 18-8-4-18 18 6Z" fill="${RED}"/>
        <path d="M134 128v20M134 158v2" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>`,
    },
  };
  const SERIF = `font-family="Georgia, 'Times New Roman', serif"`;
  // «Мысль и слово»: тона старой библиотеки
  Object.assign(covers, {
    thought: {
      bg: '#6B2230', ink: CREAM,
      art: `
        <path d="M52 62 148 70 98 152Z" fill="none" stroke="${CREAM}" stroke-width="5" stroke-linejoin="round" stroke-dasharray="2 10" stroke-linecap="round"/>
        <circle cx="52" cy="62" r="17" fill="${CREAM}"/><circle cx="148" cy="70" r="17" fill="${CREAM}"/><circle cx="98" cy="152" r="19" fill="${CREAM}"/>
        <circle cx="99" cy="95" r="12" fill="${RED}"/>`,
    },
    retell: {
      bg: '#22304F', ink: CREAM,
      art: `
        <path d="M100 66C80 52 50 50 26 58v96c24-8 54-6 74 8 20-14 50-16 74-8V58c-24-8-54-6-74 8Z" fill="${CREAM}"/>
        <path d="M100 66v96" stroke="#22304F" stroke-width="3"/>
        <path d="M40 82c14-4 30-3 44 2M40 100c14-4 30-3 44 2M40 118c14-4 30-3 44 2M116 84c14-5 30-6 44-2M116 102c14-5 30-6 44-2" stroke="#22304F" stroke-width="3" stroke-linecap="round" opacity=".55"/>
        <path d="M138 56v40l9-7 9 7V54" fill="${RED}"/>
        <path d="M116 120c14-5 30-6 44-2" stroke="${RED}" stroke-width="4" stroke-linecap="round"/>`,
    },
    clarify: {
      bg: '#2E4A3A', ink: CREAM,
      art: `
        <path d="M24 70h70M24 92h54M24 114h66M24 136h46" stroke="${CREAM}" stroke-width="6" stroke-linecap="round" stroke-dasharray="3 9" opacity=".6"/>
        <circle cx="122" cy="102" r="44" fill="#2E4A3A" stroke="${CREAM}" stroke-width="7"/>
        <path d="M98 92h48M98 112h34" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="146" cy="112" r="6" fill="${RED}"/>
        <path d="M154 136l26 26" stroke="${CREAM}" stroke-width="11" stroke-linecap="round"/>`,
    },
    synonyms: {
      bg: '#B5832F', ink: INK,
      art: `
        <path d="M22 108h46c22 0 30-52 58-52h20M68 108h78M68 108c22 0 30 50 58 50h20" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="22" cy="108" r="11" fill="${INK}"/>
        <circle cx="160" cy="56" r="9" fill="${INK}"/><circle cx="160" cy="108" r="14" fill="${RED}"/><circle cx="160" cy="158" r="7" fill="${INK}"/>`,
    },
    lexicon: {
      bg: '#3D4A55', ink: CREAM,
      art: `
        <text x="58" y="150" ${SERIF} font-size="120" fill="${CREAM}">Ѣ</text>
        <path d="M150 26c-22 18-40 46-50 82l-6 22 14-16c28-30 44-58 42-88Z" fill="${RED}"/>
        <path d="M100 108c14-24 30-48 50-82" stroke="#3D4A55" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M30 174c28-10 52 6 80-4s46-8 62 0" fill="none" stroke="${CREAM}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
    },
    all: {
      bg: '#E6DCC3', ink: INK,
      art: `
        <rect x="34" y="34" width="56" height="56" rx="10" fill="${INK}"/><rect x="110" y="34" width="56" height="56" rx="10" fill="${RED}"/>
        <rect x="34" y="110" width="56" height="56" rx="10" fill="${INK}"/><rect x="110" y="110" width="56" height="56" rx="10" fill="${INK}"/>`,
    },
  });

  // «Мастерская воображения»: яркие тона сказочной полки
  Object.assign(covers, {
    'im-connect': {
      bg: '#2E2A6B', ink: CREAM,
      art: `
        <path d="M44 132C60 52 140 52 156 132" fill="none" stroke="${CREAM}" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/>
        <circle cx="44" cy="140" r="22" fill="${CREAM}"/><rect x="134" y="118" width="44" height="44" rx="8" fill="${CREAM}"/>
        <path d="M100 52l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2Z" fill="${RED}"/>`,
    },
    'im-senses': {
      bg: '#3E6E9C', ink: CREAM,
      art: `
        <path d="M54 104a26 26 0 0 1 8-50 34 34 0 0 1 64-6 26 26 0 0 1 22 50Z" fill="${CREAM}"/>
        <path d="M66 124l-6 16M96 126l-6 16M152 124l-6 16" stroke="${CREAM}" stroke-width="5" stroke-linecap="round"/>
        <path d="M122 168c-14-9-20-16-20-23a9 9 0 0 1 20-3 9 9 0 0 1 20 3c0 7-6 14-20 23Z" fill="${RED}"/>`,
    },
    'im-object': {
      bg: '#1F6F6B', ink: CREAM,
      art: `
        <path d="M72 96a28 28 0 1 1 56 0c0 14-10 22-12 34H84c-2-12-12-20-12-34Z" fill="none" stroke="${CREAM}" stroke-width="6"/>
        <path d="M86 142h28M90 154h20" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 124V90" stroke="#9ED7A5" stroke-width="4" stroke-linecap="round"/>
        <circle cx="100" cy="80" r="11" fill="${RED}"/><circle cx="89" cy="80" r="6" fill="${RED}"/><circle cx="111" cy="80" r="6" fill="${RED}"/>`,
    },
    'im-improvise': {
      bg: '#D4682A', ink: INK,
      art: `
        <path d="M24 150h82V58" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M86 78l20-22 20 22" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="106" cy="150" r="13" fill="${CREAM}"/>
        <path d="M140 120l10-18 4 14 16-6-10 18" fill="none" stroke="${CREAM}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    'im-observation': {
      bg: '#1B2333', ink: CREAM,
      art: `
        <path d="M18 104c24-38 52-56 82-56s58 18 82 56c-24 38-52 56-82 56s-58-18-82-56Z" fill="${CREAM}"/>
        <circle cx="100" cy="104" r="34" fill="${RED}"/><circle cx="100" cy="104" r="15" fill="${INK}"/><circle cx="110" cy="94" r="6" fill="${CREAM}"/>`,
    },
    'im-perspectives': {
      bg: '#5B2C6F', ink: CREAM,
      art: `
        <path d="M100 104 34 60M100 104 168 66M100 104 100 176" stroke="${CREAM}" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>
        <circle cx="100" cy="104" r="16" fill="${RED}"/>
        ${[[30, 56], [172, 62], [100, 182]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="18" ry="11" fill="${CREAM}"/><circle cx="${x}" cy="${y}" r="5" fill="#5B2C6F"/>`).join('')}`,
    },
    'im-story': {
      bg: '#9A3B25', ink: CREAM,
      art: `
        <path d="M100 186v-62M100 124 50 46M100 124l50-78" stroke="${CREAM}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="100" cy="150" r="10" fill="${INK}"/><path d="M92 178l8-18 8 18" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M118 74h40l10 10-10 10h-40Z" fill="${RED}" stroke="${CREAM}" stroke-width="3"/>
        <path d="M82 58H42L32 68l10 10h40Z" fill="${CREAM}"/>`,
    },
    'im-before': {
      bg: '#C7A23A', ink: INK,
      art: `
        <path d="M60 30h80M60 178h80" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
        <path d="M68 34c0 40 32 50 32 70s-32 30-32 70h64c0-40-32-50-32-70s32-30 32-70Z" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
        <path d="M80 56h40c-4 14-20 22-20 22s-16-8-20-22Z" fill="${RED}"/>
        <path d="M78 170c4-14 14-22 22-26 8 4 18 12 22 26Z" fill="${RED}"/>`,
    },
    'im-world': {
      bg: '#2B2B2B', ink: CREAM,
      art: `
        <circle cx="100" cy="118" r="44" fill="${CREAM}"/>
        <ellipse cx="100" cy="118" rx="80" ry="18" fill="none" stroke="${CREAM}" stroke-width="5" transform="rotate(-14 100 118)"/>
        <path d="M100 74V40" stroke="${CREAM}" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
        <circle cx="100" cy="30" r="12" fill="${RED}"/><path d="M100 18c2-6 6-8 10-8" stroke="#9ED7A5" stroke-width="3" stroke-linecap="round"/>`,
    },
    'im-sound': {
      bg: '#8E2D5C', ink: CREAM,
      art: `
        <path d="M56 116a44 44 0 0 1 88 0" fill="none" stroke="${CREAM}" stroke-width="10" stroke-linecap="round"/>
        <rect x="40" y="110" width="28" height="48" rx="12" fill="${CREAM}"/><rect x="132" y="110" width="28" height="48" rx="12" fill="${CREAM}"/>
        <path d="M84 132c4 6 4 14 0 20M100 124c8 10 8 26 0 36M116 116c12 14 12 38 0 52" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round" transform="translate(-6 0)"/>`,
    },
    'im-reverse': {
      bg: '#5E9C84', ink: INK,
      art: `
        <path d="M150 150H78a40 40 0 0 1 0-80h70" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
        <path d="M132 52l20 18-20 18" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="156" cy="150" r="14" fill="${RED}"/>
        <text x="26" y="186" ${SERIF} font-style="italic" font-size="16" fill="${INK}">конец → начало</text>`,
    },
    'im-scale': {
      bg: '#C25B6E', ink: CREAM,
      art: `
        <path d="M30 168l18-16 18 16v18H30Z" fill="${CREAM}"/>
        <circle cx="118" cy="92" r="52" fill="none" stroke="${CREAM}" stroke-width="9"/>
        <path d="M156 130l28 28" stroke="${CREAM}" stroke-width="13" stroke-linecap="round"/>
        <path d="M92 110l26-24 26 24v26H92Z" fill="${INK}"/><rect x="112" y="116" width="12" height="20" fill="${RED}"/>`,
    },
    'im-versions': {
      bg: '#6B6B2E', ink: CREAM,
      art: `
        ${[[42, 'M30 112c6 8 18 8 24 0'], [100, 'M86 114c5-5 9 5 14 0s9 5 14 0'], [158, '']].map(([x, d]) =>
          `<circle cx="${x}" cy="100" r="30" fill="${CREAM}"/><circle cx="${x - 10}" cy="92" r="4" fill="${INK}"/><circle cx="${x + 10}" cy="92" r="4" fill="${INK}"/>` +
          (d ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` : '')).join('')}
        <path d="M158 122c-8-5-12-9-12-13a5 5 0 0 1 12-2 5 5 0 0 1 12 2c0 4-4 8-12 13Z" fill="${RED}"/>
        <text x="100" y="164" text-anchor="middle" ${SERIF} font-style="italic" font-size="15" fill="${CREAM}">смешно · тревожно · трогательно</text>`,
    },
  });

  const fallback = { bg: '#3B3B3B', ink: CREAM, art: `<circle cx="100" cy="100" r="54" fill="none" stroke="${CREAM}" stroke-width="7"/>` };

  // Малая «С» для корешка: та же петля, что в логотипе, точки прорежены.
  const MARK = 'M13.25 16.31 L12.86 16.74 L12.49 17.18 L12.10 17.60 L11.68 17.97 L11.18 18.26 L10.60 18.49 L9.99 18.67 L9.36 18.77 L8.73 18.80 L8.06 18.74 L7.37 18.60 L6.69 18.38 L6.07 18.08 L5.55 17.69 L5.09 17.20 L4.70 16.63 L4.36 16.02 L4.10 15.41 L3.93 14.83 L3.81 14.23 L3.76 13.62 L3.75 13.00 L3.79 12.40 L3.87 11.78 L4.01 11.16 L4.20 10.56 L4.44 9.99 L4.75 9.43 L5.12 8.88 L5.54 8.37 L6.00 7.92 L6.51 7.57 L7.09 7.28 L7.71 7.06 L8.34 6.91 L8.96 6.83 L9.52 6.85 L10.07 6.95 L10.62 7.09 L11.17 7.23 L11.70 7.33 L12.21 7.44 L12.71 7.54 L13.21 7.61 L13.70 7.62 L14.17 7.58 L14.65 7.49 L15.10 7.36 L15.53 7.17 L15.93 6.91 L16.34 6.56 L16.72 6.15 L17.02 5.70 L17.20 5.25 L17.25 4.78 L17.21 4.26 L17.08 3.74 L16.87 3.29 L16.60 2.95 L16.22 2.66 L15.77 2.43 L15.29 2.28 L14.83 2.20 L14.36 2.22 L13.88 2.33 L13.40 2.51 L12.98 2.74 L12.63 3.04 L12.33 3.42 L12.08 3.87 L11.89 4.34 L11.78 4.80 L11.76 5.25 L11.81 5.72 L11.92 6.19 L12.05 6.63 L12.18 6.99 L12.32 7.28 L12.48 7.54 L12.64 7.81 L12.80 8.07 L12.80 8.07';

  function get(id) { return covers[id] || fallback; }
  function art(id) {
    return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${get(id).art}</svg>`;
  }
  function mark(color) {
    return `<svg viewBox="0 0 21 21" aria-hidden="true" focusable="false"><path d="${MARK}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/></svg>`;
  }
  // Красная «С» теряется на красноватом корешке — там она цветом надписи.
  function markFor(id) {
    const c = get(id), hex = c.bg.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return mark(r > g * 1.35 && r > b * 1.35 ? c.ink : RED);
  }
  return { get, art, mark, markFor, RED };
})();
