// (Р0.5, 24.11) Локатор расхождения двух сборок (или одной сборки в двух вариантах): первый тик, где полное состояние игры разошлось,
// какие переменные и поля, и — с --math — какой вызов Math дал разные биты. Игру не меняет: только играет и хэширует.
// Состояние — переменные снимка отметки (mkSnapList, src/marks.js) без кэшей и показа. Два прохода: грубый (каждые --every тиков),
// затем с начала (матч повторяем) по тику внутри найденного окна.
//   node tools/measure/diverge.js A.html B.html [--match=3] [--ticks=20000] [--every=64] [--inject-a=f.js] [--inject-b=f.js]
//        [--skip=регулярка] [--skip-field=регулярка] [--math] [--out=отчёт.json]
// --inject-*: код выполняется в странице до freshMatch (самопроверка — tools/measure/selftest/math_libm.js). Нужен acorn (NODE_PATH).
const { chromium } = require('playwright'), url = require('url'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const files = args.filter(x => !x.startsWith('--'));
if (files.length < 2) { console.error('node tools/measure/diverge.js A.html B.html [--match=3] [--ticks=20000] [--every=64] [--inject-a=f.js] [--inject-b=f.js] [--skip=…] [--skip-field=…] [--math] [--out=…]'); process.exit(2); }
const MATCH = +opt('match', 3), TICKS = +opt('ticks', 20000), EVERY = Math.max(1, +opt('every', 64)), MATH = args.includes('--math');

// Не хэшируются: (1) кэши, чьё содержимое не меняет результат (как SNAP_SKIP в rec2.js); (2) очереди показа; (3) все переменные верхнего
// уровня из файлов показа и инструментов (src/game/550… и выше: рисование, HUD, редакторы, обсервер, повтор, песочница, звук, кадр) —
// их обновляет кадр страницы по её часам; находятся разбором исходника, а не списком руками.
function showVars() {
  let acorn; try { acorn = require('acorn'); } catch (e) { console.error('нет acorn: NODE_PATH=tools/rebuild/node_modules'); process.exit(2); }
  // как tools/rebuild/gen_maps.js: склейка src/game (html + js), основной <script>, тело общей обёртки, дом переменной — файл объявления
  const dir = path.join(__dirname, '..', '..', 'src', 'game'); let all = '', spans = [];
  for (const f of fs.readdirSync(dir).filter(f => /\.(html|js)$/.test(f)).sort()) { const t = fs.readFileSync(path.join(dir, f), 'utf8'); spans.push([all.length, all.length + t.length, f]); all += t; }
  const fileAt = pos => (spans.find(sp => pos >= sp[0] && pos < sp[1]) || spans[spans.length - 1])[2];
  let main = null;
  for (const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { const off = m.index + m[0].indexOf('>') + 1; if (!main || m[1].length > main.src.length) main = { off, src: m[1] }; }
  const ast = acorn.parse(main.src.replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')), { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  let body = ast.body; const iife = body.find(st => st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && /Function/.test(st.expression.callee.type));
  if (iife) body = body.concat(iife.expression.callee.body.body);
  const out = [];
  body.forEach(st => { if (st.type === 'VariableDeclaration' && +fileAt(st.start + main.off).slice(0, 3) >= 550) st.declarations.forEach(d => d.id.type === 'Identifier' && out.push(d.id.name)); });
  return out;
}
const SHOWV = showVars();
// NADE_SOLVE_MS — время подборов броска по часам (380, «только для проверки»); tracers, soundPings, killfeed, nowTs — показ с часами страницы
// (born / t: nowTs), расчёт только обрезает длину и чистит (490:379, 540:393, 530:88, 435:96) — проверено grep 24.11
const SKIP = opt('skip', '^(WPM|ZDJ|KPC|MK.*|SHOW_Q|VOICE_DIRTY|LOG_DIRTY|KF_DIRTY|NADE_SOLVE_MS|tracers|soundPings|killfeed|nowTs|' + SHOWV.join('|') + ')$');
// поля показа внутри объектов игры: _visFacing пишет только рисование (620, 625, 660, 675); _hitFx = {t: nowTs} — вспышка попадания (450:52,
// 490:306); код расчёта 000–545 их не читает (grep 24.11)
const SKIPF = opt('skip-field', '^(_visFacing|_hitFx)$');
const inj = k => { const f = opt('inject-' + k, ''); return f ? fs.readFileSync(f, 'utf8') : ''; };

const SETUP = `window.DV = {
  skip: new RegExp(${JSON.stringify(SKIP)}), skipf: new RegExp(${JSON.stringify(SKIPF)}),
  h: function(s){ var x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; },
  list: function(){ return mkSnapList().filter(function(e){ return !DV.skip.test(e[0]); }); },
  // дерево для хэша и сравнения: объект — один раз (повтор — {"#": номер}); Map, Set, типизированные массивы, -0, NaN, ±∞; поля показа — пропуск
  tree: function(root){ var ids = new Map();
    function enc(v){
      if(v === undefined) return {u: 1};
      if(typeof v === 'number') return v !== v ? {n: 'NaN'} : v === Infinity ? {n: 'I'} : v === -Infinity ? {n: '-I'} : (v === 0 && 1/v < 0) ? {n: '-0'} : v;
      if(typeof v === 'function') return {f: v.name || 1};
      if(v === null || typeof v !== 'object') return v;
      if(ids.has(v)) return {'#': ids.get(v)}; ids.set(v, ids.size);
      if(Array.isArray(v)) return v.map(enc);
      if(ArrayBuffer.isView(v)) return {t: Array.prototype.map.call(v, enc)};
      if(v instanceof Map){ var m = []; v.forEach(function(x, k){ m.push([enc(k), enc(x)]); }); return {m: m}; }
      if(v instanceof Set){ var a = []; v.forEach(function(x){ a.push(enc(x)); }); return {s: a}; }
      var o = {}; Object.keys(v).forEach(function(k){ if(!DV.skipf.test(k)) o[k] = enc(v[k]); }); return o; }
    return enc(root); },
  str: function(e){ try{ return JSON.stringify(DV.tree(e[1]())); }catch(x){ return '!' + x; } },
  state: function(){ var o = {}; DV.list().forEach(function(e){ o[e[0]] = DV.h(DV.str(e)); }); return o; },
  pack: function(names){ var o = {}; DV.list().forEach(function(e){ if(names.indexOf(e[0]) >= 0) o[e[0]] = DV.str(e); }); return o; },
  // журнал Math — только вызовы внутри stepTick (кадр страницы между шагами тоже зовёт Math)
  mathOn: function(){ if(DV.M) return; DV.M = {}; DV.log = [];
    ['sin','cos','tan','atan','atan2','asin','acos','exp','log','pow','hypot','sqrt'].forEach(function(f){ var o = Math[f]; DV.M[f] = o;
      Math[f] = function(){ var r = o.apply(Math, arguments); if(DV.inTick && DV.log.length < 200000) DV.log.push([f, Array.prototype.slice.call(arguments), r]); return r; }; }); }
};`;
async function open(browser, file, inject) {
  const p = await browser.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(url.pathToFileURL(path.resolve(file)).href); await p.waitForTimeout(1200);
  await p.evaluate(c => __ev(c), SETUP + '\n' + inject + `\nfreshMatch(${MATCH}); 1`);
  return p;
}
const step = (p, n, hash) => p.evaluate(([n, hash]) => __ev(`for(var i = 0; i < ${n}; i++){ DV.inTick = 1; stepTick(); DV.inTick = 0; } JSON.stringify({tick: tick, st: ${hash} ? DV.state() : null})`), [n, hash]).then(JSON.parse);
const diffVars = (a, b) => Object.keys(Object.assign({}, a, b)).filter(k => a[k] !== b[k]);
// первые различия внутри переменной (дерево DV.tree)
function deepDiff(sa, sb, limit) {
  const out = []; let A, B; try { A = JSON.parse(sa); B = JSON.parse(sb); } catch (e) { return [{ path: '(не разобрать)', a: String(sa).slice(0, 80), b: String(sb).slice(0, 80) }]; }
  (function walk(x, y, p) {
    if (out.length >= limit) return;
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of Object.keys(Object.assign({}, x, y))) walk(x[k], y[k], p + (Array.isArray(x) ? '[' + k + ']' : '.' + k)); return; }
    out.push({ path: p || '(корень)', a: x, b: y });
  })(A, B, '');
  return out;
}
(async () => {
  const browser = await chromium.launch(), t0 = Date.now();
  let A = await open(browser, files[0], inj('a')), B = await open(browser, files[1], inj('b'));
  const rep = { a: files[0], b: files[1], match: MATCH, every: EVERY, skipShowVars: SHOWV.length, skipField: SKIPF, found: false };
  let ok = (await step(A, 0, false)).tick, bad = -1;
  const start = ok;
  for (let t = 0; t < TICKS; t += EVERY) {
    const [ra, rb] = await Promise.all([step(A, EVERY, true), step(B, EVERY, true)]);
    if (ra.tick !== rb.tick || diffVars(ra.st, rb.st).length) { bad = ra.tick; break; }
    ok = ra.tick;
  }
  if (bad < 0) { rep.checkedTo = ok; console.log('расхождения нет до тика ' + ok + ' (матч ' + MATCH + ', проверка каждые ' + EVERY + ' тиков)'); }
  else {
    // второй проход: с начала до последнего совпавшего тика, дальше по одному
    await A.close(); await B.close(); A = await open(browser, files[0], inj('a')); B = await open(browser, files[1], inj('b'));
    if (ok > start) await Promise.all([step(A, ok - start, false), step(B, ok - start, false)]);
    let ra, rb, vars = [];
    for (let k = 0; k <= EVERY + 1; k++) {
      if (MATH) await Promise.all([A, B].map(p => p.evaluate(() => __ev('DV.mathOn(); DV.log = []; 1'))));
      [ra, rb] = await Promise.all([step(A, 1, true), step(B, 1, true)]);
      vars = diffVars(ra.st, rb.st); if (vars.length || ra.tick !== rb.tick) break;
    }
    rep.found = true; rep.tick = ra.tick; rep.vars = vars;
    const names = vars.slice(0, 8), [pa, pb] = await Promise.all([A, B].map(p => p.evaluate(n => __ev('JSON.stringify(DV.pack(' + JSON.stringify(n) + '))'), names).then(JSON.parse)));
    rep.fields = {}; names.forEach(n => { rep.fields[n] = deepDiff(pa[n], pb[n], 6); });
    if (MATH) {
      const [la, lb] = await Promise.all([A, B].map(p => p.evaluate(() => __ev('JSON.stringify(DV.log)')).then(JSON.parse)));
      const i = la.findIndex((c, k) => JSON.stringify(c) !== JSON.stringify(lb[k]));
      rep.math = { calls: [la.length, lb.length], first: i < 0 ? null : { index: i, a: la[i], b: lb[i] } };
    }
    console.log('ПЕРВОЕ РАСХОЖДЕНИЕ: тик ' + rep.tick + ' (матч ' + MATCH + '); переменных: ' + vars.length + ' — ' + vars.slice(0, 12).join(', '));
    for (const n of names) for (const d of rep.fields[n]) console.log('  ' + n + d.path + ': ' + JSON.stringify(d.a) + ' → ' + JSON.stringify(d.b));
    if (rep.math) console.log('  Math: вызовов ' + rep.math.calls.join(' / ') + '; первый различный: ' + (rep.math.first ? JSON.stringify(rep.math.first) : 'нет (расхождение не из Math)'));
  }
  rep.seconds = Math.round((Date.now() - t0) / 1000);
  if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(rep, null, 1));
  await browser.close(); process.exit(rep.found ? 1 : 0);
})();
