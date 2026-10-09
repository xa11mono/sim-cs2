# Читаемый отчёт по войсу (tools/team_log.js): фразы, дубли, «знание только из войса».
# python3 tools/team_log.py team_on.json team_off.json
import json, sys, re
on = json.load(open(sys.argv[1])); off = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
NICK = {"T0":"donk","T1":"sh1ro","T2":"TN1R","T3":"magixx","T4":"zont1x","CT0":"kyousuke","CT1":"m0NESY","CT2":"TeSeS","CT3":"karrigan","CT4":"NiKo"}
print("== Войс (с войсом) ==")
said = []
for t, k, txt in on["events"]:
    if k in ("voice", "kill", "bomb"): print(f"  [{t}s] {'  ' if k=='voice' else '* '}{txt}")
    if k == "voice": said.append((float(t), txt))
drop = [e for e in on["events"] if e[2].startswith("войс не прозвучал")]
print(f"\nне прозвучало: {len(drop)}")
for t, k, txt in drop: print(f"  [{t}s] {txt}")
# дубли по смыслу: тот же текст без ника в пределах 6 с
dup = 0
for i, (t, x) in enumerate(said):
    m = x.split(": ", 1)[1]
    for t2, x2 in said[:i]:
        if t - t2 <= 6 and x2.split(": ", 1)[1] == m: dup += 1; print("  ДУБЛЬ:", t2, x2, "→", t, x)
print(f"дублей по смыслу (тот же колл ≤6 с): {dup}")
# знание о невиденном враге: причины изменений веры
seen = set(on["seen"])
def cats(d):
    c = {}
    for tk, who, en, cause in d["log"]:
        if who[0:2] == en[0:2] or f"{who}>{en}" in seen: continue  # сам видел — не считаем
        k = "войс" if cause.startswith("войс") else re.split(r"[ :(]", cause)[0]
        c[k] = c.get(k, 0) + 1
    return c
print("\nВера о враге, которого бот САМ НЕ ВИДЕЛ, — откуда менялась (записей лога):")
print("  с войсом:", cats(on))
if off: print("  без войса:", cats(off))
for who in ("CT3", "CT4"):
    print(f"\n{NICK[who]} ({who}, стоит на CT-спавне, врагов не видел) — что знает в конце раунда:")
    for en, hy in sorted(on["fin"].get(who, {}).items()):
        top = max(hy, key=lambda h: h[2]); o = off["fin"].get(who, {}).get(en) if off else None
        to = max(o, key=lambda h: h[2]) if o else None
        print(f"  {NICK.get(en, en):8} с войсом: {top[0]} {top[1]} {top[2]:.2f}" + (f"   | без: {to[0]} {to[1]} {to[2]:.2f}" if to else ""))
