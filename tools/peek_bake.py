"""Как про выглядывают и перестреливаются (v250, пик по данным). Один код для демок и для ботов.

Выстрелы в демках прорежены (tools/parse_demos.py): один на игрока за 32 тика (0,5 с) — «окно стрельбы».
У ботов выстрелы прореживаются так же. Позиции — раз в 16 тиков и там, и там. До планта.
Перестрелка игрока P: подряд идущие окна стрельбы P с паузами ≤ GAP_MAX, ближайший живой враг ≤ R_CONTACT.
Считается:
  • перестрелок на игрока за раунд; окон стрельбы в перестрелке; длительность;
  • исход: P погиб (в ней или до 1 с после) / убил кого-то / ни то ни другое;
  • паузы внутри перестрелки (между окнами ≥ 1 с): длительность; сдвиг за паузу (px карты 0..2048);
    доля пауз, в которые P ушёл с места (сдвиг ≥ MOVE px) и вернулся к прежнему месту к следующему окну (≤ MOVE);
  • выход перед первым окном: сдвиг за 1 с до него; уход после последнего: сдвиг за 1 с после (если жив).
Пишет src/data/trades.json поле peek. Запуск: python3 tools/peek_bake.py   (боты: tools/measure/peek.py <run>…)"""
import json, os, sys, math, bisect, collections
import numpy as np

R_CONTACT, GAP_MAX, MOVE = 700, 3 * 64, 12


def analyze(tracks, shots, deaths, kills_by, rounds, plants, S):
    """tracks: id → (ticks[], xs[], ys[], side) только живые; shots: id → отсортированные тики окон стрельбы;
    deaths: id → [тик]; kills_by: id → [тик]; rounds: [(t0, t1)]; plants: [тик]. Копит в Counter/списках S."""
    def at(b, tk):
        L = tracks.get(b)
        if not L: return None
        i = bisect.bisect_right(L[0], tk) - 1
        if i < 0 or tk - L[0][i] > 32: return None
        return L[1][i], L[2][i]
    side = {b: v[3] for b, v in tracks.items()}
    for (t0, t1) in rounds:
        cut = min([p for p in plants if t0 <= p <= t1] or [t1])
        for b, sh in shots.items():
            if b not in side: continue
            W = [t for t in sh if t0 <= t < cut]
            # перестрелки
            F, cur, dist0 = [], [], {}
            for t in W:
                p = at(b, t)
                if not p: continue
                foes = [math.hypot(q[0]-p[0], q[1]-p[1]) for o in side if side[o] != side[b] and (q := at(o, t))]
                if not foes or min(foes) > R_CONTACT: continue
                if cur and t - cur[-1] > GAP_MAX: F.append(cur); cur = []
                if not cur: dist0[t] = min(foes)
                cur.append(t)
            if cur: F.append(cur)
            sd = side[b]
            for f in F:
                S['n'][sd] += 1
                S['окон'][sd].append(len(f)); S['длит'][sd].append((f[-1] - f[0]) / 64)
                died = any(f[0] <= d <= f[-1] + 64 for d in deaths.get(b, ()))
                killed = any(f[0] - 32 <= k <= f[-1] + 32 for k in kills_by.get(b, ()))
                S['погиб'][sd] += died; S['убил'][sd] += killed; S['ни то ни другое'][sd] += (not died and not killed)
                dd = dist0.get(f[0], 0); bk = '<250' if dd < 250 else '250-450' if dd < 450 else '450+'
                S['по дистанции'][(sd, bk, 'n')] += 1; S['по дистанции'][(sd, bk, 'ничья')] += (not died and not killed)
                for a, c in zip(f, f[1:]):
                    if c - a < 64: continue
                    pa, pc = at(b, a), at(b, c)
                    if not pa or not pc: continue
                    mid = [at(b, t) for t in range(a + 16, c, 16)]
                    mid = [m for m in mid if m]
                    far = max([math.hypot(m[0]-pa[0], m[1]-pa[1]) for m in mid] or [0])
                    back = math.hypot(pc[0]-pa[0], pc[1]-pa[1])
                    S['пауз'][sd] += 1; S['пауза с'][sd].append((c - a) / 64); S['сдвиг в паузе'][sd].append(far)
                    S['ушёл и вернулся'][sd] += (far >= MOVE and back <= MOVE)
                    S['ушёл'][sd] += (far >= MOVE)
                p0, pb = at(b, f[0]), at(b, f[0] - 64)
                if p0 and pb: S['выход'][sd].append(math.hypot(p0[0]-pb[0], p0[1]-pb[1]))
                if not died:
                    p1, pa_ = at(b, f[-1]), at(b, f[-1] + 64)
                    if p1 and pa_: S['уход'][sd].append(math.hypot(pa_[0]-p1[0], pa_[1]-p1[1]))
        S['раундов'][0] += 1


