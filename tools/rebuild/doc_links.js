// (Р4.6, 26.11) проверка ссылок и путей в действующих документах: markdown-ссылки [текст](путь) и пути в `кавычках` (src/, tools/,
// rebuild/, docs/, engine/, view/, data/) должны существовать. Старые пути файлов игры src/game/NNN_… — с подсказкой нового (rebuild/r4_map.json).
// Действующие — корень, rebuild/*.md, docs/*.md, docs/tasks, docs/architecture, README инструментов; исторические (docs/archive, docs/reports,
// docs/audit, rebuild/evidence, отчёты этапов R*_REPORT, журнал §4 «Записи») — не проверяются: там пути того времени.
// Запуск: node tools/rebuild/doc_links.js [--all] — код 1, если есть битые
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const MAP = {}; try { JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'r4_map.json'), 'utf8')).map.forEach(m => { MAP[m.old] = m.dir + '/' + m.new; MAP[m.old.replace(/\.(js|ts|html)$/, '')] = m.dir + '/' + m.id; }); } catch (e) {}
const files = cp.execSync('git -c core.quotepath=off ls-files -z "*.md"', { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean)
  .filter(f => process.argv.includes('--all') || !/^(docs\/(archive|reports|audit)\/|rebuild\/evidence\/|rebuild\/archive\/|rebuild\/(R\d_REPORT|bal_removed|dead_removed)\.md|\.claude\/)/.test(f));
const bad = [];
const exists = p => { const c = p.replace(/[#?].*$/, '').replace(/\/$/, ''); if (!c) return true; if (/[*{}<>…]/.test(c)) return true; return ['', '.js', '.ts', '.html'].some(e => fs.existsSync(path.join(ROOT, c + e))); };   // путь файла игры без расширения (таблица «Где что») — допустим
for (const f of files) {
  let s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (f === 'rebuild/JOURNAL.md') s = s.split('\n## 4. Записи')[0];   // записи журнала — история
  const lines = s.split('\n');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/\]\(([^)\s]+)\)/g)) { const t = m[1]; if (/^(https?:|mailto:|#)/.test(t)) continue;
      const abs = path.relative(ROOT, path.resolve(path.join(ROOT, path.dirname(f)), t.replace(/[#?].*$/, '')));
      if (!exists(abs)) bad.push([f, i + 1, t, '']); }
    for (const m of l.matchAll(/`((?:src|tools|rebuild|docs|engine|view|data)\/[^`\s]+)`/g)) { const t = m[1].replace(/[:,].*$/, '');
      if (exists(t)) continue; const base = path.basename(t);
      const hint = MAP[base] || (/^src\/game\//.test(t) && MAP[base.replace(/\.(js|ts|html)$/, '')]) || '';
      bad.push([f, i + 1, t, hint]); }
  });
}
const by = {}; bad.forEach(b => (by[b[0]] = by[b[0]] || []).push(b));
for (const [f, L] of Object.entries(by)) console.log(f + ': ' + L.length + ' — ' + L.slice(0, 4).map(b => b[1] + ' ' + b[2] + (b[3] ? ' → ' + b[3] : '')).join('; '));
console.log('документов ' + files.length + ', битых ссылок / путей ' + bad.length + ', из них старые пути файлов игры (есть новый) ' + bad.filter(b => b[3]).length);
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(bad, null, 1));
process.exit(bad.length ? 1 : 0);
