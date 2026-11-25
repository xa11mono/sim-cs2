// (Р0.12, 24.11) Корпус реальных аргументов Math из матчей: вызовы sin, cos, atan, atan2, acos, exp, log, pow, hypot, sqrt ВНУТРИ stepTick
// (кадр страницы не в счёт), уникальные по битам, до --cap на функцию (ограничение размера файла, не параметр игры). Игру не меняет:
// обёртка возвращает тот же результат.  node tools/dmath/corpus.js sim.html [--match=3] [--ticks=20000] [--cap=100000] --out=corpus.json
const { chromium } = require('playwright'), url = require('url'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const sim = args.find(x => !x.startsWith('--')), MATCH = +opt('match', 3), TICKS = +opt('ticks', 20000), CAP = +opt('cap', 100000), OUT = opt('out', '');
if (!sim || !OUT) { console.error('node tools/dmath/corpus.js sim.html --out=corpus.json [--match=3] [--ticks=20000] [--cap=100000]'); process.exit(2); }
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(url.pathToFileURL(path.resolve(sim)).href); await p.waitForTimeout(1200);
  await p.evaluate(c => __ev(c), `window.CORP = {on: 0, sets: {}, out: {}, cap: ${CAP}};
    ['sin','cos','atan','atan2','acos','exp','log','pow','hypot','sqrt'].forEach(function(f){ var o = Math[f]; CORP.sets[f] = new Set(); CORP.out[f] = [];
      Math[f] = function(){ var r = o.apply(Math, arguments); if(CORP.on){ var a = Array.prototype.slice.call(arguments), k = a.join(','); var S = CORP.sets[f];
        if(S.size < CORP.cap && !S.has(k)){ S.add(k); CORP.out[f].push(a.length > 1 ? a : a[0]); } } return r; }; });
    freshMatch(${MATCH}); 1`);
  for (let t = 0; t < TICKS; t += 500) await p.evaluate(n => __ev(`for(var i = 0; i < ${n}; i++){ CORP.on = 1; stepTick(); CORP.on = 0; } 1`), 500);
  const out = JSON.parse(await p.evaluate(() => __ev('JSON.stringify(CORP.out)')));
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(Object.entries(out).map(([k, v]) => k + ' ' + v.length).join(', '));
  await b.close();
})();
