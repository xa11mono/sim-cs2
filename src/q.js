// (Р2.6) движок — SIM_BROWSER = chromium (по умолчанию) | firefox | webkit: тот же код отпечатка в другом браузере
// (Р2.6, 25.11) браузер закрывается и при ошибке (было: только при успехе — после падения оставались процессы браузера); причина — в stderr
const pw = require('playwright'), ENGINE = process.env.SIM_BROWSER || 'chromium';
(async()=>{ let br, closing = false;   // closing: своё закрытие — не сбой (прогон 324: строка «отключился» после каждого матча)
try {
br=await pw[ENGINE].launch(); br.on('disconnected', ()=>{ if(!closing) console.error('[q] браузер отключился'); });
const pg=await br.newPage(); pg.on('crash', ()=>console.error('[q] страница упала (crash)')); await pg.route(/^https?:/, r=>r.abort());
// (Р5.6, 27.11) виды сборки: SIM_QUERY — строка адреса (?map=… — автономный HTML всех карт); SIM_SERVE — папка варианта B (загрузчик читает пакет
// карты fetch'ем): её файлы отдаются по http://simcs2.local/ (свой маршрут — раньше запрета сети), другой сети нет
const SERVE = process.env.SIM_SERVE, QS = process.env.SIM_QUERY || '', MIME = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json'};
if(SERVE) await pg.route('http://simcs2.local/**', r=>{ const f = require('path').join(SERVE, decodeURIComponent(new URL(r.request().url()).pathname));
  r.fulfill({body: require('fs').readFileSync(f), contentType: MIME[require('path').extname(f)] || 'application/octet-stream'}); });
await pg.goto(SERVE ? 'http://simcs2.local/index.html' + QS : require('url').pathToFileURL(require('path').resolve(process.argv[2])).href + QS); await pg.waitForTimeout(1200);
if(SERVE || QS) await pg.waitForFunction(()=>typeof __ev === 'function', null, {timeout: 180000});   // вид сборки открывает страницу карты не сразу
// (Р2.6) кадр страницы остановлен до кода: в другом движке он успел бы сделать другое число тиков «по часам» до freshMatch; SIM_LIVE_FRAMES=1 — как раньше
if(!process.env.SIM_LIVE_FRAMES) await require('../tools/measure/dv_state.js').stopFrames(pg);
let code=process.argv[3]; if(code.startsWith('@')) code=require('fs').readFileSync(code.slice(1),'utf8');   // (Б2) «@файл»: на Windows длина командной строки ≤ 32 767 знаков
console.log(await pg.evaluate(src=>__ev(src), code));
} catch(e) { console.error('[q] ошибка: ' + (e && e.stack || e)); process.exitCode = 1; }
finally { closing = true; if(br) await br.close().catch(e=>console.error('[q] закрытие: ' + e)); } })();
