#!/usr/bin/env python3
"""Детекторы гранат (Г1, Г3, Г4, дубли) — у про по демкам и у ботов по записям матчей.
python3 tools/measure/nades.py pro
python3 tools/measure/nades.py <папка с rec_*.json> [ещё папки...]
Одинаковые определения у про и у ботов (координаты — в пикселях радара):
  - «флешка в перестрелку» (Г1): флешка хлопнула, а враг бросавшего в 400 px от
    хлопка стрелял за последнюю секунду, % флешек;
  - «гранат CT в первые 20 с» (Г3), на раунд;
  - «гранат за 3 с до смерти бросившего» (Г4), на раунд;
  - гранат за раунд, CT / T;
  - «дубль»: граната той же команды и того же типа разорвалась в 120 px и в 3 с
    от предыдущей такой же, % гранат (у про — по разрывам; молотов — начало горения)."""
import sys, os, glob, json
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
TK = 64
def tr(X, Y): return ((np.asarray(X) + 2953) / 5 * 2, (2164 - np.asarray(Y)) / 5 * 2)
NADEW = {'weapon_flashbang': 'flash', 'weapon_smokegrenade': 'smoke', 'weapon_hegrenade': 'he',
         'weapon_molotov': 'molly', 'weapon_incgrenade': 'molly'}

def result(thr, det, deaths, nround):
    """thr: броски [rid, tick, team, type, who]; det: разрывы [rid, tick, team, type, x, y, shooters];
    deaths: {(rid, who): tick}; nround: раундов."""
    out = {}
    fl = [d for d in det if d[3] == 'flash']
    out['Г1 флешка в перестрелку, % флешек'] = round(100 * sum(1 for d in fl if d[6] > 0) / max(1, len(fl)), 1)
    out['Г3 гранат CT в первые 20 с, на раунд'] = round(sum(1 for t in thr if t[2] == 'CT' and t[5] < 20 * TK) / nround, 2)
    out['Г4 гранат за 3 с до смерти, на раунд'] = round(sum(1 for t in thr if (t[0], t[4]) in deaths and 0 <= deaths[(t[0], t[4])] - t[1] <= 3 * TK) / nround, 2)
    out['гранат за раунд: CT'] = round(sum(1 for t in thr if t[2] == 'CT') / nround, 2)
    out['гранат за раунд: T'] = round(sum(1 for t in thr if t[2] == 'T') / nround, 2)
    dup = 0
    ds = sorted(det, key=lambda d: (d[0], d[1]))
    for i, d in enumerate(ds):
        for e in ds[max(0, i - 30):i]:
            if e[0] == d[0] and e[2] == d[2] and e[3] == d[3] and d[1] - e[1] <= 3 * TK and np.hypot(e[4] - d[4], e[5] - d[5]) < 120:
                dup += 1; break
    out['дубль в одну точку, % гранат'] = round(100 * dup / max(1, len(ds)), 1)
    out['раундов'] = nround
    return out

def pro():
    D = os.path.join(ROOT, 'data', 'demos')
    thr, det, deaths, nr = [], [], {}, 0
    for f in sorted(glob.glob(os.path.join(D, '*_weapon_fire.csv.gz'))):
        n = f.replace('_weapon_fire.csv.gz', ''); m = os.path.basename(n)
        wf = pd.read_csv(f); fe = pd.read_csv(n + '_round_freeze_end.csv.gz'); re = pd.read_csv(n + '_round_end.csv.gz')
        de = pd.read_csv(n + '_player_death.csv.gz')
        ev = {'flash': pd.read_csv(n + '_flashbang_detonate.csv.gz'), 'smoke': pd.read_csv(n + '_smokegrenade_detonate.csv.gz'),
              'he': pd.read_csv(n + '_hegrenade_detonate.csv.gz'), 'molly': pd.read_csv(n + '_inferno_startburn.csv.gz')}
        wf['sid'] = wf.user_steamid.astype(str); wf['team'] = np.where(wf.user_team_num == 3, 'CT', 'T')
        wf['px'], wf['py'] = tr(wf.user_X, wf.user_Y)
        shots = wf[~wf.weapon.isin(list(NADEW) + ['weapon_decoy', 'weapon_c4']) & ~wf.weapon.str.contains('knife', na=False)]
        for j, r in fe.reset_index(drop=True).iterrows():
            t0 = r.tick; e = re[re.tick > t0].sort_values('tick')
            if not len(e): continue
            t1 = e.tick.iloc[0]; rid = f'{m}|{j}'; nr += 1
            w = wf[(wf.tick >= t0) & (wf.tick <= t1)]
            team = dict(zip(w.sid, w.team))
            for _, q in w[w.weapon.isin(list(NADEW))].iterrows():
                thr.append((rid, q.tick, q.team, NADEW[q.weapon], q.sid, q.tick - t0))
            dd = de[(de.tick >= t0) & (de.tick <= t1)]
            for _, k in dd.iterrows(): deaths[(rid, str(k.user_steamid))] = k.tick
            sh = shots[(shots.tick >= t0) & (shots.tick <= t1)]
            for tp, E in ev.items():
                E = E[(E.tick >= t0) & (E.tick <= t1)]
                if 'user_steamid' not in E: continue
                for _, q in E.iterrows():
                    tm = team.get(str(q.user_steamid))
                    if tm is None: continue
                    x, y = tr(q.x, q.y)
                    s = sh[(sh.team != tm) & (sh.tick <= q.tick) & (sh.tick > q.tick - TK)]
                    near = int(((s.px - x) ** 2 + (s.py - y) ** 2 < 400 ** 2).sum()) if tp == 'flash' else 0
                    det.append((rid, q.tick, tm, tp, float(x), float(y), near))
    return result(thr, det, deaths, nr)

def bot(dirs):
    thr, det, deaths, nr = [], [], {}, 0
    for dname in dirs:
        for f in sorted(glob.glob(os.path.join(dname, 'rec_*.json'))):
            d = json.load(open(f)); m = os.path.basename(f)
            rounds = [r for r in d['rounds'] if 't1' in r]; nr += len(rounds)
            def rid_of(t):
                for r in rounds:
                    if r['t0'] <= t <= r['t1']: return (m, r['r'], r['t0'])
                return None
            for n in d['nades']:
                R = rid_of(n[0])
                if R: thr.append((R[:2], n[0], n[1], n[2], n[3], n[0] - R[2]))
            for k in d['kills']:
                R = rid_of(k[0])
                if R: deaths[(R[:2], k[5])] = k[0]
            for q in d.get('det', []):
                R = rid_of(q[0])
                if R: det.append((R[:2], q[0], q[1], q[2], q[3], q[4], q[5]))
    return result(thr, det, deaths, nr)

if __name__ == '__main__':
    a = sys.argv[1:]
    print(json.dumps(pro() if a == ['pro'] else bot(a), ensure_ascii=False, indent=1))
