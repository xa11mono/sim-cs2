// (Р2.1, 25.11) Состояние игры для сравнения — одно место для локатора (diverge.js) и проверки отметок (tools/marks/mark_replay.js):
// какие переменные хэшируются (снимок отметки без кэшей и показа), код DV в странице, остановка кадра страницы.
'use strict';
const path = require('path');
// (Р3.1.5, 25.11) что не сравнивать — колонка cmp реестра состояния (rebuild/state_classes.json: «да» / «нет: причина»), одно место
// для локатора, проверки отметок и снимка; было — свой список здесь (кэши, очереди показа) + разбор файлов показа (550+, showVars).
// MK* — переменные инструмента отметок (не игра), их в реестре нет.
function registryCmp() {
  const C = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'state_classes.json'), 'utf8'));
  const g = [], b = [];
  for (const [k, o] of Object.entries(C)) if (k[0] !== '_' && String(o.cmp || 'да').startsWith('нет')) (k.startsWith('g:') ? g : b).push(k.slice(2));
  return { g: g.sort(), b: b.sort() };
}
const skipDefault = () => '^(MK.*|' + registryCmp().g.join('|') + ')$', SKIPF_DEFAULT = '^(' + registryCmp().b.join('|') + ')$';
function setupCode(SKIP, SKIPF) {
  return `window.DV = {
  skip: new RegExp(${JSON.stringify(SKIP)}), skipf: new RegExp(${JSON.stringify(SKIPF)}),
  h: function(s){ var x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; },
  list: function(){ return mkSnapList().filter(function(e){ return !DV.skip.test(e[0]); }); },
  // дерево для хэша и сравнения: объект — один раз (повтор — {"#": номер}); Map, Set, типизированные массивы, -0, NaN, ±∞; поля показа — пропуск
  tree: function(root){ var ids = new Map();
    function enc(v){
      if(v === undefined) return {u: 1};
      if(typeof v === 'number') return v !== v ? {n: 'NaN'} : v === Infinity ? {n: 'I'} : v === -Infinity ? {n: '-I'} : (v === 0 && 1/v < 0) ? {n: '-0'} : v;
      if(typeof v === 'function') return {f: v.name || 1};
      if(v === null || typeof v !== 'object') return v;
      if(ids.has(v)) return {'#': ids.get(v)}; ids.set(v, ids.size);
      if(Array.isArray(v)) return v.map(enc);
      if(ArrayBuffer.isView(v)) return {t: Array.prototype.map.call(v, enc)};
      if(v instanceof Map){ var m = []; v.forEach(function(x, k){ m.push([enc(k), enc(x)]); }); return {m: m}; }
      if(v instanceof Set){ var a = []; v.forEach(function(x){ a.push(enc(x)); }); return {s: a}; }
      var o = {}; Object.keys(v).forEach(function(k){ if(!DV.skipf.test(k)) o[k] = enc(v[k]); }); return o; }
    return enc(root); },
  str: function(e){ try{ return JSON.stringify(DV.tree(e[1]())); }catch(x){ return '!' + x; } },
  // текст переменной запоминается в момент хэша: разбор различий — то же состояние, что сравнивалось (не позже)
  state: function(){ var o = {}; DV.last = {}; DV.list().forEach(function(e){ var t = DV.str(e); DV.last[e[0]] = t; o[e[0]] = DV.h(t); }); return o; },
  pack: function(names){ var o = {}; names.forEach(function(n){ if(DV.last && n in DV.last) o[n] = DV.last[n]; }); return o; },
  // журнал Math — только вызовы внутри stepTick (кадр страницы между шагами тоже зовёт Math)
  mathOn: function(){ if(DV.M) return; DV.M = {}; DV.log = [];
    ['sin','cos','tan','atan','atan2','asin','acos','exp','log','pow','hypot','sqrt'].forEach(function(f){ var o = Math[f]; DV.M[f] = o;
      Math[f] = function(){ var r = o.apply(Math, arguments); if(DV.inTick && DV.log.length < 200000) DV.log.push([f, Array.prototype.slice.call(arguments), r]); return r; }; });
    // (Р2.3) и общая математика DM (005_dmath.ts): вызов DM.hypot3 пишется как hypot, с меткой 'DM' — сравнение шагов замены идёт по имени
    // функции, аргументам и ответу (метка не сравнивается): первый вызов с теми же аргументами и другим ответом — разница реализаций
    if(typeof DM !== 'undefined') Object.keys(DM).forEach(function(k){ var o = DM[k], f = k === 'hypot3' ? 'hypot' : k;
      DM[k] = function(){ var r = o.apply(DM, arguments); if(DV.inTick && DV.log.length < 200000) DV.log.push([f, Array.prototype.slice.call(arguments), r, 'DM']); return r; }; }); },
  // журнал сортировок (только внутри stepTick): исходная сортировка движка вызывается как есть, записывается перестановка
  sortOn: function(){ if(DV.S) return; var os = DV.S = Array.prototype.sort; DV.slog = [];
    Array.prototype.sort = function(cmp){
      if(!DV.inTick || DV.slog.length >= 100000) return os.call(this, cmp);
      var orig = Array.prototype.slice.call(this), n = 0, nan = 0;
      var r = os.call(this, cmp ? function(a, b){ n++; var v = cmp(a, b); if(v !== v) nan++; return v; } : undefined);
      DV.slog.push([cmp ? String(cmp).replace(/\s+/g, ' ').slice(0, 220) : '(по умолчанию)', orig.length, Array.prototype.map.call(this, function(x){ return orig.indexOf(x); }).join(','), n, nan]);
      return r; }; }
};`;
}
// кадр страницы (680 frame) между шагами идёт по часам страницы: тики при снятой паузе, рисование и показ пишут поля в объекты игры.
// Остановить: игру ведут только шаги инструмента (прогон 319: WebKit «расходился сам с собой» на тике 1)
async function stopFrames(p) { await p.evaluate(() => __ev('window.requestAnimationFrame = function(){ return 0; }; clockPause(true); 1')); await p.waitForTimeout(150); }
module.exports = { skipDefault, SKIPF_DEFAULT, setupCode, stopFrames };
