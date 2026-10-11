// (v263, Б1) Сцена-проверка урона по своим: node src/q.js sim.html "$(cat tools/measure/ff_scene.js)"
// 1) свой стоит между стрелком и врагом — 30 попыток выстрела; 2) свой за врагом чуть в стороне от силуэта врага — 300 попыток;
// 3) HE в 60 px от своего. Печатает HP, сколько выстрелов, кто ранен, киллфид.
freshMatch(3);
for(var t=0; t<4000 && roundState!=="live"; t++) stepTick();
var ct = bots.filter(function(b){ return b.team==="CT"; }), tt = bots.filter(function(b){ return b.team==="T"; });
var S = ct[0], M = ct[1], E = tt[0];
// открытое место: от стрелка вдоль направления с прямой видимостью на 260 px
var x0 = S.x, y0 = S.y, ang = null;
for(var k=0;k<36 && ang===null;k++){ var a=k*Math.PI/18; if(hasLOS(x0,y0,x0+Math.cos(a)*300,y0+Math.sin(a)*300)) ang=a; }
function place(b, d, off){ b.x = b.baseX = b.px = x0+Math.cos(ang)*d - Math.sin(ang)*(off||0); b.y = b.baseY = b.py = y0+Math.sin(ang)*d + Math.cos(ang)*(off||0); b.path=[]; b.curSpeed=0; }
function prep(){ bots.forEach(function(b){ if(b!==S&&b!==M&&b!==E){ b.x=b.baseX=b.px=b.x+5000; } });
  [S,M,E].forEach(function(b){ b.alive=true; b.hp=100; b.armor=true; });
  S.facing = ang; S.contactStreak = 200; S.blindUntil = 0; S.throwUntil = 0; S.planting=false; S.defusing=false; S._fc=null; S._knife=false; S._drawUntil=0; S.curSpeed=0; }
function shots(n){ var fired=0; for(var i=0;i<n;i++){ tick++; S.nextShotTick=0; S.ammo=30; S._reloading=false; S._heat=0; S.lastShotTick=-999; E.hp=100; E.alive=true; tryShoot(S, E, Math.hypot(E.x-S.x,E.y-S.y)); if(S.lastShotTick===tick) fired++; if(!M.alive) break; } return fired; }
var out = {ang:ang};
prep(); place(E, 260, 0); place(M, 130, 0);
var f1 = shots(30); out.mateBetween = {fired:f1, mateHp:M.hp, enemyHp:E.hp};
prep(); place(E, 160, 0); place(M, 230, 12);
var f2 = shots(300); out.mateBehind = {fired:f2, mateHp:M.hp, mateAlive:M.alive, enemyHp:E.hp};
prep(); place(E, 900, 0); place(M, 200, 0);
var he = {type:"he", x:M.x+60, y:M.y, thrower:S, team:"CT", born:tick, trail:[]};
var hp0 = [S.hp, M.hp]; detonate(he); out.he60 = {mateHp:M.hp, shooterHp:S.hp, shooterDist:Math.round(Math.hypot(S.x-he.x,S.y-he.y))};
M.hp = 10; var he2 = {type:"he", x:M.x+60, y:M.y, thrower:S, team:"CT", born:tick, trail:[]}; detonate(he2); out.heKill = {mateAlive:M.alive, shooterMoney:S.money};
out.feed = killfeed.map(function(k){ return k.kind==="kill" ? k.att+" ["+k.w+"] "+k.vic+(k.tk?" (свой)":"") : k.text; });
JSON.stringify(out)
