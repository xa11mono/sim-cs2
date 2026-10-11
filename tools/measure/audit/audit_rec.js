// Аудит поведения ботов (docs/reports/BOT_BEHAVIOR_AUDIT_REPORT.md): один воспроизводимый матч, только запись.
// Игру не меняет: обёртки зовут исходные функции и ничего не пишут в состояние ботов; генератор игры не трогается.
// Запуск: node src/q.js <сборка_аудита.html> "<этот файл с __M__/__T__>"  (tools/measure/audit/run_audit.py)
freshMatch(__M__);
var M0 = matchNum, TT = __T__, FUT = [], TSEEN = {CT: {}, T: {}}, CHG = {}, POS0 = {};
function ang(a){ return Math.abs(((a + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI); }
function dirTo(b, x, y){ return Math.atan2(y-b.y, x-b.x); }
function live(){ return roundState === "live"; }
function byId(id){ for(var i=0;i<bots.length;i++) if(bots[i].id === id) return bots[i]; return null; }
var A = {match: M0, rounds: 0, botTicks: {stand: 0, move: 0},
  leak: [], hid: {n: 0, hitTrue: 0, hitPast: 0, hitFut: 0, hitLast: 0}, turns: {stand: 0, standNoInfo: 0, move: 0, moveNoInfo: 0, ev: []},
  first: [], posCh: [], posBlock: {}, plan: [], calls: [], nades: [], blinds: [], ff: [], voice: [], stale: {}, exposed: [], stack: 0,
  deaths: [], blockedShots: 0, chatter: {ticks: 0, frozen: 0}};

// ---------- история позиций врагов (для проверки «следит сквозь стены») ----------
var HIST = {};   // id → [[tick,x,y]] раз в 8 тиков, 6 с
function histAt(id, t){ var H = HIST[id]; if(!H) return null; var best = null;
  for(var i=0;i<H.length;i++){ if(Math.abs(H[i][0]-t) <= 4){ best = H[i]; break; } } return best; }

// ---------- события, которые объясняют поворот взгляда ----------
var INFO = {};   // botId → последний тик «новой информации» для бота
function infoMark(b){ INFO[b.id] = tick; }

// ---------- войс: доставленные фразы (teamHeardToIntel зовётся один раз на договорённую фразу) ----------
var VOICED = [];  // [tick, team, zone]
var o_thi = teamHeardToIntel;
teamHeardToIntel = function(team, m){
  if(live()){
    VOICED.push([tick, team, m.zone || null]);
    var row = {t: tick, team: team, kind: m.kind, zone: m.zone ? knowZoneName(m.zone) : null, lat: tick - (m.made||tick), wait: tick - (m.ready||tick), count: m.count||0};
    if(m.ids && m.zone){ var g = knowGraph(), c = g.c[m.zone];
      if(c) row.moved = m.ids.map(function(id){ var e = byId(id); return e && e.alive ? Math.round(Math.hypot(e.x-c.x, e.y-c.y) - g.r[m.zone]) : null; }); }
    A.voice.push(row);
    bots.forEach(function(o){ if(o.alive && o.team === team) infoMark(o); });
  }
  return o_thi.apply(this, arguments);
};
function voicedNear(team, zone, t0, t1){
  if(!zone) return false; var near = teamNear(zone);
  return VOICED.some(function(v){ return v[1] === team && v[0] >= t0 && v[0] <= t1 && v[2] && near.indexOf(v[2]) >= 0; });
}

// ---------- утечка: команда (LKP/beliefLast) узнаёт то, что слышал один бот, без войса ----------
var PENDLEAK = [];
window.__AUD = {
  leak: function(team, eid, hb){
    if(!live()) return;
    var src = hb.src || "?", own = src.indexOf("ear:") === 0 ? src.slice(4) : null;
    var voiced = voicedNear(team, hb.zone, hb.htick - 3*TICK_HZ, tick);
    var row = {t: tick, team: team, enemy: eid, src: own ? "ear" : src, owner: own, zone: knowZoneName(hb.zone), age: tick - hb.htick, voicedBefore: voiced};
    A.leak.push(row);
    if(own && !voiced) PENDLEAK.push({row: row, x: hb.x, y: hb.y, t: tick, team: team, owner: own, used: []});
  },
  call: function(best, isNew){
    if(!live() || !isNew) return;
    var cts = bots.filter(function(o){ return o.alive && o.team === "CT"; });
    A.calls.push({t: tick, site: best.site, ev: +(best.ev||0).toFixed(2), mass: +((best.score||0)-(best.ev||0)).toFixed(2), count: +(best.count||0).toFixed(2),
      seen: best.est ? best.est.seen : null, heard: best.est ? best.est.heard : null, deaths: best.deaths||0, plant: !!best.plant, carrier: !!best.carrier, nades: best.nades||0,
      ctNear: ["A","B"].map(function(k){ return cts.filter(function(o){ return Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 700; }).length; }), cts: cts.length,
      tTrue: ["A","B"].map(function(k){ return bots.filter(function(o){ return o.alive && o.team === "T" && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 900; }).length; })});
  }
};

// ---------- позиция: кто и как меняет пост ----------
var o_sp = setPost;
setPost = function(b, pt, look, hold, tag, spreadIdx){
  var before = b.post ? b.post.id : null, btag = b.post ? b.post.tag : null;
  var r = o_sp.apply(this, arguments);
  if(!live() || !b.alive) return r;
  var after = b.post ? b.post.id : null;
  if(after !== before){
    var caller = "?"; try { var st = (new Error()).stack.split("\n"); for(var i=2;i<st.length;i++){ var mm = st[i].match(/at (?:Object\.)?([A-Za-z0-9_$]+) /); if(mm && mm[1] !== "setPost" && mm[1] !== "groupPost"){ caller = mm[1]; break; } } } catch(e){}
    A.posCh.push([tick, b.id, btag, b.post ? b.post.tag : null, caller, b.post ? Math.round(b.post.x) : null, b.post ? Math.round(b.post.y) : null]);
  } else if(b.post && tag && b.post.tag !== tag && !/^route/.test(b.post.tag||"")){
    var k = (btag||"-").split(/[:|]/)[0] + " ⟂ " + String(tag).split(/[:|]/)[0];
    A.posBlock[k] = (A.posBlock[k]||0) + 1;
  }
  return r;
};

// ---------- гранаты ----------
var SITECH = [];   // [tick, from, to] — смены сайта плана T
var o_tn = throwNade;
throwNade = function(b, type, tx, ty, lob, why){
  var n0 = b.nades ? b.nades[type] : 0, row = null;
  if(live() && b.nades && b.nades[type] > 0){
    var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
    var R = type === "flash" ? 400 : type === "he" ? 300 : type === "molly" ? 200 : 0;
    var nearT = R ? mates.filter(function(o){ return Math.hypot(o.x-tx, o.y-ty) < R; }).length : 0;
    var L = Math.hypot(tx-b.x, ty-b.y), onLine = 0;
    mates.forEach(function(o){ var px = o.x-b.x, py = o.y-b.y, t = (px*(tx-b.x)+py*(ty-b.y))/(L*L||1); if(t > 0.05 && t < 1){ var dx = b.x+(tx-b.x)*t-o.x, dy = b.y+(ty-b.y)*t-o.y; if(Math.hypot(dx,dy) < 40) onLine++; } });
    var task = b.nadeTask, tStart = task ? task.start : null;
    var stale = b.team === "T" && tStart != null && SITECH.some(function(s){ return s[0] > tStart && s[0] <= tick; });
    var Rd = NADE[type] && NADE[type].radius ? NADE[type].radius : 0, nearDmg = (type === "he" || type === "molly") ? mates.filter(function(o){ return Math.hypot(o.x-tx, o.y-ty) < Rd; }).length : 0;
    row = {t: tick, id: b.id, team: b.team, type: type, nearDmg: nearDmg, why: String(why||"").slice(0,40), lob: !!lob, nearT: nearT, onLine: onLine, taskAge: tStart != null ? tick - tStart : null, staleSite: stale,
      post: b.post ? String(b.post.tag).slice(0,24) : null};
  }
  var r = o_tn.apply(this, arguments);
  if(row){ if(b.nades && b.nades[type] < n0) A.nades.push(row); else A.nadeCancel = (A.nadeCancel||0) + 1; }
  return r;
};
var o_det = detonate;
detonate = function(n){
  var pre = {}; bots.forEach(function(o){ pre[o.id] = o.blindUntil || 0; });
  var r = o_det.apply(this, arguments);
  if(live() && n.type === "flash") bots.forEach(function(o){
    if(!o.alive || !n.thrower) return; var add = (o.blindUntil||0) - Math.max(pre[o.id], tick);
    if(add > 0.35*TICK_HZ) A.blinds.push([tick, n.team, o.team === n.team ? (o === n.thrower ? "self" : "mate") : "enemy", +(add/TICK_HZ).toFixed(2), n.thrower.id, String(n.why||"").slice(0,30)]);
  });
  return r;
};
var o_ad = applyDamage;
applyDamage = function(att, b, dmg, src, o){
  var hp0 = b.hp, al = b.alive;
  var r = o_ad.apply(this, arguments);
  if(live() && al){
    if(att && att.team === b.team && att !== b) A.ff.push([tick, att.id, b.id, src, Math.round(hp0 - (b.alive ? b.hp : 0))]);
    if(att && att.team !== b.team && b.alive && src === "bullet") EXPO.push({t: tick, id: b.id, x: b.x, y: b.y, hp: b.hp});
    if(att && att.team !== b.team) infoMark(b);
  }
  return r;
};
var EXPO = [];
var o_bv = bulletVictim;
bulletVictim = function(sh, ex, ey, skip){ var v = o_bv.apply(this, arguments); return v; };

// ---------- выстрел (первый выстрел по цели после появления) ----------
var CONT = {};   // "b>e" → контакт
var o_ts = tryShoot;
tryShoot = function(sh, tg, dist){
  var a0 = sh.ammo, l0 = sh.lastShotTick;
  var r = o_ts.apply(this, arguments);
  if(live() && (sh.ammo < a0 || sh.lastShotTick !== l0)){
    var c = CONT[sh.id + ">" + tg.id];
    if(c && c.shot == null && tick - c.t0 <= 5*TICK_HZ){ c.shot = tick - c.t0; c.offShot = +ang(dirTo(sh, tg.x, tg.y) - sh.facing).toFixed(3);
      c.csShot = sh.contactStreak|0; c.effR = Math.round((sh.reactionTicks||0)*(sh._reactMul||1)); c.pf = (sh.contactStreak|0) < c.effR ? 1 : 0; }
  }
  return r;
};

// ---------- смерти ----------
var VISH = {};   // botId → {enemyId: последний тик, когда видел}
var o_fk = feedKill;
feedKill = function(att, vic){
  if(live() && att && vic && att.team !== vic.team){
    var K = vic.know, B = K && K.enemies[att.id];
    var off = vic.facing === undefined ? null : +ang(dirTo(vic, att.x, att.y) - vic.facing).toFixed(2);
    var seen = VISH[vic.id] && VISH[vic.id][att.id] != null ? tick - VISH[vic.id][att.id] : null;
    // знал ли, что из той зоны может прийти враг: в его знании есть гипотеза ≥0,25 в зоне убийцы или соседней
    var za = knowZoneAt(att.x, att.y), near = teamNear(za), known = 0;
    if(K) for(var id in K.enemies){ var BB = K.enemies[id]; (BB.hyps||[]).forEach(function(h){ var hz = h.type === "held" ? (h.x !== undefined ? knowZoneAt(h.x, h.y) : h.zone) : h.zone; if(hz && near.indexOf(hz) >= 0) known = Math.max(known, h.weight); }); }
    A.deaths.push({t: tick, vic: vic.id, team: vic.team, att: att.id, off: off, seenAgo: seen, knownW: +known.toFixed(2), lookReason: vic.lookReason || null, speed: Math.round(vic.curSpeed||0),
      dist: Math.round(Math.hypot(att.x-vic.x, att.y-vic.y)), plant: bomb && bomb.state === "planted"});
    bots.forEach(function(o){ if(o.alive) infoMark(o); });
  }
  return o_fk.apply(this, arguments);
};

// ---------- план T ----------
var lastSite = null, lastIGL = "", PLW = [];
var o_le = logEvent;
logEvent = function(text){ if(/IGL/.test(String(text))) lastIGL = String(text).slice(0, 120); return o_le.apply(this, arguments); };
function tSnap(b, site, old){
  return {id: b.id, alive: b.alive, tag: b.post ? String(b.post.tag).slice(0,28) : null, route: b._route ? b._route.names.join(">").slice(0,60) : null,
    nade: b.nadeTask ? b.nadeTask.type + ":" + String(b.nadeTask.why||"").slice(0,24) : null,
    nEnd: b.nadeTask ? [Math.round(Math.hypot(b.nadeTask.x-SITES[site].x, b.nadeTask.y-SITES[site].y)), old ? Math.round(Math.hypot(b.nadeTask.x-SITES[old].x, b.nadeTask.y-SITES[old].y)) : null] : null,
    rEnd: b._route ? (function(){ var p = b._route.pts[b._route.pts.length-1]; return [Math.round(Math.hypot(p.x-SITES[site].x, p.y-SITES[site].y)), old ? Math.round(Math.hypot(p.x-SITES[old].x, p.y-SITES[old].y)) : null]; })() : null,
    nStart: b.nadeTask ? b.nadeTask.start : null, lineupLock: !!(b._lineupLock && b._lineupLock >= tick-1),
    dNew: Math.round(Math.hypot(b.x-SITES[site].x, b.y-SITES[site].y)), dOld: old ? Math.round(Math.hypot(b.x-SITES[old].x, b.y-SITES[old].y)) : null, spd: Math.round(b.curSpeed||0)};
}

var rs = null, prevFace = {}, faceH = {}, prevVis = {}, teamVisPrev = {CT: {}, T: {}}, lastPostId = {}, lastHeard = {};
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ A.rounds++; lastSite = teamTac && teamTac.T ? teamTac.T.site : null; HIST = {}; CONT = {}; VISH = {}; TSEEN = {CT: {}, T: {}}; faceH = {}; PLW = []; EXPO = []; PENDLEAK = []; } rs = roundState; }
  if(!live()) continue;
  // --- история позиций и видимость командой
  var teamVis = {CT: {}, T: {}};
  bots.forEach(function(b){ if(!b.alive) return; (b._visible||[]).forEach(function(e){ teamVis[b.team][e.id] = 1; }); });
  ["CT","T"].forEach(function(tm){ for(var id in teamVis[tm]) if(!teamVisPrev[tm][id]) bots.forEach(function(o){ if(o.alive && o.team === tm) infoMark(o); }); });
  teamVisPrev = teamVis;
  if(tick % 8 === 0) bots.forEach(function(e){ if(!e.alive) return; var H = HIST[e.id] || (HIST[e.id] = []); H.push([tick, e.x, e.y]); if(H.length > 60) H.shift(); });
  bots.forEach(function(b){
    if(!b.alive) return;
    var moving = (b.curSpeed||0) > 60*SPD_K; A.botTicks[moving ? "move" : "stand"]++;
    if(b.heardSound && b.heardSound.tick !== lastHeard[b.id] && b.heardSound.team && b.heardSound.team !== b.team){ lastHeard[b.id] = b.heardSound.tick; infoMark(b); }
    var pid = b.post ? b.post.id : null;
    if(pid !== lastPostId[b.id]){ if(CHG[b.id] === tick-1){ A.chatter.ticks++; var mv0 = POS0[b.id]; if(mv0 && Math.hypot(b.x-mv0[0], b.y-mv0[1]) < 0.5) A.chatter.frozen++; } CHG[b.id] = tick; lastPostId[b.id] = pid; infoMark(b); }
    POS0[b.id] = [b.x, b.y];
    if(tick < (b.blindUntil||0)) infoMark(b);
    // --- первое появление врага и контакт
    var vh = VISH[b.id] || (VISH[b.id] = {}), pv = prevVis[b.id] || {}, nv = {};
    (b._visible||[]).forEach(function(e){
      nv[e.id] = 1; var key = b.id + ">" + e.id, gap = vh[e.id] == null ? 1e9 : tick - vh[e.id];
      if(!pv[e.id] && gap > 2*TICK_HZ){
        var K = b.know, BB = K && K.enemies[e.id], hs = b.heardSound;
        var ts0 = TSEEN[b.team][e.id], vo = VOICED.some(function(v){ return v[1] === b.team && tick - v[0] < 5*TICK_HZ && v[2] && teamNear(v[2]).indexOf(knowZoneAt(e.x, e.y)) >= 0; });
        var info = (ts0 != null && tick - ts0 <= 2*TICK_HZ) ? "radar" : (hs && hs.team !== b.team && tick - hs.tick < 3*TICK_HZ && Math.hypot(hs.x-e.x, hs.y-e.y) < 400) ? "sound" : vo ? "voice" : (ts0 != null && tick - ts0 < 10*TICK_HZ) ? "lkp" : "none";
        var c = CONT[key] = {t0: tick, b: b.id, e: e.id, team: b.team, off0: +ang(dirTo(b, e.x, e.y) - (b.facing||0)).toFixed(3), d: Math.round(Math.hypot(e.x-b.x, e.y-b.y)),
          info: info, lr: b.lookReason || null, spd: Math.round(b.curSpeed||0), eSpd: Math.round(e.curSpeed||0), w: b.weapon ? b.weapon.key : "", prep: b._prep ? b._prep.src : null, fov: inFov(b, e.x, e.y) ? 1 : 0, cs: (b.contactStreak|0) - 1, aim: null, shot: null, offShot: null, res: null};
        A.first.push(c);
      }
      vh[e.id] = tick;
      var cc = CONT[key]; if(cc && cc.aim == null && ang(dirTo(b, e.x, e.y) - b.facing) < AIM_FIRE_CONE) cc.aim = tick - cc.t0;
    });
    prevVis[b.id] = nv;
    // --- поворот взгляда без повода (стоит / идёт), не в бою
    var fh = faceH[b.id] || (faceH[b.id] = []); fh.push(b.facing||0); if(fh.length > 17) fh.shift();
    if(fh.length === 17 && !b._sawEnemy && !(b.throwUntil && tick < b.throwUntil + 16) && tick % 4 === 0){
      var dA = ang(fh[16] - fh[0]);
      if(dA > Math.PI/4){
        var noInfo = INFO[b.id] == null || tick - INFO[b.id] > TICK_HZ;
        if(moving){ A.turns.move++; if(noInfo) A.turns.moveNoInfo++; } else { A.turns.stand++; if(noInfo) A.turns.standNoInfo++; }
        if(noInfo && A.turns.ev.length < 300) A.turns.ev.push([tick, b.id, moving ? 1 : 0, Math.round(dA*57.3), b.lookReason || null, b.post ? String(b.post.tag).slice(0,20) : null, (b._lkTop||[]).map(function(c){ return c[0] + ":" + (+c[1]).toFixed(2); }).join(" | ").slice(0,120)]);
        faceH[b.id] = [];
      }
    }
    // --- следит ли сквозь стены за спрятанным врагом (раз в 8 тиков)
    if(tick % 8 === 0 && !b._sawEnemy && tick >= (b.blindUntil||0)){
      bots.forEach(function(e){
        if(!e.alive || e.team === b.team || teamVis[b.team][e.id]) return;
        var d = Math.hypot(e.x-b.x, e.y-b.y); if(d > 1200 || d < 150) return;
        var BB = b.know && b.know.enemies[e.id]; if(BB && BB.last && tick - BB.last.tick < 3*TICK_HZ) return;   // свежая инфа — не в счёт
        var pPast = histAt(e.id, tick - 3*TICK_HZ - (tick % 8)); if(!pPast) return;
        A.hid.n++;
        var f = b.facing || 0, tol = 8/57.3;
        if(ang(dirTo(b, e.x, e.y) - f) < tol) A.hid.hitTrue++;
        if(ang(dirTo(b, pPast[1], pPast[2]) - f) < tol) A.hid.hitPast++;
        if(BB && BB.last && ang(dirTo(b, BB.last.x, BB.last.y) - f) < tol) A.hid.hitLast++;
        FUT.push([tick + 3*TICK_HZ, b.id, e.id, f, b.x, b.y]);
      });
    }
  });
  ["CT","T"].forEach(function(tm){ for(var id in teamVis[tm]) TSEEN[tm][id] = tick; });
  // будущая позиция врага (плацебо: смотрит ли туда, где враг БУДЕТ через 3 с)
  while(FUT.length && FUT[0][0] <= tick){ var q = FUT.shift(), e2 = byId(q[2]); if(e2 && e2.alive && ang(Math.atan2(e2.y-q[5], e2.x-q[4]) - q[3]) < 8/57.3) A.hid.hitFut++; }
  // --- исход контактов
  for(var ck in CONT){ var c2 = CONT[ck]; if(c2.res) continue; var bb = byId(c2.b), ee = byId(c2.e);
    if(tick - c2.t0 > 5*TICK_HZ){ c2.res = "none"; continue; }
    if(bb && !bb.alive) c2.res = "died"; else if(ee && !ee.alive) c2.res = "killed"; }
  // --- утечка: используют ли тиммейты услышанное другим (смотрят туда в ближайшую 1 с)
  PENDLEAK = PENDLEAK.filter(function(p){
    if(tick - p.t > TICK_HZ){ p.row.used = p.used.length; return false; }
    bots.forEach(function(o){ if(!o.alive || o.team !== p.team || o.id === p.owner || p.used.indexOf(o.id) >= 0) return;
      if(Math.hypot(p.x-o.x, p.y-o.y) > 1300) return;
      var hs = o.heardSound; if(hs && Math.hypot(hs.x-p.x, hs.y-p.y) < 300 && tick - hs.tick < 2*TICK_HZ) return;  // сам слышал
      if(ang(dirTo(o, p.x, p.y) - (o.facing||0)) < 12/57.3) p.used.push(o.id); });
    return true;
  });
  // --- раскрыт (ранен, выжил): через 4 с — на том же месте?
  EXPO = EXPO.filter(function(x){ if(tick - x.t < 4*TICK_HZ) return true; var b2 = byId(x.id);
    if(b2 && b2.alive) A.exposed.push([x.t, x.id, Math.round(Math.hypot(b2.x-x.x, b2.y-x.y)), b2._sawEnemy ? 1 : 0, x.hp]); return false; });
  // --- знание: вес «остался на месте» против возраста и того, насколько враг на самом деле ушёл (раз в 64 тика)
  if(tick % 64 === 0) bots.forEach(function(b){
    if(!b.alive || !b.know) return;
    for(var id in b.know.enemies){ var BB = b.know.enemies[id]; if(BB.visible || !BB.last || BB.last.source === "spawn") continue;
      var e = byId(id); if(!e || !e.alive) continue;
      var age = Math.floor((tick - BB.last.tick)/TICK_HZ), bin = age < 5 ? "0-5" : age < 10 ? "5-10" : age < 20 ? "10-20" : age < 40 ? "20-40" : "40+";
      var held = knowHyp(BB, "held"), S = A.stale[bin] || (A.stale[bin] = {n: 0, held: 0, moved: 0, heldHi: 0, heldHiMoved: 0});
      var mv = Math.hypot(e.x-BB.last.x, e.y-BB.last.y), hw = held ? held.weight : 0;
      S.n++; S.held += hw; S.moved += mv; if(hw >= 0.5){ S.heldHi++; if(mv > 300) S.heldHiMoved++; }
    }
  });
  // --- стоят «в одной точке, смотрят одинаково» (раз в 32 тика)
  if(tick % 32 === 0) for(var i = 0; i < bots.length; i++) for(var j = i+1; j < bots.length; j++){
    var p = bots[i], q2 = bots[j]; if(!p.alive || !q2.alive || p.team !== q2.team || (p.curSpeed||0) > 20 || (q2.curSpeed||0) > 20) continue;
    if(Math.hypot(p.x-q2.x, p.y-q2.y) < 60 && ang((p.facing||0) - (q2.facing||0)) < 25/57.3) A.stack++;
  }
  // --- смена сайта плана T
  var cs = teamTac && teamTac.T ? teamTac.T.site : null;
  if(cs && lastSite && cs !== lastSite){
    SITECH.push([tick, lastSite, cs]);
    var ts = bots.filter(function(b){ return b.team === "T"; });
    var w0 = {t: tick, from: lastSite, to: cs, why: lastIGL, s0: ts.map(function(b){ return tSnap(b, cs, lastSite); }), at: {}}; PLW.push(w0); A.plan.push(w0);
  }
  lastSite = cs || lastSite;
  PLW.forEach(function(w){ [2, 5, 10].forEach(function(s){ if(tick - w.t === s*TICK_HZ){ w.at[s] = bots.filter(function(b){ return b.team === "T"; }).map(function(b){ return tSnap(b, w.to, w.from); }); } });
  });
}
A.ticks = tick;
A.first.forEach(function(c){ if(!c.res) c.res = "none"; });
JSON.stringify(A);
