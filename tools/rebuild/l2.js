// (28.11, система проверок H-3 / H-5) Проверка L2 версии (docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md §3: «перед
// публикацией версии» — все сцены реестра; окна фризов; 8 матчей на карту на ПК; метаморфный тест знания; I-22 — полный матч). Две части:
//  облако (этот запуск, общая часть с L1 — checks_lib.js: кэш сборок и результатов, очередь, допуск по памяти, сцены в одном Chromium):
//   1) сборки коммита обеих карт (страница и ядро Node);
//   2) ВСЕ сцены реестра (rebuild/scene_registry.json) — ответ против записанного в реестре «ok»: у сцены «preserve» другой ответ —
//      нарушение; у «known» / «unexplored» — показать (поведение не исправлено — отложено, ответ может меняться);
//   3) наблюдатель инвариантов, I-23 на окне, ядро Rust = эталон TS — обе карты (те же задачи, что в L1; результат L1 берётся из кэша);
//   4) метаморфный набор знания (rebuild/meta_suite.json, tools/rebuild/meta_know.js на ядре, сводка meta_suite_sum.py): пара
//      «провалена» — нарушение; была «пройдена» в эталонном наборе, стала другой — показать;
//  ПК (--request): одно задание tools/measure/request.json — отпечатки 8 + 8 матчей страницы (Э1, сравнение с базой — fp_cmp.py после
//   прогона), I-22 / I-30 и особые инварианты (inv special, полный матч), окна фризов (prof: tick_prof / frame_prof, повтор 3). Задание
//   не пушится само: ветку measure/<имя> создаёт агент по правилам docs/rules/runs.md (нет идущего задания; одним заданием).
//  тесты системы проверок (долгие): сборка пачкой, полнота ключа кэша сборок, допуск раннера (--no-tool-tests — без них).
// Запуск: node tools/rebuild/l2.js [коммит=HEAD] [--par=N] [--no-cache] [--verify-cache] [--no-meta] [--no-tool-tests] [--request] [--out=файл.md]
//   → .git/sim-l1/l2-<коммит>.md; код 1 — нарушения / ошибка
'use strict';
const C = require('./checks_lib.js'), fs = require('fs'), path = require('path'), os = require('os');
const { ROOT, ARGS, opt, val, PAR, git, short, OUTD, run, H, sec, timings, stat, SR, PY } = C;
const REV = ARGS.find(a => !a.startsWith('--')) || 'HEAD', SHA = git(['rev-parse', REV]);
const OUT = val('out', path.join(OUTD, 'l2-' + short(SHA) + '.md')), t0 = Date.now(), L = [], MAPS = ['mirage', 'ancient'];
const MATCHES = [3, 7, 11, 13, 17, 19, 23, 29];

function save(status, failed) {
  const s = Math.round((Date.now() - t0) / 1000); if (failed) process.exitCode = 1;
  L.push('', '## Работа проверки', '- кэш: взято ' + stat.hit + ', посчитано ' + stat.run + (stat.verified ? ', сверено ' + stat.verified + ', расхождений ' + stat.verifyBad.length : '') +
    ' · параллельно до ' + C.mem().peakRunning + ' из ' + PAR + (H.scenes ? ' · запусков Chromium для сцен ' + H.scenes.launches : ''),
    '- время (настенное, с): ' + timings.sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, ms]) => n + ' ' + sec(ms)).join(' · '));
  const part = OUT + '.' + process.pid; fs.writeFileSync(part, '# L2 ' + short(SHA) + '\n\nИтог: **' + status + '** · ' + s + ' с\n\n' + L.join('\n') + '\n'); fs.renameSync(part, OUT);
  console.log('L2 ' + short(SHA) + ': ' + status + ' (' + s + ' с) → ' + OUT);
}

// ядро Node коммита (tools/node/core_build.py) — для метаморфного набора; кэш — рядом со страницами, ключ — входы сборки
async function buildCores(tmp) {
  const R = {}, need = [];
  for (const m of MAPS) { const f = path.join(C.CACHE, 'build', C.inputKey(SHA, m) + '-' + m + '.core.js'); R[m] = { file: f }; if (C.NOCACHE || !fs.existsSync(f)) need.push(m); }
  if (need.length) {
    const w = path.join(tmp, 'wt-core'); git(['worktree', 'add', '--quiet', '--detach', w, SHA]);
    const nm = path.join(w, 'tools', 'rebuild', 'node_modules'); try { if (fs.lstatSync(nm).isSymbolicLink()) fs.unlinkSync(nm); } catch (e) {}
    try { fs.symlinkSync(path.join(ROOT, 'tools', 'rebuild', 'node_modules'), nm, 'junction'); } catch (e) {}
    try { for (const m of need) { const o = path.join(tmp, m + '.core.js'), t = Date.now(), r = await run(PY, [path.join(w, 'tools', 'node', 'core_build.py'), '--map', m, o], { cwd: w });
      timings.push(['ядро ' + m, Date.now() - t]); if (r.code) throw new Error('ядро ' + m + ': ' + (r.err || r.out).trim().slice(-300));
      const part = R[m].file + '.' + process.pid; fs.copyFileSync(o, part); fs.renameSync(part, R[m].file); } }
    finally { try { git(['worktree', 'remove', '--force', w]); } catch (e) {} }
  }
  for (const m of MAPS) R[m].sha = C.fileSha(R[m].file);
  return R;
}
function metaArgs(p) { const a = ['--family=' + p.family, '--match=' + p.match, '--at=' + p.at];
  if (p.after) a.push('--after=' + p.after); if (p.observer) a.push('--observer=' + p.observer); if (p.ticks) a.push('--ticks=' + p.ticks);
  if (p.probe) a.push('--probe'); if (p.positive) a.push('--positive'); if (p.want) a.push('--want=' + p.want); return a; }
