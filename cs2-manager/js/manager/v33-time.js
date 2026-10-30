/* v33 — пропуск нескольких игровых дней из шапки: «День ▾» → 3 / 5 / 7 / 14 / 30 дней или своё число.
   Дни пропускаются по одному той же функцией, что и кнопка «День» (турниры, рынок и новости обрабатываются
   как обычно); идёт индикатор, повторный клик останавливает пропуск. */
(function () {
'use strict';
let run = null;
const $ = id => document.getElementById(id);
function label(t) { const l = $('pt-skip-l'); if (l) l.textContent = t; }
async function skipDays(n) {
  if (run) { run.stop = true; return; }
  if (typeof window.skipGameCalendarDay !== 'function') return;
  run = { stop: false }; const me = run;
  for (let i = 1; i <= n && !me.stop; i++) {
    label(`Пропуск ${i}/${n}…`);
    try { window.skipGameCalendarDay(); } catch (e) { console.warn('[v33 skip]', e); break; }
    await new Promise(r => setTimeout(r, 180));
  }
  run = null; label('День');
  try { window.HS && window.HS.render(); } catch (e) {}
}
window.v33SkipDays = skipDays;
function mount() {
  const btn = $('pt-skip'); if (!btn) return false;
  if ($('pt-skipdd')) return true;
  const dd = document.createElement('div'); dd.className = 'pt-dd pt-skipdd'; dd.id = 'pt-skipdd';
  dd.innerHTML = `<button type="button" class="pt-tbtn" data-dd aria-label="Пропустить несколько дней" title="Пропустить несколько дней">▾</button>
    <div class="pt-menu right">${[3, 5, 7, 14, 30].map(d => `<button type="button" data-skipn="${d}">Пропустить ${d} ${d === 3 ? 'дня' : 'дней'}</button>`).join('')}
      <div class="pt-skipn"><input type="number" min="1" max="120" value="10" id="pt-skipn" aria-label="Сколько дней"><button type="button" class="hs-btn sm" data-skipn="custom">Пропустить</button></div></div>`;
  btn.insertAdjacentElement('afterend', dd);
  return true;
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-skipn]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const v = b.dataset.skipn === 'custom' ? Math.max(1, Math.min(120, +($('pt-skipn')?.value || 0))) : +b.dataset.skipn;
  document.querySelectorAll('.pt-dd.open').forEach(x => x.classList.remove('open'));
  if (v) skipDays(v);
}, true);
// во время пропуска кнопка «День» работает как «Стоп»
document.addEventListener('click', e => { if (run && e.target.closest?.('#pt-skip')) { e.preventDefault(); e.stopPropagation(); run.stop = true; } }, true);
const t = setInterval(() => { if (mount()) clearInterval(t); }, 300);
})();
