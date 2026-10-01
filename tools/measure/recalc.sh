#!/bin/bash
# пересчитать метрики уже сыгранных прогонов (без игры): bash measure/recalc.sh run1 run2 ...
cd /home/claude/sim
for r in "$@"; do python3 measure/measure.py "$r" --no-build --no-play 2>/dev/null > "measure/log_$r.txt"; touch "measure/runs/$r/metrics.json"; echo done >> "measure/log_$r.txt"; done
