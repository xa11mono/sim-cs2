// (Р2.2 / Р2.5 / Р2.6, 25.11) dmath в браузере = dmath в Node бит в бит: одни и те же входы (граничные, случайные с зерном, корпус игры),
// выходы сворачиваются в хэш по каждой функции и сравниваются с Node. Движок — SIM_BROWSER (chromium | firefox | webkit).
//   node tools/dmath/page_check.js [corpus.json] [--out=отчёт.json] [--n=100000]
'use strict';
const pw = require('playwright'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const corpusFile = args.find(x => !x.startsWith('--')), N = +opt('n', 100000), ENGINE = process.env.SIM_BROWSER || 'chromium';
const SRC = require(path.join(__dirname, '..', 'rebuild', 'game_src.js')).readGame('005_dmath.ts');
// один и тот же код считает хэши в Node и в странице
const RUN = function (D, corpus, N) {
  const F = new Float64Array(1), U = new Uint32Array(F.buffer); let seed = 987654321 >>> 0;
  const u = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const any = () => { U[1] = (u() * 4294967296) >>> 0; U[0] = (u() * 4294967296) >>> 0; return F[0]; };
  const EDGE = [0, -0, Infinity, -Infinity, NaN, 5e-324, -5e-324, 2.2250738585072014e-308, 1.7976931348623157e308, 1, -1, 0.5, -0.5, 2, 3, Math.PI, -Math.PI, Math.PI / 2,
    1e-300, 1e300, 1e22, 1.6e6, 2 ** 52, 709.79, -745.14, 1e-8, 0.9999999999999999, 1.0000000000000002, 46.8, 1308.17, 0.25, 1.5, 100];
  const out = {};
  const fns = { sin: 1, cos: 1, atan: 1, acos: 1, exp: 1, log: 1, atan2: 2, pow: 2, hypot: 2, hypot3: 3 };
  for (const f of Object.keys(fns)) {
    // два хэша: по сырым битам и с NaN, приведённым к одному виду — биты NaN (полезная нагрузка) движки хранят по-разному, а игре они
    // не видны (NaN — это NaN; в снимке и JSON — null); различие только в сыром хэше = различие только в битах NaN
    const k = fns[f]; let h = 2166136261 >>> 0, hc = 2166136261 >>> 0, n = 0, nan = 0;
    const mix = v => { F[0] = v; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; n++;
      if (v !== v) { nan++; F[0] = NaN; U[0] = 0; U[1] = 0x7ff80000; } hc = Math.imul(hc ^ U[0], 16777619) >>> 0; hc = Math.imul(hc ^ U[1], 16777619) >>> 0; };
    const call = a => mix(k === 1 ? D[f](a[0]) : k === 2 ? D[f](a[0], a[1]) : D[f](a[0], a[1], a[2]));
    if (k === 1) EDGE.forEach(a => call([a])); else if (k === 2) EDGE.forEach(a => EDGE.forEach(b => call([a, b]))); else EDGE.forEach(a => EDGE.forEach(b => call([a, b, 1.5])));
    for (let i = 0; i < N; i++) { const r = () => (i % 2 ? (u() - 0.5) * 6000 : any()); call([r(), r(), r()]); }
    const c = corpus && corpus[f === 'hypot3' ? 'none' : f]; if (c) c.forEach(a => call(Array.isArray(a) ? a : [a]));
    out[f] = { n, nan, hash: h.toString(16), hashNaNcanon: hc.toString(16) };
  }
  return out;
};
(async () => {
  const raw = corpusFile ? fs.readFileSync(corpusFile) : null, corpus = raw ? JSON.parse((/\.gz$/.test(corpusFile) ? require('zlib').gunzipSync(raw) : raw).toString('utf8')) : null;   // .json или .json.gz (tools/dmath/corpus_sample.json.gz)
  const node = RUN(require('./dmath.js'), corpus, N);
  const b = await pw[ENGINE].launch(), p = await b.newPage();
  await p.addScriptTag({ content: SRC + '\nwindow.D = DM;' });
  const page = await p.evaluate(([code, corpus, N]) => (0, eval)('(' + code + ')')(window.D, corpus, N), [RUN.toString(), corpus, N]);
  const bad = Object.keys(node).filter(f => node[f].hashNaNcanon !== page[f].hashNaNcanon || node[f].n !== page[f].n);   // значения (NaN — любой)
  const nanBits = Object.keys(node).filter(f => !bad.includes(f) && node[f].hash !== page[f].hash);                       // только биты NaN
  const rep = { engine: ENGINE + ' ' + b.version(), node: process.version, n: N, corpus: !!corpus, functions: Object.keys(node).map(f => f + ' ' + node[f].n + (bad.includes(f) ? ' РАЗНЫЕ' : ' =')).join(', '), mismatch: bad, nanBitsOnly: nanBits, nodeHashes: node, pageHashes: page };
  console.log(rep.engine + ': ' + (bad.length ? 'РАСХОДИТСЯ — ' + bad.join(', ') : 'dmath страницы = dmath Node бит в бит (NaN — любой)') +
    (nanBits.length ? '; различаются только биты NaN: ' + nanBits.join(', ') : '') + ' (' + rep.functions + ')');
  if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(rep, null, 1));
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
