// ---------- (v566, владелец 12.11: «как разбор взгляда — для закупов, расстановок, клатчей: почему так играют, зачем») разбор команды ----------
// Только показ: читает, что уже решили механики (закуп 520 — buyWhy / ecoWhy / roundGoal; тактика T 130 — TACT_DBG; продолжение / переколы
// IGL 160 / 170 — tt.open / tt.recalls / журнал TEAMDBG; расстановка CT 140 — CTSET_DBG; колл CT 340 — ct.call; концовка 330 / 320). Игру не меняет.
var TEAMDBG = {on: false, round: -1, log: []};
var chkTeamDbg = typeof document !== "undefined" ? document.getElementById("chkTeamDbg") : null;
var teamDbgEl = null;
if(typeof document !== "undefined"){ teamDbgEl = document.createElement("div"); teamDbgEl.id = "teamDbg"; document.body.appendChild(teamDbgEl); }
if(chkTeamDbg) chkTeamDbg.addEventListener("change", function(){ TEAMDBG.on = chkTeamDbg.checked; teamDbgEl.style.display = TEAMDBG.on ? "block" : "none"; teamDbgPanel(true); });
var TD_BUY = {pistol:"пистолетка", eco:"эко", force:"форс", half:"хаф-бай", full:"фулл"};
var TD_STYLE = {default:"дефолт", exec:"выход", split:"сплит", fake:"фейк", rush:"раш", fast:"быстрый выход"};
function tdEsc(t){ return String(t == null ? "" : t).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
function tdPct(v, tot){ return tot > 0 ? Math.round(100*v/tot) + " %" : "—"; }
function tdTeamBuy(team){
  var te = teamEco[team] || {}, mates = bots.filter(function(b){ return b.team === team; });
  var avg = mates.length ? Math.round(mates.reduce(function(a, b){ return a + b.money; }, 0)/mates.length) : 0;
  var g = typeof roundGoal === "function" ? roundGoal(team) : null, E = te.enemyGuess;
  return '<div class="ld-s"><div class="ld-k">' + team + ' (' + tdEsc(TEAM_NAME[team]) + ') — ' + tdEsc(TD_BUY[te.roundType] || te.roundType || "—") + '</div>' +
    '<div>' + tdEsc(te.ecoWhy || te.buyWhy || "") + '</div>' +
    '<div class="ld-f">осталось после закупа в среднем $' + avg + ' · лосс-бонус ступень ' + (te.lossLevel != null ? te.lossLevel : "—") +
    (E ? ' · закуп соперника (оценка): ' + (E.eco ? "эко" : E.full ? "фулл" : "непонятно") : '') + '</div>' +
    (g ? '<div class="ld-f">цель раунда: ' + tdEsc(GOAL_NAME[g] || g) + '</div>' : '') + '</div>';
}
function tdTactic(){
  var tt = teamTac.T, D = TACT_DBG, h = [];
  if(!tt || !tt.tac) return '<div class="ld-s ld-f">Тактики T ещё нет (закупка).</div>';
  var open = tt.open && tt.open.id !== tt.tac.id ? tt.open : null, sec = function(t){ return t != null ? Math.round((t - roundStartTick)/TICK_HZ) + " с" : "—"; };
  h.push('<div class="ld-s"><div class="ld-k">Тактика T</div>' + (open ? tdEsc(open.name) + ' → <b>' + tdEsc(tt.tac.name) + '</b> <span class="ld-f">(продолжение дефолта: IGL выбрал по тому, какие пути держим и где видели CT)</span>' : '<b>' + tdEsc(tt.tac.name) + '</b>') +
    '<div class="ld-f">вид: ' + tdEsc(TD_STYLE[tt.tac.style] || tt.tac.style) + ' · сайт ' + tdEsc(tt.site) + ' · фаза ' + tdEsc(tt.phase) + ' · выход по плану ' + sec(tt.execTick) +
    (tt.defUntil ? ' · дефолт до ' + sec(tt.defUntil) : '') + (tt.execStart != null ? ' · вышли на ' + sec(tt.execStart) : '') + '</div>' +
    (tt.recalls && tt.recalls.length ? '<div class="ld-f">переколы: ' + tt.recalls.map(function(r){ return r.from + " → " + r.to + " на " + r.sec + " с"; }).join(", ") + '</div>' : '') + '</div>');
  if(D && D.round === roundNum){
    var tot = D.list.reduce(function(a, x){ return a + x.w; }, 0), L = D.list.slice().sort(function(a, b){ return b.w - a.w; }).slice(0, 8); if(!L.some(function(x){ return x.id === D.pick; })) L.push(D.list.filter(function(x){ return x.id === D.pick; })[0]);   // выбранный — всегда в списке
    h.push('<div class="ld-s"><div class="ld-k">Из чего выбирали (шанс)</div><table>' + L.map(function(x){
      return '<tr' + (x.id === D.pick ? ' class="pick"' : '') + '><td>' + tdEsc(x.name) + '<div class="ld-f">' + tdEsc(TD_STYLE[x.style] || x.style) + ' · ' + tdEsc(x.site) + (x.mem ? ' · в этом матче заходила ' + tdEsc(x.mem) : '') + '</div></td><td class="ld-n" style="text-align:right">' + tdPct(x.w, tot) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="ld-f">' + (D.fast != null ? 'закуп ' + tdEsc(TD_BUY[D.type] || D.type) + ': раш — ' + Math.round(D.fast*100) + ' % раундов (доля про по закупу), остальное — по частоте тактик и памяти матча' : '') +
      (D.read ? '<br>' + tdEsc(D.read) : '') + (D.tempoRead ? '<br>темп по счёту: ' + (D.tempoRead === "slow" ? "медленнее (проиграли быстрыми)" : "быстрее (проиграли медленными)") : '') +
      (D.plan ? '<br>план паузы тренера: ' + [D.plan.site ? "сайт " + D.plan.site : "", D.plan.tempo ? (D.plan.tempo === "fast" ? "быстро" : "медленно") : "", D.plan.fake ? "фейк" : ""].filter(Boolean).join(", ") + (D.plan.first === roundNum ? " (первый раунд после паузы — отбор по плану)" : " (сдвигает веса)") : '') + '</div></div>');
  }
  return h.join('');
}
function tdCtSetup(){
  var D = CTSET_DBG, cs = teamTac.CT && teamTac.CT.setup, h = [];
  if(!cs) return '';
  h.push('<div class="ld-s"><div class="ld-k">Расстановка CT</div><b>' + tdEsc(cs.name || cs.id) + '</b>' + (CT_SHARE && CT_SHARE.struct && CT_SHARE.struct[cs.id] ? ' <span class="ld-f">(на деле к 20 с: ' + tdEsc(CT_SHARE.struct[cs.id]) + ' — A-мид-B)</span>' : '') + '</div>');
  if(D && D.round === roundNum){
    var tot = D.list.reduce(function(a, x){ return a + x.w; }, 0), L = D.list.slice().sort(function(a, b){ return b.w - a.w; }).slice(0, 8); if(!L.some(function(x){ return x.id === D.pick; })) L.push(D.list.filter(function(x){ return x.id === D.pick; })[0]);   // выбранный — всегда в списке
    h.push('<div class="ld-s"><div class="ld-k">Из чего выбирали (шанс · доля про на этот закуп)</div><table>' + L.map(function(x){
      return '<tr' + (x.id === D.pick ? ' class="pick"' : '') + '><td>' + tdEsc(x.name) + (x.why ? '<div class="ld-f">' + tdEsc(x.why) + '</div>' : '') + '</td><td class="ld-n" style="text-align:right">' + tdPct(x.w, tot) + '</td><td class="ld-n ld-f" style="text-align:right">' + Math.round(x.base*100) + ' %</td></tr>'; }).join('') + '</table>' +
      '<div class="ld-f">основа — как часто у про такая расстановка на закуп «' + tdEsc(TD_BUY[D.buy] || D.buy) + '» (демки); сдвигают — что T делали в прошлых раундах, где проигрывали, память матча, пауза</div></div>');
  }
  var c = teamTac.CT && teamTac.CT.call;
  if(c && c.site) h.push('<div class="ld-s"><div class="ld-k">Колл CT</div>на ' + tdEsc(c.site) + ' ~' + Math.round(c.count*10)/10 + ' T · ' + Math.round((tick - c.tick)/TICK_HZ) + ' с назад' + (c.bombSeen ? ' · бомбу видели' : '') + (c.undefended ? ' · некому держать' : '') + '</div>');
  return h.join('');
}
function tdEnd(){
  if(roundState !== "live") return '';
  var nT = aliveCount("T"), nC = aliveCount("CT"), planted = bomb && bomb.state === "planted", h = [];
  if(nT > 2 && nC > 2) return '';
  var timeFor = planted ? "T (бомба стоит — CT должны идти на дефуз)" : "CT (бомбы нет — T должны идти ставить)";
  var left = planted ? Math.max(0, Math.round((bomb.explodeTick != null ? bomb.explodeTick - tick : 0)/TICK_HZ)) : Math.max(0, Math.round(ROUND_TIME_SEC - (simTime - roundStartTime)));
  h.push('<div class="ld-s"><div class="ld-k">Концовка: ' + nT + ' T на ' + nC + ' CT</div>время на стороне ' + timeFor + ' · осталось ' + left + ' с');
  var ER = teamTac.CT && teamTac.CT._egRoles, hunt = bots.filter(function(b){ return b.alive && b.post && b.post.tag === "endhunt"; });
  if(hunt.length) h.push('<div class="ld-f">охотятся: ' + hunt.map(function(b){ return nick(b.id) + (ER && ER.hunter === b.id ? " (ведёт)" : ""); }).join(", ") + '</div>');
  else if(!planted && nC <= nT) h.push('<div class="ld-f">CT без перевеса — не охотятся, держат подходы к сайтам (время на их стороне)</div>');
  bots.forEach(function(b){ if(b.alive && b._clutch && b._clutch.round === roundNum && b._clutch.site) h.push('<div class="ld-f">клатч ' + nick(b.id) + ': играет ' + tdEsc(b._clutch.site) + '</div>'); });
  h.push('</div>');
  return h.join('');
}
function teamDbgPanel(force){
  if(!TEAMDBG.on || !teamDbgEl) return;
  if(!force && nowTs - (teamDbgPanel._t || 0) < 300) return; teamDbgPanel._t = nowTs;
  var h = ['<div class="ld-h">Разбор команды · раунд ' + roundNum + '</div>'];
  h.push(tdTeamBuy("T"), tdTeamBuy("CT"), tdTactic(), tdCtSetup(), tdEnd());
  var L = TEAMDBG.round === roundNum ? TEAMDBG.log.slice(-14) : [];
  if(L.length) h.push('<div class="ld-s"><div class="ld-k">Решения команд в этом раунде</div><div class="ld-f">' + L.map(function(e){ return e.s + ' с — ' + tdEsc(e.text); }).join('<br>') + '</div></div>');
  teamDbgEl.innerHTML = h.join('');
}
