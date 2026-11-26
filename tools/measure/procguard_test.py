"""(26.11) Тест адаптивной параллельности сторожа (tools/measure/procguard.py) — память и размер процессов поддельные, матчи — короткие
процессы sleep. Повод: прогоны 329–332 — par 8 падал до 4 при нехватке и до 1 после повтора снятых, и не возвращался (в 332 — во всех
следующих фазах). Сценарии:
  1. оценка пика занижена (est 500 МБ при пике 2000): первая волна переполняет память → снятие, cap ниже; потом cap восстанавливается
     (память позволяет), снятые переигрываются по одному, после фазы cap = par;
  2. следующая фаза — матчи меньше: фактическая параллельность снова доходит до par (ограничение прошлой фазы не переносится);
  3. оценка верная (est = пик): ни одного снятия, одновременно — не больше, чем позволяет прогноз; защита держит запас.
Запуск: python3 tools/measure/procguard_test.py   (только Linux / macOS: процессы — sleep)"""
import os, sys, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import procguard as G

TOTAL, BASE = 16000, 2000          # МБ: всего, занято системой
GROW_S = 1.5                       # матч растёт до пика за столько секунд
PEAK = {}                          # pid → пик, МБ
T0 = {}
def fake_mem():
    used = BASE + sum(cur(p) for p in list(PEAK) if alive(p))
    return TOTAL, TOTAL - used
def alive(p):
    try: os.kill(p, 0); return os.path.exists('/proc/%d' % p) and open('/proc/%d/stat' % p).read().split()[2] != 'Z'
    except OSError: return False
def cur(p): return int(PEAK[p] * min(1.0, 0.3 + 0.7 * (time.time() - T0[p]) / GROW_S))
def fake_procs():
    return {p: (1, cur(p), '') for p in list(PEAK) if alive(p)}
G.mem_mb, G.procs = fake_mem, fake_procs
_Popen = subprocess.Popen
class P2(_Popen):
    def __init__(self, cmd, **kw):
        super().__init__(cmd, **kw); PEAK[self.pid] = int(kw['env']['FAKE_PEAK']); T0[self.pid] = time.time()
G.subprocess.Popen = P2
G.STATE = '/tmp/procguard_test_state.json'

LOG = []
def pool(par, est):
    cfg = {'reserve_mb': 3000, 'critical_mb': 1500, 'critical_polls': 2, 'poll_s': 0.05, 'tree_s': 0.1, 'recover_s': 0.6, 'log_s': 1000,
           'job': False, 'est_mb': {'chromium': est}, 'match_timeout_min': 5}
    return G.Pool(par, cfg, None, log=LOG.append)
def task(i, secs, peak, tag):
    g = '/tmp/procguard_test_%s_%d.json' % (tag, i)
    return {'name': '%s m%d' % (tag, i), 'cmd': [sys.executable, '-c', 'import time; time.sleep(%g)' % secs], 'engine': 'chromium', 'est_key': 'chromium:' + tag,
            'env': dict(os.environ, FAKE_PEAK=str(peak)), 'guard': g}, g
import json
def guards(G_):
    return [json.load(open(g)) for g in G_]
fails = []
def check(c, msg):
    print(('  ✓ ' if c else '  ✗ ') + msg)
    if not c: fails.append(msg)

# 1 + 2: занижена оценка, затем фаза малых матчей
P = pool(8, 500)
gs = []
for i in range(10): t, g = task(i, 3.0, 2000, 'ph1'); P.add(t); gs.append(g)
P.wait_all(); R1 = guards(gs)
stopped = [l for l in LOG if 'СНЯТ: lowmem' in l]   # отчёт снятого перезаписывает его повтор — снятые по журналу
check(any('мало памяти' in c[2] for c in P.cap_log), 'фаза 1: нехватка памяти снизила cap (защита работает): ' + str([c[1] for c in P.cap_log]))
check(any('память позволяет' in c[2] for c in P.cap_log), 'фаза 1: cap восстанавливался, когда память позволяла')
check(all(r['ok'] for r in R1 if not r['stopped']) and len(stopped) > 0 and sum(1 for r in R1 if r['retry'] and r['ok']) == len(stopped), 'фаза 1: снятые (%d) переиграны и годны' % len(stopped))
check(all(r['par_seen_max'] == 1 for r in R1 if r['retry']), 'фаза 1: повтор снятых — по одному')
check(P.cap == 8, 'после фазы 1 cap = par (%d)' % P.cap)
gs2 = []
for i in range(8): t, g = task(i, 2.0, 400, 'ph2'); P.add(t); gs2.append(g)
P.wait_all(); R2 = guards(gs2)
check(max(r['par_seen_max'] for r in R2) == 8, 'фаза 2: фактическая параллельность снова 8 (была %d)' % max(r['par_seen_max'] for r in R2))
check(all(r['ok'] for r in R2), 'фаза 2: все годны')
# 3: оценка верная — без снятий, прогноз держит запас
P3 = pool(8, 2000); gs3 = []
for i in range(8): t, g = task(i, 2.5, 2000, 'ph3'); P3.add(t); gs3.append(g)
P3.wait_all(); R3 = guards(gs3)
check(not any(r['stopped'] for r in R3), 'фаза 3 (оценка = пик): снятий нет')
mx = max(r['par_seen_max'] for r in R3)
check(mx <= (TOTAL - BASE - 3000) // 2000 + 1, 'фаза 3: одновременно %d — не больше, чем позволяет память (запас 3000 МБ)' % mx)
print('итог: ' + ('всё прошло' if not fails else 'НЕ прошло: %d' % len(fails)))
sys.exit(1 if fails else 0)
