// (вопрос 16, 26.11) поведение мест, где решение не читает ответ хозяина (rebuild/unread_results.json), на реальном матче — ядро без показа в
// Node: каждый вызов setPost / assignNade — кто звал (функция по стеку), бот, тег, ответ; после отказа — заявила ли та же функция то же снова
// за 1 с (повтор заявки) и получил ли бот эту задачу за 5 с (исполнено позже). Игру не меняет: обёртки только записывают.
// Запуск: node tools/rebuild/unread_dyn.js <core.js> [--match=3] [--ticks=400000] [--out=…]
'use strict';
const path = require('path'), fs = require('fs');
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const KEYS = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'unread_results.json'), 'utf8')).known);
const FN = [...new Set(KEYS.map(k => k.split(' · ')[1]))];
const EV = require(path.resolve(__dirname, '..', 'node', 'core_run.js')).load(path.resolve(process.argv[2]));
const res = JSON.parse(EV(`(function(){
  paused = true; freshMatch(${+(A.match || 3)}); var M0 = matchNum, FN = ${JSON.stringify(FN)}, S = {};
  function who(){ var st = String(new Error().stack).split("\\n").slice(3), first = null;
    for(var i = 0; i < st.length; i++){ var m = /at (?:Object\\.)?([A-Za-z_$][\\w$]*)/.exec(st[i]); if(!m) continue;
      if(FN.indexOf(m[1]) >= 0) return m[1]; if(!first && !/^(Array|forEach|some|filter|map|eval|__ev)$/.test(m[1])) first = m[1]; }
    return first || "?"; }
  function rec(owner, b, tag, ok, why){ var k = owner + " · " + who(), s = S[k] || (S[k] = {calls: 0, refused: 0, again: 0, later: 0, why: {}, pend: []});
    s.calls++; s.pend = s.pend.filter(function(p){ if(!p.again && p.b === b.id && p.tag === tag && tick > p.t && tick - p.t <= 64){ s.again++; p.again = true; } return tick - p.t <= 320; });
    if(!ok){ s.refused++; s.why[why] = (s.why[why] || 0) + 1; s.pend.push({b: b.id, tag: tag, t: tick}); } }
  var SP = setPost; setPost = function(b, pt, look, hold, tag){ var R = SP.apply(this, arguments); if(b) rec("setPost", b, String(tag), R.ok, String(R.why || "").slice(0, 40)); return R; };
  var AN = assignNade; assignNade = function(b, type){ var R = AN.apply(this, arguments); if(b) rec("assignNade", b, String(type), R.ok, String(R.why || "").slice(0, 40)); return R; };
  var later = function(){ Object.keys(S).forEach(function(k){ var s = S[k], own = k.split(" · ")[0];
    s.pend.forEach(function(p){ if(p.got || tick - p.t > 320) return; var b = bots.find(function(x){ return x.id === p.b; });
      var has = own === "setPost" ? b && b.post && String(b.post.tag) === p.tag : b && b.nadeTask && b.nadeTask.type === p.tag;
      if(has){ s.later++; p.got = true; } }); }); };
  for(var t = 0; t < ${+(A.ticks || 400000)}; t++){ stepTick(); if(matchNum !== M0) break; if(tick % 16 === 0) later(); }
  Object.keys(S).forEach(function(k){ delete S[k].pend; });
  return JSON.stringify({match: M0, ticks: tick, sites: S});
})()`));
if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
console.log('матч ' + res.match + ', тиков ' + res.ticks + ', мест-вызывающих ' + Object.keys(res.sites).length);
