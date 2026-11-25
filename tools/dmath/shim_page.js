// (Р2.3, 25.11) Страница-подмена для доказательства шага замены: в собранной странице шага функции DM.<f> заменяются прежними Math.<f>
// (сразу после объявления DM — до игры), подбор бросков (nadeguess, его считает сама игра при сборке) берётся из страницы прежнего шага.
// Такая страница обязана играть бит в бит как прежний шаг: значит, правка тронула только места вызова и ничего больше.
//   node tools/dmath/shim_page.js <страница шага> <страница прежнего шага> <выход> <f,f,…>   (f: hypot atan2 sin cos exp log pow atan acos)
'use strict';
const fs = require('fs');
const [step, prev, out, list] = process.argv.slice(2);
if (!list) { console.error('node tools/dmath/shim_page.js шаг.html прежний.html выход.html hypot,atan2,…'); process.exit(2); }
let s = fs.readFileSync(step, 'utf8'); const p = fs.readFileSync(prev, 'utf8');
const MAP = { hypot: 'DM.hypot = function(x, y){ return Math.hypot(x, y); }; DM.hypot3 = function(x, y, z){ return Math.hypot(x, y, z); };',
  atan2: 'DM.atan2 = function(y, x){ return Math.atan2(y, x); };', pow: 'DM.pow = function(x, y){ return Math.pow(x, y); };' };
const shim = list.split(',').map(f => MAP[f] || ('DM.' + f + ' = function(x){ return Math.' + f + '(x); };')).join(' ');
const end = s.indexOf('\n', s.indexOf('var DM = (function(){') >= 0 ? s.indexOf('\n})();', s.indexOf('var DM = (function(){')) + 1 : -1);
if (end < 0) { console.error('нет объявления DM в странице шага'); process.exit(1); }
s = s.slice(0, end + 1) + '/* Р2.3 подмена: */ ' + shim + '\n' + s.slice(end + 1);
// nadeguess: объект JSON внутри набора карты — "nadeguess":{…}; найти конец по скобкам (строки JSON — без скобок внутри кавычек)
function grab(t) { const i = t.indexOf('"nadeguess":{'); if (i < 0) return null; let d = 0, j = i + 12, q = false;
  for (; j < t.length; j++) { const c = t[j]; if (q) { if (c === '\\') j++; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return [i, j + 1]; }
const a = grab(s), b = grab(p);
if (!a || !b) { console.error('нет nadeguess в странице'); process.exit(1); }
s = s.slice(0, a[0]) + p.slice(b[0], b[1]) + s.slice(a[1]);
fs.writeFileSync(out, s); console.log('подмена: ' + list + '; подбор бросков — из ' + prev);
