#!/bin/bash
# подсадки ботов: bash tools/measure/motion/boost.sh <папка> [k] — k: BOOST.k (по умолчанию как в игре)
O=${1:-/tmp/bo}; mkdir -p "$O"; D=tools/measure/motion; K=${2:-}
python3 src/build.py --map mirage "$O/mk.html" >/dev/null 2>&1
for M in "[3,7]" "[11,13]" "[17,19]" "[23,29]"; do F="$O/q_${M//[^0-9]/_}.txt"
  python3 -c "import sys;t=open('$D/boost.js.txt').read().replace('__M__','$M').replace('__K__', ('BOOST.k=$K; MAP.pro.boosts.forEach(function(q){ delete q.botE; });' if '$K' else ''));open('$F','w').write(t)"
  (timeout 3000 node --max-old-space-size=2500 $D/ev.js "$O/mk.html" "$(cat $F)" | tail -1 > "$O/bo_${M//[^0-9]/_}.json") & done; wait
python3 - "$O" <<'P'
import json,glob,sys,numpy as np
A=[json.load(open(f)) for f in glob.glob(sys.argv[1]+'/bo_*.json')]; R=sum(a['R'] for a in A); N={}
for a in A:
  for k,v in a['N'].items(): N[k]=N.get(k,0)+v
D=[d for a in A for d in a['D']]
print('раундов %d, подсадок %d — %.3f за раунд (про 0,088 в этих 5 местах, 0,164 всего)'%(R,sum(N.values()),sum(N.values())/max(1,R)))
for k,v in sorted(N.items(),key=lambda x:-x[1]): print('  %s: %d — %.3f за раунд'%(k,v,v/max(1,R)))
if D: print('  наверху, с:', [round(float(x),2) for x in np.percentile(D,[10,25,50,75,90])])
P
