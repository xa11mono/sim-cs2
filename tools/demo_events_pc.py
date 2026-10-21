#!/usr/bin/env python3
"""(Б4) Выгрузка из демок про всех выстрелов со скоростью и попаданий — на ПК владельца (демки только там). Игру не меняет.
Запускает .github/workflows/demos.yml (пуш ветки demos/…); задание — tools/demo_events_request.json:
  {"roots": ["D:\\demos"], "workers": 4}   roots — где искать .dem (пусто — домашняя папка и корни всех дисков, до 6 уровней)
Берутся только демки, уже разобранные в репо (есть <имя>_ticks.csv.gz в data/demos или data/maps/<карта>/demos), — у каждой
дописываются:
  <имя>_weapon_fire_full.csv.gz — ВСЕ выстрелы (без прореживания): тик, стрелок, оружие, место, взгляд (yaw/pitch), скорость
    velocity_X/Y/Z в момент выстрела, присед, прицел, шаг (shift), штраф точности игры accuracy_penalty (поля, которых нет в этой
    версии demoparser2, отбрасываются по одному — в журнале видно, какие остались);
  <имя>_player_hurt.csv.gz — весь урон: кто, кому, чем, сколько, куда (hitgroup), место и команда жертвы.
Варминг отрезается так же, как в parse_demos.py --events (тики до первого тика из <имя>_ticks.csv.gz).
Результат — tools/demo_events_out/<папка в репо>/…, выкладывается в ветку pc-demos/<номер прогона> теми же путями, что в репо
(data/demos/…, data/maps/mirage/demos/…): забрать — git fetch origin pc-demos/<N> && git archive FETCH_HEAD | tar -x.
Ход — ~/simcs2_run.log (как у прогонов)."""
import os, sys, json, glob, time, string, subprocess
from concurrent.futures import ProcessPoolExecutor, as_completed
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'demo_events_out')
LOG = os.path.join(os.path.expanduser('~'), 'simcs2_run.log')
FIRE_PROPS = ['X', 'Y', 'Z', 'yaw', 'pitch', 'team_num', 'velocity_X', 'velocity_Y', 'velocity_Z', 'health', 'ducking', 'is_scoped',
              'is_walking', 'accuracy_penalty']
HURT_PROPS = ['X', 'Y', 'Z', 'team_num']
SKIP = {'windows', 'program files', 'program files (x86)', 'programdata', 'appdata', '$recycle.bin', 'system volume information',
        'node_modules', '.git', 'actions-runner', '_work', 'msocache', 'recovery', 'perflogs'}
DEPTH = 6

