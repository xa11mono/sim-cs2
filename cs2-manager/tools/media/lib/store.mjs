// Хранилище медиатеки: проверка файла, дедупликация по SHA-1, сохранение в .raw для обработки,
// атомарная запись manifest (.json для инструментов и .js для игры — file:// не умеет fetch JSON).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { slug } from './match.mjs';

export const MAX_BYTES = 5e6, MIN_SIDE = 48;

export function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {          // ищем маркер SOFn с размерами
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { ext: 'jpg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return { ext: 'jpg', w: 0, h: 0 };
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const t = b.toString('ascii', 12, 16);
    if (t === 'VP8X') return { ext: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (t === 'VP8 ') return { ext: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const v = b.readUInt32LE(21); return { ext: 'webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return { ext: 'webp', w: 0, h: 0 };
  }
  if (b.toString('ascii', 0, 3) === 'GIF') return { ext: 'gif', w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  const head = b.toString('utf8', 0, Math.min(b.length, 1024));
  if (/<svg[\s>]/i.test(head)) { if (/<script|on\w+\s*=/i.test(b.toString('utf8'))) return { ext: 'svg', unsafe: true }; return { ext: 'svg', w: 0, h: 0 }; }
  return null;
}

// Проверка скачанного файла; бросает понятную ошибку.
export function validate(buf) {
  if (!buf?.length) throw new Error('пустой ответ');
  if (buf.length > MAX_BYTES) throw new Error(`файл ${Math.round(buf.length / 1e6)} МБ — больше лимита 5 МБ`);
  const s = sniff(buf);
  if (!s) throw new Error('ответ не является изображением');
  if (s.unsafe) throw new Error('SVG со скриптами — отклонён');
  if (s.w && s.h && Math.min(s.w, s.h) < MIN_SIDE) throw new Error(`слишком маленькое изображение ${s.w}×${s.h}`);
  return s;
}

export const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');

export function openStore(mediaDir) {
  const MAN = path.join(mediaDir, 'media-manifest.json');
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : { v: 1, sources: [], teams: {}, players: {}, tournaments: {}, news: {}, missing: {} };
  for (const k of ['sources', 'teams', 'players', 'tournaments', 'missing']) man[k] = man[k] || (k === 'sources' ? [] : {});
  const byHash = new Map();
  for (const kind of ['teams', 'players', 'tournaments']) for (const [name, e] of Object.entries(man[kind])) if (e.sha1) byHash.set(e.sha1, { kind, name });
  const write = () => {
    man.generated = new Date().toISOString();
    for (const [f, txt] of [[MAN, JSON.stringify(man, null, 1)], [path.join(mediaDir, 'media-manifest.js'), '/* создано tools/media — не редактировать вручную */\nwindow.CS2_MEDIA = ' + JSON.stringify(man) + ';\n']]) {
      const tmp = f + '.tmp'; fs.writeFileSync(tmp, txt); fs.renameSync(tmp, f);
    }
  };
  return {
    man, write,
    has: (kind, name) => !!man[kind][name],
    // Положить проверенный файл в .raw (его обработает process.mjs) и записать в manifest.
    put(kind, name, buf, info, source) {
      const s = validate(buf), h = sha1(buf), dup = byHash.get(h);
      // Одно и то же изображение у двух разных игроков — почти наверняка заглушка источника.
      if (dup && !(dup.kind === kind && dup.name === name) && kind === 'players') throw new Error(`то же изображение уже у ${dup.name} — похоже на заглушку`);
      const raw = path.join(mediaDir, '.raw'); fs.mkdirSync(raw, { recursive: true });
      for (const f of fs.readdirSync(raw)) if (f.startsWith(`${kind}-${slug(name)}.`)) fs.unlinkSync(path.join(raw, f));
      fs.writeFileSync(path.join(raw, `${kind}-${slug(name)}.${s.ext}`), buf);
      const prev = man[kind][name];
      man[kind][name] = { ...(prev && prev.sha1 === h ? prev : {}), file: `assets/media/${kind}/${slug(name)}.webp`, src: info.src, page: info.page, url: info.url, ...(info.ext ? { ext: info.ext } : {}), sha1: h, fetched: new Date().toISOString().slice(0, 10) };
      if (prev && prev.src && prev.src !== info.src) man[kind][name].replaced = prev.src;
      byHash.set(h, { kind, name });
      man.missing[kind] = (man.missing[kind] || []).filter(x => x !== name);
      if (source && !man.sources.some(x => x.id === source.id)) man.sources.push({ id: source.id, name: source.name, url: source.home });
      return { ext: s.ext, w: s.w, h: s.h, sha1: h };
    },
    markMissing(kind, name) { const m = man.missing[kind] = man.missing[kind] || []; if (!man[kind][name] && !m.includes(name)) m.push(name); }
  };
}
