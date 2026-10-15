#!/usr/bin/env python3
"""Этап 4, P0: перестрелки по тикам — одно определение для про (новая выгрузка демок: weapon_fire_full, player_hurt,
ticks_fight) и для ботов (fight_tick_rec.js). Скорость — доля от максимальной скорости оружия (у про — по CS2,
у ботов — SPEED × weaponSpeedMul), чтобы масштабы карты не мешали. Бой игрока — «стрелял ≤ 0,5 с назад или ранен
≤ 1 с назад» (без видимости: у про её по тикам нет). До планта.
  стоит < 0,10 | точный шаг 0,10–0,34 (в CS2 точность сохраняется до ~34 % скорости) | движется > 0,34
Метрики:
  1 в бою: доля времени стоит / точный шаг / движется;
  2 скорость в момент выстрела (те же корзины);
  3 очереди: выстрелы с разрывом ≤ 16 тиков — одна очередь; длина очереди и пауза между очередями (≤ 2 с) — квантили;
  4 реакция на входящий урон (первое попадание после 2 с без урона): через сколько сдвинулся > 30 px / начал двигаться
    (> 0,34) / выстрелил в ответ — медианы и доля «не сдвинулся за 1 с»;
  5 смерть: скорость в последнем снимке (≤ 4 тика до смерти), стрелял ли в последние 16 тиков;
  6 первый выстрел боя (3 с без своих выстрелов): скорость; ранили ли самого в 0,5 с после.
python3 tools/measure/audit/fight_bake.py pro [папка]   |   bots <метка>…  (tools/measure/audit/runs/<метка>/fight_tick_rec_*.json)"""
import sys, os, json, glob, math, bisect, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
WS = {'ak47': 215, 'm4a1': 225, 'm4a1_silencer': 225, 'm4a4': 225, 'awp': 200, 'galilar': 215, 'famas': 220, 'aug': 220,
      'sg556': 210, 'ssg08': 230, 'deagle': 230, 'revolver': 220, 'glock': 240, 'hkp2000': 240, 'usp_silencer': 240,
      'p250': 240, 'tec9': 240, 'fiveseven': 240, 'cz75a': 240, 'elite': 240, 'mac10': 240, 'mp9': 240, 'mp7': 220,
      'mp5sd': 235, 'ump45': 230, 'p90': 230, 'bizon': 240, 'nova': 220, 'xm1014': 215, 'mag7': 225, 'negev': 150, 'm249': 195}
def wspeed(w):
    w = str(w or '').lower().replace('weapon_', '')
    for k, v in WS.items():
        if k in w: return v
    return 225
def sbin(f): return 'стоит' if f < 0.10 else 'точный шаг' if f <= 0.34 else 'движется'
def q(L, ps=(0.1, 0.25, 0.5, 0.75, 0.9)):
    if not L: return None
    L = sorted(L); return [round(L[min(len(L)-1, int(p*len(L)))], 3) for p in ps]

