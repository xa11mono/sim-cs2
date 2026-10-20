#!/usr/bin/env python3
"""(Б2, ENGINE_AUDIT шаг 0б) знание о врагах у ботов — по записи сторожа know_watch.js (поле know в rec_*.json[.gz]).
python3 tools/measure/engine/b2_know.py <карта> <папка прогона>  → tools/measure/runs/b2/<карта>_know.json (+ печать)
Что считает — см. заголовок know_watch.js. На Mirage сигналы «видели» и появления врага дополнительно сверяются с геометрией
игры (tools/map3d/raycast.py): так поломка знания («видели», хотя и наш движок линии не видит) отделяется от ошибки видимости
(движок видит, а в игре линии нет)."""
import sys, os, json, glob, gzip, re, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); MEAS = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(MEAS))
sys.path.insert(0, os.path.join(ROOT, 'tools')); sys.path.insert(0, os.path.join(ROOT, 'tools', 'map3d')); sys.path.insert(0, HERE)
import mapdir  # noqa
mp, run = sys.argv[1], sys.argv[2]
OUT = os.path.join(MEAS, 'runs', 'b2'); os.makedirs(OUT, exist_ok=True)
R0 = mapdir.radar(mp); s = R0['scale'] / 2.0
G = lambda x, y, z: (x * s + R0['pos_x'], R0['pos_y'] - y * s, z)
geo = None
if mp == 'mirage':
    import b2_shoot; b2_shoot.world(mp); geo = b2_shoot.geo_clear
def pct(a, b): return round(100.0 * a / b, 1) if b else None
def q(a, p): return round(float(np.percentile(a, p)), 2) if len(a) else None

anc = collections.defaultdict(lambda: {'n': 0, 'k': [0]*4, 'ki': [0]*4, 'near': [0]*3, 'top': [0]*3, 'unk': 0.0})
dbl = [0, 0, 0, 0]; dblEx = []; ancEx = []
seenBy = collections.defaultdict(lambda: collections.Counter()); seenRows = []
hatch = []; hN = collections.defaultdict(collections.Counter); ph = collections.defaultdict(lambda: [0, 0]); plant = []; voice = []
rounds = 0; files = sorted(glob.glob(os.path.join(run, 'rec_*.json*')))
for f in files:
    R = json.load(gzip.open(f, 'rt', encoding='utf-8') if f.endswith('.gz') else open(f, encoding='utf-8')); K = R['know']
    m = os.path.basename(f).split('_')[1].split('.')[0]; rounds += len(R['rounds'])
    for k, A in K['anc'].items():
        B = anc[k]; B['n'] += A['n']; B['unk'] += A['unk']
        for f2 in ('k', 'ki', 'near', 'top'): B[f2] = [x + y for x, y in zip(B[f2], A[f2])]
    D = K['dbl']; dbl[0] += D['n']; dbl[1] += D['d']; dbl[2] += D['lbl'][0]; dbl[3] += D['lbl'][1]; dblEx += [[m] + e for e in D['ex']]
    ancEx += [[m] + e for e in K['ancEx']]
    for who, c in K['seen']['by'].items(): seenBy[who].update(c)
    seenRows += [[m] + r for r in K['seen']['rows']]
    hatch += K['hatch']
    for t, c in K['hatchN'].items(): hN[t].update(c)
    for k, v in K['ph'].items(): ph[k][0] += v[0]; ph[k][1] += v[1]
    plant += [[m] + r for r in K['plant']]; voice += [[m] + r for r in K['voice']]
    print(os.path.basename(f), 'ok', flush=True)

O = {'map': mp, 'matches': len(files), 'rounds': rounds}
# 1. якоря
O['anc'] = {k: {'n': v['n'], 'ki_ge2_%': pct(v['ki'][2] + v['ki'][3], v['n']), 'ki0_%': pct(v['ki'][0], v['n']), 'k_ge2_%': pct(v['k'][2] + v['k'][3], v['n']),
                'near_lt300_%': pct(v['near'][0], sum(v['near'])), 'top_lt300_%': pct(v['top'][0], sum(v['top'])), 'top_gt800_%': pct(v['top'][2], sum(v['top'])),
                'unk_mean': round(v['unk'] / v['n'], 3) if v['n'] else None} for k, v in sorted(anc.items())}
typ = collections.Counter()
for e in ancEx:
    if e[2] != 'team': continue
    ts = sorted(set(re.sub(r'\+.*', '', c[3]) for c in e[10] if c[5]))
    typ[' + '.join(ts)] += 1
