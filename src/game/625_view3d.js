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
var D3_FP_AIM = 0.26, D3_FP_PRATE = 87*Math.PI/180;   // от первого лица: на врага — если смотрит в ± 15° (до ± 24° — плавно слабее); наклон ≤ 87°/с (p99 про)
var D3_FP_SLOPE = 0.75, D3_FP_DZMAX = 160;   // (v593) пол у точки взгляда — не круче лестницы (подъём 0,75 на 1) и не дальше 160 ед. по высоте (окно Mid → Window +105) — проектные
var D3_FP_PW = 9, D3_FP_ZW = 14, D3_FP_PDEAD = 0.012;   // (v590) пружины наклона 9/с и высоты глаз 14/с; цель наклона меньше 0,7° не сдвигается — проектные
// пружина без перелёта (критическое затухание, как SmoothDamp): s = {x, v} догоняет цель за ≈ 1/w с; vmax — предел скорости (0 — без предела)
function d3Spring(s, to, w, dt, vmax){ if(dt <= 0){ return s; } var e = Math.exp(-w*dt), d = s.x - to, t = (s.v + w*d)*dt;
  s.v = (s.v - w*t)*e; var nx = to + (d + t)*e; if(vmax > 0){ var lim = vmax*dt; if(nx - s.x > lim) nx = s.x + lim; if(s.x - nx > lim) nx = s.x - lim; s.v = Math.max(-vmax, Math.min(vmax, s.v)); } s.x = nx; return s; }
var D3_EYE_CAMS = {fp: 1, chase: 1, flythru: 1, nade: 1, spawn: 1};   // (v591) камеры на уровне глаз — без среза, стены сплошные
var D3_XR_R = 1000;   // (v591) враги ближе 1000 px радара (2500 ед.) — кандидаты в «ближайших» для силуэта сквозь стены (проектное)
var D3_TAG_TEAM = 600, D3_TAG_ENEMY = 2, D3_GLOW_W = 0.9;   // (v590) ник своего — ближе 600 px радара (1500 ед.), ник врага — у 2 ближайших видимых; обводка — не тоньше, px сцены — проектные
var D3_TR_SHOT = 58, D3_TR_HIT = 50;   // ед. игры: трассер — от оружия у глаз (глаза 64), в грудь цели (проектные)
var D3 = {on: false, xray: false, sims: true, corpse: {}, mode: "view", tgt: null, nadeLast: null, style: 0, cam: "view", hist: {}, fpId: null, noTags: false, gl: null, built: false, failed: null, yaw: 0, pitch: 0.95, yawT: 0, pitchT: 0.95, top: false, lock: false,
          tz: null, drag: null, tagEls: {}, nadeZ: [], smZ: new WeakMap(), trZ: new WeakMap()};
try{ window.__d3cam = function(){ return D3.fpP ? {y: D3.fpP.y, yv: D3.fpP.yv, p: D3.fpP.p, pv: D3.fpP.pv, id: D3.fpP.id, tgt: D3.fpTgt || null} : null; }; window.__d3corpse = function(){ var o = {}; for(var k in D3.corpse){ var c = D3.corpse[k]; o[k] = {x: Math.round(c.x*10)/10, z: Math.round(c.zz*10)/10, y: Math.round(c.y*10)/10, landed: !!c.landed, th: Math.round(c.th*100)/100, v: Math.round(Math.hypot(c.v[0], c.v[2])*10)/10}; } return o; }; window.__d3set = function(k, v){ D3[k] = v; }; window.__d3get = function(){ return {cam: D3.cam, mode: D3.mode, fpId: D3.fpId}; }; }catch(e){}
var D3_KZ = 0.4;               // ед. игры → px радара (высота)
var D3_CUT = 150;              // проектное число: выше этого над полом геометрия не рисуется (ящик 64, два ящика 128 ед.)
var D3_FOV = 38 * Math.PI/180;
var D3_LOW = 28;               // проектное число: опущенная стена «как в Симсе» — бортик, ед. игры
// виды мира (владелец 13.11: «прозрачный был лучше — от него, но сделай несколько вариаций»): a — плотность граней, ea — яркость рёбер
var D3_STYLES = [{id: "glass", name: "стекло", a: 0.32, ea: 0.6}, {id: "line", name: "контур", a: 0.1, ea: 0.85}, {id: "solid", name: "макет", a: 1, ea: 0.3}];
var D3_HIDE = {"default": 1};   // (владелец 13.11: «дырки и странные объекты — как будто посчитаны невидимые стены») служебные плоскости карты (блокираторы взгляда) — не рисуются: из 25 треугольников больше 200000 ед² у Mirage 22 — этот материал
var D3_HIDE_AREA = 20000;      // (v590, владелец 24.11: «найти все дырки в стенках, детали зданий сохранялись») материал D3_HIDE скрыт только у плоскостей больше
                               // этой площади (ед²) — блокираторы; обычные стены с этим материалом (Mirage: 5451 из 5811 треугольников «default») рисуются
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
  "void main(){ float r = refY(vW); if(r < -1e8){ if(uCut < 1e4) discard; r = vW.y - 30.0; } float h = vW.y - r, cu = cutAt(vW, uEye); if(h > cu) discard;\n" +   // (v590) без среза (от первого лица) — без пола рядом не выбрасывается: дыры в фасадах
  // (v591, владелец 24.11: «нет стенок у ящиков, пустая стена») треугольники карты без замкнутого блока («суп», vK ≥ 2,5) — двусторонние:
  // их сторона наружу в данных не задана, отсечение изнанки выбрасывало бока ящиков и стены; изнанку отсекаем только у выпуклых блоков
  " float kk = vK, soup = 0.0; if(kk > 2.5){ soup = 1.0; kk -= 3.0; } if(uA < 1.0 && kk < 1.5 && soup < 0.5 && !gl_FrontFacing) discard;\n" +
  " vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if(dot(n, uEye - vW) < 0.0) n = -n; vec3 c;\n" +
  // (v597, владелец 25.11: «что не так отображается») плоское вверх у пола (до 24 ед. — 9,6 px сцены), не попавшее в пол при сборке (песок и земля улиц, пандусы,
  // бордюры, куски улицы: этаж блока ниже), красилось как предмет у земли — затемнение 0,55 давало тёмные полосы по улице; теперь — цвет пола
  " if(kk > 1.5 || (n.y > 0.7 && h < 9.6)){ float t = clamp((vW.y - uZr.x)/max(1.0, uZr.y - uZr.x), 0.0, 1.0); c = uGround*(0.86 + 0.32*t)*(0.95 + 0.07*max(dot(n, uL), 0.0)); }\n" +
  " else if(!gl_FrontFacing && uA >= 1.0 && soup < 0.5) c = uCap; else { vec3 base = mix(uProp, uRock, kk); float d = max(dot(n, uL), 0.0), hm = 0.5 + 0.5*n.y;\n" +
  "  c = base*(0.30 + 0.36*hm + 0.50*d); c *= mix(0.55, 1.0, smoothstep(0.0, 26.0, h)); }\n" +
  " if(kk < 1.5) c = mix(c, uCap*1.06, smoothstep(cu - 1.4, cu, h)*0.85);\n" +
  " float f = smoothstep(uFog.x, uFog.y, distance(vW, uEye)); float rim = smoothstep(cu - 1.4, cu, h);\n" +
  " if(uA < 1.0) o = vec4(c, (uA + rim*0.5)*(1.0 - f)); else o = vec4(mix(c, uBg, f), 1.0); }";
// (v593, владелец 24.11: «в общем виде сверху края карты, где нет объектов, — стилизовать, чтобы не выглядело тупо») подложка: одна плоскость под
// картой, сетка и затухание за границей карты — в шейдере (один треугольник-пара на кадр)
var D3_GVS = "#version 300 es\nin vec2 aP; uniform mat4 uVP; uniform float uY; out vec2 vW; void main(){ vW = aP; gl_Position = uVP*vec4(aP.x, uY, aP.y, 1.0); }";
var D3_GFS = "#version 300 es\nprecision highp float; in vec2 vW; uniform vec3 uBg, uC; uniform vec4 uB; uniform vec2 uFog; uniform vec3 uEye; uniform float uY, uGr; out vec4 o;\n" +
  "void main(){ vec2 q = vW/64.0, g = abs(fract(q - 0.5) - 0.5)/max(fwidth(q), vec2(1e-4)); float ln = 1.0 - min(min(g.x, g.y), 1.0);\n" +
  " vec2 dd = max(max(uB.xy - vW, vW - uB.zw), vec2(0.0)); float a = exp(-length(dd)/260.0);\n" +
  " float f = smoothstep(uFog.x, uFog.y*1.4, distance(vec3(vW.x, uY, vW.y), uEye));\n" +
  " vec3 c = mix(uBg, uC, a*(1.0 - f)); c = mix(c, mix(uBg, uC*1.9, 0.4), ln*0.6*uGr*a*(1.0 - f)); o = vec4(c, 1.0); }";
var D3_ELVS = "#version 300 es\nin vec3 aP; uniform mat4 uVP; out vec3 vW; void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.0); gl_Position.z -= 0.0006*gl_Position.w; }";
var D3_ELFS = "#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye; uniform vec4 uC; uniform vec2 uFog; out vec4 o;\n" + D3_CUTF +
  "void main(){ float r = refY(vW); if(r < -1e8){ if(uCut < 1e4) discard; r = vW.y; } if(vW.y - r > cutAt(vW, uEye) + 0.2) discard; o = vec4(uC.rgb, uC.a*(1.0 - smoothstep(uFog.x, uFog.y, distance(vW, uEye)))); }";
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
  // (v589) маска «рядом с проходимым» (радиус 2 блока = 8 px): стена или ящик, у которой все вершины чуть за краем навмеша,
  // раньше выпадала целиком и силуэт рвался (отметка владельца: «оборвана геометрия, дырки»). Далеко от игры — по-прежнему не берём
  var N = new Uint8Array(BN*BN);
  for(var b2 = 0; b2 < BN*BN; b2++){ if(!L[b2]) continue; var bi2 = b2 % BN, bj2 = (b2 / BN) | 0;
    for(var dj2 = -2; dj2 <= 2; dj2++) for(var di2 = -2; di2 <= 2; di2++){ var x2 = bi2+di2, y2 = bj2+dj2; if(x2 < 0 || y2 < 0 || x2 >= BN || y2 >= BN) continue; N[y2*BN + x2] = 1; } }
  return (D3_FB = {BS: BS, BN: BN, L: L, N: N});
}
// пол под точкой для объектов без высоты (дым, огонь, бомба): ближайший к подсказке этаж клетки
function d3FloorNear(x, y, zh){
  var M = m3(); if(M){ var c = m3Cell(M, x, y); if(c >= 0){ var st = M.floors.st, fz = M.floors.z, best = null;
    for(var q = st[c]; q < st[c+1]; q++){ var z = fz[q]; if(zh == null ? (best === null || z > best) : (best === null || Math.abs(z - zh) < Math.abs(best - zh))) best = z; }
    if(best !== null && (zh == null || Math.abs(best - zh) < 120)) return best; } }
  var a = typeof navAt === "function" ? navAt(x, y, zh) : null;
  return a ? (typeof navFloorZ === "function" ? navFloorZ(a, x, y) : a.z) : (zh != null ? zh : 0);
}