class Acc:
    def __init__(s): s.C = collections.Counter(); s.L = collections.defaultdict(list)
    def player(s, snaps, shots, hurt_in, hurt_out, death, t0, cut):
        """snaps: [(тик, x, y, доля скорости)], shots: [(тик, доля)], hurt_in: [(тик, урон, от кого)], death: тик|None"""
        if not snaps: return
        st = [x[0] for x in snaps]; sh = sorted(t for t, _ in shots if t0 <= t < cut); hi = sorted(t for t, _, _ in hurt_in if t0 <= t < cut)
        def recent(L, t, w): i = bisect.bisect_right(L, t) - 1; return i >= 0 and t - L[i] <= w
        for (t, x, y, f) in snaps:
            if not (t0 <= t < cut): continue
            if recent(sh, t, 32) or recent(hi, t, 64):
                s.C['бой снимков'] += 1; s.C['бой ' + sbin(f)] += 1
        for t, f in shots:
            if t0 <= t < cut: s.C['выстрелов'] += 1; s.C['выстрел ' + sbin(f)] += 1
        # очереди
        b = []
        for t in sh:
            if b and t - b[-1] <= 16: b.append(t)
            else:
                if b: s.L['очередь, выстрелов'].append(len(b))
                if b and t - b[-1] <= 128: s.L['пауза между очередями, с'].append((t - b[-1]) / 64)
                b = [t]
        if b: s.L['очередь, выстрелов'].append(len(b))
        # реакция на урон
        def snap_at(t):
            i = bisect.bisect_right(st, t) - 1
            return snaps[i] if i >= 0 and t - st[i] <= 4 else None
        last = -10**9
        for (t, dmg, by) in sorted(hurt_in):
            if not (t0 <= t < cut): continue
            if t - last > 128 and (death is None or death > t + 8):
                p0 = snap_at(t)
                if p0:
                    s.C['первых попаданий'] += 1; s.C['первое попадание: стоял'] += p0[3] < 0.10
                    mv = go = fire = None
                    for (tt, x, y, f) in snaps[bisect.bisect_left(st, t):]:
                        if tt > t + 64 or (death is not None and tt >= death): break
                        if mv is None and math.hypot(x - p0[1], y - p0[2]) > 30: mv = tt - t
                        if go is None and f > 0.34: go = tt - t
                    i = bisect.bisect_right(sh, t)
                    if i < len(sh) and sh[i] - t <= 64: fire = sh[i] - t
                    for k, v in (('сдвинулся >30 px', mv), ('начал двигаться', go), ('выстрелил в ответ', fire)):
                        if v is None: s.C['за 1 с не ' + k] += 1
                        else: s.L[k + ', с'].append(v / 64)
            last = t
        if death is not None and t0 <= death < cut:
            p = snap_at(death - 1) or snap_at(death)
            if p:
                s.C['смертей'] += 1; s.C['смерть ' + sbin(p[3]) + (' стрелял' if recent(sh, death, 16) else ' не стрелял')] += 1
        for t in sh:
            i = sh.index(t)
            if i == 0 or t - sh[i-1] > 192:
                p = snap_at(t)
                if p: s.C['первых выстрелов'] += 1; s.C['первый выстрел ' + sbin(p[3])] += 1; s.C['первый выстрел: ранен в 0,5 с'] += any(t <= h <= t + 32 for h in hi)
    def out(s):
        C = s.C; o = {}
        n = max(1, C['бой снимков']); o['1 в бою: стоит / точный шаг / движется'] = [round(C['бой ' + k] / n, 3) for k in ('стоит', 'точный шаг', 'движется')]
        n = max(1, C['выстрелов']); o['2 выстрел: стоит / точный шаг / движется'] = [round(C['выстрел ' + k] / n, 3) for k in ('стоит', 'точный шаг', 'движется')]
        o['3 очередь, выстрелов (квантили 10/25/50/75/90)'] = q(s.L['очередь, выстрелов'])
        o['3 пауза между очередями ≤2 с, с'] = q(s.L['пауза между очередями, с'])
        n = max(1, C['первых попаданий']); o['4 первое попадание: n / стоял %'] = [C['первых попаданий'], round(100 * C['первое попадание: стоял'] / n, 1)]
        for k in ('сдвинулся >30 px', 'начал двигаться', 'выстрелил в ответ'):
            o['4 ' + k + ': медиана с / за 1 с нет %'] = [q(s.L[k + ', с'], (0.5,))[0] if s.L[k + ', с'] else None, round(100 * C['за 1 с не ' + k] / n, 1)]
        n = max(1, C['смертей']); o['5 смерть (n=%d): стоит/шаг/движется × стрелял/нет %%' % C['смертей']] = {a + ' ' + b: round(100 * C['смерть ' + a + ' ' + b] / n, 1) for a in ('стоит', 'точный шаг', 'движется') for b in ('стрелял', 'не стрелял')}
        n = max(1, C['первых выстрелов']); o['6 первый выстрел боя: стоит / шаг / движется; ранен в 0,5 с %'] = [round(C['первый выстрел ' + k] / n, 3) for k in ('стоит', 'точный шаг', 'движется')] + [round(100 * C['первый выстрел: ранен в 0,5 с'] / n, 1)]
        return o

def run_bots(labels):
    A = Acc()
    for lab in labels:
        for f in sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'fight_tick_rec_*.json'))):
            if os.path.getsize(f) < 100: continue
            d = json.load(open(f))
            SN = collections.defaultdict(list)
            for r in d['snap']: SN[r[1]].append((r[0], r[2], r[3], r[5]))
            SH = collections.defaultdict(list)
            for r in d['shots']: SH[r[1]].append((r[0], r[5]))
            HI = collections.defaultdict(list)
            for r in d['hurt']:
                if r[5] == 'bullet' and r[2]: HI[r[1]].append((r[0], r[3], r[2]))
            DE = collections.defaultdict(list)
            for r in d['deaths']: DE[r[1]].append(r[0])
            for rd in d['rounds']:
                t0, t1 = rd['t0'], rd.get('t1') or 10**9; cut = rd.get('plant') or t1
                for b in set(SN) | set(SH):
                    de = [x for x in DE.get(b, []) if t0 <= x <= t1]
                    A.player([x for x in SN.get(b, []) if t0 <= x[0] <= t1], [x for x in SH.get(b, []) if t0 <= x[0] <= t1],
                             [x for x in HI.get(b, []) if t0 <= x[0] <= t1], [], de[0] if de else None, t0, cut)
    return A.out()

