function cl0save(){ return teamTac.CT && teamTac.CT.saving; }
// ======================= РАЗДЕЛ 9: подача матча =======================

var clutchShown = null, clutchInfo = null;
function esc(t){ return String(t).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
// Урон по жертве за раунд (кто сколько снял) — для MVP и ассиста в киллфиде.
function noteDmg(att, vic, dmg){
  if(!att || att.team === vic.team) return;
  var dealt = Math.min(dmg, Math.max(0, vic.hp));
  att.roundDmg = (att.roundDmg||0) + dealt;
  var D = vic._dmgBy || (vic._dmgBy = {});
  D[att.id] = (D[att.id]||0) + dealt;
}
// Ассист, как в CS2: другой игрок снял жертве 40+ HP, иначе — ослепил её флешкой
function killAssist(att, vic){
  var best = null, bd = 39, D = vic._dmgBy || {};
  for(var id in D) if((!att || id !== att.id) && D[id] > bd){ bd = D[id]; best = id; }
  if(best) return {id:best, flash:false};
  if(vic._blindBy && vic.blindUntil > tick && (!att || vic._blindBy !== att.id)) return {id:vic._blindBy, flash:true};
  return null;
}
// mods: smoke — через смок, wall — прострел, noscope — без прицела, blind — убийца ослеплён
function feedKill(att, vic, wkey, hs, mods){
  mods = mods || {};
  var as = killAssist(att, vic);
  killfeed.unshift({kind:"kill", att:att?nick(att.id):"?", attTeam:att?att.team:"", as:as?nick(as.id):null, asFlash:as&&as.flash,
    vic:nick(vic.id), vicTeam:vic.team, w:wkey, hs:hs, smoke:!!mods.smoke, wall:!!mods.wall, noscope:!!mods.noscope, blind:!!mods.blind, t:nowTs});
  if(killfeed.length > 8) killfeed.length = 8;
  renderFeed();
  // мультикилл-баннер
  if(att && att.team !== vic.team && att.roundKills >= 2){
    var lbl = ["", "", "2K", "3K", "4K", "ACE"][Math.min(5, att.roundKills)];
    showBanner((att.roundKills >= 5 ? "ACE — " : lbl+" — ")+nick(att.id), att.team, 2200);
  }
  checkClutch();
}
// ---- белые силуэты оружия (свои простые, ствол вправо, к жертве) ----
// Винтовка/ПП собирается из частей: приклад, корпус, ствол, магазин, рукоять, прицел, глушитель.
function gunSvg(g){
  var L = g.L, H = 16, p = [];
  var by = 4, bh = g.bh || 5;                                    // корпус
  var rx0 = g.r0, rx1 = g.r1;
  p.push('M'+rx0+' '+by+'h'+(rx1-rx0)+'v'+bh+'h'+(-(rx1-rx0))+'z');
  if(g.hg) p.push('M'+rx1+' '+(by+0.5)+'h'+g.hg+'v'+(bh-1.5)+'h'+(-g.hg)+'z');            // цевьё
  var bx = rx1 + (g.hg||0);                                       // ствол
  p.push('M'+bx+' '+(by+1)+'h'+(L-bx)+'v1.6h'+(-(L-bx))+'z');
  if(g.sup) p.push('M'+(L-g.sup)+' '+(by+0.2)+'h'+g.sup+'v3.4h'+(-g.sup)+'z');           // глушитель
  if(g.st === "solid") p.push('M0 '+(by+0.5)+'L'+rx0+' '+by+'v'+bh+'L1 '+(by+bh+3)+'H0z'); // приклад
  else if(g.st === "thin") p.push('M0 '+(by+1)+'h'+rx0+'v1.6h'+(-rx0)+'z M0 '+(by+1)+'h1.6v5h-1.6z');
  else if(g.st === "bull") p.push('M0 '+(by)+'h'+rx0+'v'+(bh+3)+'h'+(-rx0)+'z');
  var gx = g.gx || (rx0+3);                                        // рукоять
  p.push('M'+gx+' '+(by+bh)+'h3l-1.2 5h-3z');
  if(g.mag === "curve") p.push('M'+g.mx+' '+(by+bh)+'h3.2q0.5 4 2.2 6.5l-2.8 0.8q-1.8-3-2.6-7.3z');
  else if(g.mag === "straight") p.push('M'+g.mx+' '+(by+bh)+'h3v6h-3z');
  else if(g.mag === "long") p.push('M'+g.mx+' '+(by+bh)+'h2.4v'+(H-by-bh)+'h-2.4z');
  if(g.sc) p.push('M'+g.sc[0]+' 0.6h'+g.sc[1]+'v2.6h'+(-g.sc[1])+'z M'+(g.sc[0]+2)+' 3h1.5v1h-1.5z');
  else if(g.rail) p.push('M'+g.rail[0]+' 2.6h'+g.rail[1]+'v1.4h'+(-g.rail[1])+'z');
  if(g.top) p.push('M'+g.top[0]+' 1.5h'+g.top[1]+'v2.5h'+(-g.top[1])+'z');                  // P90: магазин сверху
  return {w:L, d:p.join(' ')};
}
function pistolSvg(len, big){
  var h = big ? 4.5 : 3.6;
  return {w:len+2, d:'M2 3h'+len+'v'+h+'h'+(-len)+'z M3 '+(3+h)+'h4.4l-1.4 '+(big?6.5:6)+'h-4.4z M7.6 '+(3+h)+'h2v1.4h-2z'};
}
var WEAPON_ICON = (function(){
  var I = {
    AK:    gunSvg({L:46, st:"solid", r0:9,  r1:24, hg:8, mag:"curve", mx:21, gx:15, rail:[19,3]}),
    M4:    gunSvg({L:46, st:"thin",  r0:9,  r1:25, hg:8, mag:"straight", mx:21, gx:15, rail:[12,12]}),
    M4S:   gunSvg({L:50, st:"thin",  r0:9,  r1:25, hg:7, mag:"straight", mx:21, gx:15, rail:[12,12], sup:12}),
    FAMAS: gunSvg({L:42, st:"bull",  r0:6,  r1:28, bh:4.5, mag:"straight", mx:9, gx:19, rail:[10,15]}),
    GALIL: gunSvg({L:45, st:"thin",  r0:9,  r1:24, hg:8, mag:"curve", mx:20, gx:14}),
    SG:    gunSvg({L:46, st:"solid", r0:9,  r1:25, hg:7, mag:"curve", mx:21, gx:15, sc:[13,9]}),
    AUG:   gunSvg({L:42, st:"bull",  r0:5,  r1:26, bh:5.5, mag:"straight", mx:8, gx:18, sc:[12,10]}),
    AWP:   gunSvg({L:56, st:"solid", r0:11, r1:27, mag:"straight", mx:22, gx:17, sc:[15,13]}),
    SSG:   gunSvg({L:50, st:"thin",  r0:9,  r1:24, mag:"straight", mx:20, gx:15, sc:[13,10]}),
    MP9:   gunSvg({L:32, st:"thin",  r0:7,  r1:20, mag:"long", mx:13, gx:13}),
    MAC10: gunSvg({L:27, r0:3, r1:20, bh:5.5, mag:"long", mx:6, gx:6}),
    UMP:   gunSvg({L:36, st:"thin",  r0:8,  r1:24, mag:"curve", mx:18, gx:12}),
    MP7:   gunSvg({L:32, st:"thin",  r0:7,  r1:21, mag:"long", mx:12, gx:12, rail:[10,8]}),
    P90:   gunSvg({L:36, st:"bull",  r0:4,  r1:28, bh:6, gx:16, top:[8,18]}),
    GLOCK: pistolSvg(13), USP: pistolSvg(16), P250: pistolSvg(13), FIVE7: pistolSvg(14),
    TEC9:  {w:20, d:'M2 3h16v3.6h-16z M5 6.6h4l-1 6h-4z M11 6.6h2.4v6h-2.4z'},
    DEAGLE: pistolSvg(17, true),
    KNIFE: {w:30, d:'M1 6h10v4h-10z M11 5h3v6h-3z M14 6.5h10l5-1.5-3 4.5h-12z'},
    HE:    {w:12, d:'M6 15a5 5.5 0 1 1 0.01 0z M4.5 3h3v2.5h-3z M7.5 3.5l3.5-1.5 0.6 1.2-3.6 1.6z'},
    MOLOTOV: {w:12, d:'M4 6h4v1.5l1.5 2v6h-7v-6l1.5-2z M4.6 1.5h2.8v4h-2.8z M6 0c2.5 0.5 3 2.5 1.6 4l-1.6-1z'}
  };
  return I;
})();
var KF_MOD = {  // значки после оружия (свои простые силуэты)
  smoke:   {w:14, d:'M3 13a3 3 0 0 1 0-6a4 4 0 0 1 7.5-1.5a3.2 3.2 0 0 1 0.5 7.5z', t:"через смок"},
  wall:    {w:14, d:'M5 1h3v14h-3z M0 7.2h4.5v1.6h-4.5z M9 7.2h5v1.6h-5z', t:"прострел"},
  hs:      {w:13, d:'M6.5 1a5.5 5.5 0 0 1 5.5 5.5c0 2-1 3.4-2.4 4.2v2.8h-6.2v-2.8a5 5 0 0 1-2.4-4.2a5.5 5.5 0 0 1 5.5-5.5z M3.6 5.6h2.2v2.4h-2.2z M7.2 5.6h2.2v2.4h-2.2z', t:"в голову", ev:1},
  noscope: {w:14, d:'M7 1.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11z M7 3.1a3.9 3.9 0 1 0 0 7.8a3.9 3.9 0 1 0 0-7.8z M1.2 2.3l1.1-1.1 10.5 10.5-1.1 1.1z', t:"без прицела", ev:1},
  blind:   {w:15, d:'M7.5 3c3.5 0 6 2.5 7 4.5c-1 2-3.5 4.5-7 4.5s-6-2.5-7-4.5c1-2 3.5-4.5 7-4.5z M7.5 5a2.5 2.5 0 1 0 0.01 0z M1.5 1.5l1-1 12 12-1 1z', t:"убийца ослеплён", ev:1}
};
function kfSvg(ic, cls, title){
  return '<svg class="'+cls+'" viewBox="0 0 '+ic.w+' 16" width="'+(ic.w*0.95).toFixed(1)+'" height="15.2" '+(ic.ev?'fill-rule="evenodd" ':'')+'aria-label="'+title+'"><title>'+title+'</title><path d="'+ic.d+'"/></svg>';
}
function feedEvent(kind, text){
  killfeed.unshift({kind:kind, text:nickify(text), t:nowTs});
  if(killfeed.length > 8) killfeed.length = 8;
  renderFeed();
}
function renderFeed(){
  var el = document.getElementById("killfeed"); if(!el) return;
  el.innerHTML = killfeed.map(function(k){
    if(k.kind === "kill"){
      var W = WEAPONS[k.w], ic = WEAPON_ICON[k.w], wn = W ? W.name : (k.w === "MOLOTOV" ? "молотов" : k.w === "KNIFE" ? "нож" : k.w);
      var h = '<span class="'+k.attTeam.toLowerCase()+'">'+esc(k.att)+'</span>';
      if(k.as) h += '<span class="pl">+</span>'+(k.asFlash ? kfSvg({w:9, d:'M4.5 1l1.2 3.8 3.3-1.6-1.9 3.3 1.9 3.3-3.3-1.6-1.2 3.8-1.2-3.8-3.3 1.6 1.9-3.3-1.9-3.3 3.3 1.6z'}, "md fl", "ассист флешкой") : '')+'<span class="'+k.attTeam.toLowerCase()+' as">'+esc(k.as)+'</span>';
      h += ic ? kfSvg(ic, "wp", wn) : '<span class="w">'+esc(wn)+'</span>';
      ["smoke","wall","hs","noscope","blind"].forEach(function(m){ if(k[m]) h += kfSvg(KF_MOD[m], "md", KF_MOD[m].t); });
      return '<div class="kf">'+h+'<span class="'+k.vicTeam.toLowerCase()+'">'+esc(k.vic)+'</span></div>';
    }
    return '<div class="kf ev '+k.kind+'">'+esc(k.text)+'</div>';
  }).join("");
}
var bannerTimer = null;
function showBanner(text, team, ms){
  var el = document.getElementById("banner"); if(!el) return;
  el.textContent = nickify(text); el.className = "show "+(team||"").toLowerCase();
  if(bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(function(){ el.className = ""; }, ms||2000);
}
// клатч: один игрок против двух и больше — подсвечиваем, пока не решится
function checkClutch(){
  if(roundState !== "live") return;
  ["CT","T"].forEach(function(team){
    var mine = bots.filter(function(b){ return b.team===team && b.alive; });
    var theirs = bots.filter(function(b){ return b.team!==team && b.alive; });
    // Клатч объявляется, только если он ВЫИГРАН (см. showRoundCard); здесь —
    // тихо запоминаем ситуацию: кто остался один и против скольких (максимум)
    if(mine.length === 1 && theirs.length >= 2){
      if(!clutchInfo || clutchInfo.id !== mine[0].id) clutchInfo = {id:mine[0].id, team:team, n:theirs.length};
      else clutchInfo.n = Math.max(clutchInfo.n, theirs.length);
    }
  });
}
var cardTimer = null;
function showRoundCard(winner, reason){
  var el = document.getElementById("roundCard"); if(!el) return;
  var why = {elim:"все противники уничтожены", time:"время вышло", bomb:"бомба взорвалась", defuse:"бомба обезврежена"}[reason] || reason;
  // лучший игрок раунда: фраги, при равенстве — урон
  var mvp = null;
  bots.forEach(function(b){
    if(winner && b.team !== winner) return;
    var sc = (b.roundKills||0)*1000 + (b.roundDmg||0);
    if(reason === "defuse" && bomb && bomb.state === "defused" && b.team === "CT" && b.defuseUntil && Math.abs(b.defuseUntil - tick) < 2) sc += 5000;
    if(!mvp || sc > mvp.sc) mvp = {b:b, sc:sc};
  });
  var clutch = clutchInfo && winner && clutchInfo.team === winner;
  if(clutch){
    clutchShown = clutchInfo.id;
    showBanner("КЛАТЧ 1v"+clutchInfo.n+" — "+clutchInfo.id+"!", winner, 3200);
    logEvent("Клатч выигран: "+clutchInfo.id+" (1v"+clutchInfo.n+")", "round");
    feedEvent("clutch", "Клатч 1v"+clutchInfo.n+" — "+clutchInfo.id);
  }
  el.innerHTML = '<div class="rc-t '+(winner||"").toLowerCase()+'">'+(winner ? "ПОБЕДА "+winner : "НИЧЬЯ")+'</div>'+
    '<div class="rc-r">Раунд '+roundNum+' · '+why+'</div>'+
    (clutch ? '<div class="rc-c">клатч 1v'+clutchInfo.n+' выигран — '+esc(nick(clutchInfo.id))+'</div>' : '')+
    (mvp && mvp.b ? '<div class="rc-m">MVP: <b>'+esc(nick(mvp.b.id))+'</b> ('+(ROLE_LABEL[mvp.b.tRole]||"")+') · '+(mvp.b.roundKills||0)+' фраг(а), '+Math.round(mvp.b.roundDmg||0)+' урона</div>' : '')+
    '<div class="rc-s">CT '+score.CT+' : '+score.T+' T</div>';
  el.className = "show";
  if(cardTimer) clearTimeout(cardTimer);
  cardTimer = setTimeout(function(){ el.className = ""; }, Math.max(2500, ROUND_RESTART_DELAY_SEC*1000 - 200));
}

function renderEcon(){
  var el = document.getElementById("econ"); if(!el) return;
  var h = '<div style="color:var(--accent);font-weight:600;">Экономика · раунд '+roundNum+(roundNum>HALF_ROUNDS?' (2-я половина)':'')+'</div>';
  ["CT","T"].forEach(function(team){
    var te = teamEco[team];
    var mates = bots.filter(function(b){ return b.team===team; });
    var total = mates.reduce(function(a,b){ return a+b.money; }, 0);
    h += '<div class="tm '+team.toLowerCase()+'"><span>'+team+' · '+ROUND_TYPE_LABEL[te.roundType]+'</span><span>$'+total+' · при поражении +'+LOSS_BONUS[Math.min(4,te.lossLevel)]+'</span></div>';
    if(team === "T" && teamTac.T){ var PH = {setup:"сетап", execute:"выход", postplant:"пост-плант"}; h += '<div style="color:var(--t);opacity:.85">тактика: «'+teamTac.T.tac.name+'» · '+PH[teamTac.T.phase]+'</div>';
      if(teamTac.T.read) h += '<div style="color:var(--t);opacity:.7;font-size:10px">IGL: '+teamTac.T.read+'</div>'; }
    if(team === "CT" && teamTac.CT && teamTac.CT.setup){ h += '<div style="color:var(--ct);opacity:.8;font-size:10px">расстановка: «'+teamTac.CT.setup.name+'»'+(teamTac.CT.setupWhy ? ' — '+teamTac.CT.setupWhy : '')+'</div>'; }
    if(team === "CT"){ var cl = teamTac.CT && teamTac.CT.call; h += '<div style="color:var(--ct);opacity:.85">'+(bomb && bomb.state==="planted" ? (cl0save() ? "сейв" : (bomb.retake ? (bomb.retake.phase==="gather" ? "ретейк "+bomb.site+": сбор "+(bomb.retake.ready||0)+"/"+(bomb.retake.need||"?") : bomb.retake.phase==="util" ? "ретейк "+bomb.site+": флешка — сейчас заход" : "ретейк "+bomb.site+": заход!") : "ретейк "+bomb.site)) : (cl ? "колл: T на "+cl.site+" (~"+Math.max(1,Math.round(cl.count))+") — ротируют "+Object.keys(teamTac.CT.rot||{}).length : "расстановка по ролям"))+'</div>'; }
    h += '<table>';
    mates.forEach(function(b){
      var wpn = WEAPONS[b.primary || b.secondary].name;
      var arm = (b.helmet ? "КШ" : (b.armor ? "К" : "—")) + (b.kit ? "+кит" : "");
      var c4 = bomb && bomb.carrier === b ? " 💣" : "";
      var nd = b.nades ? ("●".repeat(b.nades.smoke) + "✦".repeat(b.nades.flash) + "▲".repeat(b.nades.he) + "♨".repeat(b.nades.molly)) : "";
      h += '<tr class="'+(b.alive?'':'dead')+'"><td title="'+esc(b.prof ? b.prof.style+" · aim "+b.prof.aim+", агрессия "+b.prof.aggr+", дисциплина "+b.prof.disc+(b._mistakes ? " · ошибок: "+b._mistakes : "") : "")+'">'+pnum(b.id)+' '+esc(nick(b.id))+c4+'</td><td>'+(ROLE_LABEL[b.tRole]||"")+(b.retakeRole && bomb && bomb.state==="planted" && !cl0save() ? ' · '+({defuser:"дефузер",cover:"прикрытие",flank:"фланг"}[b.retakeRole]) : "")+'</td><td>'+wpn+'</td><td>'+arm+'</td><td title="● дым · ✦ флешка · ▲ HE · ♨ молотов">'+nd+'</td><td>'+b.kills+'/'+b.deaths+'</td><td class="m">$'+b.money+'</td></tr>';
    });
    h += '</table>';
  });
  el.innerHTML = h;
}

function frame(ts){
  nowTs = ts;
  if(lastFrame===null) lastFrame = ts;
  var dt = ts - lastFrame; lastFrame = ts;
  if(!paused){
    accumulator += dt;
    while(accumulator >= TICK_MS){ stepTick(); accumulator -= TICK_MS; }
    mkAfterTicks();
  }
  draw();
  requestAnimationFrame(frame);
}
document.getElementById("btnFreshMatch").addEventListener("click", function(){ var n = Math.max(1, parseInt(document.getElementById("inpMatchNum").value, 10) || 1); freshMatch(n); paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); } logEvent("Матч №"+n+" с чистого листа (воспроизводимый)", "round"); });
setInterval(function(){ var el = document.getElementById("matchTick"); if(el) el.textContent = "· сейчас матч "+matchNum+", тик "+tick; }, 250);
var BOT_INIT = bots.map(function(b){ var o = {keys:{}, vals:{}}; for(var k in b){ o.keys[k] = 1; var v = b[k]; if(v === null || (typeof v !== "object" && typeof v !== "function")) o.vals[k] = v; } return o; });
/*@@BUILD: здесь build.py вставляет __SNAP, MK_PRINCIPLES и marks.js@@*/
window.__ev=function(src){return eval(src);};
requestAnimationFrame(frame);

