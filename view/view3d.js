// ======================= v571 (13.11.2026): 3D-ВИД — только показ =======================
// Владелец 13.11 (2 скриншота): наклонный 3D-вид — тёмный пол, светлые ящики, игроки-капсулы с табличкой ника, слева колонка кнопок.
// Включается кнопкой «3D» (по умолчанию 2D). Одно место 3D-рисования; игру не трогает: только читает bots, smokes, fires, nadesInAir,
// tracers, bomb, view (камера 2D = камера обсервера). Своё WebGL2 без библиотек (страница — один файл, работает без сети).
// Сцена — один раз при первом включении (d3Build):
//   пол   — навмеш (NAVAREAS, высоты углов) + «бортик» вниз по краю участка: видно ступени и этажи;
//   ящики — 3D-геометрия игры (m3(), флаг «взгляд» — без невидимых клипов): треугольники и выпуклые блоки не выше D3_CUT над полом
//           пешком под ними (высокие стены зданий срезаны — карта читается сверху, как на скриншотах владельца); природный рельеф
//           (скалы, земля) — не ящики; рёбра — по излому граней.
// Координаты сцены: x, z — px радара 0..2048 (z = y радара), y — высота = ед. игры × 0,4 (1 px радара = 2,5 ед.).
// Камера: цель и приближение — из view (обсервер ведёт её и в 3D), поворот и наклон — свои (D3.yaw / D3.pitch).
// Цвета — токены :root (--v3-*, DESIGN.md «3D-вид»).
var D3_FP_AIM = 0.26, D3_FP_PRATE = 87*Math.PI/180, D3_FP_PEASE = 6;   // от первого лица: на врага — если смотрит в ± 15°; наклон ≤ 87°/с (p99 про); плавность 6/с — проектное
var D3_TR_SHOT = 58, D3_TR_HIT = 50;   // ед. игры: трассер — от оружия у глаз (глаза 64), в грудь цели (проектные)
var D3 = {on: false, xray: false, sims: true, corpse: {}, mode: "view", tgt: null, nadeLast: null, style: 0, cam: "view", hist: {}, fpId: null, noTags: false, gl: null, built: false, failed: null, yaw: 0, pitch: 0.95, yawT: 0, pitchT: 0.95, top: false, lock: false,
          tz: null, drag: null, tagEls: {}, nadeZ: [], smZ: new WeakMap(), trZ: new WeakMap()};
var D3_KZ = 0.4;               // ед. игры → px радара (высота)
var D3_CUT = 150;              // проектное число: выше этого над полом геометрия не рисуется (ящик 64, два ящика 128 ед.)
var D3_FOV = 38 * Math.PI/180;
var D3_LOW = 28;               // проектное число: опущенная стена «как в Симсе» — бортик, ед. игры
// виды мира (владелец 13.11: «прозрачный был лучше — от него, но сделай несколько вариаций»): a — плотность граней, ea — яркость рёбер
var D3_STYLES = [{id: "glass", name: "стекло", a: 0.32, ea: 0.6}, {id: "line", name: "контур", a: 0.1, ea: 0.85}, {id: "solid", name: "макет", a: 1, ea: 0.3}];
var D3_HIDE = {"default": 1};   // (владелец 13.11: «дырки и странные объекты — как будто посчитаны невидимые стены») служебные плоскости карты (блокираторы взгляда) — не рисуются: из 25 треугольников больше 200000 ед² у Mirage 22 — этот материал
var D3_SOFT = {rock:1, grass:1, mud:1, dirt:1, sand:1, boulder:1, Wood_Tree:1, foliage:1, gravel:1, snow:1};   // природный рельеф — не ящики

