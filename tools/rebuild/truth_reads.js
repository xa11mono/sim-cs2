// (Р3.2, канал «знание»; приёмка Р3 / Р8 №2 «решения не читают истину врага») статический поиск чтений истины врага в коде решений.
// Место — обход списка всех игроков (bots.forEach / filter / some / find / map / every / reduce / findIndex и цикл for по bots[i]),
// в котором элемент отобран как ВРАГ (сторона элемента ≠ сторона действующего / = сторона врага) и читается поле истины
// (положение, HP, инвентарь, намерение — TRUTH). Своих и всех без разбора не считает. Восприятие и движок (видимость, звук,
// физика, экономика, показ — PERCEPTION) читают истину по должности — не нарушение.
// Выход: rebuild/gen/truth_reads.json (все места); --check — сравнение с реестром известных мест rebuild/truth_known.json:
// новое место (функция + набор полей) — код 1. Известное место — с причиной и записью в BEHAVIOR_BACKLOG (исправление меняет поведение —
// после Р8). Сторона литералом ("T" / "CT") или неясная — место «к разбору» (тоже в реестре; новое — код 1).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const acorn = require('acorn'), walk = require('acorn-walk');
const SRC = require('./game_src.js');
const TRUTH = new Set(['x', 'y', 'z', 'baseX', 'baseY', 'hp', 'armor', 'armorHp', 'helmet', 'weapon', 'primary', 'secondary', 'nades', 'nadeTask',
  'post', 'state', 'path', 'pathIdx', 'facing', 'holding', 'crouching', 'walking', 'curSpeed', '_task', 'money', 'kit', 'planting', 'defusing',
  'lookTarget', 'heading', 'tRole', 'role']);