const metaTask = (core, p) => ({ est: C.estOf('meta', [core.sha, p]), fn: () => C.cached('meta', [core.sha, p], 0, async () => {
  const r = await run('node', [path.join(ROOT, 'tools', 'rebuild', 'meta_know.js'), core.file].concat(metaArgs(p)));
  const j = r.out.slice(r.out.indexOf('{')); try { JSON.parse(j); return { ok: true, json: j }; } catch (e) { return { ok: false, err: (r.err || r.out).trim().slice(-300) }; } }) });

function request() {
  const base = 'l2_' + short(SHA), q = { _: 'L2 ' + short(SHA) + ' (tools/rebuild/l2.js --request): Э1 8 + 8 страницы (Chromium), I-22 / I-30 и особые инварианты, окна фризов', par: 8, resume: true,
    fp: MAPS.map(m => ({ label: base + '_fp_' + m.slice(0, 3), ref: SHA, map: m, matches: MATCHES, trace: false, engine: 'chromium' })),
    inv: MAPS.map(m => ({ label: base + '_inv_' + m.slice(0, 3), ref: SHA, map: m, matches: [], special: true })),
    prof: MAPS.map(m => ({ label: base + '_prof_' + m.slice(0, 3), ref: SHA, map: m, match: 3, ticks: 20000, repeat: 3 })) };
  const f = path.join(ROOT, 'tools', 'measure', 'request.json'); fs.writeFileSync(f, JSON.stringify(q, null, 1) + '\n'); return f;
}

