"""(Р4.6, 26.11) Опись документов после слияний: каждый .md в git — класс, строки, ссылки к нему (из скольких документов) и от него, и что
предлагала опись Codex (codex/preparation-r3-r4: rebuild/preparation/documentation_inventory.csv — класс, действие) с отметкой, выполнено ли
(файл на месте / перенесён в архив / слит). Пишет rebuild/doc_inventory.csv и печатает сводку.
Запуск: python3 tools/rebuild/doc_inventory.py"""
import csv, io, os, re, subprocess
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
git = lambda *a: subprocess.run(['git', '-c', 'core.quotepath=off'] + list(a), cwd=ROOT, capture_output=True, text=True).stdout
docs = [p for p in git('ls-files', '*.md').split('\n') if p]
txt = {p: open(os.path.join(ROOT, p), encoding='utf-8', errors='replace').read() for p in docs}
def cls(p):
    if '/archive/' in p or p.startswith('docs/archive'): return 'архив'
    if p.startswith('rebuild/evidence') or '/evidence/' in p: return 'доказательство'
    if p.startswith('docs/reports'): return 'отчёт'
    if p.startswith('docs/rules') or p in ('AGENTS.md', 'CLAUDE.md', 'rebuild/RULES.md'): return 'правила'
    if p in ('00_PLAN.md', 'rebuild/MASTER_PLAN.md', 'rebuild/JOURNAL.md'): return 'план / журнал'
    if p.startswith('.claude/'): return 'агент'
    if p.startswith('data/'): return 'данные карты'
    return 'действующий'
links_in = {p: 0 for p in docs}; links_out = {}
for p, t in txt.items():
    out = set()
    for q in docs:
        if q != p and (q in t or ('/' in q and os.path.basename(q) in t and q.split('/')[0] in t)): out.add(q)
    links_out[p] = len(out)
    for q in out: links_in[q] += 1
codex = {}
try:
    raw = git('show', 'origin/codex/preparation-r3-r4:rebuild/preparation/documentation_inventory.csv')
    for r in csv.DictReader(io.StringIO(raw)): codex[r['path']] = r
except Exception: pass
rows = []
for p in sorted(set(docs) | set(codex)):
    c = codex.get(p, {}); here = p in txt
    moved = next((q for q in docs if '/archive/' in q and os.path.basename(q) == os.path.basename(p)), '') if not here else ''
    done = ('' if not c else 'на месте' if here and c.get('action', '').startswith('оставить') else
            'в архиве: ' + moved if moved else 'слит / удалён' if not here else 'на месте — ' + c.get('action', ''))
    rows.append({'path': p, 'class': cls(p) if here else '—', 'lines': txt[p].count('\n') + 1 if here else 0,
                 'links_in': links_in.get(p, 0), 'links_out': links_out.get(p, 0),
                 'codex_class': c.get('category', ''), 'codex_action': c.get('action', ''), 'status': done or ('новый (после описи Codex)' if here else '')})
with open(os.path.join(ROOT, 'rebuild', 'doc_inventory.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
from collections import Counter
print('документов в git %d; по классам: %s' % (len(docs), dict(Counter(r['class'] for r in rows if r['class'] != '—'))))
print('опись Codex: %d строк; действия не «оставить» и файл на месте: %d' % (len(codex), sum(1 for r in rows if r['status'].startswith('на месте — '))))
for r in rows:
    if r['status'].startswith('на месте — '): print('  ', r['path'], '|', r['codex_action'])
print('действующие без входящих ссылок: %s' % [r['path'] for r in rows if r['class'] == 'действующий' and r['links_in'] == 0][:20])
