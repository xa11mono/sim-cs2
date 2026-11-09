#!/usr/bin/env python3
# (v512) Подборы бросков лайнапов заранее: python3 tools/nades/guess_bake.py --map <карта> → data/maps/<карта>/nadeguess.json
# {v: отпечаток кода подбора и данных карты (src/mapset.py nade_hash), g: {ключ nadeGuess: решение}}. Считает та же игра (sim.html,
# headless), тем же nadePrecalcTick во freeze-тайм первого раунда — значения те же, что игра посчитала бы сама. Пересчитывать после
# правок подбора / физики гранат / данных карты (сборка сама не включит устаревший файл и напишет об этом).
import json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'src'))
import mapset
name, argv = mapset.map_arg(sys.argv[1:])
out = os.path.join(mapset.MAPS, name, 'nadeguess.json')
if os.path.exists(out): os.remove(out)   # считать без старого файла
sim = os.path.join(tempfile.mkdtemp(), 'sim.html')
subprocess.run(['python3', os.path.join(ROOT, 'src', 'build.py'), '--map', name, sim], check=True, stdout=subprocess.DEVNULL)
js = r'''freshMatch(3); NADE_PRECALC_N = 1e9; var n = allLineups().length;
while(NADE_PRECALC_I < n) nadePrecalcTick();
var bad = 0, s = JSON.stringify(nadeGuessStore.all(), function(k, v){ if(typeof v === "number" && !isFinite(v)) bad++; return v; });
bad ? "BAD " + bad : s'''
f = os.path.join(tempfile.mkdtemp(), 'bake.js'); open(f, 'w').write(js)
r = subprocess.run(['node', os.path.join(ROOT, 'src', 'q.js'), sim, '@' + f], capture_output=True, text=True, timeout=3600)
txt = r.stdout.strip()
if not txt.startswith('{'): sys.exit('ошибка: ' + (txt or r.stderr)[-500:])
g = json.loads(txt)
json.dump({'v': mapset.nade_hash(name), 'g': g}, open(out, 'w'), separators=(',', ':'))
print(json.dumps({'map': name, 'guesses': len(g), 'bytes': os.path.getsize(out)}))
