
(function(){
'use strict';
if(window.__cs2RadarV279FullInstalled) return;
window.__cs2RadarV279FullInstalled=true;

/* ============================================================
 * v27.9 — FULL MIRAGE TACTICAL PACKAGE
 * Source package integrated:
 *   - 20 T-side tactics
 *   - 20 CT-side tactics
 *   - style counter matrix
 *   - round-context bias
 *   - score-aware bias
 *   - player-level style bonuses
 *   - tactic memory
 *   - tactic frequency / anti-repeat
 *   - role-aware routing
 *   - timed utility queue
 *   - AWPer evac
 *   - CT save cluster
 *   - stable movement / wall-aware recovery
 *
 * This layer is the single tactical playbook while preserving role editor + economy core.
 * ============================================================ */

const V279 = {
  version:'27.9',
  phaseMap:{
    EARLY_END:7.5,
    MID_START:10.0,
    MID_MID:13.0,
    MID_END:17.0,
    RANDOM:15.5
  },
  move:{
    sampleMs:260,
    softMs:650,
    hardMs:1350,
    rerouteMs:900,
    trafficMs:220,
    minMove:0.55,
    pairGap:17.4,
    maxPush:2.1
  }
};

R.v279 = R.v279 || {
  tTactic:null, ctTactic:null, tStyle:null, ctStyle:null,
  roundKey:'', tacticMemory:{}, tacticFrequency:{T:{},CT:{}},
  nadeQueue:[], lastNadeRound:-1, lastNadeAt:0, trafficAt:0,
  overlayAt:0, recentSelectionAt:0
};

function v279Alive(side){
  const ps = R.players || [];
  return side ? ps.filter(p => p.alive && p.team === side) : ps.filter(p => p.alive);
}

const V279_STYLE_COUNTERS = {
  T:{
    Aggressive:{strongVs:'Tactical',weakVs:'Discipline',bonus:0.14},
    Tactical:{strongVs:'Discipline',weakVs:'Aggressive',bonus:0.14},
    Discipline:{strongVs:'Chaos',weakVs:'Tactical',bonus:0.14},
    Chaos:{strongVs:'Aggressive',weakVs:'Discipline',bonus:0.14}
  },
  CT:{
    Aggressive:{strongVs:'Tactical',weakVs:'Discipline',bonus:0.14},
    Tactical:{strongVs:'Discipline',weakVs:'Aggressive',bonus:0.14},
    Discipline:{strongVs:'Chaos',weakVs:'Tactical',bonus:0.14},
    Chaos:{strongVs:'Aggressive',weakVs:'Discipline',bonus:0.14}
  }
};
const V279_ROUND_CONTEXT_BIAS = {
  pistol:{Aggressive:1.20,Discipline:0.85,Tactical:1.05,Chaos:1.10},
  eco:{Aggressive:1.25,Discipline:1.05,Tactical:0.80,Chaos:1.15},
  force:{Aggressive:1.15,Discipline:0.95,Tactical:1.00,Chaos:1.10},
  fullBuy:{Aggressive:0.90,Discipline:1.20,Tactical:1.15,Chaos:0.85},
  save:{Aggressive:0.70,Discipline:0.85,Tactical:0.90,Chaos:1.05},
  antiEco:{Aggressive:0.85,Discipline:1.25,Tactical:1.20,Chaos:0.90}
};
const V279_PLAYER_STYLE_BONUS = {
  'Snax':{Discipline:0.05},
  'Jame':{Tactical:0.04},
  'arT':{Aggressive:0.06},
  'NiKo':{Aggressive:0.02,Tactical:0.02,Discipline:0.02,Chaos:0.02},
  'karrigan':{Tactical:0.05},
  'FalleN':{Discipline:0.03},
  'donk':{Aggressive:0.05},
  'ZywOo':{Aggressive:0.03,Tactical:0.03,Discipline:0.03,Chaos:0.03},
  'apEX':{Tactical:0.04}
};

const V279_T_TACTICS =  {
  Aggressive: [
    { id:'A_TRAIN', name:'A-Train',
      setup:{ IGL:'palace', AWPer:'ramp_1', Entry:'ramp_entry', Support:'ramp_support', Lurker:'ramp_4' },
      keyUtil:['t_smoke_jungle','t_smoke_ct_a','t_molly_ninja','t_flash_ramp','t_flash_palace'],
      execAt:'EARLY_END', postPlant:'TIGHT', defuseStopPriority:0.85,
      strongVs:'CT_Tactical', weakVs:'CT_Discipline' },
    { id:'B_BLAST', name:'B-Blast',
      setup:{ IGL:'apps_1', AWPer:'apps_back', Entry:'apps_entry', Support:'apps_support', Lurker:'bapps_deep' },
      keyUtil:['t_smoke_windowb','t_smoke_kitchen','t_molly_van','t_flash_apps_entry','t_flash_b_site'],
      execAt:'EARLY_END', postPlant:'TIGHT', defuseStopPriority:0.85,
      strongVs:'CT_Tactical', weakVs:'CT_Discipline' },
    { id:'MID_DASH', name:'Mid-Dash',
      setup:{ IGL:'mid_anchor', AWPer:'mid_back', Entry:'mid_entry', Support:'mid_support', Lurker:'palace_1' },
      keyUtil:['t_smoke_window','t_flash_topmid','t_molly_connector','t_smoke_connector'],
      execAt:'EARLY_END', postPlant:'CROSS', defuseStopPriority:0.70,
      strongVs:'CT_Discipline', weakVs:'CT_Aggressive' },
    { id:'PALACE_SHOW_B', name:'Palace Show → B',
      setup:{ IGL:'palace_1', AWPer:'palace_2', Entry:'palace_3', Support:'apps_fast', Lurker:'mid_watch' },
      keyUtil:['t_smoke_jungle','t_flash_palace','t_smoke_windowb'],
      execAt:'MID_MID', postPlant:'SANDWICH', defuseStopPriority:0.65,
      strongVs:'CT_Discipline', weakVs:'CT_Tactical' },
    { id:'DOUBLE_MID', name:'Double Mid',
      setup:{ IGL:'mid_1', AWPer:'mid_2', Entry:'rotate_a', Support:'rotate_b', Lurker:'apps_watch' },
      keyUtil:['t_smoke_connector','t_flash_jungle','t_molly_ninja','t_smoke_windowb'],
      execAt:'MID_START', postPlant:'SCATTER', defuseStopPriority:0.45,
      strongVs:'CT_Chaos', weakVs:'CT_Discipline' }
  ],
  Discipline: [
    { id:'DEFAULT_40', name:'Default 40s',
      setup:{ IGL:'mid_anchor', AWPer:'mid_back', Entry:'apps_1', Support:'apps_2', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_window','t_smoke_kitchen','t_flash_topmid','t_molly_van'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.55,
      strongVs:'CT_Chaos', weakVs:'CT_Tactical' },
    { id:'MID_SLOW_SPLIT', name:'Mid Slow Split',
      setup:{ IGL:'mid_1', AWPer:'mid_2', Entry:'ramp_entry', Support:'ramp_support', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_connector','t_smoke_jungle','t_smoke_ct_a','t_molly_ninja'],
      execAt:'MID_END', postPlant:'SANDWICH', defuseStopPriority:0.60,
      strongVs:'CT_Chaos', weakVs:'CT_Tactical' },
    { id:'B_SHORT_SPLIT', name:'B Split via Short',
      setup:{ IGL:'mid_short', AWPer:'mid_back', Entry:'apps_entry', Support:'apps_support', Lurker:'apps_back' },
      keyUtil:['t_smoke_windowb','t_smoke_kitchen','t_molly_van','t_flash_b_site'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.55,
      strongVs:'CT_Aggressive', weakVs:'CT_Tactical' },
    { id:'PALACE_RAMP_HIT', name:'Palace Hold + Ramp Hit',
      setup:{ IGL:'palace_1', AWPer:'palace_2', Entry:'ramp_entry', Support:'ramp_support', Lurker:'mid_watch' },
      keyUtil:['t_molly_palace','t_smoke_jungle','t_flash_ramp','t_smoke_stairs'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.55,
      strongVs:'CT_Tactical', weakVs:'CT_Aggressive' },
    { id:'LURK_FIRST_A', name:'Lurk-First A',
      setup:{ IGL:'mid_1', AWPer:'mid_2', Entry:'ramp_entry', Support:'ramp_support', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_jungle','t_smoke_ct_a','t_flash_ramp','t_molly_ninja'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.60,
      strongVs:'CT_Aggressive', weakVs:'CT_Tactical' }
  ],
  Tactical: [
    { id:'CLASSIC_MID', name:'Classic Mid Control',
      setup:{ IGL:'mid_1', AWPer:'mid_2', Entry:'ramp_entry', Support:'ramp_support', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_jungle','t_smoke_ct_a','t_smoke_connector','t_molly_ninja','t_flash_ramp'],
      execAt:'MID_MID', postPlant:'SANDWICH', defuseStopPriority:0.70,
      strongVs:'CT_Discipline', weakVs:'CT_Aggressive' },
    { id:'DOUBLE_FAKE', name:'Double Fake → Mid',
      setup:{ IGL:'mid_1', AWPer:'mid_2', Entry:'palace_1', Support:'apps_1', Lurker:'apps_2' },
      keyUtil:['t_smoke_window','t_smoke_connector','t_smoke_jungle','t_flash_palace','t_flash_apps_entry'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.60,
      strongVs:'CT_Aggressive', weakVs:'CT_Discipline' },
    { id:'CONNECTOR_CUT', name:'Connector Cut → A Speed',
      setup:{ IGL:'mid_1', AWPer:'mid_back', Entry:'ramp_entry', Support:'ramp_support', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_connector','t_smoke_jungle','t_molly_ninja','t_flash_ramp'],
      execAt:'MID_START', postPlant:'TIGHT', defuseStopPriority:0.75,
      strongVs:'CT_Discipline', weakVs:'CT_Aggressive' },
    { id:'LURK_INFO_EXEC', name:'Lurk Info → Execute',
      setup:{ IGL:'mid_1', AWPer:'mid_back', Entry:'ramp_entry', Support:'ramp_support', Lurker:'palace_lurk' },
      keyUtil:['t_smoke_jungle','t_molly_ninja','t_flash_ramp','t_smoke_window'],
      execAt:'MID_MID', postPlant:'SANDWICH', defuseStopPriority:0.65,
      strongVs:'CT_Chaos', weakVs:'CT_Aggressive' },
    { id:'WINDOW_DENY_B', name:'Window Denial → B Slow',
      setup:{ IGL:'mid_short', AWPer:'mid_2', Entry:'apps_entry', Support:'apps_support', Lurker:'apps_lurk' },
      keyUtil:['t_smoke_windowb','t_molly_kitchen','t_smoke_kitchen','t_flash_apps_entry'],
      execAt:'MID_END', postPlant:'CROSS', defuseStopPriority:0.55,
      strongVs:'CT_Aggressive', weakVs:'CT_Discipline' }
  ],
  Chaos: [
    { id:'FULL_RANDOM', name:'Full Random',
      setup:{ IGL:'random', AWPer:'random', Entry:'random', Support:'random', Lurker:'random' },
      keyUtil:['t_smoke_jungle','t_smoke_windowb'],
      execAt:'RANDOM', postPlant:'SCATTER', defuseStopPriority:0.40,
      strongVs:'CT_Aggressive', weakVs:'CT_Discipline' },
    { id:'PUG_PICKS', name:'Pug Picks',
      setup:{ IGL:'self', AWPer:'self', Entry:'self', Support:'self', Lurker:'self' },
      keyUtil:[], execAt:'RANDOM', postPlant:'SCATTER', defuseStopPriority:0.30,
      strongVs:'CT_Tactical', weakVs:'CT_Discipline' },
    { id:'SCATTER_SPLIT', name:'Scatter Split',
      setup:{ IGL:'mid_watch', AWPer:'a_side', Entry:'b_side', Support:'a_back', Lurker:'b_back' },
      keyUtil:['t_smoke_jungle','t_smoke_windowb'],
      execAt:'MID_MID', postPlant:'SCATTER', defuseStopPriority:0.45,
      strongVs:'CT_Aggressive', weakVs:'CT_Discipline' },
    { id:'LATE_20S', name:'Late 20s Rush',
      setup:{ IGL:'back_all', AWPer:'back_all', Entry:'back_all', Support:'back_all', Lurker:'back_all' },
      keyUtil:['t_smoke_jungle','t_smoke_ct_a','t_flash_ramp'],
      execAt:'MID_MID', postPlant:'TIGHT', defuseStopPriority:0.75,
      strongVs:'CT_Discipline', weakVs:'CT_Aggressive' },
    { id:'INDIV_RUSH', name:'Individual Rush',
      setup:{ IGL:'solo', AWPer:'solo', Entry:'solo', Support:'solo', Lurker:'solo' },
      keyUtil:[], execAt:'EARLY_END', postPlant:'SCATTER', defuseStopPriority:0.35,
      strongVs:'CT_Tactical', weakVs:'CT_Discipline' }
  ]
};
const V279_CT_TACTICS =  {
  Aggressive: [
    { id:'MID_DOUBLE', name:'Mid Double Push',
      setup:{ A:['ctjungle','ticket'], B:['windowb'], MID:['windowb_ct','connector'] },
      keyUtil:['ct_smoke_topmid','ct_flash_mid','ct_smoke_connector'],
      pushAt:'MID_MID', retakeStyle:'RUSH', saveBias:0.25, fakeDefuseBias:0.60,
      strongVs:'T_Tactical', weakVs:'T_Discipline' },
    { id:'WINDOW_FLANK', name:'Window Flank A',
      setup:{ A:['jungle','stairs'], B:['peredB'], MID:['windowb'] },
      keyUtil:['ct_molly_ramp','ct_flash_retake_a'],
      pushAt:'EARLY_END', retakeStyle:'RUSH', saveBias:0.25, fakeDefuseBias:0.60,
      strongVs:'T_Tactical', weakVs:'T_Discipline' },
    { id:'B_APPS_PUSH', name:'B Apps Counter-Push',
      setup:{ A:['ctjungle','ticket'], B:['bapps1','windowb'], MID:['mid'] },
      keyUtil:['ct_smoke_apps','ct_molly_bapps'],
      pushAt:'EARLY_END', retakeStyle:'RUSH', saveBias:0.25, fakeDefuseBias:0.55,
      strongVs:'T_Tactical', weakVs:'T_Discipline' },
    { id:'AGGRO_TRADES', name:'Aggro Trades',
      setup:{ A:['fire','adef'], B:['peredB','naB'], MID:['windowb'] },
      keyUtil:['ct_smoke_backline','ct_flash_retake_a','ct_flash_retake_b'],
      pushAt:null, retakeStyle:'BRAWL', saveBias:0.20, fakeDefuseBias:0.45,
      strongVs:'T_Tactical', weakVs:'T_Discipline' },
    { id:'DOUBLE_MID_RT', name:'Double Mid + Rotate',
      setup:{ A:['ctjungle'], B:['peredB'], MID:['windowb','connector'] },
      keyUtil:['ct_smoke_topmid','ct_flash_mid'],
      pushAt:'EARLY_END', retakeStyle:'RUSH', saveBias:0.30, fakeDefuseBias:0.50,
      strongVs:'T_Tactical', weakVs:'T_Discipline' }
  ],
  Discipline: [
    { id:'STANDARD_212', name:'Standard 2-1-2',
      setup:{ A:['jungle','ct'], B:['window','van'], MID:['okno'] },
      keyUtil:['ct_smoke_topmid','ct_molly_bapps','ct_molly_ramp'],
      pushAt:null, retakeStyle:'STAGED', saveBias:0.55, fakeDefuseBias:0.30,
      strongVs:'T_Chaos', weakVs:'T_Tactical' },
    { id:'ANCHOR_A', name:'Anchor Heavy A',
      setup:{ A:['jungle','ct','stairs'], B:['van'], MID:['okno'] },
      keyUtil:['ct_smoke_topmid','ct_molly_ramp','ct_molly_palace'],
      pushAt:null, retakeStyle:'STAGED', saveBias:0.55, fakeDefuseBias:0.30,
      strongVs:'T_Chaos', weakVs:'T_Tactical' },
    { id:'DEEP_B', name:'Deep B Hold',
      setup:{ A:['jungle'], B:['window','van','kitchen'], MID:['okno'] },
      keyUtil:['ct_smoke_apps','ct_molly_bapps'],
      pushAt:null, retakeStyle:'STAGED', saveBias:0.55, fakeDefuseBias:0.30,
      strongVs:'T_Chaos', weakVs:'T_Tactical' },
    { id:'CROSSFIRE', name:'Crossfire Setup',
      setup:{ A:['jungle','ct'], B:['window','van'], MID:['okno'] },
      keyUtil:['ct_smoke_backline','ct_molly_plant_a','ct_molly_plant_b'],
      pushAt:null, retakeStyle:'STAGED', saveBias:0.55, fakeDefuseBias:0.35,
      strongVs:'T_Chaos', weakVs:'T_Tactical' },
    { id:'DELAY_UTIL', name:'Delay Utility',
      setup:{ A:['jungle','ct'], B:['window','peredB'], MID:['okno'] },
      keyUtil:['ct_molly_ramp','ct_molly_bapps','ct_molly_palace'],
      pushAt:null, retakeStyle:'STAGED', saveBias:0.50, fakeDefuseBias:0.35,
      strongVs:'T_Chaos', weakVs:'T_Tactical' }
  ],
  Tactical: [
    { id:'FLEX_ROT', name:'Flexible Rotator',
      setup:{ A:['ctjungle','ticket'], B:['windowb','van'], MID:['okno'] },
      keyUtil:['ct_smoke_topmid','ct_smoke_connector','ct_flash_mid'],
      pushAt:null, retakeStyle:'SPLIT', saveBias:0.40, fakeDefuseBias:0.75, fakeDefuseDelay:1.2,
      strongVs:'T_Discipline', weakVs:'T_Aggressive' },
    { id:'INFO_ROT', name:'Info Rotate',
      setup:{ A:['jungle','ct'], B:['peredB','window'], MID:['okno'] },
      keyUtil:['ct_flash_mid','ct_smoke_topmid'],
      pushAt:null, retakeStyle:'SPLIT', saveBias:0.40, fakeDefuseBias:0.70,
      strongVs:'T_Discipline', weakVs:'T_Aggressive' },
    { id:'BAIT_B', name:'Bait Stack B',
      setup:{ A:['jungle'], B:['peredB','window','van'], MID:['okno'] },
      keyUtil:['ct_smoke_apps','ct_flash_retake_b'],
      pushAt:null, retakeStyle:'SPLIT', saveBias:0.40, fakeDefuseBias:0.75,
      strongVs:'T_Discipline', weakVs:'T_Aggressive' },
    { id:'TRAP_WINDOW', name:'Trap Window',
      setup:{ A:['jungle','ct'], B:['peredB','window'], MID:['okno'] },
      keyUtil:['ct_flash_mid','ct_molly_ramp'],
      pushAt:null, retakeStyle:'SPLIT', saveBias:0.40, fakeDefuseBias:0.70,
      strongVs:'T_Discipline', weakVs:'T_Aggressive' },
    { id:'ADAPTIVE', name:'Adaptive Setup',
      setup:{ A:['ctjungle','ticket'], B:['peredB','window'], MID:['okno'] },
      keyUtil:['ct_smoke_topmid','ct_smoke_apps','ct_molly_ramp'],
      pushAt:'EARLY_END', retakeStyle:'SPLIT', saveBias:0.45, fakeDefuseBias:0.65,
      strongVs:'T_Discipline', weakVs:'T_Aggressive' }
  ],
  Chaos: [
    { id:'STACK_A', name:'Random Stack A',
      setup:{ A:['jungle','ct','stairs','fire'], B:['peredB'], MID:[] },
      keyUtil:['ct_molly_ramp','ct_molly_palace'],
      pushAt:null, retakeStyle:'BRAWL', saveBias:0.20, fakeDefuseBias:0.50,
      strongVs:'T_Aggressive', weakVs:'T_Discipline' },
    { id:'STACK_B', name:'Random Stack B',
      setup:{ A:['jungle'], B:['peredB','window','van','kitchen'], MID:[] },
      keyUtil:['ct_molly_bapps','ct_smoke_apps'],
      pushAt:null, retakeStyle:'BRAWL', saveBias:0.20, fakeDefuseBias:0.50,
      strongVs:'T_Aggressive', weakVs:'T_Discipline' },
    { id:'SCATTER_DEF', name:'Scatter Defense',
      setup:{ A:['jungle','fire'], B:['peredB','window'], MID:['okno'] },
      keyUtil:[], pushAt:null, retakeStyle:'BRAWL', saveBias:0.20, fakeDefuseBias:0.45,
      strongVs:'T_Aggressive', weakVs:'T_Discipline' },
    { id:'PUG_INDIV', name:'Pug Individual',
      setup:{ A:['ct','stairs'], B:['peredB','kitchen'], MID:['okno'] },
      keyUtil:[], pushAt:null, retakeStyle:'BRAWL', saveBias:0.20, fakeDefuseBias:0.40,
      strongVs:'T_Aggressive', weakVs:'T_Discipline' },
    { id:'RANDOM_AGGRO', name:'Random Aggro Timings',
      setup:{ A:['jungle','ct'], B:['peredB','window'], MID:['okno'] },
      keyUtil:['ct_flash_mid'],
      pushAt:'RANDOM', retakeStyle:'BRAWL', saveBias:0.25, fakeDefuseBias:0.55,
      strongVs:'T_Aggressive', weakVs:'T_Discipline' }
  ]
};

function v279TeamObj(side){
  return side==='T'
    ? (typeof T_TEAM!=='undefined'?T_TEAM:null)
    : (typeof CT_TEAM!=='undefined'?CT_TEAM:null);
}
function v279TeamName(side){
  const obj=v279TeamObj(side);
  return obj?.name || (R.players||[]).find(p=>p.team===side)?.teamName || `${side}-TEAM`;
}
function v279OpponentName(side){
  return v279TeamName(side==='T'?'CT':'T');
}
function v279TeamStyle(side){
  const name=v279TeamName(side);
  const t=(typeof teams!=='undefined'?teams:[]).find(x=>x.name===name);
  return t?.style || (side==='T'?'Tactical':'Tactical');
}
function v279Context(side){
  try{
    if(typeof v264EconomyClass==='function'){
      const c=v264EconomyClass(side);
      if(c==='PISTOL') return 'pistol';
      if(c==='ECO') return 'eco';
      if(c==='FORCE') return 'force';
      if(c==='SAVE') return 'save';
      if(c==='ANTI-ECO') return 'antiEco';
    }
  }catch(_){}
  return 'fullBuy';
}
function v279ScoreBias(side){
  const own=side==='T'?(R.scoreT||0):(R.scoreCT||0);
  const opp=side==='T'?(R.scoreCT||0):(R.scoreT||0);
  const diff=own-opp;
  if(opp===12 && own<12) return {Aggressive:1.20,Chaos:1.25,Tactical:1.00,Discipline:0.90};
  if(diff<=-6) return {Aggressive:1.30,Chaos:1.35,Tactical:0.85,Discipline:0.75};
  if(diff<=-3) return {Aggressive:1.15,Chaos:1.20,Tactical:0.95,Discipline:0.85};
  if(diff>=6) return {Aggressive:0.75,Chaos:0.80,Tactical:1.20,Discipline:1.30};
  if(diff>=3) return {Aggressive:0.85,Chaos:0.90,Tactical:1.10,Discipline:1.15};
  return {Aggressive:1,Chaos:1,Tactical:1,Discipline:1};
}
function v279PlayerBonus(side,style){
  const roster=(v279TeamObj(side)?.players)||[];
  let total=0;
  for(const p of roster) total += Number(V279_PLAYER_STYLE_BONUS[p.nick]?.[style]||0);
  return Math.min(0.12,total);
}
function v279StyleEdge(offStyle,defStyle,side){
  const m=V279_STYLE_COUNTERS[side]?.[offStyle];
  if(!m) return 0;
  if(m.strongVs===defStyle) return m.bonus;
  if(m.weakVs===defStyle) return -m.bonus;
  return 0;
}
function v279MemKey(side){
  return `${side}:${v279TeamName(side)}_vs_${v279OpponentName(side)}`;
}
function v279MemoryWeight(side,id){
  const key=v279MemKey(side);
  const rec=R.v279.tacticMemory?.[key]?.[id];
  if(!rec || rec.wins+rec.losses<2) return 1;
  return 0.6 + (rec.wins/(rec.wins+rec.losses));
}
function v279RecordMemory(side,id,won){
  const key=v279MemKey(side);
  R.v279.tacticMemory[key]=R.v279.tacticMemory[key]||{};
  const rec=R.v279.tacticMemory[key][id]||(R.v279.tacticMemory[key][id]={wins:0,losses:0});
  if(won) rec.wins++; else rec.losses++;
}
function v279RecordFrequency(side,id,won){
  const f=R.v279.tacticFrequency[side][id]||(R.v279.tacticFrequency[side][id]={plays:0,wins:0});
  f.plays++;
  if(won) f.wins++;
}
function v279FrequencyWeight(side,tactic,style){
  const f=R.v279.tacticFrequency[side][tactic.id]||{plays:0,wins:0};
  const wr=f.plays>=3?f.wins/f.plays:0.5;
  const usage=1/(1+f.plays*0.08);
  const ctx=V279_ROUND_CONTEXT_BIAS[v279Context(side)]?.[style]||1;
  const sc=v279ScoreBias(side)[style]||1;
  const win=0.8+wr*0.6;
  return usage*ctx*sc*win;
}
function v279PickWeighted(pool,side,style){
  if(!pool?.length) return null;
  const last=R.v279[side==='T'?'tTactic':'ctTactic'];
  const filtered=pool.filter(t=>t.id!==last?.id);
  const choices=filtered.length?filtered:pool;
  const oppStyle=v279TeamStyle(side==='T'?'CT':'T');
  const scored=choices.map(t=>{
    const st=t.__style||style||'Tactical';
    let w=Number(t._styleWeight||1);
    if(t.strongVs===oppStyle) w*=1.35;
    if(t.weakVs===oppStyle) w*=0.76;
    w*=V279_ROUND_CONTEXT_BIAS[v279Context(side)]?.[st]||1;
    w*=v279ScoreBias(side)[st]||1;
    w*=(1+v279PlayerBonus(side,st));
    w*=v279MemoryWeight(side,t.id);
    w*=v279FrequencyWeight(side,t,st);
    return {t,w:Math.max(0.05,w)};
  });
  const total=scored.reduce((s,x)=>s+x.w,0);
  let r=Math.random()*total;
  for(const x of scored){r-=x.w;if(r<=0)return x.t;}
  return scored[0].t;
}

function v279ValidWp(key){
  return !!(key&&WP[key]&&!pointBlockedForMovement(WP[key].x,WP[key].y,WP[key].z||0));
}
const V279_ALIAS={
  ramp_1:'pit',ramp_entry:'pitexit',ramp_support:'90',ramp_4:'m63',
  palace_1:'palas',palace_2:'palas2',palace_3:'palas3',palace_lurk:'palasexit',
  apps_1:'m4',apps_back:'podaps',apps_entry:'bapps2',apps_support:'bapps1',
  bapps_deep:'dom2',mid_anchor:'belye',mid_back:'topmid',mid_1:'mid',mid_2:'topmid',
  mid_entry:'instamid',mid_support:'m43',mid_watch:'kontomid',apps_watch:'bapps1',
  apps_lurk:'vpodval',a_side:'asite',a_back:'ticket',b_side:'bsite',b_back:'windowb',
  back_all:'exit',self:null,solo:null,rotate_a:'asite',rotate_b:'bsite',
  mid_short:'ladershort',a_side:'asite',b_side:'bsite'
};
function v279ResolveSlot(key,p){
  if(!key) return null;
  if(v279ValidWp(key)) return key;
  if(Object.prototype.hasOwnProperty.call(V279_ALIAS,key)){
    const a=V279_ALIAS[key];
    if(v279ValidWp(a)) return a;
  }
  const k=String(key).toLowerCase();
  const aliases=Object.keys(WP).filter(w=>{
    const q=w.toLowerCase();
    return q===k || q.includes(k) || k.includes(q);
  }).filter(v279ValidWp);
  return aliases[0]||null;
}
function v279RandomSlot(p){
  const candidates=Object.keys(WP).filter(v279ValidWp);
  if(!candidates.length) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function v279TacticSite(t){
  const id=String(t?.id||'').toUpperCase();
  const name=String(t?.name||'').toUpperCase();
  if(id.startsWith('B_')||name.includes('→ B')||name.includes(' B')) return 'B';
  if(id.startsWith('A_')||name.includes('A-')||name.includes(' A')) return 'A';
  return R.tTargetSite==='B'?'B':'A';
}
function v279ExecSeconds(t){
  const x=String(t?.execAt||'');
  if(typeof t?.executeAt==='number') return t.executeAt;
  return V279.phaseMap[x]||15;
}
function v279SetupTTarget(t,p){
  const role=String(p.role||'Support');
  let slot=t?.setup?.[role];
  if(slot==='random'||slot==='self'||slot==='solo') return slot==='random'?v279RandomSlot(p):null;
  return v279ResolveSlot(slot,p);
}
function v279CTSetupTargets(t){
  const setup=t?.setup||{};
  const pools={A:[],B:[],MID:[]};
  for(const a of ['A','B','MID']) for(const k of (setup[a]||[])){
    const x=v279ResolveSlot(k,null); if(x && !pools[a].includes(x)) pools[a].push(x);
  }
  return pools;
}
function v279AssignAuthoredCTAreas(t,live){
  const areas=[];
  const setup=t?.setup||{};
  for(const area of ['A','B','MID']){
    const arr=Array.isArray(setup[area])?setup[area]:[];
    for(let i=0;i<arr.length;i++) areas.push(area);
  }
  const rolePriority={IGL:0,AWPer:1,'Entry-fragger':2,Support:3,Lurker:4};
  const ordered=[...(live||[])].sort((a,b)=>(rolePriority[v279Role(a)]??9)-(rolePriority[v279Role(b)]??9));
  ordered.forEach((p,i)=>{
    if(areas.length) p.ctAssignment=areas[i%areas.length];
    p.ctBaseAssignment=p.ctAssignment;
  });
}
function v279PickCTTarget(t,p,idx){
  const pools=v279CTSetupTargets(t);
  const asg=p.ctAssignment||['A','A','B','B','MID'][idx%5]||'MID';
  let pool=pools[asg]||[];
  if(!pool.length) pool=[...(pools.MID||[]),...(pools.A||[]),...(pools.B||[])];
  if(!pool.length) return p.ctHoldAnchor||v279ResolveSlot('mid',p);
  const roleOrder={IGL:0,AWPer:1,'Entry-fragger':2,Support:3,Lurker:4};
  const offset=(roleOrder[v279Role(p)]||0)+idx;
  return pool[offset%pool.length];
}
function v279Role(p){return String(p?.role||'Support');}

function v279BuildCurrent(side,tactic){
  if(side==='T'){
    return {
      id:tactic.id,name:tactic.name,style:tactic.__style||'Tactical',
      site:v279TacticSite(tactic),executeAt:v279ExecSeconds(tactic),
      source:tactic,targets0:true
    };
  }
  return {
    id:tactic.id,name:tactic.name,style:tactic.__style||'Tactical',
    executeAt:null,source:tactic
  };
}
function v279AllTactics(side){
  const src=side==='T'?V279_T_TACTICS:V279_CT_TACTICS;
  const out=[];
  for(const [style,list] of Object.entries(src||{})){
    for(const t of (list||[])) out.push({...t,__style:style});
  }
  return out;
}
function v279Pick(side){
  const src=side==='T'?V279_T_TACTICS:V279_CT_TACTICS;
  const weighted=[];
  for(const [style,list] of Object.entries(src||{})){
    const styleCtx=V279_ROUND_CONTEXT_BIAS[v279Context(side)]?.[style]||1;
    const scoreCtx=v279ScoreBias(side)[style]||1;
    const base=Math.max(0.05,styleCtx*scoreCtx*(1+v279PlayerBonus(side,style)));
    for(const t of list) weighted.push({...t,__style:style,_styleWeight:base});
  }
  const styleFiltered=weighted.filter(t=>{
    const oppStyle=v279TeamStyle(side==='T'?'CT':'T');
    const edge=v279StyleEdge(t.__style,oppStyle,side);
    return edge>-0.14 || Math.random()<0.28;
  });
  const pool=styleFiltered.length?styleFiltered:weighted;
  return v279PickWeighted(pool,side,pool[0]?.__style||'Tactical') || pool[0] || null;
}

function v279ApplyTactic(side,tactic){
  if(!tactic) return;
  const stateKey=side==='T'?'tTactic':'ctTactic';
  R.v279[stateKey]=v279BuildCurrent(side,tactic);
  const live=v279Alive(side);
  const exec=v279ExecSeconds(tactic);

  if(side==='T'){
    live.forEach((p,i)=>{
      const slot=v279SetupTTarget(tactic,p);
      p.v279TacticId=tactic.id;
      p.v279TacticStyle=tactic.__style;
      p.v279ExecAt=exec;
      p.v279Phase='SETUP';
      p.v279TacticSlot=slot;
      if(slot && v279ValidWp(slot)){
        p.v279TacticWP=slot;
        p.objectiveWP=slot;
      } else p.v279TacticWP=null;
    });
  }else{
    v279AssignAuthoredCTAreas(tactic,live);
    live.forEach((p,i)=>{
      const target=v279PickCTTarget(tactic,p,i);
      p.v279TacticId=tactic.id;
      p.v279TacticStyle=tactic.__style;
      p.v279TacticWP=target;
      p.v279PushAt=tactic.pushAt||null;
      p.v279RetakeStyle=tactic.retakeStyle||'STAGED';
      p.v279SaveBias=Number(tactic.saveBias||0);
      p.v279FakeDefuseBias=Number(tactic.fakeDefuseBias||0);
      if(target) p.objectiveWP=target;
    });
    R.v279.ctPushAt=tactic.pushAt||null;
    R.v279.ctRetakeStyle=tactic.retakeStyle||'STAGED';
    R.v279.ctSaveBias=Number(tactic.saveBias||0);
    R.v279.ctFakeDefuseBias=Number(tactic.fakeDefuseBias||0);
  }

  R.v279.nadeQueue=[];
  const nades=tactic.keyUtil||[];
  for(const id of nades){
    R.v279.nadeQueue.push({id,role:null,at:exec,armed:false});
  }
  v279ArmNadeQueue(tactic);
}

function v279ApplyDynamicTTargets(){
  const tactic=R.v279.tTactic?.source;
  if(!tactic) return;
  const elapsed=ROUND_TIME-(Number(R.roundTime)||0);
  const site=R.tTargetSite==='B'?'B':'A';
  const directStepTargets=tactic.setup||{};
  for(const p of v279Alive('T')){
    if(p.hasBomb && R.bomb.state==='carried'){
      const target=(typeof chooseSiteEntryWP==='function')
        ? chooseSiteEntryWP(site,0,new Set(),true)
        : (site==='B'?'bsite':'asite');
      if(target) p.objectiveWP=target;
      continue;
    }
    if(R.bomb.state==='dropped' || R.bomb.state==='planted') continue;
    let target=null;
    const role=v279Role(p);
    if(elapsed < v279ExecSeconds(tactic)){
      target=v279ResolveSlot(directStepTargets[role],p) || p.v279TacticWP;
    }else{
      const siteTarget=site==='A'
        ? (role==='Lurker'?v279ResolveSlot('palasexit',p):v279ResolveSlot('asite',p))
        : (role==='Lurker'?v279ResolveSlot('spuskmid',p):v279ResolveSlot('bsite',p));
      target=siteTarget || p.v279TacticWP;
    }
    if(target && p.objectiveWP!==target){
      p.objectiveWP=target;
      if(typeof setPlayerPath==='function' && (!p.path||p.path.length<2||p.pi>=p.path.length-1)) setPlayerPath(p,target);
    }
  }
}

function v279ArmNadeQueue(tactic){
  const arr=tactic?.keyUtil||[];
  const liveT=v279Alive('T'), liveCT=v279Alive('CT');
  let n=0;
  for(const id of arr){
    const roleOrder=sideRoleForUtility(id);
    R.v279.nadeQueue.push({id,role:roleOrder,at:(v279ExecSeconds(tactic)+(n*0.55)),armed:true,round:R.roundNum});
    n++;
  }
}
function sideRoleForUtility(id){
  const s=String(id||'');
  if(s.includes('flash')) return 'Support';
  if(s.includes('molly')) return 'Support';
  if(s.includes('window')) return 'IGL';
  return 'Support';
}
function v279FindExactPreset(p,id){
  const list=typeof availableGrenadePresets==='function'?availableGrenadePresets(p):[];
  let g=list.find(x=>x.id===id && (p.grenades?.[x.type]||0)>0);
  if(g) return g;
  const want=s=>
    s.includes('smoke')?'smoke':
    s.includes('flash')?'flash':
    s.includes('molly')?'molotov':
    s.includes('he')?'he':null;
  const type=want(String(id||''));
  const c=list.filter(x=>x.type===type && (p.grenades?.[x.type]||0)>0);
  if(!c.length) return null;
  c.sort((a,b)=>Math.hypot(p.x-a.from.x,p.y-a.from.y)-Math.hypot(p.x-b.from.x,p.y-b.from.y));
  return c[0];
}
function v279NadeCondition(id,p){
  const s=String(id||'').toLowerCase();
  const elapsed=ROUND_TIME-(Number(R.roundTime)||0);
  const planted=R.bomb.state==='planted';
  if(s.includes('defuse')) return planted;
  if(s.includes('retake')) return planted;
  if(s.includes('plant_a')) return R.tTargetSite==='A' && !planted;
  if(s.includes('plant_b')) return R.tTargetSite==='B' && !planted;
  if(s.includes('window')) return elapsed>=4.0;
  if(s.includes('connector')||s.includes('mid')) return elapsed>=4.0;
  if(s.includes('jungle')||s.includes('ticket')||s.includes('ramp')||s.includes('palace')) return elapsed>=6.0;
  return true;
}
function v279ExecuteNades(){
  if(R.v279.lastNadeRound!==R.roundNum){R.v279.lastNadeRound=R.roundNum;R.v279.lastNadeAt=0;}
  const elapsed=ROUND_TIME-(Number(R.roundTime)||0);
  for(const q of (R.v279.nadeQueue||[])){
    if(q.round!==R.roundNum || q.used || elapsed<q.at || !v279NadeCondition(q.id,null)) continue;
    const candidates=v279Alive('T').concat(v279Alive('CT')).filter(p=>!p.hasBomb && v279NadeCondition(q.id,p));
    if(q.role) candidates.sort((a,b)=>(a.role===q.role?-1:0)-(b.role===q.role?-1:0));
    let best=null;
    for(const p of candidates){
      const g=v279FindExactPreset(p,q.id);
      if(g && Math.hypot(p.x-g.from.x,p.y-g.from.y)<180){best={p,g};break;}
    }
    if(best){
      best.p.grenadePlan=best.g;
      q.used=true;
      R.v279.lastNadeAt=performance.now();
    }
  }
}





function v279Traffic(){
  const now=performance.now();
  if(now-(R.v279.trafficAt||0)<V279.move.trafficMs) return;
  R.v279.trafficAt=now;
  const ps=v279Alive();
  for(let i=0;i<ps.length;i++) for(let j=i+1;j<ps.length;j++){
    const a=ps[i],b=ps[j];
    if(a.team!==b.team || Math.abs((a.z||0)-(b.z||0))>0.8) continue;
    const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||0.001;
    if(d>=V279.move.pairGap) continue;
    const aNext=a.path&&a.path[a.pi+1]&&WP[a.path[a.pi+1]];
    const bNext=b.path&&b.path[b.pi+1]&&WP[b.path[b.pi+1]];
    const ad=aNext?Math.hypot(a.x-aNext.x,a.y-aNext.y):999;
    const bd=bNext?Math.hypot(b.x-bNext.x,b.y-bNext.y):999;
    const move=ad>=bd?a:b;
    const toward=move===a?1:-1;
    const nx=move.x+(dx/d)*V279.move.maxPush*toward;
    const ny=move.y+(dy/d)*V279.move.maxPush*toward;
    if(!pointBlockedForMovement(nx,ny,move.z)){move.x=nx;move.y=ny;}
  }
}

function v279ResolveStuck(){
  const now=performance.now();
  for(const p of v279Alive()){
    const targetKey=p.objectiveWP;
    if(!targetKey||!WP[targetKey]) continue;
    p.v279MoveSample=p.v279MoveSample||{t:now,x:p.x,y:p.y};
    const age=now-p.v279MoveSample.t;
    if(age<V279.move.sampleMs) continue;
    const moved=Math.hypot(p.x-p.v279MoveSample.x,p.y-p.v279MoveSample.y);
    p.v279MoveSample={t:now,x:p.x,y:p.y};
    if(moved>=V279.move.minMove) { p.v279StuckSince=0; continue; }
    const remain=Math.hypot(p.x-WP[targetKey].x,p.y-WP[targetKey].y);
    if(remain<28) { p.v279StuckSince=0; continue; }
    p.v279StuckSince=p.v279StuckSince||now;
    const stuck=now-p.v279StuckSince;
    if(stuck<V279.move.softMs) continue;

    const from=findClosestWPTo(p.x,p.y,p.z);
    if(!from) continue;
    let path=null;
    try{
      path=typeof v267DynamicPath==='function'
        ? v267DynamicPath(from,targetKey,p)
        : safePath(from,targetKey,false);
    }catch(_){}
    if(path&&path.length>1 && typeof setPlayerPath==='function'){
      p.path=path;p.pi=0;p.v279StuckSince=0;p.v279LastReroute=now;
      continue;
    }

    /* wall-slide fallback: deterministic left/right, no teleport */
    const side=p.v279SlideSide||(String(p.nick).split('').reduce((a,c)=>a+c.charCodeAt(0),0)%2?'L':'R');
    p.v279SlideSide=side;
    const dx=WP[targetKey].x-p.x,dy=WP[targetKey].y-p.y,dd=Math.hypot(dx,dy)||1;
    const px=side==='L'?-dy/dd:dy/dd,py=side==='L'?dx/dd:-dx/dd;
    for(const amt of [5,8,12]){
      const nx=p.x+px*amt,ny=p.y+py*amt;
      if(!pointBlockedForMovement(nx,ny,p.z)){
        p.x=nx;p.y=ny;
        p.v279StuckSince=0;
        break;
      }
    }
  }
}

/* Explicit AI entry points: no function replacement / prior-chain. */
window.CS2AI=window.CS2AI||{};
window.CS2AI.tacticChooseObjective=function(p){
  try{
    if(!p?.alive) return null;
    if(R.bomb.state==='planted'||R.bomb.state==='dropped') return null;
    if(p.team==='T'&&p.hasBomb&&R.bomb.state==='carried') return null;
    const t=R.v279.tTactic?.source;
    if(t){
      const elapsed=ROUND_TIME-(Number(R.roundTime)||0), role=v279Role(p);
      let slot=null;
      if(elapsed<v279ExecSeconds(t)){
        slot=t.setup?.[role];
        if(slot==='random') slot=v279RandomSlot(p);
        else if(slot==='self'||slot==='solo') slot=null;
        else slot=v279ResolveSlot(slot,p);
      }else{
        const site=R.tTargetSite==='B'?'B':'A';
        slot=site==='A' ? (role==='Lurker'?v279ResolveSlot('palasexit',p):v279ResolveSlot('asite',p))
                         : (role==='Lurker'?v279ResolveSlot('spuskmid',p):v279ResolveSlot('bsite',p));
      }
      if(slot&&WP[slot]) return slot;
    }
    if(p.team==='CT'){
      const t=R.v279.ctTactic?.source;
      if(t){
        const elapsed=ROUND_TIME-(Number(R.roundTime)||0);
        const idx=Math.max(0,(R.players||[]).filter(q=>q.team==='CT').indexOf(p));
        if(t.pushAt&&(t.pushAt==='RANDOM'||elapsed>=v279ExecSeconds({execAt:t.pushAt}))){
          const role=v279Role(p);
          if(role==='Entry-fragger'||role==='IGL'){
            const push=v279ResolveSlot(role==='IGL'?'kontomid':'spuskmid',p);
            if(push) return push;
          }
        }
        const slot=v279PickCTTarget(t,p,idx);
        if(slot&&WP[slot]) return slot;
      }
    }
  }catch(e){console.warn('[CS2 AI] objective',e);}
  return null;
};
window.CS2AI.tacticStartRound=function(){
  try{
    const t=v279Pick('T'), c=v279Pick('CT');
    v279ApplyTactic('T',t);v279ApplyTactic('CT',c);
    R.v279.tStyle=t?.__style||null;R.v279.ctStyle=c?.__style||null;
    R.v279.roundKey=String(R.roundNum);R.v279.tacticSelectionAt=performance.now();
  }catch(e){console.warn('[CS2 AI] tactic start',e);}
};
window.CS2AI.tacticEndRound=function(winner){
  try{
    if(R.v279.tTactic){v279RecordMemory('T',R.v279.tTactic.id,winner==='T');v279RecordFrequency('T',R.v279.tTactic.id,winner==='T');}
    if(R.v279.ctTactic){v279RecordMemory('CT',R.v279.ctTactic.id,winner==='CT');v279RecordFrequency('CT',R.v279.ctTactic.id,winner==='CT');}
  }catch(e){console.warn('[CS2 AI] tactic end',e);}
};
window.CS2AI.tacticTick=function(dt){
  if(!R.active) return;
  try{v279ApplyDynamicTTargets();v279ExecuteNades();v279ResolveStuck();}catch(e){console.warn('[CS2 AI] tactic tick',e);}
};
/* Lightweight tactic API. */
window.MIRAGE_FULL={
  version:'27.9',
  tactics:{T:V279_T_TACTICS,CT:V279_CT_TACTICS},
  all:{T:v279AllTactics('T'),CT:v279AllTactics('CT')},
  current:()=>R.v279,
  pick:(side)=>v279Pick(side),
  context:(side)=>v279Context(side),
  scoreBias:(side)=>v279ScoreBias(side),
  memory:()=>R.v279.tacticMemory,
  frequency:()=>R.v279.tacticFrequency
};

console.log('[CS2 Radar v27.9] 40 Mirage tactics + 9 extensions integrated.');
})();
