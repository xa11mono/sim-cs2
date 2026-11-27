const v8 = require('v8'); const [core, m, ...at] = process.argv.slice(2);
const EV = require('../../../tools/node/core_run.js').load(core);
const SIZE = `(function(){ var out = {};
  function sz(v, seen){ if(v === null || v === undefined) return 8; var t = typeof v; if(t === 'number' || t === 'boolean') return 8; if(t === 'string') return 16 + v.length * 2;
    if(t !== 'object') return 8; if(seen.has(v)) return 0; seen.add(v); if(ArrayBuffer.isView(v)) return 64 + v.byteLength; var s = 32;
    if(v instanceof Map){ v.forEach(function(x, k){ s += 16 + sz(k, seen) + sz(x, seen); }); return s; } if(v instanceof Set){ v.forEach(function(x){ s += 8 + sz(x, seen); }); return s; }
    var ks = Object.keys(v); for(var i = 0; i < ks.length; i++) s += 16 + sz(v[ks[i]], seen); return s; }
  var M = M3; Object.keys(M).forEach(function(k){ out[k] = [sz(M[k], new WeakSet()), M[k] instanceof Map ? 'Map ' + M[k].size : Array.isArray(M[k]) ? 'Array ' + M[k].length : ArrayBuffer.isView(M[k]) ? 'TA ' + M[k].length : typeof M[k] === 'object' && M[k] ? 'obj ' + Object.keys(M[k]).length : typeof M[k]]; }); return JSON.stringify(out); })()`;
EV('freshMatch(' + m + '); 1'); const R = [JSON.parse(EV(SIZE))];
for (const T of at.map(Number)) { EV(`while(tick < ${T}) stepTick(); 1`); R.push(JSON.parse(EV(SIZE))); }
const L = R[R.length - 1]; Object.keys(L).map(k => [k, L[k][0] - ((R[0][k] || [0])[0])]).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, d]) => console.log(k, Math.round(d / 1048576 * 10) / 10 + ' МБ', R.map(r => r[k] ? Math.round(r[k][0] / 1048576 * 10) / 10 + ' (' + r[k][1] + ')' : '-').join(' → ')));
