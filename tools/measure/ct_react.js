// (тактика 30.10) Реакция CT на информацию: ротации по коллам, коллы «по гранатам», фейк-дефуз; переколы T «сайт пуст».
// Запуск: node src/q.js sim.html "$(sed 's/__M__/3/;s/__R__/12/' tools/measure/ct_react.js)" > out.json   (любая версия игры)
// Ответ: rounds: [{r, tac: стиль тактики T, site: сайт T, rot: [[тик, кто, куда, колл: {n, seen, heard, nades}]], fakeDef, realDef,
//   clrReb: [тексты переколов «прочекан — пусто»], tSiteLost: CT, ушедших с настоящего сайта T до первого контакта там]}
freshMatch(__M__);
var M0 = matchNum, OUT = {rounds: []}, R = null;
function newR(){ R = {r: roundNum, tac: null, site: null, rot: [], dv: [], dead: [], fakeDef: 0, realDef: 0, clrReb: [], calls: []}; OUT.rounds.push(R); }
var ovl = voiceLog; voiceLog = function(team, key, who, text){
  if(R && team === "CT" && /^rot/.test(String(key))){ var c = teamTac.CT && teamTac.CT.call;
    R.rot.push([tick, who, c ? c.site : null, c ? {n: +c.count.toFixed(1), seen: c.seen || 0, nades: c.nades || 0} : null]); }
  if(R && team === "T" && /^clrreb/.test(String(key))) R.clrReb.push(String(text).slice(0, 80));
  if(R && team === "T" && /^(bait|dfreal|dffake|antidef|deflate)/.test(String(key))) (R.dv = R.dv || []).push([tick, String(key).replace(/\d+$/, ""), who]);
  return ovl.apply(this, arguments); };
var ofk = feedKill; feedKill = function(att, vic){ if(R) R.dead.push([tick, vic.id, vic.team]); return ofk.apply(this, arguments); };
var olog = logEvent; logEvent = function(s){ if(R){ if(/фейк-дефуз/.test(s)) R.fakeDef++; else if(/дефузит/.test(s)) R.realDef++; } return olog.apply(this, arguments); };
var lastR = null;
for(var t = 0; t < 400000; t++){
  stepTick();
  if(matchNum !== M0 || roundNum > __R__) break;
  if(lastR !== roundNum){ lastR = roundNum; newR(); }
  if(R && teamTac.T && teamTac.T.tac){ R.tac = teamTac.T.tac.style; R.site = teamTac.T.site; }
  var c = teamTac.CT && teamTac.CT.call;
  if(R && c && (!R.calls.length || R.calls[R.calls.length-1][1] !== c.site)) R.calls.push([tick, c.site, +c.count.toFixed(1), c.seen || 0, c.nades || 0]);
}
JSON.stringify(OUT)
