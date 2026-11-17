// (15.11, владелец: «мне это надо видеть») видео момента отметки в этой версии: снимок «до» → пересчёт этим кодом → кадр каждые 2 тика
// (32 к/с = настоящая скорость), камера на боте, подпись: секунды до / после отметки, задача, высота, поворот за последнюю 1 с (красным — больше 180°), причина взгляда.
// Игру не меняет (только рисует). Нужен ffmpeg.
//   node tools/marks/mark_video.js sim.html до.json[.gz] <тик отметки> <бот> <с, от> <с, до> out.mp4 [--zoom=2.2] [--speed=1] [--label=подпись версии]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
(async () => {
  const a = process.argv.slice(2).filter(x => !x.startsWith("--"));
  const opt = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith("--")).map(x => x.slice(2).split("=")));
  const [sim, preF, markT, botId, fromS, toS, out] = a;
  if (!out) { console.error("node tools/marks/mark_video.js sim.html до.json тик бот от до out.mp4"); process.exit(2); }
  const LBL = opt.label || "эта версия (пересчёт со снимка за 15 с до отметки)", zoom = +(opt.zoom || 2.2), speed = +(opt.speed || 1), T = +markT, t0 = T + Math.round(+fromS * 64), t1 = T + Math.round(+toS * 64);
  const raw = fs.readFileSync(preF), pre = (preF.endsWith(".gz") ? require("zlib").gunzipSync(raw) : raw).toString("utf8");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv_"));
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 1000, height: 800 } }); await pg.route(/^https?:/, r => r.abort());
  await pg.goto("file://" + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === "function", null, { timeout: 60000 });
  await pg.evaluate(s => window.__ev("mkOpenSnap")(s), pre);
  const start = await pg.evaluate(([t0, id]) => window.__ev("(" + function (t0, id) {
    paused = true; if (typeof OBS !== "undefined") OBS.on = false;
    ["chkPaths", "chkProb", "chkWhy"].forEach(function (c) { var el = document.getElementById(c); if (el) el.checked = true; });
    window.__MV = { id: id, pf: null, turn: 0, max: 0 };
    while (tick < t0) stepTick(); return tick;
  } + ")")(t0, id), [t0, botId]);
  let n = 0;
  for (let t = start; t <= t1; t += 2) {
    const url = await pg.evaluate(([t, T, zoom, LBL]) => window.__ev("(" + function (t, T, zoom, LBL) {
      var M = __MV;
      while (tick < t) { stepTick();
        var b0 = bots.filter(function (o) { return o.id === M.id; })[0];
        if (b0 && b0.alive && b0._jump && tick - b0._jump.t < 45) { if (M.pf != null) { var d = b0.facing - M.pf; M.turn += Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); } M.pf = b0.facing; M.max = Math.max(M.max, M.turn); }
        else { M.pf = null; if (M.turn > 0) M.last = M.turn; M.turn = 0; }
        if (b0) { if (M.hf != null) { var dd = b0.facing - M.hf; (M.h = M.h || []).push([tick, Math.abs(Math.atan2(Math.sin(dd), Math.cos(dd)))]); } M.hf = b0.facing; while (M.h && M.h.length && M.h[0][0] <= tick - 64) M.h.shift(); } }
      var turn1 = (M.h || []).reduce(function (a, x) { return a + x[1]; }, 0) * 180 / Math.PI;
      var b = bots.filter(function (o) { return o.id === M.id; })[0], W = 900, H = 700;
      var sv = { s: view.scale, x: view.panX, y: view.panY, w: cv.width, h: cv.height }, u = null;
      if (typeof soundPings !== "undefined") soundPings.length = 0;
      try {
        cv.width = W; cv.height = H; view.scale = zoom; view.panX = W / 2 - (b ? b.x : 1024) * zoom; view.panY = H / 2 - (b ? b.y : 1024) * zoom; draw();
        // (15.11, владелец: «надо видеть всю картину взгляда») куда смотрит: луч взгляда (жёлтый, 160 px), точка взгляда (lookTarget —
        // голубой пунктир и кружок), пост (зелёный квадрат и пунктир от бота), причина взгляда — в подписи
        if (b && b.alive) { var X = function (v) { return v * zoom + view.panX; }, Y = function (v) { return v * zoom + view.panY; };
          ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,214,102,.95)"; ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y));
          ctx.lineTo(X(b.x + Math.cos(b.facing) * 160), Y(b.y + Math.sin(b.facing) * 160)); ctx.stroke();
          if (b.lookTarget) { ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(120,200,255,.9)"; ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y)); ctx.lineTo(X(b.lookTarget.x), Y(b.lookTarget.y)); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(X(b.lookTarget.x), Y(b.lookTarget.y), 7, 0, Math.PI * 2); ctx.stroke(); }
          if (b.post) { ctx.setLineDash([2, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(120,230,140,.9)"; ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y)); ctx.lineTo(X(b.post.x), Y(b.post.y)); ctx.stroke();
            ctx.setLineDash([]); ctx.strokeRect(X(b.post.x) - 7, Y(b.post.y) - 7, 14, 14); }
          ctx.restore(); }
        if (b && b.alive) { ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2.5; ctx.strokeStyle = "#ff5a4f"; ctx.beginPath(); ctx.arc(b.x * zoom + view.panX, b.y * zoom + view.panY, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        var sec = (tick - T) / 64, air = b && b._jump && tick - b._jump.t < 45;
        var L = [(sec < 0 ? "" : "+") + sec.toFixed(1) + " с " + (sec < 0 ? "до отметки" : "после отметки") + (Math.abs(sec) < 0.04 ? "  ◀ МОМЕНТ ОТМЕТКИ" : ""),
          M.id + (b ? " · " + (b.alive ? (b.post && b.post.tag || "без задачи") : "убит") : "") + (b && b.post ? " · пост: " + b.post.tag : "") + " · высота " + Math.round(b ? b.z || 0 : 0) + " · поворот за 1 с: " + Math.round(turn1) + "°" + (b && b.lookReason ? " · взгляд: " + b.lookReason : ""),
          LBL];
        ctx.save(); ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.fillRect(0, 0, W, 78); ctx.font = "bold 20px sans-serif"; ctx.fillStyle = Math.abs(sec) < 0.5 ? "#ffd166" : "#fff";
        ctx.fillText(L[0], 14, 26); ctx.font = "18px sans-serif"; ctx.fillStyle = turn1 > 180 ? "#ff8a80" : "#e6e6e6"; ctx.fillText(L[1], 14, 50); ctx.font = "13px sans-serif"; ctx.fillStyle = "#aaa"; ctx.fillText(L[2], 14, 70); ctx.restore();
        u = cv.toDataURL("image/png");
      } finally { cv.width = sv.w; cv.height = sv.h; view.scale = sv.s; view.panX = sv.x; view.panY = sv.y; }
      return u;
    } + ")")(t, T, zoom, LBL), [t, T, zoom, LBL]);
    fs.writeFileSync(path.join(dir, "f" + String(n++).padStart(5, "0") + ".png"), Buffer.from(url.split(",")[1], "base64"));
  }
  const max = await pg.evaluate(() => window.__ev("Math.round(__MV.max*180/Math.PI)"));
  await br.close();
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(32 * speed), "-i", path.join(dir, "f%05d.png"), "-pix_fmt", "yuv420p", "-vf", "scale=900:-2", path.resolve(out)]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("кадров " + n + ", макс. поворот за полёт " + max + "°, видео " + out);
})();
