"""(Р5.6, 26.11) сборки страницы, кроме обычной (одна карта, src/build.py):
  --all-maps <куда.html>  автономный HTML всех карт: внутри — страницы каждой карты ровно такие же, как одиночная сборка (src/build.py --map
                          <карта>), текстом; при открытии выбранная (?map=<карта> или кнопка) открывается через document.open / write.
  --variant-b <папка>     вариант B (движок + пакеты файлами): index.html (загрузчик) + engine.html (страница без карты: MAP — из пакета) +
                          maps/<карта>.simmap (tools/map-pack) + load.mjs; загрузчик читает пакет (fetch — нужен локальный сервер или стенд,
                          с file:// браузер fetch не даст), подставляет имя карты и подсказки и открывает страницу. ?map=<карта>.
Обычная сборка не меняется. Запуск: python3 src/build_variants.py --all-maps dist/all-maps.html | --variant-b dist/variant-b"""
import json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); sys.path.insert(0, HERE)
from mapset import map_js
MAPS = sorted(d for d in os.listdir(os.path.join(ROOT, 'data', 'maps')) if os.path.exists(os.path.join(ROOT, 'data', 'maps', d, 'map.json')))


WORKER_DEF = False   # (Р8, 27.11) all_maps включает: страницы карт автономного HTML — Worker по умолчанию
def single(name):   # обычная сборка одной карты — как есть
    out = os.path.join(tempfile.mkdtemp(), name + '.html')
    subprocess.run([sys.executable, os.path.join(HERE, 'build.py'), '--map', name, out] + (['--worker-default'] if WORKER_DEF else []), check=True, stdout=subprocess.DEVNULL)
    return open(out, encoding='utf-8').read()


def esc(t): assert '@@SIMCS2_' not in t; return t.replace('</script', '</scr@@SIMCS2_SC@@ipt').replace('<!--', '<!@@SIMCS2_C@@--')   # меток в странице нет — обратная замена точная; <!-- — иначе разбор <script> уходит в «экранированное» состояние   # метки в странице нет — обратная замена точная


def all_maps(out):
    global WORKER_DEF; WORKER_DEF = True
    blocks = ''.join('<script type="text/plain" id="page-%s">%s</script>\n' % (m, esc(single(m))) for m in MAPS)
    names = {m: map_js(m)[1].get('name', m) for m in MAPS}
    html = ('<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>sim-cs2 — все карты</title></head><body>\n'
            '<div id="pick" style="font:16px sans-serif;margin:40px">Карта: %s</div>\n%s'
            '<script>(function(){ var M = %s, q = /[?&]map=([a-z0-9_-]+)/.exec(location.search), sel = q && M.indexOf(q[1]) >= 0 ? q[1] : null;\n'
            '  function open(m){ var t = document.getElementById("page-" + m).textContent.split("</scr@@SIMCS2_SC@@ipt").join("</script").split("<!@@SIMCS2_C@@--").join("<!--"); document.open(); document.write(t); document.close(); }\n'
            '  // (Р8 п. 17, 27.11) открыть — после разбора документа: во время разбора document.open() не действует, страница карты дописывалась под выбор карты\n'
            '  if(sel) addEventListener("load", function(){ open(sel); }); else document.querySelectorAll("#pick button").forEach(function(b){ b.onclick = function(){ open(b.dataset.m); }; }); })();</script>\n'
            '</body></html>\n') % (' '.join('<button data-m="%s">%s</button>' % (m, names[m]) for m in MAPS), blocks, json.dumps(MAPS))
    open(out, 'w', encoding='utf-8').write(html)
    print('%s: %d КБ, карт %d (%s)' % (out, len(html) // 1024, len(MAPS), ', '.join(MAPS)))


def variant_b(d):
    os.makedirs(os.path.join(d, 'maps'), exist_ok=True)
    # страница без карты: MAP — из пакета (globalThis.__SIM_MAP), надписи карты — метки, их ставит загрузчик
    import mapset
    real = mapset.inject_map
    mapset.inject_map = lambda html, name, need=('@@MAP@@', '@@MAP_NAME@@'): html.replace('@@MAP@@', 'globalThis.__SIM_MAP', 1)
    try:
        sys.modules.pop('build', None)
        tmp = os.path.join(tempfile.mkdtemp(), 'engine.html'); argv = sys.argv; sys.argv = ['build.py', '--map', MAPS[0], tmp]
        try: __import__('build')
        finally: sys.argv = argv
    finally:
        mapset.inject_map = real
    shutil.copyfile(tmp, os.path.join(d, 'engine.html'))
    for m in MAPS: subprocess.run(['node', os.path.join(ROOT, 'tools', 'map-pack', 'pack.mjs'), m, os.path.join(d, 'maps', m + '.simmap')], check=True, stdout=subprocess.DEVNULL)
    shutil.copyfile(os.path.join(ROOT, 'tools', 'map-pack', 'load.mjs'), os.path.join(d, 'load.mjs'))
    ui = {m: (lambda meta: {'name': meta.get('name', m), 'zone': meta.get('ui', {}).get('zoneNameHint', ''), 'layer': meta.get('ui', {}).get('zoneLayerHint', '')})(map_js(m)[1]) for m in MAPS}
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(
        '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>sim-cs2</title></head><body><div id="pick" style="font:16px sans-serif;margin:40px">загрузка…</div>\n'
        '<script type="module">\nimport { openMapPack } from "./load.mjs";\nconst UI = %s, q = /[?&]map=([a-z0-9_-]+)/.exec(location.search), m = q && UI[q[1]] ? q[1] : %s;\n'
        'const [pack, page] = await Promise.all([fetch("maps/" + m + ".simmap").then(r => r.arrayBuffer()), fetch("engine.html").then(r => r.text())]);\n'
        'globalThis.__SIM_MAP = openMapPack(new Uint8Array(pack)).createMatchMap();\n'
        'const t = page.replaceAll("@@MAP_NAME@@", UI[m].name).replaceAll("@@MAP_ZONE_HINT@@", UI[m].zone).replaceAll("@@MAP_ZONE_LAYER_HINT@@", UI[m].layer);\n'
        'document.open(); document.write(t); document.close();\n</script></body></html>\n' % (json.dumps(ui, ensure_ascii=False), json.dumps(MAPS[0])))
    sz = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, F in os.walk(d) for f in F)
    print('%s: вариант B — index.html, engine.html (%d КБ), карт %d, всего %d КБ' % (d, os.path.getsize(os.path.join(d, 'engine.html')) // 1024, len(MAPS), sz // 1024))


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--all-maps' in a: all_maps(a[a.index('--all-maps') + 1])
    elif '--variant-b' in a: variant_b(a[a.index('--variant-b') + 1])
    else: print(__doc__)
