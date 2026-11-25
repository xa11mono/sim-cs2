// (Р3.2, канал «место», У-9) какое значение SPOT_TEAM видит каждый вызов pickSpots на самом деле (опыт к статическому разбору
// spot_team_sites.js: граф вызовов не видит вызовов через переданные функции). Место вызова — функция, из которой вызван pickSpots (стек).
// Игру не меняет: обёртка только читает SPOT_TEAM и стек; pickSpots вызывается как есть. Запуск: node … sim.html --match=3 --ticks=60000
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), T = +(A.ticks || 60000);
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p);
  const r = await p.evaluate(([m, t]) => __ev(`(function(){ var R = {}, o = pickSpots;
    pickSpots = function(key, center, count, opt){
      var fr = String(new Error().stack || '').split('\\n').slice(2), fn = '?';
      // первая именованная функция по стеку; анонимный обратный вызов — «аноним < имя» (+ строка вызова)
      for(var i = 0; i < fr.length; i++){ var mm = fr[i].match(/at (?:\\S+\\.)?([A-Za-z_$][\\w$]*) \\(/);
        if(mm){ fn = i ? 'аноним:' + ((fr[0].match(/:(\\d+):\\d+\\)?\\s*$/) || [])[1] || '?') + ' < ' + mm[1] : mm[1]; break; } }
      // явная сторона ≠ SPOT_TEAM — расхождение переноса (Р3.2, место ш.2): отмечается отдельно
      var k = fn + ' | ' + (opt && opt.team ? 'team ' + opt.team + (opt.team !== SPOT_TEAM ? ' ≠ SPOT_TEAM ' + SPOT_TEAM : ' = SPOT_TEAM') : 'SPOT_TEAM ' + SPOT_TEAM); R[k] = (R[k] || 0) + 1;
      return o.apply(this, arguments); };
    freshMatch(${m}); var M0 = matchNum; while(tick < ${t} && matchNum === M0) stepTick(); pickSpots = o; return JSON.stringify(R); })()`), [M, T]);
  await br.close();
  const R = JSON.parse(r), byFn = {};
  for (const [k, n] of Object.entries(R)) { const [fn, v] = k.split(' | '); (byFn[fn] = byFn[fn] || {})[v] = n; }
  const res = { sim: path.basename(SIM), match: M, ticks: T, by_caller: byFn };
  fs.writeFileSync(A.out || 'spot_team_runtime.json', JSON.stringify(res, null, 1));
  console.log(Object.entries(byFn).map(([f, v]) => f + ': ' + JSON.stringify(v)).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
