// Смены поста (tag → место) у бота ID за N тиков после снимка. node tools/mark_open.js sim.html снимок.json "var ID='CT1', N=900; $(cat tools/tests/post_timeline_mark.js)"
(function(){
  var b = teamBot(ID), last = null, o = [];
  for(var t = 0; t <= N && b.alive; t++){ if(t) stepTick();
    var k = b.post ? b.post.tag + "→" + calloutName(b.post.x, b.post.y).replace(/на «|»/g, "") : "-";
    if(k !== last){ o.push(tick + " @" + calloutName(b.x, b.y).replace(/на «|»/g, "") + " " + k + (b.primary ? " [" + b.primary + "]" : "")); last = k; } }
  return o.join("\n");
})()