document.getElementById("chkLogDbg").addEventListener("change", function(){
  logDebugOpen = this.checked;
  document.getElementById("logDbgPan").style.display = logDebugOpen ? "block" : "none";
  if(logDebugOpen) renderLog("logDbg", false);
});
document.getElementById("btnPause").addEventListener("click", function(){
  paused = !paused;
  this.textContent = paused ? "Продолжить" : "Пауза";
  this.classList.toggle("active", paused);
});

document.getElementById("btnExportProject").addEventListener("click", function(){
  // всё состояние, которое живёт только в localStorage этого браузера
  var box = document.getElementById("projectExportBox");
  if(box.style.display === "block"){ box.style.display = "none"; return; }
  var data = {
    walls: WALL_OBJECTS.map(function(obj){ return { points: objectAbsPoints(obj).map(function(p){ return {x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10}; }), closed: obj.closed }; }),
    navAnchors: navAnchors,
    userZones: USER_ZONES.map(function(z){ return { name:z.name, kind:z.kind, points: zoneObjAbsPoints(z).map(function(p){ return {x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10}; }) }; }),
    navTransform: navTransform,
    zoneLayer: zoneLayer,
    zoneNames: ZONE_NAMES,
    lineups: USER_LINEUPS,
    zoneShapes: ZONE_SHAPES,
    oppProfile: OPP,
    builtinOff: BUILTIN_OFF
  };
  var ta = document.getElementById("projectExportArea");
  ta.value = JSON.stringify(data);
  box.style.display = "block";
  ta.focus(); ta.select();
  try{ document.execCommand("copy"); }catch(e){}
});

document.getElementById("btnRestartRound").addEventListener("click", function(){
  // manual escape hatch for stuck bots — resetRound() doesn't care what
  // roundState was (live/ending), it just respawns everyone and sets "live"
  logEvent("Раунд "+roundNum+" сброшен вручную", "round");
  resetRound();
  draw();
});

})();
