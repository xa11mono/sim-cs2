// А3 (20.10.2026) → А5: чтение map3d.json и луч по 3D-геометрии карты. С А5 код — в игре, src/game/035_map3d.js (одно место);
// здесь — он же для node (проверки tools/map3d/*.js). Устройство файла — docs/ARCHITECTURE.md, «Карта 3D».
//   var M = m3Load(json, inflate);   inflate(Uint8Array) → Uint8Array (zlib): require('zlib').inflateSync или zInflate игры
//   m3Line(M, ax, ay, az, bx, by, bz, 'sight'), m3Hit(M, …, 'nade'), m3Floors(M, x, y), m3FloorAt(M, x, y, z)
module.exports = require('../../src/game/035_map3d.js');
