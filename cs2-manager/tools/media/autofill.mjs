#!/usr/bin/env node
// AUTO-FILL ALL MEDIA — дозаполнение медиатеки CS2 Manager из публичных источников.
//
//   node tools/media/autofill.mjs --check            диагностика доступа к каждому источнику (по одному запросу)
//   node tools/media/autofill.mjs                    скачать недостающее: PandaScore → HLTV → Liquipedia → Commons → TheSportsDB
//   PANDASCORE_TOKEN=… в окружении включает PandaScore (основной источник); THESPORTSDB_KEY — свой ключ TheSportsDB (по умолчанию открытый «3»)
//   node tools/media/autofill.mjs --refresh          заменить имеющиеся фото/логотипы актуальными с HLTV (если найдены)
//   node tools/media/autofill.mjs --from-dir ~/pics  взять файлы из своей папки (имя файла = ник или название команды)
// Прочие флаги: --only players|teams|tournaments, --limit N, --sources hltv,liquipedia,commons, --retry-missing,
//   --dry-run (только поиск и сопоставление), --no-process, --delay мс (пауза на хост, по умолчанию 2000).
//
// Очередь и прогресс: tools/media/.autofill-queue.json — повторный запуск продолжает с места остановки
// и не повторяет запросы, на которые уже получен ответ. Скачанное проверяется (тип, размер, дубликаты),
// складывается в assets/media/.raw и обрабатывается process.mjs (обрезка, центрирование, WebP).
// Защиту сайтов скрипт не обходит: при запрете или антибот-проверке источник отключается до конца запуска.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createNet, probeHost, BLOCK, SourceError } from './lib/net.mjs';
import { ALL, folder } from './lib/sources.mjs';
import { pick } from './lib/match.mjs';
import { openQueue } from './lib/queue.mjs';
import { openStore } from './lib/store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const MEDIA = path.resolve(opt('--media-dir') || process.env.CS2_MEDIA_DIR || path.join(ROOT, 'assets', 'media'));
const QFILE = path.resolve(opt('--queue') || path.join(HERE, '.autofill-queue.json'));
const ENTS = path.resolve(opt('--entities') || path.join(HERE, 'entities.json'));
const only = opt('--only'), limit = +opt('--limit') || Infinity, refresh = !!opt('--refresh'), dry = !!opt('--dry-run');
const base = opt('--base') ? JSON.parse(opt('--base')) : null; // адреса тестового сервера (tests/media-pipeline.test.mjs)
const order = (typeof opt('--sources') === 'string' ? opt('--sources') : 'pandascore,hltv,liquipedia,commons,sportsdb').split(',').map(s => s.trim()).filter(s => ALL[s]);
const sources = order.map(s => ALL[s]).filter(s => {
  if (s.needs && !process.env[s.needs]) { console.log(`${s.name}: пропущен — нет переменной окружения ${s.needs} (токен в файлы не записывается)`); return false; }
  return true;
});
if (typeof opt('--from-dir') === 'string') sources.unshift(folder(path.resolve(opt('--from-dir'))));

// ── Диагностика ─────────────────────────────────────────────────────────────────────────────
if (opt('--check')) {
  console.log(process.env.HTTPS_PROXY ? 'Исходящий трафик идёт через прокси среды — читаю ответ шлюза.' : 'Прямое подключение.');
  const rows = [];
  for (const s of Object.values(ALL)) for (const h of s.hosts) {
    const r = await probeHost(h);
    rows.push(r);
    const who = r.ok ? 'доступен' : r.kind === BLOCK.SANDBOX ? 'ЗАПРЕТ ШЛЮЗА СРЕДЫ (до сайта не дошло)' : r.via === 'proxy' ? 'отказ прокси/апстрима' : 'нет соединения';
    console.log(`${s.name.padEnd(18)} ${h.padEnd(24)} ${who}${r.detail ? ' — ' + r.detail : ''}`);
  }
  if (rows.some(r => r.kind === BLOCK.SANDBOX)) console.log('\nПричина: сетевая политика облачной среды не пускает эти хосты. Решение: добавить их в Allowed domains\nсреды (Network access → Custom) или запустить этот скрипт на своём компьютере.');
  process.exit(0);
}

// ── Очередь ─────────────────────────────────────────────────────────────────────────────────
const store = openStore(MEDIA), man = store.man, q = openQueue(QFILE);
const ents = fs.existsSync(ENTS) ? JSON.parse(fs.readFileSync(ENTS, 'utf8')) : {};
const meta = Object.fromEntries((ents.playerMeta || []).map(x => [x.nick, x]));
const kinds = ['teams', 'players', 'tournaments'].filter(k => !only || only === k);
for (const kind of kinds) {
  const names = new Set([...(man.missing[kind] || []), ...(ents[kind] || [])]);
  for (const n of names) if (!store.has(kind, n)) q.add(kind, n);
  if (refresh) for (const [n, e] of Object.entries(man[kind])) if (e.src !== 'hltv') { const it = q.add(kind, n, { force: true }); it.refresh = true; }
}
q.save();

