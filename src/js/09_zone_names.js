// ---- названия зон (редактируются кликом по зоне при включённом слое «зоны») ----
// ZONE_NAMES_BAKED — зашитые в код (присланные через «Экспорт проекта»);
// поверх — правки из этого браузера. Названия только для людей: консоль,
// подписи на карте.
var ZONE_NAMES_BAKED = @@DATA:zone_names.json@@; // из «Экспорт проекта» (сентябрь 2026)
var ZONE_NAMES_KEY = "ancient-live-radar-zonenames-v1";
var ZONE_NAMES = {};
(function(){ for(var k in ZONE_NAMES_BAKED) ZONE_NAMES[k] = ZONE_NAMES_BAKED[k];
  try{ var raw = JSON.parse(localStorage.getItem(ZONE_NAMES_KEY)||"null"); if(raw && typeof raw === "object") for(var k2 in raw){ if(raw[k2]) ZONE_NAMES[k2] = String(raw[k2]).slice(0,32); else delete ZONE_NAMES[k2]; } }catch(e){}
})();
function saveZoneNames(){ try{ localStorage.setItem(ZONE_NAMES_KEY, JSON.stringify(ZONE_NAMES)); }catch(e){} }
var ZONE_DEFAULT_LABEL = {Asite:"сайт A", Bsite:"сайт B", CTspawn:"CT-спавн", Tspawn:"T-спавн"};
function zoneById(id){ for(var i=0;i<ZONEMAP.zones.length;i++) if(ZONEMAP.zones[i].id === id) return ZONEMAP.zones[i]; return null; }
// "Red Room / Red" — первое название основное (его видно на карте и в консоли)
function zoneMainName(raw){ return raw ? String(raw).split("/")[0].trim() : raw; }
// название для людей: своё → стандартное (сайт/спавн) → null
function zoneUserName(id){ if(ZONE_NAMES[id]) return zoneMainName(ZONE_NAMES[id]); var z = zoneById(id); return z && z.name ? (ZONE_DEFAULT_LABEL[z.name]||z.name) : null; }
function zoneIdAt(x, y){ for(var i=0;i<ZONEMAP.zones.length;i++){ if(pointInPoly(x, y, ZONEMAP.zones[i].points)) return ZONEMAP.zones[i].id; } return null; }
// где это на карте — по названию зоны, иначе по ближайшему сайту/спавну.
// from=true — "откуда" (с A), иначе "где" (на A)
function calloutName(x, y, from){
  var zid = zoneIdAt(x, y), zn = zid && zoneMainName(ZONE_NAMES[zid]);
  if(zn) return (from ? "с «" : "на «") + zn + "»";
  var C = [[SITES.A,"на A","с A"],[SITES.B,"на B","с B"],
           [CT_SPAWN,"на CT-спавне","с CT-спавна"],[T_SPAWN,"на T-спавне","с T-спавна"]];
  var best = null, bd = Infinity;
  C.forEach(function(c){ if(!c[0]) return; var d = Math.hypot(c[0].x-x, c[0].y-y); if(d < bd){ bd = d; best = c; } });
  return best ? best[from ? 2 : 1] : "?";
}
function botById(id){ for(var i=0;i<bots.length;i++) if(bots[i].id === id) return bots[i]; return null; }
