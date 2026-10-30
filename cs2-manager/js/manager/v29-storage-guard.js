(() => {
'use strict';
/* =====================================================================
   v29 · Защита сохранений (грузится ПЕРВЫМ, до auto_script_1)
   Было: после 3–5 сезонов localStorage (≈5 млн символов на сайт; у file:// —
   общий лимит на ВСЕ локальные HTML-файлы) переполнялся. saveTeams() вызывается
   после каждого матча и падал с QuotaExceededError → матч получал победителя,
   но не продвигался по сетке (пустые слоты, «Быстро всё» останавливался),
   а матч в эфире бесконечно висел на финальном счёте.
   Стало: запись никогда не роняет игру. При переполнении: удаляем старые ключи
   прошлых версий игры, ужимаем историю/архив и пробуем ещё раз. Если места всё
   равно нет — игра продолжает работать, а сверху появляется подсказка сделать экспорт.
   ===================================================================== */
const ACTIVE_KEYS = new Set([
  'cs2_season_state_v61', 'cs2_season_teams_v61', 'cs2_transfer_market_v1', 'cs2_hltv_archive_v1',
  'cs2_player_awards_v1', 'cs2_rating_balance_v4_applied', 'cs2_mirage_roles_v2',
  'cs2_news_v1', 'cs2_fan_v1'
]);
const ARCHIVE_KEY = 'cs2_hltv_archive_v1';
const proto = Storage.prototype;
const rawSet = proto.setItem;
const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));
let warned = false;

function usage() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {} return n; }
function dropLegacyKeys() { // ключи старых версий этой же игры (cs2_season_state_v60 и т. п.)
  let freed = 0;
  try {
    const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
    ks.forEach(k => { if (/^cs2_/i.test(k) && !ACTIVE_KEYS.has(k)) { freed += (localStorage.getItem(k) || '').length; localStorage.removeItem(k); } });
  } catch (e) {}
  return freed;
}
function trimTeams(level) {
  try {
    if (typeof teams === 'undefined' || !Array.isArray(teams)) return;
    const cur = (typeof seasonState !== 'undefined' && seasonState?.currentSeason) || 1;
    const keepSeasons = level >= 3 ? 1 : 2;
    teams.forEach(t => {
      if (Array.isArray(t.history)) {
        t.history = t.history.filter(h => {
          if (!h) return false;
          if (h.place === 1 && !h.isBootcamp) return true;                         // трофеи храним всегда
          const old = (Number(h.season) || cur) < cur - keepSeasons;
          const background = String(h.archiveId || '').startsWith('P-') || /Фонов/.test(h.placeTitle || '');
          if (background) return !old && level < 3;
          return !old || (level < 2 && (h.isMajor || h.isElite));
        });
      }
      if (Array.isArray(t.mapHistory)) t.mapHistory = t.mapHistory.slice(0, level >= 2 ? 12 : 30);
    });
  } catch (e) {}
}
function trimArchive(level) {
  try {
    const arch = window.hubArchiveExport ? window.hubArchiveExport() : null;
    if (!arch) return;
    const cur = (typeof seasonState !== 'undefined' && seasonState?.currentSeason) || 1;
    const ids = Object.keys(arch).sort((a, b) => (arch[a].ts || 0) - (arch[b].ts || 0));
    ids.forEach(id => { const s = arch[id]; if (s && ['tier3', 'academy'].includes(s.prestige) && (s.season || cur) < cur) delete arch[id]; });
    if (level >= 2) { const rest = Object.keys(arch).sort((a, b) => (arch[a].ts || 0) - (arch[b].ts || 0)); rest.slice(0, Math.ceil(rest.length * 0.25)).forEach(id => delete arch[id]); }
    try { rawSet.call(localStorage, ARCHIVE_KEY, JSON.stringify(arch)); } catch (e) {}
  } catch (e) {}
}
function trimMisc(level) {
  try { if (typeof transferState !== 'undefined' && Array.isArray(transferState.history)) transferState.history = transferState.history.slice(0, level >= 2 ? 40 : 80); } catch (e) {}
  try { if (typeof window.v29NewsTrim === 'function') window.v29NewsTrim(level); } catch (e) {}
}
function freshValue(key, value) { // после ужатия данных в памяти — сериализуем заново
  try {
    if (key === 'cs2_season_teams_v61' && typeof teams !== 'undefined') return JSON.stringify(teams);
    if (key === 'cs2_season_state_v61' && typeof seasonState !== 'undefined') return JSON.stringify(seasonState);
    if (key === 'cs2_transfer_market_v1' && typeof transferState !== 'undefined') return JSON.stringify(transferState);
  } catch (e) {}
  return value;
}
function warn() {
  if (warned) return; warned = true;
  console.warn('[v29] localStorage переполнен — часть данных не сохранена');
  const show = () => {
    const box = document.getElementById('event-alert-box');
    if (box) { box.style.display = 'block'; box.innerHTML = '⚠️ <b>Хранилище браузера заполнено.</b> Игра продолжает работать, но часть прогресса может не сохраниться. Откройте ☰ → 💾 Экспорт, чтобы сохранить сейв в файл.'; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
}
let compacting = false;
proto.setItem = function (key, value) {
  try { return rawSet.call(this, key, value); }
  catch (e) {
    if (!isQuota(e) || this !== window.localStorage || compacting) throw e;
    compacting = true;
    try {
      for (let level = 1; level <= 3; level++) {
        if (level === 1) dropLegacyKeys();
        trimTeams(level); trimMisc(level);
        if (key !== ARCHIVE_KEY) trimArchive(level);
        try { rawSet.call(this, key, freshValue(key, value)); console.info('[v29] сохранение после ужатия данных, уровень', level, '• занято ~', usage()); return; }
        catch (e2) { if (!isQuota(e2)) throw e2; }
      }
    } finally { compacting = false; }
    if (key === ARCHIVE_KEY) throw e;     // у архива HLTV своя логика вытеснения
    warn();                                // остальные записи не роняют игру
  }
};
window.v29StorageUsage = usage;
window.v29CompactSaves = (level = 1) => { dropLegacyKeys(); trimTeams(level); trimMisc(level); trimArchive(level); };
})();
