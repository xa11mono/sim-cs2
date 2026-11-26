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

PACK = '--pack' in sys.argv; sys.argv = [x for x in sys.argv if x != '--pack']   # (Р5.5) ядро без карты: MAP — из пакета при загрузке
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
        'coreLoadEnd();\nglobalThis.__ev = function(src){ return eval(src); };\n'
        # (Р5.2, 26.11) команды показа → симуляция (одно место: Worker страницы и локальный режим tools/node/local_server.js), ответ — кадр (frameMake)
        '// (Р5.2) команды показа: match — новый матч; adv — прошло ms (часы те же, что у страницы: clockAcc / stepTick, тики — без паузы, как в кадре\n'
        '// страницы; после тиков — снимок для\n'
        '// перемотки mkAfterTicks, как в кадре страницы); to — до тика; set — переменные, которые читает симуляция; now — часы показа (nowTs:\n'
        '// время рождения трассеров, вспышек — как в странице, где nowTs ставится раз в кадр перед тиками). (Р5.2, режимы) snap — снимок\n'
        '// состояния (+ снимки перемотки, если cp) для перехода симуляции на страницу; restore — снимок страницы обратно. Ответ — кадр / снимок\n'
        'function coreCmd(m){ if(m.now != null) nowTs = m.now;\n'
        '  if(m.cmd === "match") freshMatch(m.n, m.keep);\n'
        '  else if(m.cmd === "adv"){ if(m.ms > 0) clockPause(false); clockAcc(accumulator + m.ms); while(accumulator >= TICK_MS){ stepTick(); clockAcc(accumulator - TICK_MS); } mkAfterTicks(); }\n'
        '  else if(m.cmd === "to"){ clockPause(false); while(tick < m.t){ stepTick(); mkAfterTicks(); } }\n'
        '  else if(m.cmd === "set"){ Object.keys(m.v).forEach(function(k){ eval(k + " = m.v[k]"); }); }\n'
        '  else if(m.cmd === "restore"){ mkRestore(m.S); if(m.cp){ MK.cps = m.cp.cps; MK.cpMatch = m.cp.m; MK.lastCpTick = m.cp.t; } }\n'
        '  if(m.cmd === "snap") return {tick: tick, S: mkSnapshot(), cp: m.cp ? {cps: MK.cps, m: MK.cpMatch, t: MK.lastCpTick} : null};\n'
        '  return {tick: tick, F: frameMake()}; }\n'
        # (Р5.2) кадр Worker'а — переносимым ArrayBuffer (текст mkPack в UTF-8: без копии при передаче); enc — мс на упаковку (замер передачи)
        'if(typeof document === "undefined" && typeof importScripts === "function"){ SIM_SHOW = true; self.onmessage = function(e){ var r = coreCmd(e.data);\n'
        '  if(!r.F){ postMessage(r); return; } var t0 = performance.now(), u = new TextEncoder().encode(mkPack(r.F));\n'
        '  postMessage({tick: r.tick, B: u.buffer, enc: performance.now() - t0}, [u.buffer]); }; }\n'
        'globalThis.coreCmd = coreCmd;\n'
        '})();\n')
core = src + snap + glue
if PACK:   # (Р5.5) карта — из пакета .simmap (tools/map-pack): загрузчик кладёт её в globalThis.__SIM_MAP до ядра (tools/node/core_run.js --pack)
    core = '<script>' + core.replace('@@MAP@@', 'globalThis.__SIM_MAP', 1) + '</script>'
    if not args: out = os.path.join(ROOT, 'dist', 'core-pack.js')   # одно ядро на все карты
else: core = inject_map('<script>' + core + '</script>', name, need=('@@MAP@@',))
tmp = os.path.join(tempfile.mkdtemp(), 'core.html'); open(tmp, 'w', encoding='utf-8').write(core)
gamesrc.bundle_modules(tmp)
html = open(tmp, encoding='utf-8').read()
js = re.match(r'^<script>([\s\S]*)</script>$', html).group(1)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(js)
print('%s: %d КБ, файлов ядра %d (показ и разметка не входят)' % (out, len(js) // 1024, sum(1 for f in gamesrc.order() if meta[f]['part'] not in ('show', 'page'))))
