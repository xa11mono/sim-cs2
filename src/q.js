// (Р2.6) движок — SIM_BROWSER = chromium (по умолчанию) | firefox | webkit: тот же код отпечатка в другом браузере
const pw = require('playwright'), ENGINE = process.env.SIM_BROWSER || 'chromium';
(async()=>{ const br=await pw[ENGINE].launch(); const pg=await br.newPage(); await pg.route(/^https?:/, r=>r.abort());
await pg.goto(require('url').pathToFileURL(require('path').resolve(process.argv[2])).href); await pg.waitForTimeout(1200);
// (Р2.6) кадр страницы остановлен до кода: в другом движке он успел бы сделать другое число тиков «по часам» до freshMatch; SIM_LIVE_FRAMES=1 — как раньше
if(!process.env.SIM_LIVE_FRAMES) await require('../tools/measure/dv_state.js').stopFrames(pg);
let code=process.argv[3]; if(code.startsWith('@')) code=require('fs').readFileSync(code.slice(1),'utf8');   // (Б2) «@файл»: на Windows длина командной строки ≤ 32 767 знаков
console.log(await pg.evaluate(src=>__ev(src), code)); await br.close(); })();
