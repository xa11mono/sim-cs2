// (Р0.12) скорость dmath против Math.* в Chromium (Playwright) на корпусе реальных аргументов игры: нс на вызов, медиана 3 повторов.
//   node tools/dmath/speed_page.js corpus.json [--n=50000] [--out=…]
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const corpus = JSON.parse(fs.readFileSync(args.find(x => !x.startsWith('--')), 'utf8')), N = +opt('n', 50000);
const src = require(path.join(__dirname, '..', 'rebuild', 'game_src.js')).readGame('dmath.ts') + '\nwindow.D = DM;';   // (Р2.2) игровой dmath
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.addScriptTag({ content: src });
  const sub = {}; for (const [k, v] of Object.entries(corpus)) sub[k] = v.slice(0, N);
  const r = await p.evaluate(C => { const out = {};
    for (const [f, v] of Object.entries(C)) { if (!v.length) continue; const two = Array.isArray(v[0]), d = D[f], m = Math[f]; if (!d) continue;
      const t = g => { let s = 0; const t0 = performance.now(); for (let r = 0; r < 5; r++) for (let i = 0; i < v.length; i++) s += two ? g(v[i][0], v[i][1]) : g(v[i]); return (performance.now() - t0) * 1e6 / (5 * v.length); };
      const ds = [], ms = []; t(d); t(m); for (let k = 0; k < 3; k++){ ds.push(t(d)); ms.push(t(m)); } ds.sort((a, b) => a - b); ms.sort((a, b) => a - b);
      out[f] = { n: v.length, dmath_ns: +ds[1].toFixed(1), math_ns: +ms[1].toFixed(1) }; } return out; }, sub);
  r._env = { chromium: b.version() }; console.log(JSON.stringify(r)); if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(r, null, 1)); await b.close();
})();
