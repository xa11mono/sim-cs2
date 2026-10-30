(() => {
'use strict';
/* =====================================================================
   v26 · Кубки и награды (в стиле HLTV)
   1) TW — генератор кубков в SVG. У каждой серии турниров своя форма
      (по названию: стекло-призма, кубок с ручками, шпиль, сфера, звезда,
      щит, тарелка, пламя, слитки, корона …). Каждый новый розыгрыш той же
      серии — чуть другой: металл, пропорции, детали. Без логотипов.
   2) Медаль MVP (со счётчиком), плашка «топ-20 года», статуэтки
      «лучший рифлер / снайпер / IGL / новичок года», корона «команда года».
   3) Учёт наград игроков (отдельный ключ localStorage) и вывод:
      полоса трофеев у команды и у игрока, подсказка с крупным кубком.
   Хуки: оборачивает window.hubArchiveTier1, window.hubArchiveParallel,
   finalizeTournamentRating, window.showHistory, window.hubOpenPlayer.
   ===================================================================== */

/* ------------------------------------------------------------ числа */
function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const jit = (r, v, p) => v * (1 + (r() * 2 - 1) * p);
const n = v => Math.round(v * 100) / 100;
function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function rgb2hex(c) { return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lighten = (c, t) => mix(c, '#ffffff', t), darken = (c, t) => mix(c, '#000000', t);

/* ------------------------------------------------------- материалы */
// 6 тонов «цилиндра»: тень · полутон · свет · блик · полутон · тень
const METALS = {
  gold:     ['#3d2706', '#9c6d1b', '#e9c25a', '#fff3c4', '#cf9a33', '#5c3d0c'],
  palegold: ['#4a3a14', '#a8913f', '#eadc93', '#fffbe3', '#c9b25c', '#6a5520'],
  silver:   ['#2f343a', '#848d97', '#d7dde3', '#ffffff', '#a9b2bb', '#4a525b'],
  chrome:   ['#1d2733', '#6c8197', '#c9dbec', '#f7fbff', '#8ea7bf', '#2f3e4e'],
  bronze:   ['#3a1d0b', '#93532a', '#e0a06a', '#ffe0c2', '#b06a36', '#552a12'],
  rose:     ['#43231d', '#a8695b', '#efb7a6', '#fff0ea', '#c4806f', '#62342b'],
  gunmetal: ['#0b0d10', '#33383f', '#7d8590', '#d7dce2', '#4a5058', '#15181c'],
  copper:   ['#3a1608', '#9a4a22', '#e58a55', '#ffd3b4', '#b85d2c', '#57220d']
};
const GLASS = {
  ice:    '#cfe9ff', blue:  '#4f9dff', violet: '#9a7bff', smoke: '#8d9aad',
  amber:  '#ffc75a', mint:  '#4fe0b0', ruby:   '#ff5a6e', cyan:  '#3fd6ff'
};
const ENAMEL = ['#d23b3b', '#2f6fe0', '#1f9e6e', '#7a3fd0', '#e08a1f', '#0fa3b8', '#e2e2e2', '#111418'];
const BASEMAT = {
  black:  ['#3a3f47', '#17191d', '#08090b'],
  wood:   ['#8a5a34', '#53301a', '#26140a'],
  marble: ['#f4f5f7', '#c6cbd1', '#868d95'],
  navy:   ['#33476b', '#1a2740', '#0a1222'],
  stone:  ['#8d8a84', '#57544f', '#2c2a27']
};

/* ------------------------------------------------- сборщик <defs> */
let UID = 0;
function Defs() { this.id = 'tw' + (++UID).toString(36) + '_'; this.k = 0; this.out = []; this.cache = {}; }
Defs.prototype.lg = function (key, x1, y1, x2, y2, stops) {
  if (this.cache[key]) return this.cache[key];
  const id = this.id + 'g' + (this.k++);
  this.out.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"${s[2] != null ? ` stop-opacity="${s[2]}"` : ''}/>`).join('') + '</linearGradient>');
  return (this.cache[key] = `url(#${id})`);
};
Defs.prototype.rg = function (key, cx, cy, r, stops) {
  if (this.cache[key]) return this.cache[key];
  const id = this.id + 'g' + (this.k++);
  this.out.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">` +
    stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"${s[2] != null ? ` stop-opacity="${s[2]}"` : ''}/>`).join('') + '</radialGradient>');
  return (this.cache[key] = `url(#${id})`);
};
Defs.prototype.clip = function (d) { const id = this.id + 'c' + (this.k++); this.out.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`); return `url(#${id})`; };
// металл вдоль (цилиндр), сверху вниз (плоскость), шаром
Defs.prototype.mH = function (m) { const c = METALS[m] || METALS.silver; return this.lg('mH' + m, 0, 0, 1, 0, [[0, c[0]], [.16, c[1]], [.36, c[2]], [.46, c[3]], [.62, c[4]], [1, c[5]]]); };
Defs.prototype.mD = function (m) { const c = METALS[m] || METALS.silver; return this.lg('mD' + m, 0, 0, 1, 0, [[0, c[5]], [.4, c[1]], [.75, c[4]], [1, c[0]]]); };
Defs.prototype.mV = function (m) { const c = METALS[m] || METALS.silver; return this.lg('mV' + m, 0, 0, 0, 1, [[0, c[3]], [.35, c[2]], [1, c[1]]]); };
Defs.prototype.mR = function (m) { const c = METALS[m] || METALS.silver; return this.rg('mR' + m, .36, .3, .78, [[0, c[3]], [.25, c[2]], [.7, c[4]], [1, c[5]]]); };
Defs.prototype.glassA = function (t) { return this.lg('gA' + t, 0, 0, 1, 1, [[0, lighten(t, .75), .92], [.45, t, .55], [1, darken(t, .25), .75]]); };
Defs.prototype.glassB = function (t) { return this.lg('gB' + t, 1, 0, 0, 1, [[0, darken(t, .15), .85], [.55, darken(t, .35), .6], [1, darken(t, .55), .85]]); };
Defs.prototype.glassR = function (t) { return this.rg('gR' + t, .35, .3, .8, [[0, '#ffffff', .95], [.25, lighten(t, .5), .75], [.75, t, .55], [1, darken(t, .45), .9]]); };
Defs.prototype.base = function (mat) { const c = BASEMAT[mat] || BASEMAT.black; return this.lg('b' + mat, 0, 0, 0, 1, [[0, c[0]], [.25, c[1]], [1, c[2]]]); };
Defs.prototype.baseH = function (mat) { const c = BASEMAT[mat] || BASEMAT.black; return this.lg('bH' + mat, 0, 0, 1, 0, [[0, c[2]], [.3, c[1]], [.45, c[0]], [.7, c[1]], [1, c[2]]]); };
Defs.prototype.enamel = function (c) { return this.lg('e' + c, 0, 0, 0, 1, [[0, lighten(c, .35)], [.5, c], [1, darken(c, .35)]]); };
Defs.prototype.shadow = function () { return this.rg('sh', .5, .5, .5, [[0, '#000', .55], [1, '#000', 0]]); };
Defs.prototype.svg = function (body, vb, extra) {
  return `<svg class="tw-svg" viewBox="${vb || '5 1 54 71'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${extra || ''}><defs>${this.out.join('')}</defs>${body}</svg>`;
};

/* ------------------------------------------------- значки (24×24) */
const ICONS = {
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z',
  chevron: 'M3 6l9 6 9-6v5l-9 6-9-6z M3 14l9 6 9-6',
  cross: 'M4 4l16 16 M20 4L4 20',
  crosshair: 'M12 3v6 M12 15v6 M3 12h6 M15 12h6 M12 7a5 5 0 1 0 .01 0',
  scope: 'M12 4a8 8 0 1 0 .01 0 M12 1v6 M12 17v6 M1 12h6 M17 12h6',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  sprout: 'M12 22V11 M12 12C12 7 8 4 3 4c0 5 4 8 9 8 M12 14c0-4 3-7 8-7 0 4-3 7-8 7',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  laurel: 'M7 20c-3-3-4-8-2-13 M17 20c3-3 4-8 2-13 M5 10l2 1 M4 14l2.5.5 M19 10l-2 1 M20 14l-2.5.5',
  diamond: 'M12 2l7 10-7 10-7-10z'
};
function icon(name, x, y, s, attrs) {
  const k = s / 24;
  return `<path d="${ICONS[name] || ICONS.star}" transform="translate(${n(x - s / 2)} ${n(y - s / 2)}) scale(${n(k)})" ${attrs}/>`;
}
function starPts(cx, cy, R, r, k) {
  const p = []; k = k || 5;
  for (let i = 0; i < k * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / k, rr = i % 2 ? r : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return p;
}
// объёмная звезда: каждый луч — светлая и тёмная половина
function bevelStar(d, metal, cx, cy, R, r) {
  const p = starPts(cx, cy, R, r), lt = d.mV(metal), dk = d.mD(metal);
  let s = '';
  for (let i = 0; i < 10; i++) {
    const a = p[i], b = p[(i + 1) % 10];
    s += `<path d="M${n(cx)} ${n(cy)}L${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}Z" fill="${i % 2 ? dk : lt}"/>`;
  }
  return s;
}

/* -------------------------------------------------------- подставка */
// возвращает {svg, top} — top: y, на котором стоит кубок
function drawBase(d, sp) {
  const b = sp.base, cx = 32, mat = b.mat, bw = b.w;
  let s = `<ellipse cx="32" cy="70" rx="${n(bw * .62)}" ry="1.8" fill="${d.shadow()}"/>`;
  const plaque = (y, w) => `<rect x="${n(cx - w / 2)}" y="${n(y)}" width="${n(w)}" height="2.6" rx=".4" fill="${d.mH(sp.plaque)}"/>`;
  if (b.type === 'round') {
    s += `<path d="M${n(cx - bw / 2)} 61v6.2a${n(bw / 2)} 2 0 0 0 ${n(bw)} 0V61z" fill="${d.baseH(mat)}"/>` +
      `<ellipse cx="32" cy="61" rx="${n(bw / 2)}" ry="2" fill="${d.base(mat)}"/>` +
      `<ellipse cx="32" cy="61" rx="${n(bw / 2 - .4)}" ry="1.6" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".5"/>` +
      `<path d="M${n(cx - bw / 2)} 63.4a${n(bw / 2)} 2 0 0 0 ${n(bw)} 0" fill="none" stroke="${d.mH(sp.plaque)}" stroke-width=".9"/>`;
    return { svg: s, top: 60.5 };
  }
  if (b.type === 'slab') {
    s += `<path d="M${n(cx - bw / 2)} 69L${n(cx - bw / 2 + 2)} 58H${n(cx + bw / 2 - 2)}L${n(cx + bw / 2)} 69z" fill="${d.base(mat)}"/>` +
      `<path d="M${n(cx - bw / 2 + 2)} 58H${n(cx + bw / 2 - 2)}" stroke="#fff" stroke-opacity=".28" stroke-width=".6"/>` + plaque(63.2, bw * .42);
    return { svg: s, top: 58 };
  }
  if (b.type === 'block') {
    s += `<rect x="${n(cx - bw / 2)}" y="56" width="${n(bw)}" height="13" rx="1" fill="${d.base(mat)}"/>` +
      `<rect x="${n(cx - bw / 2)}" y="56" width="${n(bw)}" height="13" rx="1" fill="${d.baseH(mat)}" opacity=".35"/>` +
      `<path d="M${n(cx - bw / 2 + 1)} 56.4H${n(cx + bw / 2 - 1)}" stroke="#fff" stroke-opacity=".3" stroke-width=".6"/>` + plaque(61.6, bw * .5);
    return { svg: s, top: 56 };
  }
  // step — две ступени
  s += `<rect x="${n(cx - bw / 2)}" y="63" width="${n(bw)}" height="6.2" rx=".6" fill="${d.base(mat)}"/>` +
    `<rect x="${n(cx - bw * .37)}" y="58.4" width="${n(bw * .74)}" height="4.8" rx=".5" fill="${d.base(mat)}"/>` +
    `<path d="M${n(cx - bw / 2 + .6)} 63.3H${n(cx + bw / 2 - .6)}M${n(cx - bw * .37 + .5)} 58.7H${n(cx + bw * .37 - .5)}" stroke="#fff" stroke-opacity=".25" stroke-width=".55"/>` +
    plaque(64.8, bw * .44);
  return { svg: s, top: 58.4 };
}

/* ---------------------------------------------------------- формы */
const ARCH = {};

ARCH.cup = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, W = jit(r, sp.big ? 33 : 29, .1), D = jit(r, sp.big ? 21 : 18, .12);
  const stemH = jit(r, sp.big ? 7 : 9, .25), fw = W * jit(r, .56, .12);
  const by = top - 3.2 - stemH - D, bb = by + D;
  let s = '';
  // ручки — позади чаши
  const hw = jit(r, 7, .25), hs = d.mH(m);
  if (sp.handles === 'loop') {
    s += `<path d="M${n(cx - W / 2 + 1.2)} ${n(by + D * .12)}C${n(cx - W / 2 - hw)} ${n(by + D * .02)} ${n(cx - W / 2 - hw)} ${n(by + D * .72)} ${n(cx - W * .2)} ${n(by + D * .82)}" fill="none" stroke="${hs}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M${n(cx + W / 2 - 1.2)} ${n(by + D * .12)}C${n(cx + W / 2 + hw)} ${n(by + D * .02)} ${n(cx + W / 2 + hw)} ${n(by + D * .72)} ${n(cx + W * .2)} ${n(by + D * .82)}" fill="none" stroke="${d.mD(m)}" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (sp.handles === 'wing') {
    s += `<path d="M${n(cx - W / 2 + 1)} ${n(by + D * .1)}C${n(cx - W / 2 - hw * 1.3)} ${n(by - D * .25)} ${n(cx - W / 2 - hw * .6)} ${n(by + D * .6)} ${n(cx - W * .22)} ${n(by + D * .7)}L${n(cx - W * .3)} ${n(by + D * .45)}C${n(cx - W / 2 - hw * .2)} ${n(by + D * .4)} ${n(cx - W / 2 - hw * .5)} ${n(by + D * .05)} ${n(cx - W / 2 + 1)} ${n(by + D * .25)}z" fill="${hs}"/>` +
      `<path d="M${n(cx + W / 2 - 1)} ${n(by + D * .1)}C${n(cx + W / 2 + hw * 1.3)} ${n(by - D * .25)} ${n(cx + W / 2 + hw * .6)} ${n(by + D * .6)} ${n(cx + W * .22)} ${n(by + D * .7)}L${n(cx + W * .3)} ${n(by + D * .45)}C${n(cx + W / 2 + hw * .2)} ${n(by + D * .4)} ${n(cx + W / 2 + hw * .5)} ${n(by + D * .05)} ${n(cx + W / 2 - 1)} ${n(by + D * .25)}z" fill="${d.mD(m)}"/>`;
  } else if (sp.handles === 'angular') {
    s += `<path d="M${n(cx - W / 2 + 1)} ${n(by + D * .15)}H${n(cx - W / 2 - hw * .8)}V${n(by + D * .5)}L${n(cx - W * .25)} ${n(by + D * .8)}" fill="none" stroke="${hs}" stroke-width="2.1" stroke-linejoin="round"/>` +
      `<path d="M${n(cx + W / 2 - 1)} ${n(by + D * .15)}H${n(cx + W / 2 + hw * .8)}V${n(by + D * .5)}L${n(cx + W * .25)} ${n(by + D * .8)}" fill="none" stroke="${d.mD(m)}" stroke-width="2.1" stroke-linejoin="round"/>`;
  }
  // ножка и стопа
  s += `<path d="M${n(cx - fw / 2)} ${n(top)}H${n(cx + fw / 2)}L${n(cx + fw * .16)} ${n(top - 3.2)}H${n(cx - fw * .16)}z" fill="${d.mH(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(top)}" rx="${n(fw / 2)}" ry=".9" fill="${d.mD(m)}"/>` +
    `<rect x="${n(cx - 1.7)}" y="${n(bb - .5)}" width="3.4" height="${n(stemH + 1)}" fill="${d.mH(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(bb + stemH * .5)}" rx="${n(jit(r, 3.4, .2))}" ry="1.5" fill="${d.mH(m)}"/>`;
  // чаша
  const bowl = `M${n(cx - W / 2)} ${n(by)}C${n(cx - W / 2)} ${n(by + D * .78)} ${n(cx - W * .2)} ${n(bb)} ${n(cx - W * .11)} ${n(bb)}H${n(cx + W * .11)}C${n(cx + W * .2)} ${n(bb)} ${n(cx + W / 2)} ${n(by + D * .78)} ${n(cx + W / 2)} ${n(by)}z`;
  s += `<path d="${bowl}" fill="${d.mH(m)}"/>`;
  if (sp.band) {
    const cl = d.clip(bowl);
    s += `<g clip-path="${cl}"><rect x="0" y="${n(by + D * .3)}" width="64" height="${n(D * .15)}" fill="${sp.bandMetal ? d.mH(sp.bandMetal) : d.enamel(sp.accent)}"/>` +
      `<rect x="0" y="${n(by + D * .3)}" width="64" height=".5" fill="#fff" opacity=".35"/></g>`;
  }
  if (sp.emblem) s += `<g opacity=".9">${icon(sp.emblem, cx, by + D * .55, D * .42, `fill="${d.mD(sp.metal2 || m)}" stroke="${METALS[m][3]}" stroke-width=".6" stroke-opacity=".6"`)}</g>`;
  // блик
  s += `<path d="M${n(cx - W * .33)} ${n(by + 1.6)}C${n(cx - W * .32)} ${n(by + D * .55)} ${n(cx - W * .22)} ${n(by + D * .8)} ${n(cx - W * .13)} ${n(by + D * .9)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>`;
  // край и крышка
  s += `<ellipse cx="${cx}" cy="${n(by)}" rx="${n(W / 2)}" ry="${n(W * .075)}" fill="${d.mD(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(by + .25)}" rx="${n(W / 2 - 1.1)}" ry="${n(W * .055)}" fill="${darken(METALS[m][1], .35)}"/>`;
  if (sp.lid) {
    const lw = W * .43;
    s += `<path d="M${n(cx - lw)} ${n(by)}A${n(lw)} ${n(lw * .62)} 0 0 1 ${n(cx + lw)} ${n(by)}z" fill="${d.mR(m)}"/>` +
      `<rect x="${n(cx - .9)}" y="${n(by - lw * .62 - 2.5)}" width="1.8" height="3" fill="${d.mH(m)}"/>`;
    const fy = by - lw * .62 - 4.2;
    s += sp.finial === 'star' ? bevelStar(d, sp.metal2 || m, cx, fy, 3.6, 1.5) : `<circle cx="${cx}" cy="${n(fy + .8)}" r="2.2" fill="${d.mR(sp.metal2 || m)}"/>`;
  }
  return s;
};

ARCH.chalice = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, W = jit(r, 22, .14), D = jit(r, 17, .15), stemH = jit(r, 15, .2), fw = jit(r, 20, .15);
  const bb = top - 4 - stemH, by = bb - D;
  let s = `<path d="M${n(cx - fw / 2)} ${n(top)}Q${cx} ${n(top - 9)} ${n(cx + fw / 2)} ${n(top)}z" fill="${d.mH(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(top)}" rx="${n(fw / 2)}" ry=".9" fill="${d.mD(m)}"/>` +
    `<rect x="${n(cx - 1.3)}" y="${n(bb - .5)}" width="2.6" height="${n(stemH + 1)}" fill="${d.mH(m)}"/>`;
  const knots = sp.variant === 'twin' ? [.3, .7] : [.45];
  knots.forEach(k => { s += `<ellipse cx="${cx}" cy="${n(bb + stemH * k)}" rx="${n(jit(r, 3.6, .2))}" ry="1.9" fill="${d.mR(m)}"/>`; });
  const bowl = `M${n(cx - W / 2)} ${n(by)}H${n(cx + W / 2)}C${n(cx + W / 2 - 1)} ${n(by + D * .62)} ${n(cx + 3.2)} ${n(bb)} ${n(cx + 1.4)} ${n(bb)}H${n(cx - 1.4)}C${n(cx - 3.2)} ${n(bb)} ${n(cx - W / 2 + 1)} ${n(by + D * .62)} ${n(cx - W / 2)} ${n(by)}z`;
  s += `<path d="${bowl}" fill="${d.mH(m)}"/>`;
  const cl = d.clip(bowl), fac = sp.facets;
  if (fac) { s += `<g clip-path="${cl}" stroke="#000" stroke-opacity=".22" stroke-width=".5">`; for (let i = 1; i < fac; i++) { const x = cx - W / 2 + W * i / fac; s += `<path d="M${n(x)} ${n(by)}L${n(cx + (x - cx) * .12)} ${n(bb)}"/>`; } s += '</g>'; }
  if (sp.band) s += `<g clip-path="${cl}"><rect x="0" y="${n(by + 2.2)}" width="64" height="2.2" fill="${d.mH(sp.metal2 || 'gold')}"/></g>`;
  s += `<path d="M${n(cx - W * .3)} ${n(by + 1.5)}L${n(cx - 2.2)} ${n(bb - 1)}" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/>` +
    `<ellipse cx="${cx}" cy="${n(by)}" rx="${n(W / 2)}" ry="${n(W * .08)}" fill="${d.mD(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(by + .2)}" rx="${n(W / 2 - 1)}" ry="${n(W * .055)}" fill="${darken(METALS[m][1], .4)}"/>`;
  // камень на ножке
  const gy = bb + stemH * knots[0];
  s += `<circle cx="${cx}" cy="${n(gy)}" r="1.6" fill="${d.glassR(sp.gem)}"/><circle cx="${n(cx - .5)}" cy="${n(gy - .5)}" r=".45" fill="#fff" opacity=".9"/>`;
  return s;
};

ARCH.prism = (d, r, sp, top) => {
  const cx = 32, t = sp.glass, edge = 'stroke="#fff" stroke-opacity=".6" stroke-width=".55" stroke-linejoin="round"';
  const frame = sp.frame ? `stroke="${d.mH(sp.frame)}" stroke-width="1.1" stroke-linejoin="round" fill="none"` : '';
  const shard = (ax, ay, w, yb, k) => {
    const bl = ax - w * (1 + k), br = ax + w * (1 - k * .4), rx = ax + w * .18;
    const f1 = `M${n(ax)} ${n(ay)}L${n(bl)} ${n(yb)}H${n(rx)}z`, f2 = `M${n(ax)} ${n(ay)}L${n(rx)} ${n(yb)}H${n(br)}z`;
    return `<path d="${f1}" fill="${d.glassA(t)}" ${edge}/><path d="${f2}" fill="${d.glassB(t)}" ${edge}/>` +
      `<path d="M${n(ax - .6)} ${n(ay + 4)}L${n(ax - w * .45)} ${n(yb - 2)}" stroke="#fff" stroke-opacity=".75" stroke-width=".7"/>` +
      (frame ? `<path d="M${n(ax)} ${n(ay)}L${n(bl)} ${n(yb)}H${n(br)}z" ${frame}/>` : '');
  };
  let s = '';
  if (sp.variant === 'twin') {
    s += shard(cx - 6, jit(r, 16, .15), 8, top, .1) + shard(cx + 3, jit(r, 6, .2), 11.5, top, .05);
  } else if (sp.variant === 'trio') {
    s += shard(cx - 9, jit(r, 22, .12), 6.5, top, .15) + shard(cx + 9, jit(r, 20, .12), 6.5, top, -.2) + shard(cx, jit(r, 7, .2), 9, top, 0);
  } else if (sp.variant === 'inv') {
    const yt = jit(r, 11, .15), w = jit(r, 14, .12), yp = top - 9;
    s += `<rect x="${n(cx - 1.3)}" y="${n(yp)}" width="2.6" height="${n(top - yp)}" fill="${d.mH(sp.frame || 'silver')}"/>` +
      `<path d="M${n(cx - w)} ${n(yt)}H${n(cx + 3)}L${cx} ${n(yp)}z" fill="${d.glassA(t)}" ${edge}/>` +
      `<path d="M${n(cx + 3)} ${n(yt)}H${n(cx + w)}L${cx} ${n(yp)}z" fill="${d.glassB(t)}" ${edge}/>` +
      `<path d="M${n(cx - w)} ${n(yt)}L${n(cx - w + 4)} ${n(yt - 3)}H${n(cx + w + 2)}L${n(cx + w)} ${n(yt)}z" fill="${lighten(t, .6)}" fill-opacity=".8" ${edge}/>` +
      (frame ? `<path d="M${n(cx - w)} ${n(yt)}H${n(cx + w)}L${cx} ${n(yp)}z" ${frame}/>` : '');
  } else {
    s += shard(cx + jit(r, 0, 1) * 0, jit(r, 5, .3), jit(r, 13, .1), top, .05);
  }
  if (sp.core) s += `<g opacity=".85">${icon('diamond', cx + (sp.variant === 'twin' ? 3 : 0), top - 18, 7, `fill="${d.glassR(sp.coreTint)}" stroke="#fff" stroke-width=".8" stroke-opacity=".7"`)}</g>`;
  return s;
};

ARCH.spire = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, w = jit(r, 8.5, .15), ay = jit(r, 5, .4), yb = top - .3, mid = cx + w * .12;
  const one = (x, ww, ay2, mm) => `<path d="M${n(x)} ${n(ay2)}L${n(x - ww)} ${n(yb)}H${n(x + ww * .12)}z" fill="${d.mV(mm)}"/>` +
    `<path d="M${n(x)} ${n(ay2)}L${n(x + ww * .12)} ${n(yb)}H${n(x + ww)}z" fill="${d.mD(mm)}"/>` +
    `<path d="M${n(x)} ${n(ay2)}L${n(x + ww * .12)} ${n(yb)}" stroke="#fff" stroke-opacity=".55" stroke-width=".5"/>`;
  let s = '';
  if (sp.variant === 'twin') s += one(cx - 7, w * .7, ay + 12, sp.metal2 || m) + one(cx + 2, w, ay, m);
  else s += one(cx, w, ay, m);
  if (sp.ring) {
    const ry = ay + (yb - ay) * .58, rw = w * 1.35;
    s += `<ellipse cx="${n(mid)}" cy="${n(ry)}" rx="${n(rw)}" ry="2.2" fill="none" stroke="${d.mH(sp.metal2 || 'gold')}" stroke-width="1.6"/>`;
  }
  if (sp.engr) for (let i = 1; i <= 3; i++) { const y = yb - i * 4; const hw = w * (y - ay) / (yb - ay); s += `<path d="M${n(cx - hw)} ${n(y)}H${n(cx + hw)}" stroke="#000" stroke-opacity=".25" stroke-width=".5"/>`; }
  if (sp.gemTop) s += `<circle cx="${cx}" cy="${n(ay - 1.5)}" r="2.2" fill="${d.glassR(sp.gem)}"/>`;
  return s;
};

ARCH.orb = (d, r, sp, top) => {
  const cx = 32, R = jit(r, 13, .1), cy = top - 7 - R, m = sp.metal;
  let s = `<rect x="${n(cx - 1.6)}" y="${n(cy + R * .6)}" width="3.2" height="${n(top - cy - R * .6)}" fill="${d.mH(m)}"/>` +
    `<path d="M${n(cx - 7)} ${n(top - 1)}Q${cx} ${n(top - 6)} ${n(cx + 7)} ${n(top - 1)}z" fill="${d.mH(m)}"/>`;
  const sphere = sp.glassOrb ? d.glassR(sp.glass) : d.mR(m);
  s += `<circle cx="${cx}" cy="${n(cy)}" r="${n(R)}" fill="${sphere}"/>`;
  if (sp.globe) {
    const st = `fill="none" stroke="${sp.glassOrb ? '#fff' : '#000'}" stroke-opacity="${sp.glassOrb ? .45 : .28}" stroke-width=".55"`;
    s += `<ellipse cx="${cx}" cy="${n(cy)}" rx="${n(R * .45)}" ry="${n(R)}" ${st}/><ellipse cx="${cx}" cy="${n(cy)}" rx="${n(R)}" ry="${n(R * .32)}" ${st}/>` +
      `<path d="M${cx} ${n(cy - R)}V${n(cy + R)}" ${st}/>`;
  }
  if (sp.ring) s += `<ellipse cx="${cx}" cy="${n(cy)}" rx="${n(R * 1.38)}" ry="${n(R * .34)}" transform="rotate(-16 ${cx} ${n(cy)})" fill="none" stroke="${d.mH(sp.metal2 || 'gold')}" stroke-width="1.5"/>`;
  // «ладони» держателя
  s += `<path d="M${n(cx - R * .7)} ${n(cy + R * .72)}Q${cx} ${n(cy + R * 1.25)} ${n(cx + R * .7)} ${n(cy + R * .72)}" fill="none" stroke="${d.mH(m)}" stroke-width="1.6"/>` +
    `<ellipse cx="${n(cx - R * .38)}" cy="${n(cy - R * .42)}" rx="${n(R * .22)}" ry="${n(R * .13)}" transform="rotate(-35 ${n(cx - R * .38)} ${n(cy - R * .42)})" fill="#fff" opacity=".55"/>`;
  return s;
};

ARCH.star = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, colH = jit(r, 15, .2), R = jit(r, 12, .1), cy = top - colH - R * .55;
  let s = `<path d="M${n(cx - 4.5)} ${n(top)}H${n(cx + 4.5)}L${n(cx + 2.6)} ${n(top - colH)}H${n(cx - 2.6)}z" fill="${d.mH(sp.metal2 || m)}"/>` +
    `<path d="M${n(cx - 4.5)} ${n(top - 3)}H${n(cx + 4.5)}" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>`;
  if (sp.ring) s += `<circle cx="${cx}" cy="${n(cy)}" r="${n(R * 1.18)}" fill="none" stroke="${d.mH(sp.metal2 || m)}" stroke-width="1.5"/>`;
  s += bevelStar(d, m, cx, cy, R, R * jit(r, .42, .1));
  if (sp.gem) s += `<circle cx="${cx}" cy="${n(cy)}" r="2" fill="${d.glassR(sp.gem)}"/>`;
  return s;
};

ARCH.shield = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, w = jit(r, 13, .1), y0 = jit(r, 12, .2), y1 = top - 8;
  const sh = `M${n(cx - w)} ${n(y0)}H${n(cx + w)}V${n(y0 + (y1 - y0) * .42)}C${n(cx + w)} ${n(y1 - 6)} ${n(cx + 5)} ${n(y1 - 2)} ${cx} ${n(y1)}C${n(cx - 5)} ${n(y1 - 2)} ${n(cx - w)} ${n(y1 - 6)} ${n(cx - w)} ${n(y0 + (y1 - y0) * .42)}z`;
  let s = `<path d="M${n(cx - 5)} ${n(top)}H${n(cx + 5)}L${n(cx + 2)} ${n(y1 - 2)}H${n(cx - 2)}z" fill="${d.mH(m)}"/>` +
    `<path d="${sh}" fill="${d.mH(m)}"/>`;
  const cl = d.clip(sh);
  s += `<g clip-path="${cl}"><rect x="${cx}" y="0" width="32" height="72" fill="#000" opacity=".16"/>` +
    (sp.field ? `<path d="M${n(cx - w)} ${n(y0 + 6)}L${cx} ${n(y0 + 14)}L${n(cx + w)} ${n(y0 + 6)}V${n(y0 + 11)}L${cx} ${n(y0 + 19)}L${n(cx - w)} ${n(y0 + 11)}z" fill="${d.enamel(sp.accent)}"/>` : '') + '</g>';
  s += `<path d="${sh}" fill="none" stroke="${d.mV(sp.metal2 || m)}" stroke-width="1.4"/>` +
    `<path d="${sh}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".45" transform="translate(${cx} ${n((y0 + y1) / 2)}) scale(.82) translate(${-cx} ${n(-(y0 + y1) / 2)})"/>`;
  s += icon(sp.emblem || 'star', cx, y0 + (y1 - y0) * .45, 10, `fill="${d.mV(sp.metal2 || m)}" stroke="#000" stroke-opacity=".3" stroke-width=".6"`);
  return s;
};

ARCH.plate = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, R = jit(r, 15.5, .08), cy = top - 2 - R;
  let s = `<path d="M${n(cx - 6)} ${n(top)}L${n(cx - 2)} ${n(cy + R * .4)}H${n(cx + 2)}L${n(cx + 6)} ${n(top)}z" fill="${d.mD('gunmetal')}"/>` +
    `<circle cx="${cx}" cy="${n(cy)}" r="${n(R)}" fill="${d.mR(m)}"/>` +
    `<circle cx="${cx}" cy="${n(cy)}" r="${n(R - .8)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5"/>`;
  (sp.rings || [.78, .55]).forEach(k => { s += `<circle cx="${cx}" cy="${n(cy)}" r="${n(R * k)}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".6"/><circle cx="${cx}" cy="${n(cy + .5)}" r="${n(R * k)}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width=".4"/>`; });
  if (sp.center === 'enamel') s += `<circle cx="${cx}" cy="${n(cy)}" r="${n(R * .36)}" fill="${d.enamel(sp.accent)}"/>`;
  s += icon(sp.emblem || 'star', cx, cy, R * .55, `fill="${d.mV(sp.metal2 || m)}" stroke="#000" stroke-opacity=".3" stroke-width=".7"`);
  if (sp.dots) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s += `<circle cx="${n(cx + Math.cos(a) * R * .89)}" cy="${n(cy + Math.sin(a) * R * .89)}" r=".55" fill="${METALS[m][3]}" opacity=".8"/>`; }
  return s;
};

