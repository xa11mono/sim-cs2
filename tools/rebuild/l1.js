// (Р8 п. 6, 27.11; система проверок H-3, 28.11) Проверка L1 коммита (docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md §3) — в
// облаке, после коммита, в фоне (.githooks/post-commit). Неизменяемые сборки коммита и его родителя — из отдельных рабочих копий (git worktree).
//  1) анализ влияния (tools/rebuild/impact.js --both): механики и сцены;
//  2) сборки родителя и коммита, обе карты. Кэш сборок: ключ — дерево коммита без путей, которые сборка не читает (build_inputs.json),
//     + версии node / python / esbuild; одинаковые входы — та же страница байт в байт (сборка детерминирована, H-8: build_batch_test.py);
//     сборщик с L1_MULTI_MAP_V1 собирает обе карты одним вызовом. Страницы родителя и коммита равны байт в байт по обеим картам —
//     «игра та же» доказана без запуска (детерминизм: одинаковая страница — одинаковая игра); раньше решение — по списку файлов игры, и
//     правка данных карты / разметки / сборщика проходила как «игра не задета» без проверки;
//  3) короткий отпечаток: 2 матча × 15 000 тиков обеих карт — итог (хэш мест, здоровья, взгляда, счёта) коммита против родителя; разный —
//     локатор первого расхождения (tools/measure/diverge.js) сразу, отчёт рядом (раньше — подсказка запустить руками);
//  4) наблюдатель инвариантов (tools/measure/inv_run.js, матч 3, 15 000 тиков), I-23 на окне (снимок на 3000 = игра до 6000), ядра Rust =
//     эталон TS (r7Mode shadow, матч 3, 3000 тиков) — на сборке коммита;
//  5) сцены реестра: задетые по анализу влияния; если страница изменилась правкой не только функций игры (данные карты, разметка,
//     сборщик — build_inputs.json) — все сцены; ответ родителя → коммита. Сцены — в одном Chromium, у каждой свой контекст (scene_batch.js).
// Кэш результатов (.git/sim-l1/cache/): ключ — SHA-256 страницы + проверка + параметры + хэш файлов инструментов и сцены + версии
// node / Playwright / Chromium; ответ родителя обычно уже посчитан L1 предыдущего коммита. Ошибка исполнения в кэш не кладётся.
// --no-cache — всё заново; --verify-cache — посчитать заново и сверить с кэшем (доказательство кэша; расхождение — нарушение).
// Очередь: один L1 за раз (замок .git/sim-l1/queue/), остальные ждут по порядку постановки; оборванный L1 продолжает с кэша.
// Параллельность — --par=N (по умолчанию — ядер, не больше 4); новая задача не стартует, пока свободной памяти меньше запаса (1,5 ГБ).
// I-22 (новый матч после сыгранного) требует полного матча — уровень L2 (tools/rebuild/l2.js, ПК). Тест «без кэша» — у каждого кэша свой (Р6).
// Запуск: node tools/rebuild/l1.js [коммит=HEAD] [--par=N] [--no-cache] [--verify-cache] [--out=файл.md]
//   → .git/sim-l1/<коммит>.md (+ строка итога в .git/sim-l1/log.txt); код 1 — нарушения / ошибка
'use strict';
const C = require('./checks_lib.js'), { fs, path, os } = { fs: require('fs'), path: require('path'), os: require('os') };
const { ROOT, ARGS, val, VERIFY, PAR, git, short, OUTD, run, H, sec, timings, stat, EXCL, CHK, SR } = C;
const REV = ARGS.find(a => !a.startsWith('--')) || 'HEAD', SHA = git(['rev-parse', REV]), PARENT = git(['rev-parse', SHA + '~1']);
const OUT = val('out', path.join(OUTD, short(SHA) + '.md')), t0 = Date.now(), L = [];
function save(status, failed) {
  const s = Math.round((Date.now() - t0) / 1000); if (failed) process.exitCode = 1;
  L.push('', '## Работа проверки', '- кэш: взято ' + stat.hit + ', посчитано ' + stat.run + (VERIFY ? ', сверено с кэшем ' + stat.verified + ', расхождений ' + stat.verifyBad.length + (stat.verifyBad.length ? ': ' + stat.verifyBad.join('; ') : '') : '') +
    ' · параллельно до ' + C.mem().peakRunning + ' из ' + PAR + (C.mem().memWaits ? ' · ожиданий памяти ' + C.mem().memWaits : '') + (H.scenes ? ' · запусков Chromium для сцен ' + H.scenes.launches : ''),
    '- время (настенное, с): ' + timings.sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, ms]) => n + ' ' + sec(ms)).join(' · '));
  const part = OUT + '.' + process.pid; fs.writeFileSync(part, '# L1 ' + short(SHA) + ' (родитель ' + short(PARENT) + ')\n\nИтог: **' + status + '** · ' + s + ' с\n\n' + L.join('\n') + '\n'); fs.renameSync(part, OUT);
  if (!val('out')) fs.appendFileSync(path.join(OUTD, 'log.txt'), new Date().toISOString() + ' ' + short(SHA) + ' ' + status + ' ' + s + ' с\n');
  console.log('L1 ' + short(SHA) + ': ' + status + ' (' + s + ' с) → ' + OUT);
}

