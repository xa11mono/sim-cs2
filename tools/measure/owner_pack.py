#!/usr/bin/env python3
"""Шаг 0 пака владельца 09.11 (docs/reports/ARCH_ROOT_CAUSES_2026-11-09.md): сколько раз каждая проблема уже есть в записях прогона.
python3 tools/measure/owner_pack.py <метка> [<метка> ...]     (папки tools/measure/runs/<метка>, записи rec2.js с полной записью)
Ничего не меняет и не запускает. Счётчики — «было» для правок пакета; правка, после которой эпизодов не стало меньше, — откат.
Пороги детекторов — проектные числа (чтобы считать одинаково до и после правки), а не правила игры."""
import sys, os, json, glob, collections, re, bisect
HERE = os.path.dirname(os.path.abspath(__file__))
TICK = 64
PISTOL = {'GLOCK', 'USP', 'P2000', 'P250', 'DEAGLE', 'FIVE7', 'TEC9', 'ELITE', 'CZ'}
RIFLE = {'AK', 'M4', 'M4S', 'AUG', 'SG', 'FAMAS', 'GALIL'}
STAND_PX = 25          # «стоит»: за окно сдвинулся меньше (как stall у сторожа)
HELP_R = 600           # свой в бою ближе (px радара) — «рядом» (как nM в 350)
PICK_R = 60            # прошёл мимо оружия ближе (px)

def cat(tag):
    t = tag or ''
    for name, rx in (('пост-плант', r'^(postplant|pp)'), ('охота/клатч', r'^(endhunt|hunt$|clutch)'),
                     ('ретейк/сбор', r'^(retake|gather|bombwatch|defuse)'), ('сейв', r'^save'), ('уход от бомбы', r'^flee'),
                     ('бой', r'^(contact|tradeR|repos)'), ('выход T', r'^(stage|exec|sitehold|clear|plantspot|awpline)'),
                     ('дефолт T', r'^default'), ('пост CT', r'^(anchor|mid$|set:|cts|stack|earlyPeek|after:)'),
                     ('маршрут', r'^route:'), ('проба', r'^probe'), ('гранаты', r'^(lineup|smokeWait|smokeLine|utilWait|utilHold)'),
                     ('подбор', r'^pickup'), ('ротация', r'^(rotate|fill)')):
        if re.match(rx, t): return name
    return 'без задачи' if not t else 'другое'

def load(label):
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', label, 'rec_*.json'))):
        yield json.load(open(f))

class Rec:
    def __init__(s, d):
        s.d = d
        s.pos = collections.defaultdict(dict)        # бот → тик(кратный 16) → (x, y, жив, оружие)
        for p in d['pos']: s.pos[p[1]][p[0]] = (p[3], p[4], p[5], p[7], p[2])
        s.team = {p[1]: ('CT' if p[2] else 'T') for p in d['pos'][:20]}
        s.task = collections.defaultdict(list)       # бот → [(тик, задача)]
        for t in d['task']: s.task[t[1]].append((t[0], t[2]))
        s.tt = {b: [x[0] for x in L] for b, L in s.task.items()}
        s.fc = collections.defaultdict(list)
        for e in d['fc']: s.fc[e[1]].append(e)
        s.fct = {b: [x[0] for x in L] for b, L in s.fc.items()}
    def at(s, b, t):
        P = s.pos[b]; k = t - t % 16
        return P.get(k) or P.get(k - 16)
    def tag(s, b, t):
        T = s.tt.get(b); i = bisect.bisect_right(T, t) - 1 if T else -1
        return s.task[b][i][1] if i >= 0 else ''
    def phase(s, b, t):
        T = s.fct.get(b); i = bisect.bisect_right(T, t) - 1 if T else -1
        return s.fc[b][i][3] if i >= 0 else ''
    def moved(s, b, t0, t1):
        a = s.at(b, t0); m = 0
        if not a: return None
        for t in range(t0 - t0 % 16 + 16, t1 + 1, 16):
            q = s.at(b, t)
            if not q or not q[2]: return None   # погиб — не «стоял»
            m = max(m, ((q[0] - a[0]) ** 2 + (q[1] - a[1]) ** 2) ** 0.5)
        return m

