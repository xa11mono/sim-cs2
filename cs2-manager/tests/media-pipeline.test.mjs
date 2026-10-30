// Офлайн-проверка конвейера медиатеки на локальных тестовых изображениях.
// Поднимает HTTP-сервер, который отвечает как HLTV (поиск), Liquipedia (MediaWiki API) и Commons,
// и отдаёт PNG, сгенерированные здесь же. Запускает настоящий tools/media/autofill.mjs во временной папке.
// Запуск: NODE_PATH=$(npm root -g) node tests/media-pipeline.test.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { pick } from '../tools/media/lib/match.mjs';
import { sniff, validate } from '../tools/media/lib/store.mjs';
import { classify, BLOCK } from '../tools/media/lib/net.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

// PNG без зависимостей: прямоугольник цвета rgb на прозрачном фоне (как вырезанный логотип/фото).
function png(w, h, [r, g, b], box = [0.2, 0.15, 0.8, 1]) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = -1; for (const v of buf) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ -1) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * (w * 4 + 1) + 1 + x * 4, inside = x >= box[0] * w && x < box[2] * w && y >= box[1] * h && y < box[3] * h;
    if (inside) { raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

console.log('Модули');
{
  const p = png(64, 64, [200, 30, 30]);
  ok(sniff(p).ext === 'png' && sniff(p).w === 64, 'sniff читает тип и размер PNG');
  let e = ''; try { validate(Buffer.from('<html>Just a moment...</html>')); } catch (x) { e = x.message; } ok(/не является изображением/.test(e), 'HTML вместо картинки отклоняется');
  e = ''; try { validate(png(20, 20, [1, 1, 1])); } catch (x) { e = x.message; } ok(/маленькое/.test(e), 'слишком маленькое изображение отклоняется');
  e = ''; try { validate(Buffer.from('<svg onload="alert(1)"></svg>')); } catch (x) { e = x.message; } ok(/скрипт/.test(e), 'SVG со скриптом отклоняется');
  const H = new Headers();
  ok(classify(403, H, 'request blocked: no rule or allowlist entry allows host "x"') === BLOCK.SANDBOX, 'ответ шлюза среды → sandbox');
  ok(classify(403, H, '<title>Just a moment...</title>') === BLOCK.CHALLENGE, 'Cloudflare-проверка → challenge');
  ok(classify(403, H, 'Forbidden') === BLOCK.FORBIDDEN && classify(429, H, '') === BLOCK.RATE, '403 сайта → forbidden, 429 → rate');
  const ent = { kind: 'players', name: 'ryu', country: 'RU' };
  ok(!pick(ent, [{ name: 'ryu', country: 'KR', url: 'http://x/a.png' }]).hit, 'тот же ник, другая страна — не берём');
  ok(pick(ent, [{ name: 'ryu', country: 'KR', url: 'http://x/a.png' }, { name: 'Ryu', country: 'RU', url: 'http://x/b.png' }]).hit?.url === 'http://x/b.png', 'выбирается игрок с совпадающей страной');
  ok(!pick({ kind: 'players', name: 'kyxsan' }, [{ name: 'kyxsan', url: 'http://x/blankplayer.svg' }]).hit, 'заглушка источника не берётся');
  ok(!!pick({ kind: 'teams', name: 'Natus Vincere' }, [{ name: 'NAVI', url: 'http://x/n.png' }]).hit, 'псевдоним команды NAVI ↔ Natus Vincere');
  ok(!!pick({ kind: 'teams', name: 'Team Spirit' }, [{ name: 'Spirit', url: 'http://x/s.png' }]).hit, '«Team Spirit» ↔ «Spirit»');
  ok(!pick({ kind: 'teams', name: 'MOUZ' }, [{ name: 'MOUZ NXT', url: 'http://x/m.png' }]).hit, 'академия не подменяет основную команду');
}

// ── Тестовый сервер ─────────────────────────────────────────────────────────────────────────
const IMG = {
  'p-alpha.png': png(300, 400, [220, 180, 150]), 'p-beta.png': png(300, 400, [120, 160, 220]),
  'p-wrong.png': png(300, 400, [10, 200, 10]), 't-red.png': png(500, 300, [230, 40, 40], [0.1, 0.1, 0.9, 0.9]),
  't-wiki.png': png(400, 400, [240, 200, 0], [0.25, 0.25, 0.75, 0.75]), 'blank.png': png(300, 400, [128, 128, 128]),
  'ps-delta.png': png(300, 400, [200, 120, 60]), 'ps-team.png': png(400, 300, [60, 200, 120], [0.1, 0.2, 0.9, 0.8]), 'ps-league.png': png(300, 300, [250, 250, 250], [0.2, 0.2, 0.8, 0.8]),
  'sdb-team.png': png(300, 300, [120, 60, 220], [0.2, 0.2, 0.8, 0.8])
};
const hits = {};
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), key = u.pathname.split('/')[1] + u.pathname.replace(/^\/[^/]+/, '');
  hits[key] = (hits[key] || 0) + 1;
  const json = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname.startsWith('/img/')) { const b = IMG[u.pathname.slice(5)]; if (!b) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'image/png' }); return res.end(b); }
  if (u.pathname.startsWith('/ps/')) {
    if (req.headers.authorization !== 'Bearer TESTTOKEN') { res.writeHead(401); return res.end('unauthorized'); }
    const q = u.searchParams.get('search[name]'), base = `http://127.0.0.1:${srv.address().port}`;
    if (u.pathname === '/ps/csgo/players') return json(q === 'delta' ? [{ id: 101, name: 'delta', slug: 'delta', first_name: 'Del', last_name: 'Ta', nationality: 'FI', current_team: { name: 'Panda Five' }, image_url: `${base}/img/ps-delta.png` },
      { id: 102, name: 'delta', nationality: 'BR', image_url: `${base}/img/p-wrong.png` }] : []);
    if (u.pathname === '/ps/csgo/teams') return json(q === 'Panda Five' ? [{ id: 201, name: 'Panda Five Esports', acronym: 'P5', slug: 'p5', image_url: `${base}/img/ps-team.png`, players: [{ name: 'delta' }] }] : []);
    if (u.pathname === '/ps/csgo/leagues') return json(q === 'Panda Masters' ? [{ id: 301, name: 'Panda Masters', slug: 'panda-masters', image_url: `${base}/img/ps-league.png` }] : []);
    return json([]);
  }
  if (u.pathname === '/sdb/searchteams.php') { const t = u.searchParams.get('t'), base = `http://127.0.0.1:${srv.address().port}`;
    return json({ teams: t === 'Sports Club' ? [{ idTeam: '9', strTeam: 'Sports Club', strSport: 'ESports', strBadge: `${base}/img/sdb-team.png` }, { idTeam: '10', strTeam: 'Sports Club', strSport: 'Soccer', strBadge: `${base}/img/p-wrong.png` }] : null }); }
  if (u.pathname === '/sdb/searchplayers.php') return json({ player: null });
  if (u.pathname === '/hltv/search') {
    const t = u.searchParams.get('term'), base = `http://127.0.0.1:${srv.address().port}`;
    if (t === 'blocked') { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('<title>Just a moment...</title>'); }
    return json([{
      players: [
        { nickName: 'alpha', flagUrl: '/img/static/flags/30x20/RU.gif', pictureUrl: `${base}/img/p-alpha.png`, location: '/player/1/alpha' },
        { nickName: 'beta', flagUrl: '/img/static/flags/30x20/SE.gif', pictureUrl: `${base}/img/p-wrong.png`, location: '/player/2/beta' }, // однофамилец из другой страны
        { nickName: 'gamma', flagUrl: '/img/static/flags/30x20/DK.gif', pictureUrl: `${base}/img/static/player/blankplayer.png` }
      ].filter(p => p.nickName === t.toLowerCase()),
      teams: [{ name: 'Red Fox', teamLogo: `${base}/img/t-red.png`, location: '/team/9/red-fox' }].filter(x => x.name === t)
    }]);
  }
  if (u.pathname === '/lp/api.php') {
    const t = u.searchParams.get('gsrsearch'), base = `http://127.0.0.1:${srv.address().port}`;
    const pages = {
      beta: { title: 'Beta', index: 1, original: { source: `${base}/img/p-beta.png` }, categories: [{ title: 'Category:Players' }, { title: 'Category:Danish Players' }] },
      'Wiki Team': { title: 'Wiki Team', index: 1, categories: [{ title: 'Category:Teams' }] } // без картинки
    };
    return json({ query: { pages: pages[t] ? { 1: pages[t] } : {} } });
  }
  if (u.pathname === '/commons/w/api.php') {
    const t = u.searchParams.get('gsrsearch'), base = `http://127.0.0.1:${srv.address().port}`;
    return json({ query: { pages: t === 'Wiki Team logo' ? { 5: { title: 'File:Wiki_Team_logo.png', imageinfo: [{ url: `${base}/img/t-wiki.png`, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Wiki_Team_logo.png', mime: 'image/png' }] } } : {} } });
  }
  res.writeHead(404); res.end();
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port, B = `http://127.0.0.1:${port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs2media-'));
const media = path.join(tmp, 'media'), qf = path.join(tmp, 'queue.json'), ef = path.join(tmp, 'entities.json'), dropDir = path.join(tmp, 'drop');
fs.mkdirSync(media); fs.mkdirSync(path.join(dropDir, 'teams'), { recursive: true });
fs.writeFileSync(path.join(dropDir, 'teams', 'Local Heroes.png'), png(256, 256, [90, 200, 255], [0.3, 0.3, 0.7, 0.7]));
fs.writeFileSync(path.join(media, 'media-manifest.json'), JSON.stringify({ v: 1, sources: [], teams: { Old: { file: 'assets/media/teams/old.webp', src: 'liga' } }, players: {}, tournaments: {}, missing: {} }));
fs.writeFileSync(ef, JSON.stringify({
  teams: ['Red Fox', 'Wiki Team', 'Local Heroes', 'Nobody', 'Panda Five', 'Sports Club'], players: ['alpha', 'beta', 'gamma', 'blocked', 'delta'], tournaments: ['Panda Masters'],
  playerMeta: [{ nick: 'alpha', country: 'RU' }, { nick: 'beta', country: 'DK' }, { nick: 'gamma', country: 'DK' }, { nick: 'blocked', country: 'US' }, { nick: 'delta', country: 'FI', team: 'Panda Five' }]
}));
const run = (...extra) => {
  const env = { ...process.env, PANDASCORE_TOKEN: 'TESTTOKEN' }; delete env.HTTPS_PROXY; delete env.https_proxy; delete env.HTTP_PROXY; delete env.http_proxy;
  return promisify(execFile)(process.execPath, [path.join(ROOT, 'tools/media/autofill.mjs'), '--media-dir', media, '--queue', qf, '--entities', ef,
    '--base', JSON.stringify({ pandascore: B + '/ps', sportsdb: B + '/sdb', hltv: B + '/hltv', liquipedia: B + '/lp', commons: B + '/commons' }), '--delay', '50', '--from-dir', dropDir, ...extra],
  { env, encoding: 'utf8' }).then(r => r.stdout).catch(e => { console.log(e.stdout, e.stderr); throw e; });
};

console.log('\nКонвейер: поиск → сопоставление → очередь → скачивание → обработка → manifest');
const out1 = await run();
const man = JSON.parse(fs.readFileSync(path.join(media, 'media-manifest.json'), 'utf8'));
const js = fs.readFileSync(path.join(media, 'media-manifest.js'), 'utf8');
ok(man.players.alpha?.src === 'hltv', 'alpha: фото с HLTV (страна совпала)');
ok(man.players.beta?.src === 'liquipedia', 'beta: HLTV-однофамилец из SE отклонён, взято фото с Liquipedia (DK)');
ok(!man.players.gamma && man.missing.players?.includes('gamma'), 'gamma: заглушка HLTV не сохранена, игрок в missing');
ok(man.teams['Red Fox']?.src === 'hltv' && man.teams['Wiki Team']?.src === 'commons', 'логотипы: HLTV и Commons как запасной источник');
ok(man.teams['Local Heroes']?.src === 'folder', 'логотип из локальной папки пользователя');
ok(man.teams.Old?.src === 'liga', 'существующие записи manifest сохранены');
ok(man.players.delta?.src === 'pandascore' && man.players.delta.ext === 'pandascore:101', 'PandaScore: фото игрока, страна FI совпала, бразильский однофамилец отклонён, внешний ID записан');
ok(man.teams['Panda Five']?.src === 'pandascore' && man.tournaments['Panda Masters']?.src === 'pandascore', 'PandaScore: логотип команды («Panda Five Esports», P5) и логотип серии турниров');
ok(man.teams['Sports Club']?.src === 'sportsdb', 'TheSportsDB: логотип только из раздела ESports (футбольный клуб с тем же названием отклонён)');
ok(fs.existsSync(path.join(media, 'tournaments/pandamasters.webp')), 'логотип турнира обработан в tournaments/');
ok(![path.join(media, 'media-manifest.json'), path.join(media, 'media-manifest.js'), qf].some(f => fs.readFileSync(f, 'utf8').includes('TESTTOKEN')), 'токен PandaScore не записан ни в manifest, ни в очередь');
for (const f of ['players/alpha.webp', 'players/full/alpha.webp', 'players/beta.webp', 'teams/redfox.webp', 'teams/wikiteam.webp', 'teams/localheroes.webp'])
  ok(fs.existsSync(path.join(media, f)) && sniff(fs.readFileSync(path.join(media, f)))?.ext === 'webp', `обработанный файл ${f} (WebP)`);
const head = sniff(fs.readFileSync(path.join(media, 'players/alpha.webp'))), logo = sniff(fs.readFileSync(path.join(media, 'teams/redfox.webp')));
ok(head.w === 256 && head.h === 256 && logo.w === 256 && logo.h === 256, `размеры после обработки: фото ${head.w}×${head.h}, логотип ${logo.w}×${logo.h}`);
ok(!fs.existsSync(path.join(media, '.raw')), '.raw очищен после обработки');
ok(js.startsWith('/*') && js.includes('window.CS2_MEDIA') && js.includes('"Red Fox"'), 'media-manifest.js для игры обновлён');
ok(man.players.alpha.sha1?.length === 40 && man.players.alpha.page.endsWith('/player/1/alpha'), 'в manifest записаны sha1 и страница-источник');
ok(/источник HLTV\.org отключён до конца запуска: .*антибот/.test(out1), 'антибот-ответ HLTV: источник отключён, без повторов и обхода');
const q1 = JSON.parse(fs.readFileSync(qf, 'utf8'));
ok(q1.items['players:blocked'].state === 'missing' || q1.items['players:blocked'].state === 'pending', 'игрок, на котором сработала защита, не потерян в очереди');
ok(q1.blocked.hltv?.kind === 'challenge', 'причина отказа источника записана в очередь');

console.log('\nПовторный запуск (возобновление)');
const before = { ...hits };
await run();
const q2 = JSON.parse(fs.readFileSync(qf, 'utf8'));
const repeated = Object.keys(hits).filter(k => k.startsWith('img') && hits[k] !== before[k]);
ok(repeated.length === 0, 'уже скачанные изображения не запрашиваются повторно');
ok((hits['lp/api.php'] - before['lp/api.php']) === 0, 'Liquipedia: на уже отвеченные поиски запросы не повторяются');
ok(q2.items['players:alpha'].state === 'done' && q2.items['teams:Nobody'].state === 'missing', 'состояния очереди сохранены между запусками');

console.log('\nОбновление (--refresh): заменить запись из старого источника, если HLTV нашёл актуальную');
const m2 = JSON.parse(fs.readFileSync(path.join(media, 'media-manifest.json'), 'utf8'));
m2.players.alpha.src = 'liga'; fs.writeFileSync(path.join(media, 'media-manifest.json'), JSON.stringify(m2));
const out3 = await run('--refresh', '--only', 'players', '--sources', 'hltv');
const m3 = JSON.parse(fs.readFileSync(path.join(media, 'media-manifest.json'), 'utf8'));
ok(m3.players.alpha.src === 'hltv' && m3.players.alpha.replaced === 'liga', 'alpha обновлён с HLTV, отмечено, что заменено');
ok(m3.players.beta.src === 'liquipedia', 'beta сохранил фото: на HLTV только однофамилец');
ok(/Итог/.test(out3), 'запуск завершился с итоговой сводкой');

srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} пройдено, ${fail} не пройдено`);
process.exit(fail ? 1 : 0);
