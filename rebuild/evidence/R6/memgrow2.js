// приблизительный объём каждой общей переменной реестра (обход графа объектов; объект — один раз на весь замер) — что растёт; только чтение
const v8 = require('v8'); const [core, m, ...at] = process.argv.slice(2);
const EV = require('../../../tools/node/core_run.js').load(core);
const REG = require('../../../rebuild/state_classes.json'); const names = Object.keys(REG).filter(k => k.startsWith('g:')).map(k => k.slice(2));
globalThis.__names = names;
const heap = () => { global.gc(); return Math.round(v8.getHeapStatistics().used_heap_size / 1048576); };
const SIZE = `(function(N){ var seen = new WeakSet(), out = {};
  function sz(v, d){ if(v === null || v === undefined) return 8; var t = typeof v; if(t === 'number' || t === 'boolean') return 8; if(t === 'string') return 16 + v.length * 2; if(t === 'function') return 64;
    if(t !== 'object') return 8; if(seen.has(v)) return 0; seen.add(v); if(ArrayBuffer.isView(v)) return 64 + v.byteLength; if(v instanceof ArrayBuffer) return 64 + v.byteLength;
    var s = 32; if(d > 60) return s;
    if(v instanceof Map){ v.forEach(function(x, k){ s += 16 + sz(k, d+1) + sz(x, d+1); }); return s; }
    if(v instanceof Set){ v.forEach(function(x){ s += 8 + sz(x, d+1); }); return s; }
    var ks = Object.keys(v); for(var i = 0; i < ks.length; i++){ s += 16 + sz(v[ks[i]], d+1); } return s; }
  N.forEach(function(n){ var v; try{ v = eval(n); }catch(e){ return; } out[n] = sz(v, 0); }); return JSON.stringify(out); })(globalThis.__names)`;
EV('freshMatch(' + m + '); 1');
const R = [{ tick: 0, heap: heap(), s: JSON.parse(EV(SIZE)) }];
for (const T of at.map(Number)) { EV(`while(tick < ${T}) stepTick(); 1`); R.push({ tick: T, heap: heap(), s: JSON.parse(EV(SIZE)) }); }
const L = R[R.length - 1].s, F = R[0].s;
const top = Object.keys(L).map(k => [k, L[k] - (F[k] || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(JSON.stringify({ heap: R.map(r => [r.tick, r.heap]), top: top.map(([k, d]) => [k, (REG['g:' + k] || {}).class, Math.round(d / 1048576 * 10) / 10 + ' МБ', R.map(r => Math.round((r.s[k] || 0) / 1048576 * 10) / 10)]) }));
