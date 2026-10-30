// Сопоставление найденных кандидатов с сущностями игры. Лучше пропустить, чем показать чужое фото:
// игрок принимается только при точном нике и без противоречий по стране; при двух равных кандидатах — отказ.
export const slug = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Типичные отличия названий команд в источниках («Team Spirit» ↔ «Spirit», «Natus Vincere» ↔ «NAVI»).
const TEAM_NOISE = /\b(team|esports?|gaming|club|e-?sports?|org)\b/gi;
export const teamKey = s => slug(String(s ?? '').replace(TEAM_NOISE, ' ')) || slug(s);
export const ALIASES = {
  'natusvincere': ['navi'], 'navi': ['natusvincere'], 'ninjasinpyjamas': ['nip'], 'nip': ['ninjasinpyjamas'],
  'mousesports': ['mouz'], 'mouz': ['mousesports'], 'g2': ['g2esports'], 'faze': ['fazeclan'], 'fazeclan': ['faze'],
  'vitality': ['teamvitality'], 'heroic': ['heroicgg'], 'mibr': ['madeinbrazil'], 'big': ['berlininternationalgaming']
};
const teamKeys = s => { const k = teamKey(s); return new Set([k, slug(s), ...(ALIASES[k] || []), ...(ALIASES[slug(s)] || [])]); };

const countryOf = c => (c || '').toUpperCase().slice(0, 2);

// cand: { name, country?, team?, url, page, src, quality? }
// ent:  { kind, name, country?, team?, aliases? }
export function score(ent, cand) {
  if (!cand?.url) return { score: 0, why: 'нет ссылки на изображение' };
  if (/blankplayer|placeholder|default[-_]?(avatar|logo)|nologo/i.test(cand.url)) return { score: 0, why: 'заглушка источника' };
  if (ent.kind === 'players') {
    const names = [ent.name, ...(ent.aliases || [])].map(slug);
    if (!names.includes(slug(cand.name))) return { score: 0, why: 'ник не совпадает' };
    let s = 60;
    if (ent.country && cand.country) { if (countryOf(ent.country) !== countryOf(cand.country)) return { score: 0, why: `страна ${cand.country} ≠ ${ent.country}` }; s += 25; }
    if (ent.team && cand.team) s += [...teamKeys(ent.team)].some(k => teamKeys(cand.team).has(k)) ? 15 : -10;
    return { score: s + (cand.quality || 0), why: 'ник' + (cand.country ? ' + страна' : '') };
  }
  const a = teamKeys(ent.name), b = teamKeys(cand.name);
  if (cand.alt) teamKeys(cand.alt).forEach(k => b.add(k));
  if ([...a].some(k => b.has(k))) return { score: 80 + (slug(ent.name) === slug(cand.name) ? 15 : 0) + (cand.quality || 0), why: 'название' };
  if (ent.kind === 'tournaments' && slug(cand.name).includes(slug(ent.name))) return { score: 60, why: 'название турнира' };
  return { score: 0, why: 'название не совпадает' };
}

export const THRESHOLD = 60;

// Лучший кандидат или причина отказа. Для игроков ничья между разными фото без страны — отказ.
export function pick(ent, cands) {
  const rated = cands.map(c => ({ c, ...score(ent, c) })).filter(r => r.score >= THRESHOLD).sort((x, y) => y.score - x.score);
  if (!rated.length) return { hit: null, why: cands.length ? score(ent, cands[0]).why : 'нет кандидатов' };
  if (ent.kind === 'players' && rated[1] && rated[1].score === rated[0].score && rated[1].c.url !== rated[0].c.url && !ent.country)
    return { hit: null, why: 'несколько игроков с таким ником — неоднозначно' };
  return { hit: rated[0].c, score: rated[0].score, why: rated[0].why };
}
