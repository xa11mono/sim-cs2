#!/bin/bash
# Замер движения ботов (облако): 4 процесса × 2 матча Mirage × 6 раундов, ~5,5 мин. Запуск из корня репо: bash tools/measure/motion/run.sh [папка]
O=${1:-/tmp/botmotion}; mkdir -p "$O"; D=tools/measure/motion
python3 src/build.py --map mirage "$O/mk.html" >/dev/null 2>&1
for M in "[3,7]" "[11,13]" "[17,19]" "[23,29]"; do C=$(cat $D/bot_motion.js.txt); C=${C/__M__/$M}; timeout 3000 node $D/ev.js "$O/mk.html" "$C" | tail -1 > "$O/bmo_${M//[^0-9]/_}.json" & done; wait
python3 $D/bot_motion_sum.py "$O"
