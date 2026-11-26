#!/usr/bin/env node
// (Р0.3, 24.11) Единая точка входа команд проекта для любого агента (Claude Code, Codex, DeepSeek) и для ПК владельца (Windows / Linux).
// Только вызывает существующие инструменты — своей логики сборки, замера и проверки здесь нет (rebuild/MASTER_PLAN.md, Р0.3; АР-17).
//   node tools/sim.js help
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const NODE_PATH = [process.env.NODE_PATH, path.join(ROOT, 'tools', 'rebuild', 'node_modules'), '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules']
  .filter(Boolean).join(path.delimiter);
const FP_MATCHES = [3, 7, 11, 13, 17, 19, 23, 29];   // те же матчи, что tools/measure/fingerprint.sh (CLAUDE.md §8)

function run(cmd, args, opt) {
  const r = cp.spawnSync(cmd, args, Object.assign({ cwd: ROOT, stdio: 'inherit', env: Object.assign({}, process.env, { NODE_PATH }) }, opt || {}));
  if (r.error) { console.error(r.error.message); return 1; }
  return r.status == null ? 1 : r.status;
}
function opt(args, name, def) { const a = args.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; }
function pos(args) { return args.filter(x => !x.startsWith('--')); }

// отпечаток: то же, что tools/measure/fingerprint.sh (код матча — fingerprint.js с номером, страница — src/q.js), плюс env.json
async function fp(args) {
  const [sim, out] = pos(args);
  if (!sim || !out) { console.error('node tools/sim.js fp <sim.html> <папка> [--matches=3,7] [--par=8]'); return 2; }
  const matches = (opt(args, 'matches', '') || FP_MATCHES.join(',')).split(',').map(Number);
  const par = +opt(args, 'par', matches.length);
  fs.mkdirSync(out, { recursive: true });
  if (run('node', [path.join(ROOT, 'tools', 'measure', 'env.js'), path.join(out, 'env.json')])) return 1;
  const code = fs.readFileSync(path.join(ROOT, 'tools', 'measure', 'fingerprint.js'), 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simfp_'));
  let fail = 0, queue = matches.slice(), active = 0;
  await new Promise(done => {
    const next = () => {
      if (!queue.length && !active) return done();
      while (active < par && queue.length) {
        const m = queue.shift(), cf = path.join(tmp, 'fp_' + m + '.js');
        fs.writeFileSync(cf, code.split('__M__').join(String(m)));
        const o = fs.openSync(path.join(out, 'fp_' + m + '.json'), 'w'); active++;
        const p = cp.spawn('node', [path.join(ROOT, 'src', 'q.js'), path.resolve(sim), '@' + cf], { cwd: ROOT, stdio: ['ignore', o, 'inherit'], env: Object.assign({}, process.env, { NODE_PATH }) });
        p.on('close', c => { fs.closeSync(o); if (c) { fail++; console.error('матч ' + m + ': код ' + c); } active--; next(); });
      }
    };
    next();
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  return fail ? 1 : 0;
}
// сравнение двух папок отпечатков: файлы fp_*.json побайтно; env.json не сравнивается, но печатается (разные среды несравнимы)
function fpdiff(args) {
  const [a, b] = pos(args);
  if (!a || !b) { console.error('node tools/sim.js fpdiff <папка1> <папка2>'); return 2; }
  const env = d => { try { return fs.readFileSync(path.join(d, 'env.json'), 'utf8').trim(); } catch (e) { return '(нет env.json)'; } };
  const ea = env(a), eb = env(b);
  console.log('среда 1: ' + ea + '\nсреда 2: ' + eb + (ea !== eb ? '\n  ВНИМАНИЕ: среды разные — отпечатки сравнимы только в одной среде (rebuild/ENVIRONMENT.md)' : ''));
  const files = [...new Set([...fs.readdirSync(a), ...fs.readdirSync(b)])].filter(f => /^fp_\d+\.json$/.test(f)).sort((x, y) => parseInt(x.slice(3)) - parseInt(y.slice(3)));
  let same = 0, diff = 0;
  for (const f of files) {
    const pa = path.join(a, f), pb = path.join(b, f);
    if (!fs.existsSync(pa) || !fs.existsSync(pb)) { console.log(f + ': есть только в одной папке'); diff++; continue; }
    const ta = fs.readFileSync(pa, 'utf8').trim(), tb = fs.readFileSync(pb, 'utf8').trim();
    if (ta === tb) { same++; continue; }
    diff++;
    let ra = null, rb = null; try { ra = JSON.parse(ta); rb = JSON.parse(tb); } catch (e) {}
    let first = '';
    if (ra && rb && ra.rounds && rb.rounds) {
      const i = ra.rounds.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(rb.rounds[k]));
      if (i >= 0) first = ', первый различный раунд ' + (ra.rounds[i] || rb.rounds[i])[0] + ' (тик ' + (ra.rounds[i] ? ra.rounds[i][1] : '?') + ' / ' + (rb.rounds[i] ? rb.rounds[i][1] : '?') + ')';
    }
    console.log(f + ': РАЗЛИЧАЕТСЯ' + first);
  }
  console.log('совпало ' + same + ' из ' + files.length + (diff ? ' — НЕ бит в бит' : ' — бит в бит'));
  return diff ? 1 : 0;
}
// проверка задания на ПК (tools/measure/request.json): формат, уникальные метки, коммиты существуют
function measureCheck(args) {
  const f = pos(args)[0] || path.join(ROOT, 'tools', 'measure', 'request.json');
  let req; try { req = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('не JSON: ' + e.message); return 1; }
  const labels = [], bad = [];
  for (const [k, v] of Object.entries(req)) if (Array.isArray(v)) for (const j of v) {
    if (!j || !j.label) { bad.push(k + ': задание без label'); continue; }
    labels.push(j.label);
    if (j.ref && cp.spawnSync('git', ['cat-file', '-e', j.ref + '^{commit}'], { cwd: ROOT }).status) bad.push(j.label + ': коммит ' + j.ref + ' не найден локально (git fetch?)');
  }
  labels.filter((l, i) => labels.indexOf(l) !== i).forEach(l => bad.push('метка повторяется: ' + l));
  bad.forEach(x => console.log('✗ ' + x));
  console.log(bad.length ? 'задание с ошибками' : 'задание в порядке: ' + labels.join(', '));
  return bad.length ? 1 : 0;
}

// пакет контекста (Р0.9): правила + состояние перестройки + строки по теме из «Где что», решений и реестра недостатков — для агентов без
// репозитория (ChatGPT, DeepSeek в чате). Только склейка существующих документов.
function context(args) {
  const topic = pos(args).join(' ').toLowerCase(), words = topic.split(/\s+/).filter(w => w.length > 2);
  const rd = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; } };
  const sect = (txt, start, stop) => { const i = txt.indexOf(start); if (i < 0) return ''; const j = stop ? txt.indexOf(stop, i + start.length) : -1; return txt.slice(i, j < 0 ? undefined : j); };
  const pick = txt => !words.length ? [] : txt.split('\n').filter(l => l.startsWith('|') && words.some(w => l.toLowerCase().includes(w)));
  const J = rd('rebuild/JOURNAL.md'), P = rd('rebuild/MASTER_PLAN.md'), m = (J.match(/\| этап \| \*\*(Р\d)/) || [])[1] || 'Р0';
  const parts = [
    '# Контекст sim-cs2' + (topic ? ' — тема: ' + topic : '') + ' (собрано tools/sim.js context)',
    rd('AGENTS.md'),
    '# Состояние перестройки (rebuild/JOURNAL.md §2)\n' + sect(J, '## 2. Сейчас', '## 3.'),
    '# Текущий этап (rebuild/MASTER_PLAN.md)\n' + sect(P, '### ' + m + '.', '\n### '),
  ];
  const rows = [['Решения (docs/architecture/DECISIONS.md)', rd('docs/architecture/DECISIONS.md')], ['Отложенные игровые недостатки (rebuild/BEHAVIOR_BACKLOG.md)', rd('rebuild/BEHAVIOR_BACKLOG.md')]];
  for (const [h, t] of rows) { const r = pick(t); if (r.length) parts.push('# ' + h + ' — по теме\n' + r.join('\n')); }
  const out = parts.join('\n\n'), f = opt(args, 'out', '');
  if (f) { fs.writeFileSync(f, out); console.log(f + ': ' + out.length + ' символов'); } else process.stdout.write(out + '\n');
  return 0;
}
// граф кода Graphify (Р0.9): только локальный разбор кода (--code-only), ключи API из окружения убираются — внешние вызовы невозможны;
// что разбирать — .graphifyignore; результат — graphify-out/ (не в git). Ставится отдельно: pip install graphifyy (или uv tool install graphifyy)
function graph(args) {
  const exe = process.env.GRAPHIFY || 'graphify', env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) if (/API_KEY|_TOKEN$|BASE_URL$/.test(k) && !/^(GITHUB|GH)_/.test(k)) delete env[k];
  const r = cp.spawnSync(exe, ['extract', ROOT, '--code-only', '--no-viz'].concat(args), { cwd: ROOT, stdio: 'inherit', env });
  if (r.error) { console.error('нет graphify: pip install graphifyy (или GRAPHIFY=путь)'); return 2; }
  return r.status || 0;
}
const MARKS = { open: 'mark_open', story: 'mark_story', frames: 'mark_frames', video: 'mark_video', scenarios: 'scenarios', replay: 'replay_owner' };
const CMDS = {
  help: () => { console.log(HELP); return 0; },
  env: a => run('node', [path.join(ROOT, 'tools', 'measure', 'env.js')].concat(pos(a))),
  build: a => run(PY, [path.join(ROOT, 'src', 'build.py'), '--map', opt(a, 'map', 'ancient')].concat(pos(a))),
  pub: a => run(PY, [path.join(ROOT, 'src', 'mkpub.py'), '--map', opt(a, 'map', 'ancient')]),
  fp, fpdiff,
  check: a => run('node', [path.join(ROOT, 'tools', 'rebuild', 'gen_maps.js'), '--check']) || run('node', [path.join(ROOT, 'tools', 'rebuild', 'doc_links.js')]) || run('node', [path.join(ROOT, 'tools', 'rebuild', 'typecheck.js')]) || run(PY, [path.join(ROOT, 'tools', 'map', 'map_check.py'), '--known=rebuild/known_map_gaps.json'].concat(pos(a))),
  scen: a => run('node', [path.join(ROOT, 'tools', 'marks', 'scenarios.js')].concat(a)),
  why: a => run('node', [path.join(ROOT, 'tools', 'marks', 'why.js')].concat(a)),
  marks: a => MARKS[a[0]] ? run('node', [path.join(ROOT, 'tools', 'marks', MARKS[a[0]] + '.js')].concat(a.slice(1))) : (console.error('marks: ' + Object.keys(MARKS).join(' | ')), 2),
  measure: a => a[0] === 'check' ? measureCheck(a.slice(1)) : (console.error('measure check [request.json] — проверить задание; запуск — пуш ветки measure/<имя> (CLAUDE.md §8)'), 2),
  context, graph,
  inv: a => run('node', [path.join(ROOT, 'tools', 'measure', 'inv_run.js')].concat(a)),
  diverge: a => run('node', [path.join(ROOT, 'tools', 'measure', 'diverge.js')].concat(a)),
  health: a => run(PY, [path.join(ROOT, 'tools', 'health.py')].concat(pos(a).length ? pos(a) : [path.join(ROOT, 'dist', 'sim.html')])),
  typecheck: a => run('node', [path.join(ROOT, 'tools', 'rebuild', 'typecheck.js')].concat(a)),
  tomain: a => run('node', [path.join(ROOT, 'tools', 'rebuild', 'to_main.js')].concat(a)),
};
const HELP = `node tools/sim.js <команда> — единая точка входа (Р0.3)
  build [--map=ancient|mirage] [куда]     сборка тестовой страницы (src/build.py) → dist/sim.html
  pub --map=<карта>                       публикуемая страница (src/mkpub.py) → <карта>-radar.html
  fp <sim.html> <папка> [--matches=…]     отпечаток матчей (как tools/measure/fingerprint.sh) + env.json
  fpdiff <папка1> <папка2>                 сравнить отпечатки: бит в бит или первый различный раунд
  check [карта…]                          проверка устройства (gen_maps --check), типов .ts (typecheck) и данных карт (map_check.py)
  scen [--map=…] [--only=…]               проверки по отметкам (tools/marks/scenarios.js)
  why <отметка> <бот> [тик] [--sim=…]     почему бот так сделал: каналы у хозяев + след решений (tools/marks/why.js, Р3.3)
  marks <open|story|frames|video|scenarios|replay> …   инструменты отметок (tools/marks/*)
  measure check [request.json]            проверить задание прогона на ПК
  env [файл]                              среда: Playwright, Chromium, Node, ОС
  diverge A.html B.html [--match=3] [--ticks=…] [--every=64] [--inject-b=f.js] [--math]   первый тик расхождения, поля, вызов Math (Р0.5)
  inv <sim.html> [--special|--neutral] [--ticks=…]   инварианты I-01…I-32 (Р0.6)
  context [тема] [--out=файл]             текстовый пакет правил и состояния для агентов без репозитория (Р0.9)
  graph                                   граф кода Graphify, только локально (graphify-out/, не в git) (Р0.9)
  health [sim.html]                       «здоровье» кода (tools/health.py)
  typecheck [--js [--list]]               типы: .ts — strict, ошибка = код 1; --js — .js игры, только предупреждения (Р1)
  tomain [пути…] [--push] [-m сообщение]  документы в main: сначала сборка итогового дерева main, пуш — только если прошла (Р2.0)`;

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const f = CMDS[cmd || 'help'];
  if (!f) { console.error('нет команды «' + cmd + '»\n' + HELP); process.exit(2); }
  process.exit(await f(rest));
})();
