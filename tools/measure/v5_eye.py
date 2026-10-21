"""В5 (22.10): гранаты «на глаз» — сводка по прогонам сторожа.

python3 tools/measure/v5_eye.py --map mirage <прогон> [<прогон> …]   (папки tools/measure/runs/<прогон>)

По каждому прогону: потери заданий на гранату (всего и «не долетит»), задач / брошено за раунд, доля своих бросков (не лайнап)
с хода — боец двигался быстрее WALK px/с (как у про: шаг с Shift до 130 ед/с, бег — быстрее; throws.json → move), по типам.
У про — из throws.json набора карты (move: stand / walk / run / jump).
"""
import sys, os, json, glob, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import mapdir  # noqa: E402
MAP = mapdir.current()
J = json.load(open(mapdir.path(MAP, 'map3d.json')))
K = J['unit'] / J['cell']        # ед. игры на px радара
RUN_U = 160                      # ед/с: быстрее — бег (как tools/nades/throws.py move_of)
TYP = {'flash': 'flash', 'smoke': 'smoke', 'he': 'he', 'molly': 'molotov', 'molotov': 'molotov'}


def pro():
    T = json.load(open(mapdir.path(MAP, 'throws.json')))['throws']
    C = collections.defaultdict(collections.Counter)
    for t in T:
        if t['type'] == 'decoy': continue
        C[t['type']]['n'] += 1; C[t['type']]['run'] += t.get('move') == 'run'; C[t['type']]['stand'] += t.get('move') == 'stand'
    return C


def bots(run):
    C = collections.defaultdict(collections.Counter); lost = collections.Counter(); R = 0; W = collections.Counter()
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', run, 'rec_*.json'))):
        d = json.load(open(f)); R += len(d['rounds'])
        for n in d['nades']:
            if len(n) < 12 or n[11]: continue   # без скорости (старый сторож) / лайнап
            ty = TYP[n[2]]; u = n[10] * K
            C[ty]['n'] += 1; C[ty]['run'] += u >= RUN_U; C[ty]['stand'] += u < 5
        w = (d.get('watch') or {}).get('nade') or {}
        for k, v in (w.get('lostWhy') or {}).items():
            lost['всего'] += v; lost['не долетит'] += v if 'не долетит' in k else 0
        for part in ('intent', 'thrown'):
            W[part] += sum((w.get(part) or {}).values())
    return C, lost, R, W


if __name__ == '__main__':
    P = pro()
    print('== %s: свой бросок с хода (бег ≥ %d ед/с) / стоя, %% бросков' % (MAP, RUN_U))
    print('  про: ' + '; '.join('%s бег %.0f / стоя %.0f' % (t, 100 * c['run'] / c['n'], 100 * c['stand'] / c['n']) for t, c in sorted(P.items())))
    for run in sys.argv[1:]:
        C, lost, R, W = bots(run)
        print('\n### %s — раундов %d' % (run, R))
        print('  потерь заданий: %d (на раунд %.1f), из них «не долетит»: %d (%.0f %%)' % (
            lost['всего'], lost['всего'] / max(1, R), lost['не долетит'], 100 * lost['не долетит'] / max(1, lost['всего'])))
        print('  заданий %.1f, брошено %.1f на раунд (брошено из заданий %.0f %%)' % (W['intent'] / max(1, R), W['thrown'] / max(1, R),
                                                                                  100 * W['thrown'] / max(1, W['intent'])))
        if C: print('  свои броски: ' + '; '.join('%s бег %.0f / стоя %.0f (n=%d)' % (t, 100 * c['run'] / c['n'], 100 * c['stand'] / c['n'], c['n'])
                                                  for t, c in sorted(C.items())))
