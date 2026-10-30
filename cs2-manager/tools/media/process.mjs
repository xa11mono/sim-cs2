#!/usr/bin/env node
// Обработка медиатеки в Chromium (Playwright): assets/media/.raw → готовые WebP.
// Логотипы: растеризация (SVG/PNG), обрезка прозрачных полей, центрирование в квадрате 256 с полями 8%,
//   флаг dark, если эмблема тёмная (интерфейс подложит светлую плашку).
// Игроки: обрезка по силуэту; players/<ник>.webp — квадрат «голова и плечи» 320 (верх силуэта, ширина плеч),
//   players/full/<ник>.webp — весь вырез по высоте 640 для шапки профиля.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), M = path.resolve(process.env.CS2_MEDIA_DIR || path.join(ROOT, 'assets', 'media')), RAW = path.join(M, '.raw');
const man = JSON.parse(fs.readFileSync(path.join(M, 'media-manifest.json'), 'utf8'));
const files = fs.existsSync(RAW) ? fs.readdirSync(RAW) : []; if (!files.length) { console.log('нет файлов в .raw'); process.exit(0); }
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');
const mime = f => f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
let n = 0;
for (const f of files) {
  const kind = f.startsWith('players-') ? 'players' : 'teams', sub = f.startsWith('tournaments-') ? 'tournaments' : kind, base = f.replace(/^(teams|players|tournaments)-/, '').replace(/\.[a-z]+$/, '');
  const data = 'data:' + mime(f) + ';base64,' + fs.readFileSync(path.join(RAW, f)).toString('base64');
  const out = await p.evaluate(async ({ data, kind }) => {
    const img = new Image(); img.src = data; await img.decode();
    const S = kind === 'teams' ? 768 : Math.max(img.naturalWidth, img.naturalHeight, 600);
    const k = Math.min(S / (img.naturalWidth || S), S / (img.naturalHeight || S));
    const w = Math.round((img.naturalWidth || S) * k), h = Math.round((img.naturalHeight || S) * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1, lum = 0, cnt = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, a = px[i + 3]; if (a > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a > 128) { const L = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; lum += .2126 * L(px[i]) + .7152 * L(px[i + 1]) + .0722 * L(px[i + 2]); cnt++; } } }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, res = {};
    const emit = (sx, sy, sw, sh, ow, oh, pad) => { const o = document.createElement('canvas'); o.width = ow; o.height = oh; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      const iw = ow * (1 - 2 * pad), ih = oh * (1 - 2 * pad), sc = Math.min(iw / sw, ih / sh), dw = sw * sc, dh = sh * sc;
      og.drawImage(c, sx, sy, sw, sh, (ow - dw) / 2, kind === 'teams' ? (oh - dh) / 2 : oh - dh - (sy + sh >= h - 1 ? 0 : 0), dw, dh); return o.toDataURL('image/webp', .78); };
    if (kind === 'teams') { res.main = emit(x0, y0, bw, bh, 256, 256, .08); res.dark = cnt ? ((lum / cnt) + .05) / (.009 + .05) < 2.2 : false; /* контраст с фоном интерфейса #121821 ниже 2.2:1 */ }
    else {
      const side = Math.min(bw, h - y0);                     // квадрат от макушки на ширину силуэта (плечи)
      const cx = x0 + bw / 2, sx = Math.max(0, Math.min(w - side, cx - side / 2)), sy = Math.max(0, y0 - side * .04);
      res.main = emit(sx, sy, side, Math.min(side, h - sy), 256, 256, 0);
      res.full = emit(x0, y0, bw, bh, Math.round(420 * bw / bh), 420, 0);
    }
    return res;
  }, { data, kind });
  if (!out) { console.log('пусто:', f); continue; }
  const save = (rel, url) => fs.writeFileSync(path.join(M, rel), Buffer.from(url.split(',')[1], 'base64'));
  if (kind === 'teams') {
    const rel = `${sub}/${base}.webp`; fs.mkdirSync(path.join(M, sub), { recursive: true }); save(rel, out.main);
    Object.values(man[sub] || {}).forEach(x => { if (x.file === 'assets/media/' + rel || x.file.replace(/\.svg$/, '.webp') === 'assets/media/' + rel) { x.file = 'assets/media/' + rel; x.dark = out.dark || undefined; } });
  } else {
    fs.mkdirSync(path.join(M, 'players', 'full'), { recursive: true });
    save(`players/${base}.webp`, out.main); save(`players/full/${base}.webp`, out.full);
    Object.values(man.players).forEach(x => { if (x.file === `assets/media/players/${base}.webp`) x.full = `assets/media/players/full/${base}.webp`; });
  }
  fs.unlinkSync(path.join(RAW, f)); n++;
}
await b.close();
fs.rmSync(RAW, { recursive: true, force: true });
fs.writeFileSync(path.join(M, 'media-manifest.json'), JSON.stringify(man, null, 1));
fs.writeFileSync(path.join(M, 'media-manifest.js'), '/* создано tools/media — не редактировать вручную */\nwindow.CS2_MEDIA = ' + JSON.stringify(man) + ';\n');
console.log('обработано файлов:', n);
