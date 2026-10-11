#!/usr/bin/env python3
"""Разбор аудита: python3 tools/measure/audit/analyze.py <метка> [<метка2> ...]
Читает runs/<метка>/aud_*.json, печатает показатели по механикам и пишет runs/<метка>/summary.json.
Две метки — сравнение «до / после» на тех же матчах."""
import sys, os, json, glob, statistics as st
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
TICK = 64

def pct(a, b): return round(100.0*a/b, 1) if b else None
def med(x): return round(st.median(x), 3) if x else None
def q(x, p):
    if not x: return None
    x = sorted(x); return round(x[min(len(x)-1, int(p*len(x)))], 3)

def analyze(label):
    files = sorted(glob.glob(os.path.join(HERE, 'runs', label, 'aud_*.json')))
    D = []
    for f in files:
        try: D.append(json.load(open(f)))
        except Exception as e: print('не читается', f, e)
    S = {'матчей': len(D), 'раундов': sum(d['rounds'] for d in D)}
    rounds = S['раундов']; mins_stand = sum(d['botTicks']['stand'] for d in D)/TICK/60; mins_move = sum(d['botTicks']['move'] for d in D)/TICK/60
    S['минут бота стоя / в движении'] = [round(mins_stand), round(mins_move)]
    # ---------- 1. память ----------
    H = Counter()
    for d in D:
        for k, v in d['hid'].items(): H[k] += v
    S['1 спрятанный враг: проб'] = H['n']
    S['1 взгляд ±8° на спрятанного врага: сейчас / 3 с назад / через 3 с / последняя точка знания, %'] = [pct(H['hitTrue'], H['n']), pct(H['hitPast'], H['n']), pct(H['hitFut'], H['n']), pct(H['hitLast'], H['n'])]
    ST = defaultdict(Counter)
    for d in D:
        for b, v in d['stale'].items():
            for k, x in v.items(): ST[b][k] += x
    S['1 знание по возрасту контакта: средний вес «остался» / средний реальный уход врага px / доля «остался≥0,5», а враг ушёл >300 px'] = {
        b: [round(ST[b]['held']/ST[b]['n'], 2), round(ST[b]['moved']/ST[b]['n']), pct(ST[b]['heldHiMoved'], ST[b]['heldHi'])] for b in ['0-5','5-10','10-20','20-40','40+'] if ST[b]['n']}
    L = [r for d in D for r in d['leak']]
    ear = [r for r in L if r['src'] == 'ear']; ear_nv = [r for r in ear if not r['voicedBefore']]
    S['1/8 обновлений общей точки команды (LKP) из гипотез «слышали»: всего / из войса / из уха одного бота, войса не было'] = [len(L), sum(1 for r in L if r['src'] == 'voice'), len(ear_nv)]
    S['1/8 утечка «ухо одного → вся команда» на раунд'] = round(len(ear_nv)/rounds, 2) if rounds else None
    S['1/8 после утечки за 1 с другой тиммейт посмотрел туда (±12°), сам не слышав: доля утечек %'] = pct(sum(1 for r in ear_nv if r.get('used', 0) > 0), len(ear_nv))
    # ---------- 2. взгляд ----------
    T = Counter()
    for d in D:
        for k in ('stand', 'standNoInfo', 'move', 'moveNoInfo'): T[k] += d['turns'][k]
    S['2 повороты >45° за 0,25 с вне боя: стоя на минуту / из них без новой информации за 1 с %'] = [round(T['stand']/mins_stand, 2), pct(T['standNoInfo'], T['stand'])]
    S['2 то же в движении: на минуту / без новой информации %'] = [round(T['move']/mins_move, 2), pct(T['moveNoInfo'], T['move'])]
    ev = [e for d in D for e in d['turns']['ev']]
    S['2 причина взгляда при повороте без информации (стоя), топ'] = Counter(str(e[4]) for e in ev if e[2] == 0).most_common(6)
    # туда-обратно: тот же бот, два поворота без инфы за ≤0,6 с
    fl = 0
    for d in D:
        last = {}
        for e in d['turns']['ev']:
            if e[1] in last and e[0] - last[e[1]] <= 40: fl += 1
            last[e[1]] = e[0]
    S['2 «туда-обратно» без информации (два поворота ≤0,6 с), на 100 минут бота'] = round(fl/(mins_stand+mins_move)*100, 2)
    F = [c for d in D for c in d['first']]
    for info in ('none', 'sound', 'voice', 'lkp', 'radar'):
        G = [c for c in F if c['info'] == info]
        S['2/6 первое появление врага, инфа=%s: контактов / прицел уже ≤5° %% / ≤17° %%' % info] = [len(G), pct(sum(1 for c in G if c['off0'] < 0.087), len(G)), pct(sum(1 for c in G if c['off0'] < 0.30), len(G))]
    # ---------- 3. позиция ----------
    P = [p for d in D for p in d['posCh']]
    S['3 смен поста на минуту бота'] = round(len(P)/(mins_stand+mins_move), 2)
    S['3 кто меняет пост (топ функций)'] = Counter(p[4] for p in P).most_common(10)
    back = 0; quick = 0
    for d in D:
        hist = defaultdict(list)
        for p in d['posCh']:
            h = hist[p[1]]
            if h and p[0] - h[-1][0] < TICK: quick += 1
            if len(h) >= 2 and p[0] - h[-2][0] <= 3*TICK and (p[3] or '').split(':')[0] == (h[-2][3] or '').split(':')[0] and (h[-1][3] or '').split(':')[0] != (p[3] or '').split(':')[0]: back += 1
            h.append(p)
    S['3 смена поста меньше чем через 1 с после прошлой: доля смен %'] = pct(quick, len(P))
    S['3 возврат к той же задаче за ≤3 с (A→B→A): доля смен %'] = pct(back, len(P))
    PB = Counter()
    for d in D:
        for k, v in d['posBlock'].items(): PB[k] += v
    S['3 попытки сменить пост, отбитые замком (топ «стоит ⟂ хотели»)'] = PB.most_common(8)
    CH = Counter()
    for d in D:
        for k, v in d.get('chatter', {}).items(): CH[k] += v
    S['3 дребезг поста (меняется два тика подряд): секунд бота на раунд / из них стоит на месте %'] = [round(CH['ticks']/TICK/rounds, 2) if rounds else None, pct(CH['frozen'], CH['ticks'])]
    S['3 двое своих стоят ≤60 px и смотрят одинаково (±25°): пар·0,5 с на раунд'] = round(sum(d['stack'] for d in D)/rounds, 2)
    E = [e for d in D for e in d['exposed']]
    S['3 ранен пулей и выжил: через 4 с сдвинулся <50 px и не в бою, %'] = [len(E), pct(sum(1 for e in E if e[2] < 50 and not e[3]), len(E))]
    # ---------- 4. план ----------
    PL = [w for d in D for w in d['plan']]
    S['4 смен сайта плана T'] = len(PL)
    def cnt(w, s, f):
        A = w['at'].get(str(s)) or w['at'].get(s)
        return None if A is None else sum(1 for x in A if x['alive'] and f(x))
    rows = []
    for w in PL:
        alive0 = sum(1 for x in w['s0'] if x['alive'])
        rows.append({'why': w['why'][:70], 'живых': alive0,
                     'маршрут старый 0/2/5 с': [sum(1 for x in w['s0'] if x['alive'] and x['route']), cnt(w, 2, lambda x: x['route']), cnt(w, 5, lambda x: x['route'])],
                     'граната-задание 0/2/5 с': [sum(1 for x in w['s0'] if x['alive'] and x['nade']), cnt(w, 2, lambda x: x['nade']), cnt(w, 5, lambda x: x['nade'])],
                     'ближе к старому сайту, чем к новому, через 10 с': cnt(w, 10, lambda x: x['dOld'] is not None and x['dOld'] < x['dNew'])})
    S['4 смены сайта T (детали)'] = rows
    S['4 через 5 с после смены у кого-то ещё старый маршрут: смен %'] = pct(sum(1 for r in rows if (r['маршрут старый 0/2/5 с'][2] or 0) > 0), sum(1 for r in rows if r['маршрут старый 0/2/5 с'][2] is not None))
    def old_route(x): return x['alive'] and x.get('rEnd') and x['rEnd'][1] is not None and x['rEnd'][1] < x['rEnd'][0]
    def old_nade(x, t0): return x['alive'] and x.get('nEnd') and x['nEnd'][1] is not None and x['nEnd'][1] < x['nEnd'][0] and x.get('nStart') is not None and x['nStart'] < t0
    o2 = [sum(1 for x in (w['at'].get('2') or []) if old_route(x)) for w in PL if w['at'].get('2')]
    o5 = [sum(1 for x in (w['at'].get('5') or []) if old_route(x)) for w in PL if w['at'].get('5')]
    S['4 маршрут ведёт к СТАРОМУ сайту: смен, где такой есть через 2 с / 5 с, %'] = [pct(sum(1 for v in o2 if v), len(o2)), pct(sum(1 for v in o5 if v), len(o5))]
    n5 = [sum(1 for x in (w['at'].get('5') or []) if old_nade(x, w['t'])) for w in PL if w['at'].get('5')]
    S['4 граната-задание, выданное до смены, в сторону СТАРОГО сайта, через 5 с: смен %'] = pct(sum(1 for v in n5 if v), len(n5))
    S['4 через 5 с после смены у кого-то ещё граната-задание: смен %'] = pct(sum(1 for r in rows if (r['граната-задание 0/2/5 с'][2] or 0) > 0), sum(1 for r in rows if r['граната-задание 0/2/5 с'][2] is not None))
    # ---------- 5. ротации ----------
    C = [c for d in D for c in d['calls']]
    S['5 новых коллов CT'] = len(C)
    S['5 колл без события (ev=0, только карта вероятностей): %'] = pct(sum(1 for c in C if c['ev'] <= 0), len(C))
    S['5 колл без события: на сайте колла на самом деле есть T (≤900 px) %'] = pct(sum(1 for c in C if c['ev'] <= 0 and c['tTrue'][0 if c['site'] == 'A' else 1] > 0), sum(1 for c in C if c['ev'] <= 0))
    S['5 колл с событием: на сайте колла есть T %'] = pct(sum(1 for c in C if c['ev'] > 0 and c['tTrue'][0 if c['site'] == 'A' else 1] > 0), sum(1 for c in C if c['ev'] > 0))
    # ---------- 6. перестрелки ----------
    G = [c for c in F if c['shot'] is not None]
    S['6 контактов с выстрелом / всего'] = [len(G), len(F)]
    S['6 от появления до прицела ≤17°, мс: медиана / 10-й перцентиль (только где прицел был >17°)'] = [None if not [c for c in F if c['aim'] is not None and c['off0'] >= 0.3] else round(med([c['aim'] for c in F if c['aim'] is not None and c['off0'] >= 0.3])*1000/TICK), None if not [c for c in F if c['aim'] is not None and c['off0'] >= 0.3] else round(q([c['aim'] for c in F if c['aim'] is not None and c['off0'] >= 0.3], 0.1)*1000/TICK)]
    S['6 от появления до первого выстрела, мс: медиана / 10-й перцентиль'] = [round(med([c['shot'] for c in G])*1000/TICK), round(q([c['shot'] for c in G], 0.1)*1000/TICK)] if G else None
    S['6 первый выстрел раньше 150 мс после появления %'] = pct(sum(1 for c in G if c['shot'] < 0.15*TICK), len(G))
    S['6 первый выстрел, когда прицел дальше 17° от цели %'] = pct(sum(1 for c in G if c['offShot'] is not None and c['offShot'] > 0.30), len(G))
    for lo, hi, nm in ((0, 0.3, 'прицел уже на цели ≤17°'), (0.3, 1.0, '17–57°'), (1.0, 4, '>57°')):
        g = [c['shot'] for c in G if lo <= c['off0'] < hi]
        S['6 до выстрела, мс, медиана: %s' % nm] = [round(med(g)*1000/TICK) if g else None, len(g)]
    for lo, hi, nm in ((0, 500, '<500 px'), (500, 1000, '500–1000 px'), (1000, 9e9, '>1000 px')):
        g = [c['shot'] for c in G if lo <= c['d'] < hi]
        S['6 до выстрела, мс, медиана: дистанция %s' % nm] = [round(med(g)*1000/TICK) if g else None, len(g)]
    S['6 первый выстрел раньше обычной реакции (префайр по «видел только что»): %'] = pct(sum(1 for c in G if c.get('pf')), sum(1 for c in G if 'pf' in c))
    S['6 первый выстрел: тиков контакта к выстрелу (медиана) / порог реакции (медиана)'] = [med([c['csShot'] for c in G if 'csShot' in c]), med([c['effR'] for c in G if 'effR' in c])]
    S['6 враг замечен вне поля зрения (бот уже в контакте с другим — обзор 360°): доля появлений %'] = pct(sum(1 for c in F if c.get('fov') == 0), len(F))
    S['6 из них бот уже в контакте (cs>0) %'] = pct(sum(1 for c in F if c.get('fov') == 0 and c.get('cs', 0) > 0), sum(1 for c in F if c.get('fov') == 0))
    g2 = [c['shot'] for c in G if c.get('cs', 0) > 0]; g1 = [c['shot'] for c in G if c.get('cs', 0) <= 0]
    S['6 до выстрела, мс, медиана: первый враг (cs=0) / второй враг при живом контакте (cs>0)'] = [round(med(g1)*1000/TICK) if g1 else None, len(g1), round(med(g2)*1000/TICK) if g2 else None, len(g2)]
    S['6 выстрел по второму врагу раньше 150 мс %'] = pct(sum(1 for x in g2 if x < 0.15*TICK), len(g2))
    S['6 выстрел по первому врагу раньше 150 мс %'] = pct(sum(1 for x in g1 if x < 0.15*TICK), len(g1))
    DE = [x for d in D for x in d['deaths']]
    S['6 смертей'] = len(DE)
    S['6 убит, ни разу не увидев убийцу (за раунд) %'] = pct(sum(1 for x in DE if x['seenAgo'] is None), len(DE))
    S['6 убит со спины/сбоку (>90°), не видев убийцу, хотя знал про угрозу из той зоны (вес ≥0,25) %'] = pct(sum(1 for x in DE if x['seenAgo'] is None and (x['off'] or 0) > 1.57 and x['knownW'] >= 0.25), len(DE))
    # ---------- 7. гранаты ----------
    N = [n for d in D for n in d['nades']]
    for tp in ('flash', 'he', 'molly'):
        g = [n for n in N if n['type'] == tp]
        S['7 %s: бросков / свой у точки падения %% / свой на линии броска %%' % tp] = [len(g), pct(sum(1 for n in g if n['nearT'] > 0), len(g)), pct(sum(1 for n in g if n['onLine'] > 0), len(g))]
    for tp in ('he', 'molly'):
        g = [n for n in N if n['type'] == tp and 'nearDmg' in n]
        S['7 %s: свой в радиусе поражения в момент броска %%' % tp] = [len(g), pct(sum(1 for n in g if n['nearDmg'] > 0), len(g))]
    S['7 бросок отменён проверкой «свой в радиусе» (на раунд)'] = round(sum(d.get('nadeCancel', 0) for d in D)/rounds, 2) if rounds else None
    S['7 бросок T по заданию, выданному до смены сайта плана'] = sum(1 for n in N if n['staleSite'])
    BL = [b for d in D for b in d['blinds']]
    S['7 ослеплено своей флешкой >0,35 с: тиммейтов / себя / врагов'] = [sum(1 for b in BL if b[2] == 'mate'), sum(1 for b in BL if b[2] == 'self'), sum(1 for b in BL if b[2] == 'enemy')]
    FF = [x for d in D for x in d['ff']]
    S['7 урон по своим: случаев по источнику'] = Counter(x[3] for x in FF).most_common()
    inc = defaultdict(lambda: [0, 0])
    for i, d in enumerate(D):
        for x in d['ff']: k = (i, x[1], x[2], x[3], x[0]//640); inc[k][0] += 1; inc[k][1] += x[4]
    S['7 урон по своим: эпизодов / HP по источнику'] = {s: [sum(1 for k in inc if k[3] == s), sum(v[1] for k, v in inc.items() if k[3] == s)] for s in sorted(set(k[3] for k in inc))}
    # ---------- 8. коммуникация ----------
    V = [v for d in D for v in d['voice']]
    S['8 фраз договорено на раунд'] = round(len(V)/rounds, 1) if rounds else None
    S['8 от решения сказать до «все услышали», мс: медиана / 90-й'] = [round(med([v['lat'] for v in V])*1000/TICK), round(q([v['lat'] for v in V], 0.9)*1000/TICK)] if V else None
    mv = [m for v in V if v.get('moved') for m in v['moved'] if m is not None]
    S['8 «вижу» договорено, а враг уже ушёл от названной зоны >300 px: %'] = pct(sum(1 for m in mv if m > 300), len(mv))
    return S

labels = [a for a in sys.argv[1:] if not a.startswith('--')]
R = {l: analyze(l) for l in labels}
for l in labels: json.dump(R[l], open(os.path.join(HERE, 'runs', l, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
keys = list(R[labels[0]].keys())
for k in keys:
    vals = [R[l].get(k) for l in labels]
    if isinstance(vals[0], list) and vals[0] and isinstance(vals[0][0], dict):
        print(k); [print('   ', l, json.dumps(R[l].get(k), ensure_ascii=False)) for l in labels]; continue
    print(k + ': ' + ' | '.join(json.dumps(v, ensure_ascii=False) for v in vals))
