// Постоянная очередь скачивания: переживает перезапуск, не повторяет одинаковые запросы.
// Состояния: pending → found → downloaded → done; missing (ни один источник не нашёл); failed (ошибки, повтор с паузой).
import fs from 'node:fs';
import path from 'node:path';

const BACKOFF = [0, 10 * 60e3, 60 * 60e3, 6 * 3600e3]; // повтор после ошибки: сразу, 10 мин, 1 ч, 6 ч
export const MAX_ATTEMPTS = 4;

export function openQueue(file) {
  let q = { v: 2, items: {}, blocked: {}, runs: [] };
  if (fs.existsSync(file)) {
    try {
      const old = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (old.v === 2) q = Object.assign(q, old);
      else if (old.done) for (const k of Object.keys(old.done)) { const [kind, ...n] = k.split(':'); q.items[k] = { kind, name: n.join(':'), state: 'done', attempts: 0, tried: {} }; } // прогресс v1
    } catch { /* повреждённый файл — начинаем заново, старый оставляем рядом */ fs.copyFileSync(file, file + '.bad'); }
  }
  const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(q, null, 1)); fs.renameSync(tmp, file); };
  const key = (kind, name) => kind + ':' + name;
  return {
    data: q, save,
    add(kind, name, { force = false } = {}) {
      const k = key(kind, name), it = q.items[k];
      if (!it) q.items[k] = { kind, name, state: 'pending', attempts: 0, tried: {} };
      else if (force && it.state !== 'pending') Object.assign(it, { state: 'pending', attempts: 0, tried: {}, error: undefined, next: undefined });
      return q.items[k];
    },
    get: (kind, name) => q.items[key(kind, name)],
    // Что брать в работу сейчас: незавершённые, у которых истекла пауза.
    ready({ retryMissing = false, now = Date.now() } = {}) {
      return Object.values(q.items).filter(it =>
        ['pending', 'found', 'downloaded'].includes(it.state) ||
        (it.state === 'failed' && it.attempts < MAX_ATTEMPTS && (it.next || 0) <= now) ||
        (retryMissing && it.state === 'missing'));
    },
    fail(it, err) { it.attempts++; it.state = 'failed'; it.error = String(err?.message || err); it.next = Date.now() + (BACKOFF[it.attempts] ?? BACKOFF.at(-1)); },
    stats() { const s = {}; for (const it of Object.values(q.items)) s[it.state] = (s[it.state] || 0) + 1; return s; },
    block(src, info) { q.blocked[src] = { ...info, at: new Date().toISOString() }; },
    unblock(src) { delete q.blocked[src]; }
  };
}
