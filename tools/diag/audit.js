paused=true; matchNum=5;
var K={rounds:0, planted:0, retake:0, retakeGo:0, retakeWon:0, save:0, tsave:0, eg:0, clutchCT:0, clutchT:0, recall:0, rotread:0, abort:0, fake:0, midtake:0, antiEcoRounds:0, hunt:0, ninja:0};
var ol=logEvent; logEvent=function(s){ s=String(s);
 if(/ретейк .* точк/.test(s)) K.retake++; if(/ретейк — заходим/.test(s)) K.retakeGo++; if(/CT: сейв/.test(s)) K.save++; if(/^T: сейв/.test(s)) K.tsave++;
 if(/перепривязка|перекол/.test(s)) K.recall++; if(/слышим ротацию CT .* перекол/.test(s)) K.rotread++; if(/выход провалился/.test(s)) K.abort++; if(/фейк на/.test(s)) K.fake++;
 if(/выбивать оружие/.test(s)) K.hunt++; if(/ниндзя/.test(s)) K.ninja++; return ol.apply(this,arguments); };
var ov=voiceLog; voiceLog=function(t,k,id,s){ s=String(s); if(/все на него/.test(s)) K.eg++; if(/мид наш/.test(s)) K.midtake++; if(/я один против/.test(s)) K.clutchCT++; if(/я один на пост-планте/.test(s)) K.clutchT++; return ov.apply(this,arguments); };
var prevTag={}, flips={}, stale={}, rs=null, wasPlanted=false, ae=false;
for(var t=0;t<300000;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='ending'){ K.rounds++; if(wasPlanted){ K.planted++; if(bomb.state==='defused') K.retakeWon++; } } if(roundState==='freeze'){ wasPlanted=false; ae=false; } rs=roundState; }
 if(roundState!=='live') continue; if(bomb.state==='planted') wasPlanted=true;
 if(!ae && teamTac.CT && teamTac.CT.antiEco){ ae=true; K.antiEcoRounds++; }
 if(t%8) continue;
 bots.forEach(function(b){ if(!b.alive) return; var tg=b.post?b.post.tag.replace(/[0-9]+|:.*$/g,''):'-'; var p=prevTag[b.id];
  if(p && p.tag!==tg){ if(p.prev===tg && tick-p.t<64){ var k=[p.tag,tg].sort().join(' ⇄ '); flips[k]=(flips[k]||0)+1; } prevTag[b.id]={tag:tg,prev:p.tag,t:tick}; } else if(!p) prevTag[b.id]={tag:tg,prev:null,t:tick};
  var ph=teamTac.T&&teamTac.T.phase, bs=bomb.state;
  if(b.team==='T' && bs==='planted' && /^(endhunt|stage|lurkStage|lurkPeek|probe|shift)/.test(tg)){ stale['T:'+tg+' после планта']=(stale['T:'+tg+' после планта']||0)+1; }
  if(b.team==='CT' && bs==='planted' && /^(anchor|mid|rotator|stack|rotate|earlyPeek|endhunt)/.test(tg)){ stale['CT:'+tg+' после планта']=(stale['CT:'+tg+' после планта']||0)+1; }
  if(b.team==='T' && ph==='execute' && /^(lurkStage|stage|probe|shift|tmid)/.test(tg) && b.tRole!=='lurker'){ stale['T:'+tg+' во время выхода']=(stale['T:'+tg+' во время выхода']||0)+1; }
 }); }
var top=function(o,n){ return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).slice(0,n).map(function(k){return o[k]+'× '+k}); };
JSON.stringify({K:K, flips:top(flips,15), staleSamples_per0_125s:top(stale,12)},null,1)
