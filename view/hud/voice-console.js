// [хозяева: logRender, renderVoice, toggleConsole] (v264) Панель «войс раунда»: что сказали за раунд, обе команды, цвет — по смыслу фразы. Только вид, на игру не влияет.
// Консоль (все события, #log) — по кнопке Ё / ` (как в CS), на месте панели войса.
var VOICE_KIND_T = {recall:"переколл", death:"смерть", see:"вижу врага", hear:"слышу", plan:"план, колл", bomb:"бомба", nade:"граната", self:"о себе"};
// (v430) новая фраза появляется плавно (класс in — один раз); бомба во времени — значок C4, а не эмодзи
var HUD_VOICE_SHOWN = typeof WeakSet !== "undefined" ? new WeakSet() : null;
function renderVoice(){
  var el = document.getElementById("voice"); if(!el) return;
  var body = voiceLines.length ? voiceLines.map(function(v){
    var nw = HUD_VOICE_SHOWN && !HUD_VOICE_SHOWN.has(v) ? (HUD_VOICE_SHOWN.add(v), " in") : "";
    return '<div class="vl '+v.kind+nw+'" title="'+VOICE_KIND_T[v.kind]+'"><span class="vt">'+(v.t === "💣" ? hudC4() : v.t)+'</span><span class="vw '+v.team.toLowerCase()+'">'+esc(v.who)+
      '</span><span class="vx">'+esc(v.text)+'</span></div>';
  }).join("") : '<div class="vl none">в этом раунде ещё никто ничего не сказал</div>';
  el.innerHTML = '<div class="vh">Войс раунда <span><kbd>Ё</kbd>консоль</span></div>' + body;
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
// (15.11, перестройка: показ отдельно от симуляции) симуляция только ставит «есть новое», кадр рисует — VOICE_DIRTY / LOG_DIRTY
function logRender(){
  var el = document.getElementById("log"); if(!el) return;
  el.innerHTML = events.map(function(e){
    return '<div class="ev'+(e.kill?' kill':'')+'">['+e.t+'s] '+e.text+'</div>';
  }).join("");
}
