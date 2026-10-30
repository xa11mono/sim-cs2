
'use strict';

function throwGrenade(player,type,fromX,fromY,toX,toY,z){
  if(!player || !['smoke','flash','he','molotov'].includes(type)) return false;

  const startZ=Number(player.z)||0;
  const endZRaw=Number(z);
  const endZ=Number.isFinite(endZRaw)?endZRaw:startZ;
  const sx=Number(fromX)||0, sy=Number(fromY)||0;
  const ex=Number(toX)||0, ey=Number(toY)||0;
  const distance=Math.hypot(ex-sx,ey-sy,(endZ-startZ)*0.65);
  const flightTime=Math.max(0.78,Math.min(1.65,0.78+distance/850));

  ACTIVE_GRENADES.push({
    kind:'projectile',
    id:`g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    type,
    owner:player.nick||null,
    team:player.team||null,
    x:sx,y:sy,z:startZ,
    startX:sx,startY:sy,startZ,
    endX:ex,endY:ey,endZ,
    age:0,
    flightTime,
    detonated:false
  });
  return true;
}

function detonate(g){
  if(!g || g.detonated) return;
  g.detonated=true;

  const x=Number(g.endX);
  const y=Number(g.endY);
  const z=Number(g.endZ);
  const gx=Number.isFinite(x)?x:(Number(g.x)||0);
  const gy=Number.isFinite(y)?y:(Number(g.y)||0);
  const gz=Number.isFinite(z)?z:(Number(g.z)||0);

  if(g.type==='smoke'){
    ACTIVE_GRENADES.push({
      kind:'smoke',
      x:gx,y:gy,z:gz,
      radius:56,
      expiresAt:Date.now()+12000,
      formedAt:Date.now()
    });
    return;
  }

  if(g.type==='flash'){
    const radius=190;
    const source={x:gx,y:gy,z:gz};

    for(const p of (R.players||[])){
      if(!p.alive || p.team===g.team) continue;
      const d=Math.hypot(p.x-gx,p.y-gy);
      if(d>radius || Math.abs((p.z||0)-gz)>1) continue;
      if(!hasLOS(source,p)) continue;

      const strength=Math.max(0,1-d/radius);
      p.blindTimer=Math.max(p.blindTimer||0,0.9+2.4*strength);
      R.killfeed.unshift({
        killer:'FLASH',
        killerTeam:g.team,
        victim:p.nick,
        victimTeam:p.team,
        wpn:'flash'
      });
    }
    if(R.killfeed.length>12) R.killfeed.length=12;
    renderKillfeed();
    return;
  }

  if(g.type==='he'){
    const radius=125;
    const source={x:gx,y:gy,z:gz};

    for(const p of (R.players||[])){
      if(!p.alive || p.team===g.team) continue;
      const d=Math.hypot(p.x-gx,p.y-gy);
      if(d>radius || Math.abs((p.z||0)-gz)>1) continue;

      const cover=hasLOS(source,p)?1:0.45;
      const dmg=grenadeDamageAt(p,gx,gy,radius,58)*cover;
      if(dmg>1){
        p.hp-=dmg;
        p.hazardUntil=performance.now()+850;
        if(p.hp<=0) killPlayer(p,null,'HE');
      }
    }
    return;
  }

  if(g.type==='molotov'){
    ACTIVE_GRENADES.push({
      kind:'molotov',
      x:gx,y:gy,z:gz,
      radius:68,
      expiresAt:Date.now()+7000,
      nextDamageAt:0
    });
  }
}

function updateGrenades(dt){
  const delta=Math.max(0,Number(dt)||0);
  const now=Date.now();
  const perf=performance.now();

  for(let i=ACTIVE_GRENADES.length-1;i>=0;i--){
    const g=ACTIVE_GRENADES[i];
    if(!g){
      ACTIVE_GRENADES.splice(i,1);
      continue;
    }

    if(g.kind==='projectile'){
      g.age=(Number(g.age)||0)+delta;
      const total=Math.max(0.01,Number(g.flightTime)||0.95);
      const t=Math.max(0,Math.min(1,g.age/total));
      const e=t*t*(3-2*t);

      g.x=g.startX+(g.endX-g.startX)*e;
      g.y=g.startY+(g.endY-g.startY)*e;
      g.z=g.startZ+(g.endZ-g.startZ)*e;

      if(g.age>=total){
        g.x=g.endX;
        g.y=g.endY;
        g.z=g.endZ;
        ACTIVE_GRENADES.splice(i,1);
        detonate(g);
      }
      continue;
    }

    if(g.kind==='smoke'){
      if(g.expiresAt<=now) ACTIVE_GRENADES.splice(i,1);
      continue;
    }

    if(g.kind==='molotov'){
      if(g.expiresAt<=now){
        ACTIVE_GRENADES.splice(i,1);
        continue;
      }

      if(!g.nextDamageAt || perf>=g.nextDamageAt){
        g.nextDamageAt=perf+450;

        for(const p of (R.players||[])){
          if(!p.alive) continue;
          if(Math.abs((p.z||0)-(g.z||0))>0.8) continue;
          if(Math.hypot(p.x-g.x,p.y-g.y)>g.radius) continue;

          p.hazardUntil=perf+900;
          p.hp-=10+Math.random()*5;
          if(p.hp<=0) killPlayer(p,null,'Molotov');
        }
      }
      continue;
    }

    if(g.expiresAt!==undefined && g.expiresAt<=now) ACTIVE_GRENADES.splice(i,1);
  }
}

function drawGrenades(){
  if(!R.showGrenades && !R.editMode) return;

  if(R.editMode && GRENADES.length){
    GRENADES.forEach((g,i)=>{
      if(g.enabled===false) return;

      const selected=R.selectedGrenade===i;
      const color={
        smoke:'#d7dde5',
        flash:'#fbc531',
        he:'#ff6b6b',
        molotov:'#ff9f43'
      }[g.type]||'#d7dde5';

      cx.strokeStyle=selected?'#fff':color;
      cx.lineWidth=selected?3:1.5;
      cx.setLineDash([5,3]);
      cx.beginPath();
      cx.moveTo(g.from.x,g.from.y);
      cx.lineTo(g.to.x,g.to.y);
      cx.stroke();
      cx.setLineDash([]);

      cx.beginPath();
      cx.arc(g.from.x,g.from.y,selected?8:5,0,Math.PI*2);
      cx.fillStyle='#00d2d3';
      cx.fill();
      cx.strokeStyle='#000';
      cx.stroke();

      cx.beginPath();
      cx.arc(g.to.x,g.to.y,selected?9:6,0,Math.PI*2);
      cx.fillStyle=color;
      cx.fill();
      cx.strokeStyle='#000';
      cx.stroke();

      cx.fillStyle=selected?'#fff':color;
      cx.font='bold 10px monospace';
      cx.textAlign='center';
      cx.fillText(`${g.type} • ${g.team}`,g.to.x,g.to.y-10);
    });
  }

  if(R.grenadeDraft){
    cx.beginPath();
    cx.arc(R.grenadeDraft.from.x,R.grenadeDraft.from.y,8,0,Math.PI*2);
    cx.fillStyle='#00d2d3';
    cx.fill();

    if(R.mouseX!==undefined){
      cx.strokeStyle='#00d2d3';
      cx.lineWidth=2;
      cx.setLineDash([5,3]);
      cx.beginPath();
      cx.moveTo(R.grenadeDraft.from.x,R.grenadeDraft.from.y);
      cx.lineTo(R.mouseX,R.mouseY);
      cx.stroke();
      cx.setLineDash([]);
    }
  }

  for(const g of ACTIVE_GRENADES){
    if(g.kind==='projectile'){
      const total=Math.max(0.01,Number(g.flightTime)||0.95);
      const t=Math.max(0,Math.min(1,(Number(g.age)||0)/total));
      const trailT=Math.max(0,t-0.10);

      const trailEase=trailT*trailT*(3-2*trailT);
      const trailX=g.startX+(g.endX-g.startX)*trailEase;
      const trailY=g.startY+(g.endY-g.startY)*trailEase;

      cx.strokeStyle='rgba(235,240,246,0.35)';
      cx.lineWidth=2;
      cx.beginPath();
      cx.moveTo(trailX,trailY);
      cx.lineTo(g.x,g.y);
      cx.stroke();

      const fill={
        smoke:'#eef2f7',
        flash:'#fffde8',
        he:'#ff6969',
        molotov:'#ffb35c'
      }[g.type]||'#eef2f7';

      cx.fillStyle=fill;
      cx.beginPath();
      cx.arc(g.x,g.y,4.5,0,Math.PI*2);
      cx.fill();
    }else if(g.kind==='smoke'){
      cx.globalAlpha=0.48;
      cx.fillStyle='rgba(150,158,170,0.95)';
      cx.beginPath();
      cx.arc(g.x,g.y,g.radius||56,0,Math.PI*2);
      cx.fill();
      cx.globalAlpha=1;
    }else if(g.kind==='molotov'){
      cx.globalAlpha=0.24;
      cx.fillStyle='rgba(255,120,45,0.95)';
      cx.beginPath();
      cx.arc(g.x,g.y,g.radius||68,0,Math.PI*2);
      cx.fill();
      cx.globalAlpha=1;
    }
  }

  cx.globalAlpha=1;
}

