// п.4: после перекола у T не остаётся места (takeAssign) старого сайта. Шагаем до тика T_END, печатаем посты T при каждой смене сайта
// и в конце. node tools/mark_open.js sim.html снимок.json "var T_END=…; $(cat tools/tests/recall_posts_mark.js)"
(function(){
  var site = teamTac.T.site, log = [];
  var posts = function(){ return bots.filter(function(b){ return b.team === "T" && b.alive; }).map(function(b){ return b.id + ":" + (b.post ? b.post.tag : "-"); }).join(" "); };
  while(tick < T_END && roundState === "live"){ stepTick();
    if(teamTac.T.site !== site){ site = teamTac.T.site; log.push({t: tick, site: site}); }
    if(log.length && !log[log.length-1].p3 && tick - log[log.length-1].t >= 3*TICK_HZ) log[log.length-1].p3 = posts(); }
  return JSON.stringify({end: tick, site: teamTac.T.site, take: teamTac.T.takeAssign, log: log, posts: posts()});
})()
