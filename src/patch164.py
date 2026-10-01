# v162 шаг 13: библиотека позиций и взглядов про из демок.
# 268 раундов про: где игрок стоит (не в бою) и куда при этом смотрит,
# сгруппировано в точки (CT/T до планта, после планта). Бот на удержании
# встаёт на ближайшую подходящую про-точку и держит про-направление.
import json
PS = open('prolib/pro_spots_min.json').read()
rep("var BAL = {", """var BAL = {
  proSpots: true,     // v162: позиции удержания и направление взгляда — из библиотеки точек про (демки)""")
rep("""function setPost(b, pt, look, hold, tag, spreadIdx){""","""// (v162) ПРО-ТОЧКИ: [x, y, раундов, угол1, доля1, угол2?, доля2?] по слоям "сторона|pre/post"
var PRO_SPOTS = """ + PS + """;
var PSN = {R:120, occ:45, maxOff:1.05};
var PSN_TAGS = /^(anchor|rotator|mid$|set:|clutch|stage|lurkStage|lurk$|awpline|postplant|repos:fallback|repos:back|sitehold|rotateHold|midcover|cts:|stack)/;
function proSnap(b, pt, look, tag){
  if(!PSN_TAGS.test(tag || "")) return null;
  var layer = b.team + "|" + (bomb && bomb.state === "planted" ? "post" : "pre");
  var key = layer+"|"+tag+"|"+Math.round(pt.x/8)+","+Math.round(pt.y/8)+"|"+(look ? Math.round(look.x/40)+","+Math.round(look.y/40) : "");
  if(b._psK === key && b._psR === roundNum && b._psM === matchNum) return b._psV;
  b._psK = key; b._psR = roundNum; b._psM = matchNum; b._psV = null;
  var L = PRO_SPOTS[layer]; if(!L) return null;
  var best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){
    var s = L[i], d = Math.hypot(s[0]-pt.x, s[1]-pt.y); if(d > PSN.R) continue;
    if(!hasLOS(s[0], s[1], pt.x, pt.y) || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && Math.hypot(o.post.x-s[0], o.post.y-s[1]) < PSN.occ; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    var md = 0;
    if(look){ var wa = Math.atan2(look.y-s[1], look.x-s[0]); md = Math.min.apply(null, modes.map(function(m){ return _angOff(m[0], wa); })); if(md > PSN.maxOff) continue; }
    var sc = Math.log(1 + s[2]) - 1.5*d/PSN.R - 0.8*md;
    if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, sp:{m:modes, r:s[2], k:i}}; }
  }
  b._psV = best;
  return best;
}
// взгляд на про-точке: направление, которое там держат про; из двух — ближайшее
// к тому, что команда поручила смотреть (раскладка углов); свежая инфа важнее
function proSpotLook(b){
  var P = b.post.pro; if(!P) return null;
  if(b._lkPick && b._lkPick.fresh && b._lkPt) return null;
  var M = P.m, ref = b._lkPt ? Math.atan2(b._lkPt.y-b.y, b._lkPt.x-b.x) : (b.post.look ? Math.atan2(b.post.look.y-b.post.y, b.post.look.x-b.post.x) : null);
  var S = b._proM;
  if(!S || S.k !== P.k || S.r !== roundNum || tick - S.t > 3*TICK_HZ){
    var bi = 0, bsc = -1e9;
    M.forEach(function(m, i){ var sc = m[1] - (ref === null ? 0 : _angOff(m[0], ref)/Math.PI*0.6); if(sc > bsc){ bsc = sc; bi = i; } });
    if(S && S.k === P.k && S.r === roundNum && S.i !== bi){ var cur = M[S.i]; var curSc = cur ? cur[1] - (ref === null ? 0 : _angOff(cur[0], ref)/Math.PI*0.6) : -1e9; if(curSc > bsc - 0.15) bi = S.i; }
    S = b._proM = {k:P.k, r:roundNum, i:bi, t:tick};
  }
  var a = M[S.i][0];
  return {x: b.x + Math.cos(a)*300, y: b.y + Math.sin(a)*300};
}
function setPost(b, pt, look, hold, tag, spreadIdx){""")
rep("""  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  if(b.post && b.post.id === id) return;""","""  var psn = (BAL.proSpots && hold && pt) ? proSnap(b, pt, look, tag) : null;
  if(psn){ pt = psn.pt; spreadIdx = 0; }
  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  if(b.post && b.post.id === id) return;""")
rep("""  b.post = {id:id, x:x, y:y, look:look||null, hold:hold, tag:tag};
  b.atPost = false;""","""  b.post = {id:id, x:x, y:y, look:look||null, hold:hold, tag:tag};
  if(psn) b.post.pro = psn.sp;
  b.atPost = false;""")
rep("""  if(b._lkPt){ b.lookReason = "look"; return cornerLook(b, b._lkPt) || b._lkPt; }""","""  if(BAL.proSpots && b.atPost && b.post && b.post.pro && !(b.curSpeed > 60*SPD_K)){ var plk = proSpotLook(b); if(plk){ b.lookReason = "pro"; return plk; } }
  if(b._lkPt){ b.lookReason = "look"; return cornerLook(b, b._lkPt) || b._lkPt; }""")
rep("""    if(look && BAL.noWallStare && b.lookReason !== "enemy") look = openLook(b, look);""","""    if(look && BAL.noWallStare && b.lookReason !== "enemy" && b.lookReason !== "pro") look = openLook(b, look);""")
rep("версия 161 · 01.10","версия 162 · 01.10")
# про-точку бот занимает вплотную (у про 60% времени стоя ≤15px от стены), а не "в 34px от неё"
rep("""(d < 10 || onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) : d < 34;""","""(d < 10 || onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) : d < ((BAL.proSpots && b.post.pro) ? 9 : 34);""")
