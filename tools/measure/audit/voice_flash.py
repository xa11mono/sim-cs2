#!/usr/bin/env python3
"""Этап 4, P1 флешки и войс (по записи аудита aud_*.json с полями этапа 4: vdrop, flashPop, blinds с контекстом).
  • колл «флешу!»: сколько флешек с коллом, успел ли договориться до хлопка, сколько своих в зоне ослепления знали;
  • ослепления своих: предупреждён / видел бросок / не знал; дистанция; роли;
  • войс: договорено и не прозвучало по видам и причинам (устарело / уже сказано / враг убит / толпа / говорящий погиб);
    ожидание в очереди важных фраз (see, death, plant) — когда за 2 с до них был колл «флешу!» и когда нет.
python3 tools/measure/audit/voice_flash.py <метка>…"""
import sys, os, json, glob, collections, statistics
HERE = os.path.dirname(os.path.abspath(__file__))

def med(L): return round(statistics.median(L), 1) if L else None

for lab in sys.argv[1:]:
    D = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'aud_*.json'))) if os.path.getsize(f) > 100]
    R = sum(d['rounds'] for d in D)
    FP = [x for d in D for x in d.get('flashPop', [])]
    print(f'== {lab}: матчей {len(D)}, раундов {R}')
    if FP:
        called = [x for x in FP if x[3] is not None]
        before = [x for x in called if x[3] <= x[0]]
        inzone = [x for x in FP if x[5] > 0]
        print(f'  флешек {len(FP)}: колл договорён до хлопка {len(before)} ({100*len(before)/len(FP):.0f} %), после/не договорён {len(FP)-len(before)}')
        print(f'  колл раньше хлопка на, мс: медиана {med([(x[0]-x[3])/64*1000 for x in before])}')
        print(f'  флешек, где в зоне ослепления был свой (видит точку, ≤1000 px): {len(inzone)} ({100*len(inzone)/len(FP):.0f} %); своих в зоне всего {sum(x[5] for x in inzone)}, из них знали по коллу {sum(x[6] for x in inzone)}')
    BL = [b for d in D for b in d.get('blinds', []) if len(b) > 6]
    M = [b for b in BL if b[2] == 'mate']
    if M:
        k = collections.Counter('предупреждён' if b[6] else 'видел/слышал бросок' if b[7] else 'не знал' for b in M)
        print(f'  ослеплено своих {len(M)} ({100*len(M)/max(1,R):.1f} на 100 раундов): {dict(k)}; секунд медиана {med([b[3] for b in M])}; дистанция до хлопка медиана {med([b[8] for b in M])} px')
        print(f'    роли бросивший → ослеплённый (топ): {collections.Counter((b[9], b[10]) for b in M).most_common(5)}')
    E = [b for b in BL if b[2] == 'enemy']
    if E: print(f'  ослеплено врагов {len(E)} ({100*len(E)/max(1,R):.1f} на 100 раундов), секунд медиана {med([b[3] for b in E])}')
    VD = [x for d in D for x in d.get('vdrop', [])]
    V = [x for d in D for x in d['voice']]
    print(f'  фраз договорено {len(V)} ({len(V)/max(1,R):.1f} на раунд), не прозвучало {len(VD)} ({len(VD)/max(1,R):.1f} на раунд)')
    byk = collections.defaultdict(collections.Counter)
    for x in VD: byk[x[2]][x[3]] += 1
    for kind in sorted(byk, key=lambda k: -sum(byk[k].values())):
        sent = sum(1 for v in V if v['kind'] == kind)
        print(f'    {kind:7} договорено {sent:5d}, не прозвучало {sum(byk[kind].values()):5d}: {dict(byk[kind])}')
    for d in D:
        pass
    imp = ('see', 'death', 'plant', 'defuse')
    fl = collections.defaultdict(list)
    for d in D:
        ft = sorted((v['t'], v['team']) for v in d['voice'] if v['kind'] == 'flash')
        for v in d['voice']:
            if v['kind'] in imp:
                after = any(team == v['team'] and 0 < v['t'] - t <= 128 for t, team in ft)
                fl['после колла флешки' if after else 'без колла рядом'].append(v['wait'] / 64 * 1000)
    for k, L in fl.items(): print(f'    ожидание важной фразы в очереди ({k}): n={len(L)}, медиана {med(L)} мс, 90-й {round(sorted(L)[int(0.9*len(L))]) if L else None} мс')
    crowd = [x for x in VD if x[3] == 'не до того — в канале толпа']
    print(f'    выкинуто из-за толпы: {len(crowd)} (виды {dict(collections.Counter(x[2] for x in crowd))})')
