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
    (mvp && mvp.b ? '<div class="rc-m">MVP: <b>'+esc(nick(mvp.b.id))+'</b> · '+(mvp.b.roundKills||0)+' фраг(а), '+Math.round(mvp.b.roundDmg||0)+' урона</div>' : '')+
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
  $("sbMatch").textContent = "матч № "+matchNum;
  $("sbRound").textContent = "РАУНД "+Math.max(1, roundNum);
  var tm = $("sbTime"), planted = bomb && bomb.state === "planted" && roundState === "live";
  // бомба стоит — как в CS2: вместо времени раунда значок бомбы (время до взрыва зрители не видят)
  if(planted){ tm.textContent = "💣"; tm.className = "sb-time bomb"; return; }
  var sec = roundState === "freeze" ? Math.max(0, roundStartTime - simTime) : rtLeft;
  tm.textContent = Math.floor(sec/60)+":"+("0"+Math.floor(sec%60)).slice(-2);
  tm.className = "sb-time" + (roundState === "live" && sec <= 10 ? " low" : "");
}

// ---------- панели игроков (Н7): как на трансляции; по центру — выбранный кликом ----------
// Названия — настоящие команды по составу (ники NICKS). Фото — PLAYER_PHOTO[ник]
// (картинка data:/svg); пока нет — серый силуэт.
var TEAM_NAME = {T:"Team Spirit", CT:"Team Falcons"};
var PLAYER_PHOTO = {};
var PL_SIL = '<svg viewBox="0 0 40 40"><circle cx="20" cy="14" r="8"/><path d="M4 40c0-9 7-15 16-15s16 6 16 15z"/></svg>';
var PL_ICON = {
  armor:'<svg viewBox="0 0 12 14"><path d="M6 0L12 2.2V7c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V2.2z"/></svg>',
  helmet:'<svg viewBox="0 0 12 14"><path d="M6 0L12 2.2V7c0 3.6-2.6 6-6 7-3.4-1-6-3.4-6-7V2.2z"/><path d="M3.5 4h1.6v2.2h1.8V4h1.6v6H6.9V7.7H5.1V10H3.5z" fill="#222"/></svg>',
  kit:'<svg viewBox="0 0 14 12"><path d="M1 3h3V1h6v2h3v8H1zm4.5-1v1h3V2z"/></svg>',
  c4:'<svg viewBox="0 0 16 10"><rect x="0" y="1" width="16" height="8" rx="1"/><rect x="2" y="3" width="5" height="4" fill="#c33"/></svg>',
  smoke:'<svg viewBox="0 0 8 13"><rect x="1" y="2" width="6" height="11" rx="1.5"/><rect x="2.5" y="0" width="3" height="2"/></svg>',
  flash:'<svg viewBox="0 0 8 13"><rect x="1.5" y="3" width="5" height="10" rx="1"/><rect x="2.5" y="0" width="3" height="3"/></svg>',
  he:'<svg viewBox="0 0 10 13"><circle cx="5" cy="8" r="4.6"/><rect x="3.5" y="0" width="3" height="3.5"/></svg>',
  molly:'<svg viewBox="0 0 8 14"><path d="M2.5 0h3v4l2 2v8h-7V6l2-2z"/></svg>'
};
var plSelected = null;
// номер как на трансляции: T — 1…5, CT — 6…9, 0
function plNum(b){ var i = +b.id.replace(/\D/g, ""); return b.team === "T" ? i + 1 : (i + 6) % 10; }
function plPhoto(b){ var p = PLAYER_PHOTO[nick(b.id)]; return p ? '<img alt="" src="'+p+'">' : PL_SIL; }
function plCard(b){
  var sel = plSelected === b.id ? " sel" : "", n = nick(b.id), hp = b.alive ? Math.max(0, Math.round(b.hp)) : 0, low = hp > 0 && hp <= 25 ? " low" : "";
  var gear = "";
  if(b.alive){
    var wkey = (b.weapon && b.weapon.key) || "KNIFE", ic = KF_ICON[wkey];
    if(ic) gear += '<svg class="wp" viewBox="'+ic.vb+'">'+ic.svg+'</svg>';
    if(b.helmet) gear += PL_ICON.helmet; else if(b.armor) gear += PL_ICON.armor;
    if(b.team === "CT" && b.kit) gear += PL_ICON.kit;
    if(b.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b) gear += PL_ICON.c4;
    var N = b.nades || {}; ["smoke","flash","he","molly"].forEach(function(k){ for(var i=0;i<(N[k]||0);i++) gear += PL_ICON[k]; });
  }
  return '<div class="pl-card'+(b.alive ? "" : " dead")+sel+'"><div class="pl-ava">'+plPhoto(b)+'</div><div class="pl-body">'+
    '<div class="pl-line"><span class="pl-nick">'+(b.team === "CT" ? esc(n)+'<i>'+plNum(b)+'</i>' : '<i>'+plNum(b)+'</i>'+esc(n))+'</span><span class="pl-hp'+low+'">'+(b.alive ? hp : "☠")+'</span></div>'+
    '<div class="pl-gear">'+gear+'</div>'+
    '<div class="pl-line"><span class="pl-stat">'+(b.kills||0)+' / '+(b.deaths||0)+'</span><span class="pl-money">$'+(b.money||0).toLocaleString("en-US")+'</span></div>'+
    '</div><div class="pl-bar"><b class="'+low.trim()+'" style="width:'+hp+'%"></b></div></div>';
}
function playersUpdate(){
  ["T","CT"].forEach(function(t){
    var el = document.getElementById("pl"+t); if(!el) return;
    el.innerHTML = '<div class="pl-tag"><span>'+esc(TEAM_NAME[t])+'</span></div>'+bots.filter(function(b){ return b.team === t; }).map(plCard).join("");
  });
  var f = document.getElementById("plFocus"), b = plSelected && botById(plSelected);
  if(!b || !b.alive){ plSelected = null; f.className = ""; return; }
  f.className = "show "+b.team.toLowerCase();
  var ph = document.getElementById("pfPhoto"); if(ph.dataset.id !== b.id){ ph.dataset.id = b.id; ph.innerHTML = plPhoto(b); }
  document.getElementById("pfNick").textContent = nick(b.id);
  document.getElementById("pfHp").textContent = Math.max(0, Math.round(b.hp))+" HP · "+((b.weapon && b.weapon.name) || "");
}
// клик по игроку на радаре (не перетаскивание камеры) — он в центре; мимо — убрать
(function(){
  var down = null;
  cv.addEventListener("mousedown", function(e){ if(e.button === 0) down = {x:e.clientX, y:e.clientY}; });
  cv.addEventListener("mouseup", function(e){
    if(e.button !== 0 || !down || Math.hypot(e.clientX-down.x, e.clientY-down.y) > 4){ down = null; return; }
    down = null;
    var w = navScreenToWorld(e.clientX, e.clientY), best = null, bd = 16/view.scale;
    bots.forEach(function(b){ if(!b.alive) return; var d = Math.hypot(b.x-w.x, b.y-w.y); if(d < bd){ bd = d; best = b; } });
    plSelected = best ? best.id : null;
    playersUpdate();
  });
})();
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
    zoneShapes: ZONE_SHAPES
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
