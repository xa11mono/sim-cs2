"""(Р4.6, 26.11) Полнота при перестройке документов: каждое предложение прежних документов (версия git <ref>) должно найтись в текущих
документах (любом из списка). Сравнение — по нормализованному тексту (пробелы, разметка `*_, кавычки-ёлочки не важны). Перенос
дословный — 0 пропусков; переформулированное — список пропусков для ручной проверки (смысл сохранён / потерян).
Запуск: python3 tools/rebuild/doc_coverage.py <ref> <старый.md> [...] -- <новый.md | папка> [...]"""
import os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
args = sys.argv[1:]; ref = args[0]; i = args.index('--'); old, new = args[1:i], args[i + 1:]


def norm(t):
    t = re.sub(r'[`*_>|#]', ' ', t); t = t.replace('«', '"').replace('»', '"').replace('ё', 'е')
    return re.sub(r'\s+', ' ', t).strip().lower()


def sentences(t):
    t = re.sub(r'\n(?=\s*[-*] |\s*\d+\. |#|\|)', '\n\n', t)   # пункты списков и строки таблиц — отдельно
    out = []
    for para in re.split(r'\n\s*\n', t):
        for s in re.split(r'(?<=[.;!?])\s+(?=[А-ЯA-Z«(`*])', para):
            n = norm(s)
            if len(n) >= 25: out.append((s.strip(), n))
    return out


def text_of(paths):
    out = []
    for p in paths:
        p = os.path.join(ROOT, p)
        fs = [os.path.join(d, f) for d, _, F in os.walk(p) for f in F if f.endswith('.md')] if os.path.isdir(p) else [p]
        for f in fs: out.append(norm(open(f, encoding='utf-8').read()))
    return '\n'.join(out)


NEW = text_of(new); miss = []; total = 0
for o in old:
    t = subprocess.run(['git', 'show', '%s:%s' % (ref, o)], cwd=ROOT, capture_output=True, text=True).stdout
    for raw, n in sentences(t):
        total += 1
        if n not in NEW: miss.append((o, raw[:160]))
print('предложений %d, не найдено дословно %d' % (total, len(miss)))
for o, s in miss[:60]: print('  %s: %s' % (o, s))
sys.exit(1 if miss else 0)
