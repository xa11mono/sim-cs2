// (Т-1б, 25.11) Изменения «неизменяемых» данных: какие поля игра дописывает / меняет в объектах корней, на которые ссылается состояние
// (MK_REF_ROOTS: MAP, NAVAREAS, LADDERS, ZONE_*, zoneGraph) — опытом: ключи и простые значения каждого объекта при загрузке и по ходу матча.
// Найденное (например, ленивые кэши KNOW_POSITIONS.points[*].zid, лайнапы ._npz) — состояние: снимок должен его нести. Игру не меняет.
// Запуск: node tools/rebuild/state_static_mut.js sim.html --match=3 --at=20000,45000,70000 --out=файл.json
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), AT = (A.at || '20000,45000,70000').split(',').map(Number);
const CODE = `window.SM = { take: function(){ var I = mkRefIndex(), o = new Map();
    I.m.forEach(function(e, x){ if(Array.isArray(x)) return; var r = {}; for(var k in x){ var v = x[k]; r[k] = (v === null || typeof v !== 'object') ? String(v) : '#'; } o.set(x, r); });
    return o; },
  diff: function(a, b){ var I = mkRefIndex(), add = {}, chg = {};
    b.forEach(function(r, x){ var q = a.get(x); if(!q) return; var e = I.m.get(x), root = MK_REF_ROOTS[mkRefPath(I, e)[0]] || mkRefPath(I, e)[0];
      for(var k in r){ if(!(k in q)){ var key = root + ' .' + k; add[key] = (add[key] || 0) + 1; } else if(q[k] !== r[k] && r[k] !== '#'){ var key2 = root + ' .' + k; chg[key2] = (chg[key2] || 0) + 1; } } });
    return {added: add, changed: chg}; } };`;
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p);
  await p.evaluate(c => __ev(c), CODE + '1');
  await p.evaluate(m => __ev('freshMatch(' + m + '); window.SM0 = SM.take(); 1'), M);
  const res = { sim: path.basename(SIM), match: M, points: {} };
  for (const T of AT) {
    res.points[T] = JSON.parse(await p.evaluate(T => __ev('var M0 = matchNum; while(tick < ' + T + ' && matchNum === M0) stepTick(); JSON.stringify(SM.diff(SM0, SM.take()))'), T));
    console.error('тик', T, JSON.stringify(res.points[T]).slice(0, 300));
  }
  await br.close(); fs.writeFileSync(A.out || 'static_mut.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
