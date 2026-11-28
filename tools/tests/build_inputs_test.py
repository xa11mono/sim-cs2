"""(28.11, система проверок H-3) Ключ кэша сборок L1 полон: сборка обеих карт (src/build.py --map-output) под strace не открывает ни одного
файла репозитория из исключений tools/rebuild/build_inputs.json «exclude» (иначе правка такого файла меняла бы страницу, а кэш L1 отдал
бы старую). Только Linux со strace; иначе — пропуск с надписью (код 0). Запуск: python3 tools/tests/build_inputs_test.py (≈ 1 мин)."""
import json, os, re, shutil, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if not sys.platform.startswith('linux') or not shutil.which('strace'):
    print('пропущено: нужен Linux со strace'); sys.exit(0)
BI = json.load(open(os.path.join(ROOT, 'tools', 'rebuild', 'build_inputs.json'), encoding='utf-8'))
EX = [re.compile(r) for r in BI['exclude']]
with tempfile.TemporaryDirectory() as t:
    log = os.path.join(t, 'st.txt')
    r = subprocess.run(['strace', '-f', '-qq', '-e', 'trace=open,openat,openat2', '-o', log, sys.executable, os.path.join(ROOT, 'src', 'build.py'),
                        '--map-output', 'mirage', os.path.join(t, 'm.html'), '--map-output', 'ancient', os.path.join(t, 'a.html')], capture_output=True)
    if r.returncode: print('сборка упала:', (r.stderr or r.stdout).decode('utf-8', 'replace')[-400:]); sys.exit(1)
    read = set()
    for line in open(log, encoding='utf-8', errors='replace'):
        if 'ENOENT' in line: continue
        m = re.search(r'"([^"]+)"', line)
        if not m: continue
        p = os.path.normpath(os.path.join(ROOT, m.group(1)) if not os.path.isabs(m.group(1)) else m.group(1))
        if p.startswith(ROOT + os.sep) and os.path.isfile(p): read.add(os.path.relpath(p, ROOT).replace(os.sep, '/'))
read = {p for p in read if not p.startswith(('.git/', 'tools/rebuild/node_modules/')) and '__pycache__' not in p}
bad = sorted(p for p in read if any(r.search(p) for r in EX))
print('сборка читает файлов репозитория: %d; из исключений ключа: %d' % (len(read), len(bad)) + (' — ' + ', '.join(bad[:10]) if bad else ''))
sys.exit(1 if bad else 0)
