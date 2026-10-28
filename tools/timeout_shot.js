// (v460) Проверка показа тактической паузы глазами: матч перематывается тиками до закупки раунда <раунд> (пауза перед ним —
// закупка +30 с), дальше страница идёт сама — снимки экрана каждые <шаг> мс.
//   node tools/timeout_shot.js sim.html <матч> <раунд> <папка> [шаг_мс=1000] [сколько=34] [ширина=1600] [высота=900]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, m, r, out, stepS, nS, wS, hS] = process.argv;
  const step = +(stepS||1000), n = +(nS||34), W = +(wS||1600), H = +(hS||900);
  fs.mkdirSync(out, {recursive: true});
  const br = await chromium.launch(); const pg = await br.newPage({viewport: {width: W, height: H}});
  await pg.route(/^https?:/, q=>q.abort());
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1500);
  const info = await pg.evaluate(([m, r]) => window.__ev('(' + function(m, r){
    paused = true; freshMatch(m);
    var M0 = matchNum, guard = 0;
    while(matchNum === M0 && !(roundNum === r && roundState === "freeze") && guard++ < 2e6) stepTick();
    paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
    return JSON.stringify({round: roundNum, state: roundState, pause: TO_NOW ? {side: TO_NOW.side, name: TO_NOW.name, caller: TO_NOW.caller, left: TO_NOW.left, facts: TO_NOW.plan.facts.map(function(f){ return f.log; })} : null,
      freeze: Math.round(roundStartTime - simTime)});
  } + ')(' + m + ',' + r + ')'), [+m, +r]);
  console.log(info); fs.writeFileSync(path.join(out, 'info.txt'), info + '\n');
  for(let i = 0; i < n; i++){ await pg.waitForTimeout(step); await pg.screenshot({path: path.join(out, 'to_' + String(i).padStart(2, '0') + '.png')}); }
  if(errs.length){ console.log('ОШИБКИ:', errs.slice(0, 5).join('\n')); fs.appendFileSync(path.join(out, 'info.txt'), 'ОШИБКИ:\n' + errs.join('\n') + '\n'); }
  await br.close();
})();
