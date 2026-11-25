// (Р3.2, канал «место», У-9) явная сторона в каждом вызове pickSpots против стороны работающего мозга (то, что раньше давал SPOT_TEAM:
// "T" внутри tBrain, "CT" внутри ctBrain, иначе нет). Мозг помечает сам инструмент обёрткой tBrain / ctBrain — работает и на сборках без
// SPOT_TEAM (после ш.2б). Место вызова — функция, из которой вызван pickSpots (стек). Игру не меняет: обёртки только помечают и считают.
// Запуск: node … sim.html --match=3 --ticks=60000; строки «≠» — расхождение (явная сторона не равна стороне мозга)
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), T = +(A.ticks || 60000);
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p);
  const r = await p.evaluate(([m, t]) => __ev(`(function(){ var R = {}, o = pickSpots, oT = tBrain, oC = ctBrain, ST = null;
    tBrain = function(){ ST = "T"; try{ return oT.apply(this, arguments); } finally{ ST = null; } };
    ctBrain = function(){ ST = "CT"; try{ return oC.apply(this, arguments); } finally{ ST = null; } };
    pickSpots = function(key, center, count, opt){
      var fr = String(new Error().stack || '').split('\\n').slice(2), fn = '?';
      // первая именованная функция по стеку; анонимный обратный вызов — «аноним < имя» (+ строка вызова)
      for(var i = 0; i < fr.length; i++){ var mm = fr[i].match(/at (?:\\S+\\.)?([A-Za-z_$][\\w$]*) \\(/);
        if(mm){ fn = i ? 'аноним:' + ((fr[0].match(/:(\\d+):\\d+\\)?\\s*$/) || [])[1] || '?') + ' < ' + mm[1] : mm[1]; break; } }
      var tm = (opt && opt.team) || null, k = fn + ' | явная ' + tm + (tm !== ST ? ' ≠ мозг ' + ST : ' = мозг'); R[k] = (R[k] || 0) + 1;
      return o.apply(this, arguments); };
    freshMatch(${m}); var M0 = matchNum; while(tick < ${t} && matchNum === M0) stepTick(); pickSpots = o; tBrain = oT; ctBrain = oC; return JSON.stringify(R); })()`), [M, T]);
  await br.close();
  const R = JSON.parse(r), byFn = {};
  for (const [k, n] of Object.entries(R)) { const [fn, v] = k.split(' | '); (byFn[fn] = byFn[fn] || {})[v] = n; }
  const res = { sim: path.basename(SIM), match: M, ticks: T, by_caller: byFn };
  fs.writeFileSync(A.out || 'spot_team_runtime.json', JSON.stringify(res, null, 1));
  console.log(Object.entries(byFn).map(([f, v]) => f + ': ' + JSON.stringify(v)).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
