"""Сторож (watch.js) на снимках отметок владельца: каждый снимок доигрывается SEC секунд, итог — сумма по всем.
Запуск: python3 tools/measure/audit/watch_snaps.py <sim.html> <снимок.json ...> [--sec=20] [--out=итог.json]"""
import sys, os, json, subprocess, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
sim, snaps, sec = args[0], args[1:], int(opt.get('sec', 20))
src = open(os.path.join(HERE, 'watch.js'), encoding='utf-8').read()
code = src + "\n(function(){ for(var i = 0; i < %d*64; i++){ stepTick(); WATCH.tick(); } return JSON.stringify(WATCH.report()); })()" % sec


def merge(a, b):
    for k, v in b.items():
        if isinstance(v, dict): merge(a.setdefault(k, {}), v)
        elif isinstance(v, list): a.setdefault(k, []).extend([[os.path.basename(cur)[:8]] + x for x in v][:10])
        else: a[k] = a.get(k, 0) + v


tot = {}
for cur in snaps:
    r = subprocess.run(['timeout', '300', 'node', os.path.join(ROOT, 'tools', 'mark_open.js'), sim, cur, code], capture_output=True, text=True)
    line = next((l for l in r.stdout.splitlines() if l.startswith('{"n"')), None)
    if not line: print('нет результата:', cur, r.stderr[-300:]); continue
    merge(tot, json.loads(line))
tot['snaps'] = len(snaps); tot['sec'] = sec
if 'out' in opt: json.dump(tot, open(opt['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(tot['n'], ensure_ascii=False))
print('empty by:', json.dumps(tot.get('emptyBy', {}), ensure_ascii=False))
print('danger by:', json.dumps(tot.get('dangerBy', {}), ensure_ascii=False))
