"""(28.11, H-20) python3 tools/measure/request_guard_test.py — пуск задания ПК только при правке request.json в пуше."""
import json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import request_guard as G
def ev(commits, head=None):
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False); json.dump({'commits': commits, 'head_commit': head}, f); f.close(); return f.name
bad = []
def chk(name, env, want, req=None):
    got = G.should_run(env, req)[0]
    if got != want: bad.append(name)
chk('вручную', {'GITHUB_EVENT_NAME': 'workflow_dispatch'}, True)
chk('локально', {}, True)
chk('пуш с заданием', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([{'modified': ['tools/measure/request.json']}])}, True)
chk('пуш, задание добавлено', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([], {'added': ['tools/measure/request.json']})}, True)
chk('пуш данных гранат (как ПК 351)', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([{'modified': ['data/maps/ancient/nadeguess.json']}])}, False)
chk('новая ветка, задание без branch (старое из истории)', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([]), 'GITHUB_REF_NAME': 'measure/x'}, False, {'par': 8})
chk('новая ветка, задание этой ветки (ПК 354)', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([]), 'GITHUB_REF_NAME': 'measure/x'}, True, {'branch': 'measure/x'})
chk('задание другой ветки', {'GITHUB_EVENT_NAME': 'push', 'GITHUB_EVENT_PATH': ev([]), 'GITHUB_REF_NAME': 'measure/y'}, False, {'branch': 'measure/x'})
with tempfile.TemporaryDirectory() as t:
    p = os.path.join(t, 'env'); G.mark_skipped({'GITHUB_ENV': p})
    if 'SIMCS2_SKIP=1' not in open(p).read(): bad.append('пометка пропуска')
print('H-20: все случаи верны' if not bad else 'НЕВЕРНО: ' + ', '.join(bad)); sys.exit(1 if bad else 0)