// (v593) пол в точке, ближайший к высоте zh и не дальше maxDz от неё; нет такого — null (без запасного навмеша: он давал верхний этаж)
function d3FloorAt(x, y, zh, maxDz){
  var M = m3(); if(!M) return null; var c = m3Cell(M, x, y); if(c < 0) return null;
  var st = M.floors.st, fz = M.floors.z, best = null;
  for(var q = st[c]; q < st[c+1]; q++){ var z = fz[q]; if(Math.abs(z - zh) <= maxDz && (best === null || Math.abs(z - zh) < Math.abs(best - zh))) best = z; }
  return best;
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
// ---------- (v591, владелец 24.11: «что-то в руках, когда стреляет — отдача; анимация, как ставит бомбу; реальный импакт, камера в стиле
// Counter-Strike») — только показ: выстрелы узнаём по новым трассерам (начало трассера — у стрелка), отдача и вспышка — по времени кадра ----------
var D3_KICK_MS = 110, D3_FLASH_MS = 45;   // отдача оружия и вспышка у дула, мс — проектные
function d3ShotsScan(){
  var S = D3.shotAt || (D3.shotAt = {}), seen = D3.trSeen || (D3.trSeen = new WeakSet());
  tracers.forEach(function(t){ if(seen.has(t)) return; seen.add(t); var best = null, bd = 14;
    bots.forEach(function(o){ if(o.team !== t.team) return; var d = Math.hypot(o.x - t.x1, o.y - t.y1); if(d < bd){ bd = d; best = o; } });
    if(best){ S[best.id] = t.born; D3.shotN = (D3.shotN || 0) + 1; } });
}
function d3Kick(id){ var t = D3.shotAt && D3.shotAt[id]; if(t == null) return 0; var a = nowTs - t; return a < 0 || a > D3_KICK_MS ? 0 : 1 - a/D3_KICK_MS; }
function d3FlashOn(id){ var t = D3.shotAt && D3.shotAt[id]; return t != null && nowTs - t >= 0 && nowTs - t < D3_FLASH_MS; }
// матрица по базису: ось a — длина, b — высота (у коробки низ в 0), c — ширина; o — точка
function d3Basis(o, a, b, c, la, lb, lc){ return new Float32Array([a[0]*la, a[1]*la, a[2]*la, 0, b[0]*lb, b[1]*lb, b[2]*lb, 0, c[0]*lc, c[1]*lc, c[2]*lc, 0, o[0], o[1], o[2], 1]); }
// оружие в руках фигуры: ствольная коробка, ствол, магазин; отдача — назад и вверх; вспышка у дула
function d3Gun(draw, x, z, y, f, h, kick, flash){
  var ca = Math.cos(f), sa = Math.sin(f), back = kick*h*0.07, up = kick*h*0.03, fw = [ca, 0, sa], upv = [0, 1, 0], sd = [-sa, 0, ca];
  var bx = x + ca*(h*0.32 - back), by = z + h*0.54 + up, bz = y + sa*(h*0.32 - back), dark = [0.09, 0.1, 0.08, 1];
  draw(D3.box, d3Basis([bx, by, bz], fw, upv, sd, h*0.15, h*0.07, h*0.035), dark, 0.6);   // коробка
  draw(D3.box, d3Basis([bx + ca*h*0.2, by + h*0.025 + up*0.5, bz + sa*h*0.2], fw, upv, sd, h*0.1, h*0.025, h*0.015), [0.06, 0.06, 0.06, 1], 0.5);   // ствол
  draw(D3.box, d3Basis([bx + ca*h*0.04, by - h*0.07, bz + sa*h*0.04], fw, upv, sd, h*0.03, h*0.07, h*0.025), [0.12, 0.12, 0.1, 1], 0.5);   // магазин
  if(flash){ var mx = bx + ca*h*0.33, my = by + h*0.035, mz = bz + sa*h*0.33; draw(D3.sphere, d3Model(mx, my, mz, h*0.06, h*0.06, h*0.06), [1, 0.85, 0.45, 0.95], 0, 0); }
}
// (владелец 13.11: «моделька после смерти остаётся, голова и туловище получают физику и скатываются») тело: корпус падает вокруг
// ступней в сторону от убийцы (или назад от взгляда), у пола — отскок и трение; голова отрывается при ударе и катится; стены — лучом
// по геометрии (m3Line). Только показ, своё время — по тикам игры (пауза — стоит), до нового раунда.
// (v590, владелец 24.11: «исправить физику тела, чтобы падали нормально, а не улетали куда-то») было (снимок м3, CT0 т. 2125): тело
// падало сквозь стену и ящик (направление не проверялось), голова рождалась на конце тела в 78 ед. от ступней и ложилась на ящик
// высотой 68 ед. (пол головы искался без связи с полом тела), убитый в прыжке висел в воздухе. Стало: направление падения — ближайшее к
// «от убийцы», где длина тела свободна (луч по геометрии на высоте пояса и груди, пол под головой — на высоте пола тела, ± D3_HEAD_DROP: не ложится на ящик и не висит над обрывом); тело оседает на
// пол (тяжесть); голова не отрывается от тела дальше D3_HEAD_ROLL, не взбирается на уступ выше D3_HEAD_STEP и не падает с него
// ниже D3_HEAD_DROP — катится у тела.
var D3_HEAD_ROLL = 10, D3_HEAD_STEP = 6, D3_HEAD_DROP = 16;   // px сцены (25 ед.); ед. игры; ед. игры — проектные числа
function d3Corpse(b, draw, col, sz){
  var C = D3.corpse[b.id], M = m3();
  if(!C){
    var ang = (b._visFacing !== undefined ? b._visFacing : (b.facing || 0)) + Math.PI, kb = b._killer ? bots.filter(function(o){ return o.id === b._killer; })[0] : null;
    if(kb) ang = Math.atan2(b.y - kb.y, b.x - kb.x);
    ang += (d3R(tick*0.37 + b.x) - 0.5)*0.8;
    var h = 27*1.15, zg = b.z != null ? b.z : d3FloorNear(b.x, b.y, null), fl0 = d3FloorBelow(b.x, b.y, zg + 2);   // размер тела — как у фигуры вблизи (не по удалению камеры)
    // свободно ли тело в сторону a: луч от пояса и от груди на длину тела, пол у головы — не выше пола тела (не ложится на ящик)
    // (v597, владелец 25.11: «тела падали нормально, а не улетали») луч m3Line — в px радара (как visLine, 040); здесь передавались координаты
    // игры (m3Game) — луч уходил за карту, «стены нет» всегда: тело падало в стену и ящик, скользило сквозь стену
    // k — доля длины тела (свободно ли место до этой точки); + 3 px — тело при падении проскальзывает вперёд (12 px/с, затухание 0,93 за тик ≈ 2,7 px);
    // нижний луч — 12 ед. (бордюр)
    var clear = function(a, k){ if(!M) return true; var L = (h*0.95 + 3)*(k || 1), tx = b.x + Math.cos(a)*L, ty = b.y + Math.sin(a)*L;
      if(!m3Line(M, b.x, b.y, fl0 + 12, tx, ty, fl0 + 12, "sight") || !m3Line(M, b.x, b.y, fl0 + 40, tx, ty, fl0 + 24, "sight")) return false;
      return Math.abs(d3FloorBelow(tx, ty, fl0 + 30) - fl0) <= D3_HEAD_DROP; };
    var OFF = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI], best = null, thEnd = Math.PI/2;
    for(var oi = 0; oi < OFF.length; oi++) if(clear(ang + OFF[oi])){ best = ang + OFF[oi]; break; }
    // (v597) лечь некуда (угол, стена с ящиком; замер м3, м7, м11, м13: 3 тела из 54 — в стене или головой на ящике): в сторону, где больше всего
    // места, и не плашмя — оседает, привалившись к стене (наклон — до упора головы)
    if(best === null){ var room = 0; best = ang;
      for(oi = 0; oi < OFF.length; oi++){ var kk = 0; for(var kq = 0.2; kq <= 0.81; kq += 0.2) if(clear(ang + OFF[oi], kq)) kk = kq; else break; if(kk > room){ room = kk; best = ang + OFF[oi]; } }
      thEnd = Math.asin(Math.max(0.35, room)); }
    ang = best;
    C = D3.corpse[b.id] = {t: tick, dx: Math.cos(ang), dz: Math.sin(ang), th: 0.05, thEnd: thEnd, w: 0, x: b.x, y: zg*D3_KZ, vy: 0, zz: b.y, h: h, landed: false,
      head: null, v: [Math.cos(ang)*12, 0, Math.sin(ang)*12]};
    if(D3.hist[b.id]) D3.hist[b.id].length = 0;
  }
  var steps = Math.min(16, Math.max(0, tick - (C.tk || C.t))); C.tk = tick;
  var DT = 1/TICK_HZ, G = 320;   // сила тяжести, px сцены/с² (800 ед/с²)
  var wallOk = function(x0, z0, x1, z1, y){ if(!M) return true; return m3Line(M, x0, z0, y/D3_KZ + 8, x1, z1, y/D3_KZ + 8, "sight"); };
  for(var i = 0; i < steps; i++){
    // тело оседает на пол под ступнями (убит в прыжке, на краю уступа)
    var flB = d3FloorBelow(C.x, C.zz, C.y/D3_KZ + 2)*D3_KZ;
    if(C.y > flB + 0.05){ C.vy -= G*DT; C.y = Math.max(flB, C.y + C.vy*DT); } else { C.y = flB; C.vy = 0; }
    if(!C.landed){ C.w += (G/(C.h*0.55))*Math.sin(C.th)*DT; C.th += C.w*DT;   // падает вокруг ступней
      var nx = C.x + C.v[0]*DT, nz = C.zz + C.v[2]*DT;
      if(wallOk(C.x, C.zz, nx, nz, C.y) && d3FloorBelow(nx, nz, C.y/D3_KZ + 2)*D3_KZ >= C.y - 8){ C.x = nx; C.zz = nz; } else { C.v[0] = 0; C.v[2] = 0; }   // не сползает со ступени
      C.v[0] *= 0.93; C.v[2] *= 0.93;
      if(C.th >= C.thEnd){ C.th = C.thEnd; C.landed = true; if(C.thEnd >= 1.5){   // привалился к стене (thEnd < 1,5) — голова не отскакивает; удар об пол — голова отскакивает от конца тела и катится недалеко
        var sp = Math.min(C.w*C.h*0.5, 40), hr0 = C.h*0.13;
        C.head = {p: [C.x + C.dx*C.h*0.9, C.y + hr0, C.zz + C.dz*C.h*0.9], o: null, v: [C.dx*sp*0.25 + (d3R(C.t)-0.5)*6, sp*0.06, C.dz*sp*0.25 + (d3R(C.t+1)-0.5)*6], r: hr0, rot: 0};
        C.head.o = C.head.p.slice(); } } }
    var hd = C.head; if(hd && (Math.abs(hd.v[0]) + Math.abs(hd.v[1]) + Math.abs(hd.v[2]) > 0.5)){
      hd.v[1] -= G*DT; var hx = hd.p[0] + hd.v[0]*DT, hz = hd.p[2] + hd.v[2]*DT, hy0 = hd.p[1] - hd.r;
      var flN = d3FloorBelow(hx, hz, hy0/D3_KZ + D3_HEAD_STEP)*D3_KZ;   // пол там, куда катится: выше уступа — стена
      if(Math.hypot(hx - hd.o[0], hz - hd.o[2]) < D3_HEAD_ROLL && flN <= hy0 + D3_HEAD_STEP*D3_KZ && flN >= hy0 - D3_HEAD_DROP*D3_KZ && wallOk(hd.p[0], hd.p[2], hx, hz, hy0)){ hd.p[0] = hx; hd.p[2] = hz; }
      else { hd.v[0] *= -0.3; hd.v[2] *= -0.3; }
      hd.p[1] += hd.v[1]*DT; var fl = d3FloorBelow(hd.p[0], hd.p[2], (hd.p[1] - hd.r)/D3_KZ + 2)*D3_KZ;
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
var D3_NADE_EYE = 9, D3_NADE_TGT = 16;   // (v593) камера за гранатой догоняет: место и взгляд, 1/с — проектные
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
  var F = d3Acc(), FS = d3Acc(), zLo = Infinity, zHi = -Infinity;   // FS — бортики (v597: отдельно — у камер на уровне глаз не рисуются)
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
      FS.tri(p, q, q2, [cSide, cSide, cSide]); FS.tri(p, q2, p2, [cSide, cSide, cSide]); }
  });
  D3.floor = d3Mesh(gl, F.P, F.N, F.C); D3.floorSk = d3Mesh(gl, FS.P, FS.N, FS.C); D3.cFloor = cFloor; D3.zr = [zLo*D3_KZ, zHi*D3_KZ];
  var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  NAVAREAS.forEach(function(a){ a.points.forEach(function(p){ if(p.x < bx0) bx0 = p.x; if(p.x > bx1) bx1 = p.x; if(p.y < by0) by0 = p.y; if(p.y > by1) by1 = p.y; }); });
  var E0 = 5000, gq = new Float32Array([bx0-E0, by0-E0, bx1+E0, by0-E0, bx1+E0, by1+E0, bx0-E0, by0-E0, bx1+E0, by1+E0, bx0-E0, by1+E0]), gb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gb); gl.bufferData(gl.ARRAY_BUFFER, gq, gl.STATIC_DRAW);
  D3.plate = {b: gb, bounds: [bx0, by0, bx1, by1], y: zLo*D3_KZ - 18, c: d3Hex(d3Tok("--v3-plate", "#141812"))};
  // мир — вся геометрия игры (флаг «взгляд», без клипов), срез по высоте над полом под каждой точкой — в шейдере (d3World, D3_WFS)
  var Wd = d3World(gl);
  D3.world = Wd; var nT = Wd.cnt/3;
  // фигуры: капсула (высота 1, радиус 1 по x/z — масштаб при рисовании), шар, диск, коробка
  D3.capsule = d3Shape(gl, "capsule"); D3.ring = d3Shape(gl, "ring"); D3.sphere = d3Shape(gl, "sphere"); D3.disc = d3Shape(gl, "disc"); D3.box = d3Shape(gl, "box"); D3.cone = d3Shape(gl, "cone");
  D3.lines = {p: gl.createBuffer(), c: gl.createBuffer()};
  D3.built = true; D3.stat = {tri: nT, triAll: Wd.cntAll/3, edges: Wd.ecnt/2, ms: Math.round(performance.now() - t0)};
  try{ window.__d3scene = D3.stat; }catch(e){}
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
  var M = m3(); if(!M) return {cnt: 0, ecnt: 0, cntAll: 0, ecntAll: 0};
  var F = d3FloorBlocks(M), X0 = M.X0, Y0 = M.Y0, mats = M.mats || [], cutU = D3_CUT;
  var ST = (window.__d3stat = {droppedNav: 0, droppedCut: 0, hiddenMat: 0, tri: 0, hull: 0, hullSkip: 0, floor: 0, area1: 0, area2: 0, area8: 0, areaBig: 0});
  var P = [], K = [], E = [], G = [], P2 = [], K2 = [], G2 = [];   // G2 — пол внутри возвышения: только у камер на уровне глаз (v597)   // P2 — выше среза и дальше от проходимой части: только от первого лица (v590)
  var blk = function(x, y){ var i = Math.floor(x / M.cell / F.BS), j = Math.floor(y / M.cell / F.BS); return (i < 0 || j < 0 || i >= F.BN || j >= F.BN) ? null : F.L[j*F.BN + i]; };
  var nearW = function(x, y){ var i = Math.floor(x / M.cell / F.BS), j = Math.floor(y / M.cell / F.BS); return (i < 0 || j < 0 || i >= F.BN || j >= F.BN) ? 0 : F.N[j*F.BN + i]; };
  var blkNear = function(x, y){ for(var d = 3; d <= 6; d++) for(var k = 0; k < 8; k++){ var a = k/8*Math.PI*2; if(blk(x + Math.cos(a)*d*M.cell*F.BS, y + Math.sin(a)*d*M.cell*F.BS)) return true; } return false; };
  var near = function(A, z, d){ if(A) for(var t = 0; t < A.length; t++) if(Math.abs(A[t] - z) < d) return true; return false; };
  var under = function(A, z){ var b = null; if(A) for(var t = 0; t < A.length; t++) if(A[t] <= z + 8 && (b === null || A[t] > b)) b = A[t]; return b; };
  // a, b, c — ед. игры (x, y, z); kind — 1 природный рельеф; edgeOk — рёбра искать
  var push = function(a, b, c, kind){
    var ra = m3Radar(M, a[0], a[1]), rb = m3Radar(M, b[0], b[1]), rc = m3Radar(M, c[0], c[1]);
    var Aa = blk(ra[0], ra[1]), Ab = blk(rb[0], rb[1]), Ac = blk(rc[0], rc[1]), mid = [(ra[0] + rb[0] + rc[0])/3, (ra[1] + rb[1] + rc[1])/3];
    // (v590) дальше маски v589 (2 блока): фасады, крыши и навесы до 6 блоков (48 px; центр большого треугольника — над улицей) — во второй
    // набор, их видно от первого лица; ещё дальше — не рисуется (было: выбрасывалось — дыры в стенах от первого лица)
    var out = !Aa && !Ab && !Ac && !nearW(ra[0], ra[1]) && !nearW(rb[0], rb[1]) && !nearW(rc[0], rc[1]);
    // (v597, владелец 25.11: «найти все дырки в стенках, детали зданий сохранялись») ещё дальше от проходимой части (фасады и крыши у края карты,
    // ≈ 11 тыс. треугольников Mirage) — тоже во второй набор: от первого лица в проёмах на край карты был пустой фон
    var far = out && !blk(mid[0], mid[1]) && !blkNear(ra[0], ra[1]) && !blkNear(rb[0], rb[1]) && !blkNear(rc[0], rc[1]) && !blkNear(mid[0], mid[1]); if(far) ST.droppedNav++;
    var zmin = Math.min(a[2], b[2], c[2]), zmax = Math.max(a[2], b[2], c[2]);
    var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, l = Math.hypot(nx, ny, nz); if(l < 1e-6) return;
    if(out){ P2.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); K2.push(kind, kind, kind); return; }
    // (v591, владелец: «треугольник моргает — одна текстура перекрывает другую») плоское вверх в 24 ед. над полом — тоже пол (было: в предметы,
    // и предмет на одной высоте с полом мерцал поверх него)
    var rf = Math.abs(nz/l) > 0.7 ? under(Aa || Ab || Ac, zmax) : null;
    if(nz/l > 0.7 && (near(Aa || Ab || Ac, zmax, 10) || (rf !== null && zmax - rf < 24))){   // пол и ступени — отдельно, непрозрачно, цвета пола (навмеш — под ним, где геометрии нет)
      // пол внутри возвышения (над ним в той же клетке пол — пешком, прыжком, подсадкой — ниже роста, 8–110 ед.) — не рисуем: сквозь стекло стенки его видно (владелец)
      var cc = m3Cell(M, (ra[0] + rb[0] + rc[0])/3, (ra[1] + rb[1] + rc[1])/3);
      // (v597, владелец 25.11: «найти все дырки») у камер на уровне глаз стены сплошные — такой пол нужен: большой треугольник земли, у которого над
      // центром ящик, выбрасывался целиком — чёрные дыры в полу у ящиков и памятников (поиск дыр, Mirage: 300 точек от первого лица); он — во второй
      // набор пола (G2, после G), сверху не рисуется
      if(cc >= 0){ for(var fq = M.floors.st[cc]; fq < M.floors.st[cc+1]; fq++){ var dz = M.floors.z[fq] - zmax; if(dz > 8 && dz < 110){ ST.floorIn = (ST.floorIn || 0) + 1;
        G2.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); return; } } }
      G.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); return; }
    var r0 = under(Aa || Ab || Ac, zmin); if(r0 !== null && zmin - r0 > cutU + 8){ ST.droppedCut++; P2.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); K2.push(kind, kind, kind); return; }   // целиком выше среза — только от первого лица (v590; было: выброшено — дыры в верхе стен и потолках)
    var e1x = rb[0]-ra[0], e1y = rb[1]-ra[1], e2x = rc[0]-ra[0], e2y = rc[1]-ra[1], ar2 = Math.abs(e1x*e2y - e1y*e2x);
    if(ar2 < 0.5) ST.area1++; else if(ar2 < 2) ST.area2++; else if(ar2 < 8) ST.area8++; else ST.areaBig++;
    P.push(ra[0], a[2]*D3_KZ, ra[1], rb[0], b[2]*D3_KZ, rb[1], rc[0], c[2]*D3_KZ, rc[1]); K.push(kind, kind, kind);
  };
  var T = M.tri, tf = M.triFlag, tm = M.triMat, nt = tf.length; ST.tri = nt;
  for(var k = 0; k < nt; k++){ if(!(tf[k] & 1)) continue; var o = k*9;
    var mn = mats[tm[k]] || ("#" + tm[k]); ST.mats = ST.mats || {}; ST.mats[mn] = (ST.mats[mn] || 0) + 1;
    if(D3_HIDE[mats[tm[k]]]){ var hx1 = T[o+3]-T[o], hy1 = T[o+4]-T[o+1], hz1 = T[o+5]-T[o+2], hx2 = T[o+6]-T[o], hy2 = T[o+7]-T[o+1], hz2 = T[o+8]-T[o+2];
      var hnx = hy1*hz2 - hz1*hy2, hny = hz1*hx2 - hx1*hz2, hnz = hx1*hy2 - hy1*hx2, hl = Math.hypot(hnx, hny, hnz), hcz = hl ? Math.abs(hnz)/hl : 1;
      // (v591) наклонные плоскости этого материала — гладкие «клипы» поверх лестниц и пандусов (на снимке обзора — косые листы над Mid): скрыты;
      // стены (вертикально) и полы / крыши (горизонтально) — рисуются
      if(hl/2 > D3_HIDE_AREA || (hcz > 0.12 && hcz < 0.97)){ ST.hiddenMat++; continue; } }
    push([T[o], T[o+1], T[o+2]], [T[o+3], T[o+4], T[o+5]], [T[o+6], T[o+7], T[o+8]], (D3_SOFT[mats[tm[k]]] ? 1 : 0) + 3); }   // + 3 — «суп», двусторонний (v591)
  // выпуклые блоки: вершины — пересечения троек плоскостей внутри блока, грань — вершины на её плоскости по кругу (наружу)
  var hn = M.hullN, hp = M.hullP, ho = M.hullOff, hfl = M.hullFlag, hm = M.hullMat, FLL = M.fill || [];
  // (v597, владелец 25.11: «детали у зданий сохранялись», 13.11: «от ящиков остались доски») сплошные укрытия игры (m3SolidFill, v469: Triple Box
  // и др. — в игре ящик сплошной, видимость ботов идёт по нему) — тоже блоки: были видны только доски с щелями, сквозь щели — то, чего бот не видит
  for(var h = 0; h < hn.length + FLL.length; h++){
    var isF = h >= hn.length, pl = [], n, hMat;
    if(!isF){
      // (v597) блоки больше 26 граней (бочки, трубы, вазы, машина, вентиляция — 24 на Mirage, до 61 грани) пропускались целиком — «летающие» доски
      // без опор и пустые места; перебор троек плоскостей — один раз при сборке сцены
      if(!(hfl[h] & 1)){ ST.hullSkip++; continue; } ST.hull++;
      n = hn[h]; hMat = mats[hm[h]]; for(var q = 0; q < n; q++){ var b4 = (ho[h] + q)*4; pl.push([hp[b4], hp[b4+1], hp[b4+2], hp[b4+3]]); }
    } else { pl = FLL[h - hn.length].p; n = pl.length; hMat = "wood"; ST.fill = (ST.fill || 0) + 1; }
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
    if(D3_HIDE[hMat]) continue;
    var kind = D3_SOFT[hMat] ? 1 : 0;
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
  // рёбра — излом граней больше 37° или край (кроме природного рельефа: там рёбра — шум); по обоим наборам: у шва среза ребро не «край»
  var nLow = P.length/9; for(var q2 = 0; q2 < P2.length; q2++) P.push(P2[q2]); for(q2 = 0; q2 < K2.length; q2++) K.push(K2[q2]);
  var Em = new Map(), NN = [], E2 = [];
  for(var ti = 0; ti < P.length/9; ti++){ var a9 = ti*9;
    var ux2 = P[a9+3]-P[a9], uy2 = P[a9+4]-P[a9+1], uz2 = P[a9+5]-P[a9+2], vx2 = P[a9+6]-P[a9], vy2 = P[a9+7]-P[a9+1], vz2 = P[a9+8]-P[a9+2];
    var nx2 = uy2*vz2 - uz2*vy2, ny2 = uz2*vx2 - ux2*vz2, nz2 = ux2*vy2 - uy2*vx2, l2 = Math.hypot(nx2, ny2, nz2) || 1; NN.push(nx2/l2, ny2/l2, nz2/l2);
    if(K[ti*3] % 3 === 1) continue;
    for(var e = 0; e < 3; e++){
      var ia = a9 + e*3, ib = a9 + ((e+1) % 3)*3;
      var ka = Math.round(P[ia]*8) + "," + Math.round(P[ia+1]*8) + "," + Math.round(P[ia+2]*8), kb = Math.round(P[ib]*8) + "," + Math.round(P[ib+1]*8) + "," + Math.round(P[ib+2]*8);
      var kk = ka < kb ? ka + "|" + kb : kb + "|" + ka, r = Em.get(kk);
      if(!r) Em.set(kk, {a: ia, b: ib, t: ti, c: 1, cl: ti < nLow ? 1 : 0, crease: false});
      else { r.c++; if(ti < nLow) r.cl++; if(Math.abs(NN[r.t*3]*NN[ti*3] + NN[r.t*3+1]*NN[ti*3+1] + NN[r.t*3+2]*NN[ti*3+2]) < 0.55) r.crease = true; }   // (v589, владелец: «не перегруженной») излом — от 57°, а не от 37°: мелкие складки давали 39 тыс. линий и вид «рябью»
    }
  }
  // (v589, владелец: «чтобы выглядело не перегруженной») микро-рёбра (короче 1,5 px сцены) не рисуем: на экране это дрожащая рябь, а не форма
  var rl2 = 1.5, rcount = 0, nB = 0, nC = 0, nIn = 0, vset = new Set();
  // (v590) обзор — рёбра среди нижних треугольников (край — у единственного нижнего), от первого лица — плюс рёбра верхних (E2, после E)
  Em.forEach(function(r){ var low = r.cl > 0; if(low ? (r.cl !== 1 && !r.crease) : (r.c !== 1 && !r.crease)) return; var EL = low ? E : E2; var dx = P[r.b]-P[r.a], dy = P[r.b+1]-P[r.a+1], dz = P[r.b+2]-P[r.a+2]; if(Math.hypot(dx, dy, dz) < rl2) return; rcount++; if(r.c === 1){ nB++; var ax = P[r.a]/M.cell/F.BS, ay = P[r.a+2]/M.cell/F.BS; if(ax > 0 && ay > 0 && ax < F.BN && ay < F.BN && F.L[(ay|0)*F.BN + (ax|0)]) nIn++; } else nC++; EL.push(P[r.a], P[r.a+1], P[r.a+2], P[r.b], P[r.b+1], P[r.b+2]); });
  var eLow = E.length/3; for(q2 = 0; q2 < E2.length; q2++) E.push(E2[q2]);
  for(var vi = 0; vi < P.length; vi += 3) vset.add(Math.round(P[vi]*2) + "," + Math.round(P[vi+1]*2) + "," + Math.round(P[vi+2]*2));
  ST.edgesBoundary = nB; ST.edgesCrease = nC; ST.openInside = nIn; ST.uniqVerts = vset.size; ST.totalVerts = P.length/3;
  try{ window.__d3edges = rcount; }catch(e){}
  var buf = function(a){ var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
  // cnt / ecnt — со срезом (обзор), cntAll / ecntAll — всё (от первого лица)
  return {p: buf(new Float32Array(P)), k: buf(new Float32Array(K)), cnt: nLow*3, cntAll: P.length/3, e: buf(new Float32Array(E)), ecnt: eLow, ecntAll: E.length/3, ftex: d3FloorTex(gl, M),
          g: buf(new Float32Array(G.concat(G2))), gk: buf(new Float32Array(G.concat(G2).length/3).fill(2)), gcnt: G.length/3, gcntAll: (G.length + G2.length)/3};
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
    D3.gl = gl; D3.pM = d3Prog(gl, D3_VS, D3_FS); D3.pL = d3Prog(gl, D3_LVS, D3_LFS); D3.pW = d3Prog(gl, D3_WVS, D3_WFS); D3.pE = d3Prog(gl, D3_ELVS, D3_ELFS); D3.pG = d3Prog(gl, D3_GVS, D3_GFS);
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

// ---------- кадр ----------
// opt (повтор клатча, 675): {w, h} — размер кадра в px CSS, noTags — без табличек (кадр копируется в холст повтора)
function d3Frame(opt){
  if(!D3.on || !D3.gl) return;
  opt = opt || {};
  d3ShotsScan();
  var gl = D3.gl, c = gl.canvas, r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  var cw = opt.w || r.width, ch = opt.h || r.height;
  var Wc = Math.max(1, Math.round(cw*dpr)), Hc = Math.max(1, Math.round(ch*dpr));
  if(c.width !== Wc || c.height !== Hc){ c.width = Wc; c.height = Hc; }
  // камера «обзор»: цель — центр экрана 2D, приближение — view.scale (обсервер ведёт и 3D); «пролёт» — то же, камера сама облетает;
  // «от первого лица» — глаза игрока, за которым следим (слежка / выбранный / ближайший к центру)
  var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale;
  var a0 = typeof navAt === "function" ? navAt(cx, cy, D3.tz) : null, zt = a0 ? a0.z : (D3.tz == null ? 0 : D3.tz);
  D3.tz = D3.tz == null ? zt : D3.tz + (zt - D3.tz)*0.08;
  // (v593, владелец 24.11: «в повторе другой стиль у стен, каких-то элементов нет — чтобы всё было одинаково») повтор клатча (opt.w) рисовался
  // всегда обзором сверху — срез стен и стекло; теперь вид как в живом показе: живая камера на уровне глаз — в повторе камера за спиной
  // клатчера (вся геометрия, сплошные стены), живой обзор — обзор
  var mode = opt.w ? (D3_EYE_CAMS[D3.liveMode] && opt.focus ? "chase" : "view") : D3.cam;
  if(mode === "auto") mode = d3AutoCam();
  if(!opt.w) D3.liveMode = mode;
  var focusId0 = opt.focus || OBS.lock || OBS.id || plSelected;   // обсервер под 3D: закупка — пролёт, граната следимого — за гранатой, иначе обзор
  D3.mode = mode;
  if(mode === "fly" && !D3.drag){ D3.yawT += 0.0016; D3.pitchT = 0.88 + 0.12*Math.sin(performance.now()/9000); }
  var ease = 0.16; D3.yaw += (D3.yawT - D3.yaw)*ease; var pT = D3.top ? 1.5 : D3.pitchT; D3.pitch += (pT - D3.pitch)*ease;
  var visH = cv.height/view.scale, dist = visH/(2*Math.tan(D3_FOV/2))*0.92, fov = D3_FOV;
  var tgt = [cx, D3.tz*D3_KZ, cy], cp = Math.cos(D3.pitch), sp = Math.sin(D3.pitch);
  var eye = [tgt[0] + Math.sin(D3.yaw)*cp*dist, tgt[1] + sp*dist, tgt[2] + Math.cos(D3.yaw)*cp*dist];
  var fpb = (mode === "fp" || mode === "chase") ? (opt.w ? bots.filter(function(o){ return o.id === opt.focus && o.alive; })[0] || null : d3FpBot()) : null, near = Math.max(1, dist*0.012), far = dist*6;
  if(opt.w && !fpb && mode === "chase"){ mode = "view"; D3.mode = mode; }   // клатчер в повторе погиб — обзор
  D3.fpId = fpb ? fpb.id : null;
  var povB = fpb;   // (v590) чьими глазами смотрим (от первого лица / за спиной) — для ников и подсветки
  if(fpb){
    var al0 = Math.max(0, Math.min(1, accumulator / TICK_MS)), fx = fpb.px + (fpb.x - fpb.px)*al0, fy = fpb.py + (fpb.y - fpb.py)*al0;
    var ff = fpb._visFacing !== undefined ? fpb._visFacing : (fpb.facing || 0);
    D3.fpTgt = ff;   // (замер: во что целится камера — чтобы отличать рывок цели от рывка сглаживания)
    var fAct = fpb.planting || fpb.defusing;   // (v591) ставит / снимает бомбу — присел, смотрит вниз на бомбу
    var eh = (fpb.crouching || fAct ? 46 : 64)*D3_KZ, ez0 = (fpb.z || 0)*D3_KZ + eh;
    // (владелец 14.11: «камера резко прыгает», «взгляд — плавно, как в демках») поворот — взгляд бота из игры (_visFacing, 510); наклон — к голове
    // врага в прицеле, к точке взгляда (v583a, Д9, Д25: пол у точки — ближайший по высоте к полу бота, d3FloorNear), иначе — горизонт по полу
    // впереди; наклон не быстрее про: демки Mirage (motion, 789 тыс. тиков) — p99 1,36° за тик (≈ 87°/с) — D3_FP_PRATE.
    // (v590, владелец 24.11: «боты не прыгали взглядом по высоте; плавно, но резко, как мышкой; только визуально») цели наклона смешиваются по
    // углу до них (было: переключение на границе ± D3_FP_AIM — скачок), пол впереди — среднее трёх точек (ступени не дёргают), сдвиг цели меньше
    // D3_FP_PDEAD не догоняется (рука не дрожит), высота глаз (присел, ступень) — пружиной d3Spring. Замер м3, 40 с: разворотов наклона 44 → 9,
    // скачков высоты глаз 43 → 7
    var coneW = function(x, y){ var da = Math.atan2(y - fy, x - fx) - ff; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      return da <= D3_FP_AIM ? 1 : da >= D3_FP_AIM*1.6 ? 0 : 1 - (da - D3_FP_AIM)/(D3_FP_AIM*0.6); };
    // (v593, владелец 24.11: «боты иногда смотрят вверх, где врагов быть не может») замер м3, 90 с от первого лица: наклон > 7° вверх в 639 из
    // 5400 кадров, из них 431 — точка взгляда, 208 — горизонт. Причина: пол в точке искался «ближайший к высоте бота, иначе навмеш» — без пола
    // рядом по высоте навмеш отдавал верхний этаж (до +286 ед.) и прицел задирался. Теперь пол — только в пределах уклона лестницы от высоты бота
    // (D3_FP_SLOPE × расстояние, не больше D3_FP_DZMAX); нет такого — точка на высоте глаз (горизонтально)
    var bz0 = fpb.z || 0, fsum = 0;
    for(var fk = 1; fk <= 3; fk++){ var fzk = d3FloorAt(fx + Math.cos(ff)*40*fk, fy + Math.sin(ff)*40*fk, bz0, Math.min(D3_FP_DZMAX, 40*fk*2.5*D3_FP_SLOPE)); fsum += fzk === null ? bz0 : fzk; }
    var pD = Math.atan2((fsum/3)*D3_KZ + eh - ez0, 80), lt3 = fpb.lookTarget, WHY = {h: pD, l: null, wl: 0, e: null, ew: 0};
    if(lt3 && Math.hypot(lt3.x - fx, lt3.y - fy) > 40){ var wl = coneW(lt3.x, lt3.y), ld = Math.hypot(lt3.x - fx, lt3.y - fy);
      var lzF = d3FloorAt(lt3.x, lt3.y, bz0, Math.min(D3_FP_DZMAX, ld*2.5*D3_FP_SLOPE)), lzz = lzF === null ? bz0 + (eh/D3_KZ - 62) : lzF;
      if(wl > 0){ WHY.l = Math.atan2((lzz + 62)*D3_KZ - ez0, ld); WHY.wl = wl; WHY.lz = lzz - bz0; WHY.lt = lt3; pD += (WHY.l - pD)*wl; } }
    var en = null, enW = 0; (fpb._visible || []).forEach(function(o){ if(!o.alive || o.team === fpb.team) return; var w = coneW(o.x, o.y); if(w > enW){ enW = w; en = o; } });
    if(en){ WHY.e = Math.atan2(((en.z || 0) + (en.crouching ? 46 : 62))*D3_KZ - ez0, Math.max(8, Math.hypot(en.x - fx, en.y - fy))); WHY.ew = enW; pD += (WHY.e - pD)*enW; }
    D3.fpWhy = WHY;   // (v593) из чего сложился наклон — для разбора «смотрит вверх»
    var nowP = performance.now(), FP = D3.fpP;
    if(!FP || FP.id !== fpb.id || nowP - FP.t > 500) FP = D3.fpP = {id: fpb.id, p: pD, pv: 0, y: ff, yv: 0, t: nowP, pt: pD, ez: {x: ez0, v: 0}};
    var dtP = Math.min(0.1, (nowP - FP.t)/1000); FP.t = nowP;
    if(fAct) pD = -0.95;
    if(Math.abs(pD - FP.pt) > D3_FP_PDEAD || en || fAct) FP.pt = pD;
    d3Spring(FP.ez, ez0, D3_FP_ZW, dtP, 0); var ez = FP.ez.x;
    // (v594, владелец 24.11: «бот смотрит по диагонали, камера постоянно дрожит, даже когда стреляет — не смотрит на врага; бежит — смотрит в
    // другую сторону») замер м3, 25 с от первого лица: камера отставала от взгляда бота в среднем на 6–7° (на развороте — до 140°): поворот шёл
    // через «руку» d3Mouse (v589) поверх взгляда, который в игре уже ведёт рука с инерцией (275, handTurn; кадр — 620); выстрел толкал прицел
    // вверх, урон тряс камеру (v591). Теперь поворот — ровно взгляд бота (как конус в 2D), наклон — пружиной; толчка и тряски у камеры нет
    // (отдача — только у оружия в руках)
    FP.y = ff; FP.yv = 0;
    var PS = {x: FP.p, v: FP.pv}; d3Spring(PS, FP.pt, D3_FP_PW, dtP, D3_FP_PRATE); FP.p = PS.x; FP.pv = PS.v;
    var ffC = ff, pcC = FP.p;
    D3.vm = {kick: d3Kick(fpb.id), flash: d3FlashOn(fpb.id), act: fAct ? (fpb.planting ? "plant" : "defuse") : null, pk: fpb.planting ? Math.max(0, Math.min(1, 1 - ((fpb.plantUntil || tick) - tick)/PLANT_TICKS)) : 1, id: fpb.id};
    tgt = [fx + Math.cos(ffC)*Math.cos(pcC)*100, ez + Math.sin(pcC)*100, fy + Math.sin(ffC)*Math.cos(pcC)*100];
    eye = [fx, ez, fy];
    if(mode === "chase"){   // за спиной: сзади и чуть сверху; стена между игроком и камерой — камера ближе (не уходит в текстуры)
      var M3c = m3(), back = 70, up2 = 18;
      for(var sc = 0; sc < 5 && M3c; sc++){ var exx = fx - Math.cos(ff)*back, eyy = fy - Math.sin(ff)*back;
        if(m3Line(M3c, fx, fy, ez/D3_KZ + 4, exx, eyy, (ez + up2)/D3_KZ, "sight")) break; back *= 0.6; up2 *= 0.6; }
      eye = [fx - Math.cos(ff)*back, ez + up2, fy - Math.sin(ff)*back]; if(!en) tgt = [fx + Math.cos(ff)*90, ez - 6, fy + Math.sin(ff)*90]; fov = 62*Math.PI/180;
    } else {
      fov = (D3.fpFov || 74)*Math.PI/180;
      if(D3.cam === "fp" && (D3.fpYaw || D3.fpPitch)){   // свободный взгляд (ПКМ): поворот и наклон относительно взгляда игрока
        var dx0 = tgt[0] - eye[0], dy0 = tgt[1] - eye[1], dz0 = tgt[2] - eye[2], hl = Math.hypot(dx0, dz0) || 1, ya = Math.atan2(dz0, dx0) + D3.fpYaw, pa = Math.atan2(dy0, hl) + D3.fpPitch;
        pa = Math.max(-1.45, Math.min(1.45, pa)); tgt = [eye[0] + Math.cos(ya)*Math.cos(pa)*100, eye[1] + Math.sin(pa)*100, eye[2] + Math.sin(ya)*Math.cos(pa)*100]; }
    }
    near = 1.2; far = 2400; dist = 380;
    if(mode === "chase") fpb = null;   // себя в «за спиной» видно
    D3.fpId = fpb ? fpb.id : null;
  }
  if(mode === "spawn"){ var SC = d3SpawnCam(); if(SC){ eye = SC.eye; tgt = SC.tgt; fov = 60*Math.PI/180; near = 1.2; far = 3000; dist = 300; } }
  if(mode === "flythru"){ var FC = d3FlyThru(); if(FC){ eye = FC.eye; tgt = FC.tgt; fov = 70*Math.PI/180; near = 1.2; far = 3000; dist = 420; } }
  if(mode === "nade"){ var NC = d3NadeCam(); if(NC){ eye = NC.eye; tgt = NC.tgt; fov = 60*Math.PI/180; near = 1; far = 3000; dist = 260; } }
  // (владелец 13.11: «сразу переключается на убийство, непонятно за кем смотришь», «камера за гранатой дёргается») камера не прыгает:
  // глаз, цель и угол обзора плавно догоняют нужные (обзор с мышью — без задержки)
  if(!opt.w){ var CS = D3.cs, k3 = (mode === "view" && D3.cam === "view") ? 1 : (mode === "nade" ? 0.06 : mode === "flythru" ? 0.15 : mode === "spawn" ? 0.05 : mode === "fp" ? 1 : 0.08);   // (14.11) от первого лица — взгляд бота как есть (плавность — у прицела, выше)
    if(!CS || CS.mode !== mode && k3 === 1){ CS = D3.cs = {eye: eye.slice(), tgt: tgt.slice(), fov: fov, mode: mode}; }
    else {
      // (v593, владелец 24.11: «вид на гранату переключается уже после того, как она перелетела — плавно с того, кто кидает») за гранатой
      // камера догоняла 6 % пути за кадр (≈ 0,8 с до места — почти весь полёт); теперь по времени: место — D3_NADE_EYE /с, взгляд —
      // D3_NADE_TGT /с; старт — от глаз бросающего (прошлая камера), перелёт к гранате ≈ 0,25 с
      var kE = k3, kT = k3, nowC = performance.now(), dtC = Math.min(0.1, Math.max(0, (nowC - (D3.csT || nowC))/1000));
      if(mode === "nade"){ kE = 1 - Math.exp(-D3_NADE_EYE*dtC); kT = 1 - Math.exp(-D3_NADE_TGT*dtC); }
      for(var ci = 0; ci < 3; ci++){ CS.eye[ci] += (eye[ci] - CS.eye[ci])*kE; CS.tgt[ci] += (tgt[ci] - CS.tgt[ci])*kT; } CS.fov += (fov - CS.fov)*kE; CS.mode = mode; }
    D3.csT = performance.now();
    eye = CS.eye.slice(); tgt = CS.tgt.slice(); fov = CS.fov; }
  D3.tgt = tgt;
  var V = d3Look(eye, tgt);   // наклон не больше 1,5 рад — «сверху» без вырождения, поворот сохраняется
  var Pm = d3Persp(fov, Wc/Hc, near, far), VP = d3Mul(Pm, V);
  D3.VP = VP; D3.W = cw; D3.H = ch; D3.eye = eye; D3.dist = dist; D3.noTags = !!opt.noTags;
  if(!opt.w){ var xc = D3.crossEl || (D3.crossEl = document.getElementById("v3Cross")); if(xc){ var on3 = mode === "fp" && !!D3.fpId; if(xc.hidden === on3) xc.hidden = !on3; } }   // прицел — от первого лица
  var fog = [dist*1.9, dist*4.6], L = [0.45, 0.78, 0.43], ll = Math.hypot(L[0], L[1], L[2]); L = [L[0]/ll, L[1]/ll, L[2]/ll];
  gl.viewport(0, 0, Wc, Hc); gl.clearColor(D3.cBg[0], D3.cBg[1], D3.cBg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  var pM = D3.pM; gl.useProgram(pM.p);
  gl.uniformMatrix4fv(pM.u.uVP, false, VP); gl.uniform3fv(pM.u.uEye, eye); gl.uniform3fv(pM.u.uL, L); gl.uniform3fv(pM.u.uBg, D3.cBg.slice(0, 3)); gl.uniform2fv(pM.u.uFog, fog);
  var I = d3Model(0, 0, 0, 1, 1, 1);
  var draw = function(m, M4, tint, lit, soft){ gl.uniform1f(pM.u.uSoft, soft || 0); if(pM.u.uHn) gl.uniform1i(pM.u.uHn, 0); gl.uniformMatrix4fv(pM.u.uM, false, M4 || I); gl.uniform4fv(pM.u.uTint, tint || [1, 1, 1, 1]); gl.uniform1f(pM.u.uLit, lit == null ? 1 : lit);
    d3Attr(gl, pM.aP, m.p, 3); d3Attr(gl, pM.aN, m.n, 3); d3Attr(gl, pM.aC, m.c, 4); gl.drawArrays(gl.TRIANGLES, 0, m.cnt); };
  // (v593) подложка-«стол» под картой — у камер сверху, с сеткой. (v597, владелец 25.11: «найти все дырки, ничего не должно просвечивать»)
  // у камер на уровне глаз — пол без сетки на высоте пола под камерой: виден только там, где ничего не нарисовано (рисуется первым, глубину не
  // пишет) — проёмы на край карты (за ними в геометрии карты пусто) и щели пола ниже горизонта были чёрным фоном (поиск дыр, Mirage т. 1429,1633)
  if(D3.plate){
    var pG = D3.pG, PL = D3.plate, eyeC = !!D3_EYE_CAMS[D3.mode], plY = eyeC ? d3FloorBelow(eye[0], eye[2], eye[1]/D3_KZ)*D3_KZ - 1.6 : PL.y; gl.useProgram(pG.p); gl.depthMask(false);
    gl.uniformMatrix4fv(pG.u.uVP, false, VP); gl.uniform1f(pG.u.uY, plY); gl.uniform1f(pG.u.uGr, eyeC ? 0 : 1); gl.uniform3fv(pG.u.uBg, D3.cBg.slice(0, 3)); gl.uniform3fv(pG.u.uC, (eyeC ? D3.cFloor : PL.c).slice(0, 3));
    gl.uniform4fv(pG.u.uB, PL.bounds); gl.uniform2fv(pG.u.uFog, fog); gl.uniform3fv(pG.u.uEye, eye);
    d3Attr(gl, pG.aP, PL.b, 2); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthMask(true); gl.useProgram(pM.p); }
  draw(D3.floor, I, null, 0.12);
  // (v597, владелец 25.11: «найти все дырки, ничего не должно просвечивать») бортик навмеша (тёмная полоса 35 ед. вниз по краю участка) — для
  // камер сверху (ступени и этажи); на уровне глаз пол навмеша на 4 ед. ниже пола геометрии, и бортик между ними торчал тёмными «трещинами»
  // по всей улице (снимки м3 т. 1500 / 3000) — не рисуется
  if(!D3_EYE_CAMS[D3.mode]) draw(D3.floorSk, I, null, 0.12);
  if(D3.world && D3.world.gcnt){   // пол и ступени из геометрии — непрозрачно, со срезом, поверх навмеша
    var pW0 = D3.pW, W0 = D3.world; gl.useProgram(pW0.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, W0.ftex.tex);
    gl.uniformMatrix4fv(pW0.u.uVP, false, VP); gl.uniform3fv(pW0.u.uEye, eye); gl.uniform3fv(pW0.u.uL, L); gl.uniform3fv(pW0.u.uBg, D3.cBg.slice(0, 3));
    gl.uniform2fv(pW0.u.uFog, fog); gl.uniform1i(pW0.u.uF, 0); gl.uniform1f(pW0.u.uCut, 1e4); gl.uniform1f(pW0.u.uSims, 0); gl.uniform1f(pW0.u.uFb, 0); gl.uniform1f(pW0.u.uA, 1);
    gl.uniform3fv(pW0.u.uGround, D3.cFloor.slice(0, 3)); gl.uniform2fv(pW0.u.uZr, D3.zr);
    d3Attr(gl, pW0.aP, W0.g, 3); d3Attr(gl, pW0.aK, W0.gk, 1); gl.drawArrays(gl.TRIANGLES, 0, D3_EYE_CAMS[D3.mode] ? W0.gcntAll : W0.gcnt); if(pW0.aK >= 0) gl.disableVertexAttribArray(pW0.aK);
    gl.useProgram(pM.p);
  }
  // мир со срезом и его рёбра — вид по D3_STYLES (кнопка в колонке): непрозрачный — сразу, прозрачный — последним (видно игроков за стенами)
  // (v591, владелец 24.11, фото 3: «нет стенки выше, пол видно сквозь стены») камеры на уровне глаз (от первого лица, за спиной, пролёт, за
  // гранатой, спавн) — как от первого лица: вся геометрия без среза, стены сплошные; срез и стекло — только у камер сверху (обзор, облёт)
  var Wd = D3.world, pW = D3.pW, inFp = D3_EYE_CAMS[D3.mode] === 1, cut = (inFp ? 1e5 : D3_CUT)*D3_KZ, low = D3_LOW*D3_KZ, sims = D3.sims && !inFp ? 1 : 0, STY = inFp ? D3_STYLES[2] : (D3_STYLES[D3.style] || D3_STYLES[0]);   // от первого лица — стены сплошные
  var wCnt = inFp ? Wd.cntAll : Wd.cnt, wEcnt = inFp ? Wd.ecntAll : Wd.ecnt;   // (v590) от первого лица — и верх зданий, и фасады у края
  var drawWorld = function(){
    if(!wCnt) return;
    gl.useProgram(pW.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Wd.ftex.tex);
    gl.uniformMatrix4fv(pW.u.uVP, false, VP); gl.uniform3fv(pW.u.uEye, eye); gl.uniform3fv(pW.u.uL, L); gl.uniform3fv(pW.u.uBg, D3.cBg.slice(0, 3));
    gl.uniform2fv(pW.u.uFog, fog); gl.uniform1i(pW.u.uF, 0); gl.uniform1f(pW.u.uCut, cut); gl.uniform1f(pW.u.uLow, low); gl.uniform1f(pW.u.uSims, sims); gl.uniform1f(pW.u.uFb, 1); gl.uniform3fv(pW.u.uTgt, tgt); gl.uniform1f(pW.u.uRf, dist*0.55); gl.uniform1f(pW.u.uA, STY.a); gl.uniform3fv(pW.u.uGround, D3.cFloor.slice(0, 3)); gl.uniform2fv(pW.u.uZr, D3.zr);
    var kf = inFp ? 0.5 : 1;   // от первого лица стены сплошные — темнее, не слепят
    gl.uniform3fv(pW.u.uProp, D3.cProp.slice(0, 3).map(function(v){ return v*kf; })); gl.uniform3fv(pW.u.uRock, D3.cRock.slice(0, 3).map(function(v){ return v*kf; })); gl.uniform3fv(pW.u.uCap, D3.cCap.slice(0, 3).map(function(v){ return v*kf; }));
    d3Attr(gl, pW.aP, Wd.p, 3); d3Attr(gl, pW.aK, Wd.k, 1);
    // (владелец 13.11: «сквозь стены видно чужие линии — грязно») прозрачный вид без «рентгена»: сначала стены только в глубину —
    // грани и рёбра за ними не рисуются; с «рентгеном» (кнопка) — видно всё насквозь, как раньше
    // скрыть невидимое — только вблизи: вид на всю карту (облёт на закупке) иначе рисует её дважды — лаги на слабой видеокарте
    if(STY.a < 1 && !D3.xray && dist < 900){ gl.colorMask(false, false, false, false); gl.drawArrays(gl.TRIANGLES, 0, wCnt); gl.colorMask(true, true, true, true); gl.depthFunc(gl.LEQUAL); }
    if(STY.a < 1) gl.depthMask(false);   // изнанку выпуклых блоков не рисуем (шейдер, v591) — внутренности ящиков и возвышений не видны (владелец, фото 1)
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 2);   // (v591) предмет на одной высоте с полом — пол поверх, без мерцания
    gl.drawArrays(gl.TRIANGLES, 0, wCnt); gl.disable(gl.POLYGON_OFFSET_FILL); if(pW.aK >= 0) gl.disableVertexAttribArray(pW.aK);
    var pE = D3.pE; gl.useProgram(pE.p); gl.uniformMatrix4fv(pE.u.uVP, false, VP); gl.uniform3fv(pE.u.uEye, eye); gl.uniform2fv(pE.u.uFog, fog);
    gl.uniform1i(pE.u.uF, 0); gl.uniform1f(pE.u.uCut, cut); gl.uniform1f(pE.u.uLow, low); gl.uniform1f(pE.u.uSims, sims); gl.uniform1f(pE.u.uFb, 1); gl.uniform3fv(pE.u.uTgt, tgt); gl.uniform1f(pE.u.uRf, dist*0.55); gl.uniform4fv(pE.u.uC, [D3.cEdge[0], D3.cEdge[1], D3.cEdge[2], STY.ea]);
    d3Attr(gl, pE.aP, Wd.e, 3); gl.drawArrays(gl.LINES, 0, wEcnt);
    gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.depthFunc(gl.LESS);
  };
  if(STY.a >= 1) drawWorld();
  var pL = D3.pL;
  // ---------- живое ----------
  gl.useProgram(pM.p);
  var al = Math.max(0, Math.min(1, accumulator / TICK_MS)), sz = Math.max(1.15, Math.min(2.6, dist/650)), LN = [];
  var line = function(a, b, ca, cb){ LN.push(a[0], a[1], a[2], ca[0], ca[1], ca[2], ca[3], b[0], b[1], b[2], cb[0], cb[1], cb[2], cb[3]); };
  // огонь — пятно на полу и языки пламени (мерцают, у каждого огня своя раскладка)
  fires.forEach(function(fr){ var R = fireRadiusNow(fr), z = d3FloorBelow(fr.x, fr.y, null)*D3_KZ, fade = Math.min(1, (fr.until - tick)/40), fl = 0.85 + 0.15*Math.sin(tick*0.35);
    gl.depthMask(false); draw(D3.disc, d3Model(fr.x, z + 0.6, fr.y, R, 1, R), [0.9, 0.32*fl, 0.1, 0.35*fade], 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); var seed = fr.born*0.53 + fr.x*0.011;
    for(var e = 0; e < 14; e++){ var ea = d3R(seed + e*2.3)*Math.PI*2, ed = R*(0.1 + 0.8*d3R(seed + e*4.1)), fk = 0.5 + 0.5*Math.sin(tick*0.4 + e*1.9), fh = (5 + 7*d3R(seed + e*7.7))*(0.7 + 0.5*fk);
      draw(D3.sphere, d3Model(fr.x + Math.cos(ea)*ed, z + fh*0.6, fr.y + Math.sin(ea)*ed, 2.2, fh, 2.2), [1, 0.55 + 0.3*fk, 0.2, 0.32*fade], 0, 1); }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true); });
  // бомба: корпус, табло, мигающий огонёк; заложена — пульс по полу; взорвалась — вспышка и волна (3 с)
  var cb = D3.cBomb || (D3.cBomb = d3Hex(d3Tok("--bomb", "#ff5a4c")));
  if(bomb && (bomb.state === "dropped" || bomb.state === "planted" || bomb.state === "defused")){
    var bz = d3FloorBelow(bomb.x, bomb.y, bomb.z)*D3_KZ, pu = bomb.state === "planted" ? 0.5 + 0.5*Math.sin(tick*0.25) : 1, bs = Math.max(1, sz*0.8);
    draw(D3.box, d3Model(bomb.x, bz, bomb.y, 3.4*bs, 1.7*bs, 2.3*bs), [0.2, 0.23, 0.18, 1], 0.9);
    draw(D3.box, d3Model(bomb.x - 0.9*bs, bz + 1.7*bs, bomb.y, 1.2*bs, 0.25*bs, 1.3*bs), [0.08, 0.1, 0.07, 1], 0.4);
    var lc = bomb.state === "defused" ? D3.cCT : cb;
    draw(D3.sphere, d3Model(bomb.x + 1.6*bs, bz + 2.0*bs, bomb.y, 0.55*bs, 0.55*bs, 0.55*bs), [lc[0], lc[1], lc[2], 0.55 + 0.45*pu], 0);
    if(bomb.state === "planted"){ gl.depthMask(false); var pr = (8 + 14*(1 - pu))*sz; draw(D3.ring, d3Model(bomb.x, bz + 0.5, bomb.y, pr, 1, pr), [cb[0], cb[1], cb[2], 0.5*pu], 0); gl.depthMask(true); }
  }
  if(bomb && bomb.state === "exploded" && bomb.explodeTick > 0 && tick - bomb.explodeTick < 3*TICK_HZ){
    var ea = (tick - bomb.explodeTick)/(3*TICK_HZ), ez2 = d3FloorBelow(bomb.x, bomb.y, bomb.z)*D3_KZ, er = 20 + 260*Math.sqrt(ea);
    gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    draw(D3.sphere, d3Model(bomb.x, ez2 + er*0.35, bomb.y, er*0.55, er*0.45, er*0.55), [1, 0.62, 0.3, 0.55*(1 - ea)], 0, 1);
    draw(D3.ring, d3Model(bomb.x, ez2 + 1, bomb.y, er, 1, er), [1, 0.75, 0.45, 0.7*(1 - ea)], 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true);
  }
  // игроки — фигура: тень на полу под ногами (в прыжке — ниже ног, с отвесом), кольцо стороны, корпус, голова, оружие по взгляду
  var seen = {}, focusId = focusId0;
  // (v590, владелец 24.11: «не должно ничего просвечивать, чужие ники; смотрю за КТшником — видны ники КТшников в пределах видимости,
  // не супер далеко; у врагов — ник у ближайших и подсветка силуэта») за кем смотрим (глаза / слежка): свои — ник ближе D3_TAG_TEAM
  // (дальше — тает), враги — только те, кого он сам видит (_visible, игра: дым, стены, 3D), ник — у D3_TAG_ENEMY ближайших, силуэт подсвечен
  var pov = povB || (focusId0 ? bots.filter(function(o){ return o.id === focusId0 && o.alive; })[0] : null), TAG = null, GLOW = {};
  if(pov){ TAG = {}; TAG[pov.id] = 1;
    bots.forEach(function(o){ if(!o.alive || o === pov || o.team !== pov.team) return; var d = Math.hypot(o.x - pov.x, o.y - pov.y); if(d < D3_TAG_TEAM) TAG[o.id] = Math.min(1, (D3_TAG_TEAM - d)/(D3_TAG_TEAM*0.25)); });
    (pov._visible || []).filter(function(o){ return o.alive && o.team !== pov.team; }).sort(function(a, c){ return Math.hypot(a.x - pov.x, a.y - pov.y) - Math.hypot(c.x - pov.x, c.y - pov.y); })
      .forEach(function(o, k){ GLOW[o.id] = 1; if(k < D3_TAG_ENEMY) TAG[o.id] = 1; });
    // (v591, владелец 24.11: «ближайшие игроки, даже вражеские, должны сквозь стенки подсвечиваться — моделька, силуэт, обводка и ник»)
    // свои рядом (с ником) и D3_TAG_ENEMY ближайших врагов ближе D3_XR_R — силуэт сквозь стены (рентген обсервера, как на трансляции CS2)
    bots.filter(function(o){ return o.alive && o.team !== pov.team && Math.hypot(o.x - pov.x, o.y - pov.y) < D3_XR_R; })
      .sort(function(a, c){ return Math.hypot(a.x - pov.x, a.y - pov.y) - Math.hypot(c.x - pov.x, c.y - pov.y); })
      .slice(0, D3_TAG_ENEMY).forEach(function(o){ GLOW[o.id] = 1; TAG[o.id] = 1; });
    for(var tg in TAG) if(tg !== pov.id) GLOW[tg] = 1; }
  var XR = [];   // силуэты сквозь стены — рисуются последними (после стен), только там, где фигура закрыта
  bots.forEach(function(b){
    var x = b.px + (b.x - b.px)*al, y = b.py + (b.y - b.py)*al, z = (b.z != null ? b.z : d3FloorNear(x, y, null))*D3_KZ, col = b.team === "CT" ? D3.cCT : D3.cT;
    var CL = b._climb, air = CL && CL.jump ? 4*(CL.air || 0)*(1 - (CL.air || 0)) : 0; z += air*18;
    d3Hist(b, x, y, z); if(b.alive && D3.corpse[b.id]) delete D3.corpse[b.id];
    if(!b.alive){ d3Corpse(b, draw, col, sz); return; }   // павший — тело падает и катится (d3Corpse)
    if(b.id === D3.fpId) return;   // от первого лица — себя не видно
    var act = b.planting ? "plant" : b.defusing ? "defuse" : null;   // (v591) ставит / снимает бомбу — присел, голова вниз к бомбе
    var h = (b.crouching || act ? 20 : 27)*sz;
    var blind = tick < b.blindUntil ? Math.min(1, (b.blindUntil - tick)/64*0.5)*0.75 : 0;
    var tc = [col[0] + (1 - col[0])*blind, col[1] + (1 - col[1])*blind, col[2] + (1 - col[2])*blind, 1];
    var hi = [tc[0] + (1 - tc[0])*0.45, tc[1] + (1 - tc[1])*0.45, tc[2] + (1 - tc[2])*0.45, 1];
    var fz = d3FloorBelow(x, y, z/D3_KZ + 2)*D3_KZ, lift = z - fz;
    gl.depthMask(false);
    draw(D3.disc, d3Model(x, fz + 0.3, y, 6.5*sz*(lift > 3 ? 0.8 : 1), 1, 6.5*sz*(lift > 3 ? 0.8 : 1)), [0, 0, 0, lift > 3 ? 0.3 : 0.45], 0);
    var rc = b.id === focusId ? [1, 1, 1, 0.95] : [tc[0], tc[1], tc[2], 0.75];
    draw(D3.ring, d3Model(x, fz + 0.45, y, 7.6*sz, 1, 7.6*sz), rc, 0);
    gl.depthMask(true);
    if(lift > 3){ var wl = [1, 1, 1, 0.55]; line([x, fz + 0.5, y], [x, z, y], wl, wl); }   // в воздухе — отвес до пола (видно прыжок / спрыгнул)
    if(GLOW[b.id]) XR.push([x, z, y, h, col]);
    if(GLOW[b.id]){   // подсветка силуэта: обводка — изнанка чуть большей фигуры (видна только по краю, за стеной — нет: глубина)
      var gc = [Math.min(1, col[0]*0.5 + 0.6), Math.min(1, col[1]*0.5 + 0.5), Math.min(1, col[2]*0.5 + 0.45), 0.95], ow = Math.max(D3_GLOW_W, Math.hypot(x - D3.eye[0], z - D3.eye[1], y - D3.eye[2])*0.004);   // толщина на экране — почти одна вдали и вблизи
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
      draw(D3.capsule, d3Model(x, z + 0.3 - ow*0.5, y, h*0.6 + ow, h*0.8 + ow, h*0.6 + ow), gc, 0);
      draw(D3.sphere, d3Model(x, z + h*0.9, y, h*0.13 + ow, h*0.13 + ow, h*0.13 + ow), gc, 0);
      gl.disable(gl.CULL_FACE); }
    draw(D3.capsule, d3Model(x, z + 0.3, y, h*0.6, h*0.8, h*0.6), tc, 1);
    var vf0 = b._visFacing !== undefined ? b._visFacing : (b.facing || 0), hdF = act ? h*0.16 : 0;   // голова наклонена вперёд, к бомбе
    draw(D3.sphere, d3Model(x + Math.cos(vf0)*hdF, z + h*(act ? 0.84 : 0.9), y + Math.sin(vf0)*hdF, h*0.13, h*0.13, h*0.13), hi, 1);
    var vf = b._visFacing !== undefined ? b._visFacing : b.facing;
    if(vf !== undefined){
      var ca = Math.cos(vf), sa = Math.sin(vf);
      if(act){   // бомба / кусачки в руках у пола: плант — опускается к полу по ходу установки, огонёк мигает
        var pk = act === "plant" ? Math.max(0, Math.min(1, 1 - ((b.plantUntil || tick) - tick)/PLANT_TICKS)) : 1, hb = fz + (1 - pk)*h*0.3 + 0.5, px2 = x + ca*h*0.38, py2 = y + sa*h*0.38;
        if(act === "plant"){ draw(D3.box, d3Rot(px2, hb, py2, vf, 3.4*sz*0.55, 1.7*sz*0.55, 2.3*sz*0.55), [0.2, 0.23, 0.18, 1], 0.9);
          draw(D3.sphere, d3Model(px2, hb + 1.2*sz, py2, 0.4*sz, 0.4*sz, 0.4*sz), [1, 0.3, 0.25, (tick >> 3) & 1 ? 1 : 0.3], 0); }
        else draw(D3.box, d3Rot(px2, z + h*0.3, py2, vf, h*0.08, h*0.05, h*0.06), [0.75, 0.2, 0.15, 1], 0.6);
      } else d3Gun(draw, x, z, y, vf, h, d3Kick(b.id), d3FlashOn(b.id));   // оружие: отдача и вспышка у дула
      var r0 = 8.2*sz, len = 5*sz;
      var Mc = new Float32Array([ca*len, 0, sa*len, 0, 0, 1, 0, 0, -sa*len*0.9, 0, ca*len*0.9, 0, x + ca*r0, fz + 0.7, y + sa*r0, 1]);
      draw(D3.cone, Mc, [rc[0], rc[1], rc[2], 0.9], 0);
    }
    if(!TAG || TAG[b.id]){ seen[b.id] = 1; if(!D3.noTags) d3Tag(b, x, z + h + 4*sz, y, col, TAG ? TAG[b.id] : 1); }
  });
  // (Д8) путь игрока, за которым следим, за 4 с — в 3D, с отвесами до пола: видно прыжки, спуски и «притягивание» к полу
  var fb = focusId && bots.filter(function(o){ return o.id === focusId; })[0], Hh = fb && D3.hist[fb.id];
  if(Hh && Hh.length > 1){ var hc = fb.team === "CT" ? D3.cCT : D3.cT;
    for(var hi2 = 1; hi2 < Hh.length; hi2++){ var q0 = Hh[hi2-1], q1 = Hh[hi2], ha = 0.15 + 0.75*hi2/Hh.length;
      line([q0[0], q0[2] + 1, q0[1]], [q1[0], q1[2] + 1, q1[1]], [hc[0], hc[1], hc[2], ha], [hc[0], hc[1], hc[2], ha]);
      if(hi2 % 8 === 0){ var qf = d3FloorBelow(q1[0], q1[1], q1[2]/D3_KZ + 2)*D3_KZ; if(q1[2] - qf > 2) line([q1[0], qf, q1[1]], [q1[0], q1[2], q1[1]], [1, 1, 1, 0.25*ha], [1, 1, 1, 0.4*ha]); } } }
  for(var id in D3.tagEls) if(!seen[id] || D3.noTags) D3.tagEls[id].style.display = "none";
  // дым — облако из нескольких шаров
  var lastN = D3.nadeZ;
  nadesInAir.forEach(function(n){ if(n.z != null) lastN.push({x: n.x, y: n.y, z: n.z, t: tick}); }); while(lastN.length > 60) lastN.shift();
  var drawSmokes = function(){ gl.useProgram(pM.p); gl.depthMask(false);
  smokes.forEach(function(sm){
    var rr = smokeRadiusNow(sm); if(rr < 2) return;
    var z0 = D3.smZ.get(sm); if(z0 === undefined){ var bz2 = null, bd = 40; lastN.forEach(function(q){ var d = Math.hypot(q.x - sm.x, q.y - sm.y); if(d < bd){ bd = d; bz2 = q.z; } }); z0 = d3FloorNear(sm.x, sm.y, bz2); D3.smZ.set(sm, z0); }
    var fade = Math.min(1, (sm.until - tick)/64), zz = z0*D3_KZ, seed = sm.born*0.37 + sm.x*0.013;
    // (владелец 13.11: «обсервер учитывал смоки и бои в них») камера смотрит в дым (бой в смоке) — облако редеет, видно игроков
    if(D3.mode !== "fp" && D3.tgt){ var dt3 = Math.hypot(D3.tgt[0] - sm.x, D3.tgt[2] - sm.y); fade *= Math.max(0.3, Math.min(1, (dt3 - rr*0.5)/(rr*0.9))); }
    // (владелец 13.11: «смок — полноценный, плотнее») ядро почти непрозрачное, вокруг клубы в два яруса; края мягкие
    var HL = (sm.bholes || []).filter(function(q){ return q.until > tick; }).slice(-8), HA = [], HB = [];
    HL.forEach(function(q){ HA.push(q.x1, (q.z1 || z0 + 60)*D3_KZ, q.y1); HB.push(q.x2, (q.z2 || z0 + 60)*D3_KZ, q.y2); });
    var hdraw = draw;
    if(HL.length){ while(HA.length < 24){ HA.push(0); HB.push(0); }
      hdraw = function(m, M4, tint, lit, soft){ gl.uniform1f(pM.u.uSoft, soft || 0); gl.uniform1i(pM.u.uHn, HL.length); gl.uniform1f(pM.u.uHr, 7);
        gl.uniform3fv(pM.u.uHa, new Float32Array(HA)); gl.uniform3fv(pM.u.uHb, new Float32Array(HB));
        gl.uniformMatrix4fv(pM.u.uM, false, M4); gl.uniform4fv(pM.u.uTint, tint); gl.uniform1f(pM.u.uLit, lit);
        d3Attr(gl, pM.aP, m.p, 3); d3Attr(gl, pM.aN, m.n, 3); d3Attr(gl, pM.aC, m.c, 4); gl.drawArrays(gl.TRIANGLES, 0, m.cnt); }; }
    hdraw(D3.sphere, d3Model(sm.x, zz + rr*0.48, sm.y, rr*0.92, rr*0.62, rr*0.92), [0.8, 0.82, 0.78, 0.94*fade], 0.5, 0.2);
    for(var q = 0; q < 12; q++){ var up = q >= 7, qa = d3R(seed + q*1.7)*Math.PI*2 + (tick - sm.born)*0.0016*(q % 2 ? 1 : -1), qd = rr*(up ? 0.3 : 0.55), qr = rr*(up ? 0.5 : 0.48);
      hdraw(D3.sphere, d3Model(sm.x + Math.cos(qa)*qd, zz + rr*(up ? 0.85 : 0.38) + rr*0.1*d3R(seed + q), sm.y + Math.sin(qa)*qd, qr, qr*0.8, qr), [0.88, 0.9, 0.86, 0.5*fade], 0.55, 0.8); }
  });
  gl.depthMask(true); };
  if(STY.a >= 1) drawSmokes();   // прозрачные стены — дым после них (стены не рисуются поверх облака)
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
  var TRC = [];
  if(typeof showTracers === "undefined" || showTracers.checked) tracers.forEach(function(t){
    var age = nowTs - t.born; if(age > 260) return;
    var zz = D3.trZ.get(t);
    if(!zz){ var near = function(x, y){ var best = null, bd = 18; bots.forEach(function(o){ var d = Math.hypot(o.x - x, o.y - y); if(d < bd && o.z != null){ bd = d; best = o.z; } }); return best; };
      var z1 = near(t.x1, t.y1), z2 = near(t.x2, t.y2), hitB = z2 != null; if(z1 == null) z1 = d3FloorNear(t.x1, t.y1, null);
      if(z2 == null){   // у конца никого — игрок у линии выстрела (в 30 px), иначе высота стрелка
        var lx = t.x2 - t.x1, ly = t.y2 - t.y1, l2 = lx*lx + ly*ly || 1;
        bots.forEach(function(o){ if(!o.alive || o.z == null || z2 != null) return; var u = ((o.x - t.x1)*lx + (o.y - t.y1)*ly)/l2; if(u < 0.05 || u > 1.05) return;
          if(Math.hypot(t.x1 + lx*u - o.x, t.y1 + ly*u - o.y) < 30){ z2 = o.z; hitB = true; } }); }
      if(z2 == null) z2 = z1; zz = [z1, z2, hitB]; D3.trZ.set(t, zz); }
    var k = 1 - age/260, tc2 = t.team === "CT" ? [0.56, 0.75, 0.94] : [0.96, 0.75, 0.38];
    // (владелец 14.11: «трассеры не совпадают со взглядом по высоте — уходят в стену») от высоты оружия у глаз стрелка (D3_TR_SHOT ед.) — к груди
    // того, в кого шла пуля (zz[2]: игрок у конца или у линии выстрела); никого — на той же высоте. Было: 42 / 36 ед. над полом — ниже прицела
    var A3 = [t.x1, (zz[0] + D3_TR_SHOT)*D3_KZ, t.y1], B3 = [t.x2, (zz[1] + (zz[2] ? D3_TR_HIT : D3_TR_SHOT))*D3_KZ, t.y2];
    TRC.push([A3, B3, [tc2[0], tc2[1], tc2[2], 0.9*k], t.hit]);
  });
  // (владелец 13.11: «нет трассеров») луч — вытянутый брусок, светится (линия WebGL в 1 px не видна)
  if(TRC.length){ gl.useProgram(pM.p); gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    TRC.forEach(function(q){ var A3 = q[0], B3 = q[1], dx = B3[0]-A3[0], dy = B3[1]-A3[1], dz = B3[2]-A3[2], L3 = Math.hypot(dx, dy, dz) || 1;
      var ux = dx/L3, uy = dy/L3, uz = dz/L3, sxv = [-uz, 0, ux], sl = Math.hypot(sxv[0], sxv[2]) || 1; sxv = [sxv[0]/sl, 0, sxv[2]/sl];
      var up3 = [uy*sxv[2] - uz*sxv[1], uz*sxv[0] - ux*sxv[2], ux*sxv[1] - uy*sxv[0]], w3 = 0.45;
      var Mt = new Float32Array([ux*L3/2, uy*L3/2, uz*L3/2, 0, up3[0]*w3, up3[1]*w3, up3[2]*w3, 0, sxv[0]*w3, sxv[1]*w3, sxv[2]*w3, 0, A3[0], A3[1] - w3*0.5*up3[1], A3[2], 1]);
      draw(D3.box, new Float32Array([Mt[0], Mt[1], Mt[2], 0, Mt[4], Mt[5], Mt[6], 0, Mt[8], Mt[9], Mt[10], 0, A3[0] + dx/2, A3[1] + dy/2 - w3*0.5, A3[2] + dz/2, 1]), q[2], 0);
      if(q[3]) draw(D3.sphere, d3Model(B3[0], B3[1], B3[2], 1.6, 1.6, 1.6), [1, 0.35, 0.3, q[2][3]], 0); });
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true); }
  // (Д5) срабатывание гранат: HE — огненный шар и волна до радиуса, флешка — вспышка и кольцо
  gl.useProgram(pM.p); gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  nadeFx.forEach(function(fx){
    var age = tick - fx.born, fz = d3FloorBelow(fx.x, fx.y, fx.z)*D3_KZ;
    if(fx.type === "he" && age < 40){ var k = Math.min(1, age/20), e3 = 1 - (1-k)*(1-k)*(1-k), a2 = 1 - age/40, Rh = (NADE.he.radius || 120)*e3;
      draw(D3.sphere, d3Model(fx.x, fz + 10, fx.y, 6 + 26*e3, 5 + 20*e3, 6 + 26*e3), [1, 0.55, 0.22, 0.75*a2], 0, 1);
      draw(D3.ring, d3Model(fx.x, fz + 0.8, fx.y, Rh, 1, Rh), [1, 0.6, 0.3, 0.8*a2], 0); }
    else if(fx.type === "flash" && age < 26){ var c2 = Math.max(0, 1 - age/10), k2 = age/26;
      if(c2 > 0) draw(D3.sphere, d3Model(fx.x, fz + 22, fx.y, 6 + 18*(1 - c2), 6 + 18*(1 - c2), 6 + 18*(1 - c2)), [1, 1, 0.96, 0.9*c2], 0, 1);
      draw(D3.ring, d3Model(fx.x, fz + 1, fx.y, 10 + 90*(1 - (1-k2)*(1-k2)), 1, 10 + 90*(1 - (1-k2)*(1-k2))), [1, 1, 0.95, 0.6*(1 - k2)], 0); }
  });
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true);
  if(LN.length){
    gl.useProgram(pL.p); var LA = new Float32Array(LN), np = LA.length/7, Pp = new Float32Array(np*3), Pc = new Float32Array(np*4);
    for(var li = 0; li < np; li++){ Pp[li*3] = LA[li*7]; Pp[li*3+1] = LA[li*7+1]; Pp[li*3+2] = LA[li*7+2]; for(var cc = 0; cc < 4; cc++) Pc[li*4+cc] = LA[li*7+3+cc]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, D3.lines.p); gl.bufferData(gl.ARRAY_BUFFER, Pp, gl.DYNAMIC_DRAW); d3Attr(gl, pL.aP, D3.lines.p, 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, D3.lines.c); gl.bufferData(gl.ARRAY_BUFFER, Pc, gl.DYNAMIC_DRAW); d3Attr(gl, pL.aC, D3.lines.c, 4);
    gl.drawArrays(gl.LINES, 0, np);
  }
  if(STY.a < 1){ drawWorld(); drawSmokes(); }
  // рентген: закрытая часть фигуры — плоский полупрозрачный силуэт цвета стороны (глубина «дальше стены»)
  if(XR.length){ gl.useProgram(pM.p); gl.depthMask(false); gl.depthFunc(gl.GREATER);
    XR.forEach(function(q){ var c = q[4], sc2 = [Math.min(1, c[0]*0.6 + 0.45), Math.min(1, c[1]*0.6 + 0.4), Math.min(1, c[2]*0.6 + 0.35), 0.55];
      draw(D3.capsule, d3Model(q[0], q[1] + 0.3, q[2], q[3]*0.6, q[3]*0.8, q[3]*0.6), sc2, 0);
      draw(D3.sphere, d3Model(q[0], q[1] + q[3]*0.9, q[2], q[3]*0.13, q[3]*0.13, q[3]*0.13), sc2, 0); });
    gl.depthFunc(gl.LESS); gl.depthMask(true); }
  // (v591) от первого лица — оружие в руках (поверх мира: глубина заново), отдача назад и вверх, вспышка у дула; плант — бомба в руках у пола
  if(D3.mode === "fp" && D3.fpId && D3.vm && D3.vm.id === D3.fpId && !opt.w){
    var E3 = eye, f3 = [tgt[0]-E3[0], tgt[1]-E3[1], tgt[2]-E3[2]], fl3 = Math.hypot(f3[0], f3[1], f3[2]) || 1; f3 = [f3[0]/fl3, f3[1]/fl3, f3[2]/fl3];
    var r3 = [-f3[2], 0, f3[0]], rl3 = Math.hypot(r3[0], r3[2]) || 1; r3 = [r3[0]/rl3, 0, r3[2]/rl3];
    var u3 = [r3[1]*f3[2] - r3[2]*f3[1], r3[2]*f3[0] - r3[0]*f3[2], r3[0]*f3[1] - r3[1]*f3[0]];
    var at = function(a, b, c){ return [E3[0] + f3[0]*a + r3[0]*b + u3[0]*c, E3[1] + f3[1]*a + r3[1]*b + u3[1]*c, E3[2] + f3[2]*a + r3[2]*b + u3[2]*c]; };
    var vk = D3.vm.kick, kb = vk*0.5, ku = vk*0.25;
    gl.useProgram(pM.p); gl.clear(gl.DEPTH_BUFFER_BIT);
    if(D3.vm.act === "plant"){ var lo = -1.4 - (1 - D3.vm.pk)*-0.6; draw(D3.box, d3Basis(at(3.2, -0.6, lo - 0.5), f3, u3, r3, 1.1, 0.55, 0.8), [0.36, 0.4, 0.3, 1], 0.9);
      draw(D3.sphere, d3Model.apply(null, at(3.4, -0.5, lo).concat([0.12, 0.12, 0.12])), [1, 0.3, 0.25, (tick >> 3) & 1 ? 1 : 0.3], 0); }
    else if(D3.vm.act !== "defuse"){
      // в правом нижнем углу (≈ 30° вправо и вниз), ствол вдоль взгляда; отдача — назад и вверх
      draw(D3.box, d3Basis(at(2.7 - kb, 1.45, -1.45 + ku), f3, u3, r3, 0.6, 0.26, 0.15), [0.17, 0.18, 0.16, 1], 0.8);   // коробка
      draw(D3.box, d3Basis(at(3.6 - kb, 1.45, -1.33 + ku*1.3), f3, u3, r3, 0.4, 0.09, 0.07), [0.1, 0.1, 0.1, 1], 0.7);   // ствол
      draw(D3.box, d3Basis(at(2.85 - kb, 1.45, -1.75 + ku), f3, u3, r3, 0.12, 0.32, 0.1), [0.2, 0.2, 0.18, 1], 0.7);   // магазин
      draw(D3.box, d3Basis(at(2.2 - kb, 1.5, -1.6 + ku), f3, u3, r3, 0.3, 0.26, 0.2), [0.42, 0.34, 0.26, 1], 0.9);   // рука
      if(D3.vm.flash){ gl.blendFunc(gl.SRC_ALPHA, gl.ONE); var mp = at(4.05 - kb, 1.45, -1.29 + ku*1.3); draw(D3.sphere, d3Model(mp[0], mp[1], mp[2], 0.28, 0.28, 0.28), [1, 0.82, 0.4, 0.9], 0, 0); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    }
  }
}
// точка сцены → px экрана (CSS) или null (за камерой)
function d3Proj(x, y, z){
  var m = D3.VP, X = m[0]*x + m[4]*y + m[8]*z + m[12], Y = m[1]*x + m[5]*y + m[9]*z + m[13], W = m[3]*x + m[7]*y + m[11]*z + m[15];
  if(W <= 0.01) return null; return [(X/W*0.5 + 0.5)*D3.W, (0.5 - Y/W*0.5)*D3.H];
}
// табличка ника над капсулой (DOM): плашка цвета стороны, иконка оружия
function d3Tag(b, x, y, z, col, alpha){
  var el = D3.tagEls[b.id];
  if(!el){ var host = document.getElementById("v3Lab"); el = document.createElement("div"); el.className = "v3-tag " + (b.team === "CT" ? "ct" : "t");
    el.innerHTML = '<span class="v3-wp"></span><b></b>'; host.appendChild(el); D3.tagEls[b.id] = el; }
  var cls = "v3-tag " + (b.team === "CT" ? "ct" : "t") + (OBS.lock === b.id ? " sel" : ""); if(el.className !== cls) el.className = cls;
  var nm = nick(b.id); if(el._nm !== nm){ el._nm = nm; el.lastChild.textContent = nm; }
  var wk = b.weapon && b.weapon.key; if(el._wk !== wk){ el._wk = wk; var ic = wk && KF_ICON[wk]; el.firstChild.innerHTML = ic ? '<svg viewBox="' + ic.vb + '">' + ic.svg + '</svg>' : ""; }
  var p = d3Proj(x, y, z); if(!p || p[0] < -60 || p[1] < -40 || p[0] > D3.W + 60 || p[1] > D3.H + 40){ el.style.display = "none"; return; }
  el.style.display = ""; var op = alpha == null || alpha >= 1 ? "" : alpha.toFixed(2); if(el.style.opacity !== op) el.style.opacity = op;
  el.style.transform = "translate(" + p[0].toFixed(1) + "px," + p[1].toFixed(1) + "px) translate(-50%,-100%)";
  var zi = String(1000 - Math.round(Math.hypot(x - D3.eye[0], y - D3.eye[1], z - D3.eye[2])/4)); if(el.style.zIndex !== zi) el.style.zIndex = zi;   // ближний — сверху
}

