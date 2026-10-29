// Посты и гранатная задача бота ID за N тиков после снимка: смены поста и задачи (why → точка броска).
// node tools/mark_open.js sim.html снимок.json "var ID='T0', N=900; $(cat tools/tests/nade_task_mark.js)"
(function(){
  var b = teamBot(ID), last = null, o = [];
  var ol = logEvent; logEvent = function(s){ if(String(s).indexOf(ID + ":") === 0 && /гранат/.test(s)) o.push(tick + " LOG " + s); return ol.apply(this, arguments); };
  for(var t = 0; t <= N && b.alive; t++){ if(t) stepTick();
    var k = (b.post ? b.post.tag + "→" + calloutName(b.post.x, b.post.y).replace(/на «|»/g, "") : "-") + " | " +
      (b.nadeTask ? b.nadeTask.type + " " + b.nadeTask.why + (b.nadeTask.from ? " из " + calloutName(b.nadeTask.from.x, b.nadeTask.from.y).replace(/на «|»/g, "") : "") : "нет задачи");
    if(k !== last){ o.push(tick + " @" + calloutName(b.x, b.y).replace(/на «|»/g, "") + " " + k); last = k; } }
  return o.join("\n");
})()
