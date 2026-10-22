// (v407б, владелец 22.10: «при отметке — скриншоты последних секунд со всеми галочками») раскадровка отметки: по снимку «до»
// (preSnapAsset) проигрывает до момента отметки и каждые --every с рисует радар со слоями: пути игроков, ошибки движения, «почему»,
// коллы. Разбор взгляда отмеченного бота (варианты угла, опасность зон) — текстом в tools/mark_story.js (заливка зон
// на радаре закрывает карту). Игру не меняет (слои — только рисунок).
//   node tools/mark_frames.js sim.html до.json момент.json <бот> <папка> [--every=0.5] [--zoom=2.4] [--cols=4]
// В папку: f_<сек>.png (крупно вокруг бота), map_<сек>.png (вся карта, каждые 2 с), sheet.png (лента-раскадровка с подписями
// секунд до отметки), frames.gif (если есть ffmpeg). Сверка в конце — пришли ли ровно в момент отметки.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), cp = require('child_process');
(async () => {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const [sim, preF, snapF, botId, outDir] = args;
  if(!outDir){ console.error('node tools/mark_frames.js sim.html до.json момент.json бот папка [--every=0.5]'); process.exit(2); }
  const every = +(opt.every || 0.5), zoom = +(opt.zoom || 1.6), cols = +(opt.cols || 3);
  fs.mkdirSync(outDir, {recursive: true});
  const br = await chromium.launch(); const pg = await br.newPage({viewport: {width: 1400, height: 1000}});
  await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1500);
  const pre = fs.readFileSync(preF, 'utf8'), snap = fs.readFileSync(snapF, 'utf8');
  // момент отметки — в отдельной странице: после открытия снимка момента в странице остаются его «будущие» значения (метки коллов,
  // счёт), и кадры «до» рисовались бы с ними
  const pg0 = await br.newPage(); await pg0.route(/^https?:/, r => r.abort());
  await pg0.goto('file://' + path.resolve(sim)); await pg0.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const G = await pg0.evaluate(s => window.__ev('(function(s){ mkOpenSnap(s); return {T: tick, goal: bots.map(function(b){ return [b.id, Math.round(b.x), Math.round(b.y)]; })}; })')(s), snap);
  await pg0.close();
  const info = await pg.evaluate(([pre, G, id]) => window.__ev('(' + function(pre, G, id){
    var T = G.T, goal = G.goal;
    mkOpenSnap(pre); paused = true; if(typeof OBS !== "undefined") OBS.on = false;
    ["chkPaths", "chkProb", "chkWhy", "chkCalls"].forEach(function(c){ var el = document.getElementById(c); if(el) el.checked = true; });   // конусы обзора (chkLos) заливают весь кадр — без них
    window.__MF = {T: T, goal: goal, from: tick, id: id};
    return {T: T, from: tick};
  } + ')')(pre, G, id), [pre, G, botId]);
  const shots = []; let shotsMap = 0;
  const shoot = async (sec, whole) => {
    const url = await pg.evaluate(([whole, zoom]) => window.__ev('(' + function(whole, zoom){
      var b = bots.filter(function(o){ return o.id === __MF.id; })[0], W = whole ? 1000 : 900, H = whole ? 1000 : 700;
      var sv = {s: view.scale, x: view.panX, y: view.panY, w: cv.width, h: cv.height}, K = whole ? W/2048 : zoom, cx = whole ? 1024 : (b ? b.x : 1024), cy = whole ? 1024 : (b ? b.y : 1024), u = null;
      // круги звука и трассеры живут по часам страницы (nowTs): у снимка — чужие часы (вспышка выстрела на весь кадр), а при шагах без
      // кадров часы стоят — копились бы все выстрелы. В кадре их нет
      if(typeof soundPings !== "undefined") soundPings.length = 0;
      if(typeof tracers !== "undefined") tracers.length = 0;
      try{ cv.width = W; cv.height = H; view.scale = K; view.panX = W/2 - cx*K; view.panY = H/2 - cy*K; draw();
        if(b && b.alive){ ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2.5; ctx.strokeStyle = "#ff5a4f"; ctx.beginPath(); ctx.arc(b.x*K + view.panX, b.y*K + view.panY, 22, 0, Math.PI*2); ctx.stroke(); ctx.restore(); }
        u = cv.toDataURL("image/png"); }
      finally { cv.width = sv.w; cv.height = sv.h; view.scale = sv.s; view.panX = sv.x; view.panY = sv.y; }
      return u; } + ')')(whole, zoom), [whole, zoom]);
    const f = path.join(outDir, (whole ? 'map_' : 'f_') + String(whole ? shotsMap++ : shots.length).padStart(3, '0') + '_' + sec.toFixed(1).replace('-', 'm') + 'c.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); if(!whole) shots.push([sec, f]);
  };
  const stepTo = async t => pg.evaluate(t => window.__ev('(function(t){ while(tick < t) stepTick(); return tick; })')(t), t);
  for(let t = info.from; ; t += Math.round(every*64)){ const tt = Math.min(t, info.T); await stepTo(tt); const sec = (tt - info.T)/64;
    await shoot(sec, false); if(Math.abs(Math.round(sec*2)/2 % 2) < 1e-9 || tt === info.T) await shoot(sec, true); if(tt >= info.T) break; }
  const chk = await pg.evaluate(() => window.__ev('(function(){ var miss = __MF.goal.filter(function(g){ var b = bots.filter(function(o){ return o.id === g[0]; })[0]; return !b || Math.round(b.x) !== g[1] || Math.round(b.y) !== g[2]; }).length; return miss ? "не сошлось у " + miss : "бит в бит"; })()'));
  await br.close();
  // лента-раскадровка (PIL) и гифка (ffmpeg)
  const py = `import sys, json
from PIL import Image, ImageDraw, ImageFont
L = json.loads(sys.argv[1]); cols = int(sys.argv[2]); out = sys.argv[3]
ims = [(s, Image.open(f).convert('RGB')) for s, f in L]
w, h = ims[0][1].size; sc = 0.5; tw, th = int(w*sc), int(h*sc)
rows = (len(ims) + cols - 1)//cols; S = Image.new('RGB', (cols*tw, rows*(th+22)), (12, 14, 11)); d = ImageDraw.Draw(S)
try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
except Exception: fnt = None
for i, (s, im) in enumerate(ims):
    x, y = (i % cols)*tw, (i//cols)*(th+22); S.paste(im.resize((tw, th)), (x, y+22)); d.text((x+6, y+2), '%+.1f s' % s, fill=(255, 220, 120), font=fnt)
S.save(out)`;
  cp.execFileSync('python3', ['-c', py, JSON.stringify(shots), String(cols), path.join(outDir, 'sheet.png')]);
  try{ cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(1/every*0.5), '-pattern_type', 'glob', '-i', path.join(outDir, 'f_*.png'), '-vf', 'scale=640:-1', path.join(outDir, 'frames.gif')]); }catch(e){}
  console.log('кадров ' + shots.length + ', сверка: ' + chk + ', папка ' + outDir);
})();
