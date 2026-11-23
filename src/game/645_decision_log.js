// ---- (v384) журнал решений бота для отметок владельца: последние DLOG_SEC с — смена задачи места (и отказ), заказ / бросок гранаты (и
// почему нет), смена причины взгляда. Только запись — игру не меняет. Кладётся в снимок (b._dlog) и в сводку отметки (mkState → log).
// Запись: место (setPost / clearPost — 110), гранаты (assignNade / throwNade — 380), бой (fightState — 500) — у хозяев (17.11, модули: без
// подмены функций); взгляд и ход — обёртка над teamBrains (350, не канал). Числа — проектные
var DLOG_SEC = 15, DLOG_MAX = 60;
function dlog(b, kind, text, key){
  if(!b) return;
  var L = b[key || "_dlog"] || (b[key || "_dlog"] = []);
  // (v586, отметка владельца 24.11 м1 р2 т8119, CT3 «смотрит в стену»: журнал забит отказами «anchor»/«lineup» — 60 записей за 0,4 с
  // вместо 15 с истории) «то же — не чаще раза в секунду» проверялось только по последней записи, а отказы чередуются (anchor →
  // lineup → anchor), поэтому проходили оба и вытесняли всю историю. Теперь ищем тот же текст среди записей последней секунды
  for(var i = L.length - 1; i >= 0 && tick - L[i][0] < TICK_HZ; i--) if(L[i][1] === kind && L[i][2] === text) return;
  L.push([tick, kind, text]);
  while(L.length && (L.length > DLOG_MAX || tick - L[0][0] > DLOG_SEC*TICK_HZ)) L.shift();
}
(function(){
  var tb = teamBrains;
  teamBrains = function(){
    var r = tb.apply(this, arguments);
    for(var i = 0; i < bots.length; i++){ var b = bots[i]; if(!b.alive) continue;
      var lr = b.lookReason || "";
      if(lr !== b._dlLook){ b._dlLook = lr; if(lr) dlog(b, "взгляд", lr); }
      // (15.11, перестройка, фаза 2: разбор решения по каждому каналу) ход — почему шагом / бегом / стоит (535); отдельный журнал
      // _dlog2: _dlog читает счёт ошибок движения (545, «залип»), новые записи сдвинули бы его счёт
      var mv = (b.walking ? "шагом: " + (b._walkWhy || "?") : b._runWhy ? "бегом: " + b._runWhy : "бегом") + (b._stopWhy ? " · стоп: " + b._stopWhy : "");
      if(mv !== b._dlMove){ b._dlMove = mv; dlog(b, "ход", mv, "_dlog2"); } }
    return r; };
})();
