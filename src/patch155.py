# v153 шаг 2: плавный взгляд и никаких "ёрзаний" без причины.
rep("var BAL = {", """var BAL = {
  smoothLook: true,   // v153: взгляд держит направление 0,5–0,8с, не мечется туда-обратно; вне боя поворот плавный и медленнее, стоя — без дрожи
  runGlance: true,    // v153: на бегу иногда коротко смотрит на опасный угол сбоку (у про ~половина времени бега — не по ходу)
  roamSmooth: true,   // v153: роумер на чеке не дёргается ±14px 3 раза в секунду, а плавно выглядывает раз в ~2с""")

# --- фильтр взгляда + плавный поворот ---
rep("""    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    if(look){
      var want = Math.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
    }""","""    var slUrg = BAL.smoothLook ? lookUrgent(b) : true;
    if(BAL.smoothLook){ look = smoothLookFilter(b, look, slUrg); }
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    // (v153) бросает гранату — смотрит туда, куда кинул, пока бросок не закончен
    // (раньше за 0,2с после броска взгляд щёлкал обратно — самый частый "рывок")
    if(look && BAL.smoothLook && b.throwUntil && tick < b.throwUntil && !b._sawEnemy) look = null;
    if(look){
      var want = Math.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      if(slUrg) b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
      else {
        // (v153) вне боя: плавно, с торможением к цели, не быстрее ~260°/с;
        // стоя мелкие поправки (<3°) не делаем — прицел стоит, а не дрожит
        var standing = !(b.curSpeed > 15*SPD_K);
        if(!(standing && Math.abs(dd) < 0.05)){
          var cap = SL.calmRate / TICK_HZ, stp = Math.min(cap, Math.max(SL.minStep, Math.abs(dd)*SL.ease));
          b.facing += Math.max(-stp, Math.min(stp, dd));
        }
      }
    }""")

# --- функции ---
rep("""function newLookFor(b){""","""// ---------- (v153) плавный взгляд ----------
// У про взгляд "туда-обратно" больше 45° за полсекунды — 0,8 раза в минуту,
// у ботов было 4,6: каждые 8 тиков делёж углов в команде мог перекинуть
// бота на другой вход и тут же вернуть. Теперь: без срочной причины новое
// направление принимается, только если старое продержалось ≥0,8с (стоя) /
// 0,5с (на ходу), и не возвращаемся к только что брошенному направлению 1,5с.
var SL = {holdStand: 51, holdMove: 32, backBlock: 96, holdAlert: 16, backAlert: 40, same: 0.35, calmRate: 4.5, ease: 0.2, minStep: 0.012,
          glEvery: [70, 120], glDur: 44, glMin: 0.55, glMax: 2.2, glSc: 0.05};
// 2 — бой (враг виден, прикрытие ослеплённого, спам, бросок): без фильтра;
// 1 — тревога (свежий звук/контакт рядом): поворот быстрый, но тоже без
//     метаний — держит новое направление хотя бы 0,25с; 0 — спокойно
function lookUrgent(b){
  if(b._sawEnemy || b.lookReason === "enemy" || b.lookReason === "cover" || b.lookReason === "spam") return 2;
  if(b.planting || b.defusing) return 2;
  if(tick < (b.blindUntil||0) + 32) return 2;
  if(b.lastIntel && tick - b.lastIntel.tick < 48) return 1;
  var hs = b.heardSound;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick < 24 && Math.hypot(hs.x-b.x, hs.y-b.y) < 700) return 1;
  return 0;
}
function smoothLookFilter(b, look, urgent){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  // на бегу без цели — изредка короткий взгляд на опасный угол сбоку
  if(!look && !urgent && BAL.runGlance && moving){
    if(b._gl && tick < b._gl.until) look = b._gl.pt;
    else if(tick >= (b._glNext||0)){
      b._glNext = tick + SL.glEvery[0] + Math.floor(hashRand(tick*13 + b.id.charCodeAt(b.id.length-1)*7)*(SL.glEvery[1]-SL.glEvery[0]));
      var best = null, bs = SL.glSc;
      (typeof lookCands === "function" ? lookCands(b) : []).forEach(function(c){
        if(!c || !c.pt) return;
        var a = Math.atan2(c.pt.y-b.y, c.pt.x-b.x), d = Math.abs(((a-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(d < SL.glMin || d > SL.glMax) return;
        if(c.sc > bs){ bs = c.sc; best = c.pt; } });
      if(best){ b._gl = {pt:{x:best.x, y:best.y}, until: tick + SL.glDur}; look = b._gl.pt; b.lookReason = "glance"; }
    }
  } else if(!moving) b._gl = null;
  if(!look){ if(moving) b._sl = null; return look; }
  var S = b._sl, aN = Math.atan2(look.y-b.y, look.x-b.x);
  if(urgent === 2 || !S){ b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev: S ? S.pt : null, left: tick}; return look; }
  var aS = Math.atan2(S.pt.y-b.y, S.pt.x-b.x);
  var dA = Math.abs(((aN-aS+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
  if(dA < SL.same){ S.pt = {x:look.x, y:look.y}; return look; }            // то же направление — просто уточняем точку
  var hold = urgent ? SL.holdAlert : (moving ? SL.holdMove : SL.holdStand);
  if(tick - S.since < hold) return S.pt;                                    // старое ещё не "досмотрели"
  if(S.prev && tick - S.left < (urgent ? SL.backAlert : SL.backBlock)){                                // не возвращаться сразу к брошенному
    var aP = Math.atan2(S.prev.y-b.y, S.prev.x-b.x);
    var dP = Math.abs(((aN-aP+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    if(dP < SL.same && tick - S.since < (urgent ? SL.backAlert : SL.backBlock)) return S.pt;
  }
  b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev:S.pt, left:tick};
  return look;
}
function newLookFor(b){""")

# --- роумер на чеке: плавное выглядывание вместо тряски ---
rep("""      var ramp = 14*Math.sin((tick - bot.roamCheckStart)*0.3);""","""      var ramp;
      if(BAL.roamSmooth){
        // цикл ~2,1с: выглянуть 0,35с → постоять 0,5с → назад 0,35с → пауза
        var cyc = (tick - bot.roamCheckStart) % 136, e3 = function(u){ u = Math.max(0, Math.min(1, u)); return u*u*(3-2*u); };
        var sgn = (Math.floor((tick - bot.roamCheckStart)/136) % 2) ? -1 : 1;
        ramp = sgn*12*(cyc < 22 ? e3(cyc/22) : cyc < 54 ? 1 : cyc < 76 ? 1-e3((cyc-54)/22) : 0);
      } else ramp = 14*Math.sin((tick - bot.roamCheckStart)*0.3);""")
rep("версия 152 · 30.09","версия 153 · 30.09")