// ---------- матрицы (столбцами) ----------
function d3Persp(f, a, n, fa){ var t = 1/Math.tan(f/2), o = new Float32Array(16); o[0] = t/a; o[5] = t; o[10] = (fa+n)/(n-fa); o[11] = -1; o[14] = 2*fa*n/(n-fa); return o; }
function d3Look(e, c){
  var zx = e[0]-c[0], zy = e[1]-c[1], zz = e[2]-c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;       // вверх = +y
  var yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx*e[0]+xy*e[1]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]);
}
function d3Mul(a, b){ var o = new Float32Array(16); for(var i = 0; i < 4; i++) for(var j = 0; j < 4; j++){ var s = 0; for(var k = 0; k < 4; k++) s += a[k*4+j]*b[i*4+k]; o[i*4+j] = s; } return o; }
function d3Model(x, y, z, sx, sy, sz){ return new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,sz,0, x,y,z,1]); }
function d3Rot(x, y, z, f, lx, ly, lz){ var c = Math.cos(f), s = Math.sin(f); return new Float32Array([c*lx,0,s*lx,0, 0,ly,0,0, -s*lz,0,c*lz,0, x,y,z,1]); }   // поворот вокруг вертикали: ось x → взгляд
function d3R(n){ var v = Math.sin(n)*43758.5453; return v - Math.floor(v); }   // раскладка клубов дыма, как fxR в 620 (без Math.random)
function d3Hex(s, a){ s = (s || "").trim(); var m = /^#([0-9a-f]{6})$/i.exec(s); var n = m ? parseInt(m[1], 16) : 0x808080; return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255, a == null ? 1 : a]; }
function d3Tok(name, def){ try{ var v = getComputedStyle(document.documentElement).getPropertyValue(name); return v && v.trim() ? v.trim() : def; }catch(e){ return def; } }

// ---------- WebGL ----------
var D3_VS = "#version 300 es\nin vec3 aP; in vec3 aN; in vec4 aC; uniform mat4 uVP, uM; uniform vec4 uTint; uniform vec3 uEye;\n" +
  "out vec3 vN, vV; out vec4 vC; out float vD; void main(){ vec4 w = uM*vec4(aP,1.0); vN = mat3(uM)*aN; vC = aC*uTint; vV = uEye - w.xyz; vD = length(vV); gl_Position = uVP*w; }";
var D3_FS = "#version 300 es\nprecision highp float; in vec3 vN, vV; in vec4 vC; in float vD; uniform vec3 uL, uBg, uEye; uniform vec2 uFog; uniform float uLit, uSoft, uHr; uniform int uHn; uniform vec3 uHa[8], uHb[8]; out vec4 o;\n" +
  "void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; float d = max(dot(n, uL), 0.0), h = 0.5 + 0.5*n.y;\n" +
  " vec3 c = vC.rgb*mix(1.0, 0.34 + 0.40*h + 0.46*d, uLit); c = mix(c, uBg, smoothstep(uFog.x, uFog.y, vD));\n float a = vC.a*mix(1.0, pow(abs(dot(n, normalize(vV))), 1.6), uSoft);\n vec3 w = uEye - vV; for(int i = 0; i < 8; i++){ if(i >= uHn) break; vec3 ab = uHb[i] - uHa[i]; float t = clamp(dot(w - uHa[i], ab)/max(1e-3, dot(ab, ab)), 0.0, 1.0);\n  a *= smoothstep(uHr*0.45, uHr, distance(w, uHa[i] + ab*t)); }\n o = vec4(c, a); }";   // дыры от пуль в дыму (smokeBulletHole, 360) — у линии пули облако прозрачное
var D3_LVS = "#version 300 es\nin vec3 aP; in vec4 aC; uniform mat4 uVP; uniform vec3 uEye; out vec4 vC; out float vD;\n" +
  "void main(){ vC = aC; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); gl_Position.z -= 0.0006*gl_Position.w; }";
var D3_LFS = "#version 300 es\nprecision mediump float; in vec4 vC; in float vD; uniform vec2 uFog; out vec4 o;\n" +
  "void main(){ o = vec4(vC.rgb, vC.a*(1.0 - smoothstep(uFog.x, uFog.y, vD))); }";
// мир: срез по таблице этажей; нормаль — по экранным производным (плоские грани); изнанка в разрезе — «крышка»
var D3_WVS = "#version 300 es\nin vec3 aP; in float aK; uniform mat4 uVP; out vec3 vW; out float vK; void main(){ vW = aP; vK = aK; gl_Position = uVP*vec4(aP,1.0); }";
var D3_CUTF = "uniform highp sampler2D uF; uniform float uCut, uLow, uSims, uRf, uFb; uniform vec3 uTgt;\n" +
  "float refY(vec3 w){ ivec2 b = ivec2(floor(w.x/8.0), floor(w.z/8.0)); if(b.x < 0 || b.y < 0 || b.x > 255 || b.y > 255) return -1e9;\n" +
  " vec4 a = texelFetch(uF, ivec2(b.x*2, b.y), 0), c = texelFetch(uF, ivec2(b.x*2+1, b.y), 0); float lim = w.y + 3.2, r = -1e9;\n" +
  " if(a.x <= lim) r = max(r, a.x); if(a.y <= lim) r = max(r, a.y); if(a.z <= lim) r = max(r, a.z); if(a.w <= lim) r = max(r, a.w);\n" +
  " if(c.x <= lim) r = max(r, c.x); if(c.y <= lim) r = max(r, c.y); if(c.z <= lim) r = max(r, c.z); if(c.w <= lim) r = max(r, c.w);\n" +
  // (владелец 13.11: «дырки в стенках») этажи в блоке есть, но все выше точки (низ стены у возвышения) — стена видна, а не выброшена
  " if(r < -1e8 && a.x > -1e8 && uFb > 0.5) r = w.y - 30.0; return r; }\n" +   // только стены: пол внутри возвышения так не рисуется
  // (владелец 13.11: «как в Симсе») опущена до бортика только стена между камерой и местом, куда она смотрит (ближе к камере, чем
  // точка взгляда, и не дальше uRf от неё), и только если за ней (от камеры) сразу пол; дальние стены и навесы — целые
  "float cutAt(vec3 w, vec3 eye){ if(uSims < 0.5) return uCut; vec2 d = w.xz - eye.xz; float l = length(d); if(l < 1.0) return uCut;\n" +
  " vec2 ct = eye.xz - uTgt.xz; if(dot(w.xz - uTgt.xz, ct) <= 0.0 || distance(w.xz, uTgt.xz) > uRf) return uCut;\n" +
  " vec2 b = w.xz + d/l*22.0; float rb = refY(vec3(b.x, 1e6, b.y)); return rb > -1e8 && rb < w.y - uLow ? uLow : uCut; }\n";   // за стеной весь пол ниже неё — стена; этаж на уровне её верха (бок балкона, ступени) — не опускать
var D3_WFS = "#version 300 es\nprecision highp float; in vec3 vW; in float vK; uniform vec3 uEye, uL, uBg, uProp, uRock, uCap, uGround; uniform vec2 uFog, uZr; uniform float uA; out vec4 o;\n" + D3_CUTF +
  "void main(){ float r = refY(vW); if(r < -1e8) discard; float h = vW.y - r, cu = cutAt(vW, uEye); if(h > cu) discard;\n" +
  " vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if(dot(n, uEye - vW) < 0.0) n = -n; vec3 c;\n" +
  " if(vK > 1.5){ float t = clamp((vW.y - uZr.x)/max(1.0, uZr.y - uZr.x), 0.0, 1.0); c = uGround*(0.86 + 0.32*t)*(0.95 + 0.07*max(dot(n, uL), 0.0)); }\n" +
  " else if(!gl_FrontFacing && uA >= 1.0) c = uCap; else { vec3 base = mix(uProp, uRock, vK); float d = max(dot(n, uL), 0.0), hm = 0.5 + 0.5*n.y;\n" +
  "  c = base*(0.30 + 0.36*hm + 0.50*d); c *= mix(0.55, 1.0, smoothstep(0.0, 26.0, h)); }\n" +
  " if(vK < 1.5) c = mix(c, uCap*1.06, smoothstep(cu - 1.4, cu, h)*0.85);\n" +
  " float f = smoothstep(uFog.x, uFog.y, distance(vW, uEye)); float rim = smoothstep(cu - 1.4, cu, h);\n" +
  " if(uA < 1.0) o = vec4(c, (uA + rim*0.5)*(1.0 - f)); else o = vec4(mix(c, uBg, f), 1.0); }";
var D3_ELVS = "#version 300 es\nin vec3 aP; uniform mat4 uVP; out vec3 vW; void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.0); gl_Position.z -= 0.0006*gl_Position.w; }";
var D3_ELFS = "#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye; uniform vec4 uC; uniform vec2 uFog; out vec4 o;\n" + D3_CUTF +
  "void main(){ float r = refY(vW); if(r < -1e8 || vW.y - r > cutAt(vW, uEye) + 0.2) discard; o = vec4(uC.rgb, uC.a*(1.0 - smoothstep(uFog.x, uFog.y, distance(vW, uEye)))); }";
function d3Prog(gl, vs, fs){
  function sh(t, s){ var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for(var i = 0; i < n; i++){ var nm = gl.getActiveUniform(p, i).name; u[nm.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, nm); }
  return {p: p, u: u, aP: gl.getAttribLocation(p, "aP"), aN: gl.getAttribLocation(p, "aN"), aC: gl.getAttribLocation(p, "aC"), aK: gl.getAttribLocation(p, "aK")};
}
// сетка: P (x,y,z), N, C (r,g,b,a) — по вершине, без индексов
function d3Mesh(gl, P, N, C){
  function buf(a){ var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; }
  return {p: buf(P instanceof Float32Array ? P : new Float32Array(P)), n: buf(N instanceof Float32Array ? N : new Float32Array(N)),
          c: buf(C instanceof Float32Array ? C : new Float32Array(C)), cnt: P.length/3};
}
function d3Attr(gl, loc, b, sz){ if(loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, 0, 0); }
// сборщик треугольников с плоской нормалью
function d3Acc(){
  var P = [], N = [], C = [];
  return {P: P, N: N, C: C,
    tri: function(a, b, c, col){
      var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
      var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, l = Math.hypot(nx, ny, nz); if(l < 1e-9) return false; nx /= l; ny /= l; nz /= l;
      P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      var c0 = Array.isArray(col[0]) ? col : null;   // цвет на каждую вершину или один на треугольник
      for(var i = 0; i < 3; i++){ var q = c0 ? c0[i] : col; C.push(q[0], q[1], q[2], q[3]); }
      return true;
    }};
}

// ---------- пол «пешком» под точкой (сетка map3d), по блокам 8 px — с соседями: у стенки ящика клетка внутри ящика пола не имеет ----------
var D3_FB = null;
function d3FloorBlocks(M){
  if(D3_FB) return D3_FB;
  var BS = 4, BN = Math.ceil(M.W / BS), L = new Array(BN*BN), st = M.floors.st, fz = M.floors.z, fk = M.floors.kind;
  for(var j = 0; j < M.W; j++) for(var i = 0; i < M.W; i++){
    var c = j*M.W + i; for(var q = st[c]; q < st[c+1]; q++){ if(fk[q] !== 1) continue;
      var z = fz[q], bi = (i / BS) | 0, bj = (j / BS) | 0;
      for(var dj = -1; dj <= 1; dj++) for(var di = -1; di <= 1; di++){ var x = bi+di, y = bj+dj; if(x < 0 || y < 0 || x >= BN || y >= BN) continue;
        var k = y*BN + x, A = L[k] || (L[k] = []); var dup = false; for(var t = 0; t < A.length; t++) if(Math.abs(A[t] - z) < 6){ dup = true; break; }
        if(!dup) A.push(z); } } }
  return (D3_FB = {BS: BS, BN: BN, L: L});
}
// пол под точкой для объектов без высоты (дым, огонь, бомба): ближайший к подсказке этаж клетки
function d3FloorNear(x, y, zh){
  var M = m3(); if(M){ var c = m3Cell(M, x, y); if(c >= 0){ var st = M.floors.st, fz = M.floors.z, best = null;
    for(var q = st[c]; q < st[c+1]; q++){ var z = fz[q]; if(zh == null ? (best === null || z > best) : (best === null || Math.abs(z - zh) < Math.abs(best - zh))) best = z; }
    if(best !== null && (zh == null || Math.abs(best - zh) < 120)) return best; } }
  var a = typeof navAt === "function" ? navAt(x, y, zh) : null;
  return a ? (typeof navFloorZ === "function" ? navFloorZ(a, x, y) : a.z) : (zh != null ? zh : 0);
}

// пол под точкой: высший этаж клетки не выше z (+ 2 ед.); без z — высший; нет этажей — навмеш (ед. игры)
function d3FloorBelow(x, y, z){
  var M = m3(); if(M){ var c = m3Cell(M, x, y); if(c >= 0){ var st = M.floors.st, fz = M.floors.z, best = null, lo = null;
    for(var q = st[c]; q < st[c+1]; q++){ var v = fz[q]; if(lo === null || v < lo) lo = v; if((z == null || v <= z + 2) && (best === null || v > best)) best = v; }
    if(best !== null) return best; if(lo !== null) return lo; } }
  return d3FloorNear(x, y, z);
}
// (Д8) путь игрока по тикам: [x, y, высота сцены], 4 с
function d3Hist(b, x, y, z){
  var H = D3.hist[b.id] || (D3.hist[b.id] = []);
  if(!b.alive){ if(H.length) H.length = 0; return; }
  if(H.length && H[H.length-1][3] === tick) return;
  H.push([b.x, b.y, z, tick]); while(H.length > 4*TICK_HZ || (H.length && tick - H[0][3] > 4*TICK_HZ)) H.shift();
}
// от первого лица — за кем: слежка обсервера, выбранный игрок, иначе живой ближе всех к центру экрана
function d3FpBot(){
  // (владелец 13.11: «если камера от лица — игроков не переключает») вручную: закреплённый игрок; погиб — ближайший живой свой
  if(D3.cam === "fp" && D3.fpLock){ var L0 = bots.filter(function(o){ return o.id === D3.fpLock; })[0];
    if(L0 && L0.alive) return L0;
    var nx = bots.filter(function(o){ return o.alive && L0 && o.team === L0.team; }).sort(function(a, c){ return Math.hypot(a.x - L0.x, a.y - L0.y) - Math.hypot(c.x - L0.x, c.y - L0.y); })[0];
    if(nx){ D3.fpLock = nx.id; return nx; } }
  if(D3.cam === "auto" && D3.autoFp){ var A0 = bots.filter(function(o){ return o.id === D3.autoFp.id && o.alive; })[0]; if(A0) return A0; }
  var id = OBS.lock || OBS.id || plSelected, b = id && bots.filter(function(o){ return o.id === id && o.alive; })[0]; if(b) return b;
  var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale, bd = Infinity;
  bots.forEach(function(o){ if(!o.alive) return; var d = Math.hypot(o.x - cx, o.y - cy); if(d < bd){ bd = d; b = o; } });
  return b || null;
}
// (владелец 13.11: «моделька после смерти остаётся, голова и туловище получают физику и скатываются») тело: корпус падает вокруг
// ступней в сторону от убийцы (или назад от взгляда), у пола — отскок и трение; голова отрывается при ударе и катится; стены — лучом
// по геометрии (m3Line). Только показ, своё время — по тикам игры (пауза — стоит), до нового раунда.
function d3Corpse(b, draw, col, sz){
  var C = D3.corpse[b.id], H = D3.hist[b.id], M = m3();
  if(!C){
    var last = H && H.length ? H[H.length-1] : [b.x, b.y, (b.z || 0)*D3_KZ, tick], ang = (b._visFacing !== undefined ? b._visFacing : (b.facing || 0)) + Math.PI;
    var kb = b._killedBy && b._killedBy.x != null ? b._killedBy : null; if(kb) ang = Math.atan2(b.y - kb.y, b.x - kb.x);
    ang += (d3R(tick*0.37 + b.x) - 0.5)*0.8;
    var h = 27*1.15;   // размер тела — как у фигуры вблизи (не по удалению камеры)
    C = D3.corpse[b.id] = {t: tick, dx: Math.cos(ang), dz: Math.sin(ang), th: 0.05, w: 0, x: last[0], y: last[2], zz: last[1], h: h, landed: false,
      head: null, v: [Math.cos(ang)*18, 0, Math.sin(ang)*18]};
    if(H) H.length = 0;
  }
  var steps = Math.min(16, Math.max(0, tick - (C.tk || C.t))); C.tk = tick;
  var DT = 1/TICK_HZ, G = 320;   // сила тяжести, px сцены/с² (800 ед/с²)
  var wallOk = function(x0, z0, x1, z1, y){ if(!M) return true; var a = m3Game(M, x0, z0), c = m3Game(M, x1, z1); return m3Line(M, a[0], a[1], y/D3_KZ + 8, c[0], c[1], y/D3_KZ + 8, "sight"); };
  for(var i = 0; i < steps; i++){
    if(!C.landed){ C.w += (G/(C.h*0.55))*Math.sin(C.th)*DT; C.th += C.w*DT;   // падает вокруг ступней
      var nx = C.x + C.v[0]*DT, nz = C.zz + C.v[2]*DT; if(wallOk(C.x, C.zz, nx, nz, C.y)){ C.x = nx; C.zz = nz; } else { C.v[0] *= -0.3; C.v[2] *= -0.3; }
      C.v[0] *= 0.97; C.v[2] *= 0.97;
      if(C.th >= Math.PI/2){ C.th = Math.PI/2; C.landed = true;   // удар об пол — голова отрывается и катится дальше
        var tip = [C.x + C.dx*C.h*0.95, C.y, C.zz + C.dz*C.h*0.95], sp = C.w*C.h*0.5;
        sp = Math.min(sp, 40); C.head = {p: [tip[0], tip[1] + C.h*0.13, tip[2]], v: [C.dx*sp*0.3 + (d3R(C.t)-0.5)*6, sp*0.05, C.dz*sp*0.3 + (d3R(C.t+1)-0.5)*6], r: C.h*0.13, rot: 0}; } }   // голова откатывается недалеко
    var hd = C.head; if(hd && (Math.abs(hd.v[0]) + Math.abs(hd.v[1]) + Math.abs(hd.v[2]) > 0.5)){
      hd.v[1] -= G*DT; var hx = hd.p[0] + hd.v[0]*DT, hz = hd.p[2] + hd.v[2]*DT;
      if(wallOk(hd.p[0], hd.p[2], hx, hz, hd.p[1])){ hd.p[0] = hx; hd.p[2] = hz; } else { hd.v[0] *= -0.4; hd.v[2] *= -0.4; }
      hd.p[1] += hd.v[1]*DT; var fl = d3FloorBelow(hd.p[0], hd.p[2], hd.p[1]/D3_KZ + 4)*D3_KZ;
      if(hd.p[1] - hd.r < fl){ hd.p[1] = fl + hd.r; hd.v[1] = Math.abs(hd.v[1]) > 8 ? -hd.v[1]*0.3 : 0; hd.v[0] *= 0.82; hd.v[2] *= 0.82; }
      hd.rot += Math.hypot(hd.v[0], hd.v[2])*DT/hd.r; }
  }
  var dc = [col[0]*0.6, col[1]*0.6, col[2]*0.6, 1], sn = Math.sin(C.th), cs = Math.cos(C.th);
  var side = [-C.dz, 0, C.dx], u = [C.dx*sn, cs, C.dz*sn], f = [side[1]*u[2] - side[2]*u[1], side[2]*u[0] - side[0]*u[2], side[0]*u[1] - side[1]*u[0]];
  var R = C.h*0.6, Hh = C.h*0.8, base = [C.x, C.y + 0.3 + (C.landed ? C.h*0.12 : 0), C.zz];
  draw(D3.capsule, new Float32Array([side[0]*R, side[1]*R, side[2]*R, 0, u[0]*Hh, u[1]*Hh, u[2]*Hh, 0, f[0]*R, f[1]*R, f[2]*R, 0, base[0], base[1], base[2], 1]), dc, 1);
  var hp = C.head ? C.head.p : [base[0] + u[0]*C.h*0.9, base[1] + u[1]*C.h*0.9, base[2] + u[2]*C.h*0.9], hr = C.h*0.13;
  draw(D3.sphere, d3Model(hp[0], hp[1], hp[2], hr, hr, hr), [dc[0]*1.25, dc[1]*1.25, dc[2]*1.25, 1], 1);
}
// камера за гранатой: летящая граната следимого (или последняя брошенная) — сзади по ходу; сработала — ещё 1,5 с на месте
function d3NadeCam(){
  var fid = OBS.lock || OBS.id || plSelected, L = nadesInAir.filter(function(n){ return n.z != null; }), n = null;
  if(fid) n = L.filter(function(q){ return q.thrower && q.thrower.id === fid; }).slice(-1)[0];
  if(!n) n = L.slice(-1)[0];
  // (v583a, Д25, владелец 18.11: «граната летит — камера очень быстро дёргается») направление — по следу за ~8 точек, а не по последнему
  // шагу (на отскоке разворачивалось за кадр), камера догоняет медленнее (k3 «nade» — ниже)
  if(n){ var tr = n.trail || [], pr = tr.length ? tr[Math.max(0, tr.length-8)] : [n.x - 1, n.y, n.z];
    var dx = n.x - pr[0], dy = n.y - pr[1], l = Math.hypot(dx, dy); if(l < 0.01){ dx = 1; dy = 0; l = 1; }
    var P = [n.x, n.z*D3_KZ, n.y], eye = [P[0] - dx/l*55, P[1] + 22, P[2] - dy/l*55];
    D3.nadeLast = {eye: eye, p: P, t: tick}; return {eye: eye, tgt: [P[0] + dx/l*30, P[1] - 4, P[2] + dy/l*30]}; }
  if(D3.nadeLast && tick - D3.nadeLast.t < 1.5*TICK_HZ) return {eye: D3.nadeLast.eye, tgt: D3.nadeLast.p};
  return null;
}
// «авто» (обсервер под 3D): закупка и конец раунда — пролёт; следимый бросил гранату — камера за ней; иначе — обзор (ведёт обсервер)
// (владелец 13.11: «обсервер не чередует разные виды») в раунде виды сменяются по очереди: обзор → за спиной → обзор → от первого лица;
// смена следимого — снова с обзора (видно, за кем смотрим); граната следимого — за ней
// «авто» (владелец 13.11: «обсервер следит в основном за игроками: на закупке летает рядом медленно, под красивым углом, смотрит, как стоят на
// спавне; на паузе — летает по карте; в раунде в основном от первого лица; иногда — как кто-то кидает гранату и как она летит; иногда общий вид»):
//   закупка / конец раунда — облёт команды на спавне (по очереди T и CT, D3_SPAWN_SEC); тактическая пауза — пролёт по карте;
//   раунд — от первого лица: в перестрелке — тот, кто стреляется (следимый обсервером, если он в бою), иначе — следимый обсервером;
//   граната следимого — за гранатой; раз в D3_OVER_EVERY с — общий вид на D3_OVER_SEC с
var D3_FP_HOLD = 1.5, D3_SPAWN_SEC = 8, D3_OVER_EVERY = 25, D3_OVER_SEC = 5;   // проектные числа, с
function d3Fighting(b){ return b && b.alive && (b._visible || []).some(function(o){ return o.alive && o.team !== b.team; }); }
function d3AutoCam(){
  // (v583a, Д24, владелец 18.11: «включается пролёт — летает по карте бесконечно») TO_NOW держится до конца следующего раунда (130), пролёт —
  // только пока идёт пауза (закупка этого раунда); было: весь раунд после паузы
  if(typeof TO_NOW !== "undefined" && TO_NOW && roundState === "freeze" && TO_NOW.round === roundNum) return "flythru";
  if(roundState === "freeze" || roundState === "ending"){ D3.autoFp = null; D3.overT = tick; return "spawn"; }
  var oid = OBS.lock || OBS.id, ob = oid && bots.filter(function(o){ return o.id === oid; })[0];
  if(nadesInAir.some(function(n){ return n.z != null && n.thrower && n.thrower.id === (D3.autoFp ? D3.autoFp.id : oid); }) || (D3.nadeLast && tick - D3.nadeLast.t < 1.2*TICK_HZ)) return "nade";
  if(D3.overT == null) D3.overT = tick;
  var anyFight = bots.some(d3Fighting);
  if(!anyFight && obsPickBest(null).s >= OBS_K.soon) anyFight = true;   // (Д24) бой вот-вот — общий вид не включать
  if(!anyFight && tick - D3.overT > D3_OVER_EVERY*TICK_HZ){ if(tick - D3.overT < (D3_OVER_EVERY + D3_OVER_SEC)*TICK_HZ) return "view"; D3.overT = tick; }
  // (v583a, Д24, владелец 18.11: «поздно переключается, непонятно, кто кого убивает — переключать заранее») от первого лица — тот же игрок, что
  // выбрал обсервер (670: счёт obsScore — «скоро бой»: враг рядом смотрит на него, сближаются, выход на сайт), а не первый, кто уже увидел врага;
  // обсервер выключен — лучший по тому же счёту. Держать не меньше D3_FP_HOLD с, если игрок жив (было: 4 с — бой в другом месте пропускали)
  var A = D3.autoFp, cur = A && bots.filter(function(o){ return o.id === A.id; })[0];
  var nb = OBS.on && ob && ob.alive ? ob : obsPickBest(null).b;
  if(cur && cur.alive && nb && nb !== cur && tick - A.t0 < D3_FP_HOLD*TICK_HZ && !(OBS.on && ob === nb)) nb = cur;
  if(!OBS.on && cur && cur.alive && nb && nb !== cur && obsScore(nb) < obsScore(cur)*OBS_K.more) nb = cur;
  if(nb){ if(!A || A.id !== nb.id) D3.autoFp = {id: nb.id, t0: tick}; return "fp"; }
  return "view";
}
// закупка (владелец 13.11: «летать вокруг, медленно пролетать между игроками, подбирать красивые ракурсы»): планы по очереди, каждый
// D3_SPAWN_SEC с, стороны чередуются: облёт команды; проезд вдоль строя на уровне груди с взглядом на ближайшего; крупный план игрока снизу,
// лицом к нему, с лёгким поворотом. Камера не заходит в стену: луч от цели до камеры по геометрии, упёрся — камера ближе
function d3SpawnCam(){
  var segLen = D3_SPAWN_SEC*TICK_HZ, seg = Math.floor(tick / segLen), u = (tick % segLen) / segLen;
  var side = seg % 2 ? "CT" : "T", P = bots.filter(function(o){ return o.alive && o.team === side; });
  if(!P.length) return null;
  var cx = 0, cy = 0, cz = 0; P.forEach(function(o){ cx += o.x; cy += o.y; cz += (o.z || 0); }); cx /= P.length; cy /= P.length; cz = cz/P.length*D3_KZ;
  var shot = Math.floor(seg / 2) % 3, eye, tgt;
  if(shot === 0){ var a = u*1.2 + seg*1.7; eye = [cx + Math.cos(a)*150, cz + 70, cy + Math.sin(a)*150]; tgt = [cx, cz + 12, cy]; }
  else if(shot === 1){
    var S = P.slice().sort(function(p, q){ return (p.x - cx)*(q.y - cy) > 0 ? p.x - q.x : p.y - q.y; }), A0 = S[0], B0 = S[S.length-1];
    var dx = B0.x - A0.x, dy = B0.y - A0.y, L = Math.hypot(dx, dy) || 1, nx = -dy/L, ny = dx/L, px = A0.x + dx*u, py = A0.y + dy*u;
    eye = [px + nx*45, cz + 26, py + ny*45];
    var nb = P.slice().sort(function(p, q){ return Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py); })[0];
    tgt = [nb.x, (nb.z || 0)*D3_KZ + 20, nb.y];
  } else {
    var h = P[seg % P.length], f = h._visFacing !== undefined ? h._visFacing : (h.facing || 0), aa = f + (u - 0.5)*0.7, hz = (h.z || 0)*D3_KZ;
    eye = [h.x + Math.cos(aa)*55, hz + 14, h.y + Math.sin(aa)*55]; tgt = [h.x, hz + 26, h.y];
  }
  var M = m3();
  if(M) for(var k = 0; k < 4; k++){ if(m3Line(M, tgt[0], tgt[2], tgt[1]/D3_KZ, eye[0], eye[2], eye[1]/D3_KZ, "sight")) break;
    eye = [tgt[0] + (eye[0] - tgt[0])*0.65, tgt[1] + (eye[1] - tgt[1])*0.65, tgt[2] + (eye[2] - tgt[2])*0.65]; }
  return {eye: eye, tgt: tgt};
}
// пролёт: маршрут по навмешу между случайными дальними зонами (проходы, арки), камера на высоте ~120 ед. над полом смотрит вперёд по ходу
function d3FlyThru(){
  var F = D3.flyP, now = performance.now();
  var zc = D3.zoneC || (D3.zoneC = ZONEMAP.zones.map(function(z){ var cx = 0, cy = 0; z.points.forEach(function(p){ cx += p.x; cy += p.y; }); return [cx/z.points.length, cy/z.points.length]; })
    .filter(function(c){ return typeof navAt !== "function" || navAt(c[0], c[1]); }));
  if(!zc.length) return null;
  if(!F || F.s >= F.L - 40){
    var st = F ? F.end : zc[Math.floor(d3R(tick*0.37 + 1) * zc.length)], end = null;
    for(var tr = 0; tr < 12 && !end; tr++){ var c = zc[Math.floor(d3R(tick*0.71 + tr*3.1 + (F ? F.n : 0)) * zc.length)]; if(Math.hypot(c[0] - st[0], c[1] - st[1]) > 600) end = c; }
    if(!end) end = zc[0];
    var W = buildWaypointPath(st[0], st[1], 0, end[0], end[1], 0, null, null, true) || [];
    var P = [[st[0], st[1]]].concat(W.map(function(q){ return [q[0], q[1]]; }));
    if(P.length < 2) P.push([end[0], end[1]]);
    var pts = P.map(function(q){ return [q[0], (d3FloorBelow(q[0], q[1], null) + 120)*D3_KZ, q[1]]; }), Lc = [0];
    for(var k = 1; k < pts.length; k++) Lc.push(Lc[k-1] + Math.hypot(pts[k][0] - pts[k-1][0], pts[k][2] - pts[k-1][2]));
    F = D3.flyP = {pts: pts, Lc: Lc, L: Lc[Lc.length-1], s: 0, t: now, end: end, n: (F ? F.n : 0) + 1};
  }
  var dt = Math.min(0.1, (now - F.t)/1000); F.t = now; if(!paused) F.s += 150*dt;   // px сцены / с
  var at = function(s){ s = Math.max(0, Math.min(F.L, s)); var k = 1; while(k < F.Lc.length - 1 && F.Lc[k] < s) k++;
    var a = F.pts[k-1], b = F.pts[k], f = (s - F.Lc[k-1]) / Math.max(1e-3, F.Lc[k] - F.Lc[k-1]); return [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f, a[2] + (b[2]-a[2])*f]; };
  var e = at(F.s), t = at(F.s + 90); t[1] -= 10;
  return {eye: e, tgt: t};
}
// (оптимизация) 3D включён — 2D-кадр рисует «в пустоту»: табло, панели, киллфид, очистка трассеров идут как обычно, растр карты — нет
var D3_NULLGRAD = {addColorStop: function(){}};
var D3_NULLCTX = (typeof Proxy !== "undefined") ? new Proxy({}, {get: function(t, k){ if(k in t) return t[k];
  if(k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return function(){ return D3_NULLGRAD; };
  if(k === "measureText") return function(){ return {width: 0}; };
  if(k === "getTransform") return function(){ return {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}; };
  return function(){}; }, set: function(t, k, v){ t[k] = v; return true; }}) : null;
function d3Draw2D(){
  if(!D3_NULLCTX){ draw(); return; }
  var c0 = ctx; ctx = D3_NULLCTX; try{ draw(); } finally { ctx = c0; }
}
// ---------- сцена ----------
function d3Build(){
  var gl = D3.gl, t0 = performance.now();
  var cFloor = d3Hex(d3Tok("--v3-floor", "#2b3128")), cSide = d3Hex(d3Tok("--v3-floor-side", "#161a14")), cProp = d3Hex(d3Tok("--v3-prop", "#dde1d4"));
  D3.cBg = d3Hex(d3Tok("--v3-bg", "#0b0d0a")); D3.cEdge = d3Hex(d3Tok("--v3-edge", "#f4f6ef"), 0.3); D3.cProp = cProp;
  D3.cRock = d3Hex(d3Tok("--v3-rock", "#aeb3a6")); D3.cCap = d3Hex(d3Tok("--v3-cap", "#c9cec0"));
  D3.cT = d3Hex(d3Tok("--t", "#d9a24a")); D3.cCT = d3Hex(d3Tok("--ct", "#5a9bd9"));
  // пол — навмеш
  var F = d3Acc(), zLo = Infinity, zHi = -Infinity;
  NAVAREAS.forEach(function(a){ a.points.forEach(function(p){ var z = p.z != null ? p.z : a.z; if(z < zLo) zLo = z; if(z > zHi) zHi = z; }); });
  var SK = 14;   // бортик, px сцены (35 ед.)
  // (владелец 13.11, Ancient: «много треугольников, стыков») тон — плавно по высоте вершины (не участком), бортик — только по краю
  // пола и на ступенях: ребро, общее с соседним участком той же высоты, бортика не получает (владелец: «бортик был верный»)
  var ekey = function(p, q){ var a = Math.round(p.x*2) + "," + Math.round(p.y*2), c = Math.round(q.x*2) + "," + Math.round(q.y*2); return a < c ? a + "|" + c : c + "|" + a; };
  var EZ = {};
  NAVAREAS.forEach(function(a){ if(NAV_BLOCKED[a.id] || a.points.length < 3) return;
    a.points.forEach(function(p, i){ var q = a.points[(i+1) % a.points.length], k = ekey(p, q); (EZ[k] || (EZ[k] = [])).push((p.z != null ? p.z : a.z) + (q.z != null ? q.z : a.z)); }); });
  var tone = function(z){ var hk = (z - zLo)/Math.max(1, zHi - zLo), m = 0.86 + 0.32*hk; return [cFloor[0]*m, cFloor[1]*m, cFloor[2]*m, 1]; };
  NAVAREAS.forEach(function(a){
    if(NAV_BLOCKED[a.id] || a.points.length < 3) return;
    var zs = a.points.map(function(p){ return p.z != null ? p.z : a.z; });
    var pts = a.points.map(function(p, i){ return [p.x, zs[i]*D3_KZ - 1.6, p.y]; });   // на 4 ед. ниже: где есть пол из геометрии — виден он
    for(var i = 1; i + 1 < pts.length; i++) F.tri(pts[0], pts[i], pts[i+1], [tone(zs[0]), tone(zs[i]), tone(zs[i+1])]);
    for(i = 0; i < pts.length; i++){ var j = (i+1) % pts.length, L = EZ[ekey(a.points[i], a.points[j])] || [], me = zs[i] + zs[j];
      if(L.filter(function(v){ return Math.abs(v - me) < 16; }).length > 1) continue;   // сосед той же высоты — шва нет
      var p = pts[i], q = pts[j], p2 = [p[0], p[1]-SK, p[2]], q2 = [q[0], q[1]-SK, q[2]];
      F.tri(p, q, q2, [cSide, cSide, cSide]); F.tri(p, q2, p2, [cSide, cSide, cSide]); }
  });
  D3.floor = d3Mesh(gl, F.P, F.N, F.C); D3.cFloor = cFloor; D3.zr = [zLo*D3_KZ, zHi*D3_KZ];
  // мир — вся геометрия игры (флаг «взгляд», без клипов), срез по высоте над полом под каждой точкой — в шейдере (d3World, D3_WFS)
  var Wd = d3World(gl);
  D3.world = Wd; var nT = Wd.cnt/3;
  // фигуры: капсула (высота 1, радиус 1 по x/z — масштаб при рисовании), шар, диск, коробка
  D3.capsule = d3Shape(gl, "capsule"); D3.ring = d3Shape(gl, "ring"); D3.sphere = d3Shape(gl, "sphere"); D3.disc = d3Shape(gl, "disc"); D3.box = d3Shape(gl, "box"); D3.cone = d3Shape(gl, "cone");
  D3.lines = {p: gl.createBuffer(), c: gl.createBuffer()};
  D3.built = true; D3.stat = {tri: nT, edges: Wd.ecnt/2, ms: Math.round(performance.now() - t0)};
}
// мир: вся геометрия (треугольники и выпуклые блоки), что может попасть ниже среза; пол под ней, совпадающий с навмешем, — нет
// (его рисует навмеш). Срез — в шейдере по таблице этажей: у каждого фрагмента пол «пешком» под ним (высший не выше фрагмента),
// выше пола на D3_CUT — не рисуется; изнанка закрытых предметов в разрезе — «крышка» (сплошной срез стен и ящиков).
// Таблица этажей — текстура 512 × 256: блок 8 px радара = 2 тексела по 4 высоты (до 8 этажей пешком в блоке и вокруг), px сцены.
function d3FloorTex(gl, M){
  var F = d3FloorBlocks(M), BN = F.BN, data = new Float32Array(BN*2*BN*4);
  for(var k = 0; k < data.length; k++) data[k] = -1e9;
  for(var b = 0; b < BN*BN; b++){ var A = F.L[b]; if(!A) continue;
    A = A.slice().sort(function(a, c){ return a - c; });
    while(A.length > 8){ var mi = 1, md = Infinity; for(var q = 1; q < A.length; q++) if(A[q] - A[q-1] < md){ md = A[q] - A[q-1]; mi = q; } A.splice(mi, 1); }   // ближайшие — в один (нижний)
    var bi = b % BN, bj = (b / BN) | 0;
    for(q = 0; q < A.length; q++) data[((bj*BN*2) + bi*2 + (q >> 2))*4 + (q & 3)] = A[q]*D3_KZ;
  }
  var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, BN*2, BN, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {tex: t, BN: BN};
}
function d3World(gl){
  var M = m3(); if(!M) return {cnt: 0, ecnt: 0};
  var F = d3FloorBlocks(M), X0 = M.X0, Y0 = M.Y0, mats = M.mats || [], cutU = D3_CUT;
  var P = [], K = [], E = [], G = [], GK = [];
  var blk = function(x, y){ var i = Math.floor(x / M.cell / F.BS), j = Math.floor(y / M.cell / F.BS); return (i < 0 || j < 0 || i >= F.BN || j >= F.BN) ? null : F.L[j*F.BN + i]; };
  var near = function(A, z, d){ if(A) for(var t = 0; t < A.length; t++) if(Math.abs(A[t] - z) < d) return true; return false; };
  var under = function(A, z){ var b = null; if(A) for(var t = 0; t < A.length; t++) if(A[t] <= z + 8 && (b === null || A[t] > b)) b = A[t]; return b; };
  // a, b, c — ед. игры (x, y, z); kind — 1 природный рельеф; edgeOk — рёбра искать
  var push = function(a, b, c, kind){
    var ra = m3Radar(M, a[0], a[1]), rb = m3Radar(M, b[0], b[1]), rc = m3Radar(M, c[0], c[1]);
    var Aa = blk(ra[0], ra[1]), Ab = blk(rb[0], rb[1]), Ac = blk(rc[0], rc[1]); if(!Aa && !Ab && !Ac) return;   // вне проходимой части карты
    var zmin = Math.min(a[2], b[2], c[2]), zmax = Math.max(a[2], b[2], c[2]);
    var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, l = Math.hypot(nx, ny, nz); if(l < 1e-6) return;
    if(nz/l > 0.7 && near(Aa || Ab || Ac, zmax, 10)){   // пол и ступени — отдельно, непрозрачно, цвета пола (навмеш — под ним, где геометрии нет)
      // пол внутри возвышения (над ним в той же клетке пол — пешком, прыжком, подсадкой — ниже роста, 8–110 ед.) — не рисуем: сквозь стекло стенки его видно (владелец)
      var cc = m3Cell(M, (ra[0] + rb[0] + rc[0])/3, (ra[1] + rb[1] + rc[1])/3);
      if(cc >= 0){ for(var fq = M.floors.st[cc]; fq < M.floors.st[cc+1]; fq++){ var dz = M.floors.z[fq] - zmax; if(dz > 8 && dz < 110) return; } }
      G.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); GK.push(2, 2, 2); return; }
    var r0 = under(Aa || Ab || Ac, zmin); if(r0 !== null && zmin - r0 > cutU + 8) return;   // целиком выше среза
    P.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); K.push(kind, kind, kind);
  };
  var T = M.tri, tf = M.triFlag, tm = M.triMat, nt = tf.length;
  for(var k = 0; k < nt; k++){ if(!(tf[k] & 1)) continue; var o = k*9;
    if(D3_HIDE[mats[tm[k]]]) continue;
    push([T[o], T[o+1], T[o+2]], [T[o+3], T[o+4], T[o+5]], [T[o+6], T[o+7], T[o+8]], D3_SOFT[mats[tm[k]]] ? 1 : 0); }
  // выпуклые блоки: вершины — пересечения троек плоскостей внутри блока, грань — вершины на её плоскости по кругу (наружу)
  var hn = M.hullN, hp = M.hullP, ho = M.hullOff, hfl = M.hullFlag, hm = M.hullMat;
  for(var h = 0; h < hn.length; h++){
    if(!(hfl[h] & 1) || hn[h] > 26) continue;
    var pl = [], n = hn[h]; for(var q = 0; q < n; q++){ var b4 = (ho[h] + q)*4; pl.push([hp[b4], hp[b4+1], hp[b4+2], hp[b4+3]]); }
    var V = [];
    for(var i1 = 0; i1 < n; i1++) for(var i2 = i1+1; i2 < n; i2++) for(var i3 = i2+1; i3 < n; i3++){
      var A1 = pl[i1], A2 = pl[i2], A3 = pl[i3];
      var cx = A2[1]*A3[2] - A2[2]*A3[1], cy = A2[2]*A3[0] - A2[0]*A3[2], cz = A2[0]*A3[1] - A2[1]*A3[0], det = A1[0]*cx + A1[1]*cy + A1[2]*cz;
      if(Math.abs(det) < 1e-6) continue;
      var ex = A3[1]*A1[2] - A3[2]*A1[1], ey = A3[2]*A1[0] - A3[0]*A1[2], ez = A3[0]*A1[1] - A3[1]*A1[0];
      var fx = A1[1]*A2[2] - A1[2]*A2[1], fy = A1[2]*A2[0] - A1[0]*A2[2], fz = A1[0]*A2[1] - A1[1]*A2[0];
      var px = (A1[3]*cx + A2[3]*ex + A3[3]*fx)/det, py = (A1[3]*cy + A2[3]*ey + A3[3]*fy)/det, pz = (A1[3]*cz + A2[3]*ez + A3[3]*fz)/det, ok = true;
      for(q = 0; q < n && ok; q++) if(pl[q][0]*px + pl[q][1]*py + pl[q][2]*pz > pl[q][3] + 0.05) ok = false;
      if(!ok) continue;
      for(q = 0; q < V.length; q++) if(Math.abs(V[q][0]-px) + Math.abs(V[q][1]-py) + Math.abs(V[q][2]-pz) < 0.05){ ok = false; break; }
      if(ok) V.push([px, py, pz]);
    }
    if(V.length < 4) continue;
    if(D3_HIDE[mats[hm[h]]]) continue;
    var kind = D3_SOFT[mats[hm[h]]] ? 1 : 0;
    for(q = 0; q < n; q++){
      var P0 = pl[q], on = V.filter(function(v){ return Math.abs(P0[0]*v[0] + P0[1]*v[1] + P0[2]*v[2] - P0[3]) < 0.05; });
      if(on.length < 3) continue;
      var mx = 0, my = 0, mz = 0; on.forEach(function(v){ mx += v[0]; my += v[1]; mz += v[2]; }); mx /= on.length; my /= on.length; mz /= on.length;
      var ux = Math.abs(P0[0]) < 0.9 ? [0, -P0[2], P0[1]] : [P0[2], 0, -P0[0]], ul = Math.hypot(ux[0], ux[1], ux[2]); ux = [ux[0]/ul, ux[1]/ul, ux[2]/ul];
      var vx = [P0[1]*ux[2] - P0[2]*ux[1], P0[2]*ux[0] - P0[0]*ux[2], P0[0]*ux[1] - P0[1]*ux[0]];
      var ang = function(A){ return Math.atan2((A[0]-mx)*vx[0] + (A[1]-my)*vx[1] + (A[2]-mz)*vx[2], (A[0]-mx)*ux[0] + (A[1]-my)*ux[1] + (A[2]-mz)*ux[2]); };
      on.sort(function(A, B){ return ang(A) - ang(B); });   // против часовой вокруг наружной нормали — лицевая сторона снаружи
      for(var t = 1; t + 1 < on.length; t++) push(on[0], on[t], on[t+1], kind);
    }
  }
  // рёбра — излом граней больше 37° или край (кроме природного рельефа: там рёбра — шум)
  var Em = new Map(), NN = [];
  for(var ti = 0; ti < P.length/9; ti++){ var a9 = ti*9;
    var ux2 = P[a9+3]-P[a9], uy2 = P[a9+4]-P[a9+1], uz2 = P[a9+5]-P[a9+2], vx2 = P[a9+6]-P[a9], vy2 = P[a9+7]-P[a9+1], vz2 = P[a9+8]-P[a9+2];
    var nx2 = uy2*vz2 - uz2*vy2, ny2 = uz2*vx2 - ux2*vz2, nz2 = ux2*vy2 - uy2*vx2, l2 = Math.hypot(nx2, ny2, nz2) || 1; NN.push(nx2/l2, ny2/l2, nz2/l2);
    if(K[ti*3]) continue;
    for(var e = 0; e < 3; e++){
      var ia = a9 + e*3, ib = a9 + ((e+1) % 3)*3;
      var ka = Math.round(P[ia]*8) + "," + Math.round(P[ia+1]*8) + "," + Math.round(P[ia+2]*8), kb = Math.round(P[ib]*8) + "," + Math.round(P[ib+1]*8) + "," + Math.round(P[ib+2]*8);
      var kk = ka < kb ? ka + "|" + kb : kb + "|" + ka, r = Em.get(kk);
      if(!r) Em.set(kk, {a: ia, b: ib, t: ti, c: 1, crease: false});
      else { r.c++; if(Math.abs(NN[r.t*3]*NN[ti*3] + NN[r.t*3+1]*NN[ti*3+1] + NN[r.t*3+2]*NN[ti*3+2]) < 0.8) r.crease = true; }
    }
  }
  Em.forEach(function(r){ if(r.c === 1 || r.crease) E.push(P[r.a], P[r.a+1], P[r.a+2], P[r.b], P[r.b+1], P[r.b+2]); });
  var buf = function(a){ var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
  return {p: buf(new Float32Array(P)), k: buf(new Float32Array(K)), cnt: P.length/3, e: buf(new Float32Array(E)), ecnt: E.length/3, ftex: d3FloorTex(gl, M),
          g: buf(new Float32Array(G)), gk: buf(new Float32Array(GK)), gcnt: G.length/3};
}
function d3Shape(gl, kind){
  var A = d3Acc(), wh = [1, 1, 1, 1], S = 18, i, j;
  var ring = function(y, r){ var o = []; for(var k = 0; k <= S; k++){ var a = k/S*Math.PI*2; o.push([Math.cos(a)*r, y, Math.sin(a)*r]); } return o; };
  if(kind === "capsule" || kind === "sphere"){
    // капсула: полусфера внизу (центр y=r), цилиндр, полусфера вверху; высота 1, радиус R
    var R = kind === "sphere" ? 1 : 0.24, H = kind === "sphere" ? 0 : 1 - 2*R, rows = [], ST = 8;
    for(i = 0; i <= ST; i++){ var th = -Math.PI/2 + i/ST*Math.PI/2; rows.push(ring((kind === "sphere" ? 0 : R) + Math.sin(th)*R, Math.cos(th)*R)); }
    for(i = 0; i <= ST; i++){ th = i/ST*Math.PI/2; rows.push(ring((kind === "sphere" ? 0 : R + H) + Math.sin(th)*R, Math.cos(th)*R)); }
    for(i = 0; i + 1 < rows.length; i++) for(j = 0; j < S; j++){ A.tri(rows[i][j], rows[i+1][j], rows[i+1][j+1], wh); A.tri(rows[i][j], rows[i+1][j+1], rows[i][j+1], wh); }
    // гладкие нормали: от оси
    for(i = 0; i < A.P.length; i += 3){ var x = A.P[i], y = A.P[i+1], z = A.P[i+2], cy = kind === "sphere" ? 0 : Math.max(R, Math.min(R + H, y)), l = Math.hypot(x, y - cy, z) || 1;
      A.N[i] = x/l; A.N[i+1] = (y - cy)/l; A.N[i+2] = z/l; }
  } else if(kind === "ring"){   // кольцо: внешний радиус 1, внутренний 0,8
    var ro = ring(0, 1), ri = ring(0, 0.8); for(j = 0; j < S; j++){ A.tri(ri[j], ro[j+1], ro[j], wh); A.tri(ri[j], ri[j+1], ro[j+1], wh); }
  } else if(kind === "disc"){
    var rg = ring(0, 1); for(j = 0; j < S; j++) A.tri([0, 0, 0], rg[j+1], rg[j], wh);
  } else if(kind === "cone"){   // «нос» взгляда: плоский клин вдоль +x
    A.tri([1, 0, 0], [0, 0, 0.5], [0, 0, -0.5], wh);
  } else {
    var c = [[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]];
    [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]].forEach(function(f){ A.tri(c[f[0]], c[f[1]], c[f[2]], wh); A.tri(c[f[0]], c[f[2]], c[f[3]], wh); });
  }
  return d3Mesh(gl, A.P, A.N, A.C);
}

