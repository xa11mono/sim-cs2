// ======================= (v447, владелец 28.10) ХАЙЛАЙТЫ — «игрок в ударе» — одно место =======================
// Владелец: «шанс, что игрок сделает что-то нереальное: энтри первого в голову, второго одной пулей, флик с AWP». Не подстроенная
// ситуация: в начале дуэли (первый тик, когда видит цель) жребий с шансом HL.p — выпало, игрок на HL.sec с «в ударе»: реакция ×HL.react,
// ошибка прицела ×HL.aim, AWP доводит прицел (scope) ×HL.scope — флик. Убил в ударе — окно продлевается; пока в ударе, после фрага не
// уходит в укрытие и выходит на контакт, даже если врагов больше (идёт на следующего). Мораль — не здесь (М171, на потом).
// Калибровка (демки Ancient, 92 демки): раундов с 3 убийствами одного за ≤ 4 с — 7,2 % у про, у ботов v446 — 3,2–4,1 %; всего раундов
// с 3+ убийствами одного у ботов уже как у про (35 / 32 %) — хайлайт делает серии быстрее, а не больше. Числа силы — проектные.
// Шанс — ползунок «Хайлайты» в меню «Инструменты» (хранится в браузере); 0 — игра как без хайлайтов (бит в бит).
var HL = {p: 0.12, sec: 4, react: 0.5, aim: 0.6, scope: 0.4};   // проектные числа; p подобрать по сериям про (см. выше)
var HL_KEY = "sim-hl-v1";
try{ var _hl = JSON.parse(localStorage.getItem(HL_KEY) || "null"); if(_hl && isFinite(_hl.p)) HL.p = Math.max(0, Math.min(1, +_hl.p)); }catch(e){}
function hlHot(b){ return !!(b && b._hot && b._hot.round === roundNum && tick < b._hot.until); }
// первый тик контакта с целью (tryShoot, cs ≤ 1)
function hlContact(b, target){
  if(!(HL.p > 0) || hlHot(b)) return;
  var u = hashRand(tick*977 + b.id.charCodeAt(b.id.length-1)*131 + target.id.charCodeAt(target.id.length-1)*17 + matchNum*7 + roundNum*389);
  if(u < HL.p) b._hot = {round: roundNum, until: tick + HL.sec*TICK_HZ, kills: 0};
}
// убил (applyDamage): в ударе — окно продлевается; со второго подряд — в войсе
function hlKill(killer){
  if(!hlHot(killer)) return;
  var H = killer._hot; H.kills++; H.until = tick + HL.sec*TICK_HZ;
  if(H.kills >= 2) voiceLog(killer.team, "hl"+killer.id+roundNum+"_"+H.kills, killer.id, "в ударе — минус "+H.kills+" подряд!");
}
// множители для tryShoot
function hlReact(b){ return hlHot(b) ? HL.react : 1; }
function hlAim(b){ return hlHot(b) ? HL.aim : 1; }
function hlScope(b){ return hlHot(b) ? HL.scope : 1; }
// ползунок «хайлайты» (меню «Инструменты»): шанс в процентах на дуэль; сразу в игре, хранится в браузере
(function(){ if(typeof document === "undefined") return; var r = document.getElementById("hlP"), v = document.getElementById("hlPv"); if(!r) return;
  var show = function(){ v.textContent = Math.round(HL.p*100) + "%"; };
  r.value = Math.round(HL.p*100); show();
  r.addEventListener("input", function(){ HL.p = (+r.value || 0)/100; show(); try{ localStorage.setItem(HL_KEY, JSON.stringify({p: HL.p})); }catch(e){} });
})();
