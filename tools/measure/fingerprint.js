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
// (Р0.4, 24.11) подписка на события симуляции (435 simEvOn) вместо подмены функций; старые сборки без simEvOn — та же подписка через обёртку
function evOn(name, fn){ if(typeof simEvOn === 'function') return simEvOn(name, fn); var o = eval(name); eval(name + ' = function(){ var s = fn("in", arguments), r = o.apply(this, arguments); fn("out", arguments, r, s); return r; }'); }
evOn('feedKill', function(ph, A){ if(ph === 'in') FP.kills.push([tick, A[0] ? A[0].id : null, A[1].id, String(A[2]), A[3] ? 1 : 0]); });
evOn('throwNade', function(ph, A){ if(ph === 'in') FP.nades.push([tick, A[0].id, A[1]]); });
evOn('endRound', function(ph, A){ if(ph === 'in') FP.rounds.push([roundNum, tick, A[0], A[1], bomb && bomb.state, h]); });
var T1 = tick;   // (Т-2, 25.11) последний тик матча: штатный переход к следующему матчу теперь обнуляет часы — длина матча = T1 + 1
for(var t = 0; t < 400000; t++){
  stepTick();
  if(matchNum !== M0) break;
  T1 = tick; mix(tick); mixS(roundState);
  bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); mixS(b.weapon && b.weapon.key); mix(b.money); });
}
FP.ticks = matchNum !== M0 ? T1 + 1 : tick; FP.hash = h;   // старые сборки (без обнуления) — то же число
if(typeof FW_OUT === "function") FP.fields = FW_OUT();   // (15.11) ловец писателей полей (engine/field_watch.js), если подключён — remote_run вынесет в fw_<m>.json
JSON.stringify(FP)
