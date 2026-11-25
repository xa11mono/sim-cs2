#!/usr/bin/env bash
# (Р2.3, 25.11) Цепочка шагов замены: каждая функция — шаг tools/dmath/step.sh, сводка step_report.js, доказательство в
# rebuild/evidence/R2/r2.3_<N>_<f>.json, строка журнала и отдельный коммит. Остановка (без коммита шага): подмена не бит в бит или
# первый различный вызов — не заменённая функция / другие аргументы (rebuild/MASTER_PLAN.md Р2, «Остановка»).
#   bash tools/dmath/steps_chain.sh <папка> <прежний_ancient.html> <прежний_mirage.html> <N первого шага> f1 f2 …
set -u
D=$1; PA=$2; PM=$3; N=$4; shift 4
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"
for F in "$@"; do
  echo "=== шаг $N: $F"
  bash tools/dmath/step.sh "$F" "$D" "$PA" "$PM" 8000 || { echo "СТОП: шаг $F не выполнился"; exit 1; }
  node tools/dmath/step_report.js "$F" "$D" "$D/${F}_report.json" > /dev/null
  CALLS=$(git diff --stat -- src/game | tail -1)
  node -e '
    const fs = require("fs"), [F, N, D, calls] = process.argv.slice(1), r = JSON.parse(fs.readFileSync(D + "/" + F + "_report.json", "utf8"));
    let ok = true, why = [];
    for (const [m, o] of Object.entries(r.maps)) {
      if (!o.shim || !o.shim.same) { ok = false; why.push(m + ": подмена не бит в бит"); }
      if (o.real && o.real.diverges) { const a = o.real.attribution;
        if (!a || !a.sameFunction || !a.isReplaced || !a.sameArgs) { ok = false; why.push(m + ": расхождение не через " + F + " с теми же аргументами"); } }
    }
    r.step = "Р2.3 шаг " + N + " — " + F; r.engine = "chromium 158 (облако)"; r.ticks = 8000; r.diff = calls;
    r.result = ok ? "Э3 (или Э1 в окне 8000 тиков, если шаг не расходится): подмена бит в бит; расхождение — только через заменённую функцию" : "СТОП: " + why.join("; ");
    fs.writeFileSync("rebuild/evidence/R2/r2.3_" + N + "_" + F + ".json", JSON.stringify(r, null, 1));
    const line = m => { const o = r.maps[m]; return m + " — " + (o.real && o.real.diverges ? "тик " + o.real.tick + ", " + F + " с теми же аргументами, " + o.real.attribution.ulps + " ulp" : "не расходится до 8000"); };
    if (ok) fs.appendFileSync("rebuild/JOURNAL.md", "- 25.11.2026 — Р2.3 шаг " + N + ": `Math." + F + "` → `DM." + F + "` (" + calls.trim() + "). Подмена — бит в бит до 8000 (обе карты); шаг: " + line("ancient") + "; " + line("mirage") + " (`r2.3_" + N + "_" + F + ".json`).\n");
    console.log(r.result); process.exit(ok ? 0 : 1);
  ' "$F" "$N" "$D" "$CALLS" || { echo "СТОП на шаге $F — без коммита; разбор: $D/${F}_*.txt"; exit 1; }
  git add -A src/game data/maps rebuild && git commit -qm "v599a Р2.3 шаг $N: Math.$F → DM.$F — подмена бит в бит, расхождение только через $F (доказательство r2.3_${N}_$F.json)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UiJ4aXHJRMppFy9kFnqu91" && git push -q origin v599a
  echo "коммит $(git rev-parse --short HEAD)"
  PA="$D/${F}_ancient.html"; PM="$D/${F}_mirage.html"; N=$((N + 1))
done
echo "цепочка завершена"
