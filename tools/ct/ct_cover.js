// Расстановки CT: какие входы T закрыты взглядом — у про (демки) и у наших расстановок (владелец 15.11: «точки в паре, чтобы смотрели все
// зоны, из которых могут выходить T; чтобы видели, а не стояли за стенками»). Только наблюдает: игру и набор карты не меняет.
//   node tools/ct/ct_cover.js sim.html <про.json из tools/ct/ct_cover_pro.py> <out.json> [раундов на расстановку=3] [матч=3]
// Вход T — проход между зоной стороны T и соседней зоной стороны CT (BZ.portal). Сторона зоны — по демкам: к 20-й с там CT не реже T.
// «Закрыт» — та же мерка, что «команда видит проход» в игре (portalWatched, 260): ближе 90 px, или в конусе взгляда (inFov) не дальше
// CONE_R·1,4 и виден (hasVision). Для ботов — места и взгляд CT в тот же момент раунда (20 с от начала), каждая расстановка по очереди.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [,, sim, proF, outF, nR, mS] = process.argv;
  const PRO = JSON.parse(fs.readFileSync(proF, 'utf8'));
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1000);
  const rep = await pg.evaluate(([PRO, nR, M]) => __ev(`(function(PRO, NR, M){
    if(!BZ.portal) bzPortals();
    var AT = PRO.at;
    // сторона зон — по про
    var cnt = BZ.ids.map(function(){ return {ct: 0, t: 0}; });
    PRO.rounds.forEach(function(r){ r.ct.forEach(function(p){ var z = bzOf(p[0], p[1]); if(z >= 0) cnt[z].ct++; });
      r.t.forEach(function(p){ var z = bzOf(p[0], p[1]); if(z >= 0) cnt[z].t++; }); });
    var side = cnt.map(function(c){ return c.ct + c.t === 0 ? null : (c.ct >= c.t ? "CT" : "T"); });
    var ENT = [];
    BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js; if(side[i] === "T" && side[j] === "CT"){ var p = row[j];
      ENT.push({i: i, j: j, x: p.x, y: p.y, from: zoneUserName(BZ.ids[i]) || BZ.ids[i], to: zoneUserName(BZ.ids[j]) || BZ.ids[j]}); } } });
    var seesP = function(o, p){ var d = Math.hypot(p.x-o.x, p.y-o.y); if(d < 90) return true;
      return d < CONE_R*1.4 && inFov(o, p.x, p.y) && hasVision(o.x, o.y, p.x, p.y); };
    var cover = function(cts){ return ENT.map(function(e){ var w = cts.filter(function(o){ return seesP(o, e); }).map(function(o){ return o.id; }); return w; }); };
    // про: доля раундов структуры, где вход закрыт, и сколько CT его видят
    var PS = {};
    PRO.rounds.forEach(function(r){ var S = PS[r.st] || (PS[r.st] = {n: 0, c: ENT.map(function(){ return 0; }), two: ENT.map(function(){ return 0; })}); S.n++;
      var cts = r.ct.map(function(p, k){ return {id: "p"+k, x: p[0], y: p[1], facing: p[3]}; });
      cover(cts).forEach(function(w, k){ if(w.length) S.c[k]++; if(w.length >= 2) S.two[k]++; }); });
    // боты: каждая расстановка по очереди
    var ALL = MAP.tactics.ctSetups.slice(), BOT = [];
    ALL.forEach(function(S){
      MAP.tactics.ctSetups.length = 0; MAP.tactics.ctSetups.push(S);
      freshMatch(M); var got = 0, guard = 0;
      while(got < NR && roundState !== "matchover" && guard++ < 400000){
        stepTick();
        if(roundState !== "live" || !(teamTac.CT && teamTac.CT.setup && teamTac.CT.setup.id === S.id)) continue;
        if(simTime - roundStartTime < AT) continue;
        var cts = bots.filter(function(b){ return b.alive && b.team === "CT"; });
        BOT.push({setup: S.id, name: S.name, round: roundNum, alive: cts.length,
          ct: cts.map(function(b){ return {id: b.id, x: Math.round(b.x), y: Math.round(b.y), f: +(b.facing||0).toFixed(3), tag: b.post ? b.post.tag : null,
            zone: zoneUserName(zoneIdAt(b.x, b.y)), seen: b._sawEnemy ? 1 : 0, why: b.lookReason || null, lvl: b._lookLvl || 0,
            pl: b.post && b.post.look ? +Math.atan2(b.post.look.y - b.y, b.post.look.x - b.x).toFixed(3) : null}; }),
          cov: cover(cts)});
        got++; var R0 = roundNum; while(roundNum === R0 && roundState !== "matchover") stepTick();
      }
    });
    MAP.tactics.ctSetups.length = 0; ALL.forEach(function(S){ MAP.tactics.ctSetups.push(S); });
    return {ent: ENT, pro: PS, bot: BOT};
  })(` + JSON.stringify(PRO) + `, ` + nR + `, ` + M + `)`), [PRO, +(nR || 3), +(mS || 3)]);
  fs.writeFileSync(outF, JSON.stringify(rep));
  await br.close();
  console.log('входов', rep.ent.length, 'про-структур', Object.keys(rep.pro).length, 'снимков ботов', rep.bot.length);
})();