ARCH.flame = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, yb = top;
  const rib = (x0, amp, h, w, mm, dark) => {
    const p = `M${n(x0 - w)} ${n(yb)}C${n(x0 - w - amp * .2)} ${n(yb - h * .4)} ${n(x0 + amp * 1.2)} ${n(yb - h * .62)} ${n(x0 + amp)} ${n(yb - h)}C${n(x0 + amp * .55)} ${n(yb - h * .6)} ${n(x0 + w + amp * .15)} ${n(yb - h * .4)} ${n(x0 + w)} ${n(yb)}z`;
    return `<path d="${p}" fill="${dark ? d.mD(mm) : d.mH(mm)}"/>`;
  };
  if (sp.variant === 'bolt') {
    const h = jit(r, 48, .1), w = jit(r, 9, .15), y = yb - h;
    const p = `M${n(cx + w * .2)} ${n(y)}L${n(cx - w)} ${n(y + h * .55)}H${n(cx - w * .05)}L${n(cx - w * .6)} ${n(yb)}L${n(cx + w)} ${n(y + h * .4)}H${n(cx + w * .05)}z`;
    return `<path d="${p}" fill="${d.mH(m)}"/><path d="M${n(cx + w * .2)} ${n(y)}L${n(cx - w)} ${n(y + h * .55)}" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>` +
      `<path d="${p}" fill="none" stroke="${d.mD(m)}" stroke-width=".6"/>`;
  }
  return rib(cx - 5, -jit(r, 6, .3), jit(r, 36, .12), 3.4, sp.metal2 || m, true) +
    rib(cx + 5, jit(r, 7, .3), jit(r, 40, .12), 3.4, sp.metal2 || m, true) +
    rib(cx, jit(r, 3, .8), jit(r, 52, .08), 4.6, m, false) +
    `<path d="M${n(cx - 1.5)} ${n(yb - 4)}C${n(cx - 2)} ${n(yb - 20)} ${cx} ${n(yb - 34)} ${n(cx + 1)} ${n(yb - 44)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>`;
};

