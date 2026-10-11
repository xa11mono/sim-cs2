// Этап 2, P2-1: откуда повороты ≥ 20° у стоящего бота (без врага в поле зрения). Только запись.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
function ang(a){ return Math.abs(((a + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI); }
var A = {match: M0, samples: 0, turns: {}}, P = {}, rs = null;
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ rs = roundState; P = {}; }
  if(roundState !== "live" || tick % 16) continue;
  bots.forEach(function(b){
    if(!b.alive) return;
    var s = {f: b.facing || 0, x: b.x, y: b.y, lr: b.lookReason || "-", lkZ: b._lkZ, chk: !!(b._chk && tick < b._chk.until), pm: b._proM ? b._proM.i : null,
             fresh: !!(b._lkPick && b._lkPick.fresh), saw: !!b._sawEnemy, urg: typeof lookUrgent === "function" ? lookUrgent(b) : 0, post: b.post ? b.post.id : null, lk: b._lkPt ? Math.round(b._lkPt.x)+","+Math.round(b._lkPt.y) : null, lt: b.lookTarget ? Math.atan2(b.lookTarget.y-b.y, b.lookTarget.x-b.x) : null};
    var p = P[b.id]; P[b.id] = s;
    if(!p || s.saw || p.saw) return;
    if(Math.hypot(s.x-p.x, s.y-p.y)/0.25 >= 15) return;   // стоит
    A.samples++;
    var d = ang(s.f - p.f) * 57.3; if(d < 20) return;
    var k = p.post !== s.post ? "сменился пост" : s.urg ? "тревога (звук/контакт)" : (p.lr !== s.lr) ? "причина " + p.lr + "→" + s.lr :
            s.chk !== p.chk ? "проверка второго угла (" + (s.chk ? "туда" : "обратно") + ")" : (s.lr === "pro" && p.pm !== s.pm) ? "про: другой из двух углов" :
            (s.lr === "look" && p.lkZ !== s.lkZ) ? "делёж: другой угол (" + (s.fresh ? "свежая инфа" : "без свежей") + ")" : (s.lr === "look" && p.lk !== s.lk) ? "look: точка угла сдвинулась" : (s.lt !== null && p.lt !== null && ang(s.lt - p.lt) < 0.17) ? "та же цель взгляда, доворот (" + s.lr + ")" : "та же причина, цель взгляда сменилась после обработки: " + s.lr;
    A.turns[k] = (A.turns[k] || 0) + 1;
  });
}
JSON.stringify(A);