def analyze(label):
    N = collections.Counter(); byC = collections.defaultdict(collections.Counter); rounds = 0
    stand_sec = []; flash_n = flash_hit = 0; awp_sh = awp_close = 0
    for d in load(label):
        R = Rec(d); rounds += len(d['rounds'])
        # ---- 1. ушёл за укрытие, не выглянул, враг жив — и стоит
        for b, L in R.fc.items():
            for i, e in enumerate(L):
                if e[3] != 'off' or not e[6]: continue
                nx = L[i + 1] if i + 1 < len(L) else None
                if not nx or nx[3] != '': continue
                N['укрытие: ушёл, не выглянул, враг жив'] += 1
                t = nx[0]; m = R.moved(b, t, t + 3 * TICK)
                if m is not None and m < STAND_PX:
                    N['укрытие: … и 3 с стоит'] += 1; byC['укрытие: стоит — задача'][cat(R.tag(b, t))] += 1
                    k = 3
                    while k < 15 and (R.moved(b, t, t + (k + 1) * TICK) or 1e9) < STAND_PX: k += 1
                    stand_sec.append(k)
        # ---- 2. получил урон, стрелка не видел (не в перестрелке), 3 с стоит на месте
        for e in d['dmg']:
            t, att, att_t, vic, dmg, src, hp = e[:7]
            if not att_t or att_t == R.team.get(vic) or hp <= 0: continue
            if R.phase(vic, t) or R.phase(vic, t + 32): continue          # в перестрелке — это бой (п.5)
            N['урон без боя (не видит стрелка)'] += 1
            m = R.moved(vic, t, t + 3 * TICK)
            if m is not None and m < STAND_PX:
                N['урон без боя: 3 с стоит'] += 1; byC['урон без боя: стоит — задача'][cat(R.tag(vic, t))] += 1
                if any(x[3] == vic and t < x[0] <= t + 6 * TICK for x in d['dmg'] if x[0] <= t + 6 * TICK and x[0] > t): N['урон без боя: стоит и снова ранен / убит за 6 с'] += 1
        # ---- 3. свой начал бой рядом — помог ли (сократил расстояние на 50 px или сам вступил в бой за 3 с)
        for b, L in R.fc.items():
            for e in L:
                if e[2] != '' or e[3] != 'line': continue
                t = e[0]; pm = R.at(b, t)
                if not pm: continue
                for o, tm in R.team.items():
                    if o == b or tm != R.team.get(b): continue
                    po = R.at(o, t)
                    if not po or not po[2] or R.phase(o, t): continue
                    d0 = ((po[0] - pm[0]) ** 2 + (po[1] - pm[1]) ** 2) ** 0.5
                    if d0 > HELP_R: continue
                    c = cat(R.tag(o, t)); byC['бой рядом: всего — задача'][c] += 1
                    p3 = R.at(o, t + 3 * TICK)
                    if not p3 or not p3[2]: continue
                    d3 = ((p3[0] - pm[0]) ** 2 + (p3[1] - pm[1]) ** 2) ** 0.5
                    fought = any(t < x[0] <= t + 3 * TICK and x[3] == 'line' for x in R.fc.get(o, []))
                    if d3 > d0 - 50 and not fought: byC['бой рядом: не помог — задача'][c] += 1
        # ---- 4. прошёл мимо лучшего оружия (винтовка убитого на полу; у бота пистолет / ПП)
        for k in d['kills']:
            t, vic = k[0], k[5]
            last = None
            for tt in range(t - t % 16, t - 160, -16):
                q = R.pos[vic].get(tt)
                if q: last = q; break
            if not last or last[3] not in RIFLE: continue
            w, gx, gy = last[3], k[7], k[8]
            taken = None
            for tt in range(t - t % 16 + 16, t + 60 * TICK, 16):
                for o in R.team:
                    q = R.pos[o].get(tt)
                    if q and q[2] and q[3] == w and ((q[0] - gx) ** 2 + (q[1] - gy) ** 2) ** 0.5 < 80:
                        prev = R.pos[o].get(tt - 16)
                        if prev and prev[3] != w: taken = tt; break
                if taken: break
            end = taken or t + 60 * TICK; seen = set()
            for tt in range(t - t % 16 + 32, end, 16):
                for o in R.team:
                    if o == vic or o in seen: continue
                    q = R.pos[o].get(tt)
                    if not q or not q[2] or not (q[3] in PISTOL or q[3].startswith(('MP', 'MAC', 'UMP', 'P90'))): continue
                    if ((q[0] - gx) ** 2 + (q[1] - gy) ** 2) ** 0.5 > PICK_R: continue
                    seen.add(o); q2 = R.pos[o].get(tt + 2 * TICK - (tt + 2 * TICK) % 16)
                    if q2 and q2[3] == w: continue
                    byC['мимо винтовки (пистолет / ПП) — задача'][cat(R.tag(o, tt))] += 1
        # ---- 5. двое на посту ближе 70 px (каждые 0,5 с) — по задаче
        act = collections.defaultdict(list)
        for a in d['act']:
            if a[7]: act[a[0]].append(a)
        for t, L in act.items():
            for i in range(len(L)):
                for j in range(i + 1, len(L)):
                    a, b = L[i], L[j]
                    if R.team.get(a[1]) != R.team.get(b[1]): continue
                    pa, pb = R.at(a[1], t), R.at(b[1], t)
                    if pa and pb and ((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2) ** 0.5 < 70:
                        byC['двое на посту ближе 70 px, пар × 0,5 с — задача'][cat(a[2])] += 1
        # ---- 6. войс: «держу бомбу, смотрю X» — одинаковый X у 2+ в раунде; «смотрю спину» — повторы в раунде
        per = collections.Counter(); back = collections.Counter()
        for v in d['voice']:
            r = next((x['r'] for x in d['rounds'] if x['t0'] <= v[0] <= x.get('t1', 1e18)), -1)
            m = re.match(r'держу бомбу, смотрю (.+)', v[3])
            if m: per[(r, v[1], m.group(1))] += 1
            if v[3].startswith('смотрю спину'): back[r] += 1
        N['пост-плант: тот же угол у 2+ (раундов×углов)'] += sum(1 for n in per.values() if n >= 2)
        N['«смотрю спину» ≥ 2 раз в раунде (раундов)'] += sum(1 for n in back.values() if n >= 2)
        # ---- 7. уход от бомбы ↔ пост-плант: метания (flee → postplant → flee)
        for b, L in R.task.items():
            seq = [cat(x[1]) for x in L]
            for i in range(len(seq) - 2):
                if seq[i] == 'уход от бомбы' and seq[i + 1] == 'пост-плант' and seq[i + 2] == 'уход от бомбы': N['уход от бомбы ↔ пост-плант (метаний)'] += 1
        # ---- 8. тимкилл, а у убитого ≥ 40 урона от врагов (в ассисте окажется враг)
        for k in d['kills']:
            if k[2] and k[2] == k[6]:
                N['тимкиллов'] += 1
                r = next((x for x in d['rounds'] if x['t0'] <= k[0] <= x.get('t1', 1e18)), None)
                dm = sum(x[4] for x in d['dmg'] if x[3] == k[5] and x[2] and x[2] != k[6] and r and r['t0'] <= x[0] <= k[0])
                if dm >= 40: N['тимкилл: враг попадёт в ассист'] += 1
        # ---- 9. своя граната (не лайнап), когда стрелял ≤ 1 с назад (в бою)
        for nd in d['nades']:
            if not nd[11]:
                N['своих гранат (не лайнап)'] += 1
                if nd[9] <= TICK: N['своя граната в бою (стрелял ≤ 1 с)'] += 1
        # ---- 10. флешки: ослепила ли хоть одного врага (по метке «ослеплён» ближайшей выборки 0,5 с)
        actT = collections.defaultdict(dict)
        for a in d['act']: actT[a[0]][a[1]] = a
        for e in d['det']:
            if e[2] != 'flash': continue
            flash_n += 1; t1 = e[0] - e[0] % 32 + 32; hit = False
            for tt in (t1, t1 + 32):
                for o, a in actT.get(tt, {}).items():
                    if a[5] and R.team.get(o) != e[1]:
                        q = R.at(o, tt)
                        if q and ((q[0] - e[3]) ** 2 + (q[1] - e[4]) ** 2) ** 0.5 < 1100: hit = True
            flash_hit += hit
        # ---- 11. AWP: выстрелов ближе 230 px (по правилу — всегда без прицела)
        for s in d['shots']:
            if s[3] == 'AWP':
                awp_sh += 1
                if s[4] < 230: awp_close += 1
        # ---- 12. сторож: пробы, снятые по сроку; T на спавне
        gw = d.get('gw') or {}
        if gw.get('probe'): N['пробы всего'] += gw['probe'][0]; N['пробы сняты по сроку, не дойдя'] += gw['probe'][1]
        N['T стоят на своём спавне после 5 с, с'] += round(gw.get('spawnT', 0))
        # ---- 13. двое T, один в сейве, другой нет
        for r in d['rounds']:
            split = False
            for t in range(r['t0'], r.get('t1', r['t0']), 64):
                alive = [b for b, tm in R.team.items() if tm == 'T' and (R.at(b, t) or (0, 0, 0))[2]]
                if len(alive) == 2:
                    c = [cat(R.tag(b, t)) == 'сейв' for b in alive]
                    if c[0] != c[1]: split = True; break
            N['раундов: двое T, один сейв, другой нет'] += split
    print('== %s: раундов %d (на 100 раундов — в скобках)' % (label, rounds))
    f = lambda n: '%d (%.1f)' % (n, 100.0 * n / rounds) if rounds else str(n)
    for k, v in N.items(): print('  %s: %s' % (k, f(v)))
    if stand_sec: s = sorted(stand_sec); print('  укрытие: стоит, с — медиана %d, 75 %% %d' % (s[len(s) // 2], s[3 * len(s) // 4]))
    print('  флешек: %d, ослепили хоть одного врага: %d (%.0f %%)' % (flash_n, flash_hit, 100.0 * flash_hit / max(1, flash_n)))
    print('  AWP: выстрелов %d, ближе 230 px (без прицела по правилу): %d (%.0f %%)' % (awp_sh, awp_close, 100.0 * awp_close / max(1, awp_sh)))
    for k, C in byC.items():
        print('  %s: %s' % (k, ', '.join('%s %d' % kv for kv in C.most_common())))
    if byC.get('бой рядом: всего — задача'):
        A, B = byC['бой рядом: всего — задача'], byC['бой рядом: не помог — задача']
        print('  бой рядом: доля «не помог» по задаче: %s' % ', '.join('%s %.0f %% (%d)' % (c, 100.0 * B[c] / A[c], A[c]) for c, _ in A.most_common() if A[c] >= 20))

if __name__ == '__main__':
    for lab in sys.argv[1:]: analyze(lab)
