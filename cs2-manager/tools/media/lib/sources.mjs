// Адаптеры источников изображений. Общий интерфейс:
//   { id, name, home, hosts[], kinds[], search(kind, ent, ctx) → [{ name, country?, team?, url, page, quality? }] }
// ctx = { net, base }: base — переопределение адресов (тестовый сервер), иначе реальные хосты.
// Адаптеры только читают публичные поисковые ответы; при отказе бросают SourceError и не повторяют запрос.
import fs from 'node:fs';
import path from 'node:path';
import { slug, teamKey } from './match.mjs';

const b = (ctx, key, def) => (ctx.base && ctx.base[key]) || def;

// Демонимы Liquipedia («Russian Players») → код страны, чтобы проверять, что это тот же человек.
const DEMONYM = {
  Russian: 'RU', Ukrainian: 'UA', Kazakh: 'KZ', Kazakhstani: 'KZ', Belarusian: 'BY', Danish: 'DK', Swedish: 'SE', Norwegian: 'NO', Finnish: 'FI',
  French: 'FR', German: 'DE', Polish: 'PL', Czech: 'CZ', Slovak: 'SK', Hungarian: 'HU', Romanian: 'RO', Bulgarian: 'BG', Serbian: 'RS',
  'Bosnian': 'BA', Croatian: 'HR', Slovenian: 'SI', Latvian: 'LV', Lithuanian: 'LT', Estonian: 'EE', British: 'GB', English: 'GB', Scottish: 'GB',
  Irish: 'IE', Dutch: 'NL', Belgian: 'BE', Portuguese: 'PT', Spanish: 'ES', Italian: 'IT', Turkish: 'TR', Israeli: 'IL', Brazilian: 'BR',
  Argentine: 'AR', Argentinian: 'AR', Chilean: 'CL', Uruguayan: 'UY', American: 'US', Canadian: 'CA', Mexican: 'MX', Australian: 'AU',
  'New Zealand': 'NZ', Mongolian: 'MN', Chinese: 'CN', Japanese: 'JP', Korean: 'KR', 'South Korean': 'KR', Indonesian: 'ID', Thai: 'TH',
  Filipino: 'PH', Malaysian: 'MY', Singaporean: 'SG', Indian: 'IN', Jordanian: 'JO', Saudi: 'SA', Emirati: 'AE', Swiss: 'CH', Austrian: 'AT',
  Greek: 'GR', Macedonian: 'MK', Montenegrin: 'ME', Kosovar: 'XK', Albanian: 'AL', Georgian: 'GE', Armenian: 'AM', Uzbek: 'UZ', Kyrgyz: 'KG',
  'South African': 'ZA', Peruvian: 'PE', Colombian: 'CO', Venezuelan: 'VE', Guatemalan: 'GT'
};
const countryFromCats = cats => { for (const c of cats) { const m = c.match(/Category:(.+?) Players$/); if (m && DEMONYM[m[1]]) return DEMONYM[m[1]]; } return null; };
const flagCountry = url => ((url || '').match(/\/([A-Za-z]{2})\.(?:gif|png|svg)/) || [])[1]?.toUpperCase() || null;

export const hltv = {
  id: 'hltv', name: 'HLTV.org', home: 'https://www.hltv.org/', hosts: ['www.hltv.org', 'img-cdn.hltv.org'], kinds: ['players', 'teams'],
  // Поисковый ответ сайта (тот же, что использует строка поиска на hltv.org) — JSON с фото игроков и логотипами.
  async search(kind, ent, ctx) {
    const base = b(ctx, 'hltv', 'https://www.hltv.org');
    const j = await ctx.net.json(`${base}/search?term=${encodeURIComponent(ent.name)}`, { referer: base + '/' });
    const blocks = Array.isArray(j) ? j : [j];
    if (kind === 'players') return blocks.flatMap(x => x.players || []).map(p => ({
      name: p.nickName, country: flagCountry(p.flagUrl), team: p.team?.name, url: p.pictureUrl,
      page: p.location ? new URL(p.location, base).href : base, quality: 10
    }));
    return blocks.flatMap(x => x.teams || []).map(t => ({
      // Тёмная тема интерфейса: берём вариант логотипа для тёмного фона, если он есть.
      name: t.name, url: t.teamLogoDark || t.teamLogo || t.teamLogoLight, page: t.location ? new URL(t.location, base).href : base, quality: 10
    }));
  }
};

