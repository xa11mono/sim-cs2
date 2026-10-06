#!/usr/bin/env python3
"""Цифры здоровья кода по собранному файлу симулятора.
python3 tools/health.py sim.html   (печатает таблицу; --json — машиночитаемо)

Что считается (те же определения, что в docs/archive/AUDIT.md):
- строк в файле;
- переключателей BAL.* (ключи объекта `var BAL = {...}`), из них включено,
  из них держат старый вариант рядом (`!BAL.x` у включённого), не используются;
- вызовов назначения позиции `setPost(` и функций, где он вызывается; замков
  «кто кого перебивает» (старые поля-замки; одна таблица TASK_PRIO = 1);
- вызовов `setPost(`, причин взгляда `lookReason =`,
  заказов гранаты `assignNade(`, прямых бросков `throwNade(` (без объявлений);
- знание о врагах: сколько отдельных хранилищ объявлено (картина `belief`,
  журнал канала `teamIntel`, и прочие, если остались: `LKP`, `CLEARZ`),
  записей тиммейтам «прямо в уши» (`kind:"call"` / `src:"call"`), читателей
  журнала канала напрямую (`teamIntel….sig`).
"""
import re, sys, json

def health(path):
    s = open(path, encoding='utf-8').read()
    i = s.index('var BAL = {'); j = i; depth = 0
    while True:
        c = s[j]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: break
        j += 1
    body = s[i:j]
    # ключи верхнего уровня: "  имя: значение" (без вложенных объектов в BAL)
    keys = {}
    for m in re.finditer(r'(?:^|[{,\n])\s*([A-Za-z_]\w*)\s*:\s*([^,\n/]+)', body):
        keys.setdefault(m.group(1), m.group(2).strip())
    rest = s[:i] + s[j:]
    flags = {k: v for k, v in keys.items() if v in ('true', 'false')}
    on = [k for k, v in flags.items() if v == 'true']
    old = [k for k in on if re.search(r'!\s*BAL\.' + k + r'\b(?!\s*[=!]==?\s*false)', rest)
           or re.search(r'BAL\.' + k + r'\s*===?\s*false', rest)]
    unused = [k for k in keys if not re.search(r'BAL\.' + k + r'\b|BAL\[\s*["\']' + k, rest)]
    def calls(name):
        return len(re.findall(r'(?<![\w.])' + name + r'\(', s)) - len(re.findall(r'function\s+' + name + r'\(', s))
    return {
        'строк в собранном файле': s.count('\n') + 1,
        'переключателей BAL (вкл/выкл)': len(flags),
        '  из них включено': len(on),
        '  держат старый вариант рядом (!BAL.x)': len(old),
        '  не используются нигде': len(unused),
        'вызовов setPost (позиция)': calls('setPost'),
        'функций, которые ставят позицию': len(set(m.group(1) for m in re.finditer(r'\nfunction (\w+)\(', s) if m.group(1) != 'setPost' and re.search(r'(?<![\w.])setPost\(', s[m.end():s.find('\nfunction ', m.end()) if s.find('\nfunction ', m.end()) > 0 else len(s)]))),
        # замки в setPost «кто кого перебивает»: отдельные поля-замки (до v173 — 8 + маршрут)
        'замков «кто кого перебивает» (поля)': len(set(re.findall(r'\b\w+\.(_(?:trade|eg|pick|smokeWait|lineup|probe)Lock|_reposUntil|_rebal)\b', s))) + (1 if 'TASK_PRIO' in s else 0),
        'причин взгляда (lookReason =)': len(re.findall(r'lookReason\s*=(?!=)', s)),
        'заказов гранаты (assignNade)': calls('assignNade'),
        'прямых бросков (throwNade)': calls('throwNade'),
        'хранилищ знания о врагах (команда)': sum(1 for v in ('belief', 'teamIntel', 'LKP', 'CLEARZ') if re.search(r'^var ' + v + r'\b', s, re.M)),
        'коллов «в уши» мимо канала': len(re.findall(r'(?:kind|src)\s*:\s*"call"', s)),
        # без записи в канал (.push) и без самой «ленты событий» картины (picEvents)
        # К11: всё услышанное пишется в одном месте (makeSound), не null-сброс
        'мест, где бот «слышит» (пишут услышанное)': len(re.findall(r'\.heardSound[ \t]*=(?![ \t]*null)(?!=)', s)),
        'читателей журнала канала напрямую': len(re.findall(r'teamIntel(?:\[[^\]]+\]|\.(?:CT|T))\.sig\b(?!\.push\()', re.sub(r'function picEvents\(.*', '', s))),
        '_список: старый вариант': sorted(old),
        '_список: не используются': sorted(unused),
    }

if __name__ == '__main__':
    h = health(sys.argv[1])
    if '--json' in sys.argv: print(json.dumps(h, ensure_ascii=False, indent=1))
    else:
        for k, v in h.items():
            print(f'{k}: {", ".join(v) if isinstance(v, list) else v}')