(async () => {
  await C.queueEnter('L2 ' + short(SHA));
  let tmp = null, wt = {}; const bad = [], note = [];
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l2_'));
    let t = Date.now(); const B = await C.buildAll(MAPS, tmp, { c: SHA }); wt = B.wt; timings.push(['сборки', Date.now() - t]);
    if (B.bad.length) { L.push('## Сборка', ...B.bad.map(x => '- ' + x)); return save('сборка упала', true); }
    const cores = opt('no-meta') ? null : await buildCores(tmp); C.pruneBuilds();
    L.push('## Сборки', ...MAPS.map(m => '- ' + m + ': страница ' + B.R.c[m].sha.slice(0, 12) + ' (' + B.R.c[m].from + ')' + (cores ? ', ядро ' + cores[m].sha.slice(0, 12) : '')));
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scene_registry.json'), 'utf8')).scenes, sims = { mirage: B.R.c.mirage.file, ancient: B.R.c.ancient.file };
    const sc = reg.map(s => ({ s, x: C.sceneTask(s.id, B.R.c[SR.sceneInfo(s.id).map], sims) }));
    const chk = []; MAPS.forEach(m => { const b = B.R.c[m]; chk.push(['инварианты ' + m, C.invTask(b, m)], ['I-23 ' + m, C.i23Task(b, m)], ['ядро = эталон ' + m, C.shTask(b, m)]); });
    const suite = cores ? JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'meta_suite.json'), 'utf8')) : null;
    const meta = suite ? suite.pairs.map(p => ({ p, x: metaTask(cores[p.map], Object.assign({}, p, { id: undefined, map: undefined })) })) : [];
    t = Date.now(); await C.pool([].concat(sc.map(y => y.x), chk.map(y => y[1]), meta.map(y => y.x)).map(x => ({ est: x.est, fn: async () => { x.r = await x.fn(); } })), PAR);
    timings.push(['проверки (всего)', Date.now() - t]);
    // сцены против реестра
    L.push('', '## Все сцены реестра (' + sc.length + '): ответ против записанного в реестре');
    sc.forEach(({ s, x }) => { const r = x.r; if (!r.ok) { bad.push('сцена ' + s.id); L.push('- ' + s.id + ': **ошибка исполнения** — ' + r.error); return; }
      let got = null; try { const v = JSON.parse(r.output); got = v && typeof v === 'object' && 'ok' in v ? !!v.ok : null; } catch (e) {}
      const want = typeof s.ok === 'boolean' ? s.ok : null, diff = got !== null && want !== null && got !== want;
      if (diff && s.status === 'preserve') bad.push('сцена ' + s.id + ' (preserve)'); else if (diff) note.push(s.id);
      L.push('- ' + s.id + ' [' + (s.status || '?') + ']: ' + r.output.slice(0, 160) + (diff ? ' — **ok ' + got + ', в реестре ' + want + '**' : '') + (r.cached ? ' · кэш' : '')); });
    L.push('', '## Инварианты и ядра', ...chk.map(([k, x]) => '- ' + k + ': код ' + x.r.code + ' — ' + x.r.t + (x.r.cached ? ' · кэш' : '')));
    chk.forEach(([k, x]) => { if (x.r.code || !x.r.ok) bad.push(k); });
    if (meta.length) {
      const d = path.join(tmp, 'meta'); fs.mkdirSync(d); meta.forEach(({ p, x }) => fs.writeFileSync(path.join(d, p.id + '.json'), x.r.ok ? x.r.json : '{}'));
      const sum = await run(PY, [path.join(ROOT, 'tools', 'rebuild', 'meta_suite_sum.py'), d]), ref = await run(PY, [path.join(ROOT, 'tools', 'rebuild', 'meta_suite_sum.py'), path.join(ROOT, suite.reference)]);
      const rows = t => Object.fromEntries(t.split('\n').filter(l => /^\| \w/.test(l) && !/^\| пара/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return [c[1], c[2]]; }));
      const now = rows(sum.out), was = rows(ref.out), fail = Object.keys(now).filter(k => /провал/.test(now[k])), lost = Object.keys(was).filter(k => /пройден/.test(was[k]) && now[k] && !/пройден/.test(now[k]));
      meta.forEach(({ p, x }) => { if (!x.r.ok) bad.push('метаморфная пара ' + p.id + ': ' + x.r.err); });
      fail.forEach(k => bad.push('метаморфная пара провалена: ' + k));
      const cnt = v => Object.values(now).filter(x => v.test(x)).length;
      L.push('', '## Метаморфный набор знания (' + meta.length + ' пар; эталон — ' + suite.reference + ')', '- пройдено ' + cnt(/пройден/) + ', провалено ' + cnt(/провал/) + ', непригодно ' + cnt(/непригод/),
        ...(lost.length ? ['- была «пройдена», теперь другая: ' + lost.map(k => k + ' → ' + now[k]).join('; ')] : []), ...fail.map(k => '- **провалена: ' + k + '**'));
    }
    // тесты самой системы проверок (долгие — не в L0): сборка пачкой = по одной и повтор байт в байт; ключ кэша сборок полон (strace);
    // модель допуска раннера (procguard_test)
    if (!opt('no-tool-tests')) { L.push('', '## Тесты системы проверок');
      for (const [n, a] of [['сборка пачкой = по одной, повтор тот же', [path.join(ROOT, 'tools', 'tests', 'build_batch_test.py')]], ['ключ кэша сборок полон', [path.join(ROOT, 'tools', 'tests', 'build_inputs_test.py')]],
        ['допуск раннера (procguard_test)', [path.join(ROOT, 'tools', 'measure', 'procguard_test.py')]]]) {
        const s = Date.now(), r = await run(PY, a); timings.push([n, Date.now() - s]); if (r.code) bad.push('тест: ' + n);
        L.push('- ' + n + ': ' + (r.code ? '**упал**' : 'да') + ' — ' + C.lastLine(r)); } }
    if (opt('request')) L.push('', '## Задание ПК', '- ' + path.relative(ROOT, request()) + ': Э1 8 + 8 страницы, I-22 / особые инварианты, окна фризов — пушить веткой measure/<имя> (docs/rules/runs.md); после — fp_cmp.py против базы отпечатков');
    else L.push('', '## Задание ПК', '- не готовилось (--request): Э1 8 + 8, I-22, окна фризов — на ПК');
    if (C.stat.verifyBad.length) bad.push('кэш ≠ пересчёт: ' + C.stat.verifyBad.length);
    save(bad.length ? 'нарушения: ' + bad.slice(0, 12).join(', ') + (bad.length > 12 ? ' …' : '') : 'облачная часть пройдена' + (note.length ? '; ответ сцен known / unexplored изменился: ' + note.join(', ') : ''), bad.length > 0);
  } finally {
    if (H.scenes) await H.scenes.close();
    for (const k of Object.keys(wt)) { try { git(['worktree', 'remove', '--force', wt[k]]); } catch (e) {} }
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); C.queueLeave();
  }
})().catch(e => { L.push('ошибка: ' + (e.stack || e)); save('ошибка', true); C.queueLeave(); });
