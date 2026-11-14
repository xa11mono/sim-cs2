"""В144: вписать в данные карты, сколько раз за раунд у ботов складывается момент подсадки у каждого места (botE) — по замеру
tools/measure/motion/boost.sh <папка> 1000000 (вероятность 1). Игра берёт вероятность rate / botE (540, jumpCheckTick).
Запуск: python3 tools/measure/motion/boost_calib.py <папка замера> [--map mirage]"""
import json, glob, sys, os
sys.path.insert(0, 'tools'); import mapdir  # noqa: E402
M = next((a.split('=')[1] for a in sys.argv if a.startswith('--map=')), 'mirage'); S = sys.argv[1]
A = [json.load(open(f)) for f in glob.glob(S + '/bo_*.json')]; R = sum(a['R'] for a in A); N = {}
for a in A:
    for k, v in a['N'].items(): N[k] = N.get(k, 0) + v
pj = mapdir.path(M, 'pro.json'); P = json.load(open(pj, encoding='utf-8'))
for q in P.get('boosts', []):
    k = '%s (%d,%d)' % (q['side'], round(q['x']), round(q['y']))
    q['botE'] = round(N.get(k, 0) / max(1, R), 4) or None
    if q['botE'] is None: q.pop('botE')
    print(k, 'у ботов', q.get('botE'), 'за раунд; у про', q['rate'], '→ вероятность', round(min(1, q['rate'] / q['botE']), 3) if q.get('botE') else 'нет момента')
open(pj, 'w', encoding='utf-8').write(json.dumps(P, ensure_ascii=False, separators=(',', ':')) + '\n')
