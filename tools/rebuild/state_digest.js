// (Р3.1) хэш состояния в странице — общий для state_runtime.js и snap_check.js: SR.dig(значение) — дерево как dv_state.js, бот внутри
// чужого значения — ссылка {bot: id}; SR.cp(имена) — хэши переменных и полей ботов
'use strict';
const PAGE = `window.SR = {
  h: function(x, s){ for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; },
  hb: function(x, v){ var u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength); for(var i = 0; i < u.length; i++) x = Math.imul(x ^ u[i], 16777619) >>> 0; return x; },
  // хэш значения: обход один раз на объект, бот (в чужом значении) — ссылка, функция — имя, DOM — метка
  dig: function(root, isField){ var ids = new Map(), x = 2166136261 >>> 0, S = SR;
    function put(s){ x = S.h(x, s); }
    function enc(v, top){
      if(v === undefined){ put('u'); return; }
      if(typeof v === 'number'){ put(v !== v ? 'NaN' : (v === 0 && 1/v < 0) ? '-0' : String(v)); return; }
      if(typeof v === 'function'){ put('f' + (v.name || '')); return; }
      if(v === null || typeof v !== 'object'){ put(typeof v + String(v)); return; }
      if(typeof Node !== 'undefined' && v instanceof Node){ put('DOM'); return; }
      if(!top && v.hp !== undefined && v.team !== undefined && v.id !== undefined){ put('bot' + v.id); return; }
      if(ids.has(v)){ put('#' + ids.get(v)); return; } ids.set(v, ids.size);
      if(ArrayBuffer.isView(v)){ put('t' + v.length); x = S.hb(x, v); return; }
      if(Array.isArray(v)){ put('[' + v.length); for(var i = 0; i < v.length; i++) enc(v[i]); return; }
      if(v instanceof Map){ put('M'); v.forEach(function(a, k){ enc(k); enc(a); }); return; }
      if(v instanceof Set){ put('S'); v.forEach(function(a){ enc(a); }); return; }
      var ks = Object.keys(v); put('{' + ks.length); for(var j = 0; j < ks.length; j++){ put(ks[j]); enc(v[ks[j]]); } }
    enc(root, !isField); return x; },
  cp: function(names){ var g = {}, b = {};
    names.forEach(function(n){ var v; try{ v = eval(n); }catch(e){ g[n] = 'нет'; return; } try{ g[n] = SR.dig(v, false); }catch(e){ g[n] = '!' + e; } });
    bots.forEach(function(bt){ Object.keys(bt).forEach(function(k){ try{ (b[k] = b[k] || []).push(SR.dig(bt[k], true)); }catch(e){ (b[k] = b[k] || []).push('!'); } }); });
    return {tick: tick, round: roundNum, g: g, b: b}; }
};`;
module.exports = { PAGE };
