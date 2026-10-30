
window.CS2AI=window.CS2AI||{};
window.CS2AI.aiThink=function(dt){
  if(!R.active) return;
  window.CS2AI.tacticTick(dt);
  window.CS2AI.behaviorTick(dt);
};
window.CS2AI.postTick=function(dt){
  if(!R.active) return;
  window.CS2AI.trafficTick();
  for(const p of R.players) if(p.alive) window.CS2AI.lookTick(p,dt);
  window.CS2AI.syncRoles?.(false);
};