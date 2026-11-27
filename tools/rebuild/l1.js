// (Р8 п. 6, 27.11) Проверка L1 коммита (docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md §3) — в облаке, после коммита, в фоне
// (.githooks/post-commit). Неизменяемые сборки коммита и его родителя — в отдельных рабочих копиях (git worktree), не из рабочего дерева.
//  1) анализ влияния (tools/rebuild/impact.js): механики и сцены; файлы игры не менялись — на этом всё;
//  2) короткий отпечаток: 2 матча × 15 000 тиков обеих карт — итог (хэш мест, здоровья, взгляда, счёта) коммита против родителя;
//  3) наблюдатель инвариантов (tools/measure/inv_run.js, матч 3, 15 000 тиков) на сборке коммита;
//  4) I-23 на коротком окне: снимок на тике 3000 = игра до тика 6000 (tools/measure/diverge.js --snap-at); ядра Rust = эталон TS (r7Mode
//     shadow, матч 3, 3000 тиков: каждый луч и поиск пути считают оба);
//  5) затронутые сцены — на сборках родителя и коммита, ответ сцены тот же или нет.
// I-22 (новый матч после сыгранного) требует полного матча — уровень L2 (ПК). Тест «без кэша» — у каждого кэша свой, в его шаге (Р6).
// Запуск: node tools/rebuild/l1.js [коммит=HEAD] [--batch-scenes] [--batch-builds] [--locate] → .git/sim-l1/<коммит>.md
// --batch-scenes: экспериментальный запуск сцен в отдельных контекстах одного Chromium.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const args = process.argv.slice(2), batch = args.includes('--batch-scenes'), batchBuilds = args.includes('--batch-builds');
const locate = args.includes('--locate');
const ROOT = path.resolve(__dirname, '..', '..'), REV = args.find(arg => !arg.startsWith('--')) || 'HEAD';
const git = a => cp.execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const SHA = git(['rev-parse', REV]), PARENT = git(['rev-parse', SHA + '~1']), short = s => s.slice(0, 8);
const OUTD = path.join(git(['rev-parse', '--git-common-dir']).replace(/^(?!\/)/, ROOT + '/'), 'sim-l1'); fs.mkdirSync(OUTD, { recursive: true });
const reportId = short(SHA) + (batch ? '.scenes' : '') + (batchBuilds ? '.builds' : '') + (locate ? '.locate' : '');
const OUT = path.join(OUTD, reportId + '.md'), t0 = Date.now(), L = [], timings = [];
const env = Object.assign({}, process.env, { NODE_PATH: [process.env.NODE_PATH, path.join(ROOT, 'tools', 'rebuild', 'node_modules')].filter(Boolean).join(path.delimiter) });
const run = (cmd, args, o = {}) => new Promise(res => { const p = cp.spawn(cmd, args, Object.assign({ cwd: ROOT, env }, o)); let out = '', err = '';
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('error', e => { err += e.message; });
  p.on('close', (code, signal) => res({ code: code ?? 1, out, err: signal ? err + ' (сигнал ' + signal + ')' : err })); });
async function pool(tasks, n) { const R = new Array(tasks.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; R[k] = await tasks[k](); } })); return R; }
const HASH = 'var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; x';
async function timed(name, action) {
  const start = process.hrtime.bigint();
  try { return await action(); }
  finally { timings.push('- ' + name + ': ' + (Number(process.hrtime.bigint() - start) / 1e9).toFixed(3) + ' с'); }
}
function save(status, failed = false) { const sec = Math.round((Date.now() - t0) / 1000);
  if (failed) process.exitCode = 1;
  L.push('', '## Время этапов (настенные секунды)', ...timings);
  const pending = OUT + '.' + process.pid + '.tmp';
  fs.writeFileSync(pending, '# L1 ' + short(SHA) + ' (родитель ' + short(PARENT) + ')\n\nИтог: **' + status + '** · ' + sec + ' с\n\n' + L.join('\n') + '\n');
  fs.renameSync(pending, OUT);
  if (batch || batchBuilds || locate) { console.log('L1 ' + short(SHA) + ' prototype: ' + status + ' (' + sec + ' с) → ' + OUT); return; }
  fs.appendFileSync(path.join(OUTD, 'log.txt'), new Date().toISOString() + ' ' + short(SHA) + ' ' + status + ' ' + sec + ' с\n'); console.log('L1 ' + short(SHA) + ': ' + status + ' (' + sec + ' с) → ' + OUT); }