// ---------- включение ----------
function d3Init(){
  if(D3.gl || D3.failed) return !!D3.gl;
  var c = document.getElementById("cv3");
  try{
    var gl = c.getContext("webgl2", {antialias: true, alpha: false, premultipliedAlpha: false});
    if(!gl) throw new Error("браузер не даёт WebGL2");
    D3.gl = gl; D3.pM = d3Prog(gl, D3_VS, D3_FS); D3.pL = d3Prog(gl, D3_LVS, D3_LFS); D3.pW = d3Prog(gl, D3_WVS, D3_WFS); D3.pE = d3Prog(gl, D3_ELVS, D3_ELFS);
    d3Build();
  }catch(e){ D3.failed = String(e && e.message || e); D3.gl = null; logEvent && logEvent("3D-вид не включился: " + D3.failed); return false; }
  return true;
}
function d3Toggle(on){
  if(on && !d3Init()) on = false;
  D3.on = on;
  ["cv3", "v3Lab", "v3Tools"].forEach(function(id){ var el = document.getElementById(id); if(el) el.hidden = !on; });
  if(!on){ var xc0 = document.getElementById("v3Cross"); if(xc0) xc0.hidden = true; }
  var b = document.getElementById("btn3d"); if(b){ b.classList.toggle("on", on); b.title = D3.failed ? "3D-вид недоступен: " + D3.failed : b.title; }
  try{ localStorage.setItem("sim-3d", on ? "1" : "0"); }catch(e){}
}

