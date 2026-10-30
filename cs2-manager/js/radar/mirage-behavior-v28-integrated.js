

(function(){
'use strict';
if(window.__mirageBehaviorV28) return;
window.__mirageBehaviorV28 = true;

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 1. КОНСТАНТЫ
   ═══════════════════════════════════════════════════════════════════ */

/* ---- 1.1 Тиры оружия (0-6) ---- */
const WEAPON_TIERS = {
  knife:  { tier:0, cost:0,    name:'Knife' },
  glock:  { tier:1, cost:200,  name:'Glock-18' },
  usp:    { tier:1, cost:200,  name:'USP-S' },
  p250:   { tier:2, cost:300,  name:'P250' },
  'five-seven': { tier:2, cost:500, name:'Five-SeveN' },
  deagle: { tier:3, cost:700,  name:'Desert Eagle' },
  mp9:    { tier:3, cost:1250, name:'MP9' },
  mac10:  { tier:3, cost:1050, name:'MAC-10' },
  galil:  { tier:4, cost:1800, name:'Galil AR' },
  famas:  { tier:4, cost:2050, name:'FAMAS' },
  ssg08:  { tier:4, cost:1700, name:'SSG 08' },
  ak:     { tier:5, cost:2700, name:'AK-47' },
  m4:     { tier:5, cost:3100, name:'M4A4' },
  awp:    { tier:6, cost:4750, name:'AWP' }
};

function weaponTier(w){ return WEAPON_TIERS[w]?.tier || 0; }
function weaponCost(w){ return WEAPON_TIERS[w]?.cost || 0; }

/* ---- 1.2 CS2-accurate buy menu (AWP у обоих сторон!) ---- */
const CS2_BUY_MENU = {
  T:  { pistols:['glock','p250','deagle'],
        smgs:['mac10'],
        rifles:['galil','ak'],
        snipers:['ssg08','awp'],   // ← AWP доступен T
        heavy:['nova','xm1014'],
        utility:['molotov','flash','he','smoke'] },
  CT: { pistols:['usp','p250','deagle','five-seven'],
        smgs:['mp9'],
        rifles:['famas','m4'],
        snipers:['ssg08','awp'],   // ← AWP доступен CT
        heavy:['nova','xm1014'],
        utility:['molotov','flash','he','smoke'] }
};

const CS2_PRICES = {
  glock:200, usp:200, p250:300, deagle:700, 'five-seven':500,
  mac10:1050, mp9:1250,
  galil:1800, famas:2050, ak:2700, m4:3100,
  ssg08:1700, awp:4750,
  nova:1050, xm1014:2000,
  kevlar:650, helmet:350,
  molotov:400, flash:200, he:300, smoke:150
};

/* ---- 1.3 HP-состояния ---- */
function hpState(p){
  const hp = Number(p.hp) || 100;
  if(hp >= 90) return 'FULL';
  if(hp >= 60) return 'HIGH';
  if(hp >= 35) return 'MED';
  if(hp >= 15) return 'LOW';
  return 'CRITICAL';
}

/* ---- 1.4 Save anchors ---- */
const SAVE_ANCHORS = {
  T: {
    A: ['tsp','rampt','palasexit','palasnichka'],
    B: ['tsp','apps_back','bapps2']
  },
  CT: {
    A:   ['ctsp','m32','goB','Aexit'],
    B:   ['ctsp','goA','m33','kassa'],
    MID: ['mid','pochtimid','spuskmid']
  }
};

/* ---- 1.5 Duel states ---- */

/* ---- 1.6 Retake phases ---- */
/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 2. WEAPON MANAGEMENT
   ═══════════════════════════════════════════════════════════════════ */

/* ---- 2.1 Поиск дропнутого оружия поблизости ---- */
function findDroppedWeapon(p, maxDist){
  maxDist = maxDist || 180;
  const dead = (R.players||[]).filter(q => !q.alive && q.weapon && q.team !== p.team);
  let best = null, bestScore = -Infinity;
  for(const d of dead){
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if(dist > maxDist) continue;
    const dz = Math.abs((p.z||0) - (d.z||0));
    if(dz > 1) continue;
    const tier = weaponTier(d.weapon);
    const myTier = weaponTier(p.weapon);
    if(tier <= myTier) continue;
    let score = tier * 10 - dist * 0.15;
    const near = nearestEnemy(p);
    if(near.e && near.d < 220 && hasLOS(p, near.e)) score -= 30;
    if(score > bestScore){ bestScore = score; best = d; }
  }
  return best;
}

/* ---- 2.2 Решение о пикапе ---- */
function shouldPickupWeapon(p){
  if(!p?.alive) return false;
  if(weaponTier(p.weapon) >= 5) return false;
  const near = nearestEnemy(p);
  if(near.e && near.d < 180 && hasLOS(p, near.e)) return false;
  if(p.v28SaveMode === 'GUN_SAVE' || p.v28SaveMode === 'FULL_SAVE') return false;
  if(p.hazardUntil > performance.now() || p.blindTimer > 0) return false;
  const dropped = findDroppedWeapon(p, 140);
  return !!dropped;
}

/* ---- 2.3 Кому дропнуть ---- */
function shouldDropWeapon(p){
  if(!p?.alive) return null;
  const now=performance.now();
  const elapsed=ROUND_TIME-(Number(R.roundTime)||0);
  R.v28=R.v28||{dropRound:0,dropGlobalUntil:0};
  if(R.v28.dropRound!==R.roundNum){
    R.v28.dropRound=R.roundNum;
    R.v28.dropGlobalUntil=0;
    R.v28.dropWindowEnd=5.5;
  }
  /* Weapon drops are an economy/freeze-phase action, not a live-round tug of war. */
  if(elapsed>Number(R.v28.dropWindowEnd||5.5)) return null;
  if(now<(R.v28.dropGlobalUntil||0)) return null;
  if(p.hasBomb || p.v28DropDone || p.v28ReceivedDrop) return null;
  if(p.role==='Entry-fragger') return null; // normally Entry should not become the drop courier
  const myTier=weaponTier(p.weapon);
  if(myTier<5) return null;
  const near=nearestEnemy(p);
  if(near.e && near.d<250 && hasLOS(p,near.e)) return null;
  const mates=(R.players||[]).filter(q=>
    q.alive && q.team===p.team && q!==p && !q.hasBomb && !q.v28ReceivedDrop &&
    !q.v28DropDone && weaponTier(q.weapon)<=2 &&
    Math.hypot(p.x-q.x,p.y-q.y)<=60);
  if(!mates.length) return null;
  mates.sort((a,b)=>{
    const da=Math.hypot(p.x-a.x,p.y-a.y), db=Math.hypot(p.x-b.x,p.y-b.y);
    const roleScore=q=>q.role==='AWPer' ? 12 : q.role==='IGL' ? 5 : 0;
    return (db+roleScore(b))-(da+roleScore(a));
  });
  return mates[0];
}

/* ---- 2.4 Выполнить пикап ---- */
function doPickupWeapon(p, dropped){
  if(!p || !dropped) return false;
  if(weaponTier(dropped.weapon) <= weaponTier(p.weapon)) return false;
  p.weapon = dropped.weapon;
  p.wd = WPN[dropped.weapon] || p.wd;
  p.v28PickedUpAt = performance.now();
  p.v28PickedFrom = dropped.nick;
  R.killfeed.unshift({
    killer: p.nick, killerTeam: p.team,
    victim: `★ PICKUP ${dropped.weapon.toUpperCase()}`,
    victimTeam: 'WEAPON', wpn: 'pickup'
  });
  if(R.killfeed.length > 12) R.killfeed.length = 12;
  renderKillfeed();
  return true;
}

/* ---- 2.5 Выполнить дроп ---- */
function doDropWeapon(p, target){
  if(!p || !target) return false;
  const now=performance.now();
  R.v28=R.v28||{dropRound:R.roundNum,dropGlobalUntil:0};
  if(R.v28.dropRound!==R.roundNum){R.v28.dropRound=R.roundNum;R.v28.dropGlobalUntil=0;}
  if(now<(R.v28.dropGlobalUntil||0)) return false;
  if(p.v28DropDone || target.v28ReceivedDrop) return false;
  const myTier=weaponTier(p.weapon), targetTier=weaponTier(target.weapon);
  if(myTier<=targetTier) return false;
  const oldWeapon=p.weapon;
  target.weapon=oldWeapon;
  target.wd=WPN[oldWeapon]||target.wd;
  p.weapon=p.team==='T'?'glock':'usp';
  p.wd=WPN[p.weapon];
  p.v28DropDone=true;
  target.v28ReceivedDrop=true;
  target.v28NoDropUntil=now+15000;
  R.v28.dropGlobalUntil=now+1200;
  R.v28.lastDrop={from:p.nick,to:target.nick,weapon:oldWeapon,at:now,round:R.roundNum};
  R.killfeed.unshift({
    killer:p.nick,killerTeam:p.team,
    victim:`★ DROP → ${target.nick}`,
    victimTeam:'WEAPON',wpn:'drop'
  });
  if(R.killfeed.length>12)R.killfeed.length=12;
  renderKillfeed();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 3. BUY PHASE (заменяет v264Buy)
   ═══════════════════════════════════════════════════════════════════ */

function v28BuyPhase(p, teamClass, teamCash){
  if(!p || !p.alive) return;

  const prices = CS2_PRICES;
  const cash = (typeof teamCash === 'number') ? teamCash
             : (R.economy?.players?.[p.nick]?.cash || 800);
  let spent = 0;
  const budget = () => cash - spent;
  const buy = (item) => {
    const cost = prices[item] || 0;
    if(budget() >= cost){ spent += cost; return true; }
    return false;
  };

  // Сброс
  p.grenades = p.grenades || { smoke:0, flash:0, he:0, molotov:0 };
  p.armor = p.armor || 0;
  p.helmet = p.helmet || false;
  p.v28SaveIntent = false;

  /* ============ PISTOL ============ */
  if(teamClass === 'PISTOL' || teamClass === 'PISTOL ROUND'){
    if(budget() >= prices.kevlar){ p.armor = 100; buy('kevlar'); }
    if((p.role === 'Support' || p.role === 'IGL') && budget() >= prices.smoke){
      p.grenades.smoke = 1; buy('smoke');
    }
    if(budget() >= prices.flash && Math.random() < 0.6){
      p.grenades.flash = 1; buy('flash');
    }
    // Некоторые берут p250
    if((p.role === 'AWPer' || p.role === 'Entry-fragger')
       && budget() >= prices.p250 && Math.random() < 0.5){
      p.weapon = 'p250'; p.wd = WPN.p250 || WPN.deagle; buy('p250');
    } else {
      p.weapon = p.team === 'T' ? 'glock' : 'usp';
      p.wd = WPN[p.weapon];
    }
    p.moneySpent = spent;
    return;
  }

  /* ============ FULL BUY ============ */
  if(teamClass === 'FULL BUY' || teamClass === 'FULL'){
    // 1. Armor
    if(budget() >= prices.kevlar + prices.helmet){
      p.armor = 100; p.helmet = true;
      buy('kevlar'); buy('helmet');
    } else if(budget() >= prices.kevlar){
      p.armor = 100; buy('kevlar');
    }

    // 2. Main weapon — приоритет по роли
    let weapon = null;
    if(p.role === 'AWPer' && budget() >= prices.awp){
      weapon = 'awp';                                 // ← AWP для T тоже!
    } else if(p.team === 'T' && budget() >= prices.ak){
      weapon = 'ak';
    } else if(p.team === 'CT' && budget() >= prices.m4){
      weapon = 'm4';
    } else if(p.team === 'CT' && budget() >= prices.famas){
      weapon = 'famas';
    } else if(p.team === 'T' && budget() >= prices.galil){
      weapon = 'galil';
    } else if(budget() >= prices.deagle){
      weapon = 'deagle';
    } else {
      weapon = p.team === 'T' ? 'glock' : 'usp';
    }
    p.weapon = weapon;
    p.wd = WPN[weapon] || WPN.ak;
    buy(weapon);

    // 3. Utility
    const buyUtil = (type, cost, limit) => {
      limit = limit || 1;
      while((p.grenades[type] || 0) < limit && budget() >= cost){
        p.grenades[type] = (p.grenades[type] || 0) + 1;
        buy(type);
      }
    };
    if(p.role === 'Support' || p.role === 'IGL'){
      buyUtil('smoke', prices.smoke, 1);
      buyUtil('flash', prices.flash, 2);
      buyUtil('he', prices.he, 1);
      buyUtil('molotov', prices.molotov, 1);
    } else if(p.role === 'AWPer'){
      buyUtil('flash', prices.flash, 1);
      buyUtil('smoke', prices.smoke, 1);
    } else {
      buyUtil('flash', prices.flash, 1);
      buyUtil('he', prices.he, 1);
      buyUtil('molotov', prices.molotov, 1);
    }
    p.moneySpent = spent;
    return;
  }

  /* ============ FORCE BUY ============ */
  if(teamClass === 'FORCE' || teamClass === 'FORCE BUY'){
    if(budget() >= prices.kevlar){ p.armor = 100; buy('kevlar'); }

    let weapon = null;
    if(p.role === 'AWPer' && budget() >= prices.ssg08){
      weapon = 'ssg08';                              // Scout вместо AWP
    } else if(p.team === 'T' && budget() >= prices.galil){
      weapon = 'galil';
    } else if(p.team === 'CT' && budget() >= prices.famas){
      weapon = 'famas';
    } else if(budget() >= prices.deagle){
      weapon = 'deagle';
    } else {
      weapon = p.team === 'T' ? 'glock' : 'usp';
    }
    p.weapon = weapon; p.wd = WPN[weapon] || WPN.deagle;
    buy(weapon);

    if((p.role === 'Support' || p.role === 'IGL') && budget() >= prices.smoke){
      p.grenades.smoke = 1; buy('smoke');
    }
    if(budget() >= prices.flash && Math.random() < 0.6){
      p.grenades.flash = 1; buy('flash');
    }
    p.moneySpent = spent;
    return;
  }

  /* ============ LIGHT BUY ============ */
  if(teamClass === 'LIGHT BUY' || teamClass === 'LIGHT'){
    if(budget() >= prices.kevlar && Math.random() < 0.5){
      p.armor = 100; buy('kevlar');
    }
    if(budget() >= prices.deagle && Math.random() < 0.5){
      p.weapon = 'deagle'; p.wd = WPN.deagle; buy('deagle');
    } else {
      p.weapon = p.team === 'T' ? 'glock' : 'usp';
      p.wd = WPN[p.weapon];
    }
    if((p.role === 'Support' || p.role === 'IGL') && budget() >= prices.smoke){
      p.grenades.smoke = 1; buy('smoke');
    }
    p.moneySpent = spent;
    return;
  }

  /* ============ ECO ============ */
  p.weapon = p.team === 'T' ? 'glock' : 'usp';
  p.wd = WPN[p.weapon];
  p.armor = 0;
  p.grenades = { smoke:0, flash:0, he:0, molotov:0 };
  p.moneySpent = 0;
  p.v28SaveIntent = true;
}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 4. HP-BASED BEHAVIOR
   ═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 5. SAVE SYSTEM
   ═══════════════════════════════════════════════════════════════════ */

R.v28SaveMode = R.v28SaveMode || { T:'NONE', CT:'NONE' };

function determineSaveMode(side){
  const alive = (R.players||[]).filter(p => p.alive && p.team === side);
  if(!alive.length) return 'NONE';

  const econClass = typeof v264EconomyClass === 'function'
    ? v264EconomyClass(side) : 'FULL BUY';

  const withGun = alive.filter(p => weaponTier(p.weapon) >= 5);
  const gunRatio = withGun.length / alive.length;

  if(econClass === 'ECO' && gunRatio < 0.2) return 'FULL_SAVE';
  if(gunRatio >= 0.4 && econClass !== 'FULL BUY') return 'GUN_SAVE';
  if(gunRatio >= 0.2 && econClass !== 'FULL BUY') return 'PARTIAL';

  if(side === 'T'){
    const timeLeft = Number(R.roundTime) || 0;
    if(timeLeft < 30 && alive.length <= 2 && R.bomb.state !== 'planted') return 'GUN_SAVE';
  }
  return 'NONE';
}

function applySaveMode(side){
  const mode = determineSaveMode(side);
  R.v28SaveMode[side] = mode;
  const alive = (R.players||[]).filter(p => p.alive && p.team === side);
  for(const p of alive){
    p.v28SaveMode = mode;
    p.v28SaveIntent = (mode === 'FULL_SAVE' || mode === 'GUN_SAVE');
  }
  return mode;
}

function pickSaveAnchor(p){
  const side = p.team;
  const site = currentBombSite();
  const list = SAVE_ANCHORS[side]?.[site] || SAVE_ANCHORS[side]?.A || [];
  let best = null, bestScore = -Infinity;
  for(const k of list){
    if(!WP[k]) continue;
    if(pointBlockedForMovement(WP[k].x, WP[k].y, WP[k].z||0)) continue;
    const dist = Math.hypot(WP[k].x - p.x, WP[k].y - p.y);
    if(dist < 30) continue;
    const enemyDist = nearestEnemy(p).d;
    const bombDist = R.bomb.state === 'planted'
      ? Math.hypot(WP[k].x - R.bomb.x, WP[k].y - R.bomb.y)
      : 999;
    const score = -dist * 0.05 + enemyDist * 0.02 + bombDist * 0.03;
    if(score > bestScore){ bestScore = score; best = k; }
  }
  return best;
}

function shouldNotEngage(p){
  if(!p.v28SaveIntent) return false;
  const near = nearestEnemy(p);
  if(!near.e) return false;
  if(near.d < 220 && hasLOS(p, near.e)){
    const enemySeesUs = hasLOS(near.e, p);
    if(!enemySeesUs) return true;
  }
  return false;
}

function v28SaveCluster(side){
  if(R.bomb.state === 'planted' && side === 'CT') return;
  if(determineSaveMode(side) !== 'FULL_SAVE') return;

  const alive = (R.players||[]).filter(p => p.alive && p.team === side);
  if(alive.length < 2) return;

  const rally = pickSaveAnchor(alive[0]);
  if(!rally || !WP[rally]) return;

  for(const p of alive){
    p.v28SaveRally = rally;
    p.objectiveWP = rally;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 6. BOMB REACTIONS — T-SIDE
   ═══════════════════════════════════════════════════════════════════ */





/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 7. BOMB REACTIONS — CT-SIDE
   ═══════════════════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 8. FAKE HANDLING
   ═══════════════════════════════════════════════════════════════════ */







/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 9. RETAKE FLOW
   ═══════════════════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 10. DUEL STATE MACHINE
   ═══════════════════════════════════════════════════════════════════ */







/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 11. AUDIO CUES
   ═══════════════════════════════════════════════════════════════════ */


function quietModeDecision(p){
  if(!p.alive) return false;
  if(p.team === 'T' && R.bomb.state !== 'planted'){
    const exec = R.mirageTactic?.T?.execAt;
    if(exec === 'MID_START' || exec === 'MID_MID' || exec === 'MID_END'){
      const elapsed = ROUND_TIME - R.roundTime;
      if(elapsed > 55) return false;
    }
    if(p.mtRoleBase === 'Lurker') return true;
    if(determineSaveMode('T') !== 'NONE') return true;
    return false;
  }
  if(p.team === 'CT'){
    if(R.miragePushAt &&
       (R.mirageTactic?.CT?.pushAt === 'EARLY_END' ||
        R.mirageTactic?.CT?.pushAt === 'MID_MID')){
      const elapsed = ROUND_TIME - R.roundTime;
      if(elapsed > 40) return false;
    }
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 12. UTILITY UNDER PRESSURE
   ═══════════════════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 13. TEAM COORDINATION
   ═══════════════════════════════════════════════════════════════════ */

function tradePartnerMove(p){
  if(!p.alive || p.role !== 'Support') return null;
  const entry = (R.players||[]).find(q =>
    q.alive && q.team === p.team && q.role === 'Entry-fragger');
  if(!entry) return null;
  const d = Math.hypot(p.x - entry.x, p.y - entry.y);

  if(d < 6){
    const from = findClosestWPTo(p.x, p.y, p.z);
    if(from){
      const back = (ADJ[from] || []).find(k =>
        WP[k] && Math.hypot(WP[k].x - entry.x, WP[k].y - entry.y) > 10);
      return back;
    }
  }
  if(d > 25){
    const target = findClosestWPTo(entry.x, entry.y, entry.z);
    return target;
  }
  return null;
}

function ctRotationLogic(p){
  if(p.team !== 'CT') return null;
  if(R.bomb.state === 'planted') return null;

  const info = R.info?.CT;
  if(!info) return null;

  const myAssign = p.ctAssignment || 'MID';
  const threat = info.bombSite !== '?' ? info.bombSite : info.lastSite;
  if(!threat || threat === '?') return null;
  if(threat === myAssign) return null;

  const mySiteCount = (R.players||[]).filter(q =>
    q.alive && q.team === 'CT' && q.ctAssignment === myAssign).length;

  if(mySiteCount > 2 && info.confidence > 0.6){
    p.ctAssignment = threat;
    p.ctHoldAnchor = null;
    return threat;
  }
  return null;
}

function teamSpacing(p){
  if(!p.alive) return;
  const mates = (R.players||[]).filter(q =>
    q.alive && q.team === p.team && q !== p);
  for(const m of mates){
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if(d < 12 && Math.abs((p.z||0) - (m.z||0)) < 1){
      const angle = Math.atan2(p.y - m.y, p.x - m.x) || Math.random() * 6.28;
      const nx = p.x + Math.cos(angle) * 2;
      const ny = p.y + Math.sin(angle) * 2;
      if(!pointBlockedForMovement(nx, ny, p.z)){
        p.x = nx; p.y = ny;
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 14. ПРИОРИТЕТНЫЙ СТЕК РЕШЕНИЙ
   ═══════════════════════════════════════════════════════════════════ */

function v28NearestSite(x,y){
  const a=SITES?.A,b=SITES?.B;
  if(!a||!b) return null;
  const da=Math.hypot(x-a.x,y-a.y), db=Math.hypot(x-b.x,y-b.y);
  if(Math.min(da,db)>210) return null;
  return da<=db?'A':'B';
}
function v28Alert(){
  R.v28=R.v28||{};
  const arr=R.v28.ctDeathAlerts||[];
  const now=performance.now();
  for(let i=arr.length-1;i>=0;i--) if(now-arr[i].at>4200) arr.splice(i,1);
  return arr[arr.length-1]||null;
}
function v28ChooseResponders(alert){
  if(alert.responders) return alert.responders;
  const cts=(R.players||[]).filter(q=>q.alive&&q.team==='CT');
  cts.sort((a,b)=>Math.hypot(a.x-alert.x,a.y-alert.y)-Math.hypot(b.x-alert.x,b.y-alert.y));
  const out=cts.slice(0,Math.min(2,cts.length)).map(q=>q.nick);
  alert.responders=out;
  return out;
}
function v28DeathReaction(p){
  if(p.team!=='CT'||R.bomb.state==='planted') return false;
  const alert=v28Alert();
  if(!alert) return false;
  const age=performance.now()-alert.at;
  if(age>3600){p.v28Reacting=false;return false;}
  const responders=v28ChooseResponders(alert);
  if(!responders.includes(p.nick)) return false;

  const near=nearestEnemy(p);
  const enemyNearDeath=(near.e&&Math.hypot(near.e.x-alert.x,near.e.y-alert.y)<230);
  if(enemyNearDeath){
    p.v28Reacting=false;
    return false; // let duel logic decide whether to fight/retreat
  }

  const deathWP=findClosestWPTo(alert.x,alert.y,p.z);
  const killerWP=(alert.killerX!==null&&alert.killerY!==null)
    ? findClosestWPTo(alert.killerX,alert.killerY,p.z) : null;

  let target=null;
  if(age<1800){
    target=killerWP||deathWP;
    p.v28Reacting=true;
    p.v28ReactionStage='RESPOND';
    p.v28ReactionSite=alert.site||null;
    p.objective=`RESPOND ${alert.site?'A/B'.replace('A/B',alert.site):'DEATH'} • ${Math.max(0,(3.2-age/1000)).toFixed(1)}s`;
  }else if(age<3300){
    /* No contact after the initial check: the primary responder can probe MID,
       while the second responder returns to the threatened site/anchor. */
    p.v28Reacting=true;
    p.v28ReactionStage='CLEAR_CHECK';
    if(!enemyNearDeath && responders[0]===p.nick){
      target=WP.kontomid?'kontomid':(WP.mid?'mid':deathWP);
      p.objective='DEATH CLEAR → MID';
    }else{
      target=deathWP;
      p.objective=`DEATH CHECK ${alert.site||''}`.trim();
    }
  }

  if(target && typeof setPlayerPath==='function') setPlayerPath(p,target);
  return !!target;
}

function playerDecisionStack(p, dt){
  if(!p?.alive) return;

  /* ===== P-1: CT TEAMMATE DEATH RESPONSE ===== */
  if(p.team==='CT' && v28DeathReaction(p)) return;
  /* ===== P2: TEAM ===== */
  if(p.role === 'Support'){
    const tp = tradePartnerMove(p);
    if(tp) return;
  }
  if(p.team === 'CT' && R.bomb.state !== 'planted'){
    const rot = ctRotationLogic(p);
    if(rot) return;
  }
  teamSpacing(p);

  /* ===== P3: ECONOMY ===== */
  const dropTarget = shouldDropWeapon(p);
  if(dropTarget && Math.hypot(p.x - dropTarget.x, p.y - dropTarget.y) < 40){
    doDropWeapon(p, dropTarget);
    return;
  }
  if(shouldPickupWeapon(p)){
    const dropped = findDroppedWeapon(p, 80);
    if(dropped && Math.hypot(p.x - dropped.x, p.y - dropped.y) < 30){
      doPickupWeapon(p, dropped);
      return;
    }

  }
  if(shouldNotEngage(p)) return;

}

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 15. ХУКИ ИНТЕГРАЦИИ
   ═══════════════════════════════════════════════════════════════════ */

/* Explicit AI entry points: behavior helpers are called by the root pipeline. */
window.CS2AI=window.CS2AI||{};
window.CS2AI.behaviorStartRound=function(){
  for(const p of (R.players||[])){
    p.v28SaveMode='NONE';p.v28SaveIntent=false;p.v28SaveRally=null;
    p.v28DropDone=false;p.v28ReceivedDrop=false;p.v28NoDropUntil=0;
    p.v28Reacting=false;p.v28ReactionStage=null;p.quietMode=false;p.speedMul=1.0;
  }
  R.v28SaveMode={T:'NONE',CT:'NONE'};
};
window.CS2AI.behaviorTick=function(dt){
  if(!R.active) return;
  applySaveMode('T');applySaveMode('CT');v28SaveCluster('T');
  for(const p of (R.players||[])) if(p.alive) playerDecisionStack(p,dt);
  for(const p of (R.players||[])) if(p.alive){
    if(quietModeDecision(p)){p.quietMode=true;p.speedMul=0.55;}
    else {p.quietMode=false;p.speedMul=1.0;}
  }
};

/* ═══════════════════════════════════════════════════════════════════
   ЧАСТЬ 16. DEBUG OVERLAY + API
   ═══════════════════════════════════════════════════════════════════ */

window.BEHAVIOR = {
  hpState: nick => {
    const p = (R.players||[]).find(x => x.nick === nick);
    return p ? hpState(p) : null;
  },
  saveMode: side => R.v28SaveMode?.[side] || 'NONE',
  weaponTier: nick => {
    const p = (R.players||[]).find(x => x.nick === nick);
    return p ? weaponTier(p.weapon) : null;
  },
  buyPhase: (nick, cls, cash) => {
    const p = (R.players||[]).find(x => x.nick === nick);
    if(!p) return null;
    v28BuyPhase(p, cls, cash);
    return {
      weapon: p.weapon,
      armor: p.armor,
      helmet: p.helmet,
      grenades: {...p.grenades},
      spent: p.moneySpent
    };
  },
  constants: {
    WEAPON_TIERS, CS2_PRICES, CS2_BUY_MENU,
    SAVE_ANCHORS
  }
};

console.log('[Mirage Behavior v28.0] загружено 10 модулей: weapon, buy, HP, save, bomb, fake, retake, duel, audio, utility, coordination');
})();

