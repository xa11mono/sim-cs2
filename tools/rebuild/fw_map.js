// (15.11, перестройка, фаза 2) живая карта «кто пишет поля бота» — по записям ловца field_watch.js (прогон на ПК, fw_<m>.json.gz).
// Стек ловца — «кто<-откуда»; безымянный кадр «@строка» (строка собранной страницы) переводится в имя функции, внутри которой стоит
// эта строка (ближайшая именованная). Страница — та же сборка, что гонялась (build.py на ref задания).
// Запуск: node tools/rebuild/fw_map.js <страница.html> <папка с fw_*.json(.gz)> [ещё пара страница папка ...] > rebuild/gen/fields_live.md
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const acorn = require(process.env.ACORN || "acorn"), walk = require(process.env.ACORN_WALK || "acorn-walk");

function funcIndex(html){
  // все <script> без src: начало — номер строки страницы; внутри — функции с именем и диапазоном строк
  const out = [], re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m;
  while((m = re.exec(html))){
    const line0 = html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length - 1;
    let ast; try { ast = acorn.parse(m[1], {ecmaVersion: "latest", locations: true, sourceType: "script", allowReturnOutsideFunction: true}); }
    catch(e){ continue; }
    walk.fullAncestor(ast, (n, st, anc) => {
      if(!/Function/.test(n.type)) return;
      let name = n.id && n.id.name;
      if(!name){ const p = anc[anc.length - 2];
        if(p && p.type === "VariableDeclarator" && p.id.name) name = p.id.name;
        else if(p && p.type === "AssignmentExpression") name = (p.left.property && p.left.property.name) || p.left.name;
        else if(p && p.type === "Property" && p.key) name = p.key.name || p.key.value; }
      if(name) out.push({name, a: n.loc.start.line + line0, b: n.loc.end.line + line0});
    });
  }
  return out;
}
function nameAt(idx, line){
  let best = null;
  for(const f of idx) if(f.a <= line && line <= f.b && (!best || f.b - f.a < best.b - best.a)) best = f;
  return best ? best.name : "?";
}
function readJson(f){ let s = fs.readFileSync(f); if(f.endsWith(".gz")) s = zlib.gunzipSync(s); return JSON.parse(s.toString("utf8")); }

const args = process.argv.slice(2), W = {}, C = {}; let maps = [];
for(let i = 0; i + 1 < args.length; i += 2){
  const idx = funcIndex(fs.readFileSync(args[i], "utf8")), dir = args[i + 1]; maps.push(path.basename(dir));
  for(const f of fs.readdirSync(dir).filter(f => /^fw_\d+\.json(\.gz)?$/.test(f))){
    const d = readJson(path.join(dir, f));
    for(const field in d.w){ W[field] = W[field] || {};
      for(const k in d.w[field]){
        // «кто<-откуда»: безымянный кадр → функция по строке; «кто» и есть писатель (откуда — для справки)
        const fr = k.split("<-").map(x => x[0] === "@" ? nameAt(idx, +x.slice(1)) : x);
        const key = fr[0] + (fr[1] && fr[1] !== fr[0] ? " ← " + fr[1] : "");
        W[field][key] = (W[field][key] || 0) + d.w[field][k]; } }
    for(const field in d.c) C[field] = (C[field] || 0) + d.c[field];
  }
}
let md = "# Живая карта: кто пишет поля бота (генерируется — tools/rebuild/fw_map.js)\n\n" +
  "Источник — ловец `field_watch.js` на ПК (" + maps.join(", ") + "), 8 матчей каждой карты; доля — от всех записей поля (оценка: стек каждой 16-й записи).\n" +
  "«писатель ← кто вызвал». Хозяин — по `docs/ARCHITECTURE.md`.\n";
for(const field of Object.keys(W)){
  const L = Object.entries(W[field]).sort((a, b) => b[1] - a[1]), tot = L.reduce((s, x) => s + x[1], 0);
  md += "\n## `" + field + "` — записей ≈ " + tot.toLocaleString("ru") + ", смен значения " + (C[field] || 0).toLocaleString("ru") + "\n\n| писатель | доля |\n|---|---|\n";
  for(const [k, v] of L){ const p = 100 * v / tot; if(p < 0.1) continue; md += "| " + k + " | " + (p < 1 ? p.toFixed(1) : Math.round(p)) + " % |\n"; }
}
process.stdout.write(md);
