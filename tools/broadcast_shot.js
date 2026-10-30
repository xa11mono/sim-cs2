// (DESIGN.md, 30.10) Снимки трансляции по моментам матча — проверка вида глазами (Better Design, раздел 8: «проверять отрисованное»).
// Матч считается тиками до нужного момента, потом страница идёт сама ~0,8 с (кадры, анимации HUD) и снимается в каждом размере окна.
//   node tools/broadcast_shot.js sim.html <папка> [матчи=3,7,11] [размеры=1920x1080,1366x768] [только=buy_eco,ace,…]
// Моменты: buy_eco (закупка, у T или CT эко / форс), buy_full (закупка, у обеих фулл), live (середина раунда), clutch13 (один против
// троих), clutch11 (тот же раунд — один на один), clutch_win (клатч выигран — конец раунда), ace (пятеро от одного за раунд — конец
// раунда), round_end (первый конец раунда). Каждый — первый найденный в матчах по порядку; не нашёлся — в отчёте «нет».
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, out, mS, vS, onlyS] = process.argv;
  const matches = (mS || '3,7,11').split(',').map(Number);
  const views = (vS || '1920x1080,1366x768').split(',').map(s => s.split('x').map(Number));
  fs.mkdirSync(out, {recursive: true});
  const br = await chromium.launch(); const pg = await br.newPage({viewport: {width: views[0][0], height: views[0][1]}});
  await pg.route(/^https?:/, q=>q.abort());
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1500);
  const ALL = ['buy_eco', 'buy_full', 'live', 'clutch13', 'clutch11', 'clutch_win', 'ace', 'round_end'];
  const want = onlyS ? onlyS.split(',') : ALL, got = {};
  ALL.forEach(k => { if (want.indexOf(k) < 0) got[k] = 'пропущен'; });
  const shoot = async (name, info) => {
    await pg.evaluate(() => window.__ev('paused = false; 1'));
    await pg.waitForTimeout(800);
    await pg.evaluate(() => window.__ev('paused = true; 1'));
    for (const [w, h] of views) {
      await pg.setViewportSize({width: w, height: h}); await pg.waitForTimeout(350);
      await pg.screenshot({path: path.join(out, name + '_' + w + 'x' + h + '.png')});
    }
    await pg.setViewportSize({width: views[0][0], height: views[0][1]});
    got[name] = info;
  };
  for (const m of matches) {
    if (want.every(k => got[k])) break;
    await pg.evaluate(m => window.__ev('(' + function(m){ paused = true; freshMatch(m); if(typeof WARM !== "undefined") WARM.on = false; return 1; } + ')(' + m + ')'), m);
    for (let guard = 0; guard < 400; guard++) {
      // шаг поиска: тики до следующего интересного момента (в странице), ответ — какой момент наступил
      const r = await pg.evaluate(gotS => window.__ev('(' + function(got){
        var M0 = matchNum, n = 0, buy = function(){ return roundState === "freeze"; };
        var CL = window.__bsCl || (window.__bsCl = {});
        if(!window.__bsEnd){ window.__bsEnd = true; var oer = endRound; endRound = function(w){ window.__bsWin = w; window.__bsAce = bots.some(function(b){ return (b.roundKills||0) >= 5; }); return oer.apply(this, arguments); }; }
        while(n++ < 64*40){
          var st0 = roundState; window.__bsWin = null;
          stepTick();
          if(matchNum !== M0 || roundState === "matchover") return {end:true};
          if(st0 === "live" && roundState === "ending"){
            if(!got.ace && window.__bsAce) return {k:"ace", info:"раунд "+roundNum};
            if(!got.clutch_win && CL.r === roundNum && window.__bsWin === CL.side) return {k:"clutch_win", info:"раунд "+roundNum+" ("+CL.side+")"};
            if(!got.round_end) return {k:"round_end", info:"раунд "+roundNum+", победа "+window.__bsWin};
          }
          var a = {T: aliveCount("T"), CT: aliveCount("CT")};
          if(buy() && simTime > roundStartTime - 6){
            var tt = teamEco.T.roundType, ct = teamEco.CT.roundType;
            if(!got.buy_eco && (tt === "eco" || ct === "eco" || tt === "force" || ct === "force")) return {k:"buy_eco", info:roundNum+": T "+tt+", CT "+ct};
            if(!got.buy_full && tt === "full" && ct === "full") return {k:"buy_full", info:roundNum+": фулл / фулл"};
            window.__bsBuy = (window.__bsBuy || 0) + 1;
          }
          if(roundState !== "live") continue;
          if(!got.live && simTime > roundStartTime + 25 && a.T + a.CT >= 8) return {k:"live", info:"раунд "+roundNum};
          var side = a.T === 1 ? "T" : a.CT === 1 ? "CT" : null, foe = side === "T" ? "CT" : "T";
          if(side && a[foe] === 3 && CL.r !== roundNum){ CL.r = roundNum; CL.side = side; CL.won = null; if(!got.clutch13) return {k:"clutch13", info:"раунд "+roundNum+", 1 против 3 ("+side+")"}; }
          if(CL.r === roundNum && side === CL.side && a[foe] === 1 && !got.clutch11 && got.clutch13) return {k:"clutch11", info:"раунд "+roundNum};
        }
        return {};
      } + ')(' + JSON.stringify(gotS) + ')'), got);
      if (r.end) break;
      if (r.k) await shoot(r.k, r.info);
      if (want.every(k => got[k])) break;
    }
  }
  const rep = {found: got, missing: want.filter(k => !got[k]), errors: errs.slice(0, 5)};
  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep));
  await br.close();
})();
