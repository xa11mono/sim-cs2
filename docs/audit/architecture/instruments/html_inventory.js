// Диагностика (аудит v598): точный состав готовой HTML-страницы в байтах.
// Запуск: node docs/audit/architecture/instruments/html_inventory.js <страница.html> [--json <out.json>]
// Только читает страницу; рабочий код, сборку и данные не меняет.
// Считает: разметку, CSS, шрифты (base64), JS игры, литерал MAP по категориям, звуки SND_DATA,
// картинки (base64 PNG в MAP и в HUD), zlib-блоки map3d (хранимые и распакованные), gzip/brotli.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const file = process.argv[2];
const outIdx = process.argv.indexOf('--json');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const buf = fs.readFileSync(file);
const text = buf.toString('utf8');
const B = (s) => Buffer.byteLength(s, 'utf8');

function findRegions(tag) {
  const re = new RegExp('<' + tag + '[^>]*>', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length;
    const close = text.indexOf('</' + tag + '>', open);
    if (close < 0) break;
    out.push({ start: m.index, open, close, end: close + tag.length + 3 });
    re.lastIndex = close;
  }
  return out;
}
const styles = findRegions('style');
const scripts = findRegions('script').map((r) => ({ ...r, size: r.end - r.start })).sort((a, b) => b.size - a.size);
const game = scripts[0];
const small = scripts.slice(1);
const bodyIdx = text.indexOf('<body>');

function braceMatch(t, from) {
  let depth = 0, q = null;
  for (let j = from; j < t.length; j++) {
    const c = t[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; }
    else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j + 1;
  }
  return -1;
}
function findLiteral(names) {           // ищем «<name>=» / «<name> = » и берём объект после него
  for (const n of names) {
    const at = text.indexOf(n);
    if (at >= 0) { const i = text.indexOf('{', at); const end = braceMatch(text, i); return { at, start: i, end, text: text.slice(i, end) }; }
  }
  return null;
}

const mapLit = findLiteral(['var MAP=', 'var MAP = ']);
const MAP = eval('(' + mapLit.text + ')');
const mapFull = { start: mapLit.at, end: mapLit.end + 1 };

const sndLit = findLiteral(['var SND_DATA=', 'var SND_DATA = ', 'SND_DATA = ']);
const snd = sndLit ? { at: sndLit.at, end: sndLit.end + 1 } : null;

// «Отметить момент»: __SNAP + marks.js — от «var __SNAP=» до «var WARM=» (следующий исходник — 660_warmup.js)
let marks = { at: -1, bytes: 0, snapshot_bytes: 0, module_bytes: 0 };
const snapAt = text.indexOf('var __SNAP=') >= 0 ? text.indexOf('var __SNAP=') : text.indexOf('var __SNAP = ');
if (snapAt >= 0) {
  const w = text.indexOf('var WARM=', snapAt);
  const openArr = text.indexOf('{', snapAt);
  // конец списка __SNAP — по «]];»
  const snapEnd = text.indexOf(']];', snapAt) + 3;
  const endAt = w > snapEnd ? w : snapEnd;
  marks = { at: snapAt, bytes: B(text.slice(snapAt, endAt)), snapshot_bytes: B(text.slice(snapAt, snapEnd)), module_bytes: w > snapEnd ? B(text.slice(snapEnd, w)) : 0 };
}

// ---------- base64: шрифты, картинки, звуки ----------
const fontRe = /data:font\/[a-z0-9+.-]+;base64,([A-Za-z0-9+/=]+)/gi;
let fontChars = 0, fontCount = 0, fm;
while ((fm = fontRe.exec(text))) { fontChars += fm[1].length; fontCount++; }

