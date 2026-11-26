// А3 (20.10.2026) → А5: чтение map3d.json и луч по 3D-геометрии карты. С А5 код — в игре, engine/map/geometry3d.js (одно место);
// здесь — он же для node (проверки tools/map3d/*.js). Устройство файла — docs/ARCHITECTURE.md, «Карта 3D».
require('../dmath/global.js');   // (Р2.3) DM — общая математика игры (файлы игры зовут DM.*)
//   var M = m3Load(json, inflate);   inflate(Uint8Array) → Uint8Array (zlib): require('zlib').inflateSync или zInflate игры
//   m3Line(M, ax, ay, az, bx, by, bz, 'sight'), m3Hit(M, …, 'nade'), m3Floors(M, x, y), m3FloorAt(M, x, y, z)
module.exports = require('../../engine/map/geometry3d.js');