def run_pro(folder):
    import pandas as pd, numpy as np
    from demos import rounds_of
    A = Acc(); used = 0
    for f in sorted(glob.glob(os.path.join(folder, '*_ticks_fight.csv.gz'))):
        demo = os.path.basename(f)[:-len('_ticks_fight.csv.gz')]
        full = os.path.join(folder, demo + '_weapon_fire_full.csv.gz'); hurt = os.path.join(folder, demo + '_player_hurt.csv.gz')
        if not (os.path.exists(full) and os.path.exists(hurt)): continue
        rounds = rounds_of(demo)
        if not rounds: continue
        used += 1
        T = pd.read_csv(f); W = pd.read_csv(full); H = pd.read_csv(hurt)
        D = pd.read_csv(os.path.join(folder, demo + '_player_death.csv.gz'))
        W = W[~W.weapon.astype(str).str.contains('grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet', case=False)]
        wcol = 'active_weapon_name' if 'active_weapon_name' in T else None
        hasv = 'velocity_X' in T
        SN = {}
        for sid, g in T[T.is_alive == True].sort_values('tick').groupby('steamid'):  # noqa: E712
            tk = g.tick.values; x = (g.X.values + 2953) / 5 * 2; y = (2164 - g.Y.values) / 5 * 2
            if hasv: v = np.hypot(g.velocity_X.values, g.velocity_Y.values)
            else:
                v = np.zeros(len(tk)); v[1:] = np.hypot(np.diff(g.X.values), np.diff(g.Y.values)) / np.maximum(1, np.diff(tk)) * 64
            ws = np.array([wspeed(w) for w in g[wcol].values]) if wcol else 225
            SN[int(sid)] = list(zip(tk.tolist(), x.tolist(), y.tolist(), (v / ws).tolist()))
        vx, vy = ('user_velocity_X', 'user_velocity_Y') if 'user_velocity_X' in W else (None, None)
        SH = collections.defaultdict(list)
        for i, r in enumerate(W.itertuples(index=False)):
            sid = getattr(r, 'user_steamid')
            if sid != sid: continue
            sid = int(sid)
            if vx: fr = math.hypot(getattr(r, vx), getattr(r, vy) if vy else 0) / wspeed(getattr(r, 'weapon'))
            else:
                L = SN.get(sid); fr = 0
                if L:
                    j = bisect.bisect_right([a[0] for a in L], r.tick) - 1
                    fr = L[j][3] if j >= 0 else 0
            SH[sid].append((int(r.tick), fr))
        HI = collections.defaultdict(list)
        for r in H.itertuples(index=False):
            if r.attacker_steamid == r.attacker_steamid and r.user_steamid == r.user_steamid and 'grenade' not in str(r.weapon) and 'inferno' not in str(r.weapon):
                HI[int(r.user_steamid)].append((int(r.tick), int(r.dmg_health), int(r.attacker_steamid)))
        DE = collections.defaultdict(list)
        for tk, u in zip(D.tick.values, D.user_steamid.values):
            if u == u: DE[int(u)].append(int(tk))
        for rd in rounds:
            t0, t1 = rd['t0'], rd['t1']; cut = rd['tplant'] or t1
            for sid in set(SN) | set(SH):
                de = [x for x in DE.get(sid, []) if t0 <= x <= t1]
                A.player([x for x in SN.get(sid, []) if t0 <= x[0] <= t1], [x for x in SH.get(sid, []) if t0 <= x[0] <= t1],
                         [x for x in HI.get(sid, []) if t0 <= x[0] <= t1], [], de[0] if de else None, t0, cut)
        print(demo, file=sys.stderr)
    if not used:
        print('Нет демок с ticks_fight + weapon_fire_full + player_hurt — нужна новая выгрузка (parse_demos.py --events)'); sys.exit(1)
    o = A.out(); o['демок'] = used; return o

if __name__ == '__main__':
    if sys.argv[1] == 'pro':
        from demos import DEMOS
        R = run_pro(sys.argv[2] if len(sys.argv) > 2 else DEMOS)
        json.dump(R, open(os.path.join(HERE, 'runs', 'fight_pro.json'), 'w'), ensure_ascii=False, indent=1)
    else:
        R = run_bots(sys.argv[2:])
    for k, v in R.items(): print(f'{k:60} {v}')
