#!/bin/bash
# Сыграть 8 воспроизводимых матчей и сохранить отпечатки.
# bash tools/measure/fingerprint.sh <sim.html> <папка_вывода>
# Сравнить два прогона: diff -r <папка1> <папка2> (пусто = поведение не изменилось)
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$(dirname "$HERE")")"
SIM="$(realpath "$1")"; OUT="$2"; mkdir -p "$OUT"
for m in 3 7 11 13 17 19 23 29; do
  node "$ROOT/src/q.js" "$SIM" "$(sed "s/__M__/$m/" "$HERE/fingerprint.js")" > "$OUT/fp_$m.json" &
done
wait
