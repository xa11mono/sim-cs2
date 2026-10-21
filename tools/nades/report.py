#!/usr/bin/env python3
"""В1–В2 (21.10.2026): цифры и картинки для docs/reports/NADES.md.

python3 tools/nades/report.py        → docs/reports/nades/*.png + docs/reports/nades/summary.json (таблицы — в stdout)
Вход: data/maps/<карта>/throws.json (В1, tools/nades/throws.py) и throws_check.json (В2, tools/nades/check.js --fuse).

Совпал бросок: ошибка места ≤ N и времени ≤ M (почему такие — NADES.md, «Пороги»).
Причина несовпадения (первая подошедшая):
  'время'        — место совпало, время нет (смок докатился не тогда);
  'стена у нас'  — у нас граната ударилась о стену / небо, а разрыв про лежит на дуге без стен (≤ N): у про пролетела —
                   лишняя стена / клип в нашей геометрии или край стены не там (точка — наше первое касание);
  'стены нет'    — у нас граната пролетела без касаний, у про — нет: у про ударилась о то, чего у нас нет (игрок, дверь,
                   неразобранная геометрия) или бросок был другим (точка — разрыв про);
  'движение'     — кидал на ходу / в прыжке (скорость и миг прыжка в демке видны неточно — см. NADES.md);
  'отскоки'      — оба ударились, цепочка отскоков / качение по полу разошлись (угол стены, ступени, скат, край пола;
                   точка — наше первое касание)."""
import json, os, sys, collections
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import mapdir  # noqa: E402

N, M = 32.0, 0.25            # пороги совпадения: ед. и с (NADES.md, «Пороги»)
TYPES = ['smoke', 'flash', 'he', 'molotov']
TCOL = {'smoke': '#9aa7b4', 'flash': '#f2d33c', 'he': '#e5533d', 'molotov': '#f08a24'}
CAUSES = ['время', 'стена у нас', 'стены нет', 'движение', 'отскоки']
CCOL = {'время': '#4aa3df', 'стена у нас': '#e5533d', 'стены нет': '#b05be0', 'движение': '#f2d33c', 'отскоки': '#3ccf7a'}
OUT = os.path.join(ROOT, 'docs', 'reports', 'nades')


def state(t):
    vz = t['vel'][2]
    if vz > 60: return 'прыжок'
    if abs(vz) <= 60 and t['hspeed'] < 10: return 'стоял'
    return 'шёл/бежал'


def cause(t, r):
    if r['e'] <= N: return 'время'
    if r['nb'] > 0 and r['free'] <= N and r['hit0'] and r['hit0'][3] != 'floor': return 'стена у нас'
    if r['nb'] == 0: return 'стены нет'
    if state(t) != 'стоял' or r['jump']: return 'движение'
    return 'отскоки'


def radar(m):
    img = Image.open(os.path.join(ROOT, 'data', 'maps', m, 'radar.png')).convert('RGB')
    tr = mapdir.game_to_map(m)
    k = img.size[0] / 2048.0
    return img, (lambda X, Y: tuple(np.array(v) * k for v in tr(np.asarray(X, float), np.asarray(Y, float))))


