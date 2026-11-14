"""Места ролей расстановок CT — из демок про (В142, 14.11.2026; владелец: «пока не дойдёшь до похожих цифр — не заканчивать»).

Структура расстановки (сколько CT к 20-й с у A / мид / B) — как tools/ct_setup_bake.py (pro_tactics.region: ближе к сайту A, чем 0,6 пути
до B, — «A»). У про в каждой структуре своя раскладка мест: в «3-0-2» в стороне A почти всегда один в Connector (0,81 игрока за раунд), в
стороне B — один на Short (0,60). В наших расстановках роли стояли на самих сайтах (Triple / A Site / Cross / Dark) — у ботов на 8–12-й с на
сайте A 1,22 CT против 0,54 у про, в миде (Window + Short + Connector) 0,86 против 1,72; CT на сайте убит до 25 с в 44 % раундов против 6 %.

Что делает: для каждой расстановки tactics.json ctSetups (структура — ctshare.json struct) роли раскладываются по сторонам (сторона роли —
по её нынешнему первому месту), и места роли берутся из долей про этой структуры на этой стороне (зоны с долей ≥ MIN_SHARE):
  · k главных зон стороны (по доле; k — ролей на стороне) — по одной на роль: ближняя к сайту — опорнику (anchorA / anchorB), остальные —
    другим ролям по доле;
  · остальные зоны стороны — той роли, чья главная зона ближе (до 5 мест на роль).
Зоны — только стороны CT (к 20-й с у про CT там бывают не реже T): ранние выходы про в T Ramp / Apps — не места поста.
Взгляд (look / lookPt) — прежний; у роли, чья главная зона — проход мида (MID_LOOK), взгляд — Top Mid (проектное).
Запуск: python3 tools/ct_setup_pos_bake.py --map mirage → правит data/maps/<карта>/tactics.json (ctSetups[*].roles[*].pos, look)."""
import sys, os, json, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shadow'))
import mapdir  # noqa: E402
from pro_tactics import region, src_demos, SITE  # noqa: E402
import round_plan as RP  # noqa: E402

AT = 20
MIN_SHARE = 0.05          # доля зоны (игроков за раунд) — меньше не берётся (проектное число)
MID_LOOK = {'Connector', 'Short', 'Window', 'Hole', 'Catwalk', 'Mid'}   # проход мида — взгляд на Top Mid (проектное)
MAP = mapdir.current()


def pro_zone_shares():
    Z = collections.defaultdict(lambda: collections.defaultdict(collections.Counter)); N = collections.Counter(); SIDE = collections.defaultdict(collections.Counter)
    for rs, T, dth, types in src_demos():
        for r in rs:
            tk = r['t0'] + AT * 64
            ga = T[(T.tick >= tk) & (T.tick < tk + 16)]
            for x, y, sd in zip(ga.x.values, ga.y.values, ga.side.values): SIDE[RP.zkey(RP.zone(x, y))][sd] += 1
            g = ga[ga.side == 'CT']
            if len(g) < 5: continue
            rg = region(g.x.values.astype(float), g.y.values.astype(float))
            st = '%d-%d-%d' % ((rg == 'A').sum(), (rg == 'M').sum(), (rg == 'B').sum()); N[st] += 1
            for x, y, q in zip(g.x.values, g.y.values, rg):
                z = RP.zkey(RP.zone(x, y))
                if z: Z[st][q][z] += 1
    ctz = {z for z, c in SIDE.items() if z and c['CT'] >= c['T']}   # зона стороны CT: к 20-й с там CT бывают не реже T
    return {st: {q: {z: v / N[st] for z, v in c.items() if z in ctz} for q, c in R.items()} for st, R in Z.items()}, N


def zone_center():
    C = collections.defaultdict(list)
    for nm, P in RP.ZP:
        k = RP.zkey(nm)
        if k: C[k] += P
    return {k: (float(np.mean([p[0] for p in P])), float(np.mean([p[1] for p in P]))) for k, P in C.items()}


def main():
    SH, N = pro_zone_shares(); ZC = zone_center()
    f = mapdir.path(MAP, 'tactics.json'); T = json.load(open(f, encoding='utf-8'))
    CS = json.load(open(mapdir.path(MAP, 'ctshare.json'), encoding='utf-8'))['struct']
    for S in T['ctSetups']:
        st = CS.get(S['id']); R = SH.get(st)
        if not R: print(S['id'], 'нет структуры у про', st); continue
        side = {}
        for rn, ro in S['roles'].items():
            c = ZC.get(ro['pos'][0]) if ro.get('pos') else None
            side[rn] = str(region(np.array([c[0]]), np.array([c[1]]))[0]) if c else None
        want = [int(x) for x in st.split('-')]; have = [sum(1 for v in side.values() if v == q) for q in 'AMB']
        if want != have: print(S['id'], st, 'роли по сторонам', have, '— не совпадает, пропуск'); continue
        for q in 'AMB':
            roles = [rn for rn in S['roles'] if side[rn] == q]
            if not roles: continue
            zs = sorted([(z, s) for z, s in R.get(q, {}).items() if s >= MIN_SHARE and z in ZC], key=lambda x: -x[1])
            if not zs: continue
            sc = SITE.get(q); d = lambda a, b: np.hypot(ZC[a][0] - ZC[b][0], ZC[a][1] - ZC[b][1])
            seeds = [z for z, _ in zs[:len(roles)]]
            anc = [rn for rn in roles if rn == 'anchor' + q]
            lists = {}
            if anc and sc is not None:
                sa = min(seeds, key=lambda z: np.hypot(ZC[z][0] - sc[0], ZC[z][1] - sc[1])); lists[anc[0]] = [sa]; seeds.remove(sa)
            for rn in roles:
                if rn not in lists: lists[rn] = [seeds.pop(0)] if seeds else []
            for z, _ in zs:
                if any(z in L for L in lists.values()): continue
                rn = min((r for r in roles if lists[r]), key=lambda r: d(z, lists[r][0]))
                lists[rn].append(z)
            for rn in roles:
                if not lists[rn]: lists[rn] = [zs[0][0]]
                ro = S['roles'][rn]; old = ro['pos']; ro['pos'] = lists[rn][:5]
                if ro['pos'][0] in MID_LOOK and old and old[0] not in MID_LOOK:
                    ro['look'] = 'Top Mid'; ro.pop('lookPt', None)
                print('%-12s %-6s %-9s %s → %s' % (S['id'], st, rn, old, ro['pos']))
    s = json.dumps(T, ensure_ascii=False, indent=1)
    open(f, 'w', encoding='utf-8').write(s + '\n')


if __name__ == '__main__':
    main()