const imgRe = /data:image\/([a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/gi;
const images = []; let im;
while ((im = imgRe.exec(text))) {
  images.push({ at: im.index, mime: im[1], chars: im[2].length, bytes: Math.round(im[2].length * 3 / 4), in_map: im.index > mapFull.start && im.index < mapFull.end });
}
const radarChars = MAP.radar && MAP.radar.startsWith('data:image/png;base64,') ? MAP.radar.length - 'data:image/png;base64,'.length : 0;

let sndB64 = 0;
if (snd) { const m = text.slice(snd.at, snd.end).match(/[A-Za-z0-9+/=]{200,}/g); if (m) sndB64 = m.reduce((a, x) => a + x.length, 0); }

// ---------- map3d: хранимые и распакованные zlib-блоки (вложенные поля — тоже) ----------
const m3 = MAP.map3d || {};
function m3walk(v, acc) {
  if (typeof v === 'string' && /^[A-Za-z0-9+/=]+$/.test(v) && v.length > 64) {
    acc.stored += v.length;
    try { acc.inflated += zlib.inflateSync(Buffer.from(v, 'base64')).length; acc.blobs++; } catch (e) { acc.bad++; }
    return acc;
  }
  if (Array.isArray(v)) { for (const x of v) m3walk(x, acc); return acc; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) m3walk(v[k], acc); return acc; }
  acc.json += B(JSON.stringify(v)) + 2;   // числа/короткие строки
  return acc;
}
const m3parts = {};
for (const k of ['prims', 'sight', 'nade', 'floors', 'sky', 'sky_z', 'mats']) {
  if (m3[k] === undefined) continue;
  const acc = m3walk(m3[k], { stored: 0, inflated: 0, json: 0, blobs: 0, bad: 0 });
  m3parts[k] = acc;
}

// ---------- категории ключей MAP ----------
const CAT = {
  geometry: ['map3d', 'walls', 'heights', 'cover', 'wallbang', 'climbs'],
  nav: ['navmesh', 'zones'],
  visibility: ['zoneprops'],
  textures: ['radar'],
  gameplay: ['tactics', 'pro', 'lineups', 'nadelanes', 'luaim', 'runups', 'nadeplan', 'nadeguess',
    'ctspots', 'postplant', 'ctshare', 'turnmodel', 'spawnearly', 'defaultpos'],
};
const catOf = {};
for (const [c, keys] of Object.entries(CAT)) for (const k of keys) catOf[k] = c;
const keyRows = [];
const cat = { geometry: 0, nav: 0, visibility: 0, textures: 0, gameplay: 0, other: 0 };
for (const k of Object.keys(MAP)) {
  const bytes = B(JSON.stringify(MAP[k])) + k.length + 4;
  const c = catOf[k] || 'other';
  cat[c] += bytes;
  keyRows.push({ key: k, bytes, cat: c });
}
keyRows.sort((a, b) => b.bytes - a.bytes);

// ---------- gzip / brotli ----------
const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length;
// Регионы найдены в символах: размеры считаем байтами UTF-8 (иначе кириллица в CSS/JS даёт разницу).
const styleBytes = styles.reduce((a, r) => a + B(text.slice(r.start, r.end)), 0);
const scriptBytes = scripts.reduce((a, r) => a + B(text.slice(r.start, r.end)), 0);
const smallScriptBytes = scripts.filter((r) => r !== game).reduce((a, r) => a + B(text.slice(r.start, r.end)), 0);
const fontBytes = Math.round(fontChars * 3 / 4);
const fontTextBytes = fontChars;               // base64 — ASCII, байт столько же, сколько символов
let htmlBytes = buf.length - styleBytes - scriptBytes;

const transport = {};
transport.full_page = { bytes: buf.length, gzip: gz(buf), brotli: br(buf) };
transport.styles = { bytes: styleBytes, gzip: gz(Buffer.from(styles.map((r) => text.slice(r.start, r.end)).join(''))), brotli: null };
transport.map_literal = { bytes: B(text.slice(mapFull.start, mapFull.end)), gzip: gz(Buffer.from(text.slice(mapFull.start, mapFull.end))), brotli: null };
if (snd) transport.snd_data = { bytes: B(text.slice(snd.at, snd.end)), gzip: gz(Buffer.from(text.slice(snd.at, snd.end))), brotli: null };
transport.game_script = { bytes: B(text.slice(game.start, game.end)), gzip: gz(Buffer.from(text.slice(game.start, game.end))), brotli: null };

const out = {
  file: path.resolve(file),
  page_bytes: buf.length,
  page_chars: text.length,
  page_gzip: gz(buf),
  page_brotli: br(buf),
  body_at: bodyIdx,
  styles: styles.map((r) => ({ at: r.start, bytes: B(text.slice(r.start, r.end)) })),
  scripts: scripts.map((r) => ({ at: r.start, end: r.end, bytes: B(text.slice(r.start, r.end)) })),
  html_bytes: htmlBytes,
  style_bytes: styleBytes,
  script_bytes: scriptBytes,
  fonts: { count: fontCount, base64_chars: fontChars, bytes_est: fontBytes },
  css_bytes: styleBytes - fontTextBytes,
  map_literal: { at: mapFull.start, bytes: B(text.slice(mapFull.start, mapFull.end)) },
  map_keys: { total: keyRows.reduce((a, r) => a + r.bytes, 0), by_category: cat, rows: keyRows },
  snd_data: snd ? { at: snd.at, bytes: B(text.slice(snd.at, snd.end)), base64_chars: sndB64, bytes_est: Math.round(sndB64 * 3 / 4) } : null,
  engine_bytes: scriptBytes - B(text.slice(mapFull.start, mapFull.end)) - (snd ? B(text.slice(snd.at, snd.end)) : 0) - marks.bytes - smallScriptBytes,
  marks,
  radar_base64_chars: radarChars,
  radar_png_bytes: Math.round(radarChars * 3 / 4),
  images,
  map3d: m3parts,
  transport,
};
if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out, null, 1)); console.log('json -> ' + outFile); }

