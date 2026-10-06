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
// ---- белые силуэты оружия для киллфида (нарисованы вручную по форме настоящего
// оружия, вид сбоку, ствол вправо — к жертве). Сетка: высота 24, ширина — w.
// d — заливка обычная; e — вторая часть с «дырками» (кольца, глаз) ----
var GRIP = function(x){ return 'M'+x+' 13.5h5.5l-2 8.5h-5.2z'; };                  // пистолетная рукоять винтовки
var GUARD = function(x){ return 'M'+x+' 13.5h7v0.8q0 3.4-3.4 3.4h-2.4v-1.4h2.2q1.8 0 1.8-2h-5.2z'; }; // спусковая скоба
var WEAPON_ICON = {
  AK: {w:96, d:[
    'M0 8.2L24 6.8V13.6L3 18H0Z',                       // деревянный приклад
    'M24 6.6H52V13.6H24Z M27 5.6H50V6.8H27Z',            // ствольная коробка, крышка
    'M52 6.2H72V8.4H52Z',                                 // газовая трубка
    'M52 8.4H67V13H52Z',                                  // цевьё
    'M67 9.4H92V11H67Z M86.5 5.6H88.5V9.4H86.5Z',        // ствол, мушка
    'M91 8.8H96V11.6H91Z',                                // дульный тормоз
    GRIP(30), GUARD(35.5),
    'M42.5 13.5H48.5Q49.5 18.5 54 22.6L49.3 24Q44.5 19.6 42.5 13.5Z'  // изогнутый магазин
  ].join(' ')},
  M4: {w:92, d:[
    'M0 6.6H3.2V16.4H0Z M2 7.4H15V15L3.5 15.6H2Z',      // приклад
    'M14 9H28V11.6H14Z',                                  // буферная трубка
    'M28 6.4H52V9.6H28Z M28 9.6H49V14H28Z',              // верхняя и нижняя коробка
    'M30 4.6H48V6.4H30Z M30.5 2.4H35V4.6H30.5Z',         // планка, целик
    'M52 6.4H71V12.6H52Z',                                // цевьё
    'M68.5 2.6H71.5L73.5 6.4H67.5Z',                      // мушка-«треугольник»
    'M71 8.4H88V10H71Z M85.5 7.6H92V10.8H85.5Z',         // ствол, пламегаситель
    GRIP(33), GUARD(38.5),
    'M41 14H47.5L49 22.8H42.6Z'                            // магазин
  ].join(' ')},
  M4S: {w:96, d:[
    'M0 6.6H3.2V16.4H0Z M2 7.4H15V15L3.5 15.6H2Z',
    'M14 9H28V11.6H14Z',
    'M28 6.4H52V9.6H28Z M28 9.6H49V14H28Z',
    'M30 4.6H48V6.4H30Z M30.5 2.4H35V4.6H30.5Z',
    'M52 6.4H66V12.6H52Z',
    'M66 6.8H96V11.6H66Z',                                // длинный глушитель
    GRIP(33), GUARD(38.5),
    'M41 14H47.5L48.4 22.8H42.2Z'
  ].join(' ')},
  FAMAS: {w:80, d:[
    'M0 7.4H4V17H0Z M3 7.8H12V16.6L4 17Z',               // затыльник
    'M10 6.8H58V15H10Z',                                  // корпус (буллпап)
    'M16 2H54V3.8H16Z M16 2H19.5V7H16Z M50.5 2H54V7H50.5Z', // ручка-рамка сверху
    'M58 7.6H67V13H58Z',                                  // цевьё
    'M67 9.4H80V11H67Z',                                  // ствол
    'M38 15H43.5L41.6 22.2H36.6Z', 'M43.5 15H50.5V15.8Q50.5 19 47.4 19H45V17.6H47.2Q49 17.6 49 15.8H43.5Z', // рукоять, скоба
    'M14 15H20.5V22.4H14Z'                                // магазин сзади
  ].join(' ')},
  GALIL: {w:94, d:[
    'M0 7H3.4V17.4H0Z M2 7H25V8.8H2Z M2 15.6L25 12V13.8L2 17.4Z', // складной приклад-рамка
    'M24 6.6H52V13.6H24Z',
    'M30 5.2H33V6.6H30Z',
    'M52 7H70V13H52Z',                                    // цевьё
    'M70 9.4H90V11H70Z M84.5 5.6H86.5V9.4H84.5Z M88 8.6H94V11.8H88Z',
    GRIP(30), GUARD(35.5),
    'M42.5 13.5H48.6Q49.4 17.6 52.6 21.4L48.2 23Q44.4 18.8 42.5 13.5Z'
  ].join(' ')},
  SG: {w:92, d:[
    'M0 6.8H3.2V17.6H0Z M2 6.8H22V13.4L3.6 17.6H2Z',     // приклад
    'M22 6.4H50V13.6H22Z',
    'M25 1.6H47V5H25Z M22.5 0.8H27.5V5.8H22.5Z M44 0.6H49.5V6H44Z M31 5H34V6.4H31Z M39 5H42V6.4H39Z', // прицел
    'M50 7H67V12.8H50Z',
    'M67 9.2H86V10.8H67Z M84 8.4H92V11.6H84Z',
    GRIP(28), GUARD(33.5),
    'M40.5 13.5H46.6Q47.4 18 51 22L46.4 23.4Q42.4 18.8 40.5 13.5Z'
  ].join(' ')},
  AUG: {w:84, d:[
    'M3 9Q3 6.2 7 6.2H54V13.8Q42 17.2 28 17.2L8 16.4Q3 15.6 3 12Z', // обтекаемый корпус-буллпап
    'M22 1.6H44V5H22Z M19.6 1.2H24V5.4H19.6Z M42 0.6H48V6H42Z M27 5H41V6.4H27Z', // встроенный прицел
    'M54 7H64V12.4H54Z',                                  // кожух ствола
    'M64 8.8H80V10.4H64Z M77 8.2H84V11H77Z',
    'M54 12.4H58.4L59.4 21.6H55Z',                         // передняя рукоять
    'M38 14.4H43.4L42.2 21.6H37.2Z',                       // рукоять
    'M18.6 15.4H24.6L25.6 22.6H19.6Z'                      // магазин сзади
  ].join(' ')},
  AWP: {w:112, d:[
    'M0 6H5.4L30 8.8V14L8 18.6H0Z',                       // приклад с щекой
    'M30 8H58V13.6H30Z',                                  // коробка
    'M34 1.8H54V5.4H34Z M29.6 1.2H35V6H29.6Z M52 0.4H60V6.8H52Z M37.5 5.4H40.5V8H37.5Z M47.5 5.4H50.5V8H47.5Z', // оптика
    'M50 13.4L53.6 16.4H56.4V19.2H52.4L48 14.2Z',         // рукоять затвора
    'M58 8H80L79 13.4H58Z',                               // ложа спереди
    'M80 9H104V11H80Z M100 8H112V12H100Z',                // ствол, тормоз
    'M23 13.6H29L27.8 21.6H22Z', GUARD(29),
    'M38 13.6H44V18.4H38Z'                                // магазин
  ].join(' ')},
  SSG: {w:102, d:[
    'M0 6.6H3.4V17.4H0Z M2 6.6H26V8.6H2Z M2 15.4L26 12.2V14.2L2 17.4Z', // скелетный приклад
    'M24 7.8H50V13H24Z',
    'M30 2.4H48V5.4H30Z M26.6 1.8H31V6H26.6Z M46 1.2H52.6V6.6H46Z M34 5.4H36.6V7.8H34Z M42 5.4H44.6V7.8H42Z',
    'M44 12.8L47 15.6H49.4V18H46L42.4 13.6Z',
    'M50 8.2H70V12.4H50Z',
    'M70 9.2H96V10.8H70Z M95 8.6H102V11.4H95Z',
    'M20.4 13H25.8L24.6 20.8H19.4Z', GUARD(25.8),
    'M33 13H38.4V16.6H33Z'
  ].join(' ')},
  MP9: {w:62, d:[
    'M0 6.8H3V15H0Z M1.6 6.8H16V8.8H1.6Z',               // откинутый приклад
    'M15 6H46V12.6H15Z M17 4.4H40V6H17Z',                // коробка, планка
    'M46 8H56V9.8H46Z M53.6 7.4H62V10.4H53.6Z',
    'M41.6 12.6H46L46.6 19.6H42.2Z',                      // передняя рукоять
    'M24.6 12.6H31L28.8 23.4H22.4Z', GUARD(31)            // рукоять с магазином
  ].join(' ')},
  MAC10: {w:50, d:[
    'M0 6H6.4V8H0Z M0 6H2.2V13.4H0Z',                    // сложенный приклад
    'M6 4.8H40V13H6Z M19 3.4H24V4.8H19Z',                // коробчатая коробка
    'M40 7.8H50V10.2H40Z',                                // ствол с резьбой
    'M9.6 13H16L14.8 24H8.4Z', GUARD(16),                // рукоять с длинным магазином
    'M35 13H40V16.4H33.4V15H35Z'                          // ремень-петля спереди
  ].join(' ')},
  UMP: {w:78, d:[
    'M0 6H3.4V15.4H0Z M2 6H20V8H2Z M2 13.6L20 11V12.8L2 15.4Z',
    'M19 5.6H55V11H19Z M19 11H44V13.4H19Z M22 4H48V5.6H22Z',
    'M55 7.8H70V9.6H55Z M67 7.2H78V10.2H67Z',
    'M25.4 13.2H31L29.4 21.6H24Z', GUARD(31),
    'M38.6 13.2H44.6L47 22.4H41Z'                          // прямой магазин
  ].join(' ')},
  MP7: {w:64, d:[
    'M0 5H2.6V13.4H0Z M1 6H11V7.6H1Z M1 10.4H11V12H1Z',  // выдвижной приклад
    'M10 5H44V13H10Z M13 3.4H40V5H13Z',
    'M44 7.8H55V9.6H44Z M52.6 7.2H64V10.2H52.6Z',
    'M37.6 13H42L42.4 19.6H38Z',                          // сложенная передняя рукоять
    'M18.6 13H25L23.4 24H17Z', GUARD(25)
  ].join(' ')},
  P90: {w:66, d:[
    'M2 10.6Q2 5.4 8 5.4H51V12.6H44Q40 20 31 20H19Q14.4 20 12.6 16H7Q2 15.4 2 10.6Z', // корпус
    'M9 1.8H50V5.4H9Z M33 0H40V1.8H33Z',                 // магазин сверху, прицел
    'M51 7.8H62V9.8H51Z M59 7.2H66V10.4H59Z',
    'M46 5.4H52V12.6H46Z'
  ].join(' ')},
  GLOCK: {w:34, d:'M2 5H30V10H2Z M30 6H32V8.4H30Z M4 10H28V12H4Z M4.6 10H12L9.8 22H2.8Z M12 12H19.4V12.8Q19.4 16 16.2 16H14.2V14.6H16Q17.8 14.6 17.8 12.8H12Z'},
  P250:  {w:34, d:'M2 5H29Q31 5 31 7.4V10H2Z M4 10H28V12H4Z M4.6 10H12.4L10 22H2.8Z M12.4 12H19.6V12.8Q19.6 16 16.4 16H14.4V14.6H16.2Q18 14.6 18 12.8H12.4Z'},
  FIVE7: {w:36, d:'M2 4.4H32V9.6H2Z M32 5.4H34V8H32Z M4 9.6H30V11.8H4Z M5 9.6H12.6L11.4 22.4H4Z M12.6 11.8H20V12.6Q20 15.8 16.8 15.8H14.6V14.4H16.6Q18.4 14.4 18.4 12.6H12.6Z'},
  USP:   {w:48, d:'M2 5H30V10.4H2Z M4 10.4H28V12.4H4Z M4.6 10.4H12L9.8 22H2.8Z M12 12.4H19.4V13.2Q19.4 16.4 16.2 16.4H14.2V15H16Q17.8 15 17.8 13.2H12Z M30 5.4H48V10H30Z'},
  TEC9:  {w:44, d:'M2 5H30V11H2Z M30 6.4H44V9.6H30Z M31 5.6H34V6.4H31Z M3.6 11H10.4L9 21.2H2.4Z M10.4 11H17V11.8Q17 14.8 14 14.8H12.2V13.4H13.8Q15.4 13.4 15.4 11.8H10.4Z M19.6 11H25.4V23.6H19.6Z'},
  DEAGLE:{w:40, d:'M1 3.4H35L38 5.2V10.4H1Z M35 2.4H37V3.4H35Z M4 10.4H30V12.8H4Z M4.4 10.4H13.4L10.6 23H2.4Z M13.4 12.8H21.4V13.6Q21.4 17 18 17H15.6V15.4H17.8Q19.8 15.4 19.8 13.6H13.4Z'},
  KNIFE: {w:56, d:'M0 10.4Q0 9.4 1 9.4H17V15.4H1Q0 15.4 0 14.4Z M17 7.8H20V17H17Z M20 9.4H48Q53 9.6 56 11.8Q52 14.2 47 14.6H20Z'},
  HE:    {w:18, d:'M8 8.2A6.6 7.8 0 1 0 8.01 8.2Z M5 3.4H11V8.6H5Z M11 3.6L16.4 6.2V16H14.8V7.4L11 5.4Z M2.6 2.4H6V4.2H2.6Z'},
  MOLOTOV:{w:16, d:'M4.4 9.4H11.6L13.4 12V24H2.6V12Z M6 4H10V9.6H6Z M7.6 4.2C4 2.6 7 1.2 8.4 0C8.6 1.6 11.8 2.2 9.4 4.2Z'}
};
var KF_MOD = {  // значки после оружия
  smoke:   {w:24, t:"через смок", d:'M5 21A4.6 4.6 0 0 1 4.4 11.8A6.4 6.4 0 0 1 16.4 9A5 5 0 0 1 19.6 21Z'},
  wall:    {w:24, t:"прострел", d:'M9 2H15V22H9Z M0 11H7V13H0Z M17 10.4H24V13.6H17Z M3.6 9.4L7 12L3.6 14.6Z'},
  hs:      {w:20, t:"в голову", e:'M10 1.6A8.4 8.4 0 0 1 18.4 10Q18.4 14.4 15 16.6V21H5V16.6Q1.6 14.4 1.6 10A8.4 8.4 0 0 1 10 1.6Z M5.2 8.4H8.8V12.2H5.2Z M11.2 8.4H14.8V12.2H11.2Z M9 13.8H11L10 16Z'},
  noscope: {w:22, t:"без прицела", e:'M11 3A9 9 0 1 1 10.99 3Z M11 5.6A6.4 6.4 0 1 0 11.01 5.6Z', d:'M2.6 4.4L4.4 2.6L19.4 17.6L17.6 19.4Z'},
  blind:   {w:24, t:"убийца ослеплён", e:'M12 5.4C17.4 5.4 21.4 9.4 23 12C21.4 14.6 17.4 18.6 12 18.6S2.6 14.6 1 12C2.6 9.4 6.6 5.4 12 5.4Z M12 7.6C8.4 7.6 5.4 10 4 12C5.4 14 8.4 16.4 12 16.4S18.6 14 20 12C18.6 10 15.6 7.6 12 7.6Z M12 9A3 3 0 1 1 11.99 9Z', d:'M2.4 3.6L4 2L21.6 19.6L20 21.2Z'},
  flash:   {w:14, t:"ассист флешкой", d:'M7 1.6L8.8 7.4L13.6 5L10.8 9.8L13.6 14.6L8.8 12.2L7 18L5.2 12.2L0.4 14.6L3.2 9.8L0.4 5L5.2 7.4Z'}
};
function kfSvg(ic, cls, title){
  var hpx = 15, wpx = (ic.w*hpx/24).toFixed(1);
  return '<svg class="'+cls+'" viewBox="0 0 '+ic.w+' 24" width="'+wpx+'" height="'+hpx+'" aria-label="'+title+'"><title>'+title+'</title>'+
    (ic.d ? '<path d="'+ic.d+'"/>' : '')+(ic.e ? '<path fill-rule="evenodd" d="'+ic.e+'"/>' : '')+'</svg>';
}
function renderFeed(){
  var el = document.getElementById("killfeed"); if(!el) return;
  el.innerHTML = killfeed.map(function(k){
    if(k.kind === "kill"){
      var W = WEAPONS[k.w], ic = WEAPON_ICON[k.w], wn = W ? W.name : (k.w === "MOLOTOV" ? "молотов" : k.w === "KNIFE" ? "нож" : k.w);
      var h = '<span class="'+k.attTeam.toLowerCase()+'">'+esc(k.att)+'</span>';
      if(k.as) h += '<span class="pl">+</span>'+(k.asFlash ? kfSvg(KF_MOD.flash, "md fl", KF_MOD.flash.t) : '')+'<span class="'+k.attTeam.toLowerCase()+' as">'+esc(k.as)+'</span>';
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
