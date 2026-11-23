# отчёт 050: python3 pp_report.py <метка> — повтор места игрока/команды, стороны CT, ожидаемый ретейк, прикрытие, достижимость, менее выгодный выбор
import sys, json, glob, math, collections, subprocess
lab = sys.argv[1]; T = '/tmp/claude-0/-home-user-sim-cs2/4dc23a19-8eb9-51be-a3d4-dca908798881/scratchpad/tools/'
for s in ('pp_repeat_bot.py', 'pp_team_bot.py'): print(subprocess.run(['python3', T + s, lab], capture_output=True, text=True).stdout.strip())
pp = []; ppc = []
for f in sorted(glob.glob('/home/user/sim-cs2/tools/measure/runs/%s/rec_*.json' % lab)):
    d = json.load(open(f)); pp += d.get('pp', []); ppc += d.get('ppc', [])
if pp:
    sd = [p[8] for p in pp if p[8] is not None]
    if sd: print('назначено мест %d; доля ожидаемого ретейка со стороны места (±60°): ср. %.2f; мест «со стороны CT» (>0,5): %.0f%%' % (len(pp), sum(sd)/len(sd), 100*sum(1 for x in sd if x > 0.5)/len(sd)))
    rg = [p[6]/p[7] for p in pp if p[6] is not None and p[7]]
    if rg: print('выбор хуже лучшего своего места: оценка/лучшая ср. %.2f; < 0,5 — %.0f%% назначений (ради команды)' % (sum(rg)/len(rg), 100*sum(1 for x in rg if x < 0.5)/len(rg)))
if ppc:
    pairs = sum(c[2] for c in ppc); los = sum(c[3] for c in ppc); E = sum(c[4] for c in ppc); cov = sum(c[5] for c in ppc); M = sum(c[1] for c in ppc); at = sum(c[6] for c in ppc)
    print('прикрытие (8 с после планта, %d раундов): пар мест с видимостью %d/%d = %.0f%%; входов к бомбе видно %d/%d = %.0f%%; дошли до места %d/%d = %.0f%%' % (len(ppc), los, pairs, 100*los/max(1, pairs), cov, E, 100*cov/max(1, E), at, M, 100*at/max(1, M)))
