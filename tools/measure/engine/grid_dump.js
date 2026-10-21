// (шаг 0а) выгрузка сетки видимости движка (VIS.floor/solid/ceil, высокие стены) для zoom.py / march.py. Только чтение.
// node tools/measure/engine/qfile.js <sim.html> tools/measure/engine/grid_dump.js <любой.json> runs/e0a_vis/<карта>_grid.json
visReady();
// (А5) карта с 3D-геометрией: сетки VIS нет — пол = верхний этаж клетки (пешком), верх препятствий = пол, потолка нет
var M3g = typeof m3 === "function" && m3();
if(M3g){ VIS.W = M3g.W; var Fl = new Float32Array(M3g.W*M3g.W).fill(-Infinity);
  for(var c = 0; c < M3g.W*M3g.W; c++){ var F = M3g.floors; for(var q = F.st[c]; q < F.st[c+1]; q++) if(F.kind[q] === 1) Fl[c] = F.z[q]; }
  VIS.floor = Fl; VIS.solid = Fl; VIS.ceil = new Float32Array(M3g.W*M3g.W).fill(Infinity); VIS.segs = []; }
function arr(a){ var o = new Array(a.length); for(var i = 0; i < a.length; i++){ var v = a[i]; o[i] = v === Infinity ? 99999 : (v === -Infinity ? -99999 : Math.round(v*10)/10); } return o; }
JSON.stringify({W: VIS.W, cell: VIS_CELL, floor: arr(VIS.floor), solid: arr(VIS.solid), ceil: arr(VIS.ceil), segs: VIS.segs});
