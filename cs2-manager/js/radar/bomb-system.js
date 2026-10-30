
'use strict';

let bombAnchorsAssignedRound=-1;

function bombInitRound(){
  R.bomb={state:'carried',carrier:null,x:0,y:0,timer:0,exploded:false};
  R.bombSounds=[];
  R.roundContactAt=0;
  bombAnchorsAssignedRound=-1;
  const ts=(R.players||[]).filter(p=>p.alive&&p.team==='T');
  ts.forEach(p=>{p.hasBomb=false;p.isPlanting=false;p.plantProgress=0;p.bombRole=null;});
  (R.players||[]).forEach(p=>{
    p.isPlanting=false;p.plantProgress=0;p.bombFakeUntil=0;
    p.bombStage=null;p.bombEntry=null;p.bombCover=null;p.bombRole=null;
    p.plantCoverAnchor=null;
  });
  const priority={IGL:50,Support:40,Lurker:30,AWPer:20,'Entry-fragger':-100};
  ts.sort((a,b)=>(priority[b.role]||0)-(priority[a.role]||0) || (a.planSlot||0)-(b.planSlot||0));
  const carrier=ts[0]||null;
  if(carrier){
    carrier.hasBomb=true;
    R.bomb.carrier=carrier;
    R.bomb.x=carrier.x;R.bomb.y=carrier.y;
  }
}

function bombUpdate(dt){
  if(!R.active) return;
  const step=Math.max(0,Number(dt)||0);

  if(R.bomb.state==='carried'){
    const carrier=R.bomb.carrier;
    if(!carrier||!carrier.alive){
      if(carrier) carrier.hasBomb=false;
      R.bomb.state='dropped';
      R.bomb.x=carrier?.x??R.bomb.x;
      R.bomb.y=carrier?.y??R.bomb.y;
      R.bomb.carrier=null;
      refreshPlayerObjectives(true);
    }else{
      R.bomb.x=carrier.x;R.bomb.y=carrier.y;
      const site=SITES[R.tTargetSite];
      if(site && dist(carrier,site)<=site.r+10){
        const wasPlanting=carrier.isPlanting;
        carrier.isPlanting=true;
        carrier.plantProgress=(Number(carrier.plantProgress)||0)+step;
        if(!wasPlanting) refreshPlayerObjectives(true);
        if(carrier.plantProgress>=PLANT_TIME){
          carrier.isPlanting=false;carrier.plantProgress=0;carrier.hasBomb=false;
          R.bomb.state='planted';R.bomb.x=site.x;R.bomb.y=site.y;R.bomb.timer=BOMB_TIME;
          R.bomb.carrier=null;R.bomb.exploded=false;
          R.roundPhase='retake';
          bombAssignPostPlantAnchors();
          bombAssignRoles();
          R.killfeed.unshift({killer:carrier.nick,killerTeam:'T',victim:'★ C4 PLANTED',victimTeam:'BOMB',wpn:'plant'});
          if(R.killfeed.length>12) R.killfeed.pop();
          renderKillfeed();
          refreshPlayerObjectives(true);
        }
      }else{
        carrier.isPlanting=false;carrier.plantProgress=0;
      }
    }
    return;
  }

  if(R.bomb.state==='dropped'){
    const ts=(R.players||[]).filter(p=>p.alive&&p.team==='T'&&!p.hasBomb);
    ts.sort((a,b)=>dist(a,R.bomb)-dist(b,R.bomb));
    const pick=ts[0];
    if(!pick) return;
    if(dist(pick,R.bomb)<=35){
      (R.players||[]).forEach(p=>{if(p.team==='T') p.hasBomb=false;});
      pick.hasBomb=true;
      R.bomb.state='carried';R.bomb.carrier=pick;R.bomb.x=pick.x;R.bomb.y=pick.y;R.bomb.timer=0;R.bomb.exploded=false;
      R.roundPhase='plant';
      R.killfeed.unshift({killer:pick.nick,killerTeam:'T',victim:'★ C4 PICKED UP',victimTeam:'BOMB',wpn:'pickup'});
      if(R.killfeed.length>12) R.killfeed.pop();
      renderKillfeed();
      refreshPlayerObjectives(true);
    }else{
      const target=findClosestWPTo(R.bomb.x,R.bomb.y,pick.z);
      if(target && (!pick.path||pick.objectiveWP!==target||pick.pi>=pick.path.length-1)) setPlayerPath(pick,target);
      pick.objective=`RECOVER C4 • ${Math.max(0,Number(R.roundTime)||0).toFixed(1)}s`;
    }
    return;
  }

  if(R.bomb.state==='planted'){
    if(R.bomb.exploded) return;
    R.bomb.timer=Math.max(0,Number(R.bomb.timer||0)-step);
    bombAssignRoles();
    if(R.bomb.timer<=0){
      bombExplode();
      if(R.bomb.exploded && R.active) endRound('T');
    }
  }
}

