#!/usr/bin/env python3
"""Автопоиск странностей по записям прогона (05.11, план: «анализ записей — без новых прогонов»).
python3 tools/measure/anomaly.py <метка> [<метка> ...]   (папки tools/measure/runs/<метка>, записи rec2.js с полной записью)
Ничего не меняет и не запускает: читает rec_*.json и печатает короткую сводку по механикам — где у ботов странное.
Сравнение с про — там, где число про есть в проекте (со ссылкой на источник в строке)."""
import sys, os, json, glob, collections, statistics as st, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TICK = 64

def load(label):
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', label, 'rec_*.json'))):
        yield json.load(open(f))

def pct(a, b): return '%.0f %%' % (100.0 * a / b) if b else '—'

def rnd_of(R, t):
    for r in R:
        if r['t0'] <= t <= r.get('t1', 1e18): return r
    return None

def map_of(label):
    return 'ancient' if 'anc' in label else 'mirage'

def analyze(label):
    mp = map_of(label)
    pu = json.load(open(os.path.join(ROOT, 'data', 'maps', mp, 'map.json'))).get('pxUnits') or 2.5
    tacs = [t['id'] for t in json.load(open(os.path.join(ROOT, 'data', 'maps', mp, 'tactics.json')))['tTactics']]
    D = collections.Counter(); line_sec = []; voice_rep = collections.Counter(); slow = []; tac_n = collections.Counter()
    deaths = 0; near = 0; traded = 0; eco = collections.Counter(); exu = collections.Counter(); nrounds = 0
    leave_alive_close = 0; leave_total = 0; fight_end_no_back = 0; off_total = 0
    for d in load(label):
        R = d['rounds']; nrounds += len(R)
        for r in R:
            tac_n[r.get('tac')] += 1
            if r.get('tType') in ('eco', 'pistol'):
                eco[(r['tType'], 'раш' if str(r.get('tac', '')).startswith('rush') else 'не раш')] += 1
        # --- Д1: на линии → за укрытие. По каждому боту — фазы цикла по времени
        by = collections.defaultdict(list)
        for e in d.get('fc', []): by[e[1]].append(e)
        for bid, L in by.items():
            for i, e in enumerate(L):
                t, _, was, now, foe, dist, alive, sees, hp = e
                if now == 'line':
                    nxt = L[i + 1] if i + 1 < len(L) else None
                    if nxt: line_sec.append((nxt[0] - t) / TICK)
                if now == 'off':
                    off_total += 1
                    leave_total += 1
                    if alive and dist * pu < 600: leave_alive_close += 1   # ушёл с линии, враг жив и ближе 600 ед.
                    nxt = L[i + 1] if i + 1 < len(L) else None
                    if nxt and nxt[3] == '': fight_end_no_back += 1      # из укрытия не выглянул — перестрелка кончилась
        # --- размены: погибший — был ли свой в 350 px радара (как в v154) (про 71–77 %, 500_decide_afterkill_cover v154), разменяли ли за 3 с
        pos = collections.defaultdict(dict)
        for p in d['pos']:
            if p[5]: pos[p[0]][p[1]] = (p[2], p[3], p[4])
        K = d['kills']
        for k in K:
            t, att, att_t, ax, ay, vic, vic_t, vx, vy = k[:9]
            if not att_t or att_t == vic_t: continue
            deaths += 1
            tk = t - t % 16; P = pos.get(tk) or pos.get(tk - 16) or {}
            side = 1 if vic_t == 'CT' else 0
            if any(b != vic and s == side and ((x - vx) ** 2 + (y - vy) ** 2) ** 0.5 < 350 for b, (s, x, y) in P.items()): near += 1
            if any(k2[5] == att and t < k2[0] <= t + 3 * TICK for k2 in K): traded += 1
        # --- войс: одна реплика много раз за раунд
        per = collections.Counter()
        for v in d.get('voice', []):
            r = rnd_of(R, v[0]); per[(r['r'] if r else -1, v[1], re.sub(r'\d+', 'N', v[3]))] += 1
        for k, n in per.items():
            if n >= 4: voice_rep[k[2][:60]] += 1
        slow += [s[1] for s in d.get('slow', [])]
        for e in d.get('exu', []): exu[e[1]] += 1
    print('== %s (%s), раундов %d' % (label, mp, nrounds))
    if line_sec:
        ls = sorted(line_sec)
        print('  Д1 на линии, с: медиана %.2f, 25 %% %.2f, 75 %% %.2f; ушёл за укрытие, когда враг жив и ближе 600 ед.: %s из %d; из укрытия не выглянул: %s'
              % (st.median(ls), ls[len(ls) // 4], ls[3 * len(ls) // 4], pct(leave_alive_close, leave_total), leave_total, pct(fight_end_no_back, off_total)))
    print('  Размены: у погибшего свой ближе 350 px радара — %s (про 71–77 %%, тот же порог, v154); убийцу убили за 3 с — %s; смертей %d' % (pct(near, deaths), pct(traded, deaths), deaths))
    if eco:
        for t in ('pistol', 'eco'):
            n = eco[(t, 'раш')] + eco[(t, 'не раш')]
            if n: print('  %s: раш в %s (%d раундов)' % ('Пистолетки' if t == 'pistol' else 'Эко', pct(eco[(t, 'раш')], n), n))
    never = [t for t in tacs if tac_n[t] == 0]
    print('  Тактики T, ни разу не выбраны: %s' % (', '.join(never) if never else 'нет'))
    rare = sorted([(tac_n[t], t) for t in tacs if 0 < tac_n[t] <= max(1, nrounds // 100)])
    if rare: print('  Тактики T, выбраны ≤ 1 %% раундов: %s' % ', '.join('%s (%d)' % (t, n) for n, t in rare))
    if voice_rep: print('  Войс — реплика ≥ 4 раз за раунд (в скольких раундах): %s' % '; '.join('«%s» %d' % kv for kv in voice_rep.most_common(5)))
    if slow: print('  Долгие тики > 25 мс: %d (> 100 мс: %d, макс %d мс) — на ПК, с записью' % (len(slow), sum(1 for x in slow if x > 100), max(slow)))
    if exu: print('  Смоки выхода (события): %s' % ', '.join('%s %d' % kv for kv in exu.most_common()))

if __name__ == '__main__':
    for lab in sys.argv[1:]: analyze(lab)
