"""(Р5, 26.11) Сборка ядра игры без показа: dist/core-<карта>.js — только файлы симуляции (часть не show / page по rebuild/files.json),
в том же порядке, что в странице; снимок / восстановление (src/snapshot.js + список переменных снимка из реестра — как src/marks_build.py)
— на том же месте относительно файлов ядра (после них); набор карты (@@MAP@@ — src/mapset.py); модули каналов — тем же сборщиком
esbuild (tools/rebuild/mod_build.js), что и страница. Конец: coreLoadEnd() (BOT_INIT, MK_LOAD) и вход __ev — внутри обёртки игры.
Ни DOM, ни холста, ни заглушек: ядро выполняется в чистом Node (tools/node/core_run.js).
Запуск: python3 tools/node/core_build.py [--map ancient|mirage] [куда.js]"""
import os, re, sys, tempfile
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'); sys.path.insert(0, os.path.join(ROOT, 'src'))
import gamesrc, marks_build
from mapset import map_arg, inject_map

name, args = map_arg(sys.argv[1:])
out = args[0] if args else os.path.join(ROOT, 'dist', 'core-%s.js' % name)
meta, mods = gamesrc.game_meta(), set(gamesrc.module_files())
parts = []
for f in gamesrc.order():
    if meta[f]['part'] in ('show', 'page'): continue
    parts.append(('/*@@MODINIT %s@@*/\n' % f) if f in mods else gamesrc.read_game_file(f).decode('utf-8'))
src = ''.join(parts)
# снимок — как marks_build.inject, но без интерфейса отметок (src/marks.js)
page_src = gamesrc.game_source()   # полная склейка страницы — для списка переменных снимка и отпечатка исходника (MK_BUILD), как в странице
mark = marks_build.MARK
snap_block = marks_build.inject(page_src)
i = page_src.index(mark); head = snap_block[i:]   # всё, что inject вставил: __SNAP, MK_BUILD, MK_KEEP…, snapshot.js + marks.js
cut = head.index(marks_build.snapshot_src()) + len(marks_build.snapshot_src())
snap = head[:cut]   # без интерфейса отметок
glue = ('\n// (Р5) конец загрузки ядра без показа: то же, что view/app.js на своём месте (coreLoadEnd), и вход для инструментов\n'
        'coreLoadEnd();\nglobalThis.__ev = function(src){ return eval(src); };\n})();\n')
core = src + snap + glue
core = inject_map('<script>' + core + '</script>', name, need=('@@MAP@@',))
tmp = os.path.join(tempfile.mkdtemp(), 'core.html'); open(tmp, 'w', encoding='utf-8').write(core)
gamesrc.bundle_modules(tmp)
html = open(tmp, encoding='utf-8').read()
js = re.match(r'^<script>([\s\S]*)</script>$', html).group(1)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(js)
print('%s: %d КБ, файлов ядра %d (показ и разметка не входят)' % (out, len(js) // 1024, sum(1 for f in gamesrc.order() if meta[f]['part'] not in ('show', 'page'))))
