"""Общая проверка (v373, этап 1 плана владельца 16.10): один отчёт после правки — сторож устройства (матчи замера и снимки
отметок), цепочка гранат против про, сравнение раскладов с про. Правило: правка принимается, только если отчёт не хуже.
Запуск: python3 tools/measure/check.py --map mirage <метка замера> [--snaps=watch_snaps.json] [--base=<метка прошлого>]
Пишет tools/measure/results/check_<карта>_<метка>.json и печатает короткий итог (с прошлым — разница)."""
import sys, os, json, glob, subprocess, collections
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE); ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)
import mapdir  # noqa: E402
MAP = mapdir.current()
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
RUN = args[0]
TYP = {'pistol': 'пистолетка', 'full': 'фулл', 'tight': 'фулл', 'force': 'форс', 'half': 'форс', 'eco': 'эко'}

# --- сторож по матчам замера
W = {'n': collections.Counter(), 'emptyBy': collections.Counter(), 'dangerBy': collections.Counter(), 'lostWhy': collections.Counter(), 'ev': collections.defaultdict(list)}
FUN = collections.defaultdict(collections.Counter)   # (сторона, тип раунда, граната) → hands/intent/reached/thrown/lost
rounds = 0
for f in sorted(glob.glob(os.path.join(HERE, 'runs', RUN, 'rec_*.json'))):
    d = json.load(open(f)); w = d.get('watch'); m = os.path.basename(f)[4:-5]
    rounds += len(d['rounds'])
    if not w: continue
    W['n'].update(w['n']); W['emptyBy'].update(w['emptyBy']); W['dangerBy'].update(w['dangerBy']); W['lostWhy'].update(w['nade']['lostWhy'])
    for k, v in w['ev'].items(): W['ev'][k].extend([[m] + x for x in v][:8])
    for part in ('hands', 'intent', 'reached', 'thrown', 'lost'):
        for k, v in w['nade'][part].items():
            sd, rt, t = k.split('|'); FUN[(sd, TYP.get(rt, rt), t)][part] += v
# раундов на сторону по типу — из записи раундов
NR = collections.Counter()
for f in sorted(glob.glob(os.path.join(HERE, 'runs', RUN, 'rec_*.json'))):
    for r in json.load(open(f))['rounds']:
        for sd, k in (('CT', r.get('ctType')), ('T', r.get('tType'))):
            if TYP.get(k): NR[(sd, TYP[k])] += 1
pro = json.load(open(os.path.join(HERE, 'results', 'nades_pro_%s.json' % MAP)))
nade = []
for (sd, rt), n in sorted(NR.items()):
    for t in ('smoke', 'flash', 'he', 'molly'):
        c = FUN[(sd, rt, t)]; p = pro.get('%s / %s' % (sd, rt), {})
        nade.append({'сторона': sd, 'раунд': rt, 'граната': t, 'на руках': round(c['hands']/n, 2), 'задач': round(c['intent']/n, 2), 'дошёл': round(c['reached']/n, 2),
                     'брошено (по задачам)': round(c['thrown']/n, 2), 'пропало задач': round(c['lost']/n, 2), 'про бросают': p.get(t)})

# --- сравнение раскладов
sit_out = os.path.join(HERE, 'results', 'situations_%s_%s.json' % (MAP, RUN))
subprocess.run(['python3', os.path.join(HERE, 'situations.py'), '--map', MAP, RUN, '--out=' + sit_out], check=True, stdout=subprocess.DEVNULL)
sit = json.load(open(sit_out))

rep = {'карта': MAP, 'замер': RUN, 'раундов': rounds,
       'сторож (матчи), на 100 раундов': {k: round(v * 100 / max(1, rounds), 1) for k, v in W['n'].items()},
       'пустое чтение — какие функции': dict(W['emptyBy'].most_common(10)), 'опасность — что': dict(W['dangerBy']),
       'гранаты: почему задача пропала': dict(W['lostWhy'].most_common(12)), 'гранаты: цепочка': nade,
       'расклады': sit['итог'], 'взгляд': sit.get('взгляд'), 'расклады: главные расхождения': sit['расхождения'][:30], 'сторож: примеры': {k: v[:12] for k, v in W['ev'].items()}}
if 'snaps' in opt: rep['сторож (снимки)'] = json.load(open(opt['snaps']))['n']
out = os.path.join(HERE, 'results', 'check_%s_%s.json' % (MAP, RUN))
json.dump(rep, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('сторож на 100 раундов:', json.dumps(rep['сторож (матчи), на 100 раундов'], ensure_ascii=False))
print('расклады:', json.dumps(sit['итог'], ensure_ascii=False))
if 'base' in opt:
    b = json.load(open(os.path.join(HERE, 'results', 'check_%s_%s.json' % (MAP, opt['base']))))
    for k, v in rep['сторож (матчи), на 100 раундов'].items():
        v0 = b['сторож (матчи), на 100 раундов'].get(k, 0)
        print('  %-10s было %6.1f  стало %6.1f  %s' % (k, v0, v, 'ХУЖЕ' if v > v0 * 1.15 + 1 else ''))
    print('  расхождений с про: было %d, стало %d' % (b['расклады']['расхождений'], sit['итог']['расхождений']))
if sit.get('взгляд'):
    b0 = (json.load(open(os.path.join(HERE, 'results', 'check_%s_%s.json' % (MAP, opt['base'])))).get('взгляд') or {}).get('боты', {}) if 'base' in opt else {}
    for k, v in sit['взгляд']['боты'].items():
        print('  взгляд: %-50s про %-8s было %-8s стало %s' % (k, sit['взгляд']['про'].get(k, ''), b0.get(k, ''), v))
print('отчёт:', out)
