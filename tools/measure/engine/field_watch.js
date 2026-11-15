// (15.11, перестройка, фаза 2) ловец писателей полей бота — только наблюдает, игру не меняет. Развитие walk_watch.js (там — только path).
// Поля: facing, walking, curSpeed, post, state, nadeTask, holding, crouching, path. Каждый тик у каждого бота уже существующее
// поле-значение превращается в поле с записью через сторожа (значение — в замыкании, не на боте: freshMatch удаляет у бота «лишние»
// ключи); порядок ключей бота не меняется (переопределение на месте), новые поля не создаются. Запись: каждая 16-я по полю —
// стек (две верхние функции игры) → FW.w[поле]["кто<-откуда"] += 16 (оценка), смены значения — FW.c[поле] (все записи, без стека).
// Подключение: этот файл перед кодом замера (remote_run.py "fp" с "fields": true); итог — FW_OUT() → {w, c, n}.
(function(){
  var g = (typeof window !== "undefined" ? window : globalThis);
  var F = ["facing", "walking", "curSpeed", "post", "state", "nadeTask", "holding", "crouching", "path"];
  var FW = {w: {}, c: {}, n: {}}; F.forEach(function(f){ FW.w[f] = {}; FW.c[f] = 0; FW.n[f] = 0; });
  function who(){
    var L = Error.stackTraceLimit; Error.stackTraceLimit = 8; var s = (new Error()).stack || ""; Error.stackTraceLimit = L;
    // кадр: «at имя (адрес:строка:столбец)» или безымянный «at адрес:строка:столбец» → «@строка» (функцию по строке сборки найдёт разбор)
    var out = [], L2 = s.split("\n").slice(1);
    for(var i = 0; i < L2.length && out.length < 2; i++){ var ln = L2[i];
      if(/\[as \w+\]|\bwho\b|fwSet|stepTick__fw|eval at|<anonymous>/.test(ln)) continue;   // сам сторож и код замера
      var m = /at (?:new )?([\w$.]+) \(/.exec(ln), p = /:(\d+):\d+\)?\s*$/.exec(ln), n = m ? m[1].replace(/^(Object|Array)\./, "") : "";
      if(/^(forEach|map|filter|some|every|reduce|sort|find|call|apply)$/.test(n)) continue;
      out.push(n || ("@" + (p ? p[1] : "?"))); }
    return out.join("<-") || "?";
  }
  function wrap(b, f){
    var d = Object.getOwnPropertyDescriptor(b, f); if(!d || !("value" in d)) return;   // нет поля или уже обёрнуто
    var v = d.value;
    Object.defineProperty(b, f, {configurable: true, enumerable: d.enumerable,
      get: function(){ return v; },
      set: function fwSet(x){ if(x !== v) FW.c[f]++; v = x; if((++FW.n[f] & 15) === 0){ var k = who(); FW.w[f][k] = (FW.w[f][k] || 0) + 16; } }});
  }
  var ST = g.stepTick || stepTick;
  stepTick = function stepTick__fw(){ for(var i = 0; i < bots.length; i++) for(var j = 0; j < F.length; j++) wrap(bots[i], F[j]); return ST.apply(this, arguments); };
  g.FW_OUT = function(){ return FW; };
})();
