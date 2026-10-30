
(function(){
'use strict';
if(window.__cs2RadarV2715Installed) return;
window.__cs2RadarV2715Installed=true;

/* v27.15 — authoritative role synchronization.
 * Team definition (T_TEAM/CT_TEAM) is the source of truth. The live match
 * object mirrors it into role, mtRoleBase and tacticalRole so tactic logic,
 * behavior logic, buy logic and the UI all see the same role.
 */
const V2715={roleSyncMs:100};
R.v2715=R.v2715||{lastRoleSync:0,roleChanges:0};
function v2715Team(side){return side==='CT'?CT_TEAM:T_TEAM;}
function v2715Def(p){const t=v2715Team(p?.team);return t?.players?.find(q=>q.nick===p.nick)||null;}
function v2715Sync(force=false){
  const now=performance.now();
  if(!force&&now-(R.v2715.lastRoleSync||0)<V2715.roleSyncMs)return;
  R.v2715.lastRoleSync=now;
  for(const p of (R.players||[])){
    const d=v2715Def(p); if(!d)continue;
    const role=d.role||'Support', on=d.roleEnabled!==false;
    if(p.role!==role||p.mtRoleBase!==role||p.tacticalRole!==role||p.roleEnabled!==on)R.v2715.roleChanges++;
    p.role=role; p.mtRoleBase=role; p.tacticalRole=role; p.roleEnabled=on;
    p.v28RoleLabel=role;
    p.v278RoleDisabled=!on||v2715Team(p.team)?.aiRoleBrainEnabled===false;
  }
}

window.CS2AI=window.CS2AI||{};
window.CS2AI.syncRoles = function(force){ v2715Sync(!!force); };

window.MIRAGE_ROLE_SYNC={
  sync:()=>{v2715Sync(true);return (R.players||[]).map(p=>({nick:p.nick,team:p.team,role:p.role,mtRoleBase:p.mtRoleBase,tacticalRole:p.tacticalRole,enabled:p.roleEnabled!==false}));},
  get:nick=>{const p=(R.players||[]).find(q=>q.nick===nick);return p?{team:p.team,role:p.role,mtRoleBase:p.mtRoleBase,tacticalRole:p.tacticalRole,enabled:p.roleEnabled!==false}:null;}
};
console.log('[CS2 Radar v27.15] role=authoritative team definition; old small sector view restored; smoke enlarged');
})();
