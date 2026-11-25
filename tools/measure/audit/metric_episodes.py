#!/usr/bin/env python3
"""(Р2, 25.11, владелец: «проверь достоверность детекторов stall и danger») Разбор событий счётчиков по фактическим причинам.
Игру не меняет — читает записи матчей tools/measure/runs/<метка>/rec_*.json (rec2.js): watch.ev (выборка событий, ≤ 40 на вид в матче),
act (каждые 0,5 с: задача, режим боя, ослеплён, причины шага / остановки, причина взгляда, контакт), see (кто кого впервые увидел),
blind (ослепления).

  python3 tools/measure/audit/metric_episodes.py <метка> [<метка> …] [--out=файл.json]

stall делится на: «залип» (блокировка задачи — не застревание в геометрии), «застрял: стена / уступ / край пола / огонь» (геометрия или
огонь на шаге), «застрял: шаг проходит, а стоит» (геометрия не мешает — стоит по другой причине; причина остановки — _stopWhy),
«нет пути» / «на точке пути».
danger «флешка без реакции» — по контексту на момент проверки (через 1,5 с после хлопка): ослеплён (отворот / неподвижность ослеплённого
— не ошибка по определению счётчика не доказаны); в бою / держит контакт с другим врагом; бросавшего не видел до хлопка (поворот «к точке
броска» требует знания, которого может не быть); иначе — «без объяснения в записи» (кандидат в ошибку, нужен разбор по снимку).
Выборка событий в записи ограничена (≤ 40 на вид в матче) — доля покрытия пишется."""
import sys, os, json, glob, re, collections, bisect
HERE = os.path.dirname(os.path.abspath(__file__)); RUNS = os.path.join(os.path.dirname(HERE), 'runs')
labels = [a for a in sys.argv[1:] if not a.startswith('--')]; OUT = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--out=')), None)
ACT = ['tick', 'id', 'post', 'state', 'fc', 'blind', 'crouch', 'atPost', 'walkWhy', 'runWhy', 'stopWhy', 'stateWhy', 'lookReason', 'lookLvl', 'contact']

def stall_cause(text):
    if text.startswith('залип'): return 'залип: блокировка задачи (не геометрия)'
    m = re.search(r'\): (.*)$', text); why = m.group(1) if m else text
    if why.startswith('шаг проходит'):
        s = re.search(r'стоп: ([^;]*);', why); return 'застрял: шаг свободен, стоит (стоп: ' + (s.group(1).strip() if s else '?') + ')'
    return 'застрял: ' + why.split(' (')[0]

