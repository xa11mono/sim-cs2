// Картинки слоя «укрытия» для владельца (docs/tasks/img/cover/).
// node tools/cover_shot.js <sim.html> <папка>
// Делает обзор всей карты и крупные куски важных мест, подпись — полосой сверху картинки.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SHOTS = [
  // имя, [x0, y0, x1, y1] в координатах карты (0..2048), куда навести мышь (подсказка) или null, подпись
  ['01_overview', [140, 40, 1900, 1990], null, 'Вся карта: укрытия по высоте над полом рядом — малиновый «выше головы» (≥ 72), жёлтый «по грудь» (46–72), голубой «низкое» (< 46); пунктир — не измерено (навмеша сверху нет)'],
  ['02_xbox_mid', [900, 1020, 1240, 1300], [1052, 1170], 'Mid, Xbox: большой ящик 83 над полом ямы (выше головы; с площадки справа он на 47 ниже её пола), маленький рядом — 38 (низкий). Вверху справа — длинный ящик у Cat Walk без стены'],
  ['03_a_site', [300, 380, 800, 720], [470, 500], 'A сайт: ящики у Outside и Plat (99–105 от пола сайта), ступенька Triple (31 / 73 / 105), высокие стены A без навмеша сверху — по умолчанию выше головы'],
  ['04_b_cave', [1260, 620, 1720, 1200], [1347, 758], 'B сайт и Cave: ящик в Cave 75 (выше головы, на грани), ящик у Ramp 101; Ninja, Alley и большой блок B — без навмеша сверху'],
  ['05_triple_a', [600, 470, 760, 690], [671, 524], 'Triple на A: три ступени ящиков — 31 (низкое), 73 и 105 (выше головы); ниже — ящик в углу у Triple без стены, 38 (низкое)'],
  ['06_t_side', [880, 1280, 1720, 1800], [1638, 1410], 'Сторона T: ящик на Ruins 56 (по грудь — присев не видно, стоя голова над ним); колонна в Water и стены T-спавна — без навмеша сверху'],
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
  await pg.addStyleTag({content: '#topbar,#main > *:not(#cv):not(#covTip){display:none !important}'});
  await pg.evaluate(() => __ev(`paused = true; freshMatch(1); for(var t=0;t<20000 && roundState !== "live";t++) stepTick(); for(var t2=0;t2<200;t2++) stepTick(); window.__bots = bots; bots = []; chkCover.checked = true;
    var _o = document.getElementById("chkOutline"); if(_o) _o.checked = false; fit(); 1`)).catch(() => {});
  for (const [name, R, hover, cap] of SHOTS) {
    const info = await pg.evaluate(([R, hover, cap]) => __ev(`var CAPTION = ${JSON.stringify(cap)};
      var W = cv.width, H = cv.height, s = Math.min(W / (${R[2]} - ${R[0]}), H / (${R[3]} - ${R[1]}));
      view.scale = s; view.panX = (W - (${R[2]} - ${R[0]}) * s) / 2 - ${R[0]} * s; view.panY = (H - (${R[3]} - ${R[1]}) * s) / 2 - ${R[1]} * s;
      document.getElementById("covTip").style.display = "none";
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
