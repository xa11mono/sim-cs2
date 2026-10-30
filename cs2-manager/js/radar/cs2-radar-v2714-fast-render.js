// MARKER_CS2_XYZ_999
(function(){
'use strict';
if(window.__cs2RadarV2714Installed) return;
window.__cs2RadarV2714Installed=true;

/* v27.14 — fast test-mode renderer.
 * Editor mode keeps the original full renderer. Test/simulation mode uses a
 * deliberately small draw budget: no per-frame gradients, shadows, graph
 * labels or duplicate smoke layers. This is the final render path for the
 * simulation and is independent of smoke count.
 */
R.v2714=R.v2714||{frames:0,last:performance.now(),fps:0};
const v2714RoleShort=p=>({IGL:'IGL',AWPer:'AWP','Entry-fragger':'ENT',Support:'SUP',Lurker:'LUR'})[p.role]||'—';

function v2714FastDraw(){
  if(!cv||!cx) return;
  const t0=performance.now();
  const bs=baseCanvasScale();
  cx.setTransform(1,0,0,1,0,0);
  cx.clearRect(0,0,cv.width,cv.height);
  cx.fillStyle='#0b0f14';cx.fillRect(0,0,cv.width,cv.height);
  cx.save();
  cx.translate(cam.panX,cam.panY);
  cx.scale(cam.zoom*bs,cam.zoom*bs);

  if(R.bgReady&&R.bgImg) cx.drawImage(R.bgImg,0,0,RADAR_SIZE,RADAR_SIZE);
  else drawFallback(cx,RADAR_SIZE,RADAR_SIZE);

  /* Site markers: flat fills only. */
  for(const s of Object.values(SITES)){
    cx.globalAlpha=0.12;cx.fillStyle='#e58e26';cx.beginPath();cx.arc(s.x,s.y,Math.min(42,s.r||42),0,Math.PI*2);cx.fill();
    cx.globalAlpha=0.32;cx.strokeStyle='#e58e26';cx.lineWidth=1.2;cx.beginPath();cx.arc(s.x,s.y,Math.min(30,s.r||30),0,Math.PI*2);cx.stroke();
  }
  cx.globalAlpha=1;


  /* Players: restore the older readable arc-sector view cone, but ~4x smaller. */
  for(const p of (R.players||[])){
    if(!p.alive) continue;
    const col=p.team==='T'?'#f0b429':'#4f9cf7';
    const baseRange=Math.min(210,Number(p.wd?.range)||170);
    const range=Math.max(28,Math.min(48,baseRange*0.225));
    const fov=Math.PI*0.55;
    const a=p.angle||0;
    cx.globalAlpha=0.10;cx.fillStyle=col;
    cx.beginPath();cx.moveTo(p.x,p.y);cx.arc(p.x,p.y,range,a-fov/2,a+fov/2);cx.closePath();cx.fill();
    cx.globalAlpha=1;
    cx.fillStyle=col;cx.beginPath();cx.arc(p.x,p.y,8.5,0,Math.PI*2);cx.fill();
    cx.strokeStyle='#111';cx.lineWidth=1.4;cx.stroke();
    cx.strokeStyle='#fff';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(p.x+Math.cos(a)*13,p.y+Math.sin(a)*13);cx.stroke();
    cx.fillStyle='#fff';cx.font='bold 10px Segoe UI';cx.textAlign='center';
    cx.fillText(`${p.nick} · ${v2714RoleShort(p)}`,p.x,p.y-13);
    cx.fillStyle='rgba(0,0,0,.75)';cx.fillRect(p.x-16,p.y+10,32,3);
    cx.fillStyle=p.hp>50?'#58c58a':'#ef5364';cx.fillRect(p.x-16,p.y+10,32*Math.max(0,Math.min(1,(p.hp||0)/100)),3);
    if(p.hasBomb){cx.fillStyle='#ef5364';cx.beginPath();cx.arc(p.x-11,p.y-11,3.5,0,Math.PI*2);cx.fill();}
    if(p.isPlanting){
      const total=p.team==='T'?PLANT_TIME:DEFUSE_TIME;
      const pr=Math.max(0,Math.min(1,(p.plantProgress||0)/total));
      cx.fillStyle='rgba(0,0,0,.85)';cx.fillRect(p.x-18,p.y-24,36,4);
      cx.fillStyle=p.team==='T'?'#ef5364':'#4f9cf7';cx.fillRect(p.x-18,p.y-24,36*pr,4);
    }
  }

  /* Bomb / objective markers. */
  if(R.bomb.state==='planted'){
    const pulse=1+Math.sin(performance.now()/180)*0.08;
    cx.globalAlpha=0.18;cx.fillStyle='#ef5364';cx.beginPath();cx.arc(R.bomb.x,R.bomb.y,22*pulse,0,Math.PI*2);cx.fill();
    cx.globalAlpha=1;cx.fillStyle='#ef5364';cx.beginPath();cx.arc(R.bomb.x,R.bomb.y,6,0,Math.PI*2);cx.fill();
  }else if(R.bomb.state==='dropped'){
    cx.fillStyle='#ef5364';cx.beginPath();cx.arc(R.bomb.x,R.bomb.y,5,0,Math.PI*2);cx.fill();
  }

  /* Tracers (shots fired) — restored for visibility in fast mode. */
  if(typeof TRACERS!=='undefined' && TRACERS.length){
    const nowT=performance.now();
    cx.save();cx.lineCap='round';
    for(const t of TRACERS){
      const age=nowT-t.born, k=Math.max(0,1-age/t.life);
      if(k<=0) continue;
      const col=t.team==='T'?'255,196,64':'110,170,255';
      cx.strokeStyle=`rgba(${col},${0.85*k})`;cx.lineWidth=2.4*k+0.4;
      cx.beginPath();cx.moveTo(t.x1,t.y1);cx.lineTo(t.x2,t.y2);cx.stroke();
      cx.strokeStyle=`rgba(255,255,255,${0.55*k})`;cx.lineWidth=1;
      cx.beginPath();cx.moveTo(t.x1,t.y1);cx.lineTo(t.x2,t.y2);cx.stroke();
      if(age<45){
        cx.fillStyle=`rgba(255,235,180,${0.8*(1-age/45)})`;
        cx.beginPath();cx.arc(t.x1,t.y1,4,0,Math.PI*2);cx.fill();
      }
    }
    cx.restore();
  }

  /* Authoritative grenade render: one draw call, one source of state. */
  drawGrenades();
  /* Bomb explosion FX — restored in FAST runtime renderer. Lightweight, no gradients. */

  if(R.bomb?.exploded && R.bomb.explosionAt){
    const exNow=performance.now();
    const exAge=exNow-R.bomb.explosionAt;
    if(exAge>=0 && exAge<1100){
      const exT=Math.max(0,Math.min(1,exAge/1100));
      const ease=exT*exT*(3-2*exT);
      const inv=1-exT;
      const bx=R.bomb.x, by=R.bomb.y;
      cx.save();
      cx.globalCompositeOperation='lighter';

      // Central flash fades very quickly.
      const flashT=Math.max(0,Math.min(1,exAge/180));
      cx.globalAlpha=0.34*inv + 0.22*(1-flashT);
      cx.fillStyle='#fff3cf';
      cx.beginPath(); cx.arc(bx,by,24+34*(1-flashT),0,Math.PI*2); cx.fill();

      // Hot inner blast ring.
      cx.globalAlpha=0.82*inv;
      cx.strokeStyle='#ffcf66'; cx.lineWidth=5*inv;
      cx.beginPath(); cx.arc(bx,by,16+88*ease,0,Math.PI*2); cx.stroke();

      // Main shockwave.
      cx.globalAlpha=0.72*inv;
      cx.strokeStyle='#ff7a36'; cx.lineWidth=Math.max(1.2,4.5*inv);
      cx.beginPath(); cx.arc(bx,by,28+205*ease,0,Math.PI*2); cx.stroke();

      // Secondary ring gives the explosion a readable expanding edge.
      cx.globalAlpha=0.42*inv;
      cx.strokeStyle='#ef5364'; cx.lineWidth=2*inv;
      cx.beginPath(); cx.arc(bx,by,42+150*ease,0,Math.PI*2); cx.stroke();

      // Directional sparks, deterministic and cheap.
      const sparkCount=14;
      for(let i=0;i<sparkCount;i++){
        const a=i*(Math.PI*2/sparkCount)+0.17;
        const jitter=1+0.08*Math.sin(i*7.13);
        const r0=18+18*ease, r1=(55+145*ease)*jitter;
        const sx=bx+Math.cos(a)*r0, sy=by+Math.sin(a)*r0;
        const tx=bx+Math.cos(a)*r1, ty=by+Math.sin(a)*r1;
        cx.globalAlpha=0.48*inv;
        cx.strokeStyle=i%3===0?'#fff2a6':'#ff9f43';
        cx.lineWidth=1.8*inv;
        cx.beginPath(); cx.moveTo(sx,sy); cx.lineTo(tx,ty); cx.stroke();
      }

      // Small smoke/debris dots around the center.
      for(let i=0;i<10;i++){
        const a=i*(Math.PI*2/10)+0.33;
        const rr=(32+82*ease)*(0.78+0.16*Math.sin(i*4.7));
        const px=bx+Math.cos(a)*rr, py=by+Math.sin(a)*rr;
        cx.globalAlpha=0.20*inv;
        cx.fillStyle=i%2?'#5c616b':'#8b919c';
        cx.beginPath(); cx.arc(px,py,2.2+2.8*inv,0,Math.PI*2); cx.fill();
      }
      cx.restore();
    }
  }

  cx.globalAlpha=1;
  cx.restore();

  if(R.debug){
    cx.fillStyle='rgba(0,0,0,.82)';cx.fillRect(8,8,420,154);
    cx.fillStyle='#7cff6b';cx.font='11px monospace';cx.textAlign='left';
    const alive=(R.players||[]).filter(p=>p.alive);
    const stuck=alive.filter(p=>(p.stuckFrames||0)>5).length;
    const sm=(ACTIVE_GRENADES||[]).filter(g=>g.kind==='smoke'&&g.expiresAt>Date.now()).length;
    const fx=(performance.now()-t0).toFixed(2);
    const lines=[
      `v27.14 FAST RENDER • smoke:${sm} • draw:${fx}ms`,
      `players:${alive.length} • stuck:${stuck} • bomb:${R.bomb.state}`,
      `round:${R.roundNum} timer:${Number(R.roundTime||0).toFixed(1)} • phase:${R.roundPhase}`,
      `T tactic:${R.v279?.tTactic?.id||'—'}`,
      `CT tactic:${R.v279?.ctTactic?.id||'—'}`,
      `navigation: SMOKE=VISIBILITY ONLY • grenades:${(ACTIVE_GRENADES||[]).length}`
    ];
    lines.forEach((l,i)=>cx.fillText(l,14,24+i*17));
  }
  R.v2714.frames++;
  const end=performance.now();
  if(end-R.v2714.last>=1000){R.v2714.fps=R.v2714.frames;R.v2714.frames=0;R.v2714.last=end;}
}
window.v2714FastDraw = v2714FastDraw;
console.log('[CS2 Radar v27.14] fast simulation renderer active; editor keeps legacy renderer.');
})();

