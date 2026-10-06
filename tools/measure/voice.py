#!/usr/bin/env python3
"""Тимспик (К10): python3 tools/measure/voice.py <папка прогона>
Берёт REC.voice из rec_*.json (счётчики эфира, пишет rec2.js) и считает:
фраз на раунд, среднюю длину фразы (с и слов), долю срочных, сколько фраз
пропало и опоздало из-за наложения 3+ голосов; печатает примеры фраз."""
import sys, os, json, glob

def main(d):
    if not os.path.isdir(d):
        d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs', d)
    n = sec = words = lost = late = urg = rounds = stale = 0
    ex = []
    for f in sorted(glob.glob(os.path.join(d, 'rec_*.json'))):
        if os.path.getsize(f) == 0:
            continue
        r = json.load(open(f))
        v = r.get('voice')
        if not v:
            continue
        rounds += len(r.get('rounds', []))
        n += v['n']; sec += v['sec']; words += v['words']; lost += v['lost']; late += v['late']; urg += v['urgent']; stale += v.get('stale', 0)
        ex += v.get('ex', [])[:20]
    if not n:
        print('нет записей тимспика'); return
    tried = n + lost
    print(f'раундов: {rounds}, фраз услышано: {n}')
    print(f'фраз на раунд (на команду): {n / max(1, rounds) / 2:.1f}')
    print(f'длина фразы: {sec / n:.2f} с, {words / n:.1f} слова; срочных {100 * urg / n:.0f}%')
    print(f'пропало из-за наложения 3+ голосов: {100 * lost / tried:.1f}% ({lost}), опоздало: {100 * late / tried:.1f}% ({late})')
    print(f'опоздавших, которые устарели и не дошли: {stale}')
    print('примеры (матч, раунд, тик, команда, кто, фраза):')
    for e in ex[:40]:
        print('  ', *e)

if __name__ == '__main__':
    main(sys.argv[1])