def new_stats():
    return {
        k: (collections.defaultdict(list) if k in ('окон', 'длит', 'пауза с', 'сдвиг в паузе', 'выход', 'уход') else collections.Counter())
        for k in ('по дистанции', 'n', 'окон', 'длит', 'погиб', 'убил', 'ни то ни другое', 'пауз', 'пауза с', 'сдвиг в паузе',
                  'ушёл и вернулся', 'ушёл', 'выход', 'уход', 'раундов')}


def summary(S):
    out = {}
    for sd in ('CT', 'T'):
        n = max(1, S['n'][sd]); np_ = max(1, S['пауз'][sd])
        med = lambda k: float(np.median(S[k][sd])) if S[k][sd] else None
        out[sd] = {'перестрелок': S['n'][sd], 'перестрелок на игрока за раунд': S['n'][sd] / max(1, S['раундов'][0]) / 5,
                   'окон стрельбы, медиана': med('окон'), 'окон стрельбы, среднее': float(np.mean(S['окон'][sd])) if S['окон'][sd] else None,
                   'длительность, медиана с': med('длит'),
                   'погиб': S['погиб'][sd] / n, 'убил': S['убил'][sd] / n, 'без фрага и смерти': S['ни то ни другое'][sd] / n,
                   'пауз на перестрелку': S['пауз'][sd] / n, 'пауза, медиана с': med('пауза с'),
                   'в паузе ушёл с места': S['ушёл'][sd] / np_, 'в паузе ушёл и вернулся': S['ушёл и вернулся'][sd] / np_,
                   'сдвиг в паузе, медиана px': med('сдвиг в паузе'),
                   'выход за 1 с до первого окна, медиана px': med('выход'), 'уход за 1 с после, медиана px': med('уход')}
        PD = S['по дистанции']
        out[sd]['по дистанции: доля перестрелок / без фрага и смерти'] = {bk: [PD[(sd, bk, 'n')] / n, PD[(sd, bk, 'ничья')] / max(1, PD[(sd, bk, 'n')])] for bk in ('<250', '250-450', '450+')}
        Q = lambda k: [round(float(v), 3) for v in np.quantile(S[k][sd], [0.1, 0.25, 0.5, 0.75, 0.9])] if S[k][sd] else None
        alive_end = S['n'][sd] - S['погиб'][sd]
        out[sd]['_игре'] = {'квантили 10/25/50/75/90 %': 1,
                            'длительность с': Q('длит'), 'пауза с': Q('пауза с'), 'сдвиг в паузе px': Q('сдвиг в паузе'),
                            'снова выглянуть после паузы': S['пауз'][sd] / max(1, S['пауз'][sd] + alive_end)}
    return out


def main():
    import pandas as pd
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from ancient_demos import DEMOS, tr, demo_names, rounds_of
    NADE = 'grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet'
    S = new_stats()
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive'])
        t = t[t.is_alive == True]  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        tracks = {}
        for sid, g in pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y}).groupby('sid'):
            g = g.sort_values('tick')
            tracks[int(sid)] = (g.tick.values.tolist(), g.x.values.tolist(), g.y.values.tolist(), 'CT' if g.team.values[0] == 3 else 'T')
        # сторона меняется в перерыве — в каждом раунде берём team_num на его начале
        tm = {}
        for sid, g in pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values}).groupby('sid'):
            tm[int(sid)] = (g.tick.values, g.team.values)
        d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
        deaths, kills_by = collections.defaultdict(list), collections.defaultdict(list)
        for tk, us, at_, ut, aw in zip(d.tick.values, d.user_steamid.values, d.attacker_steamid.values, d.user_team_num.values, d.attacker_team_num.values):
            if us == us: deaths[int(us)].append(int(tk))
            if at_ == at_ and aw != ut: kills_by[int(at_)].append(int(tk))
        wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
        wf = wf[~wf.weapon.astype(str).str.contains(NADE, case=False) & wf.user_steamid.notna()]
        shots = {int(s): sorted(g.tick.values.tolist()) for s, g in wf.groupby('user_steamid')}
        plants = [r['tplant'] for r in rounds if r['tplant']]
        # по раундам — со своей стороной игрока в этом раунде
        for r in rounds:
            tr_r = {}
            for sid, (tt, xx, yy, _) in tracks.items():
                i0, i1 = bisect.bisect_left(tt, r['t0']), bisect.bisect_right(tt, r['t1'])
                if i1 <= i0: continue
                ticks_, teams_ = tm[sid]; j = np.searchsorted(ticks_, tt[i0])
                tr_r[sid] = (tt[i0:i1], xx[i0:i1], yy[i0:i1], 'CT' if teams_[min(j, len(teams_)-1)] == 3 else 'T')
            analyze(tr_r, shots, deaths, kills_by, [(r['t0'], r['t1'])], plants, S)
        print(demo, S['n']['CT'], S['n']['T'], file=sys.stderr)
    out = summary(S)
    F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'trades.json')
    J = json.load(open(F)); J['peek'] = out; json.dump(J, open(F, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
