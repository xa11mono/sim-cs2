// ---- (v384) журнал решений бота для отметок владельца: последние DLOG_SEC с — смена задачи места (и отказ), заказ / бросок гранаты (и
// почему нет), смена причины взгляда. Только запись — игру не меняет. Кладётся в снимок (b._dlog) и в сводку отметки (mkState → log).
// Обёртка над setPost / clearPost / assignNade / throwNade / teamBrains — место записи одно, механики не трогаются. Числа — проектные
var DLOG_SEC = 15, DLOG_MAX = 60;
function dlog(b, kind, text){
  if(!b) return;
  var L = b._dlog || (b._dlog = []), last = L[L.length-1];
  if(last && last[1] === kind && last[2] === text && tick - last[0] < TICK_HZ) return;   // то же — не чаще раза в секунду
  L.push([tick, kind, text]);
  while(L.length && (L.length > DLOG_MAX || tick - L[0][0] > DLOG_SEC*TICK_HZ)) L.shift();
}
(function(){
  var sp = setPost, cp = clearPost, an = assignNade, tn = throwNade, tb = teamBrains;
  setPost = function(b, pt, look, hold, tag){
    var was = b && b.post ? b.post.tag : null, r = sp.apply(this, arguments);
    if(!b) return r;
    var cur = b._task ? " (уровень " + b._task.lv + ")" : "";
    if(r && tag !== was) dlog(b, "место", "задача «" + tag + "»" + cur + (was ? " вместо «" + was + "»" : "") + " — " + calloutName(pt.x, pt.y));
    else if(!r) dlog(b, "место", "отказ «" + tag + "»: занят «" + (b._task ? b._task.tag : (b.post && b.post.tag)) + "»" + cur);
    return r; };
  clearPost = function(b){ if(b && b.post) dlog(b, "место", "снята задача «" + b.post.tag + "»"); return cp.apply(this, arguments); };
  assignNade = function(b, type, target, why){
    var r = an.apply(this, arguments);
    if(b) dlog(b, "граната", (r ? "заказ " : "отказ в заказе ") + type + " — " + (why || "") + (r ? "" : (b.nadeTask ? " (занят: " + b.nadeTask.type + " — " + b.nadeTask.why + ")" : "")));
    return r; };
  throwNade = function(b, type, tx, ty, lob, why){
    var r = tn.apply(this, arguments);
    if(b) dlog(b, "граната", (r ? "кинул " : "не кинул ") + type + " — " + (why || "") + (r ? "" : ": " + (NADE_FAIL || "?")));
    return r; };
  teamBrains = function(){
    var r = tb.apply(this, arguments);
    for(var i = 0; i < bots.length; i++){ var b = bots[i]; if(!b.alive) continue;
      var lr = b.lookReason || "";
      if(lr !== b._dlLook){ b._dlLook = lr; if(lr) dlog(b, "взгляд", lr); } }
    return r; };
})();
