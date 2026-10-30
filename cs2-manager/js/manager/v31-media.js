(() => {
'use strict';
/* =====================================================================
   v31 · Логотипы и фото (собственные файлы пользователя)
   Изображения хранятся в IndexedDB браузера (не в localStorage — не тратят квоту сейва),
   ключ «вид:имя»: team:NAVI · player:donk · event:iem katowice. Имя берётся из имени файла.
   Портал показывает их вместо инициалов, силуэта и кубка; без файлов — прежние заглушки.
   Внешних загрузок нет: интерфейс работает офлайн с file://.
   ===================================================================== */
const DB = 'cs2-media', STORE = 'img';
const urls = new Map();       // ключ → objectURL
let db = null;
const norm = s => String(s || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_]+/g, ' ').replace(/\s*\b(19|20)\d\d\b/g, '').trim();
const key = (kind, name) => kind + ':' + (kind === 'event' ? norm(window.TW ? window.TW.familyKey(name) : name) : norm(name));
function open() {
  return new Promise((res, rej) => { if (db) return res(db); if (!window.indexedDB) return rej(new Error('IndexedDB недоступен'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => rej(r.error); });
}
async function loadAll() {
  try { const d = await open(); await new Promise(res => { const tx = d.transaction(STORE, 'readonly'), st = tx.objectStore(STORE), cur = st.openCursor();
    cur.onsuccess = () => { const c = cur.result; if (!c) return res(); urls.set(c.key, typeof c.value === 'string' ? c.value : URL.createObjectURL(c.value)); c.continue(); }; cur.onerror = () => res(); }); }
  catch (e) { console.info('[media] хранилище изображений недоступно:', e.message); }
  if (urls.size && window.HS) window.HS.render();
}
async function put(k, blob) { const d = await open(); await new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); if (urls.has(k) && urls.get(k).startsWith('blob:')) URL.revokeObjectURL(urls.get(k)); urls.set(k, typeof blob === 'string' ? blob : URL.createObjectURL(blob)); }
async function del(k) { const d = await open(); await new Promise(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(k); tx.oncomplete = res; tx.onerror = res; }); if (urls.has(k)) URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
function match(kind, fileName) { // имя файла → существующая команда / игрок / серия
  const n = norm(fileName);
  if (kind === 'team') { const t = (typeof teams !== 'undefined' ? teams : []).find(x => norm(x.name) === n); return t ? t.name : null; }
  if (kind === 'player') { for (const t of (typeof teams !== 'undefined' ? teams : [])) { const p = (t.players || []).find(x => norm(x.nick) === n); if (p) return p.nick; } const fa = (typeof transferState !== 'undefined' ? transferState.freeAgents || [] : []).find(x => norm(x.nick) === n); return fa ? fa.nick : null; }
  if (kind === 'event') { const names = new Set(); try { Object.values(window.hubArchiveExport() || {}).forEach(s => names.add(s.name)); (seasonState.seasonSchedule || []).forEach(e => e && names.add(e.name)); (seasonState.parallelSchedule || []).forEach(e => names.add(e.name)); } catch (e) {}
    const fk = x => norm(window.TW ? window.TW.familyKey(x) : x); for (const x of names) if (fk(x) === norm(window.TW ? window.TW.familyKey(fileName) : n)) return x; return null; }
  return null;
}
const MAX = 1.5e6, TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
async function importFiles(kind, files) {
  const out = { ok: [], bad: [] };
  for (const f of files) {
    if (!TYPES.includes(f.type)) { out.bad.push({ f: f.name, why: 'не изображение (PNG, JPG, WEBP, SVG, GIF)' }); continue; }
    if (f.size > MAX) { out.bad.push({ f: f.name, why: 'файл больше 1.5 МБ' }); continue; }
    const name = match(kind, f.name);
    if (!name) { out.bad.push({ f: f.name, why: kind === 'team' ? 'нет команды с таким названием' : kind === 'player' ? 'нет игрока с таким ником' : 'нет турнира этой серии' }); continue; }
    try { await put(key(kind, name), f); out.ok.push({ f: f.name, name }); } catch (e) { out.bad.push({ f: f.name, why: 'не удалось сохранить: ' + e.message }); }
  }
  return out;
}
// медиатека в папке проекта (assets/media/media-manifest.js); пользовательские файлы из IndexedDB — поверх неё
const MAN = window.CS2_MEDIA || { teams: {}, players: {}, tournaments: {}, news: {} };
const manIdx = { team: {}, player: {}, event: {} };
const manDark = {}, manFull = {};
Object.entries(MAN.teams || {}).forEach(([n, x]) => { manIdx.team[norm(n)] = x.file; if (x.dark) manDark[norm(n)] = 1; });
Object.entries(MAN.players || {}).forEach(([n, x]) => { manIdx.player[norm(n)] = x.file; if (x.full) manFull[norm(n)] = x.full; });
Object.entries(MAN.tournaments || {}).forEach(([n, x]) => { manIdx.event[norm(window.TW ? window.TW.familyKey(n) : n)] = x.file; });
const fromMan = (kind, name) => manIdx[kind]?.[kind === 'event' ? norm(window.TW ? window.TW.familyKey(name) : name) : norm(name)] || null;
window.V31Media = {
  url: (kind, name) => urls.get(key(kind, name)) || fromMan(kind, name) || null,
  manifest: MAN,
  dark: name => !urls.get(key('team', name)) && !!manDark[norm(name)],   // тёмная эмблема — нужна светлая подложка
  full: nick => urls.get(key('player', nick)) || manFull[norm(nick)] || null,   // вырез во весь рост для шапки профиля
  list: () => [...urls.keys()].map(k => ({ k, kind: k.split(':')[0], name: k.slice(k.indexOf(':') + 1), url: urls.get(k) })),
  importFiles, del, count: () => urls.size
};


/* ------------------------------------------------------------ AUTO-FILL ALL MEDIA (в браузере) */
// Для сущностей без изображения: поиск страницы на Liquipedia (MediaWiki API, CORS origin=*), проверка
// совпадения (точный ник игрока + категория игроков; команда; серия турнира), затем файл → IndexedDB.
// Если сервер не отдаёт файл скриптам (CORS), сохраняется прямая ссылка. По одному запросу в 2 секунды;
// прогресс хранится в localStorage («cs2media_autofill») — после перезапуска продолжается с места остановки.
const AF_KEY = 'cs2media_autofill';
const afState = () => { try { return JSON.parse(localStorage.getItem(AF_KEY) || 'null') || { done: {}, fail: {}, log: [] }; } catch (e) { return { done: {}, fail: {}, log: [] }; } };
const afSave = s => { try { s.log = s.log.slice(0, 60); localStorage.setItem(AF_KEY, JSON.stringify(s)); } catch (e) {} };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
let afRun = null;
function afQueue() {
  const q = [], T = typeof teams !== 'undefined' ? teams : [];
  T.forEach(t => { if (!window.V31Media.url('team', t.name)) q.push(['team', t.name]); (t.players || []).forEach(p => { if (!window.V31Media.url('player', p.nick)) q.push(['player', p.nick]); }); });
  const series = new Set(); try { (seasonState.seasonSchedule || []).forEach(e => e && series.add(e.name)); } catch (e) {}
  series.forEach(n => { if (!window.V31Media.url('event', n)) q.push(['event', n]); });
  return q;
}
async function afOne(kind, name) {
  const q = kind === 'event' ? (window.TW ? window.TW.familyKey(name) : name) : name;
  const u = `https://liquipedia.net/counterstrike/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&prop=pageimages|categories&piprop=original&cllimit=50`;
  const r = await fetch(u); if (!r.ok) throw new Error('Liquipedia HTTP ' + r.status);
  const j = await r.json(), pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index), cat = p => (p.categories || []).map(c => c.title).join(' ');
  const exact = p => slug(p.title.replace(/\s*\(.*\)$/, '')) === slug(name);
  const hit = pages.find(p => p.original?.source && (kind === 'player' ? exact(p) && /Player/.test(cat(p)) : kind === 'team' ? (exact(p) || slug(p.title).includes(slug(name))) && /Team/.test(cat(p)) : /Tournament/.test(cat(p))));
  if (!hit) return null;
  let stored = hit.original.source;
  try { const b = await fetch(stored, { mode: 'cors' }); if (b.ok) { const blob = await b.blob(); if (/^image\//.test(blob.type)) stored = blob; } } catch (e) { /* CORS: храним ссылку */ }
  await put(key(kind, name), stored);
  return typeof stored === 'string' ? 'ссылка' : 'файл';
}
async function autoFill(onTick) {
  if (afRun) return; const st = afState(); afRun = { stop: false, n: 0, ok: 0 };
  const q = afQueue().filter(([k, n]) => !st.done[k + ':' + n] && (st.fail[k + ':' + n] || 0) < 2);
  afRun.total = q.length;
  for (const [kind, name] of q) {
    if (afRun.stop) break; afRun.n++;
    const id = kind + ':' + name;
    try { const r = await afOne(kind, name); if (r) { st.done[id] = Date.now(); afRun.ok++; st.log.unshift(`+ ${name} (${r})`); } else { st.fail[id] = (st.fail[id] || 0) + 1; st.log.unshift(`— ${name}: не найдено`); } }
    catch (e) { st.fail[id] = (st.fail[id] || 0) + 1; st.log.unshift(`! ${name}: ${e.message}`); if (/Failed to fetch|NetworkError/i.test(e.message)) { st.log.unshift('Нет доступа к Liquipedia — проверьте подключение к интернету.'); afSave(st); break; } }
    afSave(st); onTick && onTick(afRun);
    await new Promise(r => setTimeout(r, 2000));
  }
  const res = afRun; afRun = null; onTick && onTick(res, true); return res;
}
window.V31Media.autoFill = autoFill; window.V31Media.autoFillStop = () => { if (afRun) afRun.stop = true; }; window.V31Media.queue = afQueue;

/* ------------------------------------------------------------ раздел в «Настройках» */
const H = window.HS; if (!H) return;
H.S.media = { kind: 'team', last: null };
const KINDS = [['team', 'Логотипы команд', 'NAVI.png, Team Spirit.png'], ['event', 'Логотипы турниров', 'IEM Katowice.png, BLAST Premier.png'], ['player', 'Фото игроков', 'donk.jpg, ZywOo.png']];
function mediaBox() {
  const f = H.S.media, list = window.V31Media.list().filter(x => x.kind === f.kind);
  const seg = KINDS.map(([k, l]) => `<button type="button" class="hm-tab${f.kind === k ? ' on' : ''}" data-mkind2="${k}" role="radio" aria-checked="${f.kind === k}">${l}</button>`).join('');
  const ex = KINDS.find(x => x[0] === f.kind)[2];
  const last = f.last ? `<div class="md-res">${f.last.ok.length ? `<p class="up">Добавлено: ${f.last.ok.map(x => H.esc(x.name)).join(', ')}</p>` : ''}${f.last.bad.map(x => `<p class="dn">${H.esc(x.f)} — ${H.esc(x.why)}</p>`).join('')}</div>` : '';
  const T = typeof teams !== 'undefined' ? teams : [], allP = T.flatMap(t => t.players || []);
  const cov = `Команды: ${T.filter(t => window.V31Media.url('team', t.name)).length}/${T.length} · игроки: ${allP.filter(p => window.V31Media.url('player', p.nick)).length}/${allP.length} · в медиатеке проекта ${Object.keys(MAN.teams || {}).length + Object.keys(MAN.players || {}).length} файлов`;
  const af = afState(), runInfo = afRun ? `Идёт поиск: ${afRun.n}/${afRun.total}, найдено ${afRun.ok}` : '';
  const autoHtml = `<div class="md-auto"><p class="hs-note">${H.esc(cov)}</p><div class="pt-actions"><button type="button" class="hs-btn" data-mauto${afRun ? ' disabled' : ''}>AUTO-FILL ALL MEDIA</button>${afRun ? '<button type="button" class="hs-btn ghost" data-mstop>Остановить</button>' : ''}</div>
    <p class="hs-note">Ищет недостающие логотипы и фото на Liquipedia по точному нику/названию, по одному запросу в 2 секунды; прогресс сохраняется. ${H.esc(runInfo)}</p><p class="hs-note">Фото с HLTV браузер получить не может (защита сайта и CORS). Их скачивает инструмент для компьютера: <code>node tools/media/autofill.mjs</code> из папки игры — инструкция в tools/media/README.md.</p>${af.log.length ? `<ul class="md-log">${af.log.slice(0, 8).map(x => `<li>${H.esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  return H.box('Логотипы и фото', `${autoHtml}<div class="hm-tabs md-seg" role="radiogroup">${seg}</div>
    <label class="md-drop" data-mdrop tabindex="0"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" multiple data-mfile hidden>
      <b>Перетащите файлы сюда или выберите</b><span>Имя файла = название: ${H.esc(ex)}. PNG, JPG, WEBP, SVG до 1.5 МБ. Используйте изображения, на которые у вас есть права.</span></label>${last}
    ${list.length ? `<div class="md-grid">${list.map(x => `<div class="md-item"><img src="${x.url}" alt=""><span>${H.esc(x.name)}</span><button type="button" class="hs-btn sm quiet danger" data-mdel="${H.esc(x.k)}" aria-label="Удалить ${H.esc(x.name)}">Удалить</button></div>`).join('')}</div>` : '<p class="hs-note">Пока нет загруженных изображений этого вида.</p>'}
    <p class="hs-note">Изображения хранятся в браузере отдельно от сейва и не попадают в экспорт.</p>`);
}
const origSettings = H.PAGES.settings;
H.PAGES.settings = () => origSettings().replace(/(<\/div><\/div>)\s*$/, `${mediaBox()}$1`);
H.CLICKS.push(['[data-mauto]', () => { autoFill((r, end) => { if (H.S.page === 'settings') H.render(); }); H.render(); }]);
H.CLICKS.push(['[data-mstop]', () => { window.V31Media.autoFillStop(); }]);
H.CLICKS.push(['[data-mkind2]', el => { H.S.media.kind = el.dataset.mkind2; H.S.media.last = null; H.render(); }]);
H.CLICKS.push(['[data-mdel]', el => { del(el.dataset.mdel).then(() => H.render()); }]);
async function take(files) { H.S.media.last = await importFiles(H.S.media.kind, [...files]); H.render(); }
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-mfile]')) take(e.target.files); });
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { const z = e.target.closest?.('[data-mdrop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { const z = e.target.closest?.('[data-mdrop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); if (t === 'drop' && e.dataTransfer?.files?.length) take(e.dataTransfer.files); }));
// файл, брошенный мимо зоны, не должен открываться вместо игры
window.addEventListener('dragover', e => { if (!e.target.closest?.('[data-mdrop]')) e.preventDefault(); });
window.addEventListener('drop', e => { if (!e.target.closest?.('[data-mdrop]')) e.preventDefault(); });
loadAll();
})();
