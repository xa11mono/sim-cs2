// ---------- кадр ----------
// opt (повтор клатча, 675): {w, h} — размер кадра в px CSS, noTags — без табличек (кадр копируется в холст повтора)
function d3Frame(opt){
  if(!D3.on || !D3.gl) return;
  opt = opt || {};
  var gl = D3.gl, c = gl.canvas, r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  var cw = opt.w || r.width, ch = opt.h || r.height;
  var Wc = Math.max(1, Math.round(cw*dpr)), Hc = Math.max(1, Math.round(ch*dpr));
  if(c.width !== Wc || c.height !== Hc){ c.width = Wc; c.height = Hc; }
  // камера «обзор»: цель — центр экрана 2D, приближение — view.scale (обсервер ведёт и 3D); «пролёт» — то же, камера сама облетает;
  // «от первого лица» — глаза игрока, за которым следим (слежка / выбранный / ближайший к центру)
  var cx = (cv.width/2 - view.panX)/view.scale, cy = (cv.height/2 - view.panY)/view.scale;
  var a0 = typeof navAt === "function" ? navAt(cx, cy, D3.tz) : null, zt = a0 ? a0.z : (D3.tz == null ? 0 : D3.tz);
  D3.tz = D3.tz == null ? zt : D3.tz + (zt - D3.tz)*0.08;
  var mode = opt.w ? "view" : D3.cam;
  if(mode === "auto") mode = d3AutoCam();
  var focusId0 = opt.focus || OBS.lock || OBS.id || plSelected;   // обсервер под 3D: закупка — пролёт, граната следимого — за гранатой, иначе обзор
  D3.mode = mode;
  if(mode === "fly" && !D3.drag){ D3.yawT += 0.0016; D3.pitchT = 0.88 + 0.12*Math.sin(performance.now()/9000); }
  var ease = 0.16; D3.yaw += (D3.yawT - D3.yaw)*ease; var pT = D3.top ? 1.5 : D3.pitchT; D3.pitch += (pT - D3.pitch)*ease;
  var visH = cv.height/view.scale, dist = visH/(2*Math.tan(D3_FOV/2))*0.92, fov = D3_FOV;
  var tgt = [cx, D3.tz*D3_KZ, cy], cp = Math.cos(D3.pitch), sp = Math.sin(D3.pitch);
  var eye = [tgt[0] + Math.sin(D3.yaw)*cp*dist, tgt[1] + sp*dist, tgt[2] + Math.cos(D3.yaw)*cp*dist];
  var fpb = (mode === "fp" || mode === "chase") ? d3FpBot() : null, near = Math.max(1, dist*0.012), far = dist*6;
  D3.fpId = fpb ? fpb.id : null;
  if(fpb){
    var al0 = Math.max(0, Math.min(1, accumulator / TICK_MS)), fx = fpb.px + (fpb.x - fpb.px)*al0, fy = fpb.py + (fpb.y - fpb.py)*al0;
    var ff = fpb._visFacing !== undefined ? fpb._visFacing : (fpb.facing || 0);
    var eh = (fpb.crouching ? 46 : 64)*D3_KZ, ez = (fpb.z || 0)*D3_KZ + eh;
    // (владелец 14.11: «камера резко прыгает», «взгляд — плавно, как в демках») поворот — взгляд бота из игры (_visFacing: прицел с запаздыванием,
    // 510); наклон по высоте — к голове врага, только если бот смотрит на него (± D3_FP_AIM рад), иначе — к полу впереди на высоте глаз;
    // наклон догоняет нужный не быстрее, чем у про: демки Mirage (motion, 789 тыс. тиков) — |Δpitch| за тик: медиана 0°, p90 0,2°, p99 1,36°
    // (≈ 87°/с) — D3_FP_PRATE; плавность — D3_FP_PEASE (проектное). Было: виден враг — камера сразу на его голову
    var en = (fpb._visible || []).filter(function(o){ return o.alive && o.team !== fpb.team; })
      .filter(function(o){ var da = Math.atan2(o.y - fy, o.x - fx) - ff; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < D3_FP_AIM; })[0], ty, hd;
    if(en){ ty = ((en.z || 0) + (en.crouching ? 46 : 62))*D3_KZ; hd = Math.max(8, Math.hypot(en.x - fx, en.y - fy)); }
    // (v583a, Д9, владелец 17.11: «в 3D смотрит в стенку рядом с окном») прицел на точке взгляда (lookTarget, ± D3_FP_AIM) — наклон к ней на высоте
    // головы (пол у точки + 62; пол — ниже глаз бота + 200 ед., окно Mid → Window выше на 105): окно выше / ниже бота видно в проёме, а не стена
    // под ним. Было: всегда горизонт на высоте глаз (у игры взгляд — только поворот)
    else if(fpb.lookTarget && Math.abs(Math.atan2(Math.sin(Math.atan2(fpb.lookTarget.y - fy, fpb.lookTarget.x - fx) - ff), Math.cos(Math.atan2(fpb.lookTarget.y - fy, fpb.lookTarget.x - fx) - ff))) < D3_FP_AIM && Math.hypot(fpb.lookTarget.x - fx, fpb.lookTarget.y - fy) > 40){
      // (v583a, Д25, владелец 18.11: «мимо возвышенности — прицел слишком высоко») пол у точки — ближайший по высоте к полу бота (d3FloorNear), а не
      // высший до +200 (верх ящика / уступа рядом с точкой поднимал прицел); окно выше бота без пола внизу — по-прежнему его пол
      var lt3 = fpb.lookTarget; ty = (d3FloorNear(lt3.x, lt3.y, fpb.z || 0) + 62)*D3_KZ; hd = Math.hypot(lt3.x - fx, lt3.y - fy); }
    else { var ax = fx + Math.cos(ff)*80, ay = fy + Math.sin(ff)*80; ty = d3FloorNear(ax, ay, fpb.z || 0)*D3_KZ + eh; hd = 80; }
    var pD = Math.atan2(ty - ez, hd), nowP = performance.now(), FP = D3.fpP;
    if(!FP || FP.id !== fpb.id || nowP - FP.t > 500) FP = D3.fpP = {id: fpb.id, p: pD, t: nowP};
    var dtP = Math.min(0.1, (nowP - FP.t)/1000), stP = D3_FP_PRATE*dtP, dP = (pD - FP.p)*Math.min(1, dtP*D3_FP_PEASE);
    FP.p += Math.max(-stP, Math.min(stP, dP)); FP.t = nowP;
    tgt = [fx + Math.cos(ff)*Math.cos(FP.p)*100, ez + Math.sin(FP.p)*100, fy + Math.sin(ff)*Math.cos(FP.p)*100];
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
    else { for(var ci = 0; ci < 3; ci++){ CS.eye[ci] += (eye[ci] - CS.eye[ci])*k3; CS.tgt[ci] += (tgt[ci] - CS.tgt[ci])*k3; } CS.fov += (fov - CS.fov)*k3; CS.mode = mode; }
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
  draw(D3.floor, I, null, 0.12);
  if(D3.world && D3.world.gcnt){   // пол и ступени из геометрии — непрозрачно, со срезом, поверх навмеша
    var pW0 = D3.pW, W0 = D3.world; gl.useProgram(pW0.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, W0.ftex.tex);
    gl.uniformMatrix4fv(pW0.u.uVP, false, VP); gl.uniform3fv(pW0.u.uEye, eye); gl.uniform3fv(pW0.u.uL, L); gl.uniform3fv(pW0.u.uBg, D3.cBg.slice(0, 3));
    gl.uniform2fv(pW0.u.uFog, fog); gl.uniform1i(pW0.u.uF, 0); gl.uniform1f(pW0.u.uCut, 1e4); gl.uniform1f(pW0.u.uSims, 0); gl.uniform1f(pW0.u.uFb, 0); gl.uniform1f(pW0.u.uA, 1);
    gl.uniform3fv(pW0.u.uGround, D3.cFloor.slice(0, 3)); gl.uniform2fv(pW0.u.uZr, D3.zr);
    d3Attr(gl, pW0.aP, W0.g, 3); d3Attr(gl, pW0.aK, W0.gk, 1); gl.drawArrays(gl.TRIANGLES, 0, W0.gcnt); if(pW0.aK >= 0) gl.disableVertexAttribArray(pW0.aK);
    gl.useProgram(pM.p);
  }
  // мир со срезом и его рёбра — вид по D3_STYLES (кнопка в колонке): непрозрачный — сразу, прозрачный — последним (видно игроков за стенами)
  var Wd = D3.world, pW = D3.pW, inFp = D3.mode === "fp", cut = (inFp ? 1e5 : D3_CUT)*D3_KZ, low = D3_LOW*D3_KZ, sims = D3.sims && !inFp ? 1 : 0, STY = inFp ? D3_STYLES[2] : (D3_STYLES[D3.style] || D3_STYLES[0]);   // от первого лица — стены сплошные
  var drawWorld = function(){
    if(!Wd.cnt) return;
    gl.useProgram(pW.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Wd.ftex.tex);
    gl.uniformMatrix4fv(pW.u.uVP, false, VP); gl.uniform3fv(pW.u.uEye, eye); gl.uniform3fv(pW.u.uL, L); gl.uniform3fv(pW.u.uBg, D3.cBg.slice(0, 3));
    gl.uniform2fv(pW.u.uFog, fog); gl.uniform1i(pW.u.uF, 0); gl.uniform1f(pW.u.uCut, cut); gl.uniform1f(pW.u.uLow, low); gl.uniform1f(pW.u.uSims, sims); gl.uniform1f(pW.u.uFb, 1); gl.uniform3fv(pW.u.uTgt, tgt); gl.uniform1f(pW.u.uRf, dist*0.55); gl.uniform1f(pW.u.uA, STY.a); gl.uniform3fv(pW.u.uGround, D3.cFloor.slice(0, 3)); gl.uniform2fv(pW.u.uZr, D3.zr);
    var kf = inFp ? 0.5 : 1;   // от первого лица стены сплошные — темнее, не слепят
    gl.uniform3fv(pW.u.uProp, D3.cProp.slice(0, 3).map(function(v){ return v*kf; })); gl.uniform3fv(pW.u.uRock, D3.cRock.slice(0, 3).map(function(v){ return v*kf; })); gl.uniform3fv(pW.u.uCap, D3.cCap.slice(0, 3).map(function(v){ return v*kf; }));
    d3Attr(gl, pW.aP, Wd.p, 3); d3Attr(gl, pW.aK, Wd.k, 1);
    // (владелец 13.11: «сквозь стены видно чужие линии — грязно») прозрачный вид без «рентгена»: сначала стены только в глубину —
    // грани и рёбра за ними не рисуются; с «рентгеном» (кнопка) — видно всё насквозь, как раньше
    // скрыть невидимое — только вблизи: вид на всю карту (облёт на закупке) иначе рисует её дважды — лаги на слабой видеокарте
    if(STY.a < 1 && !D3.xray && dist < 900){ gl.colorMask(false, false, false, false); gl.drawArrays(gl.TRIANGLES, 0, Wd.cnt); gl.colorMask(true, true, true, true); gl.depthFunc(gl.LEQUAL); }
    if(STY.a < 1){ gl.depthMask(false); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }   // изнанку не рисуем — внутренности ящиков и возвышений не видны (владелец, фото 1)
    gl.drawArrays(gl.TRIANGLES, 0, Wd.cnt); if(pW.aK >= 0) gl.disableVertexAttribArray(pW.aK);
    var pE = D3.pE; gl.useProgram(pE.p); gl.uniformMatrix4fv(pE.u.uVP, false, VP); gl.uniform3fv(pE.u.uEye, eye); gl.uniform2fv(pE.u.uFog, fog);
    gl.uniform1i(pE.u.uF, 0); gl.uniform1f(pE.u.uCut, cut); gl.uniform1f(pE.u.uLow, low); gl.uniform1f(pE.u.uSims, sims); gl.uniform1f(pE.u.uFb, 1); gl.uniform3fv(pE.u.uTgt, tgt); gl.uniform1f(pE.u.uRf, dist*0.55); gl.uniform4fv(pE.u.uC, [D3.cEdge[0], D3.cEdge[1], D3.cEdge[2], STY.ea]);
    d3Attr(gl, pE.aP, Wd.e, 3); gl.drawArrays(gl.LINES, 0, Wd.ecnt);
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
  bots.forEach(function(b){
    var x = b.px + (b.x - b.px)*al, y = b.py + (b.y - b.py)*al, z = (b.z != null ? b.z : d3FloorNear(x, y, null))*D3_KZ, col = b.team === "CT" ? D3.cCT : D3.cT;
    var CL = b._climb, air = CL && CL.jump ? 4*(CL.air || 0)*(1 - (CL.air || 0)) : 0; z += air*18;
    d3Hist(b, x, y, z); if(b.alive && D3.corpse[b.id]) delete D3.corpse[b.id];
    if(!b.alive){ d3Corpse(b, draw, col, sz); return; }   // павший — тело падает и катится (d3Corpse)
    if(b.id === D3.fpId) return;   // от первого лица — себя не видно
    var h = (b.crouching ? 20 : 27)*sz;
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
    draw(D3.capsule, d3Model(x, z + 0.3, y, h*0.6, h*0.8, h*0.6), tc, 1);
    draw(D3.sphere, d3Model(x, z + h*0.9, y, h*0.13, h*0.13, h*0.13), hi, 1);
    var vf = b._visFacing !== undefined ? b._visFacing : b.facing;
    if(vf !== undefined){
      var ca = Math.cos(vf), sa = Math.sin(vf);
      draw(D3.box, d3Rot(x + ca*h*0.3, z + h*0.56, y + sa*h*0.3, vf, h*0.22, h*0.05, h*0.035), [0.09, 0.1, 0.08, 1], 0.6);   // оружие
      var r0 = 8.2*sz, len = 5*sz;
      var Mc = new Float32Array([ca*len, 0, sa*len, 0, 0, 1, 0, 0, -sa*len*0.9, 0, ca*len*0.9, 0, x + ca*r0, fz + 0.7, y + sa*r0, 1]);
      draw(D3.cone, Mc, [rc[0], rc[1], rc[2], 0.9], 0);
    }
    seen[b.id] = 1; if(!D3.noTags) d3Tag(b, x, z + h + 4*sz, y, col);
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
