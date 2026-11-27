// (Р6, 27.11) равенство ленивой памяти двух сборок на тике T: переменная-кэш (по реестру «кэш») — все поля, кроме памяти «ключ → ответ»,
// целиком; сама память — по общим ключам (значения равны), лишние ключи — в отчёт. node memo_cmp.js A.html B.html <матч> <тик> <перем> <поле памяти>
const pw = require('playwright'), url = require('url'), path = require('path');
const [A, B, m, T, V, F] = process.argv.slice(2);
(async () => { const br = await pw.chromium.launch(); const get = async f => { const p = await br.newPage(); await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto(url.pathToFileURL(path.resolve(f)).href); await p.waitForTimeout(1500);
  return p.evaluate(([m, T, V]) => { __ev('clockPause(true); freshMatch(' + m + '); while(tick < ' + T + ') stepTick(); 1'); return JSON.stringify(__ev(V)); }, [m, T, V]).then(JSON.parse); };
  const a = await get(A), b = await get(B); await br.close();
  const rest = o => { const c = Object.assign({}, o); delete c[F]; return JSON.stringify(c); };
  const ka = Object.keys(a[F]), kb = Object.keys(b[F]), common = ka.filter(k => k in b[F]), diff = common.filter(k => JSON.stringify(a[F][k]) !== JSON.stringify(b[F][k]));
  console.log(JSON.stringify({ var: V, field: F, tick: +T, rest_equal: rest(a) === rest(b), keys_a: ka.length, keys_b: kb.length, common: common.length, common_diff: diff.length, only_a: ka.length - common.length, only_b: kb.length - common.length }));
})();
