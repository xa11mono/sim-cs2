// (Р2.3, 25.11) Инструменты Node, которые подключают файлы игры напрямую (035_map3d.js, 385_nades_flight.js, …): код игры зовёт DM.* —
// в странице DM объявлен файлом src/game/005_dmath.ts до игры, в Node — здесь (тот же код, tools/dmath/dmath.js). Подключать первым.
'use strict';
if (typeof globalThis.DM === 'undefined') globalThis.DM = require('./dmath.js');
module.exports = globalThis.DM;