const pct = (x) => (100 * x / out.page_bytes).toFixed(2).padStart(6) + '%';
const row = (name, bytes) => console.log('  ' + pct(bytes) + ' ' + String(bytes).padStart(10) + '  ' + name);
console.log('== ' + file);
console.log('страница ' + out.page_bytes + ' B  (gzip ' + out.page_gzip + ' B, brotli ' + out.page_brotli + ' B)');
console.log('области:');
row('HTML (разметка + обвязка)', htmlBytes);
row('CSS (все <style> минус шрифты)', out.css_bytes);
row('шрифты base64 (внутри CSS)', fontTextBytes);
row('JS игры (<script>)', out.script_bytes);
row('  из него литерал MAP', out.map_literal.bytes);
row('  из него SND_DATA', out.snd_data ? out.snd_data.bytes : 0);
row('  из него отметки (__SNAP + marks.js)', marks.bytes);
row('  из него код движка и интерфейса', out.engine_bytes);
row('картинки base64 всего (радар + HUD)', images.reduce((a, x) => a + x.chars, 0));
console.log('MAP по категориям (сумма ' + out.map_keys.total + '):');
for (const [k, v] of Object.entries(cat)) row('MAP ' + k, v);
console.log('ключи MAP > 20 КБ:');
for (const r of keyRows.filter((r) => r.bytes > 20000)) console.log('     ' + String(r.bytes).padStart(9) + '  ' + r.key + '  [' + r.cat + ']');
console.log('картинки:');
for (const i of images) console.log('     at ' + String(i.at).padStart(9) + '  ' + i.mime + '  ' + String(i.chars).padStart(8) + ' симв. (' + i.bytes + ' B)' + (i.in_map ? '  [MAP]' : ''));
console.log('map3d:');
for (const [k, v] of Object.entries(m3parts)) console.log('     ' + k.padEnd(7) + ' stored ' + String(v.stored).padStart(9) + ' base64=' + v.blobs + ' blob(s)  inflated ' + v.inflated + ' B  прочее JSON ' + v.json + ' B');
console.log('звуки SND_DATA: ' + (out.snd_data ? out.snd_data.bytes : 0) + ' B, base64 ' + sndB64 + ' симв. ≈ ' + Math.round(sndB64 * 3 / 4) + ' B');

