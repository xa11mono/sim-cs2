// (v459) Проверка повтора клатча глазами: матч перематывается до нужного раунда, раунд проигрывается тиками с записью для повтора
// (как кадры страницы, только быстрее), дальше страница идёт сама — снимки экрана каждые <шаг> мс.
//   node tools/clutch_replay_shot.js sim.html <матч> <раунд> <папка> [шаг_мс=900] [сколько=24] [ширина=1600] [высота=900] [режим=both]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, m, r, out, stepS, nS, wS, hS, modeS] = process.argv;   // режим: auto / both / clip / emo
  const step = +(stepS||900), n = +(nS||24), W = +(wS||1600), H = +(hS||900);
  fs.mkdirSync(out, {recursive: true});
  const br = await chromium.launch(); const pg = await br.newPage({viewport: {width: W, height: H}});
  await pg.route(/^https?:/, q=>q.abort());
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1500);
  const info = await pg.evaluate(([m, r, md]) => window.__ev('(' + function(m, r, md){
    paused = true; freshMatch(m); RP.enabled = true; RP.mode = md;
    var M0 = matchNum, guard = 0;
    while(matchNum === M0 && !(roundNum === r && roundState === "live") && guard++ < 2e6) stepTick();
    // раунд — тиками, после каждого — запись, как после кадра страницы
    guard = 0;
    while(matchNum === M0 && roundNum === r && guard++ < 2e5){ stepTick(); rpRecord(); if(RP.pending || roundState !== "live") break; }
    for(var i = 0; i < 8; i++){ stepTick(); rpRecord(); }   // хвост после конца раунда
    paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
    var R = RP.last;
    return JSON.stringify({round: roundNum, state: roundState, pending: !!RP.pending, clutch: R && R.clutch, list: R && R.list, kills: R ? R.kills.length : 0, samples: R ? R.s.length : 0,
      segs: R && R.clutch ? rpBuild(R).segs.map(function(s){ return [s.a, s.b, s.m.map(function(q){ return q.kind; }).join(",")]; }) : null});
  } + ')(' + m + ',' + r + ',"' + md + '")'), [+m, +r, modeS || 'both']);
  console.log(info); fs.writeFileSync(path.join(out, 'info.txt'), info + '\n');
  for(let i = 0; i < n; i++){ await pg.waitForTimeout(step); await pg.screenshot({path: path.join(out, 'rp_' + String(i).padStart(2, '0') + '.png')}); }
  if(errs.length){ console.log('ОШИБКИ:', errs.slice(0, 5).join('\n')); fs.appendFileSync(path.join(out, 'info.txt'), 'ОШИБКИ:\n' + errs.join('\n') + '\n'); }
  await br.close();
})();