(async () => {
  const imp = await timed('анализ влияния', () => run('node', [path.join(ROOT, 'tools', 'rebuild', 'impact.js'), SHA, '--both']));
  if (imp.code) { L.push('анализ влияния упал: ' + imp.err.slice(-500)); return save('ошибка', true); }
  const { impact: I, markdown } = JSON.parse(imp.out); L.push(markdown.replace(/^# /, '## '));
  if (!I.files.length) return save('игра не задета');
  // сборки: родитель и коммит, обе карты — страницы
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l1_')), wt = {}, sim = {};
  const maps = ['mirage', 'ancient'], bad = [];
  try {
    await timed('подготовка рабочих копий', () => {
      for (const [k, s] of [['p', PARENT], ['c', SHA]]) { wt[k] = path.join(tmp, k); git(['worktree', 'add', '--quiet', '--detach', wt[k], s]);
        try { fs.symlinkSync(path.join(ROOT, 'tools', 'rebuild', 'node_modules'), path.join(wt[k], 'tools', 'rebuild', 'node_modules')); } catch (e) {} }
    });
    const buildTasks = ['p', 'c'].flatMap(k => {
      const builder = path.join(wt[k], 'src', 'build.py');
      for (const m of maps) sim[k + m] = path.join(tmp, k + '-' + m + '.html');
      const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
      const supported = batchBuilds && fs.readFileSync(builder, 'utf8').includes('# L1_MULTI_MAP_V1:');
      async function build(label, args) {
        const r = await timed('сборка ' + label, () => run(python, [builder, ...args], { cwd: wt[k] }));
        return [label, r.code, r.err.slice(-300)];
      }
      return supported
        ? [() => build(k + ' ' + maps.join('+'), maps.flatMap(m => ['--map-output', m, sim[k + m]]))]
        : maps.map(m => () => build(k + ' ' + m, ['--map', m, sim[k + m]]));
    });
    const B = await timed('сборки', () => pool(buildTasks, 2));
    B.filter(b => b[1]).forEach(b => bad.push('сборка ' + b[0] + ': ' + b[2]));
    if (bad.length) { L.push('', '## Сборка', ...bad.map(x => '- ' + x)); return save('сборка упала', true); }
    // 2) короткий отпечаток
    const FP = []; maps.forEach(m => [3, 7].forEach(n => ['p', 'c'].forEach(k => FP.push(async () => {
      const r = await run('node', [path.join(ROOT, 'src', 'q.js'), sim[k + m], 'freshMatch(' + n + '); while(tick < 15000) stepTick(); ' + HASH]);
      const hash = r.out.trim().split('\n').pop();
      return { m, n, k, h: r.code || !/^\d+$/.test(hash) ? 'ошибка' : hash }; }))));
    const F = await timed('короткие отпечатки', () => pool(FP, 4)); L.push('', '## Короткий отпечаток (2 матча × 15 000 тиков, родитель → коммит)');
    let same = 0; const mismatches = [];
    maps.forEach(m => [3, 7].forEach(n => { const a = F.find(x => x.m === m && x.n === n && x.k === 'p').h, b = F.find(x => x.m === m && x.n === n && x.k === 'c').h;
      if (a === 'ошибка' || b === 'ошибка') bad.push('отпечаток ' + m + ' м' + n);
      else if (a === b) same++;
      else mismatches.push({ m, n });
      L.push('- ' + m + ' м' + n + ': ' + a + ' → ' + b + (a === b && a !== 'ошибка' ? ' (тот же)' : ' (**проверить**)')); }));
    const gameSame = same === 4;
    L.push(gameSame ? '- игра не изменилась на этом окне' : '- **равенство игры не подтверждено** — первый тик и поля: `node tools/measure/diverge.js <родитель>.html <коммит>.html --match=…`');
    if (locate && mismatches.length) {
      L.push('', '## Локализация расхождений короткого отпечатка');
      for (const { m, n } of mismatches) {
        const o = path.join(OUTD, reportId + '-' + m + '-m' + n + '.json');
        const pending = path.join(tmp, m + '-m' + n + '.json');
        const r = await timed('локатор ' + m + ' м' + n, () => run('node', [
          path.join(ROOT, 'tools/measure/diverge.js'), sim['p' + m], sim['c' + m],
          '--match=' + n, '--ticks=15000', '--out=' + pending,
        ]));
        if (fs.existsSync(pending)) {
          fs.copyFileSync(pending, o);
          L.push('- ' + m + ' м' + n + ': ' + r.out.trim().split('\n')[0] + ' (' + path.basename(o) + ')');
        } else {
          L.push('- ' + m + ' м' + n + ': локатор не завершился, код ' + r.code + '; ' + r.err.trim().slice(-300));
        }
      }
    }
    // 3) наблюдатель инвариантов, 4) I-23 на коротком окне
    const INV = await timed('наблюдатель инвариантов и I-23', () => pool(maps.map(m => () => timed('инварианты ' + m, async () => { const o = path.join(tmp, 'inv_' + m + '.json');
      const r = await run('node', [path.join(ROOT, 'tools', 'measure', 'inv_run.js'), sim['c' + m], '--match=3', '--ticks=15000', '--out=' + o]);
      return [m, r.code, (r.out.trim().split('\n').pop() || r.err.trim().split('\n').pop() || '').slice(0, 300)]; })).concat(maps.map(m => () => timed('I-23 ' + m, async () => {
      const r = await run('node', [path.join(ROOT, 'tools', 'measure', 'diverge.js'), sim['c' + m], sim['c' + m], '--match=3', '--snap-at=3000', '--ticks=6000']);
      return ['I-23 ' + m, r.code, (r.out.trim().split('\n').filter(Boolean).pop() || r.err.trim().split('\n').pop() || '').slice(0, 300)]; }))), 2));
    // 3б) ядра Rust = эталон TS (r7Mode shadow): правка эталона без правки ядра (или наоборот) — расхождение
    // ядер Rust нет в этой версии (до 951f56d2) — сверка не применима: пометка, а не ошибка (L1 30c52b6d, 27.11)
    const SH = await timed('сверка ядер Rust', () => pool(maps.map(m => async () => { if (!/function r7Mode\(/.test(fs.readFileSync(sim['c' + m], 'utf8'))) return ['ядро = эталон ' + m, 0, 'в этой версии ядер Rust нет — не применимо'];
      const r = await run('node', [path.join(ROOT, 'src', 'q.js'), sim['c' + m], 'r7Mode("shadow"); freshMatch(3); while(tick < 3000) stepTick(); "сверок " + R7.n + ", расхождений " + R7.bad']);
      const t = r.code ? 'ошибка' : r.out.trim().split('\n').pop(); return ['ядро = эталон ' + m, /расхождений 0$/.test(t) ? 0 : 1, t]; }), 2));
    INV.push(...SH);
    L.push('', '## Инварианты и ядра (коммит)', ...INV.map(([k, c, t]) => '- ' + k + ': код ' + c + ' — ' + t));
    INV.forEach(([k, c]) => { if (c) bad.push(k); });
    // 5) затронутые сцены — родитель и коммит
    const jobs = I.scenes.flatMap(s => ['p', 'c'].map(k => ({ id: s.id, k, sims: { mirage: sim[k + 'mirage'], ancient: sim[k + 'ancient'] } })));
    const S = await timed('затронутые сцены', async () => {
      if (batch) {
        const result = await require('./scene_batch').runBatch(jobs, 2);
        L.push('', '- Контекстов сцен: ' + result.results.length + ', запусков Chromium: ' + result.browsers);
        for (const r of result.results) timings.push('- сцена ' + r.id + ' ' + r.k + ': ' + (r.ms / 1000).toFixed(3) + ' с');
        return result.results;
      }
      return pool(jobs.map(({ id, k, sims }) => () => timed('сцена ' + id + ' ' + k, async () => {
        const r = await run('node', [path.join(ROOT, 'tools', 'rebuild', 'scene_run.js'), id, sims.mirage, sims.ancient]);
        return r.code ? { id, k, error: r.err.trim() || 'код ' + r.code } : { id, k, output: r.out.trim() };
      })), 2);
    });
    L.push('', '## Затронутые сцены (' + I.scenes.length + ' из ' + I.scenes_total + '): ответ родителя → коммита');
    let sceneChanged = 0; I.scenes.forEach(s => {
      const a = S.find(x => x.id === s.id && x.k === 'p'), b = S.find(x => x.id === s.id && x.k === 'c');
      if ('error' in a || 'error' in b) {
        bad.push('сцена ' + s.id);
        L.push('- ' + s.id + ': **ошибка исполнения** — ' + (a.error || a.output) + ' → ' + (b.error || b.output));
      } else {
        if (a.output !== b.output) sceneChanged++;
        L.push('- ' + s.id + ': ' + a.output + (a.output === b.output ? ' (тот же)' : ' → **' + b.output + '**'));
      }
    });
    if (!I.scenes.length) L.push('- нет');
    save(bad.length ? 'нарушения: ' + bad.join(', ') : (gameSame ? 'игра та же' : 'игра изменилась') + (sceneChanged ? '; сцен с другим ответом: ' + sceneChanged : '; сцены те же'), bad.length > 0);
  } finally { for (const k of Object.keys(wt)) { try { git(['worktree', 'remove', '--force', wt[k]]); } catch (e) {} } fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { L.push('ошибка: ' + (e.stack || e)); save('ошибка', true); });
