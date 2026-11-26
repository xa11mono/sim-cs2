"""(Р4.2б, 26.11) Переименование файлов игры без числовых префиксов — одним шагом, без правки кода игры.
Карта — rebuild/r4_map.json (по rebuild/preparation/path_migration.csv Codex). Делает:
  1. git mv src/game/<старое> <каталог>/<новое>;
  2. rebuild/files.json — files / game (file, dir, id = новое имя без расширения); modules.json — новые имена;
     owners.json — метки файлов (files, _locks) → новые id; cards.json — ключи; truth_known.json — метка в ключе;
  3. полные старые имена файлов («task.js», «engine/bot/task.js», 'src', 'game', '…') → новые пути — в действующем
     коде инструментов, src/*.py / *.js, списках rebuild/*.json, AGENTS.md, docs/ARCHITECTURE.md; имена без расширения в таблице «Где что»;
     метки в коде детектора истины (truth_reads.js PERCEPTION / KNOW_OWNERS); tsconfig.json include.
Не трогает: файлы игры (комментарии «(110)» — по таблице rebuild/R4_RENAME.md), доказательства rebuild/evidence, архивы, историю журнала.
Запуск: python3 tools/rebuild/r4_rename.py [--dry]"""
import json, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DRY = '--dry' in sys.argv
M = json.load(open(os.path.join(ROOT, 'rebuild', 'r4_map.json'), encoding='utf-8'))['map']
by_old = {m['old']: m for m in M}
id_of = {m['old_id']: m['id'] for m in M}


def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()


def wr(p, s):
    if not DRY: open(os.path.join(ROOT, p), 'w', encoding='utf-8').write(s)


# 1. git mv
for m in M:
    src, dst = os.path.join('src', 'game', m['old']), os.path.join(m['dir'], m['new'])
    if DRY: continue
    os.makedirs(os.path.join(ROOT, m['dir']), exist_ok=True)
    subprocess.run(['git', 'mv', src, dst], cwd=ROOT, check=True)

# 2. списки сборки
F = json.loads(rd('rebuild/files.json'))
F['files'] = [by_old[f]['new'] for f in F['files']]
for g in F['game']:
    m = by_old[g['file']]; g['legacy'] = g['id']; g['file'], g['dir'], g['id'] = m['new'], m['dir'], m['id']
F['_'] = F['_'].replace('src/game', 'engine/, view/')
wr('rebuild/files.json', json.dumps(F, ensure_ascii=False, indent=1) + '\n')
MO = json.loads(rd('rebuild/modules.json')); MO['modules'] = [by_old[f]['new'] for f in MO['modules']]
wr('rebuild/modules.json', json.dumps(MO, ensure_ascii=False) + '\n')
O = json.loads(rd('rebuild/owners.json'))
def ids(x):
    if isinstance(x, dict): return {k: ids(v) for k, v in x.items()}
    if isinstance(x, list): return [id_of.get(v, v) if isinstance(v, str) and re.fullmatch(r'\d{3}', v) else ids(v) for v in x]
    return x
wr('rebuild/owners.json', json.dumps(ids(O), ensure_ascii=False, indent=2) + '\n')
C = json.loads(rd('rebuild/cards.json')); C['cards'] = {by_old[k]['new']: v for k, v in C['cards'].items()}
wr('rebuild/cards.json', json.dumps(C, ensure_ascii=False, indent=1) + '\n')
T = json.loads(rd('rebuild/truth_known.json'))
T['known'] = {id_of[k.split(':', 1)[0]] + ':' + k.split(':', 1)[1]: v for k, v in T['known'].items()}
wr('rebuild/truth_known.json', json.dumps(T, ensure_ascii=False, indent=1) + '\n')
tr = rd('tools/rebuild/truth_reads.js')
tr = re.sub(r"'(\d{3})'(?=\s*:\s*\[)", lambda mm: "'" + id_of.get(mm.group(1), mm.group(1)) + "'", tr)   # PERCEPTION = { '510': [...] }
tr = re.sub(r"(beliefLast: \[)([^\]]*)(\])", lambda mm: mm.group(1) + re.sub(r"'(\d{3})'", lambda q: "'" + id_of[q.group(1)] + "'", mm.group(2)) + mm.group(3), tr)
wr('tools/rebuild/truth_reads.js', tr)

# 3. полные старые имена → новые пути в действующем коде, списках и документах
def targets():
    out = []
    for base in ('tools', 'src'):
        for dp, dn, fn in os.walk(os.path.join(ROOT, base)):
            if 'node_modules' in dp or os.sep + 'archive' in dp or dp.endswith(os.path.join('src', 'game')): continue
            out += [os.path.relpath(os.path.join(dp, f), ROOT) for f in fn if f.endswith(('.js', '.py', '.cjs', '.ts', '.json', '.md', '.sh')) and not f.endswith('.html')]
    out += [os.path.join('rebuild', f) for f in os.listdir(os.path.join(ROOT, 'rebuild')) if f.endswith('.json') and f != 'r4_map.json']
    out += [os.path.join('rebuild', 'diagnostics-audit', f) for f in ('probe_detectors.cjs', 'probe_r36.cjs')]
    out += ['AGENTS.md', 'docs/ARCHITECTURE.md', 'tsconfig.json']
    return [p for p in out if os.path.isfile(os.path.join(ROOT, p)) and not p.startswith(os.path.join('rebuild', 'evidence'))]
n_total = 0
for p in targets():
    s = rd(p); o = s
    for m in M:
        new = m['dir'] + '/' + m['new']
        q = "', '".join(new.split('/')); qq = '", "'.join(new.split('/'))
        s = s.replace("'src', 'game', '" + m['old'] + "'", "'" + q + "'").replace('"src", "game", "' + m['old'] + '"', '"' + qq + '"')
        s = s.replace('src/game/' + m['old'], new)
        s = re.sub(r'(?<![\w/.-])' + re.escape(m['old']) + r'(?![\w])', m['new'], s)
        if p in ('AGENTS.md', 'docs/ARCHITECTURE.md'):   # таблица «Где что»: `110_post_routes` → `engine/place/post-routes`
            s = re.sub(r'(?<![\w/.-])' + re.escape(os.path.splitext(m['old'])[0]) + r'(?![\w.])', m['dir'] + '/' + m['id'], s)
    if p == 'tsconfig.json': s = s.replace('"include": ["src/**/*.ts"]', '"include": ["src/**/*.ts", "engine/**/*.ts", "view/**/*.ts"]')
    if s != o: n_total += 1; wr(p, s)
print('переименовано файлов игры: %d; списков и файлов с правкой ссылок: %d%s' % (len(M), n_total, ' (проба, без записи)' if DRY else ''))
