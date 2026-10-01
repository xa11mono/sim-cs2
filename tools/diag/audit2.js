paused=true; matchNum=5; var R={rounds:0}, cur={}, rs=null;
function mark(k){ cur[k]=1; }
for(var t=0;t<300000;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='ending'){ R.rounds++; for(var k in cur) R[k]=(R[k]||0)+1; } if(roundState==='freeze') cur={}; rs=roundState; }
 if(roundState!=='live'||t%16) continue;
 var tt=teamTac.T||{}, ct=teamTac.CT||{};
 if(bomb.state==='planted') mark('plant'); if(bomb.retake) mark('retake'); if(bomb.retake&&bomb.retake.phase==='go') mark('retakeGo'); if(bomb.state==='defused') mark('defused');
 if(ct.saving) mark('ctSave'); if(tt.saving) mark('tSave'); if(tt.fakeOn) mark('fake'); if(tt.rebound) mark('recall'); if(tt.midTaken) mark('midTake'); if(tt.aborted) mark('abort');
 if(ct.call) mark('ctCall'); if(ct.antiEco) mark('antiEco'); if(ct.flank) mark('ctFlankMid');
 if(bots.some(function(b){return b.alive&&b.post&&b.post.tag==='endhunt'})) mark('endhunt');
 if(bots.some(function(b){return b.alive&&b.post&&b.post.tag==='hunt'})) mark('huntSavers');
 if(bots.some(function(b){return b.alive&&b.team==='CT'&&b.post&&/^clutch/.test(b.post.tag)})) mark('clutchCT');
 if(aliveCount('T')===1&&aliveCount('CT')>=2) mark('clutchT');
 if(bots.some(function(b){return b.alive&&b.team==='T'&&b.tRole==='lurker'&&b.post&&/^lurk/.test(b.post.tag)})) mark('lurker');
 if(bots.some(function(b){return b.alive&&b.team==='T'&&b.post&&b.post.tag==='endhunt'})&&bomb.state==='planted') mark('staleEndhuntT');
}
JSON.stringify(R)
