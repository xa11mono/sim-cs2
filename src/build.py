#!/usr/bin/env python3
"""Сборка симулятора: python3 build.py ../sim.html
Исходник игры (с v177) — маленькие файлы:
  - page.html — страница (кнопки, стили); на месте <!--@@JS@@--> встаёт код;
  - js/NN_*.js — код по смыслу; склеиваются по порядку номеров;
  - data/* — данные (навмеш, зоны, стены, картинка радара, про-данные,
    лайнапы); в коде на их месте метка @@DATA:имя@@ (или @@PNG:имя@@ для
    картинки — вставляется как base64).
Склейка даёт ровно ту же страницу, что раньше давал один файл game.html.
Потом сборка вставляет на место метки @@BUILD@@ то, что генерируется:
  - __SNAP — список переменных симулятора для снимков/перемотки (marks.js);
  - MK_PRINCIPLES — пункты из docs/PRINCIPLES.md для карточки «Я понял так»;
  - сам модуль marks.js.
Правка поведения ботов — в нужном файле js/."""
import re, json, sys, os, hashlib
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sim.html'))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
MARK = "/*@@BUILD: здесь build.py вставляет __SNAP, MK_PRINCIPLES и marks.js@@*/\n"
import base64, glob
def assemble():
    page = open('page.html', encoding='utf-8').read()
    js = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob('js/[0-9][0-9]_*.js')))
    assert page.count('<!--@@JS@@-->\n') == 1
    out = page.replace('<!--@@JS@@-->\n', js)
    def data(m):
        t = open(os.path.join('data', m.group(1)), encoding='utf-8').read()
        return t[:-1] if t.endswith('\n') else t
    out, nd = re.subn(r'@@DATA:([\w.]+)@@', data, out)
    out, npng = re.subn(r'@@PNG:([\w.]+)@@', lambda m: base64.b64encode(open(os.path.join('data', m.group(1)), 'rb').read()).decode(), out)
    assert nd == len([f for f in os.listdir('data') if f.endswith('.json')]) and npng == 1, (nd, npng)
    out, nkf = re.subn(r'@@KFICONS@@', lambda m: kf_icons(), out)
    assert nkf == 1, nkf
    assert '@@DATA:' not in out and '@@PNG:' not in out
    return out
# Иконки киллфида (v180): data/killfeed/<ключ>.svg — ключ = оружие из WEAPONS
# (AK, M4…), KNIFE_T, HE, MOLOTOV или значок (hs, smoke, wall, noscope, blind,
# flash). В страницу встают очищенными: без заголовков редактора, без
# неиспользуемых <symbol>, числа до 0,1, id с префиксом ключа.
def kf_icons():
    res = {}
    for f in sorted(glob.glob('data/killfeed/*.svg')):
        key = os.path.basename(f)[:-4]
        t = open(f, encoding='utf-8').read()
        t = re.sub(r'<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->|<symbol\b.*?</symbol>', '', t, flags=re.S)
        vb = re.search(r'<svg\b[^>]*?viewBox="([^"]+)"', t, re.S).group(1).split()
        t = re.sub(r'<svg\b[^>]*>', '', t, count=1, flags=re.S).replace('</svg>', '')
        t = re.sub(r'\bid="([^"]+)"', lambda m: 'id="kf_%s_%s"' % (key, m.group(1)), t)
        t = re.sub(r'url\(#([^)]+)\)', lambda m: 'url(#kf_%s_%s)' % (key, m.group(1)), t)
        # 1 знак после точки: иконка ~16 px при высоте 32 → точность 0,05 px
        t = re.sub(r'\d*\.\d+', lambda m: ('%.1f' % float(m.group(0))).rstrip('0').rstrip('.') or '0', t)
        t = re.sub(r'\s+', ' ', t).replace('> <', '><').strip()
        res[key] = {"vb": ' '.join(vb), "w": float(vb[2]), "h": float(vb[3]), "svg": t}
    return json.dumps(res, ensure_ascii=False)
s = assemble()
assert s.count(MARK) == 1

# ---------- пункты PRINCIPLES (заголовки с номерами) ----------
P = []
sec = ""
for line in open('../docs/PRINCIPLES.md', encoding='utf-8'):
    h = re.match(r'^## (.+)', line)
    if h: sec = h.group(1).strip(); continue
    m = re.match(r'^- \[( |x)\] (~~)?\*\*([А-ЯA-Z]\d+)\.\*\* (.*)', line)
    if not m: continue
    txt = re.sub(r'~~|\*\*|\*', '', m.group(4))
    txt = re.split(r' \(\d\d\.\d\d| — (?:частично|исправлено|подтверждено|по цифрам|v\d)', txt)[0].strip()
    P.append({"id": m.group(3), "sec": sec, "text": txt[:220], "done": m.group(1) == 'x'})
assert len(P) >= 1, len(P)

# ---------- перечень переменных симулятора для снимков ----------
def top_vars(src):
    names = []
    for mm in re.finditer(r'(?m)^var ', src):
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
            elif depth == 0 and c == ';': break
            elif depth == 0 and c == '\n' and re.match(r'[A-Za-z_$/(]', src[i+1:i+2] or ' '): break
            elif depth == 0 and c == ',': start = True
            i += 1
    out = []
    for x in names:
        if x not in out: out.append(x)
    return out
STATIC = set("""ZONEMAP ZONEMAP_RAW NAVAREAS NAVAREAS_RAW NAV_BOUNDARY_SEGS_RAW NAV_BOUNDARY_VERTS_RAW zonesById zoneGraph ZONE_SAMPLES
ZONE_DANGER_LINE PRO_LINEUPS_RAW BOT_INIT
WALL_POLYS_CODE WALL_SOLID_POLYS WALLS_SIG NAV_BLOCKED navBlockedCount navCutPortals navNarrowPortals ZONE_DANGER ZONE_DANGER_W _WB _WBn""".split())
SETTINGS = set("""BAL MANUAL_WALLS WALL_POLYS wallSegs wallSegsLOS USER_ZONES USER_LINEUPS ZONE_NAMES ZONE_SHAPES navAnchors navTransform zoneLayer""".split())
UI = set("view paused lastFrame accumulator nowTs MAPED MED_W MED_W_HINTS".split())  # редактор карты (MAPED — с базой страницы, MED_W — вкладка «стены») в снимок не попадает
# v199: слой «высоты» и вкладка «высоты» редактора карты — в снимок не попадают
UI |= set("HEIGHTS HGT_AUTO HGT_OWN_CODE HGT_OWN HGT_STOPS HGT_C HGT_LEDGE_TXT chkHeights hgtTip MED_H MED_H_HINTS".split())
V = [v for v in top_vars(s) if v not in STATIC | SETTINGS | UI and not v.startswith('__') and not v.startswith('MK') and not v.startswith('mk')]
for must in ['tick', 'bots', 'bomb', 'roundNum', 'matchNum', 'smokes', 'score', 'roundState']:
    assert must in V, must
snap = "var __SNAP = [\n" + ",\n".join('["%s", function(){ return %s; }, function(v){ try{ %s = v; }catch(e){} }]' % (v, v, v) for v in V) + "\n];\n"
mod = open('marks.js', encoding='utf-8').read()
s = s.replace(MARK, snap + "var MK_PRINCIPLES = " + json.dumps(P, ensure_ascii=False) + ";\n" + mod +
    "\n// (v167) каждый сеанс начинается с чистого матча 1 — как в замерах, чтобы отметки повторялись\nfreshMatch(1); paused = false;\n")
open(OUT, 'w', encoding='utf-8').write(s)