const net = createNet({ delay: +opt('--delay') || 2000 });
const ctx = { net, base };
const off = new Map();                 // источники, отключённые в этом запуске: id → причина
const netErrors = new Map();
const entOf = it => ({ kind: it.kind, name: it.name, country: meta[it.name]?.country, team: meta[it.name]?.team });

async function fetchImage(src, hit) {
  if (hit.url.startsWith('file://')) return fs.readFileSync(fileURLToPath(hit.url));
  return (await net.binary(hit.url, { referer: src.home })).buf;
}
function sourceDown(src, e) {
  if ([BLOCK.SANDBOX, BLOCK.CHALLENGE, BLOCK.FORBIDDEN, BLOCK.RATE].includes(e.kind) ||
      (e.kind === BLOCK.NETWORK && (netErrors.set(src.id, (netErrors.get(src.id) || 0) + 1), netErrors.get(src.id) >= 3))) {
    off.set(src.id, e.message); q.block(src.id, { kind: e.kind, detail: e.message, status: e.status });
    console.log(`  ✕ источник ${src.name} отключён до конца запуска: ${e.message}`);
    return true;
  }
  return false;
}

const work = q.ready({ retryMissing: !!opt('--retry-missing') }).slice(0, limit);
console.log(`Медиатека: ${MEDIA}\nИсточники: ${sources.map(s => s.name).join(' → ')}\nВ работе: ${work.length} (всего в очереди: ${JSON.stringify(q.stats())})`);
let got = 0, miss = 0;
for (const it of work) {
  if (it.state === 'downloaded') continue;                       // ждёт только обработки
  const ent = entOf(it);
  const usable = sources.filter(s => s.kinds.includes(it.kind) && (!it.refresh || ['pandascore', 'hltv', 'folder'].includes(s.id)));
  let done = false, pending = false;
  for (const src of usable) {
    if (off.has(src.id)) { pending = true; continue; }
    if (it.tried[src.id] === 'none' && !opt('--retry-missing')) continue; // уже искали — не повторяем запрос
    let cands;
    try { cands = await src.search(it.kind, ent, ctx); netErrors.delete(src.id); }
    catch (e) {
      if (e instanceof SourceError && sourceDown(src, e)) { pending = true; continue; }
      it.tried[src.id] = 'error: ' + e.message; pending = true; continue;
    }
    const r = pick(ent, cands);
    if (!r.hit) { it.tried[src.id] = 'none'; it.why = r.why; continue; }
    if (dry) { console.log(`? ${it.kind} ${it.name} ← ${src.id}: ${r.hit.url} (${r.why}, ${r.score})`); it.tried[src.id] = 'dry'; done = true; break; }
    try {
      const buf = await fetchImage(src, r.hit);
      const info = store.put(it.kind, it.name, buf, { src: src.id, page: r.hit.page, url: r.hit.url, ext: r.hit.ext }, src);
      Object.assign(it, { state: 'downloaded', src: src.id, error: undefined }); it.tried[src.id] = 'ok';
      console.log(`+ ${it.kind} ${it.name} ← ${src.name} (${info.ext} ${info.w || '?'}×${info.h || '?'}, ${r.why})`);
      got++; done = true; store.write(); break;
    } catch (e) {
      if (e instanceof SourceError && sourceDown(src, e)) { pending = true; continue; }
      it.tried[src.id] = 'error: ' + e.message; console.log(`  ! ${it.name}: ${src.id} — ${e.message}`);
    }
  }
  if (!done && !dry) {
    if (pending) it.state = 'pending';                           // источник был недоступен — попробуем в следующий раз
    else if (Object.values(it.tried).some(v => v.startsWith('error'))) q.fail(it, Object.values(it.tried).find(v => v.startsWith('error')));
    else if (it.refresh) it.state = 'done';                      // актуальнее нет — оставляем имеющееся
    else { it.state = 'missing'; store.markMissing(it.kind, it.name); miss++; console.log(`- ${it.kind} ${it.name}: не найдено (${it.why || 'нет кандидатов'})`); }
  }
  q.save();
}
if (miss) store.write();

// ── Обработка скачанного ────────────────────────────────────────────────────────────────────
const waiting = Object.values(q.data.items).filter(i => i.state === 'downloaded');
if (waiting.length && !opt('--no-process') && !dry) {
  execFileSync(process.execPath, [path.join(HERE, 'process.mjs')], { stdio: 'inherit', env: { ...process.env, CS2_MEDIA_DIR: MEDIA } });
  waiting.forEach(i => { i.state = 'done'; }); q.save();
}
q.data.runs.push({ at: new Date().toISOString(), got, miss, off: Object.fromEntries(off) }); q.data.runs = q.data.runs.slice(-20); q.save();
console.log(`\nИтог: скачано ${got}, не найдено ${miss}, очередь ${JSON.stringify(q.stats())}`);
if (off.size) {
  console.log('Недоступные источники:'); for (const [id, why] of off) console.log(`  ${id}: ${why}`);
  if ([...off.values()].some(v => /шлюза среды/.test(v))) console.log('Это ограничение сети среды выполнения, а не сайта. Запустите скрипт на своём компьютере (см. tools/media/README.md).');
}
