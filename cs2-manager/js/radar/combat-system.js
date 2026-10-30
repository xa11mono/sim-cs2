'use strict';

function resolveShot(shooter,target){
  if(!shooter?.alive || !target?.alive) return false;
  const wd=shooter.wd||{}, d=dist(shooter,target);
  if(!Number.isFinite(Number(wd.range)) || d>Number(wd.range) || d>COMBAT_RANGE) return false;

  const los=!!hasLOS(shooter,target), smoke=smokeBetween(shooter,target);
  if(!los && !smoke) return false;

  const now=performance.now();
  if(!R.roundContactAt) R.roundContactAt=now;
  shooter.lastShotAt=now;
  let chance=0.59+((Number(shooter.fp)||75)-75)/320;
  if(shooter.blindTimer>0) chance*=0.42;
  if(shooter.path&&shooter.pi<shooter.path.length-1) chance*=0.92;
  if(smoke) chance*=los?0.75:0.16;
  chance=Math.max(0.05,Math.min(0.92,chance));

  const hit=Math.random()<chance;
  const spread=hit?0:(14+Math.random()*22)*(Math.random()<0.5?-1:1);
  const ang=Math.atan2(target.y-shooter.y,target.x-shooter.x)+spread*Math.PI/180;

  const tracerLife={glock:180,usp:180,deagle:220,ak:80,m4:70,awp:280}[shooter.weapon]||130;
  TRACERS.push({
    x1:shooter.x,y1:shooter.y,
    x2:shooter.x+Math.cos(ang)*d,y2:shooter.y+Math.sin(ang)*d,
    team:shooter.team,born:now,life:tracerLife
  });
  if(!hit){ shooter.lastShotType='MISS'; return false; }

  const recent=Number(shooter.shotStreak)||0;
  const headChance=Math.max(0.12,Math.min(0.36,
    0.21+((Number(shooter.fp)||75)-75)*0.0011-(shooter.blindTimer>0?0.12:0)));
  const sprayChance=Math.min(0.34,0.12+Math.min(7,recent+1)*0.035);
  const r=Math.random();
  const zone=r<headChance?'HEAD':(r<headChance+sprayChance?'SPRAY':'BODY');
  shooter.shotStreak=Math.min(7,recent+1);

  const body={glock:23,usp:25,deagle:48,ak:34,m4:33,awp:115}[shooter.weapon]||34;
  const head={glock:88,usp:92,deagle:100,ak:111,m4:105,awp:120}[shooter.weapon]||Math.max(body,100);
  let dmg=zone==='HEAD'?head:zone==='SPRAY'?Math.max(6,Math.round(body*0.70)):body;
  if(zone!=='HEAD'&&d>125) dmg*=Math.max(0.68,1-(d-125)/400);
  if(zone==='HEAD'&&d>230&&shooter.weapon!=='awp') dmg*=0.90;
  dmg=Math.max(1,Math.round(dmg));

  target.hp=Math.max(0,(Number(target.hp)||100)-dmg);
  target.lastHitType=zone; target.lastHitDamage=dmg; target.lastHitBy=shooter.nick;
  shooter.lastShotType=zone;
  if(typeof tryInterruptDefuse==='function' && target.team==='CT') tryInterruptDefuse(target);
  if(target.hp<=0) killPlayer(target,shooter,shooter.wd?.name||shooter.weapon);
  return true;
}

function killPlayer(victim,killer,weaponName){
  if(!victim||!victim.alive) return false;
  victim.alive=false;
  victim.deaths=(Number(victim.deaths)||0)+1;
  if(killer){
    killer.kills=(Number(killer.kills)||0)+1;
    R.roundMomentum=(Number(R.roundMomentum)||0)+(killer.team==='T'?0.8:-0.8);
  }
  if(victim.team==='CT' && killer && killer.team==='T'){
    R.v28=R.v28||{};
    R.v28.ctDeathAlerts=R.v28.ctDeathAlerts||[];
    R.v28.ctDeathAlerts.push({
      x:victim.x, y:victim.y,
      killerX:Number.isFinite(killer.x)?killer.x:null,
      killerY:Number.isFinite(killer.y)?killer.y:null,
      site:(typeof v28NearestSite==='function')?v28NearestSite(victim.x,victim.y):null,
      at:performance.now(),
      responders:null
    });
  }
  R.killfeed.unshift({
    killer:killer?killer.nick:'—',killerTeam:killer?killer.team:'T',
    victim:victim.nick,victimTeam:victim.team,wpn:weaponName
  });
  if(R.killfeed.length>12) R.killfeed.pop();
  renderKillfeed();
  refreshPlayerObjectives(true);
  return true;
}

function combatTick(p,dt){
  if(!p?.alive) return;
  if(p.isPlanting){
    p.aim=Math.max(0,(Number(p.aim)||0)-dt*1.6);
    return;
  }
  const {e,d}=nearestEnemy(p);
  const wd=p.wd||{};
  if(!e||!e.alive||d>Number(wd.range)||d>COMBAT_RANGE){
    p.aim=Math.max(0,(Number(p.aim)||0)-dt*1.6);
    return;
  }

  /* ---- AWP: hold long, retreat if closed in, slow charge shot ---- */
  if(p.weapon==='awp'){
    if(d < 120){
      p.aim = Math.max(0,(Number(p.aim)||0) - dt*1.6);
      p.retreatFrom = {x:e.x, y:e.y, until:performance.now()+800};
      return;
    }
    const canSee = hasLOS(p,e) || !!smokeBetween(p,e);
    if(!canSee){
      p.aim = Math.max(0,(Number(p.aim)||0) - dt*1.6);
      return;
    }
    faceTowards(p,e.x,e.y,dt*(p.blindTimer>0?0.35:1));
    p.aim = (Number(p.aim)||0) + 0.55*dt;
    if(p.aim >= 1){
      resolveShot(p,e);
      p.aim = 0;
    }
    return;
  }

  /* ---- Low HP + healthy enemy: back off ---- */
  if((Number(p.hp)||100)<25 && (Number(e.hp)||100)>40){
    p.aim=Math.max(0,(Number(p.aim)||0)-dt*1.6);
    return;
  }

  const canFight=hasLOS(p,e)||!!smokeBetween(p,e);
  if(!canFight){
    p.aim=Math.max(0,(Number(p.aim)||0)-dt*1.6);
    return;
  }

  faceTowards(p,e.x,e.y,dt*(p.blindTimer>0?0.35:1));
  p.aim=(Number(p.aim)||0)+Number(wd.aim||0)*dt;
  const rof = Number(wd.rof) || 0.5;
  if(p.aim >= rof){
    resolveShot(p,e);
    p.aim = 0;
  }
}