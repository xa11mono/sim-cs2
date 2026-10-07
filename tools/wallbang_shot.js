// Картинки слоя «прострелы» для владельца (docs/tasks/img/wallbang/).
// node tools/wallbang_shot.js <sim.html> <папка>
// Делает обзор всей карты и крупные куски важных мест, подпись — полосой сверху картинки.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SHOTS = [
  // имя, [x0, y0, x1, y1] в координатах карты (0..2048), куда навести мышь (подсказка) или null, подпись
  ['01_overview', [140, 40, 1900, 1990], null, 'Вся карта: простреливаемые куски цветом по материалу (фанера, доски, деревянный ящик, тонкий металл). Остальное — камень/бетон, не пробивается. Все пять мест — на стороне B и у Lamp Room'],
  ['02_cave_plywood', [1300, 720, 1560, 980], [1421, 846], 'Cave → сайт B: фанера (вернули в CS2 18.08.2025). AK проходит 28 из 36, AWP — 95 из 115. Место на стене и толщина 4 — предположение'],
  ['03_cave_metal', [1340, 820, 1520, 980], [1432, 905], 'Сайт B → Cave: синяя металлическая кромка у выхода из Cave (skin.club). Тонкий металл держит сильнее: AK 16 из 36, пистолеты не пробивают'],
  ['04_lamp_wood', [1280, 1020, 1520, 1220], [1405, 1115], 'Lamp Room → Wood / T Lower: деревянная конструкция у лампы (skin.club). Место — перегородка Lamp Room и Wood (предположение)'],
  ['05_cat_box', [1240, 1080, 1480, 1240], [1340, 1166], '«Белый ящик» у Lamp Room / Cat → Lower Mid (skin.club). Какой ящик и что он деревянный — предположение; толщина 16 — стреляют у края'],
  ['06_ramp_wood', [1500, 900, 1780, 1140], [1635, 1012], 'B Ramp: деревянные панели / кабинка (sportskeeda) — на B Short и B Long. Место — стенка здания Rat у подъёма к Bonger (предположение)'],
];
(async () => {
  const [sim, outDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, {recursive: true});
  const br = await chromium.launch();
  const pg = await br.newPage({viewport: {width: 1300, height: 1300}});
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:/, rt => rt.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForTimeout(1200);
  // только радар и слой: панели интерфейса прячем, ботов не рисуем
  await pg.addStyleTag({content: '#topbar,#main > *:not(#cv):not(#wbTip){display:none !important}'});
  await pg.evaluate(() => __ev(`paused = true; freshMatch(1); for(var t=0;t<20000 && roundState !== "live";t++) stepTick(); for(var t2=0;t2<200;t2++) stepTick(); window.__bots = bots; bots = []; chkWallbang.checked = true;
    var _o = document.getElementById("chkOutline"); if(_o) _o.checked = false; fit(); 1`)).catch(() => {});
  for (const [name, R, hover, cap] of SHOTS) {
    const info = await pg.evaluate(([R, hover, cap]) => __ev(`var CAPTION = ${JSON.stringify(cap)};
      var W = cv.width, H = cv.height, s = Math.min(W / (${R[2]} - ${R[0]}), H / (${R[3]} - ${R[1]}));
      view.scale = s; view.panX = (W - (${R[2]} - ${R[0]}) * s) / 2 - ${R[0]} * s; view.panY = (H - (${R[3]} - ${R[1]}) * s) / 2 - ${R[1]} * s;
      document.getElementById("wbTip").style.display = "none";
      var cap = document.getElementById("shotCap"); if(!cap){ cap = document.createElement("div"); cap.id = "shotCap"; document.body.appendChild(cap); }
      var r0 = cv.getBoundingClientRect();
      cap.style.cssText = "position:fixed;z-index:99;left:" + r0.left + "px;top:" + r0.top + "px;width:" + (r0.width - 24) + "px;padding:9px 12px;background:rgba(10,14,9,0.92);color:#e8ecdd;font:14px/1.4 'IBM Plex Sans',sans-serif;border-bottom:1px solid #4a5a3a;";
      cap.textContent = CAPTION;
      draw();
      var r = cv.getBoundingClientRect();
      JSON.stringify({W: W, H: H, x: r.left, y: r.top, s: s,
        hx: ${hover ? hover[0] : 0} * s + view.panX + r.left, hy: ${hover ? hover[1] : 0} * s + view.panY + r.top})`), [R, hover, cap]);
    const I = JSON.parse(info);
    if (hover) { await pg.mouse.move(I.hx, I.hy); await pg.waitForTimeout(80); await pg.evaluate(() => __ev('draw(); 1')); }
    else await pg.mouse.move(1, 1);
    await pg.screenshot({path: path.join(outDir, name + '.png'), clip: {x: I.x, y: I.y, width: I.W, height: I.H}});
  }
  console.log('ошибок на странице:', errs.length ? errs : 'нет');
  await br.close();
})();