function bombExplode(){
  if(!R.active || R.bomb.state!=='planted' || R.bomb.exploded) return false;
  const bx=Number(R.bomb.x)||0,by=Number(R.bomb.y)||0;
  for(const p of (R.players||[])){
    if(!p.alive) continue;
    const d=Math.hypot(p.x-bx,p.y-by);
    if(d>270) continue;
    let dmg=500*Math.max(0,1-d/270);
    if(!hasLOS({x:bx,y:by,z:0},p)) dmg*=0.48;
    dmg=Math.max(0,Math.round(dmg));
    if(dmg<=0) continue;
    p.hp=Math.max(0,(Number(p.hp)||0)-dmg);
    p.lastHitType='C4 EXPLOSION';p.lastHitDamage=dmg;p.lastHitBy=null;
    if(p.hp<=0) killPlayer(p,null,'C4 EXPLOSION');
  }
  R.bomb.exploded=true;
  return true;
}

function canDefuse(ct){
  if(!ct?.alive || ct.team!=='CT' || R.bomb.state!=='planted') return false;
  const travel=dist(ct,R.bomb)/Math.max(0.0001,SPEED);
  return travel+DEFUSE_TIME < Number(R.bomb.timer||0);
}

function tryDefuse(ct,dt){
  if(!ct?.alive || ct.team!=='CT' || R.bomb.state!=='planted') return false;
  const near=dist(ct,R.bomb);
  const now=performance.now();
  if(ct.bombFakeUntil && now>=ct.bombFakeUntil){
    ct.bombFakeUntil=0;ct.isPlanting=false;ct.plantProgress=0;
  }
  if(near>28){
    if(ct.isPlanting){ct.isPlanting=false;ct.plantProgress=0;}
    return false;
  }
  if(!canDefuse(ct)){
    if(ct.isPlanting){ct.isPlanting=false;ct.plantProgress=0;}
    return false;
  }

  const other=(R.players||[]).some(p=>p!==ct&&p.alive&&p.team==='CT'&&p.isPlanting&&(!p.bombFakeUntil||p.bombFakeUntil<=now));
  if(other){
    if(!ct.bombFakeUntil){
      ct.bombFakeUntil=now+720;
      ct.isPlanting=true;ct.plantProgress=0;
      R.bombSounds.push({type:'fake-defuse',x:R.bomb.x,y:R.bomb.y,at:now});
    }
    return true;
  }

  if(!ct.isPlanting){
    ct.isPlanting=true;ct.plantProgress=0;
    R.bombSounds.push({type:'defuse',x:R.bomb.x,y:R.bomb.y,at:now,owner:ct.nick});
  }
  ct.plantProgress=(Number(ct.plantProgress)||0)+Math.max(0,Number(dt)||0);
  if(ct.plantProgress>=DEFUSE_TIME){
    ct.isPlanting=false;ct.plantProgress=0;ct.bombFakeUntil=0;
    R.bomb.state='defused';R.bomb.carrier=null;R.bomb.timer=0;R.bomb.exploded=false;
    R.killfeed.unshift({killer:ct.nick,killerTeam:'CT',victim:'★ C4 DEFUSED',victimTeam:'BOMB',wpn:'defuse'});
    if(R.killfeed.length>12) R.killfeed.pop();
    renderKillfeed();
    refreshPlayerObjectives(true);
    endRound('CT');
  }
  return true;
}

function tryInterruptDefuse(target){
  if(!target || !target.alive || target.team!=='CT') return false;
  if(!target.isPlanting) return false;
  target.isPlanting = false;
  target.plantProgress = 0;
  target.bombFakeUntil = 0;
  R.bombSounds.push({type:'defuse-stop', x:target.x, y:target.y, at:performance.now()});
  return true;
}

function bombAssignPostPlantAnchors(){
  if(!R.active || R.bomb.state!=='planted' || bombAnchorsAssignedRound===R.roundNum) return;
  const site=currentBombSite();
  const pool=site==='A'
    ? ['ninja','fire','adef','krisa','lavka']
    : ['peredB','zasita','bapps1','windowb','forest1'];
  const used=new Set(), anchors=[];
  for(const k of pool) if(WP[k] && !pointBlockedForMovement(WP[k].x,WP[k].y,WP[k].z||0)){used.add(k);anchors.push(k);}
  for(let i=0;i<5 && anchors.length<5;i++){
    const k=chooseSiteEntryWP(site,i,used,false);
    if(k && !used.has(k)){used.add(k);anchors.push(k);}
  }
  const ts=(R.players||[]).filter(p=>p.alive&&p.team==='T');
  ts.forEach((p,i)=>{
    p.postPlantAnchor=anchors[i%Math.max(1,anchors.length)]||findClosestWPTo(R.bomb.x,R.bomb.y,p.z);
    p.postPlantRole=i===0?'SITE_STOPPER':(i===4?'ANTI_FLANK':'CROSS_ANGLE');
  });
  bombAnchorsAssignedRound=R.roundNum;
}

