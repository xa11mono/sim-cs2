// Проверочная страница: собранная <карта>-radar.html + отметки владельца из хранилища артефакта, зашитые в файл.
// Открывается в обычном браузере (file://), F5 работает, отметки читаются как обычно (localStorage страницы).
//   node tools/dsh/make_check_page.mjs --map=mirage [--session=<id>]
// Ключ sim_marks пишется только если в файле-странице его ещё нет — свои отметки не затирает.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || 'true'];
}));
const MAP = args.map || 'mirage';
const DSH = process.env.DSH_HOME || join(homedir(), '.dsh');
const PAGE = join('C:/Projects/sim-cs2', `${MAP}-radar.html`);
const OUT = join('C:/Projects/sim-cs2', `${MAP}-radar-check.html`);

function newestSession() {
  const base = join(DSH, 'sessions');
  let best = null;
  for (const dir of readdirSync(base)) {
    const sub = join(base, dir);
    if (!statSync(sub).isDirectory()) continue;
    for (const id of readdirSync(sub)) {
      const log = join(sub, id, 'session.v4.jsonl.zstd');
      if (!existsSync(log)) continue;
      const m = statSync(log).mtimeMs;
      if (!best || m > best.mtime) best = { id, mtime: m };
    }
  }
  return best && best.id;
}

const session = args.session || newestSession();
const kvPath = join(DSH, 'artifacts', 'kv', session, `${MAP}-radar.json`);
let marks = null;
if (existsSync(kvPath)) {
  const kv = JSON.parse(readFileSync(kvPath, 'utf8'));
  const raw = kv?.personal?.sim_marks;
  if (typeof raw === 'string') marks = JSON.parse(raw);
}

let html = readFileSync(PAGE, 'utf8');
if (Array.isArray(marks) && marks.length) {
  const payload = JSON.stringify(marks).replace(/<\//g, '<\\/');
  const inject = `<script>(function(){try{if(!localStorage.getItem("sim_marks"))localStorage.setItem("sim_marks",${JSON.stringify(payload)});}catch(e){}})();</script>`;
  const at = html.indexOf('<body>');
  if (at < 0) throw new Error('в странице нет <body>');
  html = html.slice(0, at + 6) + inject + html.slice(at + 6);
}
writeFileSync(OUT, html, 'utf8');
console.log(`${OUT}: ${Buffer.byteLength(html, 'utf8')} байт, отметок внутри: ${Array.isArray(marks) ? marks.length : 0} (сессия ${session})`);