ARCH.ingot = (d, r, sp, top) => {
  const m = sp.metal;
  const bar = (x, y, w) => {
    const h = 5.2, dpt = 3, k = 2.2;
    return `<path d="M${n(x + k)} ${n(y - h)}H${n(x + w - k)}L${n(x + w - k + dpt)} ${n(y - h - dpt)}H${n(x + k + dpt)}z" fill="${d.mV(m)}"/>` +
      `<path d="M${n(x)} ${n(y)}H${n(x + w)}L${n(x + w - k)} ${n(y - h)}H${n(x + k)}z" fill="${d.mH(m)}"/>` +
      `<path d="M${n(x + w)} ${n(y)}L${n(x + w + dpt)} ${n(y - dpt)}L${n(x + w - k + dpt)} ${n(y - h - dpt)}L${n(x + w - k)} ${n(y - h)}z" fill="${d.mD(m)}"/>` +
      `<rect x="${n(x + w * .32)}" y="${n(y - h * .7)}" width="${n(w * .36)}" height="1.3" fill="#000" opacity=".22"/>`;
  };
  const w = jit(r, 17, .08);
  let s = bar(32 - w - 1.5, top, w) + bar(32 + 1.5, top, w) + bar(32 - w / 2 + 1, top - 5.6, w);
  if (sp.variant === 'tall') s += bar(32 - w / 2 - 1, top - 11.2, w) + (sp.gem ? '' : '');
  if (sp.coin) s += `<ellipse cx="${n(32 + w * .9)}" cy="${n(top - 9)}" rx="4.4" ry="4.4" fill="${d.mR(sp.metal2 || m)}"/>` + bevelStar(d, sp.metal2 || m, 32 + w * .9, top - 9, 2.6, 1.1);
  return s;
};

