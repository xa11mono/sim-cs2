// (v401, владелец 22.10) Разбор отметки по истории: что было до момента, что перебило, почему взгляд и веса зон такие.
//   1) скачать оба снимка отметки: Artifact read, url страницы, path = preSnapAsset и snapAsset (поля отметки в базе страницы,
//      коллекция marks) → два файла .json
//   2) node tools/mark_story.js sim.html <до.json> <момент.json> [бот] [--every=16] > разбор.txt
// Открывает снимок «до» (15–25 с до отметки), включает запись разбора взгляда (LOOKDBG — только запись, игру не меняет) и шагает
// до тика отметки, снимая каждые --every тиков: взгляд и арбитр взгляда, задачу места, знание команд по зонам, войс. В конце
// сверяет, что пришёл ровно в момент отметки (позиции, HP, задачи), и печатает:
//   · что сказали в войсе за это время;
//   · по зонам — сколько врагов ждёт каждая команда и когда / на сколько это менялось;
//   · по каждому живому игроку — смены взгляда и задачи (было → стало, кто перебил и каким уровнем) и полный разбор в момент
//     отметки (все варианты взгляда с баллами и множителями, источники знания, опасность зон). Отмеченный бот — первым и подробно.
// Если снимка «до» нет (старая отметка) — передать вместо него снимок момента: будет только разбор момента (один шаг записи).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const [sim, preFile, snapFile, botId] = args;
  if(!sim || !preFile || !snapFile){ console.error('node tools/mark_story.js sim.html до.json момент.json [бот] [--every=16]'); process.exit(2); }
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const pre = fs.readFileSync(preFile, 'utf8'), snap = fs.readFileSync(snapFile, 'utf8');
  const out = await pg.evaluate(([pre, snap, botId, every]) => window.__ev('(' + function(pre, snap, botId, every){
    var R2 = function(v){ return Math.round(v*100)/100; }, pl = function(x, y){ return String(calloutName(x, y) || "").replace(/^на «/, "").replace(/»$/, ""); };
    var sec = function(t, T){ return ((t - T)/TICK_HZ).toFixed(1); };
    var LDk = function(k){ return k === "look" ? "угроза" : (WHY_LOOK[k] || k); };
    // 1) цель — момент отметки
    mkOpenSnap(snap); paused = true;
    var T = tick, match = matchNum, round = roundNum;
    var goal = bots.map(function(b){ return [b.id, Math.round(b.x), Math.round(b.y), b.hp, b.alive, b.post ? String(b.post.tag) : ""]; });
    // 2) история: снимок «до» → шаги до T с записью
    mkOpenSnap(pre); paused = true;
    var from = tick, oneShot = from >= T;
    if(oneShot){ mkOpenSnap(snap); paused = true; from = T; }
    LOOKDBG.on = true;
    var vStart = voiceLines.length ? voiceLines[0] : null, voice = [];
    var samples = [];
    var nZ = BZ.ids.length;
    var take = function(){
      var s = {t: tick, bots: {}, bel: {T: [], CT: []}};
      bots.forEach(function(b){ if(!b.alive) return;
        var a = (b._ldArb || []).slice().sort(function(x, y){ return y.lvl - x.lvl || y.sc - x.sc; });
        s.bots[b.id] = {lr: b.lookReason || "", lp: b.lookTarget ? pl(b.lookTarget.x, b.lookTarget.y) : "", task: b.post ? String(b.post.tag) : "",
          lv: b._task ? b._task.lv : null, place: pl(b.x, b.y), arb: a.slice(0, 3).map(function(c){ return c.lvl + "·" + LDk(c.kind) + "·" + R2(c.sc); }),
          nade: b.nadeTask ? b.nadeTask.type + " — " + (b.nadeTask.why || "") : ""}; });
      for(var i = 0; i < nZ; i++){ s.bel.T.push(R2(beliefCount("T", [i]))); s.bel.CT.push(R2(beliefCount("CT", [i]))); }
      samples.push(s);
    };
    // вход в цикл: войс — новые строки в начале voiceLines
    var lastTop = vStart;
    var grabVoice = function(){ var add = []; for(var i = 0; i < voiceLines.length && voiceLines[i] !== lastTop; i++) add.push(voiceLines[i]);
      add.reverse().forEach(function(v){ voice.push([tick, v.team, v.who, v.text, v.kind]); }); lastTop = voiceLines[0] || lastTop; };
    if(oneShot){ stepTick(); take(); }
    else { take(); while(tick < T){ stepTick(); grabVoice(); if((tick - from) % every === 0 || tick === T) take(); } }
    // 3) сверка: пришли ли ровно в момент отметки
    var miss = [];
    if(!oneShot) goal.forEach(function(g){ var b = bots.filter(function(o){ return o.id === g[0]; })[0]; if(!b) return;
      if(Math.round(b.x) !== g[1] || Math.round(b.y) !== g[2] || b.hp !== g[3] || !!b.alive !== g[4]) miss.push(g[0] + " (" + g[1] + "," + g[2] + " hp " + g[3] + " → " + Math.round(b.x) + "," + Math.round(b.y) + " hp " + b.hp + ")"); });
    var L = [];
    L.push("Отметка: матч " + match + ", раунд " + round + ", тик " + T + (oneShot ? " — снимка «до» нет: только момент (шаг +1 тик)" : " · история с тика " + from + " (" + sec(from, T) + " с)"));
    if(!oneShot) L.push(miss.length ? "ВНИМАНИЕ: не сошлось с моментом отметки у " + miss.length + ": " + miss.join("; ") + " — версия игры другая, история приблизительная" : "Сверка: пришли ровно в момент отметки (позиции, HP, живые — все совпали)");
    // 4) войс
    if(voice.length){ L.push("", "== Войс за это время"); voice.forEach(function(v){ L.push("  " + sec(v[0], T) + " с · " + v[1] + " " + v[2] + ": " + v[3] + " [" + v[4] + "]"); }); }
    // 5) зоны: что команда ждёт и как менялось
    var zn = function(i){ return zoneUserName(BZ.ids[i]) || BZ.ids[i]; };
    ["T", "CT"].forEach(function(tm){
      var rows = [];
      for(var i = 0; i < nZ; i++){
        var seq = samples.map(function(s){ return s.bel[tm][i]; }), last = seq[seq.length-1], mx = Math.max.apply(null, seq);
        if(mx < 0.15) continue;
        var ch = []; for(var k = 1; k < seq.length; k++) if(Math.abs(seq[k] - seq[k-1]) >= 0.2) ch.push(sec(samples[k].t, T) + " с: " + seq[k-1] + " → " + seq[k]);
        rows.push([last, "  " + zn(i) + ": сейчас " + last + (ch.length ? " · менялось: " + ch.slice(-6).join("; ") : " · не менялось")]);
      }
      rows.sort(function(a, b){ return b[0] - a[0]; });
      L.push("", "== Команда " + tm + ": сколько врагов ждёт в зоне (её знание, не правда)"); rows.forEach(function(r){ L.push(r[1]); });
    });
    // 6) игроки: история смен и разбор момента
    var LDtxt = function(rs){ rs = String(rs || "").replace("+open", ""); return rs === "look" ? "угроза (оценка углов)" : (WHY_LOOK[rs] || LD_WHY[rs] || rs); };
    var order = bots.filter(function(b){ return b.alive; }).sort(function(a, b){ return (a.id === botId ? -1 : 0) - (b.id === botId ? -1 : 0); });
    order.forEach(function(b){
      var me = b.id === botId;
      L.push("", "== " + (me ? "ОТМЕЧЕН · " : "") + nick(b.id) + " (" + b.id + ", " + b.team + " №" + pnum(b.id) + ", " + (b.tRole || b.ctRole || "") + ") · " + pl(b.x, b.y) + " · HP " + b.hp + " · " + (b.weapon ? b.weapon.key : ""));
      // смены
      var prev = null, ch = [];
      samples.forEach(function(s){ var c = s.bots[b.id]; if(!c) return;
        if(prev){
          if(c.lr !== prev.lr || c.lp !== prev.lp) ch.push(sec(s.t, T) + " с · взгляд: «" + LDtxt(prev.lr) + "» → " + (prev.lp || "—") + "  ⇒  «" + LDtxt(c.lr) + "» → " + (c.lp || "—") + (c.arb.length ? "  [арбитр: " + c.arb.join(" | ") + "]" : ""));
          if(c.task !== prev.task) ch.push(sec(s.t, T) + " с · задача места: «" + (prev.task || "—") + "» → «" + (c.task || "—") + "»" + (c.lv != null ? " (уровень " + c.lv + ")" : "") + " · " + c.place);
          if(c.nade !== prev.nade) ch.push(sec(s.t, T) + " с · граната: " + (prev.nade || "—") + " → " + (c.nade || "—"));
        }
        prev = c; });
      if(ch.length) L.push("  Смены за это время:"), (me ? ch : ch.slice(-8)).forEach(function(x){ L.push("    " + x); });
      else L.push("  Смен не было");
      // журнал решений (место, гранаты) — из игры
      // журнал: одинаковые подряд строки (отказ раз в секунду) — одной строкой «×N, с … по …»
      if(me && b._dlog && b._dlog.length){ L.push("  Журнал решений (15 с):"); var g = [];
        b._dlog.forEach(function(e){ var k = e[1] + ": " + e[2], q = g[g.length-1]; if(q && q.k === k){ q.n++; q.t1 = e[0]; } else g.push({k: k, n: 1, t0: e[0], t1: e[0]}); });
        g.forEach(function(q){ L.push("    " + sec(q.t0, T) + " с · " + q.k + (q.n > 1 ? "  (×" + q.n + ", до " + sec(q.t1, T) + " с)" : "")); }); }
      // момент
      var LD = b._ld || {}, P = b._ldPlan;
      L.push("  Сейчас смотрит: «" + LDtxt(LD.reasonFinal || LD.reason || b.lookReason) + "» → " + (LD.final ? pl(LD.final.x, LD.final.y) : (b.lookTarget ? pl(b.lookTarget.x, b.lookTarget.y) : "по ходу")) +
        " · задача «" + (b.post ? b.post.tag : "—") + "»" + (b._task ? " (уровень " + b._task.lv + ")" : "") + (b.nadeTask ? " · граната: " + b.nadeTask.type + " — " + (b.nadeTask.why || "") : ""));
      if(b._ldArb && b._ldArb.length) L.push("  Арбитр взгляда (уровень · вид · вес): " + b._ldArb.slice().sort(function(x, y){ return y.lvl - x.lvl || y.sc - x.sc; }).slice(0, me ? 8 : 4)
        .map(function(c){ return c.lvl + "·" + LDk(c.kind) + "·" + R2(c.sc) + (c.pt ? "→" + pl(c.pt.x, c.pt.y) : ""); }).join(" | "));
      if(P && P.cands && P.cands.length){
        L.push("  Варианты угла (балл = произведение множителей), " + sec(P.tick, T) + " с назад:");
        P.cands.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, me ? 8 : 3).forEach(function(c){
          L.push("    " + (c.j === P.pick ? "▶ " : "  ") + ldCandName(c) + (c.pt ? " → " + pl(c.pt.x, c.pt.y) : "") + " · " + R2(c.sc) + (me && c.f ? "  = " + c.f.map(function(q){ return q[0] + " " + R2(q[1]); }).join(" × ") : "")); });
        if(me && P.why && P.why.length) P.why.forEach(function(w){ L.push("    · " + w); });
      }
      // источники знания
      var src = [], hs = b.heardSound;
      if(hs && tick - hs.tick < 6*TICK_HZ) src.push((hs.team && hs.team !== b.team ? "слышал врага" : "слышал") + " (" + (hs.kind || "звук") + ") " + pl(hs.x, hs.y) + " " + sec(hs.tick, tick) + " с");
      if(b.lastIntel && tick - b.lastIntel.tick < 10*TICK_HZ) src.push("инфа " + pl(b.lastIntel.x, b.lastIntel.y) + " " + sec(b.lastIntel.tick, tick) + " с (" + (b.lastIntel.src || "") + ")");
      var BL = beliefLast[b.team] || {}; for(var e in BL){ var q = BL[e]; if(!q || tick - q.tick > 15*TICK_HZ) continue; var eb = bots.filter(function(o){ return o.id === e; })[0]; if(!eb || !eb.alive) continue;
        src.push("команда " + (lkpWord(q) === "видели" ? "видела " : "слышала ") + nick(e) + " " + pl(q.x, q.y) + " " + sec(q.tick, tick) + " с"); }
      if(tick < (b.blindUntil||0)) src.push("ослеплён ещё " + ((b.blindUntil-tick)/TICK_HZ).toFixed(1) + " с");
      L.push("  Знает: " + (src.length ? src.join("; ") : "свежего ничего"));
      var Z = b._ldZones || {}, zl = Object.keys(Z).map(function(j){ return [+j, Z[j]]; }).filter(function(r){ return (r[1].th||0) > 0.005; }).sort(function(x, y){ return (y[1].th||0) - (x[1].th||0); }).slice(0, me ? 10 : 4);
      if(zl.length) L.push("  Опасность зон (откуда могут прийти): " + zl.map(function(r){ return zn(r[0]) + (r[1].entry ? " (вход)" : "") + " " + R2(r[1].th) + " [враг тут " + R2(r[1].bel || 0) + "]"; }).join("; "));
      if(me){ var sk = Object.keys(Z).filter(function(j){ return Z[j].skip && Z[j].skip !== "угрозы нет"; }).map(function(j){ return zn(+j) + " — " + Z[j].skip; });
        if(sk.length) L.push("  Не рассматривал: " + sk.join("; ")); }
    });
    LOOKDBG.on = false;
    return L.join("\n");
  } + ')')(pre, snap, botId || null, every), [pre, snap, botId || null, +(opt.every || 16)]);
  console.log(out);
  await br.close();
})();
