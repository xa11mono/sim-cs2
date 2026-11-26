freshMatch(3);
var player = bots[0], previous = RP_BF.map(function(k){return player[k];});
var setField = typeof rpSetBotField === "function" ? rpSetBotField : function(b,k,v){b[k]=v;};
var marker = previous.map(function(_,i){return {index:i};});
RP_BF.forEach(function(k,i){setField(player,k,marker[i]);});
var overrideOK = RP_BF.every(function(k,i){return player[k]===marker[i];});
RP_BF.forEach(function(k,i){setField(player,k,previous[i]);});
var restoreOK = RP_BF.every(function(k,i){return player[k]===previous[i];});
JSON.stringify({fields:RP_BF.length,override:overrideOK,restore:restoreOK});
