// Статический разбор src/game: функции, вызовы, поля бота (запись/чтение), глобальные переменные. Только читает.
"use strict";
const acorn = require("acorn"), walk = require("acorn-walk"), fs = require("fs"), path = require("path");
const ROOT = "/home/user/sim-cs2", GAME = path.join(ROOT, "src", "game");
const files = fs.readdirSync(GAME).filter(f => /\.(html|js)$/.test(f)).sort();
let all = "", spans = [];
for (const f of files) { const s = fs.readFileSync(path.join(GAME, f), "utf8"); spans.push([all.length, all.length + s.length, f]); all += s; }
const fileAt = pos => { for (const sp of spans) if (pos >= sp[0] && pos < sp[1]) return sp; return spans[spans.length - 1]; };
const lineCache = new Map();
const lineAt = pos => { const sp = fileAt(pos); return all.slice(sp[0], pos).split("\n").length; };
const blocks = [];
for (const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) blocks.push({ off: m.index + m[0].indexOf(">") + 1, src: m[1] });
const tops = []; const asts = []; const topVars = {};
for (const b of blocks) {
  const src = b.src.replace(/@@[A-Z_]+@@/g, m => "0".padEnd(m.length, " "));
  let ast; try { ast = acorn.parse(src, { ecmaVersion: "latest", allowReturnOutsideFunction: true, sourceType: "script" }); } catch (e) { console.error("parse fail", e.message); continue; }
  asts.push({ ast, off: b.off });
  const body = [];
  for (const st of ast.body) { body.push(st); if (st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && /Function/.test(st.expression.callee.type)) body.push(...st.expression.callee.body.body); }
  for (const st of body) {
    if (st.type === "FunctionDeclaration") tops.push({ name: st.id.name, s: st.start + b.off, e: st.end + b.off });
    if (st.type === "VariableDeclaration") for (const d of st.declarations) {
      if (d.id.type === "Identifier") { const p = d.start + b.off; topVars[d.id.name] = topVars[d.id.name] || fileAt(p)[2].slice(0, 3);
        if (d.init && /Function/.test(d.init.type)) tops.push({ name: d.id.name, s: d.start + b.off, e: d.end + b.off, arrow: 1 }); }
    }
  }
}
tops.sort((a, b) => a.s - b.s);
const fnAt = pos => { let r = null; for (const t of tops) if (pos >= t.s && pos < t.e) r = t; return r ? r.name : "(top)"; };
const F = {}; // name -> info
const dupes = {};
for (const t of tops) { const f = fileAt(t.s)[2].slice(0, 3); if (F[t.name]) (dupes[t.name] = dupes[t.name] || [F[t.name].file]).push(f);
  F[t.name] = { file: f, line: lineAt(t.s), end: lineAt(t.e), calls: {}, wr: {}, rd: {}, gw: {}, gr: {} }; }
