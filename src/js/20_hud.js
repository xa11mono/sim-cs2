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
  killfeedRead(att, vic, wkey); // киллфид видят и боты — закуп и роли врага (09_knowledge.js)
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
// ---- иконки киллфида (v180): готовые SVG владельца из src/data/killfeed/,
// сборка вставляет их сюда: ключ → {vb, w, h, svg}. Оружие — по ключу WEAPONS,
// нож T — KNIFE_T; значки — hs, smoke, wall, noscope, blind, flash ----
var KF_ICON = @@KFICONS@@;
var KF_MOD_T = {smoke:"через смок", wall:"прострел", hs:"в голову", noscope:"без прицела", blind:"убийца ослеплён", flash:"ассист флешкой"};
function kfSvg(key, cls, title){
  var ic = KF_ICON[key]; if(!ic) return null;
  var hpx = cls === "wp" ? 16 : 15, wpx = (ic.w*hpx/ic.h).toFixed(1);
  return '<svg class="'+cls+'" viewBox="'+ic.vb+'" width="'+wpx+'" height="'+hpx+'" aria-label="'+title+'"><title>'+title+'</title>'+ic.svg+'</svg>';
}
// событие в киллфид: бомба, дефуз, взрыв, клатч (удалена по ошибке в v179, возвращена в v180)
function feedEvent(kind, text){
  killfeed.unshift({kind:kind, text:nickify(text), t:nowTs});
  if(killfeed.length > 8) killfeed.length = 8;
  renderFeed();
}
function renderFeed(){
  var el = document.getElementById("killfeed"); if(!el) return;
  el.innerHTML = killfeed.map(function(k){
    if(k.kind === "kill"){
      var W = WEAPONS[k.w], wn = W ? W.name : (k.w === "MOLOTOV" ? "молотов" : k.w === "KNIFE" ? "нож" : k.w);
      var wkey = k.w === "KNIFE" && k.attTeam === "T" ? "KNIFE_T" : k.w;
      var h = '<span class="'+k.attTeam.toLowerCase()+'">'+esc(k.att)+'</span>';
      if(k.as) h += (k.asFlash ? kfSvg("flash", "md fl", KF_MOD_T.flash) : '<span class="pl">+</span>')+'<span class="'+k.attTeam.toLowerCase()+' as">'+esc(k.as)+'</span>';
      h += kfSvg(wkey, "wp", wn) || '<span class="w">'+esc(wn)+'</span>';
      ["smoke","wall","hs","noscope","blind"].forEach(function(m){ if(k[m]) h += kfSvg(m, "md", KF_MOD_T[m]); });
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
      h += '<tr class="'+(b.alive?'':'dead')+'"><td>'+pnum(b.id)+' '+esc(nick(b.id))+c4+'</td><td>'+(ROLE_LABEL[b.tRole]||"")+(b.retakeRole && bomb && bomb.state==="planted" && !cl0save() ? ' · '+({defuser:"дефузер",cover:"прикрытие",flank:"фланг"}[b.retakeRole]) : "")+'</td><td>'+wpn+'</td><td>'+arm+'</td><td title="● дым · ✦ флешка · ▲ HE · ♨ молотов">'+nd+'</td><td>'+b.kills+'/'+b.deaths+'</td><td class="m">$'+b.money+'</td></tr>';
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
// ---------- табло (Н6): счёт, раунд, таймер, живые — как на трансляции ----------
// Логотипы команд — TEAM_LOGO (картинка data:/svg); пока нет — буква стороны.
var TEAM_LOGO = {T:null, CT:null};
function scoreboardUpdate(rtLeft){
  var $ = function(id){ return document.getElementById(id); };
  ["T","CT"].forEach(function(t){
    var lg = $("sbLogo"+t);
    if(TEAM_LOGO[t] && lg.dataset.src !== TEAM_LOGO[t]){ lg.dataset.src = TEAM_LOGO[t]; lg.innerHTML = '<img alt="" src="'+TEAM_LOGO[t]+'">'; }
    $("sbScore"+t).textContent = score[t];
    $("sbAlive"+t).textContent = bots.filter(function(b){ return b.team === t && b.alive; }).length;
  });
  $("sbMatch").textContent = "Match "+matchNum;
  $("sbRound").textContent = "ROUND "+Math.max(1, roundNum);
  var tm = $("sbTime"), planted = bomb && bomb.state === "planted" && roundState === "live";
  // бомба стоит — как в CS2: вместо времени раунда значок бомбы (время до взрыва зрители не видят)
  if(planted){ tm.textContent = "💣"; tm.className = "sb-time bomb"; return; }
  var sec = roundState === "freeze" ? Math.max(0, roundStartTime - simTime) : rtLeft;
  tm.textContent = Math.floor(sec/60)+":"+("0"+Math.floor(sec%60)).slice(-2);
  tm.className = "sb-time" + (roundState === "live" && sec <= 10 ? " low" : "");
}

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
