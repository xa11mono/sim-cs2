#!/usr/bin/env bash
# (Р2.3, 25.11) Один шаг замены функции и его доказательство (rebuild/MASTER_PLAN.md Р2.3):
#   bash tools/dmath/step.sh <f> <папка> <прежний_ancient.html> <прежний_mirage.html> [тиков=8000]
# 1) замена Math.<f> → DM.<f> (tools/dmath/replace.js); 2) сборка обеих карт (подбор бросков пересчитывает сборка);
# 3) подмена: страница шага с DM.<f> = Math.<f> и прежним подбором бросков против прежней — обязана быть бит в бит;
# 4) причина: страница шага против прежней — первый расходящийся тик и первый различный вызов (--math: Math и DM).
# Итог — <папка>/<f>_*.{html,txt,json}; коммит делает человек / агент после разбора.
set -u
F=$1; D=$2; PA=$3; PM=$4; T=${5:-8000}
ROOT=$(cd "$(dirname "$0")/../.." && pwd); cd "$ROOT"; mkdir -p "$D"
[ "${SKIP_BUILD:-}" ] || node tools/dmath/replace.js "$F" || exit 1
[ "${SKIP_BUILD:-}" ] || for m in ancient mirage; do python3 src/build.py --map $m "$D/${F}_$m.html" > "$D/${F}_build_$m.log" 2>&1 || { echo "сборка $m не удалась"; exit 1; }; done
node tools/dmath/shim_page.js "$D/${F}_ancient.html" "$PA" "$D/${F}_shim_ancient.html" "$F" && node tools/dmath/shim_page.js "$D/${F}_mirage.html" "$PM" "$D/${F}_shim_mirage.html" "$F" || exit 1
for m in ancient mirage; do P=$PA; [ $m = mirage ] && P=$PM
  node tools/sim.js diverge "$P" "$D/${F}_shim_$m.html" --ticks=$T --out="$D/${F}_shim_$m.json" > "$D/${F}_shim_$m.txt" 2>&1 &
  node tools/sim.js diverge "$P" "$D/${F}_$m.html" --ticks=$T --math --out="$D/${F}_real_$m.json" > "$D/${F}_real_$m.txt" 2>&1 &
done
wait
for m in ancient mirage; do echo "== $F $m подмена: $(tail -1 "$D/${F}_shim_$m.txt" | cut -c1-200)"; echo "== $F $m шаг: $(grep -E 'ПЕРВОЕ|расхождения нет|Math:' "$D/${F}_real_$m.txt" | cut -c1-400 | tr '\n' ' ')"; done
