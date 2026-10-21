#!/usr/bin/env python3
"""(Б4) Сводка С1–С8 и выстрелов: про / база / варианты. python3 tools/measure/engine/b4_table.py [метки…] (после b2_shoot.py report и shots report)"""
import json, os, sys
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'runs', 'b2')
D = json.load(open(os.path.join(B, 'shoot_report.json'))); S = json.load(open(os.path.join(B, 'shots_report.json')))
tags = sys.argv[1:]
def f(x): return '—' if x is None else (('%.2f' % x) if isinstance(x, float) else str(x))
for mp in ('ancient', 'mirage'):
    cols = [('про', D[mp]['pro'], S[mp]['pro']), ('база', D[mp]['bot'], S[mp]['bots'])] + [(t, D[mp + ':' + t]['bot'], S[mp][t]) for t in tags if mp + ':' + t in D]
    print('\n##', mp, '|', ' | '.join(c[0] for c in cols))
    rows = [('дуэлей', lambda d, s: d['duels']), ('С1 дуэль, мед. с', lambda d, s: d['dur_med_s']),
            ('С2 дуэль <500/500–1000/1000–1500/>1500', lambda d, s: ' / '.join(f(v[1]) for v in d['dur_by_dist'].values())),
            ('С3 HS убийств по дист.', lambda d, s: ' / '.join(f(v) for v in d['hs_by_dist'].values())),
            ('HS убийств всего', lambda d, s: d['hs']),
            ('С4 HS винт./пист./AWP', lambda d, s: ' / '.join(f(d['hs_by_cls'].get(c, [0, None])[1]) for c in ('rifle', 'pistol', 'sniper'))),
            ('С5 первый выстрел стоял/тормозил/медл./шёл', lambda d, s: ' / '.join(f(v) for v in d['spd_first_shot'].values())),
            ('С6 скорость за 0,25 с, мед.', lambda d, s: d['vl_med']),
            ('С7 появление(геом.)→выстрел', lambda d, s: d.get('react_med_s')),
            ('выиграл первый выстреливший', lambda d, s: d['kfirst']),
            ('точность винт. <500/…/>1500', lambda d, s: ' / '.join(f(v[1]) for v in s['acc_cls_dist']['rifle'].values())),
            ('точность винт., цель видна (Mirage — по геометрии)', lambda d, s: ' / '.join(f(v[1]) for v in s.get('acc_vis_rifle', {}).values())),
            ('…по относит. скорости ≤50/≤120/≤200/>200', lambda d, s: ' / '.join(f(v) for v in s.get('acc_vis_vr', {}).values())),
            ('голова среди попаданий (видна) винт./пист./ПП/AWP', lambda d, s: ' / '.join(f(v) for v in s.get('head_vis', {}).values())),
            ('точность пист. <500/…/>1500', lambda d, s: ' / '.join(f(v[1]) for v in s['acc_cls_dist']['pistol'].values())),
            ('точность AWP <500/…/>1500', lambda d, s: ' / '.join(f(v[1]) for v in s['acc_cls_dist']['sniper'].values())),
            ('голова среди попаданий винт. по дист.', lambda d, s: ' / '.join(f(v[1]) for v in s['head_cls_dist']['rifle'].values())),
            ('голова среди попаданий пист.', lambda d, s: ' / '.join(f(v[1]) for v in s['head_cls_dist']['pistol'].values())),
            ('1-й выстрел очереди: точн./до60/до90/бег', lambda d, s: ' / '.join(f(v) for v in s['spd_first'].values())),
            ('скорость 1-го выстрела очереди, мед.', lambda d, s: s['v_first_med']),
            ('скорость по № в очереди 0..3', lambda d, s: ' / '.join(f(s['v_by_k'][str(k)]) for k in range(4))),
            ('очередь начата на ходу', lambda d, s: s['burst_moving_first']),
            ('…точная скорость к 2-му / 3-му / позже / нет', lambda d, s: ' / '.join(f(v) for v in s['moving_burst_stop_at'].values())),
            ('выстрелов', lambda d, s: s['shots'])]
    for nm, fn in rows: print('|', nm, '|', ' | '.join(f(fn(c[1], c[2])) for c in cols), '|')
