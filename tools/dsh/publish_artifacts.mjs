// Публикация готовой страницы как артефакта плагина dsh-artifacts-felix — одна команда.
//   node tools/dsh/publish_artifacts.mjs --map=mirage [--session=<id>] [--title="Mirage — радар"]
// Страницу сначала собирает mkpub: python src/mkpub.py --map=<карта>
// Что делает: кладёт содержимое страницы в хранилище плагина (блики + индекс сессии) и добавляет новую версию артефакта
// с тем же id — отметки, сохранённые в окне артефакта (window.storage), остаются на месте.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || 'true'];
}));
const MAP = args.map || 'mirage';
const ROOT = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'artifacts');
const PAGE = join('C:/Projects/sim-cs2', `${MAP}-radar.html`);

// Сессия: id из самого свежего журнала сессии этой папки (журналы лежат как $DSH_HOME/sessions/<папка>/<id>/session.v4.jsonl.zstd).
function newestSession() {
  const base = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions');
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

const SESSION = args.session || newestSession();
if (!SESSION) throw new Error('не нашёл сессию: укажи --session=<id>');
if (!existsSync(PAGE)) throw new Error(`нет страницы ${PAGE}: сначала python src/mkpub.py --map=${MAP}`);

const id = `${MAP}-radar`;
const title = args.title || `${MAP[0].toUpperCase() + MAP.slice(1)} — радар`;
const content = readFileSync(PAGE, 'utf8');
const canonical = JSON.stringify({ type: 'html', title, content });
const sha = createHash('sha256').update(canonical).digest('hex');
const blobDir = join(ROOT, 'blobs', sha.slice(0, 2));
const blob = join(blobDir, `${sha}.json`);
mkdirSync(blobDir, { recursive: true });
if (!existsSync(blob)) { writeFileSync(`${blob}.tmp`, canonical, 'utf8'); renameSync(`${blob}.tmp`, blob); }

const indexPath = join(ROOT, 'sessions', `${SESSION}.json`);
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { format: 1, artifacts: {} };
const versions = index.artifacts[id] ?? (index.artifacts[id] = []);
const last = versions.at(-1);
const bytes = Buffer.byteLength(content, 'utf8');
if (last?.sha === sha) {
  console.log(`${id}: содержимое не изменилось (v${last.version}), публиковать нечего`);
} else {
  versions.push({ version: (last?.version ?? 0) + 1, sha, type: 'html', title, command: last ? 'rewrite' : 'create', createdAt: Date.now(), bytes });
  writeFileSync(`${indexPath}.tmp`, JSON.stringify(index), 'utf8');
  renameSync(`${indexPath}.tmp`, indexPath);
  console.log(`${id}: опубликована версия ${versions.at(-1).version} (${bytes} байт), сессия ${SESSION}`);
}

// Блики, на которые индекс больше не ссылается.
const live = new Set();
for (const vs of Object.values(index.artifacts)) for (const v of vs) live.add(v.sha);
let removed = 0;
for (const sub of readdirSync(join(ROOT, 'blobs'))) {
  const dir = join(ROOT, 'blobs', sub);
  for (const name of readdirSync(dir)) {
    if (!live.has(name.replace(/\.json$/, ''))) { unlinkSync(join(dir, name)); removed += 1; }
  }
}
if (removed) console.log('убрано старых бликов:', removed);
