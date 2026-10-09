# Тестовая страница войса (шаг 3): игра + кнопка «Тест войса» — сценарный раунд из
# tools/team_log.js прямо на радаре, галочка «войс включён», панель «что думает karrigan».
# python3 tools/team_test_page.py  → voice-test.html (в репо не кладётся, публикуется отдельно)
import subprocess, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
subprocess.run([sys.executable, os.path.join(ROOT, 'src', 'mkpub.py')], check=True, stdout=subprocess.DEVNULL)
s = open(os.path.join(ROOT, 'ancient-radar.html'), encoding='utf-8').read()
s = s.replace('<title>Ancient Live Radar v141</title>', '<title>Тест войса Ancient</title>', 1)

PANEL = '''
<div id="vtBar" style="position:fixed;left:12px;bottom:12px;z-index:50;background:#1b2027;border:1px solid #3a4452;
  border-radius:8px;padding:10px 12px;font:13px system-ui,sans-serif;color:#e6e6e6;max-width:340px;box-shadow:0 4px 16px #0008">
  <div style="font-weight:600;margin-bottom:6px">Тест войса (шаг 3)</div>
  <label style="display:block;margin-bottom:6px"><input type="checkbox" id="vtOn" checked> войс включён (тиммейты слышат фразы)</label>
  <button id="vtRun" style="width:100%;padding:6px">▶ Тестовый раунд</button>
  <div style="opacity:.7;margin-top:6px;line-height:1.35">Фразы — в «Консоли» (светло-зелёные). Не прозвучавшие — галочка «отладка».
  karrigan стоит на CT-спавне и врагов не видит — всё, что он думает, только из войса (и киллфида).</div>
  <div style="margin-top:8px;font-weight:600">karrigan думает:</div>
  <div id="vtBelief" style="font-family:ui-monospace,monospace;font-size:12px;line-height:1.45;white-space:pre">—</div>
</div>
'''
# код теста — внутри области видимости игры (там же, где у сборки тестовый вход __ev)
JS = '''
(function(){
  var VT = null;
  function zc(name){ var z = ZONEMAP.zones.filter(function(z){ return zoneUserName(z.id) === name; })[0], g = knowGraph();
    return snapToWalkable(g.c[z.id].x, g.c[z.id].y) || g.c[z.id]; }
  function go(id, zone, walk){ var b = botById(id), p = zc(zone);
    b.path = buildWaypointPath(b.x, b.y, b.z || 0, p.x, p.y, 0); b.pathIdx = 0; b.walking = !!walk; }
  var origCall = knowCall;
  knowCall = function(b, m){ if(document.getElementById("vtOn").checked) return origCall(b, m); };
  var origLook = posLook;   // сценарный тест: позиции шага 5 не нужны — взгляд и маршруты задаёт тест
  posLook = function(b){ var l = VT && VT.look[b.id]; return l ? {x: l.x, y: l.y, why: "stub"} : origLook(b); };
  var origPosTick = posTick;
  posTick = function(){ if(VT){ bots.forEach(function(b){ delete b.pos; }); return; } origPosTick(); };
  var origStep = stepTick;
  stepTick = function(){
    origStep();
    if(!VT) return;
    if(!VT.started){
      if(roundState !== "live") return;
      VT.started = true; VT.start = tick; VT.R0 = roundNum;
      go("T0", "Mid"); go("CT0", "Mid"); go("T1", "A Main"); go("CT1", "Back Site");
      go("T2", "Lamp Room", true); go("CT2", "Site B"); go("T3", "Dark");
      VT.look = {CT1: zc("A Main"), CT2: zc("Cave")};
      bomb.carrier = botById("T4");
      botById("T1").hp = botById("CT1").hp = botById("CT2").hp = 1e6;
      logEvent("ТЕСТ ВОЙСА: сценарный раунд пошёл (войс " + (document.getElementById("vtOn").checked ? "включён" : "ВЫКЛЮЧЕН") + ")", "round");
      return;
    }
    if(roundNum !== VT.R0){ VT = null; return; }
    var t1 = botById("T1"), ct1 = botById("CT1");
    if(!VT.T1back && t1.alive && (ct1._visible || []).indexOf(t1) >= 0){ go("T1", "T Spawn"); VT.T1back = true; }
    var cr = bomb && bomb.carrier;
    if(cr && tick - VT.start === 30*64){ cr.hp = 1e6; go(cr.id, "B Site"); }
    if(cr && tick - VT.start > 30*64 && !cr.planting && bombSiteAt(cr.baseX, cr.baseY)) bombStartPlant(cr);
    if(tick % 32 === 0) showBelief();
  };
  function showBelief(){
    var b = botById("CT3"), el = document.getElementById("vtBelief");
    if(!b || !b.know){ el.textContent = "—"; return; }
    var L = [];
    for(var k in b.know.enemies){
      var B = b.know.enemies[k], top = null;
      B.hyps.forEach(function(h){ if(!top || h.weight > top.weight) top = h; });
      var where = top.type === "moved_unknown" ? "неизвестно где" : knowZoneName(top.zone);
      L.push((NICKS[k] || k).padEnd(8) + where + "  " + Math.round(top.weight*100) + "%");
    }
    el.textContent = L.length ? L.join("\\n") : "врагов не осталось";
  }
  document.getElementById("vtRun").onclick = function(){
    VT = {look: {}};
    events.length = 0; renderLog("log", true);
    freshMatch(3);
  };
  window.__vtStep = function(n){ for(var i = 0; i < n; i++) stepTick();   // для автопроверки
    return {voice: events.filter(function(e){ return e.kind === "voice"; }).map(function(e){ return e.t + " " + e.text; }).reverse(),
            belief: document.getElementById("vtBelief").textContent}; };
})();
'''
MARK = 'requestAnimationFrame(frame);\n'
assert s.count(MARK) >= 1
s = s.replace(MARK, JS + MARK, 1)
# панель — в начало body, чтобы элементы были до запуска кода
s = PANEL + s
out = os.path.join(ROOT, 'voice-test.html')
open(out, 'w', encoding='utf-8').write(s)
print(out, len(s))
