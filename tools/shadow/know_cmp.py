"""В142, шаг 3 (13.11.2026): «что знал каждый» — про и боты одной меркой: что знала команда T, когда пошла на сайт.
Знание — первая видимость соперника (про: tools/shadow/see_pro.js — поле зрения 110°, луч по 3D-геометрии; боты: запись rec2.js `see`),
урон и смерти. Выход — как в tools/shadow/round_plan.py (≥ 3 живых T на сайте или плант вдвоём).
Считается по раундам с выходом:
  · знала ли T хоть что-то о CT до выхода (видела / ранила / убила) и за сколько секунд до выхода — последнее знание;
  · сколько секунд от первого знания (первый контакт) до выхода;
  · выход в большинстве (до выхода T убили больше, чем потеряли);
  · первый контакт раунда (видимость любой стороны), с;
  · раунды без выхода: был ли контакт и сколько T убито до 40 с (ушли от боя / потеряли людей).
Запуск: python3 tools/shadow/know_cmp.py [--map mirage] <папка записей ботов rec_*.json.gz> [plans_bots_<метка>.json]"""
import sys, os, json, gzip, glob, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
MAP = mapdir.current()
from demos import event  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SEC = 64


def pro_rounds():
    P = {r['rid']: r for r in json.load(open(os.path.join(HERE, 'plans_%s.json' % MAP), encoding='utf-8'))}
    S = json.load(open(os.path.join(HERE, 'see_pro_%s.json' % MAP)))
    deaths = {}
    for r in S['rounds']:
        rid = '%s|%d' % (r['demo'], r['num'])
        if rid not in P: continue
        if r['demo'] not in deaths:
            d = event(r['demo'], 'player_death'); h = event(r['demo'], 'player_hurt')
            deaths[r['demo']] = ([(int(t), 'CT' if int(s) == 3 else 'T') for t, s in zip(d.tick.values, d.user_team_num.values)],
                                 [(int(t), 'CT' if int(s) == 3 else 'T', 'CT' if a == a and int(a) == 3 else 'T') for t, s, a in zip(h.tick.values, h.user_team_num.values, h.attacker_team_num.values)])
        D, H = deaths[r['demo']]
        t0 = r['t0']
        yield {'plan': P[rid], 'see': [(e[0], e[2]) for e in r['see']], 'see_full': [(e[0], e[2], e[5], e[6], e[7], e[8], e[9], e[10]) for e in r['see'] if len(e) > 10],   # (с, сторона, xy кто, xy кого, скорость кто, кого)
               'kills': [((t - t0) / SEC, s) for t, s in D if r['t0'] <= t <= r['t1']],
               'hurt': [((t - t0) / SEC, v, a) for t, v, a in H if r['t0'] <= t <= r['t1']]}


def bot_rounds(rd, plans):
    P = {r['rid']: r for r in json.load(open(plans, encoding='utf-8'))}
    for f in sorted(glob.glob(os.path.join(rd, 'rec_*.json*'))):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        side = lambda i: 'CT' if str(i).startswith('CT') else 'T'
        PT = collections.defaultdict(list)
        for q in d['pos']:
            if q[5]: PT[q[1]].append((q[0], q[3], q[4]))
        def at(i, tk):   # (x, y, скорость ед/с) игрока i около тика tk
            A = PT.get(i) or []; k = int(np.searchsorted([a[0] for a in A], tk)) if A else 0
            if not A: return (0, 0, 0)
            k = min(max(k, 1), len(A) - 1); a, b = A[k-1], A[k]
            return (b[1], b[2], round(np.hypot(b[1] - a[1], b[2] - a[2]) * 2.5 / max(1e-6, (b[0] - a[0]) / SEC)))
        for r in d['rounds']:
            if 't1' not in r: continue
            rid = '%s|%d' % (os.path.basename(f), r['r'])
            if rid not in P: continue
            t0, t1 = r['t0'], r['t1']
            SF = []
            for q in d['see']:
                if not (t0 <= q[0] <= t1): continue
                a, b = at(q[1], q[0]), at(q[2], q[0]); SF.append(((q[0] - t0) / SEC, side(q[1]), a[0], a[1], b[0], b[1], a[2], b[2]))
            yield {'plan': P[rid], 'see_full': SF, 'see': [((q[0] - t0) / SEC, side(q[1])) for q in d['see'] if t0 <= q[0] <= t1],
                   'kills': [((q[0] - t0) / SEC, q[6]) for q in d['kills'] if t0 <= q[0] <= t1],
                   'hurt': [((q[0] - t0) / SEC, side(q[3]), q[2]) for q in d.get('dmg', []) if t0 <= q[0] <= t1]}


