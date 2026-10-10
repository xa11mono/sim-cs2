"""Размены у про (v248, пункт 1 разбора): по player_death 92 демок Ancient.
  • trader_dist — где был тот, кто разменял (убил убийцу за 3 с), в момент смерти своего: расстояние до места
    смерти, ед. карты (как радар 0..2048) — медиана и 80-й перцентиль;
  • chain — после смерти своего второй погиб от того же убийцы за 5 с не дальше 300 ед. карты от первого
    (по одному в тот же угол): доля смертей;
  • traded — доля смертей, разменянных за 3 с.
Пишет src/data/trades.json. Запуск: python3 tools/trade_bake.py"""
import json, os, sys, math, glob
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ancient_demos import ROOT, DEMOS, tr
dist, n, traded, chain = [], 0, 0, 0
for f in sorted(glob.glob(os.path.join(DEMOS, '*_player_death.csv.gz'))):
    d = pd.read_csv(f).sort_values('tick')
    d = d[(d.attacker_team_num != d.user_team_num) & d.attacker_steamid.notna()]
    rows = list(zip(d.tick, d.attacker_steamid, d.user_steamid, d.user_team_num, d.user_X, d.user_Y, d.attacker_X, d.attacker_Y))
    for i, (t, a, u, ut, ux, uy, ax, ay) in enumerate(rows):
        n += 1
        vx, vy = tr(ux, uy)
        for (t2, a2, u2, ut2, ux2, uy2, ax2, ay2) in rows[i+1:]:
            if t2 - t > 5*64: break
            if u2 == a and t2 - t <= 3*64:
                traded += 1
                # где был разменявший в момент смерти своего: его позиция при размене минус пройденное неизвестно —
                # берём место, откуда он убил (attacker_X/Y второй смерти) — верхняя оценка
                tx, ty = tr(ax2, ay2); dist.append(math.hypot(tx-vx, ty-vy))
                break
        for (t2, a2, u2, ut2, ux2, uy2, ax2, ay2) in rows[i+1:]:
            if t2 - t > 5*64: break
            if a2 == a and ut2 == ut:
                x2, y2 = tr(ux2, uy2)
                if math.hypot(x2-vx, y2-vy) <= 300: chain += 1
                break
out = {'_about': __doc__.strip().split('\n')[0], 'deaths': n, 'traded': traded/n, 'chain': chain/n,
       'trader_dist_median': float(np.median(dist)), 'trader_dist_p80': float(np.percentile(dist, 80))}
os.makedirs(os.path.join(ROOT, 'src', 'data'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'trades.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False))