(async () => {
  await C.queueEnter('L1 ' + short(SHA));
  const maps = ['mirage', 'ancient'], bad = []; let tmp = null, wt = {};
  try {
    let t = Date.now(); const imp = await run('node', [path.join(ROOT, 'tools', 'rebuild', 'impact.js'), SHA, '--both']); timings.push(['анализ влияния', Date.now() - t]);
    if (imp.code) { L.push('анализ влияния упал: ' + imp.err.slice(-500)); return save('ошибка', true); }
    const { impact: I, markdown } = JSON.parse(imp.out); L.push(markdown.replace(/^# /, '## '));
    // правки коммита, кроме не читаемых сборкой путей: что из них не функции игры и не только проверки сборки
    const gameFiles = new Set(I.files), changed = git(['diff', '--name-only', PARENT, SHA]).split('\n').filter(Boolean).filter(p => !EXCL.some(r => r.test(p)));
    const nonCode = changed.filter(p => !gameFiles.has(p) && !CHK.some(r => r.test(p)));
    if (!changed.length) { L.push('', '## Сборки', '- входы сборки не менялись (правка только в путях, которые сборка не читает: build_inputs.json) — страницы те же'); return save('игра не задета'); }
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l1_'));
    t = Date.now(); const B = await C.buildAll(maps, tmp, { p: PARENT, c: SHA }); wt = B.wt; timings.push(['сборки (всего)', Date.now() - t]); C.pruneBuilds();
    L.push('', '## Сборки (родитель → коммит)', ...maps.map(m => '- ' + m + ': ' + (B.R.p[m].sha || '—').slice(0, 12) + ' (' + B.R.p[m].from + ') → ' + (B.R.c[m].sha || '—').slice(0, 12) + ' (' + B.R.c[m].from + ')'));
    if (B.bad.length) { L.push(...B.bad.map(x => '- ' + x)); return save('сборка упала', true); }
    const same = {}; maps.forEach(m => { same[m] = B.R.p[m].sha === B.R.c[m].sha; });
    if (maps.every(m => same[m])) { L.push('- страницы родителя и коммита равны байт в байт по обеим картам — игра та же (детерминизм: та же страница — та же игра)');
      return save('игра та же (страницы равны)'); }
    if (nonCode.length) L.push('- страница изменилась и правка не только в функциях игры (' + nonCode.slice(0, 8).join(', ') + (nonCode.length > 8 ? ', …' : '') + ') — проверяются все сцены');
    // задачи всех шагов — одной очередью: долгие (по прошлому замеру) сначала
    const fp = [], chk = [], sc = [];
    maps.forEach(m => [3, 7].forEach(n => { if (same[m]) return; fp.push({ m, n, p: C.fpTask(B.R.p[m], m, n), c: C.fpTask(B.R.c[m], m, n) }); }));
    maps.forEach(m => { const b = B.R.c[m]; chk.push(['инварианты ' + m, C.invTask(b, m)], ['I-23 ' + m, C.i23Task(b, m)], ['ядро = эталон ' + m, C.shTask(b, m)]); });
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scene_registry.json'), 'utf8')).scenes.map(s => s.id);
    const sceneIds = nonCode.length ? reg : I.scenes.map(s => s.id), simsOf = k => ({ mirage: B.R[k].mirage.file, ancient: B.R[k].ancient.file });
    sceneIds.forEach(id => { const m = SR.sceneInfo(id).map; sc.push({ id, m, c: C.sceneTask(id, B.R.c[m], simsOf('c')), p: same[m] ? null : C.sceneTask(id, B.R.p[m], simsOf('p')) }); });
    const all = [].concat(...fp.map(x => [x.p, x.c]), chk.map(x => x[1]), ...sc.map(x => [x.c, x.p].filter(Boolean)));
    t = Date.now(); await C.pool(all.map(x => ({ est: x.est, fn: async () => { x.r = await x.fn(); } })), PAR); timings.push(['проверки (всего)', Date.now() - t]);
    if (H.scenes && H.scenes.leftContexts()) bad.push('контексты сцен остались открыты');
    // отпечаток
    L.push('', '## Короткий отпечаток (2 матча × 15 000 тиков, родитель → коммит)'); let fpSame = 0; const mism = [];
    maps.forEach(m => [3, 7].forEach(n => { const x = fp.find(f => f.m === m && f.n === n);
      if (!x) { fpSame++; L.push('- ' + m + ' м' + n + ': страница та же — тот же'); return; }
      const a = x.p.r.h, b = x.c.r.h; if (a === 'ошибка' || b === 'ошибка') bad.push('отпечаток ' + m + ' м' + n); else if (a === b) fpSame++; else mism.push({ m, n });
      L.push('- ' + m + ' м' + n + ': ' + a + ' → ' + b + (a === b && a !== 'ошибка' ? ' (тот же)' : ' (**другой**)') + (x.p.r.cached && x.c.r.cached ? ' · кэш' : '')); }));
    const gameSame = fpSame === 4;
    L.push(gameSame ? '- игра не изменилась на этом окне' : '- **игра изменилась** (или ошибка отпечатка) — первый тик и поля ниже');
    if (mism.length) { L.push('', '## Первое расхождение (tools/measure/diverge.js)');
      await C.pool(mism.map(({ m, n }) => ({ fn: async () => { const o = path.join(OUTD, short(SHA) + '-' + m + '-m' + n + '.json'), part = path.join(tmp, m + n + '.json'), s = Date.now();
        const r = await run('node', [path.join(ROOT, 'tools', 'measure', 'diverge.js'), B.R.p[m].file, B.R.c[m].file, '--match=' + n, '--ticks=15000', '--out=' + part]); timings.push(['локатор ' + m + ' м' + n, Date.now() - s]);
        if (fs.existsSync(part)) { fs.copyFileSync(part, o); L.push('- ' + m + ' м' + n + ': ' + r.out.trim().split('\n')[0] + ' (' + path.basename(o) + ')'); }
        else L.push('- ' + m + ' м' + n + ': локатор не завершился, код ' + r.code + '; ' + r.err.trim().slice(-300)); } })), PAR); }
    // инварианты, I-23, ядра
    L.push('', '## Инварианты и ядра (коммит)', ...chk.map(([k, x]) => '- ' + k + ': код ' + x.r.code + ' — ' + x.r.t + (x.r.cached ? ' · кэш' : '')));
    chk.forEach(([k, x]) => { if (x.r.code || !x.r.ok) bad.push(k); });
    // сцены
    L.push('', '## ' + (nonCode.length ? 'Все сцены' : 'Затронутые сцены') + ' (' + sc.length + ' из ' + reg.length + '): ответ родителя → коммита');
    let sceneChanged = 0; sc.forEach(s => { const b = s.c.r, a = s.p ? s.p.r : b, ca = (s.p ? s.p.r.cached && b.cached : b.cached) ? ' · кэш' : '';
      if (!a.ok || !b.ok) { bad.push('сцена ' + s.id); L.push('- ' + s.id + ': **ошибка исполнения** — ' + (a.error || a.output) + ' → ' + (b.error || b.output)); return; }
      if (!s.p) { L.push('- ' + s.id + ': ' + b.output + ' (тот же: страница ' + s.m + ' та же)' + ca); return; }
      if (a.output !== b.output) sceneChanged++; L.push('- ' + s.id + ': ' + a.output + (a.output === b.output ? ' (тот же)' : ' → **' + b.output + '**') + ca); });
    if (!sc.length) L.push('- нет');
    if (stat.verifyBad.length) bad.push('кэш ≠ пересчёт: ' + stat.verifyBad.length);
    save(bad.length ? 'нарушения: ' + bad.join(', ') : (gameSame ? 'игра та же' : 'игра изменилась') + (sceneChanged ? '; сцен с другим ответом: ' + sceneChanged : '; сцены те же'), bad.length > 0);
  } finally {
    if (H.scenes) await H.scenes.close();
    for (const k of Object.keys(wt)) { try { git(['worktree', 'remove', '--force', wt[k]]); } catch (e) {} }
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); C.queueLeave();
  }
})().catch(e => { L.push('ошибка: ' + (e.stack || e)); save('ошибка', true); C.queueLeave(); });
