#!/usr/bin/env python3
"""Смерть CT на сайте до планта (жертва ≤ 240 ед. карты от точки сайта): где в этот момент остальные живые T (кроме убийцы) — на самом
сайте (≤ 240) и рядом (≤ 480, подходы). По времени раунда (≤30 / 30–50 / >50 с). Для знания CT в игре: knowSiteShift (220), владелец 18.11.
python3 tools/pro/kill_site_pro.py --map mirage"""
import sys, os, math, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir, demos as D  # noqa: E402
Z=json.load(open(mapdir.path(D.MAPNAME,'zones.json')))['zonemap']['points']
S={}
for p in Z:
    k=p['name'].split('_')[0]
    if k in('Asite','Bsite'): S[k[0]]=(float(p['x']),float(p['y']))
R1,R2=240,480
B={}
for demo in D.demo_names():
    R=D.rounds_of(demo); dd=D.event(demo,'player_death'); t=None
    for r in R:
        dr=dd[(dd.tick>r['t0'])&(dd.tick<(r['tplant'] or r['t1']))]
        dr=dr[dr.user_team_num==3]
        for _,d in dr.iterrows():
            vx,vy=D.tr(float(d.user_X),float(d.user_Y))
            site=[k for k,c in S.items() if math.hypot(vx-c[0],vy-c[1])<=R1]
            if not site: continue
            c=S[site[0]]
            if t is None: t=D.ticks_of(demo)
            w=t[(t.tick>=d.tick-8)&(t.tick<=d.tick)&(t.side=='T')].groupby('steamid').last()
            w=w[w.index!=int(d.attacker_steamid) if d.attacker_steamid==d.attacker_steamid else True]
            if len(w)==0: continue
            dist=np.hypot(w.x.values-c[0],w.y.values-c[1])
            sec=(d.tick-r['t0'])/D.TICK
            b='<=30' if sec<=30 else '30-50' if sec<=50 else '>50'
            # сколько T (кроме убийцы) было у сайта (<=R2) за 3 с до смерти — видно ли «выход»
            B.setdefault(b,[]).append((np.mean(dist<=R1),np.mean(dist<=R2),len(w)))
for b in ['<=30','30-50','>50']:
    a=np.array(B.get(b,[]));
    if len(a): print(b,'смертей',len(a),'доля остальных T на сайте(≤240) %.2f'%a[:,0].mean(),'в 480 %.2f'%a[:,1].mean())
