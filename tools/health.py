#!/usr/bin/env python3
"""Цифры здоровья кода по собранному файлу симулятора.
python3 tools/health.py sim.html   (печатает таблицу; --json — машиночитаемо)

Что считается (те же определения, что в docs/AUDIT.md):
- строк в файле;
- переключателей BAL.* (ключи объекта `var BAL = {...}`), из них включено,
  из них держат старый вариант рядом (`!BAL.x` у включённого), не используются;
- вызовов назначения позиции `setPost(`, причин взгляда `lookReason =`,
  заказов гранаты `assignNade(`, прямых бросков `throwNade(` (без объявлений).
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
        'причин взгляда (lookReason =)': len(re.findall(r'lookReason\s*=(?!=)', s)),
        'заказов гранаты (assignNade)': calls('assignNade'),
        'прямых бросков (throwNade)': calls('throwNade'),
        '_список: старый вариант': sorted(old),
        '_список: не используются': sorted(unused),
    }

if __name__ == '__main__':
    h = health(sys.argv[1])
    if '--json' in sys.argv: print(json.dumps(h, ensure_ascii=False, indent=1))
    else:
        for k, v in h.items():
            print(f'{k}: {", ".join(v) if isinstance(v, list) else v}')
