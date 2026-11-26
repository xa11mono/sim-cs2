// [хозяева: dlog, dlogBot, dlogOf, dlogTeam] ---- (v384) журнал решений бота для отметок владельца: последние DLOG_SEC с — смена задачи места (и отказ), заказ / бросок гранаты (и
// почему нет), смена причины взгляда. Только запись — игру не меняет.
// (Р3.3, 25.11) след решений — вне состояния игры: хранилище DLOG по номеру бота (было b._dlog / b._dlog2 / b._dlLook / b._dlMove — в
// объектах ботов, в снимке). Читать — dlogOf(b[, ключ]). DLOG.on — выключатель (игра от него не зависит: Э1 вкл / выкл). При перемотке
// назад записи «из будущего» отбрасываются (след в снимок не входит).
// Запись: место (setPost / clearPost — 110), гранаты (assignNade / throwNade — 380), бой (fightState — 500) — у хозяев (17.11, модули: без
// подмены функций); взгляд и ход — обёртка над teamBrains (contact, не канал). Числа — проектные
var DLOG_SEC = 15, DLOG_MAX = 60, DLOG = {on: true, by: {}};
function dlogBot(b){ return DLOG.by[b.id] || (DLOG.by[b.id] = {}); }
function dlogOf(b, key){ var B = b && DLOG.by[b.id], L = (B && B[key || "_dlog"]) || [];
  return L.length && L[L.length-1][0] > tick ? L.filter(function(e){ return e[0] <= tick; }) : L; }
// (Р3.2, канал «команда») след решений команды (фаза плана и т. п.) — вне состояния игры, как след бота: dlogTeam("T", вид, текст)
function dlogTeam(side, kind, text){ if(!DLOG.on || !side) return; dlog({id: "team:" + side}, kind, text); }
// data — поля записи для инструментов (сторож PROB читает их, а не текст; Р-9)
function dlog(b, kind, text, key, data){
  if(!b || !DLOG.on) return;
  var B = dlogBot(b), k = key || "_dlog", L = B[k] || (B[k] = []);
  while(L.length && L[L.length-1][0] > tick) L.pop();   // время назад (перемотка, новый матч) — записи «из будущего» не нужны
  var last = L[L.length-1];
  if(last && last[1] === kind && last[2] === text && tick - last[0] < TICK_HZ) return;   // то же — не чаще раза в секунду
  L.push(data ? [tick, kind, text, data] : [tick, kind, text]);
  while(L.length && (L.length > DLOG_MAX || tick - L[0][0] > DLOG_SEC*TICK_HZ)) L.shift();
}
(function(){
  var tb = teamBrains;
  teamBrains = function(){
    var r = tb.apply(this, arguments);
    for(var i = 0; i < bots.length; i++){ var b = bots[i]; if(!b.alive) continue;
      var lr = b.lookReason || "";
      var B = dlogBot(b);
      if(lr !== B.look){ B.look = lr; if(lr) dlog(b, "взгляд", lr); }
      // (15.11, перестройка, фаза 2: разбор решения по каждому каналу) ход — почему шагом / бегом / стоит (move); отдельный журнал
      // _dlog2: _dlog читает счёт ошибок движения (problem-watch, «залип»), новые записи сдвинули бы его счёт
      var mv = (b.walking ? "шагом: " + (b._walkWhy || "?") : b._runWhy ? "бегом: " + b._runWhy : "бегом") + (b._stopWhy ? " · стоп: " + b._stopWhy : "");
      if(mv !== B.move){ B.move = mv; dlog(b, "ход", mv, "_dlog2"); } }
    return r; };
})();
