# v158 шаг 8: ретейк всей группой по одному сигналу, заход одновременно,
# сейв при меньшинстве на 2.
rep("var BAL = {", """var BAL = {
  groupRetake: true,  // v158: ретейк ждёт всех, кто успевает дойти; заход синхронный (ближние ждут дальних, ≤2,5с); сейв при меньшинстве на 2""")

# 1) сколько ждать на точках сбора: всех, кто успевает
rep("""    var need = Math.min(alive.length, alive.length >= 3 ? 3 : alive.length);""","""    var need = Math.min(alive.length, alive.length >= 3 ? 3 : alive.length);
    if(BAL.groupRetake){
      // у про второй заходит через ~3с после первого, у ботов было 5с: ждём
      // каждого, кто успевает дойти до своей точки сбора и ещё зайти на дефуз
      var sL = bombTimeLeftTicks()/TICK_HZ, aD = R.approaches[R.assign[def.id]] || R.approaches[0];
      var gN = Math.hypot(aD.x-bomb.x, aD.y-bomb.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
      need = alive.filter(function(b){ var ap = R.approaches[R.assign[b.id]] || aD; return pathLenTo(b, ap.x, ap.y)/SPEED <= sL - gN - 2; }).length;
      need = Math.max(1, need);
      if(!R.gStart) R.gStart = tick;
    }""")
# 2) синхронный заход: ближние к бомбе точки стартуют позже
rep("""  if(BAL.retakeRoles && R.entryId && R.entryId !== "-" && b.id !== R.entryId && tick - R.goTick < 0.5*TICK_HZ){""","""  if(BAL.groupRetake && R.goTick >= 0){
    if(!R.delay){
      R.delay = {}; var dm = 0;
      R.approaches.forEach(function(ap){ dm = Math.max(dm, Math.hypot(ap.x-bomb.x, ap.y-bomb.y)); });
      R.approaches.forEach(function(ap, i){ R.delay[i] = Math.min(2.5*TICK_HZ, Math.max(0, (dm - Math.hypot(ap.x-bomb.x, ap.y-bomb.y))/SPEED*TICK_HZ)); });
    }
    var dl = R.delay[R.assign[b.id]||0] || 0;
    if(tick - R.goTick < dl){ setPost(b, a, bp, true, "gather"+(R.assign[b.id]||0), 0); return; }
  }
  if(BAL.retakeRoles && R.entryId && R.entryId !== "-" && b.id !== R.entryId && tick - R.goTick < 0.5*TICK_HZ){""")
# 3) сейв: меньшинство на 2 (1v3, 2v4, 3v5) — сейв; 1v2 — только если без кита или впритык
rep("""    var hopeless = (cts.length === 1 && tsAlive >= BAL.saveGap) || (cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;""","""    var hopeless = (cts.length === 1 && tsAlive >= BAL.saveGap) || (cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;
    // (v158) у про после взрыва живы 2,1 CT, у ботов было 1,2: сейвят раньше
    if(BAL.groupRetake) hopeless = hopeless || (cts.length >= 2 && cts.length <= tsAlive - 2) || (cts.length === 1 && tsAlive >= 3) ||
      (cts.length === 1 && tsAlive === 2 && !(cts[0].kit && needSecs + 8 < secs));""")
rep("версия 157 · 01.10","версия 158 · 01.10")