def pct(a): return round(100.0 * a, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    plt.rcParams['font.family'] = 'DejaVu Sans'
    summ = {'N': N, 'M': M, 'maps': {}}
    for m in ['ancient', 'mirage']:
        TJ = json.load(open(os.path.join(ROOT, 'data', 'maps', m, 'throws.json'), encoding='utf-8'))
        T = TJ['throws']
        C = json.load(open(os.path.join(ROOT, 'data', 'maps', m, 'throws_check.json')))
        R = C['res']
        img, tr = radar(m)
        S = {'В1': TJ['summary'], 'all': {}, 'by_type': {}, 'by_state': {}, 'causes': {}, 'strength': {}, 'jump_hidden': 0,
             'lineups': {}}
        ok = [r for r in R if r['e'] <= N and abs(r['et']) <= M]
        S['all'] = {'n': len(R), 'совпало %': pct(len(ok) / len(R)), 'место ≤N %': pct(np.mean([r['e'] <= N for r in R])),
                    'место ≤16 %': pct(np.mean([r['e'] <= 16 for r in R])), 'место ≤64 %': pct(np.mean([r['e'] <= 64 for r in R])),
                    'e p50': round(float(np.median([r['e'] for r in R])), 1)}
        for ty in TYPES:
            rr = [r for r in R if T[r['i']]['type'] == ty]
            S['by_type'][ty] = {'n': len(rr), 'совпало %': pct(np.mean([r['e'] <= N and abs(r['et']) <= M for r in rr])),
                                'место %': pct(np.mean([r['e'] <= N for r in rr])),
                                'время %': pct(np.mean([abs(r['et']) <= M for r in rr])),
                                'e p50': round(float(np.median([r['e'] for r in rr])), 1),
                                '|et| p50': round(float(np.median([abs(r['et']) for r in rr])), 3)}
            for st in ['стоял', 'шёл/бежал', 'прыжок']:
                q = [r for r in rr if state(T[r['i']]) == st]
                if q: S['by_state'].setdefault(st, {})[ty] = {'n': len(q), 'совпало %': pct(np.mean([r['e'] <= N and abs(r['et']) <= M for r in q]))}
        S['strength'] = dict(collections.Counter({1: 'ЛКМ', 0.5: 'обе', 0: 'ПКМ'}[r['s']] for r in ok))
        S['jump_hidden'] = pct(np.mean([r['jump'] for r in ok]))
        # лайнапы: один и тот же бросок (место ±6 ед., поворот/наклон ±0,3°, стоя/прыжок) — ≥ 3 раз в демках
        G = collections.defaultdict(list)
        for r in R:
            t = T[r['i']]
            st = state(t)
            if st == 'шёл/бежал': continue
            G[(t['type'], round(t['pos'][0] / 6), round(t['pos'][1] / 6), round(t['yaw'] / .3), round(t['pitch'] / .3), st)].append(r)
        L = [v for v in G.values() if len(v) >= 3]
        S['lineups'] = {'лайнапов (≥3 повтора)': len(L), 'бросков в них': sum(len(v) for v in L),
                        'совпало % (по броскам)': pct(np.mean([r['e'] <= N and abs(r['et']) <= M for v in L for r in v])) if L else None,
                        'по типам': {ty: pct(np.mean([r['e'] <= N and abs(r['et']) <= M for v in L for r in v if T[r['i']]['type'] == ty]))
                                     for ty in TYPES if any(T[r['i']]['type'] == ty for v in L for r in v)}}
        bad = [(T[r['i']], r) for r in R if not (r['e'] <= N and abs(r['et']) <= M)]
        cc = collections.Counter(cause(t, r) for t, r in bad)
        S['causes'] = {k: {'n': cc[k], '% несовпавших': pct(cc[k] / max(1, len(bad)))} for k in CAUSES}
        # места, где чаще всего «стена у нас» (клетка 128 ед.) — кандидаты на правку геометрии
        hot = collections.Counter()
        for t, r in bad:
            if cause(t, r) == 'стена у нас' and r['hit0']:
                hot[(round(r['hit0'][0] / 128) * 128, round(r['hit0'][1] / 128) * 128, round(r['hit0'][2] / 64) * 64)] += 1
        S['стена у нас — места'] = [{'x': k[0], 'y': k[1], 'z': k[2], 'n': v} for k, v in hot.most_common(12)]
        summ['maps'][m] = S

        # В1: откуда → куда, по типам
        fig, axs = plt.subplots(2, 2, figsize=(16, 16), dpi=80)
        for ax, ty in zip(axs.ravel(), TYPES):
            ax.imshow(img); ax.set_axis_off()
            tt = [t for t in T if t['type'] == ty and t['det']]
            x0, y0 = tr([t['pos'][0] for t in tt], [t['pos'][1] for t in tt])
            x1, y1 = tr([t['det']['pos'][0] for t in tt], [t['det']['pos'][1] for t in tt])
            for a, b, c, d in zip(x0, y0, x1, y1):
                ax.plot([a, c], [b, d], color=TCOL[ty], alpha=0.025, lw=0.6)
            ax.scatter(x1, y1, s=1.5, color=TCOL[ty], alpha=0.35, lw=0)
            ax.scatter(x0, y0, s=1.0, color='white', alpha=0.25, lw=0)
            ax.set_title(f'{mapdir.title(m)}: {ty} — {len(tt)} бросков (белое — откуда, цвет — разрыв)', fontsize=13)
        plt.tight_layout(); plt.savefig(os.path.join(OUT, f'v1_{m}_throws.png')); plt.close()

        # В2: несовпадения точками по причинам
        fig, axs = plt.subplots(1, 2, figsize=(20, 10.6), dpi=80)
        for ax, part in zip(axs, ['геометрия', 'прочее']):
            ax.imshow(img); ax.set_axis_off()
            for c in (['стена у нас', 'стены нет'] if part == 'геометрия' else ['отскоки', 'движение', 'время']):
                P = []
                for t, r in bad:
                    if cause(t, r) != c: continue
                    p = r['hit0'] if c in ('стена у нас', 'отскоки') and r['hit0'] else t['det']['pos']
                    P.append(p)
                if not P: continue
                x, y = tr([p[0] for p in P], [p[1] for p in P])
                ax.scatter(x, y, s=3, color=CCOL[c], alpha=0.35, lw=0, label=f'{c} ({len(P)})')
            lg = ax.legend(loc='lower left', fontsize=12, markerscale=5, framealpha=0.8)
            ax.set_title(f'{mapdir.title(m)}: несовпадения — {part} (совпало {S["all"]["совпало %"]} % из {len(R)})', fontsize=14)
        plt.tight_layout(); plt.savefig(os.path.join(OUT, f'v2_{m}_misses.png')); plt.close()

        # В2: доля совпадений по типам и состоянию
    json.dump(summ, open(os.path.join(OUT, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(summ, ensure_ascii=False, indent=1)[:9000])


if __name__ == '__main__':
    main()