ARCH.crown = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, v = sp.velvet || '#8e1f2c';
  const cush = `M${n(cx - 17)} ${n(top - 1)}C${n(cx - 19)} ${n(top - 9)} ${n(cx + 19)} ${n(top - 9)} ${n(cx + 17)} ${n(top - 1)}C${n(cx + 10)} ${n(top + 1)} ${n(cx - 10)} ${n(top + 1)} ${n(cx - 17)} ${n(top - 1)}z`;
  let s = `<path d="${cush}" fill="${d.rg('vel' + v, .45, .3, .8, [[0, lighten(v, .35)], [.6, v], [1, darken(v, .5)]])}"/>` +
    `<circle cx="${n(cx - 17)}" cy="${n(top - 1)}" r="1.4" fill="${d.mR('gold')}"/><circle cx="${n(cx + 17)}" cy="${n(top - 1)}" r="1.4" fill="${d.mR('gold')}"/>`;
  const by = top - 6.5, bh = 5.5, w = jit(r, 13, .08), ph = jit(r, 13, .15);
  const pts = sp.points || 5;
  let crown = `M${n(cx - w)} ${n(by)}`;
  for (let i = 0; i <= pts * 2; i++) {
    const x = cx - w + (2 * w) * i / (pts * 2), y = i % 2 ? by - bh - ph * .45 : by - bh - ph;
    crown += `L${n(x)} ${n(y)}`;
  }
  crown += `L${n(cx + w)} ${n(by)}z`;
  s += `<path d="${crown}" fill="${d.mH(m)}"/>` +
    `<rect x="${n(cx - w)}" y="${n(by - bh)}" width="${n(2 * w)}" height="${n(bh)}" fill="${d.mH(m)}"/>` +
    `<path d="M${n(cx - w)} ${n(by - bh)}H${n(cx + w)}" stroke="#fff" stroke-opacity=".5" stroke-width=".5"/>`;
  for (let i = 0; i <= pts * 2; i += 2) {
    const x = cx - w + (2 * w) * i / (pts * 2);
    s += `<circle cx="${n(x)}" cy="${n(by - bh - ph)}" r="1.3" fill="${d.mR(sp.metal2 || 'palegold')}"/>`;
  }
  [-.55, 0, .55].forEach((k, i) => { const g = i === 1 ? sp.gem : sp.gem2; s += `<circle cx="${n(cx + w * k)}" cy="${n(by - bh / 2)}" r="${i === 1 ? 1.9 : 1.3}" fill="${d.glassR(g)}"/>`; });
  return s;
};

ARCH.award = (d, r, sp, top) => { // личная награда: стеклянная пластина с гравировкой на подставке
  const cx = 32, t = sp.glass, w = 12, y0 = jit(r, 7, .1), y1 = top - .5;
  const plate = `M${n(cx - w)} ${n(y0 + 3)}Q${n(cx - w)} ${n(y0)} ${n(cx - w + 3)} ${n(y0)}H${n(cx + w - 3)}Q${n(cx + w)} ${n(y0)} ${n(cx + w)} ${n(y0 + 3)}V${n(y1)}H${n(cx - w)}z`;
  let s = `<path d="${plate}" fill="${d.glassA(t)}" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/>` +
    `<path d="M${n(cx + w * .25)} ${n(y0)}H${n(cx + w - 3)}Q${n(cx + w)} ${n(y0)} ${n(cx + w)} ${n(y0 + 3)}V${n(y1)}H${n(cx + w * .25)}z" fill="${d.glassB(t)}" opacity=".7"/>` +
    `<path d="M${n(cx - w + 2)} ${n(y0 + 4)}L${n(cx - w + 2)} ${n(y1 - 3)}" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/>`;
  s += icon(sp.emblem || 'star', cx, y0 + 16, 17, `fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`);
  s += `<rect x="${n(cx - 7)}" y="${n(y0 + 30)}" width="14" height="1.1" fill="#fff" opacity=".55"/><rect x="${n(cx - 5)}" y="${n(y0 + 33.5)}" width="10" height=".9" fill="#fff" opacity=".4"/>`;
  return s;
};


/* v30: новые силуэты — широкая чаша, обелиск, геометрический многогранник, щит-корона академий */
ARCH.bowl = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, W = jit(r, sp.big ? 42 : 38, .06), D = jit(r, 11, .15), stem = jit(r, 6, .2), by = top - 3 - stem - D;
  let s = `<path d="M${n(cx - 6)} ${n(top)}H${n(cx + 6)}L${n(cx + 2)} ${n(top - 3)}H${n(cx - 2)}z" fill="${d.mH(m)}"/>` +
    `<rect x="${n(cx - 1.6)}" y="${n(by + D - .5)}" width="3.2" height="${n(stem + 1)}" fill="${d.mH(m)}"/>`;
  s += `<path d="M${n(cx - W / 2)} ${n(by)}Q${n(cx - W * .42)} ${n(by + D)} ${cx} ${n(by + D)}Q${n(cx + W * .42)} ${n(by + D)} ${n(cx + W / 2)} ${n(by)}z" fill="${d.mH(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(by)}" rx="${n(W / 2)}" ry="${n(D * .26)}" fill="${d.mD(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(by)}" rx="${n(W / 2 - 1.4)}" ry="${n(D * .2)}" fill="#000" opacity=".28"/>`;
  if (sp.band) s += `<path d="M${n(cx - W * .36)} ${n(by + D * .45)}Q${cx} ${n(by + D * .7)} ${n(cx + W * .36)} ${n(by + D * .45)}" fill="none" stroke="${d.enamel(sp.accent)}" stroke-width="1.6"/>`;
  if (sp.engr) for (let i = -2; i <= 2; i++) s += `<path d="M${n(cx + i * W * .14)} ${n(by + D * .2)}v${n(D * .45)}" stroke="#fff" stroke-opacity=".18" stroke-width=".5"/>`;
  if (sp.emblem) s += bevelStar(d, sp.metal2 || m, cx, by + D * .55, 2.6, 1.1);
  return s;
};
ARCH.obelisk = (d, r, sp, top) => {
  const cx = 32, m = sp.metal, H = jit(r, sp.big ? 44 : 38, .08), w = jit(r, 8, .12), y0 = top - 2;
  let s = `<path d="M${n(cx - w)} ${n(y0)}L${n(cx - w * .55)} ${n(y0 - H)}L${cx} ${n(y0 - H - 6)}L${n(cx + w * .55)} ${n(y0 - H)}L${n(cx + w)} ${n(y0)}z" fill="${d.mH(m)}"/>` +
    `<path d="M${cx} ${n(y0 - H - 6)}L${n(cx + w * .55)} ${n(y0 - H)}L${n(cx + w)} ${n(y0)}H${cx}z" fill="${d.mD(m)}" opacity=".55"/>`;
  const bands = sp.facets ? 3 : 2;
  for (let i = 1; i <= bands; i++) { const y = y0 - H * i / (bands + 1), k = 1 - (i / (bands + 1)) * .45; s += `<rect x="${n(cx - w * k)}" y="${n(y)}" width="${n(w * k * 2)}" height="1.4" fill="${d.mH(sp.bandMetal || sp.metal2 || 'gold')}"/>`; }
  if (sp.gemTop) s += `<circle cx="${cx}" cy="${n(y0 - H - 2.5)}" r="1.8" fill="${d.glassR(sp.gem)}"/>`;
  if (sp.emblem) s += bevelStar(d, sp.metal2 || m, cx, y0 - H * .3, 3, 1.3);
  return s;
};
ARCH.poly = (d, r, sp, top) => { // геометрический многогранник (стекло или металл) на шпиле
  const cx = 32, R = jit(r, 12.5, .08), cy = top - 9 - R, g = sp.glass, glass = !!sp.glassOrb || sp.variant === 'glass';
  let s = `<path d="M${n(cx - 2)} ${n(top)}H${n(cx + 2)}L${n(cx + 1)} ${n(cy + R * .8)}H${n(cx - 1)}z" fill="${d.mH(sp.metal)}"/>` +
    `<path d="M${n(cx - 7)} ${n(top)}H${n(cx + 7)}L${n(cx + 4)} ${n(top - 2.5)}H${n(cx - 4)}z" fill="${d.mH(sp.metal)}"/>`;
  const pts = [[0, -1], [.87, -.5], [.87, .5], [0, 1], [-.87, .5], [-.87, -.5]].map(([x, y]) => [cx + x * R, cy + y * R]);
  const P = i => `${n(pts[i % 6][0])} ${n(pts[i % 6][1])}`;
  const fA = glass ? d.glassA(g) : d.mV(sp.metal), fB = glass ? d.glassB(g) : d.mD(sp.metal);
  for (let i = 0; i < 6; i++) s += `<path d="M${cx} ${n(cy)}L${P(i)}L${P(i + 1)}z" fill="${i % 2 ? fA : fB}" ${glass ? 'opacity=".92"' : ''}/>`;
  s += `<path d="M${P(0)}L${P(1)}L${P(2)}L${P(3)}L${P(4)}L${P(5)}z" fill="none" stroke="${d.mH(sp.frame || sp.metal2 || 'silver')}" stroke-width="1"/>`;
  if (sp.core) s += `<circle cx="${cx}" cy="${n(cy)}" r="${n(R * .28)}" fill="${d.glassR(sp.coreTint)}"/>`;
  return s;
};
ARCH.crest = (d, r, sp, top) => { // академическая награда: щит с лавровой дугой
  const cx = 32, m = sp.metal, W = jit(r, 20, .08), H = jit(r, 24, .08), y = top - 4;
  let s = `<rect x="${n(cx - 1.5)}" y="${n(y - 4)}" width="3" height="4" fill="${d.mH(m)}"/>` +
    `<path d="M${n(cx - W / 2)} ${n(y - 4 - H)}H${n(cx + W / 2)}V${n(y - 4 - H * .45)}Q${n(cx + W / 2)} ${n(y - 6)} ${cx} ${n(y - 4)}Q${n(cx - W / 2)} ${n(y - 6)} ${n(cx - W / 2)} ${n(y - 4 - H * .45)}z" fill="${d.enamel(sp.accent)}" stroke="${d.mH(m)}" stroke-width="1.6"/>`;
  for (let i = 0; i < 5; i++) { const a = Math.PI * (.62 + i * .09), rr = W * .78; s += `<ellipse cx="${n(cx + Math.cos(a) * rr)}" cy="${n(y - 4 - H * .5 + Math.sin(a) * rr * .5)}" rx="2.2" ry=".9" transform="rotate(${n(a * 57 - 60)} ${n(cx + Math.cos(a) * rr)} ${n(y - 4 - H * .5 + Math.sin(a) * rr * .5)})" fill="${d.mH(m)}"/>`;
    const b = Math.PI * (.38 - i * .09); s += `<ellipse cx="${n(cx + Math.cos(b) * rr)}" cy="${n(y - 4 - H * .5 + Math.sin(b) * rr * .5)}" rx="2.2" ry=".9" transform="rotate(${n(b * 57 + 60)} ${n(cx + Math.cos(b) * rr)} ${n(y - 4 - H * .5 + Math.sin(b) * rr * .5)})" fill="${d.mH(m)}"/>`; }
  s += bevelStar(d, sp.metal2 || 'gold', cx, y - 4 - H * .55, 4.2, 1.8);
  return s;
};