const BOTP = new Set(["alive", "hp", "tRole", "team", "weapon", "baseX", "baseY", "nades", "primary", "money", "reactionTicks", "skill", "facing", "post", "path"]);
const NONBOT = new Set(["bomb", "it", "S", "RP", "HGT_C", "E", "MAPED", "DEMOV", "SANDBOX", "TEAM", "KNOW", "EXU", "OBS", "D3", "teamTac", "tt", "TT", "w", "n", "nd", "g", "z", "zone", "s", "sm", "smoke", "pl", "lp", "L", "ev", "m", "r", "res", "o", "c", "q", "h", "it2", "seg", "node", "e", "cfg", "st", "P", "info", "obj"]);
const BOTN = new Set(["b", "bot", "bt", "sh", "shooter", "target", "vic", "victim", "att", "killer", "mate", "me", "ally", "tm", "en", "enemy", "foe", "p", "t", "x", "other", "a", "bb", "carrier", "dead", "ent", "plr", "who", "thrower", "exec", "cand", "best", "lead", "ent2", "k"]);
const BOTN0 = new Set(["b", "bot", "bt", "sh", "shooter", "target", "vic", "victim", "att", "killer", "mate"]);
const rootOf = e => { while (e && e.type === "MemberExpression") { if (e.object.type === "Identifier" && e.object.name === "bots" && e.computed) return "#bot"; e = e.object; } return e && e.type === "Identifier" ? e.name : null; };
const botFnCache = new Map();
function isBotObj(tgtObj, anc, off) {
  const root = tgtObj.type === "Identifier" ? tgtObj.name : rootOf(tgtObj);
  if (!root) return false;
  if (root === "#bot") return true;
  if (tgtObj.type !== "Identifier") return false; // глубже (bot.post.x) — не поле бота
  if (NONBOT.has(root)) return false;
  for (let i = anc.length - 1; i >= 1; i--) { const a = anc[i], c = anc[i - 1];
    if (/Function/.test(a.type) && c.type === "CallExpression" && c.callee.type === "MemberExpression" && c.callee.object.type === "Identifier" && /^(bots|alive|mates|enemies|team|tms|T|CT|list|live)$/.test(c.callee.object.name) && a.params.some(q => q.name === root)) return true; }
  const fnNode = [...anc].reverse().find(a => /Function/.test(a.type));
  if (BOTN0.has(root)) return true;
  if (!fnNode) return BOTN.has(root);
  const key = fnNode.start + ":" + root;
  if (botFnCache.has(key)) return botFnCache.get(key);
  const props = new Set();
  walk.simple(fnNode, { MemberExpression(m) { if (!m.computed && m.object.type === "Identifier" && m.object.name === root) props.add(m.property.name); } });
  let n = 0; for (const p of props) if (BOTP.has(p)) n++;
  const r = n >= 1 && (BOTN.has(root) || n >= 2);
  botFnCache.set(key, r); return r;
}
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const topNames = new Set(Object.keys(F));
for (const { ast, off } of asts) walk.fullAncestor(ast, (n, _st, anc) => {
  const pos = n.start + off; const fn = fnAt(pos); const fi = F[fn] || (F[fn] = { file: "top", calls: {}, wr: {}, rd: {}, gw: {}, gr: {} });
  if (n.type === "CallExpression" && n.callee.type === "Identifier" && topNames.has(n.callee.name)) inc(fi.calls, n.callee.name);
  if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.type === "Identifier" && topNames.has(n.callee.object.name) && !n.callee.computed && /^(apply|call|bind)$/.test(n.callee.property.name)) inc(fi.calls, n.callee.object.name);
  // ссылка на функцию как значение (обратный вызов) — тоже связь
  if (n.type === "Identifier" && topNames.has(n.name)) { const p = anc[anc.length - 2]; if (p && p.type === "CallExpression" && p.arguments.includes(n)) inc(fi.calls, n.name); }
  if (n.type === "AssignmentExpression" || n.type === "UpdateExpression") {
    const tgt = n.type === "AssignmentExpression" ? n.left : n.argument;
    if (tgt.type === "MemberExpression" && !tgt.computed && isBotObj(tgt.object, anc, off)) inc(fi.wr, tgt.property.name);
    if (tgt.type === "Identifier" && topVars[tgt.name] && !isShadow(tgt.name, anc)) inc(fi.gw, tgt.name);
    if (tgt.type === "MemberExpression") { const r = rootOf(tgt); if (r && topVars[r] && !isShadow(r, anc) && r !== "bots") inc(fi.gw, r + ".*"); }
  }
  if (n.type === "MemberExpression" && !n.computed) { const p = anc[anc.length - 2];
    const isW = p && ((p.type === "AssignmentExpression" && p.left === n) || (p.type === "UpdateExpression"));
    if (!isW && isBotObj(n.object, anc, off)) inc(fi.rd, n.property.name); }
  if (n.type === "Identifier" && topVars[n.name]) { const p = anc[anc.length - 2];
    const isW = p && ((p.type === "AssignmentExpression" && p.left === n) || p.type === "UpdateExpression" || p.type === "VariableDeclarator");
    const isKey = p && ((p.type === "MemberExpression" && p.property === n && !p.computed) || (p.type === "Property" && p.key === n && !p.computed));
    if (!isW && !isKey && !isShadow(n.name, anc)) inc(fi.gr, n.name); }
});
function isShadow(name, anc) { // локальная переменная / параметр с тем же именем
  for (let i = anc.length - 1; i >= 0; i--) { const a = anc[i];
    if (/Function/.test(a.type) && a.params.some(q => q.type === "Identifier" && q.name === name)) return true; }
  return false;
}
fs.writeFileSync(process.argv[2] || "an.json", JSON.stringify({ F, dupes, topVars }, null, 0));
console.log("functions", Object.keys(F).length, "dupes", Object.keys(dupes).length, "topVars", Object.keys(topVars).length);
