# v157 шаг 5: игра группой — размены, добивание вдвоём, последний сейвит.
rep("var BAL = {", """var BAL = {
  loneSave: false,   // v157 (выключено: по замеру хуже — последний живёт дольше, у про он гибнет за ~10с)
  egPair: false,     // v157 (выключено: охота парой замедлила добивание, клатчи не снизились)
  groupPlay: true,    // v157: дабл-пик с ~300px, второй разменщик до 450px, охота на последнего парой (ведущий ждёт напарника), одиночка T сейвит раньше""")

# 1) дабл-пик: помочь тиммейту в перестрелке не только вплотную
rep("""    if(Math.hypot(m.x-b.x, m.y-b.y) > 160) return;""","""    if(Math.hypot(m.x-b.x, m.y-b.y) > (BAL.groupPlay ? 300 : 160)) return;""")
rep("""  var sp = pickSpots("assist"+tick+b.id, {x:(b.x+mate.x)/2, y:(b.y+mate.y)/2}, 3, {rMax:110, minGap:24, must:[ep]})""","""  var sp = pickSpots("assist"+tick+b.id, BAL.groupPlay ? {x:mate.x, y:mate.y} : {x:(b.x+mate.x)/2, y:(b.y+mate.y)/2}, 3, {rMax: BAL.groupPlay ? 140 : 110, minGap:24, must:[ep]})""")
# 2) второй разменщик
rep("""    if(cands[1] && cands[1].L <= 350 && aliveCount(victim.team) >= 3) traders.push(cands[1]);""","""    if(cands[1] && cands[1].L <= (BAL.groupPlay ? 450 : 350) && aliveCount(victim.team) >= 3) traders.push(cands[1]);""")
# 3) одиночка T до планта: у про 0 побед из 94 таких раундов — прячется и бережёт оружие
rep("""    var hopeless = (aT === 1 && aC >= 3 && secLeft < 30) || (aT === 1 && aC >= 4 && secLeft < 55) || (aT === 2 && aC >= 4 && secLeft < 30);""","""    var hopeless = (aT === 1 && aC >= 3 && secLeft < 30) || (aT === 1 && aC >= 4 && secLeft < 55) || (aT === 2 && aC >= 4 && secLeft < 30);
    if(BAL.groupPlay && BAL.loneSave) hopeless = hopeless || (aT === 1 && aC >= 3) || (aT === 1 && aC === 2 && secLeft < 40) || (aT === 2 && aC >= 4 && secLeft < 50);""")
# 4) охота парой: ведущий не выходит на линию, пока напарник далеко
rep("""      b._egLock = 0; setPost(b, b._egC.spot, b._egC.look, true, "endhunt"); b._egLock = tick;""","""      if(BAL.groupPlay && BAL.egPair && egWaitPartner(b, mine, kp)) return;
      b._egLock = 0; setPost(b, b._egC.spot, b._egC.look, true, "endhunt"); b._egLock = tick;""")
rep("""function endgameBrain(){""","""// (v157) у про последнего добивают вдвоём: ведущий ждёт за углом, пока
// напарник подойдёт, и выходят вместе (у ботов шли по одному — последний
// забирал их по очереди: клатч 9% против 2% у про)
function egWaitPartner(b, mine, kp){
  var dMe = Math.hypot(kp.x-b.x, kp.y-b.y);
  var part = mine.filter(function(o){ return o !== b && o.alive && !o.planting && !o.defusing && Math.hypot(o.x-b.x, o.y-b.y) < 700; })
    .sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
  if(!part) return false;
  var dP = Math.hypot(kp.x-part.x, kp.y-part.y);
  if(dP - dMe < 180 || Math.hypot(part.x-b.x, part.y-b.y) < 160) { b._egWait = null; return false; } // напарник рядом или впереди — идём
  if(b._egWait && tick - b._egWait.t > 6*TICK_HZ) return false;            // ждём не дольше 6с
  if(!b._egWait || b._egWait.round !== roundNum){
    var wp = pickSpots("egw"+tick+b.id, {x:b.x, y:b.y}, 3, {rMax:140, minGap:30, hideFrom:[kp]})
      .filter(function(q){ return !hasLOS(q.x, q.y, kp.x, kp.y); })[0];
    if(!wp) return false;
    b._egWait = {round:roundNum, t:tick, pt:wp};
    voiceLog(b.team, "egw"+b.id+roundNum, b.id, "жду "+part.id+", заходим вдвоём");
  }
  b._probeLock = 0; b._reposUntil = 0; b._egLock = 0;
  setPost(b, b._egWait.pt, {x:kp.x, y:kp.y}, true, "endhunt"); b._egLock = tick;
  return true;
}
function endgameBrain(){""")
rep("версия 156 · 01.10","версия 157 · 01.10")
