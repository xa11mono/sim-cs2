#!/usr/bin/env python3
"""Сводка измерений (аудит v598): медианы по прогонам + markdown-таблицы.
Читает results/load_raw_*.json и results/memory_*.json; пишет results/load_summary.json.
"""
import json, os, statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.abspath(os.path.join(HERE, '..', 'results'))


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(st.median(xs), 2) if xs else None


def rng(xs):
    xs = [x for x in xs if x is not None]
    return (round(min(xs), 2), round(max(xs), 2)) if xs else None


def first_game_frame(nav):
    s1 = nav['marks'].get('s1', 0)
    fr = [t for t in nav.get('frames', []) if t >= s1]
    return fr[0] if fr else None


out = {}
for m in ('ancient', 'mirage'):
    d = json.load(open(os.path.join(RES, f'load_raw_{m}.json'), encoding='utf-8'))
    row = {'map': m, 'conditions': d['conditions'], 'machine': d['machine'], 'gpu': d['gpu'],
           'cold': [], 'warm': [], 'd3': d.get('3d')}
    for tag in ('cold', 'warm'):
        for r in d[tag]:
            mk = r['nav']['marks']
            row[tag].append({
                'ready_s': r['ready_wall_s'],
                'response_end': round(r['nav'].get('responseEnd') or 0),
                'first_paint': r['nav'].get('paints', {}).get('first-contentful-paint'),
                's0': round(mk.get('s0') or 0),
                'html_parse': round((mk.get('s0') or 0) - (r['nav'].get('responseEnd') or 0)),
                'map_literal': round((mk.get('map1') or 0) - (mk.get('map0') or 0), 1),
                'nav_init': round((mk.get('nav1') or 0) - (mk.get('nav0') or 0)),
                'zone_danger_and_rest': round((mk.get('mk0') or 0) - (mk.get('nav1') or 0)),
                'marks_module': round((mk.get('mk1') or 0) - (mk.get('mk0') or 0), 1),
                'warmstart': round((mk.get('w1') or 0) - (mk.get('w0') or 0), 1),
                'script_exec': round((mk.get('s1') or 0) - (mk.get('s0') or 0)),
                'fps_2d': r['fps_2d'].get('fps'),
                'frame_p50': r['fps_2d'].get('frame_ms', {}).get('p50'),
                'frame_p95': r['fps_2d'].get('frame_ms', {}).get('p95'),
                'frame_max': r['fps_2d'].get('frame_ms', {}).get('max'),
                'long_n': r['fps_2d'].get('long', {}).get('n'),
                'js_heap_mb': round((r.get('memory') or {}).get('used', 0) / 1048576, 1),
                'cdp_heap_mb': round(r['heap']['used'] / 1048576, 1),
                'dom_nodes': r['dom']['nodes'],
                'first_game_frame': round(first_game_frame(r['nav']) or 0),
            })
    for tag in ('cold', 'warm'):
        rs = row[tag]
        row[tag + '_median'] = {k: med([x[k] for x in rs]) for k in rs[0] if isinstance(rs[0][k], (int, float))}
        row[tag + '_range'] = {k: rng([x[k] for x in rs]) for k in ('ready_s', 'map_literal', 'nav_init', 'script_exec', 'first_game_frame')}
    out[m] = row

# память
for m in ('ancient', 'mirage'):
    mm = json.load(open(os.path.join(RES, f'memory_{m}.json'), encoding='utf-8'))
    rows = []
    for p in mm['phases']:
        ua = p.get('ua_memory') or {}
        rows.append({'label': p['label'], 'rss': p.get('rss_mb'),
                     'ua_mb': round(ua['bytes'] / 1048576, 1) if 'bytes' in ua else None,
                     'js_mb': p.get('js_heap_used_mb')})
    out[m]['memory_phases'] = rows

json.dump(out, open(os.path.join(RES, 'load_summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('summary -> results/load_summary.json')


def table(rows, cols, head):
    print('| ' + ' | '.join(head) + ' |')
    print('|' + '---|' * len(head))
    for r in rows:
        print('| ' + ' | '.join(str(r.get(c, '')) for c in cols) + ' |')


for m in ('ancient', 'mirage'):
    print('\n## ' + m)
    for tag in ('cold', 'warm'):
        cols = ['ready_s', 'html_parse', 'map_literal', 'nav_init', 'zone_danger_and_rest', 'warmstart', 'script_exec',
                'first_game_frame', 'fps_2d', 'frame_p95', 'long_n']
        print('\n' + tag + ':')
        table(out[m][tag], cols, [c.replace('_', ' ') for c in cols])
    print('\nмедианы: cold', out[m]['cold_median'])
    print('медианы: warm', out[m]['warm_median'])
    print('память:', out[m]['memory_phases'])
