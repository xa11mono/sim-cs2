"""В136, шаг 2: раунд демки про целиком — для «режима тени» (tools/shadow/shadow.js). Игроки (steamid, имя, сторона), позиции каждого
снятого тика (x, y карты, Z, взгляд, жив, HP, оружие), события: выстрелы, попадания, смерти, смоки / флешки / молотовы / HE (точка разрыва),
плант, дефуз, конец раунда. Тики — от конца закупки (t0). Запуск: python3 tools/shadow/export_round.py --map mirage <демка> <номер раунда>"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import demos  # noqa: E402


def main():
    demo, num = sys.argv[1], int(sys.argv[2])
    r = next(x for x in demos.rounds_of(demo) if x['num'] == num)
    t0, t1 = r['t0'], r['t1']
    t = pd.read_csv(os.path.join(demos.DEMOS, demo + '_ticks.csv.gz'), low_memory=False,
                    usecols=['tick', 'steamid', 'name', 'team_num', 'X', 'Y', 'Z', 'yaw', 'is_alive', 'health', 'active_weapon_name'])
    t = t[(t.tick >= t0 - 64) & (t.tick <= t1)]
    x, y = demos.tr(t.X.values, t.Y.values)
    players = {}
    for sid, g in t.assign(x=x, y=y).groupby('steamid'):
        g = g.sort_values('tick')
        players[str(int(sid))] = {'name': str(g.name.iloc[-1]), 'side': 'CT' if int(g.team_num.iloc[-1]) == 3 else 'T',
            'track': [[int(a - t0), round(float(b), 1), round(float(c), 1), round(float(d), 1), round(float(-e) * np.pi / 180, 3), 1 if f else 0, int(h) if h == h else 0, str(w)]
                      for a, b, c, d, e, f, h, w in zip(g.tick, g.x, g.y, g.Z, g.yaw, g.is_alive, g.health, g.active_weapon_name)]}
    ev = lambda k: demos.event(demo, k)
    inr = lambda e: e[(e.tick >= t0) & (e.tick <= t1)]
    def pt(X, Y):
        a, b = demos.tr(np.array([float(X)]), np.array([float(Y)])); return [round(float(a[0]), 1), round(float(b[0]), 1)]
    out = {'demo': demo, 'num': num, 't0': t0, 'len': t1 - t0, 'site': r['site'], 'players': players, 'ev': []}
    for _, e in inr(ev('weapon_fire')).iterrows():
        w = str(e.weapon)
        if any(k in w for k in ('knife', 'grenade', 'flashbang', 'molotov', 'incgrenade', 'decoy', 'c4', 'bayonet')): continue
        out['ev'].append(['shot', int(e.tick - t0), str(int(e.user_steamid)), w])
    for _, e in inr(ev('player_hurt')).iterrows():
        if e.attacker_steamid == e.attacker_steamid:
            out['ev'].append(['hurt', int(e.tick - t0), str(int(e.attacker_steamid)), str(int(e.user_steamid)), int(e.dmg_health)])
    for _, e in inr(ev('player_death')).iterrows():
        out['ev'].append(['death', int(e.tick - t0), str(int(e.attacker_steamid)) if e.attacker_steamid == e.attacker_steamid else '', str(int(e.user_steamid))])
    for k, nm in (('smokegrenade_detonate', 'smoke'), ('flashbang_detonate', 'flash'), ('inferno_startburn', 'molotov'), ('hegrenade_detonate', 'he')):
        for _, e in inr(ev(k)).iterrows():
            out['ev'].append(['nade', int(e.tick - t0), str(int(e.user_steamid)), nm] + pt(e.x, e.y))
    for _, e in inr(ev('bomb_planted')).iterrows(): out['ev'].append(['plant', int(e.tick - t0), str(int(e.user_steamid))] + pt(e.user_X, e.user_Y))
    for _, e in inr(ev('bomb_defused')).iterrows(): out['ev'].append(['defused', int(e.tick - t0), str(int(e.user_steamid))])
    out['ev'].sort(key=lambda e: e[1])
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'round_%s_%d.json' % (demo, num))
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    print(p, '| игроков', len(players), '| событий', len(out['ev']), '| длина', round(out['len'] / 64, 1), 'с')
    print('  ', ', '.join('%s %s' % (v['side'], v['name']) for v in players.values()))


if __name__ == '__main__':
    main()
