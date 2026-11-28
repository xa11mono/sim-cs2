// (Р8 п. 6 / 10, 27.11) Одна сцена реестра (rebuild/scene_registry.json) отдельной страницей — общий исполнитель для карты сцен
// (tools/rebuild/scene_cov.js, с покрытием V8) и проверки L1 (tools/rebuild/l1.js). Сцена аудита: в её файле остальные сцены заменены на
// null (их код не выполняется); сцена по отметке (rebuild/scenarios.json) — как tools/marks/scenarios.js. Сборки: аудит — Ancient
// (как записан реестр), отметки — своя карта.
// Запуск: node tools/rebuild/scene_run.js <id> <sim-mirage.html> <sim-ancient.html>  → ответ сцены одной строкой JSON
'use strict';
const fs = require('fs'), path = require('path'), url = require('url'), zlib = require('zlib');
const acorn = require('acorn'), walk = require('acorn-walk');
const ROOT = path.resolve(__dirname, '..', '..');
const REG = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scene_registry.json'), 'utf8')).scenes;
const MARKS = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scenarios.json'), 'utf8'));
// текст файла сцен аудита, в котором выполняется только сцена id: верхние операторы тела файла (функция-обёртка), присваивающие только
// чужие сцены (R.<другая> = …), вырезаются целиком — сцена бывает и выражением R.x = (function(){…})(), и блоком try { …; R.x = … }; оператор
// с несколькими сценами, среди которых и эта, остаётся (его сцены выполняются вместе — это видно в ответе); помощники и объявления остаются
function onlyScene(text, id, ids) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  let body = ast.body; const e0 = body.length === 1 && body[0].type === 'ExpressionStatement' ? body[0].expression : null;
  if (e0 && e0.type === 'CallExpression' && /Function/.test(e0.callee.type)) body = e0.callee.body.body;
  const cut = [];
  for (const st of body) { const got = new Set();
    walk.simple(st, { AssignmentExpression(n) { const l = n.left;
      if (l.type === 'MemberExpression' && !l.computed && l.object.type === 'Identifier' && l.object.name === 'R' && ids.has(l.property.name)) got.add(l.property.name); } });
    if (got.size && !got.has(id)) cut.push([st.start, st.end]); }
  cut.sort((a, b) => b[0] - a[0]); let s = text; cut.forEach(([a, b]) => { s = s.slice(0, a) + ';' + s.slice(b); }); return s;
}
// sims: {mirage, ancient}; cov — собрать покрытие V8 (имена функций с числом вызовов > 0)
async function runScene(br, id, sims, cov) {
  const reg = REG(), s = reg.find(x => x.id === id); if (!s) throw new Error('нет сцены ' + id);
  const M = s.file === 'rebuild/scenarios.json' ? MARKS().find(x => x.id === id) : null, sim = M ? sims[M.map] : sims.ancient || sims.mirage;
  // Browser.newPage создаёт отдельный BrowserContext, который закрывается вместе со страницей.
  const pg = await br.newPage();
  try {
    await pg.route(/^https?:/, r => r.abort());
    let cdp = null; if (cov) { cdp = await pg.context().newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false }); }
    let res = null, err = '';
    try { await pg.goto(url.pathToFileURL(sim).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, { timeout: 120000 });
      await pg.evaluate(() => window.__ev('clockPause(true); 1'));
      if (M) { const sf = path.resolve(ROOT, M.pre || M.snap), raw = fs.readFileSync(sf);
        await pg.evaluate(t => window.__ev('mkOpenSnap')(t), (sf.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
        const each = M.each ? '(function(){ ' + M.each + ' })();' : '';
        await pg.evaluate(([t, each]) => window.__ev('paused = true; window.SCN = {t0: ' + (t | 0) + '}; var __n = 0; while(tick < ' + (t | 0) + ' && __n++ < 200000){ stepTick(); ' + each + ' } tick'), [M.pre ? M.tick : 0, each]);
        const when = M.when ? await pg.evaluate(c => window.__ev('!!(function(){ return (' + c + '); })()'), M.when) : true;
        res = !when ? 'ситуация не возникла' : await pg.evaluate(([n, code, each]) => window.__ev('paused = true; for(var __i = 0; __i < ' + (n | 0) + '; __i++){ stepTick(); ' + each + ' } !!(function(){ return (' + code + '); })()'), [M.steps || 0, M.check, each]);
      } else {
        const ids = new Set(reg.filter(x => x.file === s.file).map(x => x.id)), code = onlyScene(fs.readFileSync(path.join(ROOT, s.file), 'utf8'), id, ids);
        const v = await pg.evaluate(c => { const v = window.__ev(c); return typeof v === 'string' ? v : JSON.stringify(v); }, code);
        try { const R = JSON.parse(v); res = R && R[id] !== undefined ? R[id] : v; } catch (e) { res = v; }
      } }
    catch (e) { err = String(e.message || e).split('\n')[0]; }
    let F = null; if (cdp) { const { result } = await cdp.send('Profiler.takePreciseCoverage'); F = new Set(); result.forEach(x => x.functions.forEach(f => { if (f.functionName && f.ranges[0].count > 0) F.add(f.functionName); })); }
    return { id, file: s.file, sim: path.basename(sim), res, err, F };
  } finally { await pg.close(); }
}
// карта сборки, на которой играет сцена (то же правило, что в runScene): отметка — своя карта, аудит — Ancient; и файлы, от которых зависит
// её ответ кроме страницы (файл сцен, снимок отметки) — для ключа кэша проверок (tools/rebuild/l1.js)
function sceneInfo(id) { const s = REG().find(x => x.id === id); if (!s) throw new Error('нет сцены ' + id);
  const M = s.file === 'rebuild/scenarios.json' ? MARKS().find(x => x.id === id) : null;
  return { id, file: s.file, map: M ? M.map : 'ancient', deps: [s.file].concat(M ? [M.pre || M.snap] : []) }; }
module.exports = { runScene, onlyScene, sceneInfo };
if (require.main === module) (async () => {
  const [id, a, b] = process.argv.slice(2), { chromium } = require('playwright'), br = await chromium.launch();
  const r = await runScene(br, id, { mirage: path.resolve(a), ancient: path.resolve(b || a) }, false); await br.close();
  if (r.err) { console.error(r.err); process.exit(1); } console.log(JSON.stringify(r.res));
})().catch(e => { console.error(e); process.exit(2); });
