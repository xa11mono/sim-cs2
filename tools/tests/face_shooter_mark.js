// п.5: куда смотрит бот ID относительно стрелка SH (угол между взглядом и направлением на стрелка), причина взгляда, перезарядка.
// node tools/mark_open.js sim.html снимок.json "var ID='T4', SH='CT1', T0=12000, T1=12140; $(cat tools/tests/face_shooter_mark.js)"
(function(){
  var b = teamBot(ID), e = teamBot(SH), o = ["from " + tick];
  while(tick < T1 && b.alive){ stepTick(); if(tick < T0 || tick % 8) continue;
    var off = Math.round(_angOff(b.facing, Math.atan2(e.y-b.y, e.x-b.x))*57.3);
    o.push(tick + " " + b.lookReason + " off=" + off + "° reload=" + !!b._reloading + " ammo=" + b.ammo + " hp=" + b.hp + " seesEnemy=" + !!b._sawEnemy + " shAlive=" + e.alive); }
  o.push("end " + tick + " alive=" + b.alive); return o.join("\n");
})()
