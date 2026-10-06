#!/usr/bin/env python3
"""Стрельба (С1): python3 tools/measure/shots.py <папка прогона> [<папка2> …]
Берёт REC.shots из rec_*.json (запись rec2.js) и считает:
- пуль в очереди по дистанции (≤300 / 300–700 / >700 px радара), доля тапов;
- паузу между очередями одного боя (≤1,5 с);
- время от появления врага до первого выстрела по нему.
Очередь — выстрелы одного бота из одного оружия, где каждый следующий не позже
1,6 темпа оружия (+1 тик). Прострел смока не считается."""
import sys, os, json, glob
import numpy as np, pandas as pd
RPM = {'AK':600,'M4':666,'M4S':600,'GALIL':666,'FAMAS':666,'AUG':600,'SG':545,'AWP':41,'SSG':48,
       'DEAGLE':267,'GLOCK':400,'USP':352,'P250':400,'TEC9':500,'FIVE7':400,
       'MAC10':800,'MP9':857,'MP7':800,'UMP':666,'P90':857}
RIFLE = {'AK','M4','M4S','GALIL','FAMAS','AUG','SG'}
SMG = {'MAC10','MP9','MP7','UMP','P90'}
def iv(w):
    return 3840/RPM.get(w.upper(), 600)
def bursts(S):
    out = []
    for sid, g in S.sort_values('tick').groupby(['f', 'id']):
        t = g.tick.values; w = g.w.values; d = g.d.values; cs = g.cs.values; i = 0
        while i < len(t):
            j = i; I = iv(w[i])
            while j+1 < len(t) and w[j+1] == w[i] and t[j+1]-t[j] <= I*1.6+1: j += 1
            nxt = t[j+1]-t[j] if j+1 < len(t) and w[j+1] == w[i] else None
            out.append(dict(w=w[i], n=j-i+1, d=d[i], gap=nxt, cs=cs[i], t=t[i]))
            i = j+1
    return pd.DataFrame(out)
def band(d): return '≤300' if d <= 300 else ('300–700' if d <= 700 else '>700')
def report(dirs):
    rows = []
    for D in dirs:
        for f in sorted(glob.glob(os.path.join(D, 'rec_*.json'))):
            for s in json.load(open(f)).get('shots', []):
                if len(s) > 8 and s[8]: continue
                rows.append(dict(f=f, tick=s[0], id=s[1], w=s[3], d=s[4], tg=s[5], cs=s[6]))
    S = pd.DataFrame(rows)
    if S.empty: return 'нет записей стрельбы (REC.shots)'
    B = bursts(S); B['band'] = B.d.map(band)
    L = [f'выстрелов: {len(S)}, очередей: {len(B)}']
    for name, sel in (('винтовки', B.w.str.upper().isin(RIFLE)), ('ПП', B.w.str.upper().isin(SMG))):
        R = B[sel]
        for b in ('≤300', '300–700', '>700'):
            x = R[R.band == b].n
            if not len(x): continue
            L.append(f'{name} {b}: очередей {len(x)}, пуль в очереди ср {x.mean():.1f} / медиана {x.median():.0f}; '
                     f'тап {(x==1).mean()*100:.0f}% · 2–5 {((x>=2)&(x<=5)).mean()*100:.0f}% · 6+ {(x>=6).mean()*100:.0f}%')
        g = R[R.gap.notna() & (R.gap <= 96)]
        if len(g):
            L.append(f'{name}: пауза между очередями медиана {g.gap.median()/64:.2f} с, разброс (25–75%) '
                     f'{g.gap.quantile(.25)/64:.2f}–{g.gap.quantile(.75)/64:.2f} с')
    # первый выстрел боя: по этой цели этот бот не стрелял 3+ с
    S = S.sort_values('tick'); S['prev'] = S.groupby(['f', 'id', 'tg']).tick.diff()
    F = S[(S.prev.isna() | (S.prev > 192)) & (S.cs > 0) & (S.cs < 640)]
    if len(F):
        L.append(f'от появления врага до первого выстрела: медиана {F.cs.median()/64:.2f} с, '
                 f'25–75% {F.cs.quantile(.25)/64:.2f}–{F.cs.quantile(.75)/64:.2f} с (по {len(F)} парам)')
    for k, ws in (('AWP', {'AWP'}), ('дигл', {'DEAGLE'})):
        x = B[B.w.str.upper().isin(ws)].n
        if len(x): L.append(f'{k}: очередей {len(x)}, пуль в очереди ср {x.mean():.2f}')
    return '\n'.join(L)
if __name__ == '__main__':
    print(report(sys.argv[1:]))
