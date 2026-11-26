// (Р0.5, 24.11) Локатор расхождения двух сборок (или одной сборки в двух вариантах): первый тик, где полное состояние игры разошлось,
// какие переменные и поля, и — с --math — какой вызов Math дал разные биты. Игру не меняет: только играет и хэширует.
// Состояние — переменные снимка отметки (mkSnapList, src/snapshot.js) без кэшей и показа. Два прохода: грубый (каждые --every тиков),
// затем с начала (матч повторяем) по тику внутри найденного окна.
//   node tools/measure/diverge.js A.html B.html [--match=3] [--ticks=20000] [--every=64] [--inject-a=f.js] [--inject-b=f.js]
//        [--skip=регулярка] [--skip-add=регулярка] [--skip-field=регулярка] [--math] [--out=отчёт.json] [--start-a=код|@файл] [--start-b=код|@файл] [--snap-at=T]
// --start-*: код старта вместо freshMatch(--match) (инвариант I-22 — newMatch после матча; I-30 — перестановка ботов);
// --snap-at=T: страница B не играет сама, а открывает снимок отметки страницы A на тике T (инвариант I-23: снимок = игра).
// --inject-*: код выполняется в странице до freshMatch (самопроверка — tools/measure/selftest/math_libm.js). Нужен acorn (NODE_PATH).
// (Р2.6, 25.11) --browser-a / --browser-b = chromium | firefox | webkit — каждая страница в своём движке (одна и та же сборка или две):
// расхождение движков локализуется так же, как расхождение сборок. --sort — журнал сортировок внутри stepTick (перестановка, число вызовов
// сравнения, текст функции сравнения): разный порядок при одинаковом входе = сравнение не задаёт порядок однозначно (NaN, несогласованность).
const pw = require('playwright'), url = require('url'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const files = args.filter(x => !x.startsWith('--'));
if (files.length < 2) { console.error('node tools/measure/diverge.js A.html B.html [--match=3] [--ticks=20000] [--every=64] [--inject-a=f.js] [--inject-b=f.js] [--skip=…] [--skip-field=…] [--math] [--out=…]'); process.exit(2); }
const MATCH = +opt('match', 3), TICKS = +opt('ticks', 20000), EVERY = Math.max(1, +opt('every', 64)), MATH = args.includes('--math'), SORT = args.includes('--sort');
const ENG = { a: opt('browser-a', 'chromium'), b: opt('browser-b', 'chromium') };

const DVS = require('./dv_state.js');

// NADE_SOLVE_MS — время подборов броска по часам (380, «только для проверки»); tracers, soundPings, killfeed, nowTs — показ с часами страницы
// (born / t: nowTs), расчёт только обрезает длину и чистит (490:379, 540:393, 530:88, 435:96) — проверено grep 24.11
// (Р3.1.5) список по умолчанию — колонка cmp реестра состояния (dv_state.skipDefault), причины — там же
// --skip — заменить список по умолчанию; --skip-add=регулярка — добавить к нему (напр. удалённая переменная: --skip-add=^SPOT_TEAM$)
const SKIP = opt('skip', DVS.skipDefault()) + (opt('skip-add', '') ? '|' + opt('skip-add', '') : '');
// поля показа внутри объектов игры: _visFacing пишет только рисование (620, 625, 660, 675); _hitFx = {t: nowTs} — вспышка попадания (450:52,
// 490:306); код расчёта 000–545 их не читает (grep 24.11)
const SKIPF = opt('skip-field', DVS.SKIPF_DEFAULT);
const inj = k => { const f = opt('inject-' + k, ''); return f ? fs.readFileSync(f, 'utf8') : ''; };
const startCode = k => { const v = opt('start-' + k, ''); return !v ? `freshMatch(${MATCH});` : v[0] === '@' ? fs.readFileSync(v.slice(1), 'utf8') : v; };
const SNAP_AT = +opt('snap-at', 0);

const SETUP = DVS.setupCode(SKIP, SKIPF);
// (Р2.6, прогон 319) кадр страницы (680 frame: requestAnimationFrame) между шагами локатора идёт по часам страницы: тики при снятой паузе,
// рисование и показ пишут поля в объекты игры — в WebKit одна и та же сборка «расходилась сама с собой» на тике 1. Кадр останавливается:
// игру ведут только шаги локатора. --live-frames — оставить кадр (как было до 25.11)
const LIVE = args.includes('--live-frames');
async function open(browser, file, inject, start) {   // browser — движок своей стороны
  const p = await browser.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(url.pathToFileURL(path.resolve(file)).href); await p.waitForTimeout(1200);
  if (!LIVE) await DVS.stopFrames(p);
  await p.evaluate(c => __ev(c), SETUP + '\n' + inject + '\n' + start + '\n1');
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
  const t0 = Date.now(), BR = {};
  for (const k of ['a', 'b']) if (!BR[ENG[k]]) BR[ENG[k]] = await pw[ENG[k]].launch();
  const brA = BR[ENG.a], brB = BR[ENG.b];
  // страница B со снимка страницы A (I-23): A доигрывает до T, снимок → B (mkOpenSnap, как отметка); дальше обе идут от T
  async function openPair() {
    const A = await open(brA, files[0], inj('a'), startCode('a'));
    if (!SNAP_AT) return [A, await open(brB, files[1], inj('b'), startCode('b'))];
    const snap = await A.evaluate(T => __ev(`for(var i = 0; i < ${T}; i++) stepTick(); mkPack(mkSnapshot())`), SNAP_AT);
    const B = await open(brB, files[1], inj('b'), 'freshMatch(' + MATCH + ');');
    await B.evaluate(s => { __ev('mkOpenSnap(' + JSON.stringify(s) + '); 1'); }, snap);
    return [A, B];
  }
  let [A, B] = await openPair();
  const rep = { a: files[0], b: files[1], engines: { a: ENG.a + ' ' + brA.version(), b: ENG.b + ' ' + brB.version() }, match: MATCH, every: EVERY, startA: startCode('a'), startB: SNAP_AT ? 'снимок A на тике ' + SNAP_AT : startCode('b'), skip: SKIP, skipField: SKIPF, found: false };
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
    await A.close(); await B.close(); [A, B] = await openPair();
    if (ok > start) await Promise.all([step(A, ok - start, false), step(B, ok - start, false)]);
    let ra, rb, vars = [];
    for (let k = 0; k <= EVERY + 1; k++) {
      if (MATH) await Promise.all([A, B].map(p => p.evaluate(() => __ev('DV.mathOn(); DV.log = []; 1'))));
      if (SORT) await Promise.all([A, B].map(p => p.evaluate(() => __ev('DV.sortOn(); DV.slog = []; 1'))));
      [ra, rb] = await Promise.all([step(A, 1, true), step(B, 1, true)]);
      vars = diffVars(ra.st, rb.st); if (vars.length || ra.tick !== rb.tick) break;
    }
    rep.found = true; rep.tick = ra.tick; rep.vars = vars;
    const names = vars.slice(0, 8), [pa, pb] = await Promise.all([A, B].map(p => p.evaluate(n => __ev('JSON.stringify(DV.pack(' + JSON.stringify(n) + '))'), names).then(JSON.parse)));
    rep.fields = {}; names.forEach(n => { rep.fields[n] = deepDiff(pa[n], pb[n], 6); });
    if (MATH) {
      const [la, lb] = await Promise.all([A, B].map(p => p.evaluate(() => __ev('JSON.stringify(DV.log)')).then(JSON.parse)));
      const key = c => c ? JSON.stringify(c.slice(0, 3)) : null;   // имя, аргументы, ответ (метка 'DM' — не сравнивается)
      const i = la.findIndex((c, k) => key(c) !== key(lb[k]));
      rep.math = { calls: [la.length, lb.length], first: i < 0 ? null : { index: i, a: la[i], b: lb[i] } };
    }
    if (SORT) {
      const [sa, sb] = await Promise.all([A, B].map(p => p.evaluate(() => __ev('JSON.stringify(DV.slog)')).then(JSON.parse)));
      const i = sa.findIndex((c, k) => !sb[k] || c[0] !== sb[k][0] || c[1] !== sb[k][1] || c[2] !== sb[k][2]);
      rep.sort = { calls: [sa.length, sb.length], withNaN: [sa.filter(c => c[4]).length, sb.filter(c => c[4]).length],
        first: i < 0 ? null : { index: i, a: sa[i], b: sb[i] }, nanSorts: sa.filter(c => c[4]).slice(0, 10) };
      console.log('  сортировки: ' + rep.sort.calls.join(' / ') + ', с NaN в сравнении: ' + rep.sort.withNaN.join(' / ') + '; первая с разным порядком: ' + (rep.sort.first ? JSON.stringify(rep.sort.first).slice(0, 600) : 'нет'));
    }
    console.log('ПЕРВОЕ РАСХОЖДЕНИЕ: тик ' + rep.tick + ' (матч ' + MATCH + '); переменных: ' + vars.length + ' — ' + vars.slice(0, 12).join(', '));
    for (const n of names) for (const d of rep.fields[n]) console.log('  ' + n + d.path + ': ' + JSON.stringify(d.a) + ' → ' + JSON.stringify(d.b));
    if (rep.math) console.log('  Math: вызовов ' + rep.math.calls.join(' / ') + '; первый различный: ' + (rep.math.first ? JSON.stringify(rep.math.first) : 'нет (расхождение не из Math)'));
  }
  rep.seconds = Math.round((Date.now() - t0) / 1000);
  if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(rep, null, 1));
  for (const b of Object.values(BR)) await b.close(); process.exit(rep.found ? 1 : 0);
})();
