// (Р2.0, владелец 25.11: «перед переносом любых изменений в main обязательно проверять сборку результирующего дерева main»)
// Перенос документов перестройки в main: дерево origin/main во временной папке + файлы из текущей ветки → проверки сборки этого дерева →
// (только с --push и только если всё прошло) коммит и пуш в main. Списки сборки rebuild/ (modules.json, files.json, owners.json,
// var_cats.json) не переносятся никогда: их читает сборка, в main они следуют коду main (AGENTS.md §4).
//   node tools/rebuild/to_main.js [пути…] [--push] [-m "сообщение"]   (по умолчанию: rebuild AGENTS.md CLAUDE.md 00_PLAN.md CHANGELOG.md)
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.resolve(__dirname, "..", ".."), PY = process.platform === "win32" ? "python" : "python3";
const argv = process.argv.slice(2), PUSH = argv.includes("--push"), mi = argv.indexOf("-m");
const MSG = mi >= 0 ? argv[mi + 1] : "Перестройка: документы из " + git(["branch", "--show-current"]).trim() + " — без кода игры";
const paths = argv.filter((a, i) => !a.startsWith("--") && a !== "-m" && argv[i - 1] !== "-m");
const PATHS = paths.length ? paths : ["rebuild", "AGENTS.md", "CLAUDE.md", "00_PLAN.md", "CHANGELOG.md"];
const BUILD_LISTS = ["rebuild/modules.json", "rebuild/files.json", "rebuild/owners.json", "rebuild/var_cats.json"];

function git(a, cwd) { const r = cp.spawnSync("git", a, { cwd: cwd || ROOT, encoding: "utf8" }); if (r.status) throw new Error("git " + a.join(" ") + ": " + r.stderr); return r.stdout; }
function run(cmd, a, cwd) { const r = cp.spawnSync(cmd, a, { cwd, encoding: "utf8" }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; }

git(["fetch", "-q", "origin", "main"]);
const dirty = git(["status", "--porcelain", "--"].concat(PATHS)).trim();   // переносится закоммиченное — правки должны быть в коммите
if (dirty) { console.error("незакоммиченные правки в переносимых файлах — сначала коммит:\n" + dirty); process.exit(1); }
const wt = fs.mkdtempSync(path.join(os.tmpdir(), "tomain_")), branch = "tomain-" + Date.now(), res = [];
git(["worktree", "add", "-q", "-b", branch, wt, "origin/main"]);
let code = 1;
try {
  git(["checkout", git(["rev-parse", "HEAD"]).trim(), "--"].concat(PATHS), wt);
  for (const f of BUILD_LISTS) { try { git(["checkout", "origin/main", "--", f], wt); } catch (e) { /* в main нет — нет и у нас */ } }
  const changed = git(["diff", "--cached", "--name-only"], wt).split("\n").filter(Boolean);
  // чужие правки в main не перезаписывать: база — последняя версия файла в main, которая есть и в истории ветки; трёхстороннее слияние
  // (ветка, база, main) обязано дать ровно файл ветки — значит все правки main уже в ветке. Иначе — сначала забрать их в ветку
  const blobsOf = (ref, f) => git(["log", "--format=%H", ref, "--", f]).split("\n").filter(Boolean)
    .map(c => { try { return git(["rev-parse", c + ":" + f]).trim(); } catch (e) { return null; } }).filter(Boolean);
  const foreign = changed.filter(f => {
    let mb; try { mb = git(["rev-parse", "origin/main:" + f]).trim(); } catch (e) { return false; }   // в main файла нет — новый
    const mine = new Set(blobsOf("HEAD", f)); if (mine.has(mb)) return false;                          // main просто отстал
    const base = blobsOf("origin/main", f).find(b => mine.has(b)); if (!base) return true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tomain_m_")), w = n => { const q = path.join(tmp, n); return q; };
    fs.writeFileSync(w("base"), git(["cat-file", "blob", base])); fs.writeFileSync(w("main"), git(["cat-file", "blob", mb]));
    const ours = git(["show", "HEAD:" + f]); fs.writeFileSync(w("ours"), ours);
    const r = cp.spawnSync("git", ["merge-file", "-p", w("ours"), w("base"), w("main")], { encoding: "utf8" });
    const same = r.status === 0 && r.stdout === ours;
    fs.rmSync(tmp, { recursive: true, force: true }); return !same;
  });
  if (foreign.length) throw new Error("в main эти файлы правил кто-то другой (их версии нет в истории ветки) — сначала забрать правки в ветку:\n  " + foreign.join("\n  "));
  const notDoc = changed.filter(f => !PATHS.some(p => f === p || f.startsWith(p.replace(/\/?$/, "/"))));
  if (notDoc.length) throw new Error("в перенос попали файлы не из списка: " + notDoc.join(", "));
  console.log("переносится файлов: " + changed.length + (changed.length ? " (" + changed.slice(0, 8).join(", ") + (changed.length > 8 ? ", …" : "") + ")" : ""));
  if (!changed.length) { console.log("в main уже то же — переносить нечего"); code = 0; }
  else {
    // проверки результирующего дерева main: устройство (gen_maps --check) и сборка обеих карт; пакеты сборки — общие с рабочей папкой
    const nm = path.join(ROOT, "tools", "rebuild", "node_modules"), nmw = path.join(wt, "tools", "rebuild", "node_modules");
    if (fs.existsSync(nm) && !fs.existsSync(nmw)) fs.symlinkSync(nm, nmw, "junction");
    res.push(["gen_maps --check", run("node", [path.join(wt, "tools", "rebuild", "gen_maps.js"), "--check"], wt)]);
    for (const m of ["ancient", "mirage"]) res.push(["сборка " + m, run(PY, [path.join(wt, "src", "build.py"), "--map", m, path.join(wt, ".tmp_tomain_" + m + ".html")], wt)]);
    res.forEach(([n, r]) => console.log((r.code === 0 ? "✓ " : "✗ ") + n + (r.code ? "\n" + r.out.split("\n").slice(-6).join("\n") : "")));
    git(["checkout", "--", "data"], wt);   // сборка могла пересчитать отпечаток подбора бросков — в перенос не идёт
    const ok = res.every(([, r]) => r.code === 0);
    if (!ok) console.log("сборка дерева main не прошла — перенос отменён");
    else if (!PUSH) { console.log("проверки дерева main пройдены; для переноса — тот же вызов с --push"); code = 0; }
    else { git(["commit", "-q", "-m", MSG], wt); git(["push", "-q", "origin", "HEAD:main"], wt); console.log("main ← " + git(["rev-parse", "--short", "HEAD"], wt).trim()); code = 0; }
  }
} catch (e) { console.error(String(e.message || e)); }
finally {
  try { fs.unlinkSync(path.join(wt, "tools", "rebuild", "node_modules")); } catch (e) {}
  cp.spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: ROOT }); cp.spawnSync("git", ["branch", "-D", branch], { cwd: ROOT });
}
process.exit(code);
