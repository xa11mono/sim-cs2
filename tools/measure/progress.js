// (26.11, прогон 335) Продвижение матча для сторожа раннера (tools/measure/procguard.py). Подгружается в процесс Node матча через
// NODE_OPTIONS=--require (src/q.js и код матча не меняются: их хэши — в совместимости resume, tools/measure/fingerprint_jobs.py).
// Что пишет: файл SIM_PROGRESS (одна строка JSON, перезапись) — состояние start / browser / run / crash / disconnected / closing, последний
// тик и время. Тик: обёртка stepTick страницы раз в SIM_PROGRESS_EVERY тиков (по умолчанию 640 = 10 с игры) зовёт привязку Playwright;
// обёртка только читает tick — игру не меняет (проверка: отпечатки с модулем и без равны, tools/measure/progress_check.js).
// Падение страницы (page 'crash') и отключение браузера (не своё закрытие) — сразу. Нет SIM_PROGRESS — ничего не делает.
'use strict';
const OUT = process.env.SIM_PROGRESS;
if (OUT) {
  const fs = require('fs'), EVERY = Math.max(1, +(process.env.SIM_PROGRESS_EVERY || 640));
  const st = { pid: process.pid, state: 'start', tick: null, n: 0, t: Date.now() };
  const put = () => { st.t = Date.now(); try { fs.writeFileSync(OUT + '.tmp', JSON.stringify(st)); fs.renameSync(OUT + '.tmp', OUT); } catch (e) { /* сторож увидит старое */ } };
  const set = s => { if (st.state !== 'crash' && st.state !== 'disconnected') st.state = s; put(); };
  put();
  // страница: обернуть stepTick внутри области игры (через её __ev); старые сборки без __ev / stepTick — без тиков (сторож — по CPU)
  const ARM = e => (typeof __ev !== 'function' ? false : __ev('(function(){ if(typeof stepTick !== "function") return false; if(stepTick.__simProgress) return true;' +
    ' var o = stepTick, E = ' + e + '; stepTick = function(){ var r = o.apply(this, arguments); if(tick % E === 0) __simProgress(tick); return r; };' +
    ' stepTick.__simProgress = 1; return true; })()'));
  function watch(p) {
    p.on('crash', () => { st.state = 'crash'; put(); });
    const bound = p.exposeBinding('__simProgress', (src, tick) => { st.tick = tick; st.n++; set('run'); }).catch(() => null);
    const E = p.evaluate.bind(p); let armed = false;
    p.evaluate = async function (fn, arg) {
      if (!armed) { armed = true; await bound; await E(ARM, EVERY).catch(() => false); }
      return E(fn, arg);
    };
  }
  function hook(pw) {
    ['chromium', 'firefox', 'webkit'].forEach(n => {
      const bt = pw[n]; if (!bt || bt.__simProgress) return; bt.__simProgress = 1; const L = bt.launch.bind(bt);
      bt.launch = async function () {
        const br = await L(...arguments); set('browser');
        br.on('disconnected', () => { if (st.state !== 'closing') { st.state = 'disconnected'; put(); } });
        const C = br.close.bind(br); br.close = function () { set('closing'); return C(...arguments); };
        const NP = br.newPage.bind(br); br.newPage = async function () { const p = await NP(...arguments); watch(p); return p; };
        return br;
      };
    });
  }
  const Module = require('module'), R = Module.prototype.require;
  Module.prototype.require = function (id) { const m = R.apply(this, arguments); if (id === 'playwright' || id === 'playwright-core') hook(m); return m; };
}