/* v33: ещё восемь форм */
ARCH.crown = (d, r, sp, top) => { // корона на подушке-постаменте
  const cx = 32, m = sp.metal, W = jit(r, sp.big ? 34 : 30, .06), H = jit(r, 15, .12), y = top - 8;
  let s = `<path d="M${n(cx - 8)} ${n(top)}H${n(cx + 8)}L${n(cx + 5)} ${n(top - 3)}H${n(cx - 5)}z" fill="${d.mH(m)}"/>` +
    `<ellipse cx="${cx}" cy="${n(top - 5.2)}" rx="${n(W * .42)}" ry="3.2" fill="${d.enamel(sp.accent)}"/>`;
  const pk = 5, pts = [];
  for (let i = 0; i <= pk * 2; i++) { const x = cx - W / 2 + W * i / (pk * 2), up = i % 2 === 0; pts.push(`${n(x)} ${n(up ? y - H - (i === pk ? 4 : 0) : y - H * .45)}`); }
  s += `<path d="M${n(cx - W / 2)} ${n(y)}L${pts.join('L')}L${n(cx + W / 2)} ${n(y)}z" fill="${d.mH(m)}"/>` +
    `<path d="M${cx} ${n(y)}L${pts.slice(pk).join('L')}L${n(cx + W / 2)} ${n(y)}z" fill="${d.mD(m)}" opacity=".45"/>` +
    `<rect x="${n(cx - W / 2)}" y="${n(y - 3.4)}" width="${n(W)}" height="3.4" fill="${d.mD(m)}"/>`;
  for (let i = 0; i <= pk * 2; i += 2) { const x = cx - W / 2 + W * i / (pk * 2); s += `<circle cx="${n(x)}" cy="${n(y - H - (i === pk ? 4 : 0) - 1)}" r="${i === pk ? 2 : 1.4}" fill="${i === pk ? d.glassR(sp.gem) : d.mR(sp.metal2 || m)}"/>`; }
  for (let i = -2; i <= 2; i++) s += `<circle cx="${n(cx + i * W * .18)}" cy="${n(y - 1.7)}" r="1" fill="${d.glassR(i % 2 ? sp.gem2 : sp.gem)}"/>`;
  return s;
};
ARCH.globe = (d, r, sp, top) => { // глобус с меридианами на ножке
  const cx = 32, m = sp.metal, R = jit(r, sp.big ? 15 : 13, .06), cy = top - 7 - R;
  let s = `<path d="M${n(cx - 7)} ${n(top)}H${n(cx + 7)}L${n(cx + 2.2)} ${n(top - 5)}H${n(cx - 2.2)}z" fill="${d.mH(m)}"/>` +
    `<circle cx="${cx}" cy="${n(cy)}" r="${n(R)}" fill="${sp.glassOrb ? d.glassR(sp.glass) : d.mR(m)}"/>`;
  for (const k of [.35, .7]) s += `<ellipse cx="${cx}" cy="${n(cy)}" rx="${n(R * k)}" ry="${n(R)}" fill="none" stroke="${d.mD(sp.metal2 || m)}" stroke-width=".7" opacity=".8"/>`;
  for (const k of [-.5, 0, .5]) s += `<ellipse cx="${cx}" cy="${n(cy + R * k)}" rx="${n(R * Math.sqrt(1 - k * k))}" ry="${n(R * .18)}" fill="none" stroke="${d.mD(sp.metal2 || m)}" stroke-width=".7" opacity=".8"/>`;
  s += `<path d="M${n(cx - R - 2.5)} ${n(cy + 3)}A${n(R + 2.5)} ${n(R + 2.5)} 0 0 0 ${n(cx + R + 2.5)} ${n(cy + 3)}" fill="none" stroke="${d.mH(sp.frame || sp.metal2 || 'gold')}" stroke-width="1.6"/>` +
    `<ellipse cx="${n(cx - R * .35)}" cy="${n(cy - R * .4)}" rx="${n(R * .3)}" ry="${n(R * .16)}" transform="rotate(-30 ${n(cx - R * .35)} ${n(cy - R * .4)})" fill="#fff" opacity=".35"/>`;
  return s;
};
ARCH.laurel = (d, r, sp, top) => { // лавровый венок вокруг звезды
  const cx = 32, m = sp.metal, R = jit(r, 14, .06), cy = top - 6 - R;
  let s = `<rect x="${n(cx - 1.5)}" y="${n(cy + R - 1)}" width="3" height="${n(top - cy - R + 1)}" fill="${d.mH(m)}"/>` +
    `<path d="M${n(cx - 6)} ${n(top)}H${n(cx + 6)}L${n(cx + 3)} ${n(top - 2.5)}H${n(cx - 3)}z" fill="${d.mH(m)}"/>`;
  for (let side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + side * (0.35 + i * 0.32), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="3" ry="1.2" transform="rotate(${n(a * 57.3 + side * 55)} ${n(x)} ${n(y)})" fill="${i % 2 ? d.mH(m) : d.mD(m)}"/>`;
  }
  s += bevelStar(d, sp.metal2 || m, cx, cy, R * .55, R * .23);
  return s;
};
ARCH.column = (d, r, sp, top) => { // колонна с капителью и сферой
  const cx = 32, m = sp.metal, H = jit(r, sp.big ? 30 : 26, .08), w = jit(r, 5.2, .1), y0 = top - 1.5;
  let s = `<rect x="${n(cx - w - 2)}" y="${n(y0 - 2.4)}" width="${n(w * 2 + 4)}" height="2.4" fill="${d.mD(m)}"/>` +
    `<rect x="${n(cx - w)}" y="${n(y0 - 2.4 - H)}" width="${n(w * 2)}" height="${n(H)}" fill="${d.mH(m)}"/>`;
  for (let i = -2; i <= 2; i++) s += `<path d="M${n(cx + i * w * .38)} ${n(y0 - 2.4 - H + 1)}v${n(H - 2)}" stroke="${d.mD(m)}" stroke-width=".7" opacity=".7"/>`;
  s += `<rect x="${n(cx - w - 2.4)}" y="${n(y0 - 5 - H)}" width="${n(w * 2 + 4.8)}" height="2.8" rx=".6" fill="${d.mD(m)}"/>` +
    `<circle cx="${cx}" cy="${n(y0 - 5 - H - 6)}" r="6" fill="${sp.glassOrb ? d.glassR(sp.glass) : d.mR(sp.metal2 || m)}"/>`;
  if (sp.emblem) s += bevelStar(d, sp.metal2 || m, cx, y0 - 2.4 - H * .5, 3.2, 1.3);
  return s;
};
ARCH.wings = (d, r, sp, top) => { // крылья, поднятые над сферой
  const cx = 32, m = sp.metal, W = jit(r, sp.big ? 21 : 18, .08), cy = top - 14;
  let s = `<path d="M${n(cx - 6)} ${n(top)}H${n(cx + 6)}L${n(cx + 2)} ${n(top - 4)}H${n(cx - 2)}z" fill="${d.mH(m)}"/>` +
    `<rect x="${n(cx - 1.2)}" y="${n(cy)}" width="2.4" height="${n(top - cy - 3.5)}" fill="${d.mH(m)}"/>`;
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const len = W * (1 - i * .14), ang = (-70 + i * 16) * Math.PI / 180, x2 = cx + side * Math.cos(ang) * len, y2 = cy + Math.sin(ang) * len;
    s += `<path d="M${cx} ${n(cy)}Q${n(cx + side * len * .55)} ${n(cy + Math.sin(ang) * len * .3 - 3)} ${n(x2)} ${n(y2)}L${n(x2 - side * 2.2)} ${n(y2 + 2.6)}Q${n(cx + side * len * .45)} ${n(cy + 1)} ${cx} ${n(cy + 2)}z" fill="${side < 0 ? d.mH(m) : d.mD(m)}" opacity="${1 - i * .1}"/>`;
  }
  s += `<circle cx="${cx}" cy="${n(cy)}" r="3.6" fill="${d.glassR(sp.gem)}"/>`;
  return s;
};
ARCH.hoop = (d, r, sp, top) => { // вертикальное кольцо с камнем
  const cx = 32, m = sp.metal, R = jit(r, 14, .07), cy = top - 5 - R, t = jit(r, 4.2, .15);
  let s = `<path d="M${n(cx - 8)} ${n(top)}H${n(cx + 8)}L${n(cx + 4)} ${n(top - 4)}H${n(cx - 4)}z" fill="${d.mH(m)}"/>` +
    `<circle cx="${cx}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${d.mD(m)}" stroke-width="${n(t + 1)}"/>` +
    `<circle cx="${cx}" cy="${n(cy)}" r="${n(R)}" fill="none" stroke="${d.mH(m)}" stroke-width="${n(t)}"/>` +
    `<path d="M${n(cx - R * .7)} ${n(cy - R * .7)}A${n(R)} ${n(R)} 0 0 1 ${n(cx + R * .2)} ${n(cy - R)}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>`;
  s += sp.gemTop || sp.core ? `<circle cx="${cx}" cy="${n(cy)}" r="${n(R * .42)}" fill="${d.glassR(sp.coreTint || sp.gem)}"/>` : bevelStar(d, sp.metal2 || m, cx, cy, R * .5, R * .2);
  return s;
};
ARCH.helix = (d, r, sp, top) => { // закрученный шпиль из двух лент
  const cx = 32, m = sp.metal, H = jit(r, sp.big ? 46 : 40, .06), y0 = top - 2, w = jit(r, 7, .1), turns = 2.2;
  let s = `<path d="M${n(cx - 6)} ${n(top)}H${n(cx + 6)}L${n(cx + 3)} ${n(top - 2.5)}H${n(cx - 3)}z" fill="${d.mH(m)}"/>`;
  for (const ph of [0, Math.PI]) {
    let path = ''; for (let i = 0; i <= 40; i++) { const k = i / 40, a = ph + k * turns * Math.PI * 2, x = cx + Math.sin(a) * w * (1 - k * .75), y = y0 - k * H; path += (i ? 'L' : 'M') + n(x) + ' ' + n(y); }
    s += `<path d="${path}" fill="none" stroke="${ph ? d.mD(m) : d.mH(m)}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  s += `<circle cx="${cx}" cy="${n(y0 - H - 2)}" r="2.6" fill="${d.glassR(sp.gem)}"/>`;
  return s;
};
ARCH.gem = (d, r, sp, top) => { // огранённый камень в лапках
  const cx = 32, W = jit(r, sp.big ? 26 : 23, .06), Hc = W * .32, Hp = W * .62, gy = top - 6 - Hp, g = sp.glass, m = sp.metal;
  let s = `<path d="M${n(cx - 7)} ${n(top)}H${n(cx + 7)}L${n(cx + 3)} ${n(top - 4)}H${n(cx - 3)}z" fill="${d.mH(m)}"/>`;
  const L = cx - W / 2, Rt = cx + W / 2, T = gy - Hc, B = gy + Hp;
  const facets = [[`${n(L)} ${n(gy)}`, `${n(cx - W * .25)} ${n(T)}`, `${n(cx)} ${n(gy)}`], [`${n(cx)} ${n(gy)}`, `${n(cx - W * .25)} ${n(T)}`, `${n(cx + W * .25)} ${n(T)}`], [`${n(cx)} ${n(gy)}`, `${n(cx + W * .25)} ${n(T)}`, `${n(Rt)} ${n(gy)}`],
    [`${n(L)} ${n(gy)}`, `${n(cx)} ${n(gy)}`, `${n(cx)} ${n(B)}`], [`${n(cx)} ${n(gy)}`, `${n(Rt)} ${n(gy)}`, `${n(cx)} ${n(B)}`]];
  facets.forEach((f, i) => { s += `<path d="M${f.join('L')}z" fill="${i % 2 ? d.glassA(g) : d.glassB(g)}" opacity=".95"/>`; });
  s += `<path d="M${n(L)} ${n(gy)}L${n(cx - W * .25)} ${n(T)}H${n(cx + W * .25)}L${n(Rt)} ${n(gy)}L${n(cx)} ${n(B)}z" fill="none" stroke="${d.mH(sp.frame || 'silver')}" stroke-width=".9"/>`;
  for (const k of [-1, 1]) s += `<path d="M${n(cx + k * 3)} ${n(top - 4)}L${n(cx + k * W * .3)} ${n(gy + Hp * .45)}" stroke="${d.mH(m)}" stroke-width="1.6"/>`;
  return s;
};

/* ------------------------------------------- серии турниров (формы) */
// Форма серии — по названию (без логотипов и надписей брендов). Металл и детали — по сезону.
const FAMILIES = [
  // v33: шоу-турниры, сборные, Grand Slam и новые формы для серий
  [/grand slam/i,                              { arch: ['ingot'], metals: ['gold'], variants: ['tall'], big: true }],
  [/nations|national cup|сборн/i,              { arch: ['globe', 'laurel'], metals: ['gold', 'palegold'], glass: ['blue', 'cyan'], big: true }],
  [/streamer|стример|showmatch|all-?star|шоу/i, { arch: ['crown', 'wings', 'hoop'], metals: ['gold', 'rose', 'chrome'] }],
  [/kazakhstan|baltic|balkan/i,                { arch: ['laurel', 'column'], metals: ['silver', 'gold', 'bronze'] }],
  [/skyesports|united21|thunderpick regional|pinnacle/i, { arch: ['helix', 'gem', 'hoop'], metals: ['chrome', 'silver', 'gold'], glass: ['violet', 'cyan', 'ruby'] }],
  [/esl pro league playoffs|playoffs/i,        { arch: ['column', 'shield'], metals: ['silver', 'gold'] }],
  [/fissure|playground/i,                      { arch: ['flame', 'helix'], metals: ['copper', 'gold', 'rose'], variants: ['flame'] }],
  [/regional lan finals|lan finals/i,          { arch: ['globe', 'gem'], metals: ['silver', 'chrome'], glass: ['blue', 'mint'] }],
  [/future stars|rookie clash|prospects|rising/i, { arch: ['wings', 'laurel', 'star'], metals: ['bronze', 'silver', 'copper'], small: true }],
  // v30: серии расширенного календаря (идут раньше общих правил)
  [/championship finals/i,                     { arch: ['obelisk'], metals: ['gold', 'palegold'], big: true, emblem: 'star' }],
  [/esports world cup|ewc/i,                   { arch: ['poly'], glass: ['amber', 'ice'], frame: ['gold'], variants: ['glass'], big: true }],
  [/cs asia|asia championships|chengdu/i,       { arch: ['bowl'], metals: ['gold', 'rose', 'palegold'] }],
  [/elisa|nordic/i,                            { arch: ['bowl'], metals: ['silver', 'chrome'] }],
  [/yalla|compass/i,                           { arch: ['poly'], glass: ['amber', 'mint'], frame: ['gold', 'silver'], variants: ['glass'] }],
  [/tipsport|prague|czech/i,                   { arch: ['bowl', 'plate'], metals: ['silver', 'gunmetal'] }],
  [/\bres\b|regional european|latin american series/i, { arch: ['obelisk'], metals: ['chrome', 'silver', 'gunmetal'] }],
  [/challenger league|esl challenger/i,        { arch: ['shield'], metals: ['chrome', 'gunmetal'] }],
  [/pgl masters/i,                             { arch: ['obelisk', 'spire'], metals: ['chrome', 'gold'] }],
  [/qualifier|квалиф/i,                        { arch: ['plate'], metals: ['bronze', 'gunmetal'], small: true }],
  [/online cup|weekly|cup series|lan cup/i,    { arch: ['star', 'cup'], metals: ['bronze', 'copper', 'silver'], small: true }],
  [/championship$|national|чемпионат|polish|brazilian|german pro|uk masters|ukrainian cup|kazakhstan|turkish masters|iberian|baltic|balkan/i, { arch: ['bowl', 'crest', 'shield'], metals: ['silver', 'bronze', 'gold'] }],
  [/academy|young talents|prodigy|junior|nxt|ares|youth/i, { arch: ['crest', 'star'], metals: ['bronze', 'silver', 'copper'], small: true }],
  [/major/i,                                   { arch: ['cup'], metals: ['gold', 'gold', 'palegold'], big: true, emblem: 'star', handles: ['loop', 'wing'] }],
  [/blast/i,                                   { arch: ['prism'], glass: ['ice', 'blue', 'violet', 'smoke', 'cyan'], frame: ['silver', 'chrome', 'gold', null], variants: ['single', 'twin', 'inv', 'trio'] }],
  [/\biem\b|intel extreme/i,                   { arch: ['chalice', 'cup'], metals: ['silver', 'chrome', 'gold'], handles: ['none', 'angular'] }],
  [/esl|epl|pro league/i,                      { arch: ['shield', 'plate'], metals: ['silver', 'gunmetal', 'gold', 'chrome'] }],
  [/pgl/i,                                     { arch: ['spire'], metals: ['chrome', 'silver', 'gunmetal', 'gold'], variants: ['single', 'twin'] }],
  [/starladder|starseries|i-league/i,         { arch: ['star'], metals: ['gold', 'silver', 'rose'] }],
  [/dreamhack/i,                               { arch: ['chalice'], metals: ['silver', 'rose', 'gold'] }],
  [/thunderpick|thunder|storm|volt/i,          { arch: ['flame'], metals: ['gold', 'chrome', 'silver'], variants: ['bolt'] }],
  [/fissure|fire|blaze|inferno|flame/i,        { arch: ['flame'], metals: ['copper', 'gold', 'bronze', 'rose'], variants: ['flame'] }],
  [/cct|world|global|continental|cup of nations|perfect world/i, { arch: ['orb'], metals: ['silver', 'gold', 'chrome'], glass: ['blue', 'ice', 'cyan'] }],
  [/betboom|dacha|mountain|peak|summit/i,      { arch: ['prism'], glass: ['mint', 'ice', 'cyan', 'smoke'], frame: ['gold', 'silver'], variants: ['twin', 'trio'] }],
  [/elisa|nordic|plate|masters/i,              { arch: ['plate'], metals: ['silver', 'chrome', 'palegold'] }],
  [/bounty|roobet|cash|money|bet\b|stake/i,    { arch: ['ingot'], metals: ['gold', 'palegold'], variants: ['flat', 'tall'] }],
  [/academy|junior|nxt|ares|youth|rookie/i,    { arch: ['cup', 'chalice', 'star'], metals: ['bronze', 'silver', 'copper'], small: true }],
  [/rookie|open|amateur|novice|underground|grassroots|entry|rising|future|prospects|young/i, { arch: ['cup', 'star', 'shield'], metals: ['bronze', 'copper', 'silver'] }]
];
const ARCH_ALL = ['cup', 'chalice', 'spire', 'orb', 'star', 'shield', 'plate', 'prism', 'flame', 'bowl', 'obelisk', 'poly', 'crown', 'globe', 'laurel', 'column', 'wings', 'hoop', 'helix', 'gem'];
const TIER = { major: { scale: 1, metals: null }, elite: { scale: .97 }, regular: { scale: .93 }, tier2: { scale: .87, demote: true }, tier3: { scale: .8, demote: true }, academy: { scale: .76, demote: true } };
function familyKey(name) {
  return String(name || '').toLowerCase().replace(/\b(19|20)\d\d\b/g, ' ').replace(/\bseason\s*\d+|\bs\d+\b|\bсезон\s*\d+/g, ' ')
    .replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function specFor(name, season, kind) {
  kind = kind || 'regular';
  const fam = (FAMILIES.find(([re]) => re.test(name || '')) || [0, null])[1];
  const fkey = familyKey(name), fr = rngOf(hash('fam|' + fkey)), r = rngOf(hash('inst|' + name + '|' + season + '|' + kind));
  const allowed = fam ? fam.arch : [ARCH_ALL[hash(fkey) % ARCH_ALL.length]];
  const arch = allowed[Math.floor(fr() * allowed.length)];
  // семейные черты (у серии всегда одинаковые) и сезонные (каждый розыгрыш немного другой)
  const famMetal = fam?.metals ? fam.metals[Math.floor(fr() * fam.metals.length)] : pick(fr, ['gold', 'silver', 'chrome', 'bronze', 'gunmetal', 'rose']);
  let metal = r() < .6 ? famMetal : (fam?.metals ? pick(r, fam.metals) : pick(r, ['gold', 'silver', 'chrome', 'rose']));
  const tier = TIER[kind] || TIER.regular;
  if (tier.demote && /gold|palegold/.test(metal) && r() < .7) metal = pick(r, kind === 'tier2' ? ['silver', 'chrome', 'rose'] : ['bronze', 'copper', 'silver']);
  if (kind === 'major') metal = r() < .85 ? 'gold' : 'palegold';
  const famGlass = fam?.glass ? fam.glass[Math.floor(fr() * fam.glass.length)] : pick(fr, Object.keys(GLASS));
  const glass = GLASS[r() < .65 ? famGlass : pick(r, fam?.glass || Object.keys(GLASS))];
  const variant = fam?.variants ? fam.variants[Math.floor(fr() * fam.variants.length)] : pick(fr, ['single', 'twin']);
  const baseType = pick(fr, arch === 'prism' || arch === 'spire' ? ['block', 'slab', 'step'] : ['step', 'round', 'slab', 'block']);
  const baseMat = pick(fr, ['black', 'black', 'wood', 'marble', 'navy', 'stone']);
  const flip = p => r() < p;
  const famFlag = (k, p) => (hash(fkey + k) % 100) / 100 < p;
  const sp = {
    arch, kind, metal, glass, variant,
    metal2: pick(r, ['gold', 'silver', 'palegold', 'chrome', metal]),
    accent: pick(r, ENAMEL), gem: GLASS[pick(r, ['ruby', 'blue', 'mint', 'amber', 'violet', 'cyan'])],
    gem2: GLASS[pick(r, ['ruby', 'blue', 'mint', 'amber'])],
    frame: fam?.frame ? (r() < .7 ? fam.frame[Math.floor(fr() * fam.frame.length)] : pick(r, fam.frame)) : (flip(.4) ? 'silver' : null),
    big: !!fam?.big || kind === 'major',
    handles: arch === 'cup' ? (fam?.handles ? fam.handles[Math.floor(fr() * fam.handles.length)] : pick(fr, ['loop', 'loop', 'wing', 'angular'])) : null,
    lid: famFlag('lid', .45) !== flip(.2), finial: pick(r, ['ball', 'star']),
    band: famFlag('band', .5) !== flip(.25), bandMetal: flip(.5) ? pick(r, ['gold', 'silver', 'gunmetal']) : null,
    emblem: fam?.emblem || (arch === 'shield' || arch === 'plate' ? pick(r, ['star', 'chevron', 'laurel', 'diamond', 'crown']) : (flip(.25) ? pick(r, ['star', 'diamond']) : null)),
    facets: famFlag('fac', .5) ? 6 + Math.floor(r() * 4) : 0,
    ring: famFlag('ring', .5) !== flip(.2), engr: flip(.5), gemTop: flip(.35), globe: famFlag('globe', .7),
    glassOrb: !!fam?.glass && famFlag('go', .5), field: flip(.6), center: flip(.5) ? 'enamel' : 'metal',
    rings: [[.78, .55], [.82, .6, .4], [.7]][Math.floor(r() * 3)], dots: famFlag('dots', .5),
    core: arch === 'prism' && flip(.45), coreTint: GLASS[pick(r, ['amber', 'ruby', 'mint', 'blue'])], coin: flip(.5),
    plaque: pick(r, ['gold', 'silver', 'palegold']),
    base: { type: baseType, mat: baseMat, w: jit(fr, arch === 'cup' || arch === 'crown' ? 30 : 26, .12) },
    scale: (tier.scale || .93) * (fam?.small ? .94 : 1), star: kind === 'major'
  };
  if (arch === 'cup' && kind === 'major') sp.handles = sp.handles === 'none' ? 'loop' : sp.handles;
  if (arch === 'cup' && sp.handles === 'none') sp.handles = null;
  return sp;
}

function render(sp) {
  const d = new Defs(), r = rngOf(hash(JSON.stringify([sp.arch, sp.metal, sp.variant, sp.base.w, sp.accent, sp.seed || 0])));
  const b = drawBase(d, sp);
  const body = (ARCH[sp.arch] || ARCH.cup)(d, r, sp, b.top);
  const k = sp.scale || 1;
  const g = k === 1 ? body : `<g transform="translate(32 ${n(b.top)}) scale(${n(k)}) translate(-32 ${n(-b.top)})">${body}</g>`;
  return d.svg(b.svg + g);
}

/* ------------------------------------------------- медали и плашки */
function medalSvg(kind) { // MVP / EVP в духе HLTV: круглая медаль — золотой обод, эмалевое кольцо с делениями, центр с надписью
  const evp = kind === 'evp', ring = evp ? ['#9aa7b8', '#5b6778'] : ['#2f6fd6', '#183f86'], core = evp ? ['#eef2f7', '#aab4c2'] : ['#ffe08a', '#d39a22'];
  let ticks = '';
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, r1 = 21.5, r2 = i % 3 ? 23.5 : 25; ticks += `<line x1="${n(32 + Math.cos(a) * r1)}" y1="${n(32 + Math.sin(a) * r1)}" x2="${n(32 + Math.cos(a) * r2)}" y2="${n(32 + Math.sin(a) * r2)}" stroke="#fff" stroke-opacity="${i % 3 ? .35 : .7}" stroke-width="${i % 3 ? .6 : 1}"/>`; }
  const id = 'md' + (evp ? 'e' : 'm') + (++UID).toString(36);
  return `<svg class="tw-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>` +
    `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#d6a23a"/><stop offset="1" stop-color="#8a5a12"/></linearGradient>` +
    `<radialGradient id="${id}b" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="${ring[0]}"/><stop offset="1" stop-color="${ring[1]}"/></radialGradient>` +
    `<radialGradient id="${id}c" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="${core[0]}"/><stop offset="1" stop-color="${core[1]}"/></radialGradient></defs>` +
    `<circle cx="32" cy="32" r="30" fill="url(#${id}r)"/><circle cx="32" cy="32" r="27" fill="url(#${id}b)"/>${ticks}` +
    `<circle cx="32" cy="32" r="16" fill="url(#${id}r)"/><circle cx="32" cy="32" r="14.2" fill="url(#${id}c)"/>` +
    `<text x="32" y="36" text-anchor="middle" font-family="Inter,Arial,Helvetica,sans-serif" font-weight="900" font-size="10" fill="${evp ? '#3b4656' : '#6b3f05'}">${evp ? 'EVP' : 'MVP'}</text>` +
    `<path d="M14 22a20 20 0 0 1 14-10" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/></svg>`;
}
// Grand Slam — золотой слиток: объёмный брусок в лёгком ракурсе, скошенные грани, блики, без надписей
function goldBarSvg() {
  const u = 'gb' + (++UID).toString(36);
  return (`<svg class="tw-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>` +
    `<radialGradient id="gbG" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffd76a" stop-opacity=".35"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="gbTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8cf"/><stop offset=".35" stop-color="#ffe27a"/><stop offset=".7" stop-color="#f4bd2c"/><stop offset="1" stop-color="#d99614"/></linearGradient>` +
    `<linearGradient id="gbFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c33a"/><stop offset=".5" stop-color="#e2a019"/><stop offset="1" stop-color="#a86a06"/></linearGradient>` +
    `<linearGradient id="gbSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c98a0d"/><stop offset="1" stop-color="#8a5503"/></linearGradient>` +
    `<linearGradient id="gbEdge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
    `<circle cx="32" cy="34" r="27" fill="url(#gbG)"/>` +
    `<ellipse cx="32" cy="47.5" rx="21" ry="3.2" fill="#000" opacity=".45"/>` +
    // передняя грань (трапеция), правая боковая, верх (скошенный)
    `<path d="M9 34L13 45H48L52 34z" fill="url(#gbFront)"/>` +
    `<path d="M52 34L48 45L55 40L57 30z" fill="url(#gbSide)"/>` +
    `<path d="M9 34L19 24H51L57 30L52 34z" fill="url(#gbFront)" opacity=".9"/>` +
    `<path d="M15 31L21 26H49L53 30L49 32H18z" fill="url(#gbTop)"/>` +
    `<path d="M15 31L18 32H49L53 30" fill="none" stroke="#a86a06" stroke-opacity=".5" stroke-width=".6"/>` +
    `<path d="M21 26H49" stroke="url(#gbEdge)" stroke-width="1.2"/>` +
    `<path d="M10 34H52" stroke="#fff3b8" stroke-opacity=".75" stroke-width=".8"/>` +
    `<path d="M22 28.4l18 0" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M14 38H30" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M44 21l1.2 2.6 2.6 1.2-2.6 1.2L44 28.6l-1.2-2.6-2.6-1.2 2.6-1.2z" fill="#fff" opacity=".9"/></svg>`).replace(/gb(G|Top|Front|Side|Edge)\b/g, u + '$1');
}
function top20Svg(rank) { // плашка «топ-20 года»: оранжевый восьмиугольник с местом
  const d = new Defs(), c = rank <= 1 ? ['#ffd45a', '#d6901d', '#8a5208'] : rank === 2 ? ['#eef2f6', '#a7b1bd', '#5d6773'] : rank === 3 ? ['#f0b98a', '#b86f35', '#6e3a14'] : rank <= 10 ? ['#ffa15a', '#e0631f', '#8c3208'] : ['#f2a56c', '#c9662e', '#7a3814']; // 1 — золото, 2 — серебро, 3 — бронза
  const p = 'M20 5h24l14 14v26L44 59H20L6 45V19z';
  return d.svg(`<path d="${p}" fill="${d.lg('t20', 0, 0, 0, 1, [[0, c[0]], [.55, c[1]], [1, c[2]]])}"/>` +
    `<path d="${p}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" transform="translate(32 32) scale(.86) translate(-32 -32)"/>` +
    `<path d="M20 5h24l14 14H6z" fill="#fff" opacity=".14"/>` +
    `<text x="32" y="19" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="6" letter-spacing=".5" fill="#fff" fill-opacity=".9">TOP 20</text>` +
    `<text x="32" y="${rank >= 10 ? 46 : 47}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${rank >= 10 ? 23 : 27}" fill="#fff" stroke="${c[2]}" stroke-width=".8" paint-order="stroke">${rank}</text>`, '0 0 64 64');
}
const AWARD_DEF = {
  poty:   { title: 'Игрок года',            emblem: 'star',      glass: 'amber' },
  rifler: { title: 'Лучший рифлер года',    emblem: 'crosshair', glass: 'ice' },
  awper:  { title: 'Лучший снайпер года',   emblem: 'scope',     glass: 'cyan' },
  igl:    { title: 'Лучший капитан года',   emblem: 'crown',     glass: 'violet' },
  rookie: { title: 'Новичок года',          emblem: 'sprout',    glass: 'mint' },
  team:   { title: 'Команда года',          emblem: 'crown' },
  coach:  { title: 'Тренер года',           emblem: 'laurel',    glass: 'violet' },
  entry:  { title: 'Лучший энтри-фраггер',  emblem: 'bolt',      glass: 'ruby' },
  clutch: { title: 'Мастер клатчей',        emblem: 'diamond',   glass: 'blue' },
  support:{ title: 'Лучший саппорт',        emblem: 'cross',     glass: 'mint' },
  breakout:{ title: 'Прорыв года',          emblem: 'chevron',   glass: 'amber' }
};
function awardSvg(type, year) {
  const a = AWARD_DEF[type] || AWARD_DEF.poty, r = rngOf(hash(type + year));
  if (type === 'team') return render({ arch: 'crown', metal: 'gold', metal2: 'palegold', velvet: pick(r, ['#8e1f2c', '#1f3f8e', '#4a1f8e']), gem: GLASS.ruby, gem2: GLASS.blue, points: 5,
    base: { type: 'block', mat: 'black', w: 34 }, plaque: 'gold', scale: 1, seed: year });
  return render({ arch: 'award', glass: GLASS[a.glass], emblem: a.emblem, base: { type: pick(r, ['block', 'step']), mat: pick(r, ['black', 'navy', 'marble']), w: 26 }, plaque: 'gold', scale: .96, seed: year });
}

const CACHE = new Map();
// у каждой копии SVG — свои id градиентов: иначе при скрытой первой копии Chrome не рисует заливку в остальных
function uniq(svg) { const m = /id="(tw[0-9a-z]+_)/.exec(svg); if (!m) return svg; const fresh = 'tw' + (++UID).toString(36) + '_'; return svg.split(m[1]).join(fresh); }
function trophySvg(name, season, kind) {
  const key = name + '|' + season + '|' + kind;
  if (!CACHE.has(key)) { if (CACHE.size > 600) CACHE.clear(); CACHE.set(key, render(specFor(name, season, kind))); }
  return uniq(CACHE.get(key));
}
window.TW = { trophySvg, specFor, render, medalSvg, goldBarSvg, top20Svg, awardSvg, AWARD_DEF, familyKey };

/* =====================================================================
   Ниже — встраивание в игру (если это не отдельная галерея)
   ===================================================================== */
if (typeof window.showHistory !== 'function' || typeof teams === 'undefined') return;

const AW_KEY = 'cs2_player_awards_v1';
let AW = (() => { try { const o = JSON.parse(localStorage.getItem(AW_KEY) || '{}'); return o && o.p ? o : { v: 1, p: {}, seasons: [] }; } catch (e) { return { v: 1, p: {}, seasons: [] }; } })();
// v33: «Новичок года» мог достаться одному игроку несколько раз — оставляем самую раннюю награду
Object.values(AW.p || {}).forEach(rec => { const r = (rec.aw || []).filter(a => a.type === 'rookie'); if (r.length > 1) { const first = r.reduce((a, b) => ((a.s || 0) <= (b.s || 0) ? a : b)); rec.aw = rec.aw.filter(a => a.type !== 'rookie' || a === first); } });
let awTimer = null;
function awSave() { clearTimeout(awTimer); awTimer = setTimeout(() => { try { localStorage.setItem(AW_KEY, JSON.stringify(AW)); } catch (e) { console.warn('[trophies] не сохранено', e); } }, 250); }
window.addEventListener('beforeunload', () => { if (awTimer) { clearTimeout(awTimer); try { localStorage.setItem(AW_KEY, JSON.stringify(AW)); } catch (e) {} } });
const P = nick => AW.p[nick] || (AW.p[nick] = { mvp: [], ti: [], top: [], aw: [] });
window.twAwardsExport = () => AW;
window.twAwardsImport = o => { if (o && o.p) { AW = o; awSave(); } };
window.twAwardsClear = () => { clearTimeout(awTimer); awTimer = null; AW = { v: 1, p: {}, seasons: [] }; try { localStorage.removeItem(AW_KEY); } catch (e) {} }; // отложенная запись тоже отменяется — иначе при перезагрузке награды записались бы обратно

const esc2 = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ovr = p => Math.round((+p.firepower || 0) * .40 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .20 + (+p.utility || 0) * .15);
const yearOf = s => 2026 + ((+s || 1) - 1);
const KIND_W = { major: 14, elite: 9, regular: 6, tier2: 3, tier3: 1.5, academy: 1 };
const KIND_LABEL = { major: 'Major', elite: 'S-Tier', regular: 'Tier-1', tier2: 'Tier-2', tier3: 'Tier-3', academy: 'Академии' };

// победа в турнире: титул всем игрокам состава, MVP — лучшему по уровню и форме (воспроизводимо по турниру)
function awardTournament(ev) {
  if (!ev || !ev.champion || ev.champion === '—') return;
  const t = teams.find(x => x.name === ev.champion); if (!t) return;
  try { if (typeof ensurePlayerLayer === 'function') ensurePlayerLayer(t); } catch (e) {}
  const id = ev.archiveId || (ev.name + '|' + ev.season);
  const players = (t.players || []).filter(p => p && p.nick && (!p.status || p.status === 'STARTER'));
  const roster = players.length >= 5 ? players : (t.players || []);
  let given = false;
  roster.forEach(p => {
    const rec = P(p.nick);
    if (rec.ti.some(x => x.id === id)) return;
    rec.ti.unshift({ id, n: ev.name, s: ev.season, y: yearOf(ev.season), k: ev.kind, team: t.name, a: ev.archiveId || null });
    given = true;
  });
  if (!given || ev.kind === 'tier3' || ev.kind === 'academy') { awSave(); return; }
  const r = rngOf(hash('mvp|' + id));
  let best = null, bs = -1;
  roster.forEach(p => { const L = statOf(p.nick, null, ev.archiveId);
    const sc = L && L.maps >= 3 ? L.rating * 100 + 4 + L.impact * 2 : ovr(p) * (.8 + r() * .4) * ((+p.form || 100) / 100) * .9 + (p.role === 'AWPer' ? 1.5 : 0);
    if (sc > bs) { bs = sc; best = p; } });
  if (best) P(best.nick).mvp.unshift({ id, n: ev.name, s: ev.season, y: yearOf(ev.season), k: ev.kind, team: t.name });
  awSave();
}

// v33: Rating 2.0 (формула HLTV: KAST, KPR, DPR, Impact, ADR) из статистики архива портала
function statOf(nick, season, evId) {
  try { const H = window.HS; if (!H || !H.stats) return null; H.invalidate && H.invalidate(); const o = H.stats().P[nick]; if (!o) return null;
    const src = evId ? o.byEv[evId]?.s : season != null ? o.bySeason[season] : o.all; return src && src.maps ? H.line(src) : null; } catch (e) { return null; }
}
// конец сезона: топ-20 игроков года и личные награды
function seasonAwards(season) {
  if ((AW.seasons || []).includes(season)) return;
  AW.seasons = (AW.seasons || []).concat(season);
  const y = yearOf(season), r = rngOf(hash('season|' + season));
  const ranked = [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const rows = [];
  ranked.forEach((t, ti) => {
    try { if (typeof ensurePlayerLayer === 'function') ensurePlayerLayer(t); } catch (e) {}
    (t.players || []).forEach(p => {
      if (!p || !p.nick) return;
      const rec = AW.p[p.nick];
      const titles = (rec?.ti || []).filter(x => x.s === season).reduce((a, x) => a + (KIND_W[x.k] || 2), 0);
      const mvps = (rec?.mvp || []).filter(x => x.s === season).length;
      const L = statOf(p.nick, season);
      const score = L && L.maps >= 8 ? L.rating * 100 + titles * 1.2 + mvps * 3 + Math.max(0, 16 - ti) * .25 : ovr(p) * .6 + titles * 1.4 + mvps * 6 + Math.max(0, 24 - ti) * .7 + r() * 4 - 30;
      rows.push({ p, t, score, L });
    });
  });
  const maxMaps = Math.max(1, ...rows.map(x => x.L?.maps || 0));
  rows.forEach(x => { if (!x.L || x.L.maps < maxMaps * .4) x.score -= 40; });   // мало карт — в топ не попадает
  rows.sort((a, b) => b.score - a.score);
  rows.slice(0, 20).forEach((x, i) => { const rec = P(x.p.nick); if (!rec.top.some(z => z.y === y)) rec.top.unshift({ r: i + 1, y, s: season, team: x.t.name }); });
  const give = (type, row) => { if (row) P(row.p.nick).aw.unshift({ type, y, s: season, team: row.t.name }); };
  give('poty', rows[0]);
  give('awper', rows.find(x => x.p.role === 'AWPer'));
  give('igl', rows.find(x => x.p.role === 'IGL'));
  give('rifler', rows.find(x => x.p.role !== 'AWPer' && x.p.role !== 'IGL'));
  const ok = x => x.L && x.L.maps >= maxMaps * .4;
  const bestBy = (f, filt) => rows.filter(x => ok(x) && (!filt || filt(x))).sort((a, b) => f(b) - f(a))[0];
  give('entry', bestBy(x => x.L.okpr - (x.L.od / Math.max(1, x.L.R)), x => /Entry/i.test(x.p.role || '')) || bestBy(x => x.L.okpr));
  give('clutch', bestBy(x => x.L.clW + x.L.clW / Math.max(1, x.L.clA)));
  give('support', bestBy(x => x.L.kast + x.L.apr * 20, x => /Support/i.test(x.p.role || '')));
  give('breakout', bestBy(x => { const prev = statOf(x.p.nick, season - 1); return prev && prev.maps >= 8 ? x.L.rating - prev.rating : -1; }));
  // тренер года: команда с лучшим сезоном (титулы сезона, место в рейтинге)
  const coachRow = ranked.filter(t => !t.isAcademy && t.coach && t.coach.name && t.coach.name !== '—').map((t, i) => ({ t, sc: (t.history || []).filter(h => h.place === 1 && h.season === season && !h.isBootcamp && !h.isSeasonAward).reduce((a, h) => a + (h.isMajor ? 5 : h.isElite ? 3 : 2), 0) + Math.max(0, 10 - i) * .6 + ((t.seasonStartRank || 20) - (i + 1)) * .3 }))
    .sort((a, b) => b.sc - a.sc)[0];
  if (coachRow) P(coachRow.t.coach.name).aw.unshift({ type: 'coach', y, s: season, team: coachRow.t.name, coach: true });
  // Новичок года — один раз за карьеру: игрок не старше 21, раньше не получал эту награду
  // и не входил в топ-20 прошлых сезонов (то есть это действительно его первый сезон среди лучших)
  give('rookie', rows.find(x => { const rec = AW.p[x.p.nick];
    if ((+x.p.age || 99) > 21) return false;
    if ((rec?.aw || []).some(a => a.type === 'rookie')) return false;
    return !(rec?.top || []).some(z => z.s < season); }));
  awSave();
}

/* ---- хуки движка ---- */
const origT1 = window.hubArchiveTier1;
window.hubArchiveTier1 = function (ct) {
  const r = origT1 ? origT1.apply(this, arguments) : undefined;
  try {
    const champ = Object.entries(ct?.placements || {}).find(([, p]) => p.place === 1)?.[0];
    awardTournament({ name: ct.name, season: ct.season, kind: ct.isMajor ? 'major' : ct.isElite ? 'elite' : 'regular', champion: champ, archiveId: ct.hubArchiveId });
  } catch (e) { console.warn('[trophies] tier1', e); }
  return r;
};
const origPar = window.hubArchiveParallel;
window.hubArchiveParallel = function (ev) {
  const r = origPar ? origPar.apply(this, arguments) : undefined;
  try {
    awardTournament({ name: ev.name, season: ev.season, kind: ev.kind === 'academy' ? 'academy' : (ev.tier === '2' ? 'tier2' : 'tier3'),
      champion: ev.winner || (ev.placements || [])[0], archiveId: 'P-' + ev.id });
  } catch (e) { console.warn('[trophies] parallel', e); }
  return r;
};
if (typeof finalizeTournamentRating === 'function') {
  const origFin = finalizeTournamentRating;
  finalizeTournamentRating = function () { // eslint-disable-line no-global-assign
    const s0 = seasonState?.currentSeason;
    const res = origFin.apply(this, arguments);
    try { if (seasonState && seasonState.currentSeason !== s0) seasonAwards(s0); } catch (e) { console.warn('[trophies] season', e); }
    return res;
  };
}

/* ---- полоса трофеев ---- */
let tipEl = null;
function tip() { return tipEl || (tipEl = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'tw-tip', role: 'tooltip' })); }
function showTip(anchor, html) {
  const el = tip(); el.innerHTML = html; el.classList.add('on');
  const rc = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - w - 8, rc.left + rc.width / 2 - w / 2));
  let y = rc.top - h - 10; if (y < 8) y = rc.bottom + 10;
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function hideTip() { tipEl?.classList.remove('on'); }

const LISTS = { t: [], p: [] };
function tileHtml(it, i, ns) {
  const badge = it.count > 1 ? `<span class="tw-b cnt">${it.count}</span>` : it.star ? '<span class="tw-b star">★</span>' : it.yr ? `<span class="tw-b yr">'${String(it.yr).slice(-2)}</span>` : '';
  return `<button type="button" class="tw-tile${it.open ? '' : ' static'}${it.kind ? ' k-' + it.kind : ''}" data-tw="${ns}${i}" aria-label="${esc2(it.title)}"><span class="tw-img">${it.svg}</span>${badge}</button>`;
}
function stripHtml(items, empty, ns) {
  LISTS[ns] = items;
  if (!items.length) return `<div class="tw-empty">${empty}</div>`;
  return items.map((it, i) => tileHtml(it, i, ns)).join('');
}
const itemOf = el => { const k = el.dataset.tw || ''; return (LISTS[k[0]] || [])[+k.slice(1)]; };
function archive() { try { return window.hubArchiveExport ? window.hubArchiveExport() : {}; } catch (e) { return {}; } }
function kindOf(h, snap) {
  if (snap?.prestige) return snap.prestige;
  if (h.isMajor) return 'major';
  if (h.isElite) return 'elite';
  if (/Фоновый/.test(h.placeTitle || '')) return /Academy|Junior|NXT|Ares|Академ/i.test(h.tournament) ? 'academy' : (h.fieldProfile === 'medium' ? 'tier2' : 'tier3');
  return 'regular';
}
function teamItems(t) {
  const arch = archive(), out = [];
  (seasonState?.hallOfFame || []).forEach(h => {
    if (h.champion !== t.name) return;
    out.push({ svg: awardSvg('team', h.year || yearOf(h.season)), yr: h.year || yearOf(h.season), title: `Команда года · сезон ${h.season}`,
      sub: `${h.year || yearOf(h.season)} · ${h.scorePts ?? '—'} pts`, big: () => awardSvg('team', h.year || yearOf(h.season)), s: h.season, order: 3 });
  });
  (t.history || []).forEach(h => {
    if (h.place !== 1 || h.isBootcamp || h.isSeasonAward) return;
    const snap = h.archiveId ? arch[h.archiveId] : null, kind = kindOf(h, snap);
    out.push({ svg: trophySvg(h.tournament, h.season, kind), star: kind === 'major', kind, title: h.tournament,
      sub: `Сезон ${h.season} (${yearOf(h.season)}) · ${KIND_LABEL[kind] || ''}`, open: true, a: h.archiveId, h, team: t.name,
      big: () => trophySvg(h.tournament, h.season, kind), s: h.season, order: kind === 'major' ? 2 : 1 });
  });
  out.sort((a, b) => (b.s || 0) - (a.s || 0) || b.order - a.order);
  return out;
}
function playerItems(p, t) {
  const rec = AW.p[p.nick] || { mvp: [], ti: [], top: [], aw: [] }, out = [];
  if (rec.mvp.length) out.push({ svg: medalSvg('mvp'), count: rec.mvp.length, title: `MVP турниров: ${rec.mvp.length}`,
    sub: rec.mvp.slice(0, 6).map(x => `${x.n} (${x.y})`).join('<br>') + (rec.mvp.length > 6 ? '<br>…' : ''), big: () => medalSvg('mvp'), s: 1e9 });
  rec.aw.forEach(a => out.push({ svg: awardSvg(a.type, a.y), yr: a.y, title: (AWARD_DEF[a.type] || {}).title || a.type, sub: `${a.y} · ${esc2(a.team || '')}`, big: () => awardSvg(a.type, a.y), s: a.s, order: 5 }));
  rec.top.forEach(x => out.push({ svg: top20Svg(x.r), yr: x.y, title: `Топ-20 игроков ${x.y}: #${x.r}`, sub: esc2(x.team || ''), big: () => top20Svg(x.r), s: x.s, order: 4 }));
  let titles = rec.ti, derived = false;
  if (!titles.length && t) { // наград ещё нет (старое сохранение): титулы текущей команды
    derived = true;
    titles = (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward)
      .map(h => ({ n: h.tournament, s: h.season, y: yearOf(h.season), k: kindOf(h, h.archiveId ? archive()[h.archiveId] : null), team: t.name, a: h.archiveId || null, h }));
  }
  titles.forEach(x => out.push({ svg: trophySvg(x.n, x.s, x.k), star: x.k === 'major', kind: x.k, title: x.n,
    sub: `Сезон ${x.s} (${x.y}) · ${KIND_LABEL[x.k] || ''} · ${esc2(x.team)}${derived ? '<br><i>по истории команды</i>' : ''}`,
    open: true, a: x.a, h: x.h || { tournament: x.n, season: x.s, placeTitle: '1 место' }, team: x.team, big: () => trophySvg(x.n, x.s, x.k), s: x.s, order: x.k === 'major' ? 2 : 1 }));
  const head = out[0]?.count ? [out.shift()] : [];
  out.sort((a, b) => (b.s || 0) - (a.s || 0) || (b.order || 0) - (a.order || 0));
  return { items: head.concat(out), rec, titles };
}
function wireStrip(el) {
  if (!el || el._tw) return; el._tw = true;
  el.addEventListener('wheel', e => { if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}
const tipFor = el => {
  const it = itemOf(el); if (!it) return;
  showTip(el, `<div class="tw-tip-img">${it.big ? it.big() : it.svg}</div><div class="tw-tip-txt"><b>${esc2(it.title)}</b>${it.sub ? `<small>${it.sub}</small>` : ''}` +
    (it.open ? `<small class="tw-tip-hint">${it.a && archive()[it.a] ? 'Нажмите — откроется сетка турнира' : 'Сетка турнира не сохранена'}</small>` : '') + '</div>');
};
document.addEventListener('mouseover', e => { const el = e.target.closest?.('.tw-tile'); if (el) tipFor(el); });
document.addEventListener('mouseout', e => { if (e.target.closest?.('.tw-tile')) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest?.('.tw-tile'); if (el) tipFor(el); });
document.addEventListener('focusout', e => { if (e.target.closest?.('.tw-tile')) hideTip(); });
document.addEventListener('click', e => {
  const el = e.target.closest?.('.tw-tile'); if (!el) return;
  const it = itemOf(el); if (!it || !it.open) return;
  hideTip(); if (typeof window.hubOpenTournament === 'function') window.hubOpenTournament(it.a, it.team, it.h);
});

/* ---- профиль команды ---- */
const origShow = window.showHistory;
window.showHistory = function (teamName) {
  const res = origShow.apply(this, arguments);
  try {
    const box = document.getElementById('trophy-cabinet'), t = teamName ? teams.find(x => x.name === teamName) : null;
    if (box && t) {
      box.classList.add('tw-strip');
      box.innerHTML = stripHtml(teamItems(t), 'Побед в турнирах пока нет. Кубок появляется за 1 место.', 't');
      box.scrollLeft = 0; wireStrip(box);
    }
  } catch (e) { console.warn('[trophies] team', e); }
  return res;
};

/* ---- окно игрока ---- */
function decoratePlayer(teamName, nick) {
  const ov = document.getElementById('hl-player-overlay'); const win = ov?.firstElementChild; if (!win) return;
  const t = teams.find(x => x.name === teamName); const p = t?.players?.find(x => x.nick === nick) || t?.players?.[0]; if (!p) return;
  const { items, rec, titles } = playerItems(p, t);
  const majors = titles.filter(x => x.k === 'major').length, majorMvp = rec.mvp.filter(x => x.k === 'major').length;
  const best = rec.top.reduce((m, x) => Math.min(m, x.r), 99);
  const chips = [
    majors ? `<span class="tw-chip gold"><b>${majors}</b> x Major winner</span>` : '',
    majorMvp ? `<span class="tw-chip slate"><b>${majorMvp}</b> x Major MVP</span>` : '',
    rec.mvp.length ? `<span class="tw-chip slate"><b>${rec.mvp.length}</b> x MVP</span>` : '',
    best < 99 ? `<span class="tw-chip orange">Топ-20: лучшее <b>#${best}</b></span>` : ''
  ].join('');
  win.querySelector('.tw-pl-ach')?.remove();
  const html = `<div class="tw-pl-ach"><div class="tw-ach-head"><span>Достижения игрока</span><span class="tw-chips">${chips || '<span class="tw-none">пока нет</span>'}</span></div>` +
    `<div class="tw-strip tw-pl-strip">${stripHtml(items, 'Трофеев пока нет — они появятся за победы в турнирах, MVP и места в топ-20 года.', 'p')}</div></div>`;
  const anchor = win.querySelector('.hl-pl-top');
  if (anchor) anchor.insertAdjacentHTML('afterend', html); else win.querySelector('.hl-win-body')?.insertAdjacentHTML('afterbegin', html);
  wireStrip(win.querySelector('.tw-pl-strip'));
}
document.addEventListener('click', e => { // срабатывает после обработчика хаба (он зарегистрирован раньше)
  const c = e.target.closest?.('.hl-pcard[data-nick], .hl-mate[data-mate]'); if (!c) return;
  const team = c.dataset.team, nick = c.dataset.nick || c.dataset.mate;
  try { decoratePlayer(team, nick); } catch (err) { console.warn('[trophies] player', err); }
});
if (typeof window.hubOpenPlayer === 'function') {
  const origOP = window.hubOpenPlayer;
  window.hubOpenPlayer = function (team, nick) { const r = origOP.apply(this, arguments); try { decoratePlayer(team, nick); } catch (e) {} return r; };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
window.twDebug = { awardTournament, seasonAwards }; // для проверки из консоли
})();
