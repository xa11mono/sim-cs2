// Этап 3, «баланс belief»: какие решения T читают карту команды (belief / LKP) и что из этого выходит.
// Контекст — функция мозга T, внутри которой идёт чтение (tIglReplan / tBrain / lurkerBrain); чтения CT — отдельно.
// Плюс смены сайта T (tSetSite) и первая смерть раунда. Только запись: игру не меняет.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var R = {match: M0, reads: {}, sw: [], rounds: []}, ctx = [], rs = null, cur = null;
// функции игры живут в замыкании (__ev): переназначаются по имени, как tryShoot в hit_rec.js
function mkCtx(name, f){ return function(){ ctx.push(name); try { return f.apply(this, arguments); } finally { ctx.pop(); } }; }
function mkRead(name, f){ return function(team){ var r = f.apply(this, arguments);
  if(roundState === "live"){ var k = team + "|" + (ctx.length ? ctx[ctx.length-1] : "другое") + "|" + name, o = R.reads[k] || (R.reads[k] = [0, 0]);
    o[0]++; o[1] += (typeof r === "number" ? r : r ? 1 : 0); }
  return r; }; }
tIglReplan = mkCtx("tIglReplan", tIglReplan);
tBrain = mkCtx("tBrain", tBrain);
lurkerBrain = mkCtx("lurkerBrain", lurkerBrain);
ctBrain = mkCtx("ctBrain", ctBrain);
lkpNear = mkRead("lkpNear", lkpNear);
intelEstimate = mkRead("intelEstimate", intelEstimate);
beliefMassNear = mkRead("beliefMassNear", beliefMassNear);
beliefMass = mkRead("beliefMass", beliefMass);
beliefZoneKnown = mkRead("beliefZoneKnown", beliefZoneKnown);
var oss = tSetSite;
tSetSite = function(tt, site){ var old = tt.site; var r = oss.apply(this, arguments);
  if(old !== site && roundState === "live") R.sw.push([tick, tick - roundStartTick, old, site, ctx.length ? ctx[ctx.length-1] : "другое"]); return r; };
var oer = endRound; endRound = function(w, why){ if(cur && cur.win == null){ cur.win = w; cur.why = why; } return oer.apply(this, arguments); };
var ofk = feedKill; feedKill = function(att, vic){ if(roundState === "live" && cur && !cur.fd) cur.fd = [tick - cur.t0, vic.team]; return ofk.apply(this, arguments); };
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ cur = {t0: tick}; R.rounds.push(cur); } else if(cur && cur.t1 == null){ cur.t1 = tick; } rs = roundState; }
}
JSON.stringify(R);
