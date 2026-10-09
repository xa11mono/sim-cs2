#!/usr/bin/env python3
"""Лог ретейка CT по результату tools/retake_log.js и вердикт.

Запуск:
  python3 src/build.py
  node src/q.js sim.html "$(sed -e s/__MODE__/full/ -e s/__SITE__/A/ tools/retake_log.js)" > rt.json
  python3 tools/retake_log.py rt.json

Вердикт:
  full / live — собрались (≥ minPlayers у точки), никто не на сайте раньше сбора и раньше входа энтри;
  late / alone / econ — план CT стал «сейв», на сайт никто не зашёл.
"""
import json
import sys


def main(path):
    d = json.load(open(path))
    print(f"{d['mode']} {d['site']}: плант на {d['plantSec']} с раунда; конец — {d['end']}")
    print("живые CT:", ", ".join(d["aliveCT"]))
    for p in d["plan"]:
        print(f"  план +{p[0]} с: {p[1]} — {p[2]}")
    for r in d["rows"]:
        print(f"  +{r[0]:>5} с  {r[1]:<14} {str(r[2] or ''):<4} {r[3]}: {r[4]}")
    for s in d["saveLog"]:
        print("  " + s)
    for e in d["enter"]:
        print(f"  на сайте +{e['sec']} с: {e['who']} (своих рядом {e['mates']})")
    ok = True
    saved = any(p[1].startswith("сейв") for p in d["plan"])
    if d["mode"] in ("full", "live"):
        gathered = any(r[3] == "собрались" for r in d["rows"])
        if not gathered and not saved:
            ok = False; print("  НЕТ: команда не собралась")
        for v in d["violations"]:
            ok = False; print(f"  НАРУШЕНИЕ +{v[0]} с {v[1]}: {v[2]}")
    else:
        if not saved:
            ok = False; print("  НЕТ: ретейк начат, а должен быть сейв")
        if d["enter"]:
            ok = False; print("  НЕТ: на сайт заходили при сейве")
    print("ВЕРДИКТ:", "ок" if ok else "есть нарушения")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
