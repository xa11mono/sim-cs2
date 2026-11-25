// (Т-3 / Т-4, 25.11) граф связей после перестройки навмеша во время игры = граф загрузки? Игру не меняет (страница — своя копия).
// Подпись графа: участок → связи (куда, высота, «спрыгнуть»), по порядку. --cut=0 — не срезать высокие связи вручную после перестройки
// (проверка Т-4: перестройка должна срезать сама); по умолчанию — срезать (проверка Т-3: граф одинаков при одинаковом срезе).
// Запуск: node tools/rebuild/graph_rebuild_check.js sim.html [--cut=0]
'use strict';
const path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const CUT = !process.argv.includes('--cut=0');
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(path.resolve(process.argv[2])).href); await p.waitForTimeout(1200); await DVS.stopFrames(p);
  const r = await p.evaluate(cut => __ev(`(function(){
    function sig(){ var o = {}; for(var id in zoneGraph) o[id] = zoneGraph[id].map(function(e){ return e.to + (e.drop ? 'd' : '') + '@' + e.z; }).join(','); return o; }
    var a = sig(), ta = navTallDone; rebuildNav(); var tb = navTallDone; ${cut ? 'if(!navTallDone) navCutTall();' : ''} var b = sig(), diff = [], n = 0;
    for(var id in Object.assign({}, a, b)) if(a[id] !== b[id]){ n++; if(diff.length < 6) diff.push(id + ': ' + String(a[id]).slice(0, 60) + ' → ' + String(b[id]).slice(0, 60)); }
    return JSON.stringify({same: n === 0, areasDiffer: n, tallDoneAtLoad: ta, tallDoneAfterRebuild: tb, sample: diff}); })()`), CUT);
  console.log(r); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
