// Картинки проверки «кто кого видит» (docs/tasks/img/vis/): известные места Ancient.
// node tools/vis_shot.js <sim.html> <папка> [только_имя]
// Точка A — откуда смотрим, B — кого проверяем (строка «A видит B» в углу), рамка — кусок карты.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SHOTS = [
  // имя, [x0, y0, x1, y1] (координаты карты 0..2048), A, B, подпись
  ['01_bramp_bsite', [1280, 560, 1820, 1240], [1688, 1000], [1540, 830], 'С B Ramp (верх рампы) на B сайт'],
  ['02_topmid_mid', [760, 640, 1300, 1380], [975, 850], [985, 1125], 'С Top Mid вниз на Mid'],
  ['03_donut_a', [300, 360, 900, 1000], [630, 870], [612, 580], 'С Donut (выход в Short) на A сайт'],
  ['04_cave_b', [1240, 600, 1760, 1120], [1385, 800], [1560, 760], 'Из Cave на B сайт (за центральным ящиком B — тень)'],
  ['05_amain_a', [250, 360, 820, 1000], [350, 700], [612, 580], 'С A Main (конец Long) на A сайт'],
  ['06_ct_mid_xbox', [760, 560, 1300, 1400], [990, 600], [1055, 1210], 'С CT (Connector, верх мида) на Mid через Xbox'],
  ['07_plat_a', [250, 320, 820, 760], [343, 420], [560, 620], 'С Plat на A сайт: над большим ящиком (155) видна голова стоящего'],
  ['08_xbox_close', [920, 1060, 1200, 1300], [1000, 1170], [1100, 1172], 'Mid у Xbox: большой (83) и маленький (38) ящики вблизи; B — на площадке Triple (пол 161)'],
  ['09_ruins_chest', [1500, 1300, 1760, 1480], [1560, 1345], [1650, 1440], 'Ruins: ящик по грудь (56) — за ним стоящему видна голова, присевший закрыт']
];
(async () => {
  const [sim, outDir, only] = process.argv.slice(2);
  fs.mkdirSync(outDir, {recursive: true});
  const br = await chromium.launch();
  const pg = await br.newPage({viewport: {width: 1300, height: 1300}});
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:/, rt => rt.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForTimeout(1200);
  await pg.addStyleTag({content: '#topbar,#main > *:not(#cv){display:none !important}'});
  await pg.evaluate(() => __ev(`paused = true; freshMatch(1); for(var t=0;t<20000 && roundState !== "live";t++) stepTick(); bots = []; chkVis.checked = true; chkCover.checked = true;
    var _o = document.getElementById("chkOutline"); if(_o) _o.checked = false; fit(); 1`));
  const out = [];
  for (const [name, R, A, B, cap] of SHOTS) {
    if (only && only !== name) continue;
    const info = await pg.evaluate(([R, A, B, cap]) => __ev(`
      var W = cv.width, H = cv.height, s = Math.min(W / (${R[2]} - ${R[0]}), H / (${R[3]} - ${R[1]}));
      view.scale = s; view.panX = (W - (${R[2]} - ${R[0]}) * s) / 2 - ${R[0]} * s; view.panY = (H - (${R[3]} - ${R[1]}) * s) / 2 - ${R[1]} * s;
      VT.a = {x: ${A[0]}, y: ${A[1]}}; VT.b = {x: ${B[0]}, y: ${B[1]}};
      var cap = document.getElementById("shotCap"); if(!cap){ cap = document.createElement("div"); cap.id = "shotCap"; document.body.appendChild(cap); }
      var r0 = cv.getBoundingClientRect();
      cap.style.cssText = "position:fixed;z-index:99;left:" + r0.left + "px;top:" + (r0.top + r0.height - 40) + "px;width:" + (r0.width - 24) + "px;padding:9px 12px;background:rgba(10,14,9,0.92);color:#e8ecdd;font:15px/1.4 'IBM Plex Sans',sans-serif;border-top:1px solid #4a5a3a;";
      cap.textContent = ${JSON.stringify(cap)} + " — пол A " + Math.round(visFloorAt(VT.a.x, VT.a.y)) + ", пол B " + Math.round(visFloorAt(VT.b.x, VT.b.y));
      draw();
      JSON.stringify({W: W, H: H, x: r0.left, y: r0.top, pair: vtPairText(), ms: VT.ms})`), [R, A, B, cap]);
    const I = JSON.parse(info);
    await pg.screenshot({path: path.join(outDir, name + '.png'), clip: {x: I.x, y: I.y, width: I.W, height: I.H}});
    out.push(name + ' (' + I.ms + ' мс): ' + I.pair.join(' | '));
  }
  console.log(out.join('\n'));
  console.log('ошибок на странице:', errs.length ? errs : 'нет');
  await br.close();
})();
