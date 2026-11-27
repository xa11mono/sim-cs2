// (Р8 п. 6, 27.11) Проверка L0 (docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md §3) — перед каждым коммитом (.githooks/pre-commit),
// секунды: устройство и правила сборки, граница показ → игра, типы, данные карт (node tools/sim.js check), модульные тесты чистых функций
// (физика гранат, список снимка, пакет отметки v2). Код 0 — всё прошло; иначе — код 1 и что упало.
// Запуск: node tools/rebuild/l0.js
'use strict';
const path = require('path'), cp = require('child_process'), ROOT = path.resolve(__dirname, '..', '..');
const steps = [
  ['устройство, граница, типы, данные карт', ['node', [path.join(ROOT, 'tools', 'sim.js'), 'check']]],
  ['физика гранат (58 проверок)', ['node', [path.join(ROOT, 'tools', 'tests', 'nade_physics_test.js')]]],
  ['список снимка', ['node', [path.join(ROOT, 'tools', 'rebuild', 'snap_vars_test.js')]]],
  ['пакет отметки v2', ['node', ['--test', path.join(ROOT, 'tools', 'marks', 'prototype', 'prototype.test.cjs')]]]
];
const t0 = Date.now(); let bad = 0;
for (const [name, [cmd, args]] of steps) { const t = Date.now(), r = cp.spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0; if (!ok) bad++;
  console.log((ok ? 'да ' : 'НЕТ') + '  ' + name + ' — ' + ((Date.now() - t) / 1000).toFixed(1) + ' с' + (ok ? '' : '\n' + ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-8).join('\n'))); }
console.log('L0: ' + (bad ? 'упало ' + bad + ' из ' + steps.length : 'всё прошло') + ' за ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
process.exit(bad ? 1 : 0);
