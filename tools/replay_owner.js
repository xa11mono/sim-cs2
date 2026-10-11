// Повтор матча так, как он шёл у владельца в браузере (v254, 11.10).
// Страница при загрузке берёт из localStorage профиль соперника, слой и формы зон, лайнапы; первый матч
// после загрузки играет с ними (кнопка «Сыграть» профиль сбрасывает). Файл «Экспорт проекта» владельца
// кладётся в это же хранилище, игра открывается через локальный веб-сервер (с file:// хранилище не работает).
// Запуск: node tools/replay_owner.js sim.html экспорт.json код.js   — код.js выполняется в странице (__ev)
const { chromium } = require('playwright'); const fs = require('fs'), http = require('http'), path = require('path');
(async () => {
  const [page, exp, code] = process.argv.slice(2); const E = JSON.parse(fs.readFileSync(exp, 'utf8'));
  const root = path.resolve(path.dirname(page));
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); r.end(d); } }); });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const ls = {"ancient-live-radar-opp-v1": E.oppProfile, "ancient-live-radar-zonelayer-v1": E.zoneLayer, "ancient-live-radar-zoneshapes-v1": E.zoneShapes,
    "ancient-live-radar-zonenames-v1": E.zoneNames, "ancient-live-radar-lineups-v1": E.lineups, "ancient-live-radar-builtin-off-v1": E.builtinOff,
    "ancient-live-radar-navanchors-v1": E.navAnchors, "ancient-live-radar-userzones-v1": E.userZones};
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await pg.addInitScript(o => { try { for (const k in o) if (o[k] != null) localStorage.setItem(k, JSON.stringify(o[k])); } catch (e) {} }, ls);
  await pg.goto(base + path.basename(page)); await pg.waitForTimeout(1200);
  console.log(await pg.evaluate(src => __ev(src), fs.readFileSync(code, 'utf8'))); await br.close(); srv.close();
})();