export const liquipedia = {
  id: 'liquipedia', name: 'Liquipedia', home: 'https://liquipedia.net/counterstrike/', hosts: ['liquipedia.net'], kinds: ['players', 'teams', 'tournaments'],
  // MediaWiki API: поиск страниц + главное изображение страницы + категории (для проверки «это игрок/команда» и страны).
  async search(kind, ent, ctx) {
    const base = b(ctx, 'liquipedia', 'https://liquipedia.net/counterstrike');
    const u = `${base}/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(ent.name)}&gsrlimit=6&prop=pageimages|categories&piprop=original&cllimit=max`;
    const j = await ctx.net.json(u);
    const pages = Object.values(j?.query?.pages || {}).sort((x, y) => (x.index || 0) - (y.index || 0));
    return pages.map(p => {
      const cats = (p.categories || []).map(c => c.title);
      const isPlayer = cats.some(c => /Players$/.test(c)), isTeam = cats.some(c => /Teams$/.test(c)), isEvent = cats.some(c => /Tournaments$/.test(c));
      if ((kind === 'players' && !isPlayer) || (kind === 'teams' && !isTeam) || (kind === 'tournaments' && !isEvent)) return null;
      return { name: p.title.replace(/\s*\(.*\)$/, ''), country: kind === 'players' ? countryFromCats(cats) : null, url: p.original?.source,
        page: `${base}/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, quality: 5 };
    }).filter(Boolean);
  }
};

export const commons = {
  id: 'commons', name: 'Wikimedia Commons', home: 'https://commons.wikimedia.org/', hosts: ['commons.wikimedia.org', 'upload.wikimedia.org'],
  kinds: ['teams', 'tournaments'], // для игроков не используем: ники совпадают с реальными людьми вне киберспорта
  async search(kind, ent, ctx) {
    const base = b(ctx, 'commons', 'https://commons.wikimedia.org');
    const u = `${base}/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(ent.name + ' logo')}&gsrlimit=5&prop=imageinfo&iiprop=url|mime`;
    const j = await ctx.net.json(u);
    return Object.values(j?.query?.pages || {}).filter(p => p.imageinfo?.[0]?.url && /image\//.test(p.imageinfo[0].mime || 'image/')).map(p => ({
      name: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/[_-]?logo.*$/i, '').replace(/_/g, ' ').trim(),
      url: p.imageinfo[0].url, page: p.imageinfo[0].descriptionurl, quality: 0
    }));
  }
};

// Локальная папка: файлы, которые пользователь скачал сам (например, с ПК), — имя файла = ник или название.
// Подпапки players/ teams/ tournaments/ или префиксы «players-», «teams-».
export function folder(dir) {
  const IMG = /\.(png|jpe?g|webp|svg|gif)$/i;
  let index = null;
  const scan = () => {
    index = { players: [], teams: [], tournaments: [] };
    const walk = (d, kind) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, f.name);
      if (f.isDirectory()) { walk(full, ['players', 'teams', 'tournaments'].includes(f.name) ? f.name : kind); continue; }
      if (!IMG.test(f.name)) continue;
      const m = f.name.match(/^(players|teams|tournaments)-(.+)$/), k = m ? m[1] : kind, base = (m ? m[2] : f.name).replace(IMG, '');
      if (k) index[k].push({ name: base, file: full });
    } };
    walk(dir, null);
  };
  return {
    id: 'folder', name: 'Локальная папка', home: 'file://' + path.resolve(dir), hosts: [], kinds: ['players', 'teams', 'tournaments'], local: true,
    async search(kind, ent) {
      if (!index) scan();
      const key = kind === 'players' ? slug(ent.name) : teamKey(ent.name);
      return index[kind].filter(x => (kind === 'players' ? slug(x.name) : teamKey(x.name)) === key || slug(x.name) === slug(ent.name))
        .map(x => ({ name: ent.name, country: null, url: 'file://' + path.resolve(x.file), page: 'file://' + path.resolve(x.file), quality: 20 }));
    }
  };
}

// PandaScore (основной источник для CS2): REST API с токеном из переменной окружения PANDASCORE_TOKEN.
// /csgo/players и /csgo/teams отдают image_url, страну, текущую команду и внешний ID; логотипы серий — /csgo/leagues.
const PS_COUNTRY = c => (c || '').toUpperCase().slice(0, 2) || null;
export const pandascore = {
  id: 'pandascore', name: 'PandaScore', home: 'https://pandascore.co/', hosts: ['api.pandascore.co', 'cdn.pandascore.co'], kinds: ['players', 'teams', 'tournaments'],
  needs: 'PANDASCORE_TOKEN',
  async search(kind, ent, ctx) {
    const token = ctx.env?.PANDASCORE_TOKEN || process.env.PANDASCORE_TOKEN;
    if (!token) return [];
    const base = b(ctx, 'pandascore', 'https://api.pandascore.co');
    const path = kind === 'players' ? 'csgo/players' : kind === 'teams' ? 'csgo/teams' : 'csgo/leagues';
    const list = await ctx.net.json(`${base}/${path}?search[name]=${encodeURIComponent(ent.name)}&per_page=10`, { auth: token });
    return (Array.isArray(list) ? list : []).map(x => kind === 'players' ? {
      name: x.name, country: PS_COUNTRY(x.nationality), team: x.current_team?.name, url: x.image_url,
      page: `https://pandascore.co/csgo/players/${x.slug || x.id}`, ext: 'pandascore:' + x.id, realName: [x.first_name, x.last_name].filter(Boolean).join(' '), quality: 15
    } : {
      name: x.name, alt: x.acronym, url: (kind === 'teams' && x.dark_mode_image_url) || x.image_url,
      page: `https://pandascore.co/csgo/${kind === 'teams' ? 'teams' : 'leagues'}/${x.slug || x.id}`, ext: 'pandascore:' + x.id,
      roster: (x.players || []).map(p => p.name), quality: 15
    }).filter(c => c.url);
  }
};

