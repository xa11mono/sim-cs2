// (Р2.1, 25.11) Состояние игры для сравнения — одно место для локатора (diverge.js) и проверки отметок (tools/marks/mark_replay.js):
// какие переменные хэшируются (снимок отметки без кэшей и показа), код DV в странице, остановка кадра страницы.
'use strict';
const path = require('path');
// Не хэшируются: (1) кэши, чьё содержимое не меняет результат (как SNAP_SKIP в rec2.js); (2) очереди показа; (3) все переменные верхнего
// уровня из файлов показа и инструментов (src/game/550… и выше: рисование, HUD, редакторы, обсервер, повтор, песочница, звук, кадр) —
// их обновляет кадр страницы по её часам; находятся разбором исходника, а не списком руками.
function showVars() {
  let acorn; try { acorn = require('acorn'); } catch (e) { try { acorn = require(path.join(__dirname, '..', 'rebuild', 'node_modules', 'acorn')); }   // пакеты сборки (src/build.py ставит их сам)
    catch (e2) { console.error('нет acorn: npm i --prefix tools/rebuild или NODE_PATH'); process.exit(2); } }
  // как tools/rebuild/gen_maps.js: склейка src/game (html + js), основной <script>, тело общей обёртки, дом переменной — файл объявления
  const { all, spans } = require(path.join(__dirname, '..', 'rebuild', 'game_src.js')).concat();   // (Р1.1) .ts — без типов, позиции те же
  const fileAt = pos => (spans.find(sp => pos >= sp[0] && pos < sp[1]) || spans[spans.length - 1])[2];
  let main = null;
  for (const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { const off = m.index + m[0].indexOf('>') + 1; if (!main || m[1].length > main.src.length) main = { off, src: m[1] }; }
  const ast = acorn.parse(main.src.replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')), { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  let body = ast.body; const iife = body.find(st => st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && /Function/.test(st.expression.callee.type));
  if (iife) body = body.concat(iife.expression.callee.body.body);
  const out = [];
  body.forEach(st => { if (st.type === 'VariableDeclaration' && +fileAt(st.start + main.off).slice(0, 3) >= 550) st.declarations.forEach(d => d.id.type === 'Identifier' && out.push(d.id.name)); });
  return out;
}
const SKIP_BASE = '^(WPM|ZDJ|KPC|MK.*|SHOW_Q|VOICE_DIRTY|LOG_DIRTY|KF_DIRTY|NADE_SOLVE_MS|tracers|soundPings|killfeed|nowTs|';
const skipDefault = () => SKIP_BASE + showVars().join('|') + ')$', SKIPF_DEFAULT = '^(_visFacing|_hitFx)$';
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
module.exports = { showVars, skipDefault, SKIPF_DEFAULT, setupCode, stopFrames };
