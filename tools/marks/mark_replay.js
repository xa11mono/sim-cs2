// (Р2.1, 25.11) Проверка «отметка воспроизводится своей сборкой»: снимок «до» открывается в странице и доигрывается до тика отметки —
// состояние игры (переменные снимка без кэшей и показа — tools/measure/dv_state.js, как у локатора) обязано совпасть бит в бит.
//   node tools/marks/mark_replay.js make  <sim.html> <матч> <тик «до»> <тиков до отметки> <папка>   — сделать отметку как владелец:
//        <папка>/pre.json (снимок «до», mkPack) и <папка>/mark.json (тик отметки, отпечаток сборки env.src, хэши состояния в момент отметки)
//   node tools/marks/mark_replay.js check <sim.html> <папка>  — открыть pre.json, дойти до тика отметки, сравнить; код 0 — бит в бит
// Кадр страницы остановлен (dv_state.stopFrames): игру ведут только шаги инструмента.
'use strict';
const pw = require('playwright'), url = require('url'), fs = require('fs'), path = require('path');
const DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const [cmd, sim, ...rest] = process.argv.slice(2);
const SETUP = DVS.setupCode(DVS.skipDefault(), DVS.SKIPF_DEFAULT);

async function page(b, file) {
  const p = await b.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(url.pathToFileURL(path.resolve(file)).href); await p.waitForTimeout(1200);
  await DVS.stopFrames(p); await p.evaluate(c => __ev(c), SETUP + '\n1'); return p;
}
(async () => {
  if (!['make', 'check'].includes(cmd) || !sim) { console.error('node tools/marks/mark_replay.js make sim.html матч тик тиков папка | check sim.html папка'); process.exit(2); }
  const b = await pw[process.env.SIM_BROWSER || 'chromium'].launch(); let code = 0;
  try {
    const p = await page(b, sim), src = await p.evaluate(() => __ev('typeof MK_BUILD !== "undefined" ? MK_BUILD : null'));
    if (cmd === 'make') {
      const [m, t0, n, dir] = rest; fs.mkdirSync(dir, { recursive: true });
      const pre = await p.evaluate(([m, t0]) => __ev(`freshMatch(${m}); for(var i = 0; i < ${t0}; i++) stepTick(); mkPack(mkSnapshot())`), [m, t0]);
      const st = JSON.parse(await p.evaluate(n => __ev(`for(var i = 0; i < ${n}; i++) stepTick(); JSON.stringify({tick: tick, st: DV.state()})`), n));
      fs.writeFileSync(path.join(dir, 'pre.json'), pre);
      fs.writeFileSync(path.join(dir, 'mark.json'), JSON.stringify({ match: +m, preTick: +t0, tick: st.tick, env: { src }, state: st.st }));
      console.log('отметка: матч ' + m + ', снимок «до» на тике ' + t0 + ', отметка на тике ' + st.tick + ', сборка ' + src);
    } else {
      const dir = rest[0], mark = JSON.parse(fs.readFileSync(path.join(dir, 'mark.json'), 'utf8')), pre = fs.readFileSync(path.join(dir, 'pre.json'), 'utf8');
      await p.evaluate(s => { __ev('mkOpenSnap(' + JSON.stringify(s) + '); 1'); }, pre);
      const st = JSON.parse(await p.evaluate(T => __ev(`var g = 0; while(tick < ${T} && g++ < 200000) stepTick(); JSON.stringify({tick: tick, st: DV.state()})`), mark.tick));
      const diff = Object.keys(Object.assign({}, st.st, mark.state)).filter(k => st.st[k] !== mark.state[k]);
      const same = st.tick === mark.tick && !diff.length;
      console.log((same ? 'бит в бит' : 'РАСХОДИТСЯ') + ': отметка тик ' + mark.tick + ' (сборка записи ' + (mark.env && mark.env.src) + '), открыта сборкой ' + src +
        (diff.length ? '; разные переменные: ' + diff.slice(0, 12).join(', ') : ''));
      code = same ? 0 : 1;
    }
  } catch (e) { console.error(String(e.stack || e)); code = 2; }
  await b.close(); process.exit(code);
})();