O['anc_pairs_team'] = typ.most_common(10)
O['anc_ex'] = [e for e in ancEx if e[2] == 'team'][:25]
# 2. панель взгляда
O['dbl'] = {'two_marks_%': pct(dbl[0], dbl[1]), 'n': dbl[0], 'samples': dbl[1], 'lkp_from_sound_%': pct(dbl[3], dbl[2])}
O['dbl_ex'] = dblEx[:25]
# 3. «видели»
O['seen_by'] = {w: dict(c, eng0_pct=pct(c['eng0'], c['n']), anyVis0_pct=pct(c['anyVis0'], c['n']), fov0_pct=pct(c['fov0'], c['n']), smoke_pct=pct(c['smoke'], c['n'])) for w, c in seenBy.items()}
# m, tick, team, who, by, e, bx, by, bz, bc, ex, ey, ez, ec, eng, sm, fv, iv, av, dist
if geo:
    cnt = collections.defaultdict(collections.Counter); exb = []
    for r in seenRows:
        m, t, team, who, b, e, bx, by_, bz, bc, ex, ey, ez, ec, eng, sm, fv, iv, av, d = r
        if bz is None or ez is None: continue
        g = geo(G(bx, by_, bz), G(ex, ey, ez), eyes=((46.0,) if bc else (64.0, 46.0)))
        c = cnt[who]; c['n'] += 1; c['eng'] += bool(eng); c['geo'] += g; c['eng_not_geo'] += bool(eng) and not g; c['geo_not_eng'] += g and not eng
        c['no_line_both'] += (not eng) and (not g)
        if bool(eng) and not g and len(exb) < 30: exb.append([m, t, team, who, b, e, d])
    O['seen_geo'] = {w: dict(c, eng_not_geo_pct=pct(c['eng_not_geo'], c['n']), no_line_both_pct=pct(c['no_line_both'], c['n']), geo_not_eng_pct=pct(c['geo_not_eng'], c['n'])) for w, c in cnt.items()}
    O['seen_geo_ex'] = exb
# 4. штриховка
dur = collections.defaultdict(list); why = collections.Counter(); inn = [0, 0]
for team, z, t0, t1, w, n, i in hatch:
    dur[w].append((t1 - t0) / 64); why[w] += 1; inn[0] += i; inn[1] += n
alld = sum(dur.values(), [])
O['hatch'] = {'episodes': len(hatch), 'per_round': round(len(hatch) / max(1, rounds), 1), 'dur_med_s': q(alld, 50), 'dur_q': [q(alld, 25), q(alld, 75), q(alld, 90)],
              'end': {w: [c, pct(c, len(hatch)), q(dur[w], 50)] for w, c in why.items()}, 'enemy_inside_%_of_checks': pct(inn[0], inn[1])}
O['hatch_now'] = {t: {'zones_mean': round(c['zones'] / c['s'], 1), 'foes_in_hatch_%': pct(c['inH'], c['foes']), 'foes_in_belief_%': pct(c['inB'], c['foes']),
                      'foes_nowhere_%': pct(c['inNo'], c['foes'])} for t, c in hN.items()}
# 5. фазы и взгляд при свежей инфе «видели»
P = collections.defaultdict(lambda: [0, 0]); PR = collections.defaultdict(lambda: [0, 0])
for k, (n, f) in ph.items():
    phase, reason, los = k.split('|'); P[phase + ('|los' if los == '1' else '|nolos')][0] += n; P[phase + ('|los' if los == '1' else '|nolos')][1] += f
    PR[phase + '|' + reason][0] += n; PR[phase + '|' + reason][1] += f
O['phase_look'] = {k: [n, pct(f, n)] for k, (n, f) in sorted(P.items())}
O['phase_reason'] = {k: [n, pct(f, n)] for k, (n, f) in sorted(PR.items(), key=lambda x: -x[1][0])[:40]}
# 6. пост-плант: сдвиг к бомбе
pl = [r for r in plant if r[2] == 'team']
fresh = [r for r in pl if r[8] is not None and r[8] <= 5 or r[9] is not None and r[9] <= 5]
O['plant'] = {'rows_team': len(pl), 'fresh_le5s': len(fresh),
              'fresh_w_before_med': q([r[5] for r in fresh], 50), 'fresh_w_after_med': q([r[6] for r in fresh], 50),
              'fresh_enemy_near_old_lt300_%': pct(sum(1 for r in fresh if r[11] < 300), len(fresh)),
              'fresh_enemy_near_site_lt600_%': pct(sum(1 for r in fresh if r[10] < 600), len(fresh)),
              'all_enemy_near_site_lt600_%': pct(sum(1 for r in pl if r[10] < 600), len(pl))}
O['plant_ex'] = fresh[:15]
# 7. коллы «беру …»
vv = [v for v in voice if v[4].startswith('cov') or 'беру угол' in v[5]]
def nm(t): mm = re.search(r'«([^»]+)»', t); return mm.group(1) if mm else t
far = [v for v in vv if nm(v[5]) not in v[8]]
O['voice'] = {'beru': len(vv), 'named_not_own_place_%': pct(len(far), len(vv)), 'ex': far[:20]}
json.dump(O, open(os.path.join(OUT, f'{mp}_know.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in O.items() if not k.endswith('_ex')}, ensure_ascii=False, indent=1))
