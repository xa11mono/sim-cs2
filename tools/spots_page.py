#!/usr/bin/env python3
"""Страница для глаз: библиотека мест (src/data/spots.json) на радаре.
python3 tools/spots_page.py <выходной.html>"""
import base64, json, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
S = json.load(open(os.path.join(ROOT, 'src', 'data', 'spots.json')))
PNG = base64.b64encode(open(os.path.join(ROOT, 'src', 'data', 'radar.png'), 'rb').read()).decode()
HTML = r"""<title>Места из демок Ancient</title>
<style>
/* layout: радар слева во всю высоту, справа узкая колонка фильтров и карточки места */
:root{--bg:#eef0f2;--panel:#ffffff;--fg:#1d2329;--mute:#5d6872;--line:#d3d8dd;--ct:#2f7fd8;--t:#d9902a;--sel:#c2185b;
 --f-ui:"IBM Plex Sans",system-ui,sans-serif;--f-num:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14181c;--panel:#1c2227;--fg:#e4e8ec;--mute:#93a0ab;--line:#2c343b;--ct:#5aa5ff;--t:#f0a640;--sel:#ff5c9a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14181c;--panel:#1c2227;--fg:#e4e8ec;--mute:#93a0ab;--line:#2c343b;--ct:#5aa5ff;--t:#f0a640;--sel:#ff5c9a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--f-ui);padding-inline:16px;padding-block:16px}
.wrap{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;max-width:1240px;margin:0 auto}
@media (max-width:820px){.wrap{grid-template-columns:minmax(0,1fr)}}
.map{background:#0d1013;border-radius:6px;overflow:hidden;position:relative}
canvas{display:block;width:100%;height:auto;cursor:crosshair}
aside{display:flex;flex-direction:column;gap:14px;min-width:0}
h1{font-size:18px;margin:0;text-wrap:balance}
.sub{color:var(--mute);font-size:13px;line-height:1.45;margin:0}
fieldset{border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin:0;background:var(--panel)}
legend{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);padding:0 4px}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opts label{display:flex;align-items:center;gap:5px;font-size:13px;padding:3px 8px;border:1px solid var(--line);border-radius:999px;cursor:pointer}
.opts input{margin:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-size:13px;line-height:1.5;min-height:120px}
.card b{font-weight:600}
.num{font-family:var(--f-num);font-variant-numeric:tabular-nums}
.count{font-family:var(--f-num);font-size:12px;color:var(--mute)}
.key{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--mute)}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:-1px;margin-right:4px}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap">
<div class="wrap">
 <div class="map"><canvas id="cv" width="1024" height="1024"></canvas></div>
 <aside>
  <div><h1>Места из демок · Ancient</h1>
  <p class="sub">Где про стоят и держат угол (не бегут, не в бою, врага не видят). Стрелки — 1–2 частых направления взгляда, толщина — доля времени. Размер точки — сколько раз там стояли.</p></div>
  <fieldset><legend>Сторона</legend><div class="opts" id="fSide"></div></fieldset>
  <fieldset><legend>Фаза</legend><div class="opts" id="fPhase"></div></fieldset>
  <fieldset><legend>Район</legend><div class="opts" id="fArea"></div></fieldset>
  <div class="count" id="cnt"></div>
  <div class="card" id="card">Наведи или нажми на точку — здесь будет, что это за место.</div>
  <div class="key"><span><span class="dot" style="background:var(--ct)"></span>CT</span><span><span class="dot" style="background:var(--t)"></span>T</span></div>
 </aside>
</div>
<script>
var D=@@DATA@@, IMG=new Image(); IMG.src="data:image/png;base64,@@PNG@@";
var PH={pre:"до выхода / до планта",post:"после планта (T)",retake:"ретейк (CT)"}, AR={A:"A",M:"мид",B:"B","":"вне районов"};
function opts(id,vals,lab){var el=document.getElementById(id);vals.forEach(function(v){var l=document.createElement("label");l.innerHTML='<input type="checkbox" id="'+id+'_'+(v||"x")+'" checked> '+lab(v);l.firstChild.dataset.v=v;l.firstChild.addEventListener("change",draw);el.appendChild(l);});}
opts("fSide",["CT","T"],function(v){return v});opts("fPhase",["pre","post","retake"],function(v){return PH[v]});opts("fArea",["A","M","B",""],function(v){return AR[v]});
function on(id){return Array.prototype.filter.call(document.querySelectorAll("#"+id+" input"),function(i){return i.checked}).map(function(i){return i.dataset.v})}
var cv=document.getElementById("cv"),ctx=cv.getContext("2d"),vis=[],sel=null,hov=null;
function col(p){return getComputedStyle(document.documentElement).getPropertyValue(p.side==="CT"?"--ct":"--t").trim()}
function draw(){var s=on("fSide"),ph=on("fPhase"),ar=on("fArea");
 vis=D.spots.filter(function(p){return s.indexOf(p.side)>=0&&ph.indexOf(p.phase)>=0&&ar.indexOf(p.area)>=0});
 document.getElementById("cnt").textContent="показано мест: "+vis.length+" из "+D.spots.length+" · демок "+D.demos+" · стояний "+D.segs;
 ctx.clearRect(0,0,1024,1024);ctx.globalAlpha=0.75;if(IMG.complete)ctx.drawImage(IMG,0,0,1024,1024);ctx.globalAlpha=1;
 var selc=getComputedStyle(document.documentElement).getPropertyValue("--sel").trim();
 vis.forEach(function(p){var c=col(p),x=p.x/2,y=p.y/2,hl=p===sel||p===hov;
  p.looks.forEach(function(l){var a=Math.atan2(l.y-p.y,l.x-p.x),L=hl?Math.min(140,Math.hypot(l.x-p.x,l.y-p.y)/2):26;
   ctx.strokeStyle=hl?selc:c;ctx.lineWidth=1+3*l.w;ctx.beginPath();ctx.moveTo(x,y);var ex=x+Math.cos(a)*L,ey=y+Math.sin(a)*L;ctx.lineTo(ex,ey);ctx.stroke();
   ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-Math.cos(a-0.45)*6,ey-Math.sin(a-0.45)*6);ctx.lineTo(ex-Math.cos(a+0.45)*6,ey-Math.sin(a+0.45)*6);ctx.closePath();ctx.fillStyle=hl?selc:c;ctx.fill();});
  ctx.beginPath();ctx.arc(x,y,2.5+Math.min(5,Math.sqrt(p.n)),0,7);ctx.fillStyle=hl?selc:c;ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle="#0b0d10";ctx.stroke();
  if(p.phase!=="pre"){ctx.beginPath();ctx.arc(x,y,4.5+Math.min(5,Math.sqrt(p.n)),0,7);ctx.strokeStyle=hl?selc:c;ctx.lineWidth=1;ctx.stroke();}});
 card(sel||hov);}
function card(p){var el=document.getElementById("card");if(!p){el.innerHTML="Наведи или нажми на точку — здесь будет, что это за место.";return}
 el.innerHTML="<b>"+p.side+" · "+(p.zone||"?")+"</b><br>район: "+AR[p.area]+"<br>фаза: "+PH[p.phase]+
 "<br>стояли: <span class='num'>"+p.n+"</span> раз в <span class='num'>"+p.m+"</span> матчах, всего <span class='num'>"+p.sec+"</span> с"+
 "<br>обычно с <span class='num'>"+p.t+"</span>-й секунды раунда"+
 p.looks.map(function(l,i){return "<br>взгляд "+(i+1)+": <span class='num'>"+Math.round(l.w*100)+"%</span> времени"}).join("")+"<br><span class='count'>"+p.id+" · x "+p.x+" y "+p.y+"</span>";}
function pick(e){var r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*2048,y=(e.clientY-r.top)/r.height*2048,b=null,bd=28;
 vis.forEach(function(p){var d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;b=p}});return b}
cv.addEventListener("mousemove",function(e){var p=pick(e);if(p!==hov){hov=p;draw()}});
cv.addEventListener("click",function(e){sel=pick(e);draw()});
IMG.onload=draw;draw();
</script>
"""
open(sys.argv[1], 'w').write(HTML.replace('@@DATA@@', json.dumps(S, ensure_ascii=False)).replace('@@PNG@@', PNG))
