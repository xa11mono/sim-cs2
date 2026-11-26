// (Р2.2, 25.11) dmath для инструментов Node — тот же код, что в игре: engine/core/dmath.ts (одно место), читается без типов
// (tools/rebuild/game_src.js) и выполняется отдельно. Прототип Р0.12 сохранён как tools/dmath/dmath_proto_r012.js (история).
//   const DM = require('./tools/dmath/dmath.js'); DM.sin(1) …   (+ sqrt = Math.sqrt — для старых проверок)
'use strict';
const vm = require('vm'), path = require('path');
const { readGame } = require(path.join(__dirname, '..', 'rebuild', 'game_src.js'));
const src = readGame('dmath.ts');
const DM = vm.runInNewContext(src + '\n;DM', { Float64Array, Uint32Array, Uint8Array, Uint16Array, Math, Array, Error, Infinity, NaN });
module.exports = Object.assign({}, DM, { sqrt: Math.sqrt });
