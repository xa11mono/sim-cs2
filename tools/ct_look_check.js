// (v421) Проверка взглядов расстановок CT набора карты (MAP.tactics.ctSetups) — той же логикой, что в игре (140_named_spots_ct_setup.js:
// место роли = pickSpots у zonePoint(pos), точка взгляда = lookPt из демок или zonePoint(look); видимость — hasLOS, 3D, без дыма).
// Только наблюдает: игру и набор карты не меняет. Вызывается шагом checklooks из tools/map_build.py, можно и отдельно:
//   node tools/ct_look_check.js sim.html out.json
// Что считается ошибкой:
//   zone   — взгляд задан только именем зоны (нет lookPt): точка берётся рядом с ботом, направление может потеряться (М153, v417)
//   wall   — с лучшего из мест роли обзор по направлению взгляда закрыт ближе WALL_OPEN (смотрит в стену вплотную)
//   far    — замечание, не ошибка: направление открыто, но сама точка взгляда за препятствием (точка из демок — на стене или за углом)
//   nozone — позиция или взгляд не нашлись среди зон карты
//   nospot — у позиции не нашлось места (pickSpots пустой)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(1500);
  const rep = await pg.evaluate(() => __ev(`(function(){
    var WALL_OPEN = 150;   // проектное число: радиус выбора места у позиции (pickSpots rMax 150)
    var out = [], saveTeam = SPOT_TEAM; SPOT_TEAM = "CT";
    (MAP.tactics.ctSetups || []).forEach(function(S){
      Object.keys(S.roles || {}).forEach(function(role){
        var R = S.roles[role];
        [["", R], ["early", R.early]].forEach(function(v){
          var P = v[1]; if(!P || !P.pos) return;
          var ref = role === "anchorA" ? GEO.A.anchor : role === "anchorB" ? GEO.B.anchor : GEO.ctMid;
          var hide = R.hideFrom === false ? [] : [GEO.tMid];
          P.pos.forEach(function(nm){
            var row = {setup: S.id, name: S.name, role: role, phase: v[0], pos: nm, look: P.look || null, lookPt: P.lookPt || null, issues: []};
            if(P.look && !P.lookPt) row.issues.push("zone");
            var c = zonePoint(nm, ref);
            if(!c){ row.issues.push("nozone"); out.push(row); return; }
            var lk = (P.lookPt && {x: P.lookPt[0], y: P.lookPt[1]}) || (P.look && zonePoint(P.look, c)) || ref;
            if(P.look && !P.lookPt && !zonePoint(P.look, c)) row.issues.push("nozone");
            var spots = pickSpots("cts:"+S.id+":"+role+":"+nm, c, 3, {rMax:150, minGap:45, see:[lk], hideFrom:hide});
            row.at = {x: Math.round(c.x), y: Math.round(c.y)}; row.lk = {x: Math.round(lk.x), y: Math.round(lk.y)};
            if(!spots.length){ row.issues.push("nospot"); out.push(row); return; }
            // открытый обзор по направлению взгляда: от места к точке шагами по 5 % пути, до первого закрытого шага (лучшее из мест роли)
            row.open = 0; row.seen = 0; row.spots = spots.length;
            spots.forEach(function(s){
              var d = Math.hypot(lk.x-s.x, lk.y-s.y), f = 0;
              while(f < 1 && hasLOS(s.x, s.y, s.x+(lk.x-s.x)*(f+0.05), s.y+(lk.y-s.y)*(f+0.05))) f = Math.min(1, f+0.05);
              if(f >= 1) row.seen++;
              if(row.dist == null || f*d > row.open){ row.open = Math.round(f*d); row.dist = Math.round(d); }   // лучшее место: обзор и его дальность
            });
            if(row.open < WALL_OPEN && row.open < row.dist) row.issues.push("wall");
            else if(!row.seen) row.issues.push("far");
            out.push(row);
          });
        });
      });
    });
    SPOT_TEAM = saveTeam; return out;
  })()`));
  fs.writeFileSync(process.argv[3], JSON.stringify({map: await pg.evaluate(() => __ev("MAP.id")), rows: rep}, null, 1) + '\n');
  await br.close();
})();
