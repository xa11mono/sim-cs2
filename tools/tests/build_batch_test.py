"""(28.11, система проверок H-3) Сборка нескольких карт одним вызовом (src/build.py --map-output) = сборки по одной, байт в байт;
и сборка повторяется байт в байт (H-8: случайное имя временной папки esbuild больше не попадает в страницу).
Запуск: python3 tools/tests/build_batch_test.py   (≈ 1 мин; код 0 — равны)"""
import hashlib, os, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
B = os.path.join(ROOT, 'src', 'build.py')
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
maps = ['mirage', 'ancient']
with tempfile.TemporaryDirectory() as t:
    one = {m: os.path.join(t, 'one-' + m + '.html') for m in maps}
    bat = {m: os.path.join(t, 'bat-' + m + '.html') for m in maps}
    for m in maps: subprocess.run([sys.executable, B, '--map', m, one[m]], check=True, capture_output=True)
    subprocess.run([sys.executable, B] + sum([['--map-output', m, bat[m]] for m in maps], []), check=True, capture_output=True)
    again = os.path.join(t, 'again-mirage.html'); subprocess.run([sys.executable, B, '--map', 'mirage', again], check=True, capture_output=True)
    bad = [m for m in maps if sha(one[m]) != sha(bat[m])] + (['повтор mirage'] if sha(again) != sha(one['mirage']) else [])
    for m in maps: print(m, sha(one[m])[:16], sha(bat[m])[:16])
    print('повтор mirage', sha(again)[:16])
    r = subprocess.run([sys.executable, B, '--map-output', 'mirage', one['mirage'], '--map-output', 'ancient', one['mirage']], capture_output=True)
    if r.returncode == 0: bad.append('один файл на две карты не отвергнут')
print('сборка пачкой = по одной, повтор = тот же' if not bad else 'НЕ РАВНЫ: ' + ', '.join(bad))
sys.exit(1 if bad else 0)