// TheSportsDB (дополнительный): открытый ключ «3» из документации, ESports — команды (strBadge/strLogo) и игроки (strCutout/strThumb).
export const sportsdb = {
  id: 'sportsdb', name: 'TheSportsDB', home: 'https://www.thesportsdb.com/', hosts: ['www.thesportsdb.com', 'r2.thesportsdb.com'], kinds: ['players', 'teams'],
  async search(kind, ent, ctx) {
    const base = b(ctx, 'sportsdb', 'https://www.thesportsdb.com/api/v1/json/' + (process.env.THESPORTSDB_KEY || '3'));
    if (kind === 'teams') {
      const j = await ctx.net.json(`${base}/searchteams.php?t=${encodeURIComponent(ent.name)}`);
      return (j?.teams || []).filter(t => /e-?sports/i.test(t.strSport || '')).map(t => ({ name: t.strTeam, alt: t.strTeamShort, url: t.strBadge || t.strLogo,
        page: `https://www.thesportsdb.com/team/${t.idTeam}`, ext: 'sportsdb:' + t.idTeam, quality: 3 })).filter(c => c.url);
    }
    const j = await ctx.net.json(`${base}/searchplayers.php?p=${encodeURIComponent(ent.name)}`);
    return (j?.player || []).filter(p => /e-?sports/i.test(p.strSport || '')).map(p => ({ name: p.strPlayer, country: null, team: p.strTeam, url: p.strCutout || p.strThumb,
      page: `https://www.thesportsdb.com/player/${p.idPlayer}`, ext: 'sportsdb:' + p.idPlayer, quality: 3 })).filter(c => c.url);
  }
};

export const ALL = { pandascore, hltv, liquipedia, commons, sportsdb };