def log(s):
    print(s, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f: f.write(s + '\n')

def known():
    """имя демки → папка в репо (только уже разобранные: есть ticks)"""
    K = {}
    for d in ['data/demos'] + sorted(os.path.relpath(p, ROOT).replace('\\', '/') for p in glob.glob(os.path.join(ROOT, 'data', 'maps', '*', 'demos'))):
        for f in glob.glob(os.path.join(ROOT, d, '*_ticks.csv.gz')):
            K[os.path.basename(f)[:-len('_ticks.csv.gz')]] = d
    return K

def find_dems(roots, want):
    found = {}
    for r in roots:
        r = os.path.abspath(r); base = r.rstrip('\\/').count(os.sep)
        for dp, dns, fns in os.walk(r):
            if dp.rstrip('\\/').count(os.sep) - base >= DEPTH: dns[:] = []
            dns[:] = [d for d in dns if d.lower() not in SKIP]
            for fn in fns:
                if fn.lower().endswith('.dem'):
                    st = fn[:-4]
                    if st in want and st not in found: found[st] = os.path.join(dp, fn)
            if len(found) == len(want): return found
    return found

def parse_with(p, ev, props):
    """событие с полями игрока; если какое-то поле не поддержано — без него (по одному)"""
    try:
        return p.parse_event(ev, player=props, other=['total_rounds_played']), props, []
    except Exception:
        use, drop = [], []
        for c in props:
            try: p.parse_event(ev, player=[c]); use.append(c)
            except Exception: drop.append(c)
        return p.parse_event(ev, player=use, other=['total_rounds_played']), use, drop

def one(name, dem, repo_dir):
    import pandas as pd
    from demoparser2 import DemoParser
    t0 = time.time()
    t = pd.read_csv(os.path.join(ROOT, repo_dir, f'{name}_ticks.csv.gz'), usecols=['tick'])
    warm = int(t.tick.min()) - 1
    od = os.path.join(OUT, repo_dir); os.makedirs(od, exist_ok=True)
    p = DemoParser(dem); msg = []
    for key, ev, props in (('weapon_fire_full', 'weapon_fire', FIRE_PROPS), ('player_hurt', 'player_hurt', HURT_PROPS)):
        e, use, drop = parse_with(p, ev, props)
        if e is None or not len(e): msg.append(f'{key}: пусто'); continue
        e = e[e['tick'] > warm]
        e = e.drop(columns=[c for c in e.columns if c.endswith('_name') and c not in ('user_name', 'attacker_name')], errors='ignore')
        for c in e.columns:   # поля игрока приходят с приставкой user_ / attacker_
            if c.split('_')[-1] in ('X', 'Y', 'Z', 'yaw', 'pitch'): e[c] = e[c].round(1)
            if c.endswith('accuracy_penalty'): e[c] = e[c].round(5)
        e.to_csv(os.path.join(od, f'{name}_{key}.csv.gz'), index=False, compression='gzip')
        msg.append(f'{key}: {len(e)}' + (f' (без {",".join(drop)})' if drop else ''))
    return name, f'{time.time()-t0:.0f} с; ' + '; '.join(msg)

def main():
    open(LOG, 'w', encoding='utf-8').close()
    try:
        import demoparser2, pandas  # noqa
    except ImportError:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--user', 'demoparser2', 'pandas'])
    req = json.load(open(os.path.join(HERE, 'demo_events_request.json'), encoding='utf-8'))
    K = known(); log(f'демок в репо: {len(K)}')
    roots = req.get('roots') or []
    if not roots:
        roots = [os.path.expanduser('~')] + [f'{c}:\\' for c in string.ascii_uppercase if os.name == 'nt' and os.path.isdir(f'{c}:\\')]
    found = find_dems(roots, set(K))
    log(f'нашлось .dem: {len(found)} из {len(K)} (искал в: {", ".join(roots)})')
    for st in sorted(set(K) - set(found)): log(f'  нет файла: {st}.dem')
    if found: log('папки с демками: ' + ', '.join(sorted({os.path.dirname(v) for v in found.values()})))
    done = 0
    with ProcessPoolExecutor(int(req.get('workers', 4))) as ex:
        fs = [ex.submit(one, n, found[n], K[n]) for n in sorted(found)]
        for f in as_completed(fs):
            try: n, m = f.result(); done += 1; log(f'[{done}/{len(found)}] {n}: {m}')
            except Exception as e: log(f'ОШИБКА: {e!r}')
    log(f'all done: {done} демок')

def publish():
    """выложить tools/demo_events_out/ (те же пути, что в репо) и журнал в ветку pc-demos/<номер прогона>"""
    import shutil, tempfile
    run_no = os.environ.get('GITHUB_RUN_NUMBER', 'local'); repo = os.environ.get('GITHUB_REPOSITORY', 'xa11mono/sim-cs2')
    tmp = tempfile.mkdtemp(prefix='pcdem_')
    if os.path.isdir(OUT): shutil.copytree(OUT, tmp, dirs_exist_ok=True)
    if os.path.exists(LOG): shutil.copy(LOG, os.path.join(tmp, 'run.log'))
    g = lambda *a: subprocess.run(['git'] + list(a), cwd=tmp, check=True)
    g('init', '-q'); g('-c', 'core.autocrlf=false', 'add', '-A')
    g('-c', 'user.name=pc-runner', '-c', 'user.email=pc-runner@users.noreply.github.com', 'commit', '-q', '-m', f'выгрузка демок (прогон {run_no})')
    g('push', '-q', '--force', f'https://x-access-token:{os.environ["GITHUB_TOKEN"]}@github.com/{repo}', f'HEAD:refs/heads/pc-demos/{run_no}')
    print(f'pushed pc-demos/{run_no}')

if __name__ == '__main__':
    publish() if '--publish' in sys.argv else main()
