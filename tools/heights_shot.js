// Картинки слоя «высоты» для владельца (docs/tasks/img/heights/).
// node tools/heights_shot.js <sim.html> <папка>
// Делает обзор всей карты и крупные куски важных мест, подпись — полосой сверху картинки.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SHOTS = [
  // имя, [x0, y0, x1, y1] в координатах карты (0..2048), куда навести мышь (подсказка) или null, подпись
  ['01_overview', [140, 40, 1900, 1990], null, 'Вся карта: цвет — высота пола (шкала слева внизу), штриховка — крыто сверху, стрелки — лестницы и рампы вверх, толстая белая линия — уступ'],
  ['02_mid_stairs', [840, 470, 1110, 1010], [968, 905], 'Лестница на миде: Top Mid → Red → Sniper Nest (стрелки вверх, 63 → 172). Red и Sniper Nest — крытые. По бокам лестницы — узкие бортики (уступы; пунктир — можно запрыгнуть)'],
  ['03_b_ramp', [1360, 880, 1770, 1320], [1690, 1040], 'B: рампа с Ruins на B (стрелки вверх, 39 → 128) и подъём к Banger / Cat Walk (стрелки влево). Белые линии — верх ящиков'],
  ['04_a_main', [220, 660, 780, 1120], [330, 900], 'A Main (зал слева), Tunnel (вверху справа) и Donut — крытые проходы. Оранжевый участок вверху — Boost над Tree (на 100 ед. выше, уступ)'],
  ['05_temple', [500, 230, 1130, 520], [640, 300], 'Temple и коридор к CT-спавну — крытые. От CT-спавна ступени вверх к Street (стрелки)'],
  ['06_cave', [1200, 620, 1480, 1130], [1360, 850], 'Cave и Cat Room — крытые. Пол Cave ≈ 155, площадка B ≈ 115–125. Белые линии — верх ящика'],
  ['07_a_site', [270, 300, 780, 760], [470, 480], 'A: Plat слева на ~55 выше площадки (уступ; где пунктир — можно запрыгнуть), верх ящиков — уступы ~100. Вверху справа — крытый Temple, внизу — Tree и Tunnel'],
  ['08_t_side', [300, 1050, 1720, 1960], [1240, 1600], 'Сторона T: A Stairs вверх к A Main, спуск Jungle → T-спавн (≈ −155), T Tunnel — крытый, Swamp и Ruins — рампы вверх к B'],
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
  await pg.addStyleTag({content: '#topbar,#main > *:not(#cv):not(#hgtTip){display:none !important}'});
  await pg.evaluate(() => __ev(`paused = true; freshMatch(1); for(var t=0;t<20000 && roundState !== "live";t++) stepTick(); for(var t2=0;t2<200;t2++) stepTick(); window.__bots = bots; bots = []; chkHeights.checked = true;
    var _o = document.getElementById("chkOutline"); if(_o) _o.checked = false; fit(); 1`)).catch(() => {});
  for (const [name, R, hover, cap] of SHOTS) {
    const info = await pg.evaluate(([R, hover, cap]) => __ev(`var CAPTION = ${JSON.stringify(cap)};
      var W = cv.width, H = cv.height, s = Math.min(W / (${R[2]} - ${R[0]}), H / (${R[3]} - ${R[1]}));
      view.scale = s; view.panX = (W - (${R[2]} - ${R[0]}) * s) / 2 - ${R[0]} * s; view.panY = (H - (${R[3]} - ${R[1]}) * s) / 2 - ${R[1]} * s;
      document.getElementById("hgtTip").style.display = "none";
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
