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
var D3 = {on: false, style: 0, gl: null, built: false, failed: null, yaw: 0, pitch: 0.95, yawT: 0, pitchT: 0.95, top: false, lock: false,
          tz: null, drag: null, tagEls: {}, nadeZ: [], smZ: new WeakMap(), trZ: new WeakMap()};
var D3_KZ = 0.4;               // ед. игры → px радара (высота)
var D3_CUT = 150;              // проектное число: выше этого над полом геометрия не рисуется (ящик 64, два ящика 128 ед.)
var D3_FOV = 38 * Math.PI/180;
// виды мира (владелец 13.11: «прозрачный был лучше — от него, но сделай несколько вариаций»): a — плотность граней, ea — яркость рёбер
var D3_STYLES = [{id: "glass", name: "стекло", a: 0.32, ea: 0.6}, {id: "line", name: "контур", a: 0.1, ea: 0.85}, {id: "solid", name: "макет", a: 1, ea: 0.3}];
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
function d3R(n){ var v = Math.sin(n)*43758.5453; return v - Math.floor(v); }   // раскладка клубов дыма, как fxR в 620 (без Math.random)
function d3Hex(s, a){ s = (s || "").trim(); var m = /^#([0-9a-f]{6})$/i.exec(s); var n = m ? parseInt(m[1], 16) : 0x808080; return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255, a == null ? 1 : a]; }
function d3Tok(name, def){ try{ var v = getComputedStyle(document.documentElement).getPropertyValue(name); return v && v.trim() ? v.trim() : def; }catch(e){ return def; } }

// ---------- WebGL ----------
var D3_VS = "#version 300 es\nin vec3 aP; in vec3 aN; in vec4 aC; uniform mat4 uVP, uM; uniform vec4 uTint; uniform vec3 uEye;\n" +
  "out vec3 vN, vV; out vec4 vC; out float vD; void main(){ vec4 w = uM*vec4(aP,1.0); vN = mat3(uM)*aN; vC = aC*uTint; vV = uEye - w.xyz; vD = length(vV); gl_Position = uVP*w; }";
var D3_FS = "#version 300 es\nprecision mediump float; in vec3 vN, vV; in vec4 vC; in float vD; uniform vec3 uL, uBg; uniform vec2 uFog; uniform float uLit, uSoft; out vec4 o;\n" +
  "void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; float d = max(dot(n, uL), 0.0), h = 0.5 + 0.5*n.y;\n" +
  " vec3 c = vC.rgb*mix(1.0, 0.34 + 0.40*h + 0.46*d, uLit); c = mix(c, uBg, smoothstep(uFog.x, uFog.y, vD));\n float a = vC.a*mix(1.0, pow(abs(dot(n, normalize(vV))), 1.6), uSoft); o = vec4(c, a); }";
var D3_LVS = "#version 300 es\nin vec3 aP; in vec4 aC; uniform mat4 uVP; uniform vec3 uEye; out vec4 vC; out float vD;\n" +
  "void main(){ vC = aC; vD = distance(aP, uEye); gl_Position = uVP*vec4(aP,1.0); gl_Position.z -= 0.0006*gl_Position.w; }";
var D3_LFS = "#version 300 es\nprecision mediump float; in vec4 vC; in float vD; uniform vec2 uFog; out vec4 o;\n" +
  "void main(){ o = vec4(vC.rgb, vC.a*(1.0 - smoothstep(uFog.x, uFog.y, vD))); }";
// мир: срез по таблице этажей; нормаль — по экранным производным (плоские грани); изнанка в разрезе — «крышка»
var D3_WVS = "#version 300 es\nin vec3 aP; in float aK; uniform mat4 uVP; out vec3 vW; out float vK; void main(){ vW = aP; vK = aK; gl_Position = uVP*vec4(aP,1.0); }";
var D3_CUTF = "uniform highp sampler2D uF; uniform float uCut;\n" +
  "float refY(vec3 w){ ivec2 b = ivec2(floor(w.x/8.0), floor(w.z/8.0)); if(b.x < 0 || b.y < 0 || b.x > 255 || b.y > 255) return -1e9;\n" +
  " vec4 a = texelFetch(uF, ivec2(b.x*2, b.y), 0), c = texelFetch(uF, ivec2(b.x*2+1, b.y), 0); float lim = w.y + 3.2, r = -1e9;\n" +
  " if(a.x <= lim) r = max(r, a.x); if(a.y <= lim) r = max(r, a.y); if(a.z <= lim) r = max(r, a.z); if(a.w <= lim) r = max(r, a.w);\n" +
  " if(c.x <= lim) r = max(r, c.x); if(c.y <= lim) r = max(r, c.y); if(c.z <= lim) r = max(r, c.z); if(c.w <= lim) r = max(r, c.w); return r; }\n";
var D3_WFS = "#version 300 es\nprecision highp float; in vec3 vW; in float vK; uniform vec3 uEye, uL, uBg, uProp, uRock, uCap; uniform vec2 uFog; uniform float uA; out vec4 o;\n" + D3_CUTF +
  "void main(){ float r = refY(vW); if(r < -1e8) discard; float h = vW.y - r; if(h > uCut) discard;\n" +
  " vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if(dot(n, uEye - vW) < 0.0) n = -n; vec3 c;\n" +
  " if(!gl_FrontFacing) c = uCap; else { vec3 base = mix(uProp, uRock, vK); float d = max(dot(n, uL), 0.0), hm = 0.5 + 0.5*n.y;\n" +
  "  c = base*(0.30 + 0.36*hm + 0.50*d); c *= mix(0.55, 1.0, smoothstep(0.0, 26.0, h)); }\n" +
  " c = mix(c, uCap*1.06, smoothstep(uCut - 1.4, uCut, h)*0.85);\n" +
  " float f = smoothstep(uFog.x, uFog.y, distance(vW, uEye)); float rim = smoothstep(uCut - 1.4, uCut, h);\n" +
  " if(uA < 1.0) o = vec4(c, (uA + rim*0.5)*(1.0 - f)); else o = vec4(mix(c, uBg, f), 1.0); }";
var D3_ELVS = "#version 300 es\nin vec3 aP; uniform mat4 uVP; out vec3 vW; void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.0); gl_Position.z -= 0.0006*gl_Position.w; }";
var D3_ELFS = "#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye; uniform vec4 uC; uniform vec2 uFog; out vec4 o;\n" + D3_CUTF +
  "void main(){ float r = refY(vW); if(r < -1e8 || vW.y - r > uCut + 0.2) discard; o = vec4(uC.rgb, uC.a*(1.0 - smoothstep(uFog.x, uFog.y, distance(vW, uEye)))); }";
function d3Prog(gl, vs, fs){
  function sh(t, s){ var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for(var i = 0; i < n; i++){ var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
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
      var c0 = col.length > 4 ? col : null;
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
  NAVAREAS.forEach(function(a){
    if(NAV_BLOCKED[a.id] || a.points.length < 3) return;
    var pts = a.points.map(function(p){ return [p.x, (p.z != null ? p.z : a.z)*D3_KZ, p.y]; });
    var hk = (a.z - zLo)/Math.max(1, zHi - zLo), col = [cFloor[0]*(0.86 + 0.32*hk), cFloor[1]*(0.86 + 0.32*hk), cFloor[2]*(0.86 + 0.32*hk), 1];
    for(var i = 1; i + 1 < pts.length; i++) F.tri(pts[0], pts[i], pts[i+1], col);
    for(i = 0; i < pts.length; i++){ var p = pts[i], q = pts[(i+1) % pts.length], p2 = [p[0], p[1]-SK, p[2]], q2 = [q[0], q[1]-SK, q[2]];
      F.tri(p, q, q2, [cSide, cSide, cSide]); F.tri(p, q2, p2, [cSide, cSide, cSide]); }
  });
  D3.floor = d3Mesh(gl, F.P, F.N, F.C);
  // мир — вся геометрия игры (флаг «взгляд», без клипов), срез по высоте над полом под каждой точкой — в шейдере (d3World, D3_WFS)
  var Wd = d3World(gl);
  D3.world = Wd; var nT = Wd.cnt/3;
  // фигуры: капсула (высота 1, радиус 1 по x/z — масштаб при рисовании), шар, диск, коробка
  D3.capsule = d3Shape(gl, "capsule"); D3.sphere = d3Shape(gl, "sphere"); D3.disc = d3Shape(gl, "disc"); D3.box = d3Shape(gl, "box"); D3.cone = d3Shape(gl, "cone");
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
  var P = [], K = [], E = [];
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
    if(nz/l > 0.9 && near(Aa || Ab || Ac, zmax, 6)) return;   // пол — его рисует навмеш
    var r0 = under(Aa || Ab || Ac, zmin); if(r0 !== null && zmin - r0 > cutU + 8) return;   // целиком выше среза
    P.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); K.push(kind, kind, kind);
  };
  var T = M.tri, tf = M.triFlag, tm = M.triMat, nt = tf.length;
  for(var k = 0; k < nt; k++){ if(!(tf[k] & 1)) continue; var o = k*9;
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
  return {p: buf(new Float32Array(P)), k: buf(new Float32Array(K)), cnt: P.length/3, e: buf(new Float32Array(E)), ecnt: E.length/3, ftex: d3FloorTex(gl, M)};
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
  var b = document.getElementById("btn3d"); if(b){ b.classList.toggle("on", on); b.title = D3.failed ? "3D-вид недоступен: " + D3.failed : b.title; }
  try{ localStorage.setItem("sim-3d", on ? "1" : "0"); }catch(e){}
}

// ---------- кадр ----------
function d3Frame(){
  if(!D3.on || !D3.gl) return;
  var gl = D3.gl, c = gl.canvas, r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  var Wc = Math.max(1, Math.round(r.width*dpr)), Hc = Math.max(1, Math.round(r.height*dpr));
  if(c.width !== Wc || c.height !== Hc){ c.width = Wc; c.height = Hc; }
  // камера: цель — центр экрана 2D, приближение — view.scale
  var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale;
  var a0 = typeof navAt === "function" ? navAt(cx, cy, D3.tz) : null, zt = a0 ? a0.z : (D3.tz == null ? 0 : D3.tz);
  D3.tz = D3.tz == null ? zt : D3.tz + (zt - D3.tz)*0.08;
  var ease = 0.16; D3.yaw += (D3.yawT - D3.yaw)*ease; var pT = D3.top ? 1.5 : D3.pitchT; D3.pitch += (pT - D3.pitch)*ease;
  var visH = cv.height/view.scale, dist = visH/(2*Math.tan(D3_FOV/2))*0.92;
  var tgt = [cx, D3.tz*D3_KZ, cy], cp = Math.cos(D3.pitch), sp = Math.sin(D3.pitch);
  var eye = [tgt[0] + Math.sin(D3.yaw)*cp*dist, tgt[1] + sp*dist, tgt[2] + Math.cos(D3.yaw)*cp*dist];
  var V = d3Look(eye, tgt);   // наклон не больше 1,5 рад — «сверху» без вырождения, поворот сохраняется
  var Pm = d3Persp(D3_FOV, Wc/Hc, Math.max(2, dist*0.05), dist*6), VP = d3Mul(Pm, V);
  D3.VP = VP; D3.W = r.width; D3.H = r.height; D3.eye = eye; D3.dist = dist;
  var fog = [dist*1.9, dist*4.6], L = [0.45, 0.78, 0.43], ll = Math.hypot(L[0], L[1], L[2]); L = [L[0]/ll, L[1]/ll, L[2]/ll];
  gl.viewport(0, 0, Wc, Hc); gl.clearColor(D3.cBg[0], D3.cBg[1], D3.cBg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  var pM = D3.pM; gl.useProgram(pM.p);
  gl.uniformMatrix4fv(pM.u.uVP, false, VP); gl.uniform3fv(pM.u.uEye, eye); gl.uniform3fv(pM.u.uL, L); gl.uniform3fv(pM.u.uBg, D3.cBg.slice(0, 3)); gl.uniform2fv(pM.u.uFog, fog);
  var I = d3Model(0, 0, 0, 1, 1, 1);
  var draw = function(m, M4, tint, lit, soft){ gl.uniform1f(pM.u.uSoft, soft || 0); gl.uniformMatrix4fv(pM.u.uM, false, M4 || I); gl.uniform4fv(pM.u.uTint, tint || [1, 1, 1, 1]); gl.uniform1f(pM.u.uLit, lit == null ? 1 : lit);
    d3Attr(gl, pM.aP, m.p, 3); d3Attr(gl, pM.aN, m.n, 3); d3Attr(gl, pM.aC, m.c, 4); gl.drawArrays(gl.TRIANGLES, 0, m.cnt); };
  draw(D3.floor, I, null, 0.35);
  // мир со срезом и его рёбра — вид по D3_STYLES (кнопка в колонке): непрозрачный — сразу, прозрачный — последним (видно игроков за стенами)
  var Wd = D3.world, pW = D3.pW, cut = D3_CUT*D3_KZ, STY = D3_STYLES[D3.style] || D3_STYLES[0];
  var drawWorld = function(){
    if(!Wd.cnt) return;
    if(STY.a < 1){ gl.depthMask(false); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
    gl.useProgram(pW.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Wd.ftex.tex);
    gl.uniformMatrix4fv(pW.u.uVP, false, VP); gl.uniform3fv(pW.u.uEye, eye); gl.uniform3fv(pW.u.uL, L); gl.uniform3fv(pW.u.uBg, D3.cBg.slice(0, 3));
    gl.uniform2fv(pW.u.uFog, fog); gl.uniform1i(pW.u.uF, 0); gl.uniform1f(pW.u.uCut, cut); gl.uniform1f(pW.u.uA, STY.a);
    gl.uniform3fv(pW.u.uProp, D3.cProp.slice(0, 3)); gl.uniform3fv(pW.u.uRock, D3.cRock.slice(0, 3)); gl.uniform3fv(pW.u.uCap, D3.cCap.slice(0, 3));
    d3Attr(gl, pW.aP, Wd.p, 3); d3Attr(gl, pW.aK, Wd.k, 1); gl.drawArrays(gl.TRIANGLES, 0, Wd.cnt); if(pW.aK >= 0) gl.disableVertexAttribArray(pW.aK);
    var pE = D3.pE; gl.useProgram(pE.p); gl.uniformMatrix4fv(pE.u.uVP, false, VP); gl.uniform3fv(pE.u.uEye, eye); gl.uniform2fv(pE.u.uFog, fog);
    gl.uniform1i(pE.u.uF, 0); gl.uniform1f(pE.u.uCut, cut); gl.uniform4fv(pE.u.uC, [D3.cEdge[0], D3.cEdge[1], D3.cEdge[2], STY.ea]);
    d3Attr(gl, pE.aP, Wd.e, 3); gl.drawArrays(gl.LINES, 0, Wd.ecnt);
    gl.depthMask(true); gl.disable(gl.CULL_FACE);
  };
  if(STY.a >= 1) drawWorld();
  var pL = D3.pL;
  // ---------- живое ----------
  gl.useProgram(pM.p);
  var al = Math.max(0, Math.min(1, accumulator / TICK_MS)), sz = Math.max(1.15, Math.min(2.6, dist/650)), LN = [];
  var line = function(a, b, ca, cb){ LN.push(a[0], a[1], a[2], ca[0], ca[1], ca[2], ca[3], b[0], b[1], b[2], cb[0], cb[1], cb[2], cb[3]); };
  // огонь — диск на полу
  fires.forEach(function(fr){ var R = fireRadiusNow(fr), z = d3FloorNear(fr.x, fr.y, fr._z3)*D3_KZ, fade = Math.min(1, (fr.until - tick)/40), fl = 0.85 + 0.15*Math.sin(tick*0.35);
    gl.depthMask(false); draw(D3.disc, d3Model(fr.x, z + 0.6, fr.y, R, 1, R), [1, 0.47*fl, 0.17, 0.42*fade], 0);
    draw(D3.disc, d3Model(fr.x, z + 0.8, fr.y, R*0.55, 1, R*0.55), [1, 0.78, 0.4, 0.35*fade*fl], 0); gl.depthMask(true); });
  // бомба
  if(bomb && (bomb.state === "dropped" || bomb.state === "planted" || bomb.state === "defused")){
    var bz = d3FloorNear(bomb.x, bomb.y, bomb.z)*D3_KZ, pu = bomb.state === "planted" ? 0.5 + 0.5*Math.sin(tick*0.25) : 1, cb = d3Hex(d3Tok("--bomb", "#ff5a4c"));
    draw(D3.box, d3Model(bomb.x, bz, bomb.y, 3.2*sz, 1.6*sz, 2.2*sz), bomb.state === "defused" ? D3.cCT : cb, 0.8);
    if(bomb.state === "planted"){ gl.depthMask(false); draw(D3.disc, d3Model(bomb.x, bz + 0.5, bomb.y, (8 + 10*(1 - pu))*sz, 1, (8 + 10*(1 - pu))*sz), [cb[0], cb[1], cb[2], 0.35*pu], 0); gl.depthMask(true); }
  }
  // игроки
  var seen = {};
  bots.forEach(function(b){
    var x = b.px + (b.x - b.px)*al, y = b.py + (b.y - b.py)*al, z = (b.z != null ? b.z : d3FloorNear(x, y, null))*D3_KZ, col = b.team === "CT" ? D3.cCT : D3.cT;
    var CL = b._climb, air = CL && CL.jump ? 4*(CL.air || 0)*(1 - (CL.air || 0)) : 0; z += air*18;
    if(!b.alive){   // павший — тёмный крестик на полу
      var dz = z + 0.4, s = 3.2*sz, dc = [col[0]*0.55, col[1]*0.55, col[2]*0.55, 0.85];
      line([x - s, dz, y - s], [x + s, dz, y + s], dc, dc); line([x - s, dz, y + s], [x + s, dz, y - s], dc, dc); return;
    }
    var h = (b.crouching ? 19 : 26)*sz, rad = h*0.5;
    var blind = tick < b.blindUntil ? Math.min(1, (b.blindUntil - tick)/64*0.5)*0.75 : 0;
    var tc = [col[0] + (1 - col[0])*blind, col[1] + (1 - col[1])*blind, col[2] + (1 - col[2])*blind, 1];
    gl.depthMask(false); draw(D3.disc, d3Model(x, z + 0.3, y, 7.5*sz, 1, 7.5*sz), [0, 0, 0, 0.42], 0); gl.depthMask(true);   // тень
    draw(D3.capsule, d3Model(x, z + 0.4, y, rad*1.15, h, rad*1.15), tc, 1);
    var vf = b._visFacing !== undefined ? b._visFacing : b.facing;
    if(vf !== undefined){   // взгляд — клин на полу и короткая линия
      var ca = Math.cos(vf), sa = Math.sin(vf), r0 = 8*sz, len = 7*sz;
      var Mc = new Float32Array([ca*len, 0, sa*len, 0, 0, 1, 0, 0, -sa*len*0.9, 0, ca*len*0.9, 0, x + ca*r0, z + 0.7, y + sa*r0, 1]);
      draw(D3.cone, Mc, [tc[0], tc[1], tc[2], 0.95], 0);
    }
    seen[b.id] = 1; d3Tag(b, x, z + h + 4*sz, y, col);
  });
  for(var id in D3.tagEls) if(!seen[id]) D3.tagEls[id].style.display = "none";
  // дым — облако из нескольких шаров
  var lastN = D3.nadeZ;
  nadesInAir.forEach(function(n){ if(n.z != null) lastN.push({x: n.x, y: n.y, z: n.z, t: tick}); }); while(lastN.length > 60) lastN.shift();
  gl.depthMask(false);
  smokes.forEach(function(sm){
    var rr = smokeRadiusNow(sm); if(rr < 2) return;
    var z0 = D3.smZ.get(sm); if(z0 === undefined){ var bz2 = null, bd = 40; lastN.forEach(function(q){ var d = Math.hypot(q.x - sm.x, q.y - sm.y); if(d < bd){ bd = d; bz2 = q.z; } }); z0 = d3FloorNear(sm.x, sm.y, bz2); D3.smZ.set(sm, z0); }
    var fade = Math.min(1, (sm.until - tick)/64), zz = z0*D3_KZ, seed = sm.born*0.37 + sm.x*0.013;
    for(var q = 0; q < 7; q++){ var qa = d3R(seed + q*1.7)*Math.PI*2 + (tick - sm.born)*0.0016*(q % 2 ? 1 : -1), qd = q ? rr*0.42 : 0, qr = rr*(q ? 0.62 : 0.9);
      draw(D3.sphere, d3Model(sm.x + Math.cos(qa)*qd, zz + rr*(q ? 0.42 + 0.18*d3R(seed + q) : 0.5), sm.y + Math.sin(qa)*qd, qr, qr*0.72, qr), [0.86, 0.88, 0.84, 0.34*fade], 0.45, 1); }
  });
  gl.depthMask(true);
  // гранаты в полёте — шарик и след
  nadesInAir.forEach(function(n){
    var nc = n.type === "smoke" ? [0.84, 0.85, 0.82, 1] : n.type === "flash" ? [1, 1, 1, 1] : n.type === "he" ? [0.91, 0.35, 0.3, 1] : [1, 0.6, 0.24, 1];
    var nz = (n.z != null ? n.z : d3FloorNear(n.x, n.y, null) + 40)*D3_KZ;
    draw(D3.sphere, d3Model(n.x, nz, n.y, 1.6*sz, 1.6*sz, 1.6*sz), nc, 0.7);
    var tr = n.trail || [];
    for(var i = 1; i < tr.length; i++){ var a = (i/tr.length)*0.55, pa = tr[i-1], pb = tr[i];
      line([pa[0], (pa[2] || 0)*D3_KZ, pa[1]], [pb[0], (pb[2] || 0)*D3_KZ, pb[1]], [nc[0], nc[1], nc[2], a*0.8], [nc[0], nc[1], nc[2], a]); }
  });
  // трассеры: от груди стрелка к цели
  if(typeof showTracers === "undefined" || showTracers.checked) tracers.forEach(function(t){
    var age = nowTs - t.born; if(age > 260) return;
    var zz = D3.trZ.get(t);
    if(!zz){ var near = function(x, y){ var best = null, bd = 18; bots.forEach(function(o){ var d = Math.hypot(o.x - x, o.y - y); if(d < bd && o.z != null){ bd = d; best = o.z; } }); return best; };
      var z1 = near(t.x1, t.y1), z2 = near(t.x2, t.y2); if(z1 == null) z1 = d3FloorNear(t.x1, t.y1, null); if(z2 == null) z2 = z1; zz = [z1, z2]; D3.trZ.set(t, zz); }
    var k = 1 - age/260, tc2 = t.team === "CT" ? [0.56, 0.75, 0.94] : [0.96, 0.75, 0.38];
    line([t.x1, zz[0]*D3_KZ + 21*sz*0.7, t.y1], [t.x2, zz[1]*D3_KZ + 21*sz*0.6, t.y2], [tc2[0], tc2[1], tc2[2], 0.15*k], [tc2[0], tc2[1], tc2[2], 0.95*k]);
  });
  if(LN.length){
    gl.useProgram(pL.p); var LA = new Float32Array(LN), np = LA.length/7, Pp = new Float32Array(np*3), Pc = new Float32Array(np*4);
    for(var li = 0; li < np; li++){ Pp[li*3] = LA[li*7]; Pp[li*3+1] = LA[li*7+1]; Pp[li*3+2] = LA[li*7+2]; for(var cc = 0; cc < 4; cc++) Pc[li*4+cc] = LA[li*7+3+cc]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, D3.lines.p); gl.bufferData(gl.ARRAY_BUFFER, Pp, gl.DYNAMIC_DRAW); d3Attr(gl, pL.aP, D3.lines.p, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, D3.lines.c); gl.bufferData(gl.ARRAY_BUFFER, Pc, gl.DYNAMIC_DRAW); d3Attr(gl, pL.aC, D3.lines.c, 4);
    gl.drawArrays(gl.LINES, 0, np);
  }
  if(STY.a < 1) drawWorld();
}
// точка сцены → px экрана (CSS) или null (за камерой)
function d3Proj(x, y, z){
  var m = D3.VP, X = m[0]*x + m[4]*y + m[8]*z + m[12], Y = m[1]*x + m[5]*y + m[9]*z + m[13], W = m[3]*x + m[7]*y + m[11]*z + m[15];
  if(W <= 0.01) return null; return [(X/W*0.5 + 0.5)*D3.W, (0.5 - Y/W*0.5)*D3.H];
}
// табличка ника над капсулой (DOM): плашка цвета стороны, иконка оружия
function d3Tag(b, x, y, z, col){
  var el = D3.tagEls[b.id];
  if(!el){ var host = document.getElementById("v3Lab"); el = document.createElement("div"); el.className = "v3-tag " + (b.team === "CT" ? "ct" : "t");
    el.innerHTML = '<span class="v3-wp"></span><b></b>'; host.appendChild(el); D3.tagEls[b.id] = el; }
  var cls = "v3-tag " + (b.team === "CT" ? "ct" : "t") + (OBS.lock === b.id ? " sel" : ""); if(el.className !== cls) el.className = cls;
  var nm = nick(b.id); if(el._nm !== nm){ el._nm = nm; el.lastChild.textContent = nm; }
  var wk = b.weapon && b.weapon.key; if(el._wk !== wk){ el._wk = wk; var ic = wk && KF_ICON[wk]; el.firstChild.innerHTML = ic ? '<svg viewBox="' + ic.vb + '">' + ic.svg + '</svg>' : ""; }
  var p = d3Proj(x, y, z); if(!p || p[0] < -60 || p[1] < -40 || p[0] > D3.W + 60 || p[1] > D3.H + 40){ el.style.display = "none"; return; }
  el.style.display = ""; el.style.transform = "translate(" + p[0].toFixed(1) + "px," + p[1].toFixed(1) + "px) translate(-50%,-100%)";
  var zi = String(1000 - Math.round(Math.hypot(x - D3.eye[0], y - D3.eye[1], z - D3.eye[2])/4)); if(el.style.zIndex !== zi) el.style.zIndex = zi;   // ближний — сверху
}

// ---------- управление: ЛКМ — двигать карту (как в 2D), ПКМ — повернуть и наклонить, колесо — приближение; клик по игроку — слежка ----------
(function(){
  var c = document.getElementById("cv3"), btn = document.getElementById("btn3d"); if(!c || !btn) return;
  btn.addEventListener("click", function(){ d3Toggle(!D3.on); });
  var setScale = function(f){ var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale;
    view.scale = Math.max(0.15, Math.min(12, view.scale*f)); view.panX = cv.width/2 - cx*view.scale; view.panY = cv.height/2 - cy*view.scale; obsManual(); };
  c.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  c.addEventListener("wheel", function(e){ e.preventDefault(); setScale(e.deltaY < 0 ? 1.1 : 1/1.1); }, {passive: false});
  c.addEventListener("pointerdown", function(e){ D3.drag = {x: e.clientX, y: e.clientY, b: e.button, moved: false}; c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", function(e){ var d = D3.drag; if(!d) return; var dx = e.clientX - d.x, dy = e.clientY - d.y; if(Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; if(!d.moved) return;
    d.x = e.clientX; d.y = e.clientY;
    if((d.b === 2 || e.shiftKey) && !D3.lock){ D3.yawT -= dx*0.006; D3.top = false; D3.pitchT = Math.max(0.35, Math.min(1.5, D3.pitchT + dy*0.005)); return; }
    var k = 1/Math.max(0.15, Math.sin(D3.pitch)), cy = Math.cos(D3.yaw), sy = Math.sin(D3.yaw);   // экран → земля с учётом поворота
    var wx = (dx*cy + dy*sy*k), wy = (-dx*sy + dy*cy*k);
    view.panX += wx; view.panY += wy; obsManual(); });
  c.addEventListener("pointerup", function(e){ var d = D3.drag; D3.drag = null; if(!d || d.moved || d.b !== 0) return;
    var r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = 22;
    bots.forEach(function(b){ if(!b.alive) return; var p = d3Proj(b.x, (b.z || 0)*D3_KZ + 12, b.y); if(!p) return; var dd = Math.hypot(p[0] - mx, p[1] - my); if(dd < bd){ bd = dd; best = b; } });
    if(best){ if(OBS.lock === best.id) OBS.lock = null; else { OBS.lock = best.id; OBS.on = true; OBS.manualUntil = 0; if(plSelected !== best.id){ plSelected = best.id; playersUpdate(); } } }
    else OBS.lock = null; });
  var tb = function(id, f){ var el = document.getElementById(id); if(el) el.addEventListener("click", f); };
  tb("v3Lock", function(){ D3.lock = !D3.lock; this.classList.toggle("on", D3.lock); this.title = D3.lock ? "Угол закреплён — нажми, чтобы снова поворачивать (ПКМ)" : "Закрепить угол камеры"; });
  var stB = document.getElementById("v3Style");
  var stSet = function(i){ D3.style = (i + D3_STYLES.length) % D3_STYLES.length; if(stB) stB.title = "Вид стен: " + D3_STYLES[D3.style].name + " (нажми — следующий)"; try{ localStorage.setItem("sim-3d-style", D3_STYLES[D3.style].id); }catch(e){} };
  try{ var sv = localStorage.getItem("sim-3d-style"); D3_STYLES.forEach(function(q, k){ if(q.id === sv) D3.style = k; }); }catch(e){}
  stSet(D3.style); tb("v3Style", function(){ stSet(D3.style + 1); });
  tb("v3In", function(){ setScale(1.25); }); tb("v3Out", function(){ setScale(1/1.25); });
  tb("v3Rot", function(){ if(D3.lock) return; D3.yawT = Math.round((D3.yawT - Math.PI/2)/(Math.PI/2))*(Math.PI/2); });
  tb("v3Top", function(){ if(D3.lock) return; D3.top = !D3.top; this.classList.toggle("on", D3.top); if(!D3.top && D3.pitchT > 1.3) D3.pitchT = 0.95; });
  var saved = null; try{ saved = localStorage.getItem("sim-3d"); }catch(e){}
  if(saved === "1") d3Toggle(true);
})();
