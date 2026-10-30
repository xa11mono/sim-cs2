// В2–В3 (21.10.2026; с размером гранаты — 30.10): луч гранаты для проверок в node — ТОТ ЖЕ, что в игре: геометрия набора карты (data/maps/<карта>/map3d.json,
// маска 'nade' + небо) и m3NadeTrace из src/game/035_map3d.js.
// const W = require('./world.js').load('mirage'); W.trace(A, B)   // A, B — [X, Y, Z] ед. игры → null | {f, n, sky}, r — полуразмер гранаты
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const G = require(path.join(ROOT, 'src', 'game', '035_map3d.js'));

function load(map) {
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'maps', map, 'map3d.json'), 'utf8'));
  const M = G.m3Load(J, G.zInflate);
  return { M, trace: (A, B, r) => G.m3NadeTrace(M, A, B, r) };
}

module.exports = { load };
