(function(){
  const need = [
    ['CS2AI.tacticTick',      typeof window.CS2AI?.tacticTick],
    ['CS2AI.behaviorTick',    typeof window.CS2AI?.behaviorTick],
    ['CS2AI.trafficTick',     typeof window.CS2AI?.trafficTick],
    ['CS2AI.lookTick',        typeof window.CS2AI?.lookTick],
    ['CS2AI.syncRoles',       typeof window.CS2AI?.syncRoles],
    ['CS2AI.aiThink',         typeof window.CS2AI?.aiThink],
    ['CS2AI.postTick',        typeof window.CS2AI?.postTick],
    ['v2714FastDraw',         typeof window.v2714FastDraw],
    ['bombInitRound',         typeof window.bombInitRound],
    ['updateGrenades',        typeof window.updateGrenades]
  ];
  const bad = need.filter(x => x[1] !== 'function');
  if (bad.length) console.error('[CS2 boot] NOT READY:', bad.map(x=>x[0]).join(', '));
  else console.log('[CS2 boot] OK: all subsystems registered');
})();