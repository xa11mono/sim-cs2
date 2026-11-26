#!/usr/bin/env python3
"""(Р3.1, 25.11) Смысловая разметка реестра состояния — rebuild/state_classes.json. Машинная часть — rebuild/gen/state.json
(tools/rebuild/gen_maps.js). Решение владельца 25.11: неизвестному полю хозяин и срок жизни не присваиваются — строка «не размечено».

Источники разметки (поле src у строки, по старшинству):
  ручная   — разметка человеком / агентом по чтению кода (с причиной); этот скрипт её не трогает;
  codex    — смысловая оценка Codex (rebuild/preparation/state_registry.csv, только строки без «(кандидат)» и «срок уточнить»);
  правило  — по фактам из машинной части, с доказательством в why (см. RULES ниже); уверенность «статически» — алиасы и обходы
             через параметры статический разбор не видит;
  нет      — «не размечено».
Запуск: python3 tools/rebuild/state_classes.py  (пересчитывает codex / правило; ручные строки и их порядок сохраняет; новые имена из
state.json добавляет «не размечено»; исчезнувшие помечает gone — проверка сборки на них падает)."""
import json, csv, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ST = json.load(open(os.path.join(ROOT, 'rebuild', 'gen', 'state.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'rebuild', 'state_classes.json')
CLASSES = ['раунд', 'матч', 'серия', 'постоянная память', 'неизменяемое', 'вход', 'кэш', 'показ', 'режим', 'диагностика', 'случайность', 'асинхронное', 'внутри вызова', 'не поле бота', 'не размечено']
CODEX = {'временное состояние раунда': 'раунд', 'временное состояние матча': 'матч', 'временное состояние серии': 'серия',
         'постоянная память': 'постоянная память', 'вычислительные кэши': 'кэш', 'вычислительный кэш с изменяемым состоянием': 'кэш',
         'вычислительные бюджеты / курсор': 'кэш', 'состояние отображения': 'показ', 'состояние отображения/режимы': 'показ',
         'диагностическое состояние': 'диагностика', 'неизменяемые входы': 'вход', 'неизменяемые данные': 'неизменяемое',
         'генераторы случайных чисел': 'случайность'}
ROUND_RESET = {'resetRound'}
MATCH_RESET = {'newMatch', 'freshMatch', 'matchBegin', 'resetMatchMemory', 'startHalf', 'memStart', 'memRestore'}
# (Р4.2а) часть файла (показ / режим страницы) — из rebuild/files.json «game» (src/gamesrc.py game_meta), а не номер в имени
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src'))
import gamesrc
META = gamesrc.game_meta()
META_ID = {g['id']: g for g in META.values()}
def is_show_id(f): g = META_ID.get(f, {}); return g.get('part') in ('show', 'page') and not g.get('mode')   # показ, не режим
def is_mode_id(f): return bool(META_ID.get(f, {}).get('mode'))                                         # режим страницы
def is_sim_id(f): return META_ID.get(f, {}).get('part') not in (None, 'show', 'page')                   # симуляция (было: номер < 550)
def show_only(ws):
    """пишут только файлы показа, не режимы страницы (разминка, повтор, песочница, демо)"""
    fs = {w.split(':')[0] for w in ws}
    return fs and all(META.get(f, {}).get('part') in ('show', 'page') and not META.get(f, {}).get('mode') for f in fs), sorted(META.get(f, {}).get('id', '?') for f in fs)
# опыт: что меняется за матч (tools/rebuild/state_runtime.js → rebuild/evidence/R3/state_runtime_*.json); «неизменяемое» по правилу —
# только если не меняется ни в одном опыте (статический разбор не видит записей через другие имена: 25.11 опроверг 5 переменных)
import glob
RUN = [json.load(open(f, encoding='utf-8')) for f in sorted(glob.glob(os.path.join(ROOT, 'rebuild', 'evidence', 'R3', 'state_runtime_*.json')))]
RUN_NAMES = ', '.join('%s м%d до тика %d' % (r['sim'].split('.')[0], r['match'], r['points'][-1]['tick']) for r in RUN)
BV = {}   # образцы значений полей ботов (tools/rebuild/state_bot_values.js → rebuild/evidence/R3/state_bot_values_*.json)
for f in sorted(glob.glob(os.path.join(ROOT, 'rebuild', 'evidence', 'R3', 'state_bot_values_*.json'))):
    for k, L in json.load(open(f, encoding='utf-8')).items(): BV.setdefault(k, []).extend(x for x in L if x not in BV.get(k, []))
REFS = {}   # общие ссылки на неизменяемые данные (tools/rebuild/state_refs.js → rebuild/evidence/R3/state_refs_*.json): держатель → корни
for f in sorted(glob.glob(os.path.join(ROOT, 'rebuild', 'evidence', 'R3', 'state_refs_*.json'))):
    for who, R in json.load(open(f, encoding='utf-8'))['holders'].items(): REFS.setdefault(who, set()).update(R)
SMUT = {}   # поля, которые игра дописывает в объекты неизменяемых данных (tools/rebuild/state_static_mut.js): «корень .поле» → сколько
for f in sorted(glob.glob(os.path.join(ROOT, 'rebuild', 'evidence', 'R3', 'state_static_mut_*.json'))):
    for pt in json.load(open(f, encoding='utf-8'))['points'].values():
        for k, n in list(pt['added'].items()) + list(pt['changed'].items()): SMUT[k] = max(SMUT.get(k, 0), n)
STAMP = re.compile(r'(T|T0|Next|Until|At|Cd|Tick|Since)$')
def changed(kind, n):
    return [p for r in RUN for p in (r[kind].get(n) or {}).get('changed', [])]

def fns(d):   # {«функция · файл»: n} → [(функция, файл)]
    return [tuple(k.split(' · ')) for k in d]

def rule_global(n, g):
    W = fns(g['w']) + fns(g['m']); wf = {f for _, f in W}; wn = {fn for fn, _ in W}
    rsim = [f for f in g['r'] if is_sim_id(f)]
    if not W:
        if not RUN or any(n not in r['globals'] for r in RUN): return None   # нет в опыте (новая переменная) — опыт её не видел
        ch = changed('globals', n)
        if ch: return None   # меняется через другое имя — разметка вручную
        if any((r['globals'].get(n) or {}).get('type') == 'function' for r in RUN): return None   # замыкание: содержимое опыт не видит
        return 'неизменяемое', 'после объявления (%s) не пишется по имени и не меняется по содержимому; опыт: не меняется за матч (%s)' % (g['decl'], RUN_NAMES), 'загрузка'
    if wn & ROUND_RESET:
        return 'раунд', 'пишет resetRound (%s)' % ', '.join(sorted(f for fn, f in W if fn in ROUND_RESET)), 'раунд (resetRound)'
    if wn & MATCH_RESET:
        return 'матч', 'пишет ' + ', '.join(sorted(fn for fn in wn & MATCH_RESET)) + ', не resetRound', 'матч (' + '/'.join(sorted(wn & MATCH_RESET)) + ')'
    if all(is_show_id(f) for f in wf) and not rsim:
        return 'показ', 'пишут только файлы показа (%s), симуляция (до 550) не читает' % ', '.join(sorted(wf)), 'показ'
    if all(is_mode_id(f) for f in wf) and not rsim:
        return 'режим', 'пишут только режимы (%s), симуляция не читает' % ', '.join(sorted(wf)), 'режим'
    return None

def rule_hidden(n, h):
    """Свойство функции (состояние вне переменных): пишут только файлы показа — показ; остальное — вручную."""
    so, wf = show_only(h['w'])
    if so:
        return 'показ', 'свойство функции; пишут только файлы показа (%s)' % ', '.join(sorted(wf)), 'показ'
    return None

def rule_bot(n, b):
    wn = {w.split(' ', 1)[1] if ' ' in w else '' for w in b['w']}
    if not b['w'] and b['lit'] and RUN and all(n in r['bot'] for r in RUN) and not changed('bot', n):
        return 'неизменяемое', 'задаётся при создании бота (%s), дальше по имени не пишется' % b['lit'][0], 'игрок'
    if wn & ROUND_RESET:
        return 'раунд', 'пишет resetRound (%s)' % ', '.join(sorted(w.split(' ')[0] for w in b['w'] if w.endswith(' resetRound'))[:3]), 'раунд (resetRound)'
    if wn & MATCH_RESET:
        return 'матч', 'пишет ' + ', '.join(sorted(wn & MATCH_RESET)) + ', не resetRound', 'матч'
    so, wf = show_only(b['w']); wf = set(wf)
    if so:
        return 'показ', 'пишут только файлы показа (%s)' % ', '.join(sorted(wf)), 'показ'
    if wf and all(is_mode_id(f) for f in wf):
        return 'режим', 'пишут только режимы (%s)' % ', '.join(sorted(wf)), 'режим'
    V = BV.get(n) or []
    if V and all(re.match(r'obj\{.*\b(round|r)\b', x) for x in V):
        return 'раунд', 'значение несёт метку раунда (образцы: %s)' % '; '.join(V[:2]), 'по метке раунда в значении'
    if V and STAMP.search(n) and all(x.startswith('number:') for x in V):
        return 'раунд', 'поле-срок: номер тика (образцы: %s)' % '; '.join(V[:3]), 'по сроку (тик в значении)'
    # пишет симуляция, раундом не сбрасывается, метки нет: живёт до перезаписи; freshMatch удаляет поля, которых не было при загрузке
    # (530:97–100, BOT_INIT), newMatch — нет (вопрос Т-2). Поле без «_» и без образцов — скорее поле другого объекта: не размечается
    if wf and all(is_sim_id(f) for f in wf) and (n.startswith('_') or V):
        return 'матч', 'пишет симуляция (%s), resetRound не сбрасывает, метки раунда / срока нет%s' % (', '.join(sorted(wf)), '' if V else '; в опыте у ботов не появлялось'), 'до перезаписи; freshMatch удаляет (BOT_INIT), newMatch — нет (Т-2)'
    return None

def main():
    old = {k: v for k, v in (json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}).items() if not k.startswith('_')}
    cx = {}
    for r in csv.DictReader(open(os.path.join(ROOT, 'rebuild', 'preparation', 'state_registry.csv'), encoding='utf-8')):
        c = CODEX.get(r['category'])
        if c: cx[('g:' if r['scope'] == 'global' else 'b:') + r['field']] = (c, r['owner'], r['lifetime'], r['snapshot_proposal'])
    out = {}
    names = [('g:' + k, v, rule_global) for k, v in ST['globals'].items()] + [('b:' + k, v, rule_bot) for k, v in ST['bot'].items()] + \
            [('h:' + k, v, rule_hidden) for k, v in ST.get('hidden', {}).items()]
    for key, v, rule in names:
        o = old.get(key)
        if o and o.get('src') == 'ручная': out[key] = o; continue
        if key in cx:
            c, own, life, snap = cx[key]
            out[key] = {'class': c, 'owner': own, 'life': life, 'snap': snap, 'src': 'codex', 'why': 'смысловая оценка Codex (state_registry.csv)'}
            continue
        r = rule(key[2:], v)
        if r: out[key] = {'class': r[0], 'owner': '', 'life': r[2], 'snap': '', 'src': 'правило', 'why': r[1]}
        else:
            ch = changed('globals' if key[0] == 'g' else 'bot', key[2:]) if key[0] != 'h' else []
            note = ('опыт: меняется (' + ', '.join(sorted(set(ch))) + ')') if ch else ''
            if key[0] == 'g' and not (v['w'] or v['m']) and ch: note += '; по имени не пишется — меняется через другое имя'
            if key[0] == 'b': note = (note + '; ' if note else '') + (('образцы: ' + '; '.join(BV[key[2:]][:3])) if BV.get(key[2:]) else 'у ботов в опыте (2 карты, тики 3000…70000) не появлялось — возможно, поле другого объекта с тем же именем')
            out[key] = {'class': 'не размечено', 'owner': '', 'life': '', 'snap': '', 'src': 'нет', 'why': note}
    # (Р3.1.3) политика снимка — колонка snap: «да» / «нет: причина» (глобальные), «с bots» (поля бота). Хранится в реестре и при
    # пересчёте не теряется; новой строке — по нынешнему поведению сборки (state.json snap), при его отсутствии — «да» (как раньше)
    for key, o in out.items():
        o['cmp'] = old.get(key, {}).get('cmp') or 'да'   # (Р3.1.5) сравнивать ли в локаторе — хранится в реестре, при пересчёте не теряется
        prev = old.get(key, {}).get('snap', '')
        if prev.startswith('да') or prev == 'с bots' or prev.startswith('нет'): o['snap'] = prev; continue
        if key[0] == 'b': o['snap'] = 'с bots'; continue
        if key[0] == 'h': o['snap'] = 'нет: свойство функции — вне переменных снимка'; continue
        m = ST['globals'][key[2:]].get('snap')
        o['snap'] = 'да' if m is True or m is None else 'нет: ' + str(m)
    # (Т-1б) поля-кэши в неизменяемых данных (опыт): строки f:корень.поле — снимок несёт их у объектов корней (marks.js mkSnapExt)
    for k, n in SMUT.items():
        root, fld = k.split(' .'); key = 'f:' + root + '.' + fld
        o = old.get(key) if old.get(key, {}).get('src') == 'ручная' else None
        out[key] = o or {'class': 'кэш', 'owner': '', 'life': 'страница (ленивое поле в данных)', 'snap': 'да: __ext.sf (Т-1б)', 'cmp': 'да', 'src': 'правило',
                          'why': 'опыт: игра дописывает поле .%s в объекты %s по ходу матча (до %d объектов) — ленивый кэш в «неизменяемых» данных' % (fld, root, n)}
    # (Т-1б) refs — на какие корни вне снимка ссылается значение (опыт); снимок пишет такие ссылки путём (marks.js mkSnapRefs)
    for key, o in out.items():
        if key in REFS: o['refs'] = sorted(REFS[key])
        elif 'refs' in o: del o['refs']
    for k, o in old.items():
        if k not in out: out[k] = dict(o, gone=True)
    out = dict(sorted(out.items())); out = dict({'_classes': CLASSES, '_': 'смысловая разметка реестра состояния (tools/rebuild/state_classes.py); машинная часть — rebuild/gen/state.json'}, **out)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    from collections import Counter
    rows = [o for k, o in out.items() if not k.startswith('_')]
    print('строк', len(rows), dict(Counter(o['src'] for o in rows)))
    print(dict(Counter(o['class'] for o in rows)))
if __name__ == '__main__': main()
