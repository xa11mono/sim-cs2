// (v264) Панель «войс раунда»: что сказали за раунд, обе команды, цвет — по смыслу фразы. Только вид, на игру не влияет.
// Консоль (все события, #log) — по кнопке Ё / ` (как в CS), на месте панели войса.
var voiceLines = [];
var VOICE_KIND = {death:"death", plant:"bomb", defuse:"bomb", igl:"plan", see:"see", hear:"hear", script:"nade", flash:"nade"};
// старые коллы v166 (voiceLog) — тип по ключу колла
var VOICE_KEYS = {
  bomb: "bomb bombseen bombw bombrot antidef stop pass ninja deflate dffake dfreal covplant fakeplant alldead",
  see:  "clr clz hurt fin eg rpfast mo midback rotread s sh buy antiawp prt afall presave nostop midtake",
  hear: "zoom rl rushm",
  nade: "awps defsmk hesm hesmk hestack hefin pop psm rtflash rtawp sflash early fb tfb dump",
  self: "clutch clutchpos clutchsw tcl tcpp tsave lowhp awpsave awpsaveT midcare rebalOff back cb cov pphold egw",
  plan: "abort allin assist fake fakeworked flank midcover pick reb rebal regroup rgo ppsplit pptime probe saferot solo sv trade upslow rtentry die"
};
var VOICE_KEY_KIND = {};
Object.keys(VOICE_KEYS).forEach(function(k){ VOICE_KEYS[k].split(" ").forEach(function(key){ VOICE_KEY_KIND[key] = k; }); });
function voiceKind(key, text){
  if(/^минус/.test(text)) return "death";
  // (v323, М34) переколл — смена сайта (CT и T): свой цвет
  if(/ПЕРЕКОЛЛ/.test(text) || /^(reb|abort|allin)/.test(String(key))) return "recall";
  // ключ колла = имя + id/зона («hurtCT1», «solo2») — берём самое длинное известное имя в начале
  var k = String(key), best = "";
  for(var name in VOICE_KEY_KIND) if(name.length > best.length && k.lastIndexOf(name, 0) === 0) best = name;
  return VOICE_KEY_KIND[best] || "plan";
}
var VOICE_KIND_T = {recall:"переколл", death:"смерть", see:"вижу врага", hear:"слышу", plan:"план, колл", bomb:"бомба", nade:"граната", self:"о себе"};
function voiceFeed(team, who, text, kind){
  if(typeof document === "undefined") return;
  var sec = roundState === "live" ? Math.max(0, ROUND_TIME_SEC - (simTime - roundStartTime)) : ROUND_TIME_SEC;   // как таймер табло
  var planted = typeof bomb !== "undefined" && bomb && bomb.state === "planted";
  voiceLines.unshift({t: planted ? "💣" : Math.floor(sec/60)+":"+("0"+Math.floor(sec%60)).slice(-2), team: team,
                      who: who && who !== team ? nick(who) : "колл", text: nickify(text), kind: kind});
  if(voiceLines.length > 60) voiceLines.length = 60;
  renderVoice();
}
function renderVoice(){
  var el = document.getElementById("voice"); if(!el) return;
  var body = voiceLines.length ? voiceLines.map(function(v){
    return '<div class="vl '+v.kind+'" title="'+VOICE_KIND_T[v.kind]+'"><span class="vt">'+v.t+'</span><span class="vw '+v.team.toLowerCase()+'">'+esc(v.who)+
      '</span><span class="vx">'+esc(v.text)+'</span></div>';
  }).join("") : '<div class="vl none">в этом раунде ещё никто ничего не сказал</div>';
  el.innerHTML = '<div class="vh">ВОЙС РАУНДА <span>Ё — консоль</span></div>' + body;
}
function toggleConsole(on){
  var lg = document.getElementById("log"), vc = document.getElementById("voice"); if(!lg || !vc) return;
  if(on === undefined) on = lg.style.display !== "block";
  lg.style.display = on ? "block" : "none"; vc.style.display = on ? "none" : "block";
}
if(typeof window !== "undefined") window.addEventListener("keydown", function(e){
  if(e.code !== "Backquote" || e.ctrlKey || e.metaKey || e.altKey) return;
  var tg = e.target && e.target.tagName; if(tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  toggleConsole(); e.preventDefault();
});
function logEvent(text, isKill){
  text = nickify(text);
  events.unshift({t: simTime.toFixed(1), text: text, kill: !!isKill});
  if(events.length > 40) events.length = 40;
  var el = document.getElementById("log");
  el.innerHTML = events.map(function(e){
    return '<div class="ev'+(e.kill?' kill':'')+'">['+e.t+'s] '+e.text+'</div>';
  }).join("");
}
