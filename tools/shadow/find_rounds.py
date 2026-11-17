"""В136, шаг 1: раунды демок про для «режима тени» — где есть всё сразу: ранние киллы, перекол, плант, пост-плант, ретейк.
Ранние киллы — смерти в первые 25 с; плант — bomb_planted; пост-плант — от планта до конца раунда ≥ 15 с; ретейк — после планта ≥ 2 смертей,
из них ≥ 1 T (CT выбивают); перекол — до планта ≥ 3 T побывали ближе PRE_R к другому сайту (снимки раз в 2 с), а поставили на этот.
Запуск: python3 tools/shadow/find_rounds.py --map mirage [--top=15]. Пишет tools/shadow/rounds_<карта>.json"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import demos, mapdir  # noqa: E402

TOP = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--top=')), 15))
PRE_R = 500   # px карты — «подошли к сайту» (проектное число)
Z = json.load(open(mapdir.path(demos.MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['points']
SITE = {p['name'].split('_')[0][0]: (p['x'], p['y']) for p in Z if p['name'].split('_')[0] in ('Asite', 'Bsite')}


def main():
    cand = []
    for demo in demos.demo_names():
        de = demos.event(demo, 'player_death')
        for r in demos.rounds_of(demo):
            if not r['tplant']: continue
            d = de[(de.tick >= r['t0']) & (de.tick < r['t1'])]
            early = int((d.tick < r['t0'] + 25 * demos.TICK).sum())
            post = (r['t1'] - r['tplant']) / demos.TICK
            after = d[d.tick > r['tplant']]
            tdead = int((after.user_team_num == 2).sum()) if 'user_team_num' in after else 0
            if early >= 1 and post >= 15 and len(after) >= 2 and tdead >= 1:
                cand.append(dict(r, early=early, post=round(post, 1), afterKills=int(len(after)), afterT=tdead, kills=int(len(d))))
    print('кандидатов (ранние киллы + плант + пост-плант ≥ 15 с + ретейк):', len(cand))
    # перекол — по позициям (только у кандидатов)
    by = {}
    for c in cand: by.setdefault(c['demo'], []).append(c)
    out = []
    for demo, L in by.items():
        T = demos.ticks_of(demo)
        T = T[T.side == 'T']
        for c in L:
            other = 'A' if c['site'] == 'B' else 'B'; ox, oy = SITE[other]
            g = T[(T.tick >= c['t0'] + 10 * demos.TICK) & (T.tick < c['tplant'] - 10 * demos.TICK)]   # позиции пишутся не каждый тик — весь отрезок до планта
            near = set(int(s) for s, x, y in zip(g.steamid.values, g.x.values, g.y.values) if np.hypot(x - ox, y - oy) < PRE_R)
            c['recall'] = len(near) >= 3; c['nearOther'] = len(near)
            if c['recall']: out.append(c)
    out.sort(key=lambda c: (-(c['early'] >= 2), -c['afterKills'], -c['post']))
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rounds_%s.json' % demos.MAPNAME)
    json.dump(out[:TOP], open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('с переколом:', len(out), '→', p)
    for c in out[:TOP]:
        print('  %s р%d: сайт %s, ранних киллов %d, у другого сайта было %d T, пост-плант %.0f с, после планта убийств %d (T %d)' % (
            c['demo'], c['num'], c['site'], c['early'], c['nearOther'], c['post'], c['afterKills'], c['afterT']))


if __name__ == '__main__':
    main()
