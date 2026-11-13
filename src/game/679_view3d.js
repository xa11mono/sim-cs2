// ======================= (v571) 3D-ВИД КАРТЫ — одно место показа =======================
// Владелец 13.11 (2 скриншота): «3D-карта в такой же стилистике» — наклонный вид, тёмный пол, серые стены, светлые ящики, игроки-капсулы с
// табличкой ника. Геометрия — та же, что у видимости и гранат (035, MAP.map3d): стены / пол — треугольники с флагом «закрывает обзор»
// (флаг 1; только «граната» — невидимые клипы, не рисуем), ящики / предметы — выпуклые блоки (их габариты). Только показ: игру не меняет.
// three.js грузится при первом включении (jsDelivr). Камера: ЛКМ — вращать, колесо — ближе / дальше, ПКМ или Shift+ЛКМ — сдвиг; обсервер
// включён — камера за его игроком.
var V3D = {on: false, ready: false, loading: false, yaw: -0.6, pitch: 1.0, dist: 5200, tx: 0, ty: 0, tz: 0, manual: 0, P: {}, fx: []};
var V3D_ROOF = 100, V3D_WALL = 110;   // ед. игры: выше пола — потолок / крыша (не рисуем); стены — обрезаны чуть выше роста (проектные числа показа)
var V3D_LIB = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";
function v3dWorld(mx, my){ var M = m3(), k2 = M.unit / M.cell; return {x: M.X0 + mx*k2, y: M.Y0 - my*k2}; }
function v3dLoad(cb){
  if(window.THREE) return cb(); if(V3D.loading) return; V3D.loading = true;
  var s = document.createElement("script"); s.src = V3D_LIB; s.onload = function(){ V3D.loading = false; cb(); };
  s.onerror = function(){ V3D.loading = false; V3D.on = false; logEvent("3D-вид: не загрузилась библиотека three.js — проверьте интернет"); v3dButton(); }; document.head.appendChild(s);
}
function v3dBuild(){
  var T = THREE, M = m3(); if(!M){ logEvent("3D-вид: у этой карты нет 3D-геометрии"); V3D.on = false; return false; }
  var main = document.getElementById("main"), cv = document.createElement("canvas"); cv.id = "cv3d"; main.insertBefore(cv, document.getElementById("cv").nextSibling);
  var R = V3D.r = new T.WebGLRenderer({canvas: cv, antialias: true, preserveDrawingBuffer: true}); R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setClearColor(0x0e0f12, 1);
  var S = V3D.scene = new T.Scene(); S.fog = new T.Fog(0x0e0f12, 3500, 9000);
  V3D.cam = new T.PerspectiveCamera(40, 1, 20, 20000);
  S.add(new T.HemisphereLight(0xdfe6f0, 0x1a1c20, 0.75)); var dl = new T.DirectionalLight(0xffffff, 0.7); dl.position.set(-0.5, 1, 0.35); S.add(dl);
  // стены и пол: треугольники «закрывают обзор»; пол — темнее, стены — светлее (по нормали)
  // как на скриншотах владельца: без крыш и потолков, стены — невысокие. Потолок / крыша — горизонтальная поверхность, под которой есть пол,
  // по которому ходят (выше него на V3D_ROOF); стены обрезаются на V3D_WALL над своим полом (пол — visFloorAt, тот же, что у видимости)
  var k2 = M.unit / M.cell, fl = function(X, Y, Z){ return visFloorAt((X - M.X0)/k2, (M.Y0 - Y)/k2, Z); };
  var tri = M.tri, tf = M.triFlag, n = tf.length, pos = [], col = [], cF = [0.17, 0.18, 0.2], cW = [0.30, 0.31, 0.34];
  for(var k = 0; k < n; k++){ if(!(tf[k] & 1)) continue; var o = k*9;
    var ax = tri[o+3]-tri[o], ay = tri[o+4]-tri[o+1], az = tri[o+5]-tri[o+2], bx = tri[o+6]-tri[o], by = tri[o+7]-tri[o+1], bz = tri[o+8]-tri[o+2];
    var nz = ax*by - ay*bx, nl = Math.hypot(ay*bz - az*by, az*bx - ax*bz, nz) || 1, flat = Math.abs(nz)/nl > 0.7, c = flat ? cF : cW;
    var cxk = (tri[o]+tri[o+3]+tri[o+6])/3, cyk = (tri[o+1]+tri[o+4]+tri[o+7])/3, czk = Math.min(tri[o+2], tri[o+5], tri[o+8]);
    if(flat && czk - fl(cxk, cyk, czk - 1) > V3D_ROOF) continue;   // потолок / крыша над полом
    for(var a = 0; a < 3; a++){ var X = tri[o+a*3], Y = tri[o+a*3+1], Z = tri[o+a*3+2];
      if(!flat){ var f0 = fl(X, Y, Z - 1); if(Z - f0 > V3D_WALL) Z = f0 + V3D_WALL; }
      pos.push(X, Z, -Y); col.push(c[0], c[1], c[2]); } }
  var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  S.add(new T.Mesh(g, new T.MeshLambertMaterial({vertexColors: true, side: T.DoubleSide})));
  // ящики и предметы: блоки «закрывают обзор» — светлые, полупрозрачные, с контуром
  var hb = M.hullBox, hf = M.hullFlag, nb = hf.length, bx0 = new T.BoxGeometry(1, 1, 1), boxes = [];
  for(var h = 0; h < nb; h++){ if(!(hf[h] & 1)) continue; var x0 = hb[h*6], y0 = hb[h*6+1], z0 = hb[h*6+2], x1 = hb[h*6+3], y1 = hb[h*6+4], z1 = hb[h*6+5];
    if(x1-x0 > 900 || y1-y0 > 900) continue;   // огромные блоки — стены уровня, они уже в треугольниках
    var fb0 = fl((x0+x1)/2, (y0+y1)/2, z0 + 1); if(z0 - fb0 > V3D_ROOF) continue;   // висит над полом (балки, крыши) — не рисуем
    z1 = Math.min(z1, Math.max(z0 + 4, fb0 + V3D_WALL*1.6));
    boxes.push([ (x0+x1)/2, (z0+z1)/2, -(y0+y1)/2, Math.max(2, x1-x0), Math.max(2, z1-z0), Math.max(2, y1-y0) ]); }
  var im = new T.InstancedMesh(bx0, new T.MeshLambertMaterial({color: 0xd8dce2, transparent: true, opacity: 0.88}), boxes.length), mt = new T.Matrix4();
  boxes.forEach(function(q, i){ mt.makeScale(q[3], q[4], q[5]); mt.setPosition(q[0], q[1], q[2]); im.setMatrixAt(i, mt); }); S.add(im);
  var ep = new T.EdgesGeometry(bx0).attributes.position.array, lp = new Float32Array(ep.length*boxes.length);   // контуры — одна геометрия на все ящики
  boxes.forEach(function(q, i){ for(var j = 0; j < ep.length; j += 3){ var o = i*ep.length + j; lp[o] = q[0] + ep[j]*q[3]; lp[o+1] = q[1] + ep[j+1]*q[4]; lp[o+2] = q[2] + ep[j+2]*q[5]; } });
  var lg = new T.BufferGeometry(); lg.setAttribute("position", new T.BufferAttribute(lp, 3));
  S.add(new T.LineSegments(lg, new T.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.35})));
  // мышь
  var drag = null;
  cv.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  cv.addEventListener("mousedown", function(e){ drag = {x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey}; });
  window.addEventListener("mouseup", function(){ drag = null; });
  window.addEventListener("mousemove", function(e){ if(!drag || !V3D.on) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if(drag.pan){ var s = V3D.dist/900, c = Math.cos(V3D.yaw), sn = Math.sin(V3D.yaw); V3D.tx -= (dx*c + dy*sn)*s; V3D.tz -= (-dx*sn + dy*c)*s; V3D.manual = performance.now(); }
    else { V3D.yaw -= dx*0.006; V3D.pitch = Math.max(0.2, Math.min(1.45, V3D.pitch + dy*0.005)); } });
  cv.addEventListener("wheel", function(e){ e.preventDefault(); V3D.dist = Math.max(400, Math.min(7000, V3D.dist*(e.deltaY > 0 ? 1.12 : 0.89))); }, {passive: false});
  var c0 = v3dWorld(1024, 1024); V3D.tx = c0.x; V3D.tz = -c0.y;
  V3D.ready = true; return true;
}
function v3dPlate(text, color){   // табличка ника — как на скриншоте: цветная плашка с тёмным текстом
  var c = document.createElement("canvas"), x = c.getContext("2d"); c.width = 160; c.height = 44;
  x.fillStyle = color; x.fillRect(0, 6, 160, 32); x.fillStyle = "#111"; x.font = "600 22px 'IBM Plex Sans Condensed', Arial, sans-serif"; x.textAlign = "center"; x.fillText(text, 80, 30);
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false})); sp.scale.set(0.075, 0.021, 1); return sp;   // один размер на экране
}
function v3dPlayer(b){
  var T = THREE, P = V3D.P[b.id]; if(P) return P;
  var cl = b.team === "T" ? 0xd99a3c : 0x3d7fd6, g = new T.Group();
  var body = new T.Mesh(new T.CapsuleGeometry(15, 38, 4, 10), new T.MeshLambertMaterial({color: cl})); body.position.y = 34; g.add(body);
  var dir = new T.Mesh(new T.ConeGeometry(7, 22, 8), new T.MeshLambertMaterial({color: 0xffffff})); dir.rotation.z = -Math.PI/2; dir.position.set(24, 52, 0); var dg = new T.Group(); dg.add(dir); g.add(dg);
  var pl = v3dPlate(nick(b.id), b.team === "T" ? "#e6b25a" : "#6aa6ec"); pl.position.y = 105; g.add(pl);
  V3D.scene.add(g); P = V3D.P[b.id] = {g: g, dir: dg}; return P;
}
function v3dFrame(){
  if(!V3D.on || !V3D.ready) return; var T = THREE, R = V3D.r, cv = R.domElement, main = document.getElementById("main");
  var w = main.clientWidth, h = main.clientHeight; if(cv.width !== Math.round(w*R.getPixelRatio()) || cv.height !== Math.round(h*R.getPixelRatio())){ R.setSize(w, h, false); cv.style.width = w + "px"; cv.style.height = h + "px"; V3D.cam.aspect = w/h; V3D.cam.updateProjectionMatrix(); }
  bots.forEach(function(b){ var P = v3dPlayer(b); P.g.visible = !!b.alive; if(!b.alive) return; var q = v3dWorld(b.x, b.y), z = b.z != null ? b.z : (visFloorAt ? visFloorAt(b.x, b.y) : 0);
    P.g.position.set(q.x, z, -q.y); P.dir.rotation.y = -(b.facing || 0) * -1; P.dir.rotation.y = (b.facing !== undefined ? b.facing : 0); });
  // смоки, огонь, бомба — заново каждый кадр (их мало)
  V3D.fx.forEach(function(o){ V3D.scene.remove(o); o.geometry && o.geometry.dispose(); }); V3D.fx = [];
  var M = m3(), k2 = M.unit / M.cell;
  smokes.forEach(function(s){ if(tick >= s.until) return; var q = v3dWorld(s.x, s.y), r = (NADE.smoke.radius || 70)*k2, z = visFloorAt(s.x, s.y);
    var m = new T.Mesh(new T.SphereGeometry(r, 18, 12), new T.MeshLambertMaterial({color: 0xbfc4cc, transparent: true, opacity: 0.55})); m.scale.y = 0.6; m.position.set(q.x, z + r*0.5, -q.y); V3D.scene.add(m); V3D.fx.push(m); });
  fires.forEach(function(f){ if(tick >= f.until) return; var q = v3dWorld(f.x, f.y), r = (f.r || 55)*k2, z = visFloorAt(f.x, f.y);
    var m = new T.Mesh(new T.CylinderGeometry(r, r, 6, 20), new T.MeshBasicMaterial({color: 0xff7a2a, transparent: true, opacity: 0.45})); m.position.set(q.x, z + 4, -q.y); V3D.scene.add(m); V3D.fx.push(m); });
  if(bomb && (bomb.state === "planted" || bomb.state === "dropped")){ var qb = v3dWorld(bomb.x, bomb.y), zb = bomb.z != null ? bomb.z : visFloorAt(bomb.x, bomb.y);
    var mb = new T.Mesh(new T.BoxGeometry(24, 10, 16), new T.MeshBasicMaterial({color: bomb.state === "planted" ? 0xff3b30 : 0xffcc33})); mb.position.set(qb.x, zb + 6, -qb.y); V3D.scene.add(mb); V3D.fx.push(mb); }
  // камера: за игроком обсервера (если не двигали руками последние 4 с), иначе — куда сдвинули
  if(typeof OBS !== "undefined" && OBS.on && OBS.id && performance.now() - V3D.manual > 4000){ var fb = bots.filter(function(o){ return o.id === OBS.id && o.alive; })[0];
    if(fb){ var qf = v3dWorld(fb.x, fb.y); V3D.tx += (qf.x - V3D.tx)*0.08; V3D.tz += (-qf.y - V3D.tz)*0.08; V3D.ty += ((fb.z || 0) - V3D.ty)*0.08; } }
  var cp = Math.cos(V3D.pitch), c = V3D.cam;
  c.position.set(V3D.tx + Math.cos(V3D.yaw)*cp*V3D.dist, V3D.ty + Math.sin(V3D.pitch)*V3D.dist, V3D.tz + Math.sin(V3D.yaw)*cp*V3D.dist); c.lookAt(V3D.tx, V3D.ty, V3D.tz);
  R.render(V3D.scene, c);
}
function v3dButton(){ var b = document.getElementById("btn3d"); if(b) b.classList.toggle("on", V3D.on); var cv = document.getElementById("cv3d"); if(cv) cv.style.display = V3D.on ? "block" : "none"; }
function v3dToggle(){
  V3D.on = !V3D.on; v3dButton();
  if(V3D.on && !V3D.ready) v3dLoad(function(){ if(!V3D.ready && !v3dBuild()) return; v3dButton(); });
}
(function(){ if(typeof document === "undefined") return; var b = document.getElementById("btn3d"); if(b){ b.addEventListener("click", v3dToggle); if(!(MAP.map3d)) b.style.display = "none"; } })();
