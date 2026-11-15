#!/bin/bash
# результаты прогона на ПК владельца → tools/measure/runs/<метка>/rec_<m>.json (и fp_<m>.json, cov_<m>.json — с 15.11)
#   bash tools/measure/pc_fetch.sh <номер прогона> <метка> [матчи через запятую]
set -e; N=$1; L=$2; M=$3; cd "$(dirname "$0")/../.."
git fetch -q origin refs/heads/pc-results/$N:refs/remotes/origin/pc-results/$N
mkdir -p tools/measure/runs/$L
for f in $(git ls-tree --name-only origin/pc-results/$N $L/); do
  b=$(basename $f .gz); case $b in *.json) ;; *) continue;; esac; m=${b%.json}; m=${m##*_}
  if [ -n "$M" ] && ! echo ",$M," | grep -q ",$m,"; then continue; fi
  git show origin/pc-results/$N:$f | gunzip > tools/measure/runs/$L/$b
done
ls tools/measure/runs/$L | wc -l