// ---------- управление: ЛКМ — двигать карту (как в 2D), ПКМ — повернуть и наклонить, колесо — приближение; клик по игроку — слежка ----------
(function(){
  var c = document.getElementById("cv3"), btn = document.getElementById("btn3d"); if(!c || !btn) return;
  btn.addEventListener("click", function(){ d3Toggle(!D3.on); });
  var setScale = function(f){ var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale;
    view.scale = Math.max(0.15, Math.min(12, view.scale*f)); view.panX = cv.width/2 - cx*view.scale; view.panY = cv.height/2 - cy*view.scale; obsManual(); };
  c.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  c.addEventListener("wheel", function(e){ e.preventDefault(); if(D3.cam === "fp"){ D3.fpFov = Math.max(30, Math.min(100, (D3.fpFov || 74) + (e.deltaY < 0 ? -5 : 5))); return; } setScale(e.deltaY < 0 ? 1.1 : 1/1.1); }, {passive: false});
  c.addEventListener("pointerdown", function(e){ D3.drag = {x: e.clientX, y: e.clientY, b: e.button, moved: false}; c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", function(e){ var d = D3.drag; if(!d) return; var dx = e.clientX - d.x, dy = e.clientY - d.y; if(Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; if(!d.moved) return;
    d.x = e.clientX; d.y = e.clientY;
    if((d.b === 2 || e.shiftKey) && D3.cam === "fp"){ D3.fpYaw = (D3.fpYaw || 0) + dx*0.005; D3.fpPitch = Math.max(-1.2, Math.min(1.2, (D3.fpPitch || 0) - dy*0.005)); return; }   // свободный взгляд от первого лица
    if((d.b === 2 || e.shiftKey) && !D3.lock){ D3.yawT -= dx*0.006; D3.top = false; D3.pitchT = Math.max(0.35, Math.min(1.5, D3.pitchT + dy*0.005)); return; }
    var k = 1/Math.max(0.15, Math.sin(D3.pitch)), cy = Math.cos(D3.yaw), sy = Math.sin(D3.yaw);   // экран → земля с учётом поворота
    var wx = (dx*cy + dy*sy*k), wy = (-dx*sy + dy*cy*k);
    view.panX += wx; view.panY += wy; obsManual(); });
  c.addEventListener("pointerup", function(e){ var d = D3.drag; D3.drag = null; if(!d || d.moved || d.b !== 0) return;
    var r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = 22;
    bots.forEach(function(b){ if(!b.alive) return; var p = d3Proj(b.x, (b.z || 0)*D3_KZ + 12, b.y); if(!p) return; var dd = Math.hypot(p[0] - mx, p[1] - my); if(dd < bd){ bd = dd; best = b; } });
    if(best && D3.cam === "fp"){ D3.fpLock = best.id; D3.fpYaw = 0; D3.fpPitch = 0; return; }   // от первого лица — клик по игроку: смотреть его глазами
    if(best){ if(OBS.lock === best.id) OBS.lock = null; else { OBS.lock = best.id; OBS.on = true; OBS.manualUntil = 0; if(plSelected !== best.id){ plSelected = best.id; playersUpdate(); } } }
    else OBS.lock = null; });
  var tb = function(id, f){ var el = document.getElementById(id); if(el) el.addEventListener("click", f); };
  tb("v3Lock", function(){ D3.lock = !D3.lock; this.classList.toggle("on", D3.lock); this.title = D3.lock ? "Угол закреплён — нажми, чтобы снова поворачивать (ПКМ)" : "Закрепить угол камеры"; });
  var stB = document.getElementById("v3Style");
  var stSet = function(i){ D3.style = (i + D3_STYLES.length) % D3_STYLES.length; if(stB) stB.title = "Вид стен: " + D3_STYLES[D3.style].name + " (нажми — следующий)"; try{ localStorage.setItem("sim-3d-style", D3_STYLES[D3.style].id); }catch(e){} };
  try{ var sv = localStorage.getItem("sim-3d-style"); D3_STYLES.forEach(function(q, k){ if(q.id === sv) D3.style = k; }); }catch(e){}
  stSet(D3.style); tb("v3Style", function(){ stSet(D3.style + 1); });
  var camB = document.getElementById("v3Cam"), CAMS = [["auto", "авто: закупка — облёт спавна, раунд — от первого лица, гранаты, иногда общий вид"], ["view", "обзор"], ["flythru", "пролёт по карте"], ["fly", "облёт"], ["chase", "за спиной"], ["nade", "за гранатой"], ["fp", "от первого лица (игрок закреплён, ПКМ — свободный взгляд)"]];
  var camSet = function(m){ if(m === "fp" && D3.cam !== "fp"){ D3.fpLock = D3.fpId || OBS.lock || OBS.id || plSelected; D3.fpYaw = 0; D3.fpPitch = 0; }
    D3.cam = m; var fpB = document.getElementById("v3Fp"); if(fpB) fpB.classList.toggle("on", m === "fp"); var k = CAMS.map(function(q){ return q[0]; }).indexOf(m); if(camB){ camB.title = "Камера: " + CAMS[k][1] + " (нажми — следующая)"; camB.classList.toggle("on", m !== "auto"); } try{ localStorage.setItem("sim-3d-cam", m); }catch(e){} };
  var cs0 = null; try{ cs0 = localStorage.getItem("sim-3d-cam"); }catch(e){} camSet(CAMS.some(function(q){ return q[0] === cs0; }) ? cs0 : "auto"); tb("v3Cam", function(){ var k = CAMS.map(function(q){ return q[0]; }).indexOf(D3.cam); camSet(CAMS[(k + 1) % CAMS.length][0]); });
  var xrB = document.getElementById("v3Xray");
  var xrSet = function(on){ D3.xray = on; if(xrB){ xrB.classList.toggle("on", on); xrB.title = on ? "Рентген: видно всё сквозь стены (нажми — скрыть невидимое)" : "Рентген выключен: за стенами не видно (нажми — видеть насквозь)"; } try{ localStorage.setItem("sim-3d-xray", on ? "1" : "0"); }catch(e){} };
  var xs = null; try{ xs = localStorage.getItem("sim-3d-xray"); }catch(e){} xrSet(xs === "1"); tb("v3Xray", function(){ xrSet(!D3.xray); });
  var smB = document.getElementById("v3Sims");
  var smSet = function(on){ D3.sims = on; if(smB){ smB.classList.toggle("on", on); smB.title = on ? "Стены перед комнатой опущены, как в Симсе (нажми — все стены целые)" : "Все стены целые (нажми — опускать стены перед комнатой)"; } try{ localStorage.setItem("sim-3d-sims", on ? "1" : "0"); }catch(e){} };
  var ss3 = null; try{ ss3 = localStorage.getItem("sim-3d-sims"); }catch(e){} smSet(ss3 !== "0"); tb("v3Sims", function(){ smSet(!D3.sims); });
  tb("v3Fp", function(){ camSet(D3.cam === "fp" ? "auto" : "fp"); });   // основной вид — от первого лица (вкл / выкл)
  tb("v3In", function(){ setScale(1.25); }); tb("v3Out", function(){ setScale(1/1.25); });
  tb("v3Rot", function(){ if(D3.lock) return; D3.yawT = Math.round((D3.yawT - Math.PI/2)/(Math.PI/2))*(Math.PI/2); });
  tb("v3Top", function(){ if(D3.lock) return; D3.top = !D3.top; this.classList.toggle("on", D3.top); if(!D3.top && D3.pitchT > 1.3) D3.pitchT = 0.95; });
  var saved = null; try{ saved = localStorage.getItem("sim-3d"); }catch(e){}
  if(saved === "1") d3Toggle(true);
})();
