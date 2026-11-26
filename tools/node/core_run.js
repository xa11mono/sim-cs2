// (Р5, 26.11) ядро игры (dist/core-<карта>.js, tools/node/core_build.py) в чистом Node: ни окна, ни документа, ни заглушек — только
// стандартный JavaScript. load(файл) → __ev ядра; из командной строки — код через __ev (как src/q.js).
// Запуск: node tools/node/core_run.js <core.js> <код | @файл> [--pack=карта.simmap]   (--pack — ядро без карты, core_build.py --pack)
'use strict';
const fs = require('fs'), vm = require('vm');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: require('path').basename(file) }); return globalThis.__ev; }
// (Р5.5, 26.11) ядро без карты (core_build.py --pack) + пакет карты .simmap (tools/map-pack): карта — в globalThis.__SIM_MAP до ядра
async function loadPack(file, pack) {
  const { openMapPack } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'map-pack', 'load.mjs')).href);
  globalThis.__SIM_MAP = openMapPack(fs.readFileSync(pack)).createMatchMap(); return load(file);
}
module.exports = { load, loadPack };
if (require.main === module) {
  const P = process.argv.find(a => a.startsWith('--pack=')), argv = process.argv.filter(a => a !== P);
  let code = argv[3] || '1'; if (code[0] === '@') code = fs.readFileSync(code.slice(1), 'utf8');
  (P ? loadPack(argv[2], P.slice(7)) : Promise.resolve(load(argv[2]))).then(EV => { process.stdout.write(String(EV(code)) + '\n'); });
}
