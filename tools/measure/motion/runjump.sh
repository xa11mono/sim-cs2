#!/bin/bash
# прыжки на бегу у ботов против про: bash tools/measure/motion/runjump.sh <папка>
O=${1:-/tmp/rj}; mkdir -p "$O"; D=tools/measure/motion
python3 src/build.py --map mirage "$O/mk.html" >/dev/null 2>&1
for M in "[3,7]" "[11,13]" "[17,19]" "[23,29]"; do python3 -c "import sys;print(open('$D/bot_runjump.js.txt').read().replace('__M__','$M'))" > "$O/q_${M//[^0-9]/_}.txt"
  (timeout 3000 node --max-old-space-size=2500 $D/ev.js "$O/mk.html" "$(cat $O/q_${M//[^0-9]/_}.txt)" | tail -1 > "$O/brj_${M//[^0-9]/_}.json") & done; wait
python3 $D/bot_runjump_sum.py "$O"
