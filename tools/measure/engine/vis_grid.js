// (шаг 0а) выгрузка сетки видимости движка (пол, верх препятствий, потолок; клетка VIS_CELL) — только чтение
visReady();
function q(a){ var o = new Array(a.length); for(var i = 0; i < a.length; i++){ var v = a[i]; o[i] = v === Infinity ? 9999 : (v === -Infinity ? -9999 : Math.round(v)); } return o; }
JSON.stringify({W: VIS.W, cell: VIS_CELL, floor: q(VIS.floor), solid: q(VIS.solid), ceil: q(VIS.ceil), segs: VIS.segs});
