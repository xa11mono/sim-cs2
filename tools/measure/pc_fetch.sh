#!/bin/bash
# результаты прогона на ПК владельца → tools/measure/runs/<метка>/rec_<m>.json
#   bash tools/measure/pc_fetch.sh <номер прогона> <метка> [матчи через запятую]
set -e; N=$1; L=$2; M=$3; cd "$(dirname "$0")/../.."
git fetch -q origin refs/heads/pc-results/$N:refs/remotes/origin/pc-results/$N
mkdir -p tools/measure/runs/$L
for f in $(git ls-tree --name-only origin/pc-results/$N $L/); do
  m=$(basename $f .json.gz); m=${m#rec_}
  if [ -n "$M" ] && ! echo ",$M," | grep -q ",$m,"; then continue; fi
  git show origin/pc-results/$N:$f | gunzip > tools/measure/runs/$L/rec_$m.json
done
ls tools/measure/runs/$L | wc -l
