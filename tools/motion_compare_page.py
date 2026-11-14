"""В147, шаг 3: страница «демка рядом с ботом» — глазами сравнить форму движения точки и конуса (владелец: «визуально точь-в-точь»).
Слева — кусок из демки про (эталонные куски выгрузки с ПК: tools/demo_events_pc.py, режим motion + shape), справа — кусок бота того же вида
(запись каждого тика tools/measure/motion/bot_shape.js.txt, вырезан той же меркой tools/motion_shape.py). Виды: стрейф, поворот (вне боя /
в перестрелке), выглядывание, прыжок. Повтор по кругу, скорость ×1 / ×0,5 / ×0,25, следующий кусок. Точка и конус — как на радаре игры.
Запуск: python3 tools/motion_compare_page.py --map mirage --pcd=<папка pc-demos> --bots=<папка bshape_*.json> --out=<файл.html>"""
import sys, os, json, glob, gzip, base64, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
MAP = mapdir.current()
import motion_shape as MS  # noqa: E402
from demos import tr  # noqa: E402
arg = lambda k: next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--' + k + '=')), None)
PER = 40
rnd = random.Random(7)
pro = {}
for f in sorted(glob.glob(os.path.join(arg('pcd'), '**', '*-%s_shape.json.gz' % MAP), recursive=True)):
    for c in json.load(gzip.open(f, 'rt', encoding='utf-8')).get('_clips', []):
        import numpy as np
        px, py = tr(np.array(c['x']), np.array(c['y']))
        pro.setdefault(c['k'], []).append({'x': [round(float(v), 1) for v in px], 'y': [round(float(v), 1) for v in py],
                                           'f': [round(-v, 1) for v in c['yaw']], 'a': c['air']})
bots = {}
for s in MS.series_bots(arg('bots')):
    k = 2.5
    CL = []; MS.features([s], clips=CL, per=3)
    for c in CL:
        bots.setdefault(c['k'], []).append({'x': [round(v / k, 1) for v in c['x']], 'y': [round(-v / k, 1) for v in c['y']], 'f': [round(-v, 1) for v in c['yaw']], 'a': c['air']})
import math
ok = lambda c: all(math.isfinite(v) for v in c['x'] + c['y'] + c['f'])
pro = {k: [c for c in v if ok(c)] for k, v in pro.items()}; bots = {k: [c for c in v if ok(c)] for k, v in bots.items()}
D = {k: {'pro': rnd.sample(v, min(PER, len(v))), 'bot': rnd.sample(bots.get(k, []), min(PER, len(bots.get(k, []))))} for k, v in pro.items()}
img = base64.b64encode(open(mapdir.path(MAP, 'radar.png'), 'rb').read()).decode()
NAMES = {'strafe': 'стрейф', 'turn_n': 'поворот вне боя', 'turn_f': 'поворот в перестрелке', 'peek': 'выглядывание', 'air': 'прыжок'}
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motion_compare_tpl.html'), encoding='utf-8').read()
html = html.replace('__DATA__', json.dumps(D, separators=(',', ':'))).replace('__IMG__', img).replace('__NAMES__', json.dumps(NAMES, ensure_ascii=False)).replace('__MAP__', MAP.capitalize())
open(arg('out'), 'w', encoding='utf-8').write(html)
print(arg('out'), {k: (len(v['pro']), len(v['bot'])) for k, v in D.items()}, round(len(html) / 1e6, 1), 'МБ')