let bombRolesRefreshAt=0;
let bombRolesSignature='';

function bombAssignRoles(){
  if(!R.active || R.bomb.state!=='planted') return;
  const cts=(R.players||[]).filter(p=>p.alive&&p.team==='CT');
  if(!cts.length) return;
  const now=performance.now();
  const signature=cts.map(p=>p.nick+':'+(p.isPlanting?1:0)).join('|');
  if(now-bombRolesRefreshAt<300 && signature===bombRolesSignature) return;
  bombRolesRefreshAt=now;
  bombRolesSignature=signature;

  let defuser=cts.find(p=>p.isPlanting && !p.bombFakeUntil && canDefuse(p));
  if(!defuser){
    const able=cts.filter(canDefuse).sort((a,b)=>dist(a,R.bomb)-dist(b,R.bomb));
    defuser=able[0]||null;
  }
  cts.forEach((p,i)=>{
    if(p===defuser){
      p.bombRole='DEFUSER';
      p.bombStage=chooseSiteEntryWP(currentBombSite(),(p.planSlot||0)%5,new Set(),false);
      p.bombEntry=currentBombSite()==='A'?'asite':'bsite';
      return;
    }
    if(!canDefuse(p)){
      p.bombRole='SAVE';
      return;
    }
    p.bombRole=(i%2===0)?'COVER':'FLANK';
    p.bombStage=chooseSiteEntryWP(currentBombSite(),((p.planSlot||0)+2)%5,new Set(),false);
    p.bombEntry=currentBombSite()==='A'?'asite':'bsite';
    p.bombCover=chooseSiteEntryWP(currentBombSite(),((p.planSlot||0)+1)%5,new Set(),false);
  });
}

function bombSaveAnchor(p){
  const candidates=['Aexit','goA','goB','mid','ctsp'];
  let best=null,score=-Infinity;
  for(const k of candidates){
    const w=WP[k];if(!w)continue;
    const d=Math.hypot(w.x-R.bomb.x,w.y-R.bomb.y);
    if(d<270) continue;
    const s=d-Math.hypot(w.x-p.x,w.y-p.y)*0.15;
    if(s>score){score=s;best=k;}
  }
  return best||findClosestWPTo(p.x,p.y,p.z);
}

function bombChooseObjective(p){
  if(!p?.alive) return null;
  if(p.team==='T'){
    if(R.bomb.state==='carried' && p.hasBomb)
      return chooseSiteEntryWP(R.tTargetSite,(p.planSlot||0)%5,new Set(),true) || (R.tTargetSite==='A'?'asite':'bsite');
    if(R.bomb.state==='carried' && R.bomb.carrier && R.bomb.carrier.isPlanting){
      if(!p.plantCoverAnchor || !WP[p.plantCoverAnchor]){
        p.plantCoverAnchor=chooseSiteEntryWP(R.tTargetSite,(p.planSlot||0)%5,new Set(),false)
          || findClosestWPTo(R.bomb.x,R.bomb.y,p.z);
      }
      return p.plantCoverAnchor;
    }
    if(R.bomb.state==='planted')
      return p.postPlantAnchor || chooseSiteEntryWP(currentBombSite(),(p.planSlot||0)%5,new Set(),false);
    return null;
  }
  if(R.bomb.state==='dropped'){
    const nearest=(R.players||[]).filter(q=>q.alive&&q.team==='T'&&!q.hasBomb)
      .sort((a,b)=>dist(a,R.bomb)-dist(b,R.bomb))[0];
    if(p!==nearest) return null;
    return findClosestWPTo(R.bomb.x,R.bomb.y,p.z);
  }
  if(R.bomb.state!=='planted') return null;
  const role=p.bombRole||'SAVE';
  if(role==='SAVE') return bombSaveAnchor(p);
  if(role==='DEFUSER'){
    if(p.bombStage && dist(p,WP[p.bombStage])>45) return p.bombStage;
    return p.bombEntry || (currentBombSite()==='A'?'asite':'bsite');
  }
  if(role==='FLANK') return p.bombStage || chooseSiteEntryWP(currentBombSite(),((p.planSlot||0)+3)%5,new Set(),false);
  return p.bombCover || chooseSiteEntryWP(currentBombSite(),((p.planSlot||0)+1)%5,new Set(),false);
}
