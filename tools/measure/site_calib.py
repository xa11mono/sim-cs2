"""(аудит 30.10) Оценка сайта знанием T против факта: python3 tools/measure/site_calib.py <папка> [...]
Выборки REC.tac.sc (раз в секунду, до планта): [тик, сайт, CT на сайте по факту, давность проверки точек, проверенных зон, bel, fresh, CTжив, Tжив]
bel — ожидаемое число CT у сайта по знанию T (beliefCount: гипотезы врагов — видели, слышали, убили, проверили). Ступени оценки по bel —
таблица: сколько выборок, сколько из них CT на сайте нет (факт), средний факт. «Пусто» при пороге p: bel < p — ложно (CT были) / поймано пустых."""
import json, sys, glob, os, collections
B = [0, 0.25, 0.5, 0.9, 1.5, 2.5, 99]
for d in sys.argv[1:]:
    rows = []
    for f in glob.glob(os.path.join(d, 'rec_*.json')):
        if os.path.getsize(f) == 0: continue
        R = json.load(open(f)); T = R.get('tac') or {}
        for r in T.get('sc', []):
            if len(r) >= 6 and r[5] is not None: rows.append(r)
    if not rows: print(d, 'нет bel'); continue
    print('==', d, 'выборок', len(rows), 'из них CT на сайте нет:', sum(r[2] == 0 for r in rows))
    for lo, hi in zip(B, B[1:]):
        s = [r for r in rows if lo <= r[5] < hi]
        if s: print('  bel %4.2f–%-4s: %6d выборок, CT нет %5.1f %%, CT в среднем %.2f' % (lo, hi if hi < 99 else '…', len(s), 100 * sum(r[2] == 0 for r in s) / len(s), sum(r[2] for r in s) / len(s)))
    empt = sum(r[2] == 0 for r in rows)
    for p in [0.25, 0.5, 0.9]:
        say = [r for r in rows if r[5] < p]
        fe = sum(r[2] > 0 for r in say)
        print('  «слабо / пусто» при bel < %.2f: %d выборок, CT там были в %.1f %%, поймано пустых %.1f %%' % (p, len(say), 100 * fe / max(1, len(say)), 100 * (len(say) - fe) / max(1, empt)))
    fr = [r for r in rows if r[6] is not None and r[6] > 0]
    if fr: print('  свежая инфа T о CT у сайта (8 с) есть: %d выборок, CT там нет %.1f %%' % (len(fr), 100 * sum(r[2] == 0 for r in fr) / len(fr)))
