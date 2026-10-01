#!/bin/bash
# фоновый автозамер: bash measure/bg.sh <метка> [флаги]
cd /home/claude/sim
rm -rf "measure/runs/$1"
python3 measure/measure.py "$@" > "measure/log_$1.txt" 2>&1
echo done >> "measure/log_$1.txt"