def stats(R, label):
    R = [r for r in R if not r['plan'].get('pistol')]
    ex = [r for r in R if r['plan']['exec'] is not None]
    pc = lambda a, b: '%d %%' % round(100 * a / max(1, b))
    out = {}
    know_before, last_gap, first_gap, adv = 0, [], [], 0
    for r in ex:
        te = r['plan']['exec']
        info = sorted([t for t, s in r['see'] if s == 'T' and t <= te] + [t for t, v, a in r['hurt'] if a == 'T' and v == 'CT' and t <= te] +
                      [t for t, s in r['kills'] if s == 'CT' and t <= te])
        if info:
            know_before += 1; last_gap.append(te - info[-1]); first_gap.append(te - info[0])
        kT = sum(1 for t, s in r['kills'] if s == 'CT' and t <= te); kC = sum(1 for t, s in r['kills'] if s == 'T' and t <= te)
        if kT > kC: adv += 1
    first = [min([t for t, s in r['see']] or [999]) for r in R]
    first = [t for t in first if t < 999]
    nox = [r for r in R if r['plan']['exec'] is None]
    nox_contact = sum(1 for r in nox if r['see']); nox_tdead40 = np.mean([sum(1 for t, s in r['kills'] if s == 'T' and t <= 40) for r in nox]) if nox else 0
    print('%s: раундов %d (без пистолеток), с выходом %d (%s)' % (label, len(R), len(ex), pc(len(ex), len(R))))
    print('   T знала хоть что-то о CT до выхода: %s выходов' % pc(know_before, len(ex)))
    if last_gap: print('   последнее знание → выход: медиана %.0f с (25–75 %%: %.0f–%.0f)' % (np.median(last_gap), np.percentile(last_gap, 25), np.percentile(last_gap, 75)))
    if first_gap: print('   первое знание → выход: медиана %.0f с (25–75 %%: %.0f–%.0f)' % (np.median(first_gap), np.percentile(first_gap, 25), np.percentile(first_gap, 75)))
    print('   выход в большинстве (до выхода T убили больше, чем потеряли): %s' % pc(adv, len(ex)))
    if first: print('   первый контакт раунда (видимость): медиана %.0f с (25–75 %%: %.0f–%.0f)' % (np.median(first), np.percentile(first, 25), np.percentile(first, 75)))
    print('   раунды без выхода: %d; с контактом %s; T убито до 40 с — %.2f за раунд' % (len(nox), pc(nox_contact, len(nox)), nox_tdead40))
    return out


def first_contact(R, label):
    """первый контакт раунда: где (зоны), кто увидел, кто двигался (бег > 150 ед/с) — кто вошёл в чужой угол"""
    from round_plan import zone, zkey   # зоны набора карты (как в шаге 1)
    R = [r for r in R if not r['plan'].get('pistol') and r.get('see_full')]
    walk = 150; c_who, c_mv, c_z, c_zt = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
    for r in R:
        t, sd, ax, ay, bx, by, va, vb = min(r['see_full'])
        T_pos = (ax, ay) if sd == 'T' else (bx, by); C_pos = (bx, by) if sd == 'T' else (ax, ay)
        vT = va if sd == 'T' else vb; vC = vb if sd == 'T' else va
        c_who[sd] += 1
        c_mv['T бежит, CT стоит' if vT > walk and vC <= walk else 'CT бежит, T стоит' if vC > walk and vT <= walk else 'оба бегут' if vT > walk else 'оба стоят / шагом'] += 1
        c_z[zkey(zone(*T_pos)) or '—'] += 1; c_zt[zkey(zone(*C_pos)) or '—'] += 1
    n = len(R); pc = lambda v: '%d %%' % round(100 * v / max(1, n))
    print('%s — первый контакт (%d раундов): первым увидел %s' % (label, n, ', '.join('%s %s' % (k, pc(v)) for k, v in c_who.most_common())))
    print('   кто двигался: ' + ', '.join('%s %s' % (k, pc(v)) for k, v in c_mv.most_common()))
    print('   где был T: ' + ', '.join('%s %s' % (k, pc(v)) for k, v in c_z.most_common(8)))
    print('   где был CT: ' + ', '.join('%s %s' % (k, pc(v)) for k, v in c_zt.most_common(8)))


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    sys.path.insert(0, HERE)
    PR = list(pro_rounds()); stats(PR, 'про')
    if a:
        plans = a[1] if len(a) > 1 else os.path.join(HERE, 'plans_bots_v570b16_mir.json')
        BR = list(bot_rounds(a[0], plans)); stats(BR, 'боты')
    first_contact(PR, 'про')
    if a: first_contact(BR, 'боты')
