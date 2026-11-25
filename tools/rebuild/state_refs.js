// (Р3.1 / Т-1, 25.11) Общие ссылки состояния на неизменяемые данные: какие переменные снимка (и поля ботов) держат ссылки на объекты
// корней вне снимка (MAP, NAVAREAS, LADDERS, ZONE_SAMPLES, …) — опытом по ходу матча. Игру не меняет. Для реестра состояния (колонка refs,
// tools/rebuild/state_classes.py) и ремонта снимка: такие ссылки восстанавливаются как ссылки на объект страницы, а не копия.
// Запуск: node tools/rebuild/state_refs.js sim.html --match=3 --at=3000,20000,45000,70000 --out=файл.json
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), AT = (A.at || '3000,20000,45000,70000').split(',').map(Number);
const G = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'gen', 'state.json'), 'utf8')).globals);
const CODE = `(function(G){
  var snapN = mkSnapList().map(function(e){ return e[0]; }), inSnap = new Set(snapN), owner = new Map();
  // объекты корней вне снимка (без типизированных массивов и элементов страницы): объект → корень
  G.forEach(function(n){ if(inSnap.has(n)) return; var v; try{ v = eval(n); }catch(e){ return; } if(!v || typeof v !== 'object') return;
    var st = [v]; while(st.length){ var x = st.pop(); if(x === null || typeof x !== 'object' || owner.has(x)) continue;
      if(typeof Node !== 'undefined' && x instanceof Node) continue; if(ArrayBuffer.isView(x)) continue; owner.set(x, n);
      if(x instanceof Map){ x.forEach(function(y){ st.push(y); }); continue; } if(x instanceof Set){ x.forEach(function(y){ st.push(y); }); continue; }
      for(var k in x){ var y; try{ y = x[k]; }catch(e){ continue; } if(y && typeof y === 'object') st.push(y); } } });
  // переменные снимка: ссылка на объект чужого корня → (переменная или поле бота) → корни
  var hits = {}, seen = new Set();
  function add(who, root){ var h = hits[who] || (hits[who] = {}); h[root] = (h[root] || 0) + 1; }
  function walk(v, who){ if(v === null || typeof v !== 'object' || seen.has(v)) return; if(owner.has(v)){ add(who, owner.get(v)); return; } seen.add(v);
    if(typeof Node !== 'undefined' && v instanceof Node) return; if(ArrayBuffer.isView(v)) return;
    if(v instanceof Map){ v.forEach(function(x){ walk(x, who); }); return; } if(v instanceof Set){ v.forEach(function(x){ walk(x, who); }); return; }
    for(var k in v){ var x; try{ x = v[k]; }catch(e){ continue; } walk(x, who); } }
  snapN.forEach(function(n){ var v; try{ v = eval(n); }catch(e){ return; }
    if(n === 'bots') v.forEach(function(b){ seen.add(b); for(var k in b) walk(b[k], 'b:' + k); }); else walk(v, 'g:' + n); });
  return JSON.stringify(hits); })`;
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p);
  await p.evaluate(m => __ev('freshMatch(' + m + '); 1'), M);
  const out = {};
  for (const T of AT) {
    const h = JSON.parse(await p.evaluate(([T, c, g]) => __ev('var M0 = matchNum; while(tick < ' + T + ' && matchNum === M0) stepTick(); ' + c + '(' + JSON.stringify(g) + ')'), [T, CODE, G]));
    for (const [who, R] of Object.entries(h)) { const o = out[who] || (out[who] = {}); for (const [r, n] of Object.entries(R)) o[r] = (o[r] || 0) + n; }
    console.error('тик', T, 'держателей', Object.keys(h).length);
  }
  await br.close();
  const res = { sim: path.basename(SIM), match: M, at: AT, holders: out };
  fs.writeFileSync(A.out || 'state_refs.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
