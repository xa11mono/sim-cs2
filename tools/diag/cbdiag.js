paused=true; var out=[], W=null, t0=0, n=0, prevVx=null, flips=0;
for(var m of [3,7,11]){ matchNum=m; newMatch();
for(var t=0;t<120000 && out.length<4;t++){ stepTick();
 if(!W){ bots.forEach(function(b){ if(!W && b.alive && b.post && b.post.tag==='repos:coverblind'){ W=b; t0=tick; flips=0; prevVx=null; W._log=[]; } }); continue; }
 if(!W.alive || tick-t0>160){ out.push({id:W.id, flips:flips, log:W._log.slice(0,40)}); W=null; continue; }
 var vx=W.x-(W._px==null?W.x:W._px); W._px=W.x;
 if(Math.abs(vx)>0.3){ var s=vx>0?1:-1; if(prevVx!=null && s!==prevVx) flips++; prevVx=s; }
 if(tick%4===0) W._log.push((tick-t0)+" "+Math.round(W.x)+","+Math.round(W.y)+" st="+W.state+" tag="+(W.post&&W.post.tag)+" atPost="+W.atPost+" d="+(W.post?Math.round(Math.hypot(W.post.x-W.x,W.post.y-W.y)):'-')+" saw="+!!W._sawEnemy+" strafe="+(W._strafe?1:0)+" peek="+(W.peekType||'')+" hold="+!!W.holding);
} }
JSON.stringify(out,null,1)
