"""«Отметить момент» (v255, перенос из ветки rebuild-v238): сборка вставляет в игру на место метки @@BUILD@@
  - __SNAP — список переменных симулятора для снимка/перемотки (все `var` верхнего уровня, кроме статичных данных,
    настроек и интерфейса) — новые переменные игры попадают в снимок сами;
  - сам модуль src/marks.js.
Вызывают src/build.py (sim.html) и src/mkpub.py (публикуемая страница) — обе страницы одинаковые."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
MARK = "/*@@BUILD: здесь build.py вставляет __SNAP и marks.js@@*/\n"


# ---------- перечень переменных симулятора для снимков ----------
def top_vars(src):
    names = []
    # (26.11) и `var` после комментария в той же строке («/* … */ var X = 1;») — раньше регулярка видела только `var` в начале строки,
    # такая переменная выпадала из снимка и из сравнения локатора (регрессионный тест — tools/rebuild/snap_vars_test.js)
    for mm in re.finditer(r'(?m)^(?:/\*[^\n]*?\*/[ \t]*)*var ', src):
        i = mm.end(); depth = 0; q = None; n = len(src); start = True
        while i < n:
            c = src[i]
            if start:
                mi = re.match(r'\s*([A-Za-z_$][\w$]*)', src[i:i+80])
                if mi: names.append(mi.group(1))
                start = False
            if q:
                if c == '\\': i += 2; continue
                if c == q or (q != '`' and c == '\n'): q = None
            elif c in '"\'`': q = c
            elif c in '([{': depth += 1
            elif c in ')]}': depth -= 1
            elif depth == 0 and c == ';':
                # (v343) вторая `var` в той же строке (`var events = []; var killfeed = [];`) — раньше не попадала в снимок, и при
                # перемотке киллфид оставался «из будущего»: убийства повторялись
                mv = re.match(r'[ \t]*var[ \t]+', src[i+1:i+40])
                if mv: i += 1 + mv.end(); start = True; continue
                break
            elif depth == 0 and c == '\n' and re.match(r'[A-Za-z_$/(]', src[i+1:i+2] or ' '): break
            elif depth == 0 and c == ',': start = True
            i += 1
    out = []
    for x in names:
        if x not in out: out.append(x)
    return out

# (Р3.1.3, 25.11) что идёт в снимок — колонка snap реестра состояния (rebuild/state_classes.json: «да» / «нет: причина»), а не списки
# исключений здесь (были STATIC / SETTINGS / UI / EXTRA_STATIC — перенесены в реестр с причиной; история причин — git этого файла).
# Переменной без строки в реестре — «да» (как раньше: всё, что не исключено); сборку без строки останавливает gen_maps --check.
REGISTRY = os.path.join(HERE, '..', 'rebuild', 'state_classes.json')
def snap_policy():
    try: C = json.load(open(REGISTRY, encoding='utf-8'))
    except (OSError, ValueError): return {}
    return {k[2:]: o.get('snap', 'да') for k, o in C.items() if k.startswith('g:')}


def snap_vars(s):
    """Переменные, которые сборка кладёт в снимок отметки (__SNAP), по порядку. (Р3.1, 25.11) одно место: им пользуются сборка и реестр
    состояния (tools/rebuild/state_gen.js — графа «в снимке сейчас»). Склейка s + каналы-модули (rebuild/modules.json)."""
    from gamesrc import module_source
    P = snap_policy()
    return [v for v in top_vars(s) + [x for x in top_vars(module_source()) if x not in top_vars(s)] if not P.get(v, 'да').startswith('нет') and not v.startswith('__') and not v.startswith('MK') and not v.startswith('mk')]


def snapshot_src():
    return open(os.path.join(HERE, 'snapshot.js'), encoding='utf-8').read()


def inject(s):
    assert s.count(MARK) == 1, "нет метки @@BUILD@@ в игре"
    # (17.11, перестройка — модули) переменные каналов-модулей (rebuild/modules.json) — тоже в снимок: их нет в склейке; запись — через
    # сеттер модуля (сборщик tools/rebuild/mod_build.js переписывает строки __SNAP на __set_<имя>)
    from gamesrc import module_source
    V = snap_vars(s)
    for must in ['tick', 'bots', 'bomb', 'roundNum', 'matchNum', 'smokes', 'score', 'roundState']:
        assert must in V, must
    snap = "var __SNAP = [\n" + ",\n".join('["%s", function(){ return %s; }, function(v){ try{ %s = v; }catch(e){} }]' % (v, v, v) for v in V) + "\n];\n"
    # (Р5, 26.11) снимок / восстановление / перемотка — src/snapshot.js (часть ядра: Т-2, отметки), интерфейс отметок — src/marks.js (показ);
    # в странице — подряд, как был один файл
    mod = snapshot_src() + open(os.path.join(HERE, 'marks.js'), encoding='utf-8').read()
    # (Р2.1, 25.11) отпечаток исходника игры (склейка + модули; .ts — без типов) — отметка записывает его (mkEnv), инструмент
    # tools/marks/mark_build.js по нему находит коммит и собирает ту самую сборку: старая отметка открывается своей сборкой
    import hashlib
    build_sha = hashlib.sha256((s + module_source()).encode('utf-8')).hexdigest(); build = build_sha[:16]
    # (Р5.7, 26.11) для identity отметки v2: полный SHA-256 исходника игры и SHA-256 исходника dmath (одинаковая математика — та же версия)
    dmath_sha = hashlib.sha256(open(os.path.join(HERE, '..', 'engine', 'core', 'dmath.ts'), 'rb').read()).hexdigest()
    # (Т-2) память между матчами — по классам реестра состояния (одно место): чистый старт матча (marks.js mkMatchClean) её не трогает
    REG = json.load(open(REGISTRY, encoding='utf-8'))
    keep = sorted(k[2:] for k, o in REG.items() if k.startswith('g:') and o.get('class') in ('постоянная память', 'серия'))
    # (Т-1б) корни неизменяемых данных, на объекты которых ссылается состояние (реестр, колонка refs) — снимок пишет такие ссылки путём
    roots = sorted(set(r for k, o in REG.items() if not k.startswith('_') for r in (o.get('refs') or [])))
    # (Т-1б) поля-кэши, которые игра дописывает в объекты этих корней (реестр, строки f:корень.поле) — снимок несёт их (marks.js mkSnapExt)
    sf = sorted(set(k.split('.', 1)[1] for k in REG if k.startswith('f:')))
    # (Р5.1, 26.11) состав кадра показа: переменные, которые читает показ (rebuild/gen/frame.json, tools/rebuild/frame_contract.js), кроме
    # неизменяемых и настроек (они загружены с обеих сторон) — то, что меняет симуляция; кадр = снимок только их (src/snapshot.js frameMake)
    try: FJ = json.load(open(os.path.join(os.path.dirname(REGISTRY), 'gen', 'frame.json'), encoding='utf-8')); FR = dict(FJ.get('reads', {}), **FJ.get('readsVia', {}))   # + косвенно через вызовы функций симуляции
    except (OSError, ValueError, KeyError): FR = {}
    # (Р5.2, 26.11) и без кэшей: кэш — запомненный ответ функции от неизменяемых данных, страница считает его сама, как в обычном режиме
    # (WPM — ~14 МБ из ~17 МБ кадра; передача каждый кадр — секунда на кадр)
    frame = sorted(v for v in FR if v in V and (REG.get('g:' + v) or {}).get('class') not in ('неизменяемое', 'вход', 'кэш'))
    return s.replace(MARK, snap + ('var MK_BUILD_SHA = "%s", MK_DMATH_SHA = "%s";\n' % (build_sha, dmath_sha)) + 'var MK_BUILD = "%s";\nvar MK_KEEP = %s, MK_REF_ROOTS = %s, MK_STATIC_FIELDS = %s, FRAME_VARS = %s;\n' % (build, json.dumps(keep), json.dumps(roots), json.dumps(sf), json.dumps(frame)) + mod)
