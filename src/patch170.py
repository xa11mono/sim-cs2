# v167 (задача 2): инструмент «Отметить момент» + карточка «Я понял так» + перемотка.
# Мозг ботов не трогаем. Правки вне инструмента — только перезапуск матча:
#  (1) freshMatch сбрасывает память «где умирали T» (TDEATHS): раньше она
#      переживала перезапуск, и повтор матча на той же странице шёл иначе
#      с 2–3 раунда (матчи замера на свежей странице это не задевало);
#  (2) следующий матч в живом режиме и загрузка страницы начинаются начисто,
#      через freshMatch — как в замерах. Иначе отметку в матче N не повторить.
import re, json

# ---------- (1) сброс TDEATHS ----------
rep("  CLEARZ = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}};\n",
    "  CLEARZ = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}}; TDEATHS = {m:-1, list:[]};\n")
# ---------- (2) следующий матч — начисто ----------
rep("    if(simTime - roundEndTime >= 7) newMatch();",
    "    if(simTime - roundEndTime >= 7){ freshMatch(matchNum + 1); paused = false; var inpMN = document.getElementById(\"inpMatchNum\"); if(inpMN) inpMN.value = matchNum; }")
rep('<div class="sub" id="simVersion"', '<div class="sub" id="simVersion"')
s = re.sub(r'(id="simVersion"[^>]*>)версия \d+ · [0-9.]+', r'\g<1>версия 167 · 01.10', s, count=1)
assert 'версия 167' in s

# ---------- снимки после шагов симуляции ----------
rep("    while(accumulator >= TICK_MS){ stepTick(); accumulator -= TICK_MS; }\n  }\n  draw();",
    "    while(accumulator >= TICK_MS){ stepTick(); accumulator -= TICK_MS; }\n    mkAfterTicks();\n  }\n  draw();")

# ---------- стили ----------
rep("</style>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com", """  .mk-panel{position:absolute;top:10px;right:12px;width:min(640px,calc(100% - 24px));max-height:calc(100% - 20px);overflow-y:auto;z-index:50;background:#0a0e09;border:1px solid var(--accent-dim);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.5;}
  .mk-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:var(--accent);font-size:14px;}
  .mk-panel textarea{width:100%;background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:8px;font:inherit;resize:vertical;}
  .mk-panel select{background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:6px;font:inherit;}
  .mk-row2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;}
  .mk-row2 label{display:flex;gap:4px;align-items:center;color:var(--text-dim);}
  .mk-q{color:var(--text-dim);font-size:12px;margin:4px 0;} .mk-err{color:var(--danger);font-size:12px;min-height:16px;}
  #mkImg{width:100%;border-radius:6px;border:1px solid var(--line);display:block;margin-bottom:4px;}
  .mk-lbl{color:var(--text-dim);font-size:12px;margin-top:8px;} .mk-big{font-size:15px;margin:2px 0 8px;}
  .mk-chip{display:inline-block;font-size:12px;padding:3px 9px;border-radius:5px;margin:0 6px 6px 0;background:#4a3a14;color:#f4d27a;}
  .mk-chip-a{background:#163450;color:#9cc8f2;} .mk-chip-n{background:#1f3a1a;color:#b7e08a;}
  .mk-pt{font-size:12px;color:var(--text);border-left:2px solid var(--line);padding-left:8px;margin:0 0 6px;}
  .mk-think{color:var(--accent);padding:14px 0;}
  .mk-item{border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin-bottom:6px;cursor:pointer;} .mk-item:hover{background:var(--panel-2);}
  .mk-item .mk-row{display:flex;justify-content:space-between;gap:8px;} .mk-t{margin:2px 0;}
  .mk-done .mk-t{text-decoration:line-through;color:var(--text-dim);}
  .mk-urg{color:var(--danger);} .mk-st{font-size:11px;color:var(--text-dim);} .mk-st-fixed{color:#ffd76a;} .mk-st-unparsed{color:var(--site);}
  .mk-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;background:rgba(10,14,9,0.96);border:1px solid var(--accent);color:var(--text);padding:8px 14px;border-radius:6px;max-width:80%;}
  .mk-prog{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);z-index:60;background:rgba(10,14,9,0.96);border:1px solid var(--accent);color:var(--accent);padding:14px 22px;border-radius:8px;font-size:15px;}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com""")

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
assert len(P) >= 30, len(P)

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
ZONE_DANGER_LINE PRO_SPOTS PRO_PRIOR PRO_LOOK PRO_LINEUPS_RAW BOT_INIT""".split())
SETTINGS = set("""BAL MANUAL_WALLS WALL_OBJECTS wallSegs wallSegsLOS USER_ZONES USER_LINEUPS ZONE_NAMES ZONE_SHAPES navAnchors navTransform zoneLayer""".split())
UI = set("view paused lastFrame accumulator nowTs".split())
V = [v for v in top_vars(s) if v not in STATIC | SETTINGS | UI and not v.startswith('__') and not v.startswith('MK') and not v.startswith('mk')]
for must in ['tick', 'bots', 'bomb', 'roundNum', 'matchNum', 'teamTac', 'belief', 'smokes', 'score', 'roundState']:
    assert must in V, must
snap = "var __SNAP = [\n" + ",\n".join('["%s", function(){ return %s; }, function(v){ try{ %s = v; }catch(e){} }]' % (v, v, v) for v in V) + "\n];\n"
mod = open('marks.js', encoding='utf-8').read()
rep("window.__ev=function(src){return eval(src);};\n",
    snap + "var MK_PRINCIPLES = " + json.dumps(P, ensure_ascii=False) + ";\n" + mod +
    "\n// (v167) каждый сеанс начинается с чистого матча 1 — как в замерах, чтобы отметки повторялись\nfreshMatch(1); paused = false;\n" +
    "window.__ev=function(src){return eval(src);};\n")
