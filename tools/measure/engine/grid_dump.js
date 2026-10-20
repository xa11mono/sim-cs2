// (шаг 0а) выгрузка сетки видимости движка (VIS.floor/solid/ceil, высокие стены) для zoom.py / march.py. Только чтение.
// node tools/measure/engine/qfile.js <sim.html> tools/measure/engine/grid_dump.js <любой.json> runs/e0a_vis/<карта>_grid.json
visReady();
function arr(a){ var o = new Array(a.length); for(var i = 0; i < a.length; i++){ var v = a[i]; o[i] = v === Infinity ? 99999 : (v === -Infinity ? -99999 : Math.round(v*10)/10); } return o; }
JSON.stringify({W: VIS.W, cell: VIS_CELL, floor: arr(VIS.floor), solid: arr(VIS.solid), ceil: arr(VIS.ceil), segs: VIS.segs});
