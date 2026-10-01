// «Отпечаток» матча: проверка, что правка не изменила поведение.
// Каждый тик складывает в хэш точные координаты, взгляд, HP, оружие всех ботов;
// по раундам — итог, фраги, броски гранат. Два прогона совпадают один в один,
// только если боты сделали ровно то же самое.
// Запуск: node src/q.js sim.html "$(sed s/__M__/3/ tools/measure/fingerprint.js)"
freshMatch(__M__);
var M0 = matchNum, FP = {match:M0, rounds:[], kills:[], nades:[]}, h = 2166136261 >>> 0;
var F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
function mix(v){ F64[0] = +v || 0; h = Math.imul(h ^ U32[0], 16777619) >>> 0; h = Math.imul(h ^ U32[1], 16777619) >>> 0; }
function mixS(s){ s = String(s == null ? "" : s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }
var ofk = feedKill; feedKill = function(att, vic, weap, hs){ FP.kills.push([tick, att ? att.id : null, vic.id, String(weap), hs ? 1 : 0]); return ofk.apply(this, arguments); };
var otn = throwNade; throwNade = function(b, type){ FP.nades.push([tick, b.id, type]); return otn.apply(this, arguments); };
var oer = endRound; endRound = function(w, reason){ FP.rounds.push([roundNum, tick, w, reason, bomb && bomb.state, h]); return oer.apply(this, arguments); };
for(var t = 0; t < 400000; t++){
  stepTick();
  if(matchNum !== M0) break;
  mix(tick); mixS(roundState);
  bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); mixS(b.weapon && b.weapon.key); mix(b.money); });
}
FP.ticks = tick; FP.hash = h;
JSON.stringify(FP)
