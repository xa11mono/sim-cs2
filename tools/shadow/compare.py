"""В136, шаг 3: сравнение «про сделал / бот решил бы» по записи режима тени (shadow.js). Ходьба: про стоит — бот ушёл бы; про идёт — бот
стоял бы; идут в разные стороны (> 75°). Взгляд: направление бота против взгляда про (> 60°). По механике (задача бота / причина взгляда),
по фазе (до планта / после) и длинные эпизоды (≥ 2 с подряд). Запуск: python3 tools/shadow/compare.py <shadow.json> <round_….json>"""
import sys, json, math, collections

S = json.load(open(sys.argv[1])); R = json.load(open(sys.argv[2]))
plant = next((e[1] for e in R['ev'] if e[0] == 'plant'), None)
name = {m[0]: m[1] for m in S['map']}


def ang(a, b): return abs((a - b + math.pi) % (2 * math.pi) - math.pi)


mv = collections.Counter(); mvT = collections.Counter(); lk = collections.Counter(); lkT = collections.Counter(); tot = collections.Counter()
runs = collections.defaultdict(list)
for r in S['rec']:
    t, s, bid, x, y, x3, y3, yaw, tag, px, py, lx, ly, why, st, fc, nd = r
    ph = 'до планта' if plant is None or t < plant else 'после планта'
    tag0 = tag.split(':')[0] if tag else '(нет задачи)'
    pro_m = math.hypot(x3 - x, y3 - y); bot_d = math.hypot(px - x, py - y) if px is not None else 0
    kind = None
    if pro_m < 60 and bot_d > 200: kind = 'про стоит — бот ушёл бы'
    elif pro_m > 150 and bot_d < 100: kind = 'про идёт — бот стоял бы'
    elif pro_m > 150 and bot_d > 150 and ang(math.atan2(y3 - y, x3 - x), math.atan2(py - y, px - x)) > math.radians(75): kind = 'идут в разные стороны'
    tot[ph] += 1
    if kind: mv[(ph, kind, tag0)] += 1; mvT[ph] += 1
    lkind = None
    if lx is not None and math.hypot(lx - x, ly - y) > 20 and ang(math.atan2(ly - y, lx - x), yaw) > math.radians(60): lkind = why or '(нет)'; lk[(ph, lkind)] += 1; lkT[ph] += 1
    runs[s].append((t, kind, tag0 if kind else None, lkind))
print('Раунд', R['demo'], 'р%d' % R['num'], '| плант на', round(plant / 64, 1) if plant else '—', 'с')
for ph in ('до планта', 'после планта'):
    if not tot[ph]: continue
    print('\n== %s: записей %d · ходьба не как у про %d%% · взгляд не как у про %d%%' % (ph, tot[ph], round(100 * mvT[ph] / tot[ph]), round(100 * lkT[ph] / tot[ph])))
    print('  ходьба (вид расхождения — задача бота):')
    for (p, k, tg), v in sorted(mv.items(), key=lambda kv: -kv[1]):
        if p == ph and v >= 3: print('    %3d  %s — %s' % (v, k, tg))
    print('  взгляд (причина взгляда бота):')
    for (p, w), v in sorted(lk.items(), key=lambda kv: -kv[1]):
        if p == ph and v >= 3: print('    %3d  %s' % (v, w))
print('\n== длинные эпизоды ходьбы (≥ 2 с подряд):')
for s, L in runs.items():
    cur = None
    for t, k, tg, lw in L + [(10 ** 9, None, None, None)]:
        key = (k, tg) if k else None
        if cur and key == cur[0]: cur[2] = t; continue
        if cur and cur[2] - cur[1] >= 96: print('  %-8s %5.1f–%5.1f с  %s (задача бота: %s)' % (name[s], cur[1] / 64, cur[2] / 64, cur[0][0], cur[0][1]))
        cur = [key, t, t] if key else None