const IT = new Set(['forEach', 'filter', 'some', 'find', 'map', 'every', 'reduce', 'findIndex']);
// восприятие и движок: читают истину по должности (файл:функция или файл целиком)
const PERCEPTION = {
  '510': ['engSee'],                                        // кто кого видит
  '540': ['stepTick'],                                      // движок: столкновения, шаги
  '400': ['nadeOrigin', 'detonate'],                        // физика гранат: кого задело
  '120': ['defuseSound', 'bombTick'],                       // источник звука (кто слышит — hearReal)
  '450': ['itemPickupTick'],                                // подбор: кто стоит на предмете
  '520': ['payRoundEconomy']                                // экономика: начисление по правилам
};
// хозяева решений и записи бота: элемент, переданный им первым аргументом, — действующий
const ACTOR_FN = /^(setPost|setPostR|clearPost|assignNade|assignNadeR|nadeCancel|fightState|fightReset|fightHoldOff|movePath|moveWalk|moveSpeed|lookFace|lookTurnBy|placeStance|dlog|voiceLog|noteMistake|startRoute|fcEnd|knowCall|teamNotice|throwNade|selfNade|stagePost)$/;
const ENEMY_X = /^(foe|foeT|enemy|enemyTeam|enT|eT|opp|oppT|other|otherT|ot|ft|eTeam)$|\bfoe|\benemy|\bopp/;
function sideOf(src, node) {   // сторона, с которой сравнивают: own — своя действующего, enemy — враг, lit — литерал, ? — неясно
  const t = src.slice(node.start, node.end).trim();
  if (node.type === 'Literal') return 'lit';
  if (ENEMY_X.test(t)) return 'enemy';
  if (node.type === 'ConditionalExpression') return /["']T["']\s*\?\s*["']CT["']|["']CT["']\s*\?\s*["']T["']/.test(t) ? 'enemy' : '?';
  if (/\.team$/.test(t) || /^(team|myTeam|side|tm|T0|own|ownT)$/.test(t)) return 'own';
  return '?';
}
// граф вызовов по именам функций (все файлы игры): из какого мозга достижима функция — для стороны литералом ("T" внутри кода,
// достижимого только из tBrain, — своя; "CT" — враг; и наоборот для ctBrain)
function brainOf() {
  const calls = {}, callers = {};
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { let ast;
    try { ast = acorn.parse(SRC.readGame(f), { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); } catch (e) { continue; }
    walk.simple(ast, { FunctionDeclaration(fd) { const c = calls[fd.id.name] = calls[fd.id.name] || new Set();
      walk.simple(fd.body, { CallExpression(e) { if (e.callee.type === 'Identifier') c.add(e.callee.name); } }); } }); }
  for (const [n, c] of Object.entries(calls)) for (const m of c) (callers[m] = callers[m] || new Set()).add(n);
  const memo = {};
  return fn => { if (memo[fn]) return memo[fn]; const seen = new Set(), out = new Set(), st = [fn];
    while (st.length) { const f = st.pop(); if (seen.has(f)) continue; seen.add(f);
      if (f === 'tBrain' || f === 'ctBrain') { out.add(f === 'tBrain' ? 'T' : 'CT'); continue; }
      const cs = callers[f]; if (!cs || !cs.size) { out.add('?'); continue; } cs.forEach(c => st.push(c)); }
    return (memo[fn] = out.size === 1 && !out.has('?') ? [...out][0] : null); };
}
// (вид 2) бомба в коде CT: место бомбы (x / y / z) и носитель — истина, пока CT её не видел; знание CT о бомбе — ctBombPos (180: видели —
// точно, иначе по писку с шумом). Функции, достижимые только из ctBrain (сама модель знания — тоже: не заложенная бомба там — точно)
function bombReads(BR) {
  const out = [];
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { if (+f.slice(0, 3) < 100 || +f.slice(0, 3) >= 545) continue; let ast;
    try { ast = acorn.parse(SRC.readGame(f), { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }); } catch (e) { continue; }
    walk.simple(ast, { FunctionDeclaration(fd) { const fn = fd.id.name; if (BR(fn) !== 'CT') return;
      const props = new Set(); let line = 0;
      walk.simple(fd.body, { MemberExpression(m) { if (m.object.type === 'Identifier' && m.object.name === 'bomb' && !m.computed && /^(x|y|z|carrier)$/.test(m.property.name)) { props.add(m.property.name); line = line || m.loc.start.line; } } });
      if (props.size) out.push({ file: f, fn: fn, line, props: ['bomb.' + [...props].sort().join(',')], kind: 'бомба', perception: false }); } });
  }
  return out;
}
function analyze() {
  const sites = [], BR = brainOf();
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) {
    const num = f.slice(0, 3); if (+num < 100 || +num >= 545) continue;   // решения: 100–535 (до движка 540 и показа 550+)
    const src = SRC.readGame(f); let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }); } catch (e) { continue; }
    const consider = (fnNode, p, line, anc, call) => {
      // проверки стороны элемента p и их полярность внутри тела
      let enemy = false, own = false, unclear = false, actor = false;
      // элемент — действующий бот (реагирует сам: пишет свои поля или его решение уходит хозяину) — не чтение чужой истины
      walk.simple(fnNode.body, {
        AssignmentExpression(ae) { let l = ae.left; while (l.type === 'MemberExpression') { if (l.object.type === 'Identifier' && l.object.name === p) { actor = true; break; } l = l.object; } },
        UpdateExpression(ue) { if (ue.argument.type === 'MemberExpression' && ue.argument.object.type === 'Identifier' && ue.argument.object.name === p) actor = true; },
        CallExpression(ce) { if (ce.callee.type === 'Identifier' && ACTOR_FN.test(ce.callee.name) && ce.arguments[0] && ce.arguments[0].type === 'Identifier' && ce.arguments[0].name === p) actor = true; } });
      if (actor) return;
      walk.ancestor(fnNode.body, { BinaryExpression(be, a2) {
        if (a2.slice(0, -1).some(n => n !== fnNode && /Function/.test(n.type))) return;   // проверки во вложенных функциях — про другой элемент
        if (!/^[!=]==?$/.test(be.operator)) return;
        const isP = n => n.type === 'MemberExpression' && !n.computed && n.property.name === 'team' && n.object.type === 'Identifier' && n.object.name === p;
        let other = isP(be.left) ? be.right : isP(be.right) ? be.left : null; if (!other) return;
        let neg = be.operator[0] === '!';   // p.team != X
        // полярность по предкам до тела колбэка: ! — переворот; условие if с ранним return / continue — «пропустить» (переворот)
        for (let i = a2.length - 2; i >= 0; i--) { const n = a2[i], ch = a2[i + 1];
          if (n === fnNode.body) break;
          if (n.type === 'UnaryExpression' && n.operator === '!') neg = !neg;
          if (n.type === 'IfStatement' && n.test === ch) { const c = n.consequent, s0 = c.type === 'BlockStatement' ? c.body[0] : c;
            if (s0 && (s0.type === 'ReturnStatement' || s0.type === 'ContinueStatement')) neg = !neg; break; }
          if (n.type === 'ConditionalExpression' && n.test === ch) { unclear = true; break; } }
        let sd = sideOf(src, other);
        if (sd === 'lit') { const top = anc.slice().reverse().find(a => a.type === 'FunctionDeclaration'), br = top ? BR(top.id.name) : null;
          sd = br && other.value === br ? 'own' : br && (other.value === 'T' || other.value === 'CT') ? 'enemy' : 'lit'; }
        if (sd === 'own') { if (neg) enemy = true; else own = true; }
        else if (sd === 'enemy') { if (neg) own = true; else enemy = true; }
        else unclear = true;
      } });
      if (!enemy && !unclear) return;
      const props = new Set();
      walk.simple(fnNode.body, { MemberExpression(m) { if (m.object.type === 'Identifier' && m.object.name === p && !m.computed && TRUTH.has(m.property.name)) props.add(m.property.name); } });
      // отобранные фильтром враги дальше: по цепочке (bots.filter(…).map(o => o.x), …[0].x) и через переменную (var E = bots.filter(…); E.forEach / E[i].x)
      if (call && /^(filter|find)$/.test(call.callee.property.name)) downstream(call, anc, props, call.callee.property.name === 'find');
      if (!props.size) return;
      const top = anc.slice().reverse().find(a => a.type === 'FunctionDeclaration'), fn = top ? top.id.name : '(загрузка)';
      const perc = (PERCEPTION[num] || []).includes(fn);
      sites.push({ file: f, fn, line, props: [...props].sort(), kind: enemy && !own ? 'враг' : 'к разбору', perception: perc });
    };
    const readsOf = (fn2, props) => { const q = fn2.params[0]; if (!q || q.type !== 'Identifier') return;
      walk.simple(fn2.body, { MemberExpression(m) { if (m.object.type === 'Identifier' && m.object.name === q.name && !m.computed && TRUTH.has(m.property.name)) props.add(m.property.name); } }); };
    const downstream = (call, anc, props, single) => {
      // вверх по цепочке методов массива
      let node = call, i = anc.length - 2;
      while (i >= 0) { const par = anc[i];
        if (par.type === 'MemberExpression' && par.object === node) {
          if (par.computed || single) { const pp = anc[i - 1]; if (pp && pp.type === 'MemberExpression' && pp.object === par && !pp.computed && TRUTH.has(pp.property.name)) props.add(pp.property.name);
            if (single && !par.computed && TRUTH.has(par.property.name)) props.add(par.property.name); break; }
          const cc = anc[i - 1]; if (cc && cc.type === 'CallExpression' && cc.callee === par) { if (IT.has(par.property.name) && cc.arguments[0] && /Function/.test(cc.arguments[0].type)) readsOf(cc.arguments[0], props);
            if (/^(filter|sort|slice|concat)$/.test(par.property.name)) { node = cc; i -= 2; continue; } }
          break; }
        if (par.type === 'VariableDeclarator' && par.init === node && par.id.type === 'Identifier') { varReads(par.id.name, anc, props, single); break; }
        if (par.type === 'AssignmentExpression' && par.right === node && par.left.type === 'Identifier') { varReads(par.left.name, anc, props, single); break; }
        break; }
    };
    const varReads = (V, anc, props, single) => {
      const scope = anc.slice().reverse().find(a => /Function/.test(a.type)); if (!scope) return;
      walk.simple(scope.body, {
        CallExpression(cc) { const ce = cc.callee; if (ce.type === 'MemberExpression' && ce.object.type === 'Identifier' && ce.object.name === V && IT.has(ce.property.name) && cc.arguments[0] && /Function/.test(cc.arguments[0].type)) readsOf(cc.arguments[0], props); },
        MemberExpression(m) { if (!m.computed && TRUTH.has(m.property.name)) { const o = m.object;
          if (single && o.type === 'Identifier' && o.name === V) props.add(m.property.name);
          if (o.type === 'MemberExpression' && o.computed && o.object.type === 'Identifier' && o.object.name === V) props.add(m.property.name); } } });
    };
    walk.ancestor(ast, {
      CallExpression(c, anc) { const ce = c.callee;
        if (ce.type !== 'MemberExpression' || ce.object.type !== 'Identifier' || ce.object.name !== 'bots' || !IT.has(ce.property.name)) return;
        const fn = c.arguments[0]; if (!fn || !/Function/.test(fn.type)) return;
        const pi = ce.property.name === 'reduce' ? 1 : 0; if (!fn.params[pi] || fn.params[pi].type !== 'Identifier') return;
        consider(fn, fn.params[pi].name, c.loc.start.line, anc, c); },
      ForStatement(fs_, anc) {   // for(...){ var o = bots[i]; ... }
        const b = fs_.body; if (!b || b.type !== 'BlockStatement') return;
        for (const st of b.body.slice(0, 2)) { if (st.type !== 'VariableDeclaration') continue;
          for (const d of st.declarations) if (d.init && d.init.type === 'MemberExpression' && d.init.computed && d.init.object.type === 'Identifier' && d.init.object.name === 'bots' && d.id.type === 'Identifier')
            consider({ body: b }, d.id.name, fs_.loc.start.line, anc); } }
    });
  }
  return sites.concat(bombReads(BR));
}
const key = s => s.file.slice(0, 3) + ':' + s.fn + ':' + s.props.join(',');
// сверка с реестром известных мест: новое место или больше мест у ключа — ошибка; ушедшее из кода — напоминание убрать строку
function check(sites) {
  sites = sites || analyze(); const dec = sites.filter(s => !s.perception), lines = [];
  const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'truth_known.json'), 'utf8')).known || {}, by = {};
  dec.forEach(s => (by[key(s)] = by[key(s)] || []).push(s));
  let bad = 0;
  for (const [k, L] of Object.entries(by)) if (!K[k] || L.length > (K[k].n || 1)) { bad += L.length - (K[k] ? K[k].n || 1 : 0);
    L.forEach(s => lines.push('  ✗ НОВОЕ чтение истины врага в решении: ' + s.file + ':' + s.line + ' ' + s.fn + ' — ' + s.props.join(', ') + ' (' + s.kind + '; реестр rebuild/truth_known.json)')); }
  Object.keys(K).filter(k => !by[k]).forEach(k => lines.push('  ушло из кода — убрать строку из rebuild/truth_known.json: ' + k));
  const ist = Object.values(K).filter(v => v.class === 'истина').length;
  lines.unshift('чтения истины врага (решения): мест ' + dec.length + ', новых ' + bad + '; известных нарушений «истина» ' + ist + ' (BEHAVIOR_BACKLOG, после Р8)');
  return { bad, lines };
}
if (require.main === module) {
  const sites = analyze(), out = path.join(ROOT, 'rebuild', 'gen', 'truth_reads.json');
  const dec = sites.filter(s => !s.perception);
  fs.writeFileSync(out, JSON.stringify({ _: 'генерируется tools/rebuild/truth_reads.js: чтения истины врага в коде решений (perception — восприятие / движок, не нарушение)', sites }, null, 1) + '\n');
  if (process.argv.includes('--check')) { const r = check(sites); r.lines.forEach(l => console.log(l)); process.exit(r.bad ? 1 : 0); }
  else {
    console.log('мест ' + sites.length + ' (решения ' + dec.length + ', восприятие ' + (sites.length - dec.length) + ')');
    dec.forEach(s => console.log(s.file.slice(0, 3) + ':' + s.line + ' ' + s.fn + ' [' + s.kind + '] ' + s.props.join(',')));
  }
}
module.exports = { analyze, key, check };