def analyse(label):
    R = {'label': label, 'matches': 0, 'rounds': 0, 'stall': {'n': 0, 'sampled': 0, 'by': collections.Counter(), 'tasks': collections.Counter()},
         'danger': {'n': 0, 'by': collections.Counter(), 'flash': {'sampled': 0, 'ctx': collections.Counter(), 'examples': []}}}
    for f in sorted(glob.glob(os.path.join(RUNS, label, 'rec_*.json'))):
        d = json.load(open(f)); w = d.get('watch') or {}; m = os.path.basename(f)[4:-5]
        R['matches'] += 1; R['rounds'] += len(d.get('rounds') or [])
        R['stall']['n'] += (w.get('n') or {}).get('stall', 0)
        for e in (w.get('ev') or {}).get('stall', []):
            R['stall']['sampled'] += 1; R['stall']['by'][stall_cause(e[2])] += 1
            t = re.findall(r'«([^»]+)»', e[2]); R['stall']['tasks'][' / '.join(t[:2])] += 1
        # (владелец 25.11) stall по категориям: физическое застревание / нет пути / блокировка задачи (на посту и держит — тактическое
        # ожидание с отказом арбитража; не на посту и не идёт — кандидат в ошибочную блокировку) / «шаг свободен, стоит» / повтор эпизода
        actx = collections.defaultdict(list)
        for a in d.get('act') or []: actx[a[1]].append(a)
        seenblk = set()
        for e in (w.get('ev') or {}).get('stall', []):
            tk, bid, txt = e[0], e[1], e[2]; L = actx.get(bid, []); i = bisect.bisect_right([a[0] for a in L], tk) - 1; A = dict(zip(ACT, L[i])) if i >= 0 else {}
            if txt.startswith('залип'):
                key = (bid, e[-1], tuple(re.findall(r'«([^»]+)»', txt)))
                if key in seenblk: cat = 'повтор того же эпизода (тот же бот, раунд, пара задач)'
                elif A.get('atPost') and (A.get('stopWhy') or '').startswith('на посту'): cat = 'блокировка задачи: бот на посту своей задачи и держит (ожидание / удержание; обоснованность отказа — по записи не доказуема)'
                else: cat = 'блокировка задачи: бот не на посту и не идёт (кандидат в ошибочную блокировку)'
                seenblk.add(key)
            elif re.search(r'\): (стена|уступ|край пола|огонь)', txt): cat = 'физическое застревание (стена / уступ / край пола / огонь на шаге)'
            elif 'нет пути' in txt: cat = 'невозможно двигаться: нет пути'
            else: cat = 'шаг свободен, стоит — ' + ('в ожидании по задаче' if re.match(r'(gather|bombWait|utilWait|utilHold|smokeWait|retakeCover|rotateHold|waitPop|stage|exec:wait)', A.get('post') or '') else 'не ожидание по задаче')
            R['stall'].setdefault('cat', collections.Counter())[cat] += 1
        # danger «взрыв» / «огонь» — по задаче на момент события
        for e in (w.get('ev') or {}).get('danger', []):
            if 'флешка' in e[2]: continue
            R['danger'].setdefault('other', collections.Counter())[e[2].split(' (')[0] + ' — задача ' + re.sub(r'[:|].*$', '', str(e[3]))] += 1
        R['danger']['n'] += (w.get('n') or {}).get('danger', 0); R['danger']['by'].update(w.get('dangerBy') or {})
        # контекст флешки: act по боту (ближайший ≤ тика), see (видел ли бросавшего раньше), blind
        act = collections.defaultdict(list)
        for a in d.get('act') or []: act[a[1]].append(a)
        seen = collections.defaultdict(list)
        for s in d.get('see') or []: seen[(s[1], s[2])].append(s[0])
        blind = collections.defaultdict(list)
        for b in d.get('blind') or []: blind[b[1]].append(b)
        for e in (w.get('ev') or {}).get('danger', []):
            if 'флешка' not in e[2]: continue
            R['danger']['flash']['sampled'] += 1
            tk, bid = e[0], e[1]; thr = re.search(r'флешка (\S+)', e[2]).group(1)
            L = act.get(bid, []); i = bisect.bisect_right([a[0] for a in L], tk) - 1; A = dict(zip(ACT, L[i])) if i >= 0 else {}
            det = tk - 96   # проверка — через 96 тиков (1,5 с) после хлопка
            bl = [b for b in blind.get(bid, []) if det - 8 <= b[0] <= tk]
            saw = [t for t in seen.get((bid, thr), []) if t <= det]
            if bl or A.get('blind'): ctx = 'ослеплён этой / другой флешкой'
            elif A.get('state') == 'engage' or A.get('fc') or A.get('contact'): ctx = 'в бою / держит контакт'
            elif not saw: ctx = 'бросавшего не видел до хлопка (знания, куда поворачиваться, могло не быть)'
            else: ctx = 'без объяснения в записи (кандидат в ошибку — разбор по снимку)'
            R['danger']['flash']['ctx'][ctx] += 1
            if len(R['danger']['flash']['examples']) < 12:
                R['danger']['flash']['examples'].append({'match': m, 'tick': tk, 'bot': bid, 'thrower': thr, 'ctx': ctx, 'task': A.get('post'), 'state': A.get('state'),
                    'look': A.get('lookReason'), 'stop': A.get('stopWhy'), 'blinded': [b[2] for b in bl], 'sawThrowerAt': saw[-1] if saw else None})
    for k in ('by', 'tasks', 'cat'): R['stall'][k] = dict(R['stall'].get(k, collections.Counter()).most_common())
    R['danger']['other'] = dict(R['danger'].get('other', collections.Counter()).most_common())
    R['danger']['by'] = dict(R['danger']['by']); R['danger']['flash']['ctx'] = dict(R['danger']['flash']['ctx'].most_common())
    return R

res = [analyse(l) for l in labels]
for r in res:
    print('== %s: матчей %d, раундов %d' % (r['label'], r['matches'], r['rounds']))
    print('  stall всего %d, в выборке записи %d (%.0f %%):' % (r['stall']['n'], r['stall']['sampled'], 100 * r['stall']['sampled'] / max(1, r['stall']['n'])))
    for k, v in r['stall']['cat'].items(): print('     %4d  %s' % (v, k))
    print('  danger всего %d по причинам: %s' % (r['danger']['n'], r['danger']['by']))
    print('  danger «взрыв» / «огонь» в выборке по задаче:', dict(list(r['danger']['other'].items())[:8]))
    fl = r['danger']['flash']; print('  флешка без реакции — в выборке %d, контекст:' % fl['sampled'])
    for k, v in fl['ctx'].items(): print('     %4d  %s' % (v, k))
if OUT: json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
