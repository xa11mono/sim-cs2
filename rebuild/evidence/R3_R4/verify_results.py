"""(27.11) Проверка опубликованных результатов отпечатков и записей Р3.6 функциями штатного инструмента приёмки Codex (acceptance_334.py:
same_fp, rec_errors, completed) без архива 334: Э1 со следом выкл = эталон Р2, отпечаток со следом (из записи) = эталон, вкл = выкл, записи полны.
Сверка частичных событий danger с архивом 334 здесь не выполняется (архив — на ПК владельца).
  python3 rebuild/evidence/R3_R4/verify_results.py rebuild/evidence/R3_R4 <папка результатов pc-results/N> [метка выкл] [метка записей]"""
import sys, json, gzip
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import acceptance_334 as A
root = Path(sys.argv[2]); OFF, REC = (sys.argv[3] if len(sys.argv) > 3 else 'r39_off'), (sys.argv[4] if len(sys.argv) > 4 else 'r39_rec'); issues = []; n = {'off': 0, 'on': 0, 'rec': 0, 'onoff': 0}
def load(p):
    p = Path(p)
    if p.is_file(): return json.loads(p.read_bytes())
    g = p.with_suffix(p.suffix + '.gz'); return json.loads(gzip.decompress(g.read_bytes())) if g.is_file() else None
for name, tag in A.MAPS.items():
    for m in A.MATCHES:
        base = A.load_result(A.BASE / tag / f'fp_{m}.json')
        off = load(root / f'{OFF}_{tag}' / f'fp_{m}.json'); rec = load(root / f'{REC}_{tag}' / f'rec_{m}.json')
        for lab, row in ((f'{OFF}_{tag}', off), (f'{REC}_{tag}', rec)):
            g = load(root / lab / f'guard_{m}.json')
            if not A.completed(g) or g.get('engine') != 'chromium': issues.append(f'{lab}/{m}: нет успешного guard')
        if A.same_fp(off, base, m): n['off'] += 1
        else: issues.append(f'{name}/{m}: след выкл ≠ эталон Р2')
        errs = A.rec_errors(rec, m)
        if errs: issues.extend(f'r34_rec_{tag}/{m}: {e}' for e in errs)
        else: n['rec'] += 1
        on = rec.get('fingerprint') if isinstance(rec, dict) else None
        if A.same_fp(on, base, m): n['on'] += 1
        else: issues.append(f'{name}/{m}: след вкл ≠ эталон Р2')
        if A.same_fp(off, on, m): n['onoff'] += 1
        else: issues.append(f'{name}/{m}: след вкл ≠ выкл')
print(json.dumps(n, ensure_ascii=False)); print('\n'.join(issues) if issues else 'Э1 (след выкл) = эталон, след вкл = эталон, вкл = выкл, записи Р3.6 полны: 16 из 16 каждая')
sys.exit(1 if issues else 0)
