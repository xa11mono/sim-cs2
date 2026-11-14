#!/bin/bash
# В147: форма движения ботов против про (облако): 4 процесса × 2 матча Mirage × R раундов → bshape_*.json → tools/motion_shape.py
# Запуск из корня репо: bash tools/measure/motion/shape.sh [папка] [раундов на матч, по умолчанию 4] [карта]
O=${1:-/tmp/botshape}; R=${2:-4}; MP=${3:-mirage}; mkdir -p "$O"; D=tools/measure/motion
python3 src/build.py --map $MP "$O/mk.html" >/dev/null 2>&1
for M in "[3,7]" "[11,13]" "[17,19]" "[23,29]"; do C=$(cat $D/bot_shape.js.txt); C=${C/__M__/$M}; C=${C/__R__/$R}; timeout 3000 node $D/ev.js "$O/mk.html" "$C" | tail -1 > "$O/bshape_${M//[^0-9]/_}.json" & done; wait
python3 tools/motion_shape.py --map $MP "$O"
