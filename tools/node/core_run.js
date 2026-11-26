// (Р5, 26.11) ядро игры (dist/core-<карта>.js, tools/node/core_build.py) в чистом Node: ни окна, ни документа, ни заглушек — только
// стандартный JavaScript. load(файл) → __ev ядра; из командной строки — код через __ev (как src/q.js).
// Запуск: node tools/node/core_run.js <core.js> <код | @файл>
'use strict';
const fs = require('fs'), vm = require('vm');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: require('path').basename(file) }); return globalThis.__ev; }
module.exports = { load };
if (require.main === module) {
  let code = process.argv[3] || '1'; if (code[0] === '@') code = fs.readFileSync(code.slice(1), 'utf8');
  const EV = load(process.argv[2]); process.stdout.write(String(EV(code)) + '\n');
}
