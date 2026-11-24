// Broadcast HUD skins (presentation only). No simulation state is read or modified.
(function(){
  var KEY = "sim-broadcast-hud";
  var ALLOWED = {pgl:1, blast:1, esl:1, iem:1};
  var DEFAULT = "esl";
  function apply(value, persist){
    value = ALLOWED[value] ? value : DEFAULT;
    if(document.body) document.body.setAttribute("data-broadcast-hud", value);
    var select = document.getElementById("selBroadcastHud");
    if(select && select.value !== value) select.value = value;
    if(persist){
      try { localStorage.setItem(KEY, value); } catch(e) {}
    }
  }
  var initial = DEFAULT;
  try {
    var saved = localStorage.getItem(KEY);
    if(saved && ALLOWED[saved]) initial = saved;
  } catch(e) {}
  apply(initial, false);
  var select = document.getElementById("selBroadcastHud");
  if(select) select.addEventListener("change", function(){ apply(select.value, true); });
})();
