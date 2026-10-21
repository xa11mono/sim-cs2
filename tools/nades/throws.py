#!/usr/bin/env python3
"""В1 (21.10.2026): броски гранат про из демок → data/maps/<карта>/throws.json.

python3 tools/nades/throws.py --map ancient|mirage

Источник броска — weapon_fire_full (выгрузка Б4: все выстрелы с X/Y/Z, yaw, pitch, velocity_X/Y/Z, ducking в момент броска).
Демки без weapon_fire_full не берутся. Разрыв — flashbang_detonate, hegrenade_detonate, smokegrenade_detonate,
inferno_startburn (x, y, z, тик, кто бросил, entityid).
Связь бросок → разрыв: тот же игрок (steamid), тот же тип, тот же раунд, первый ещё не занятый разрыв после броска в окне
WIN[тип] секунд; броски игрока идут по времени, разрывы раздаются по порядку (две флешки подряд → первая к первой).
entityid у броска в выгрузке нет — им связать нельзя; у разрывов он проверяется на повтор (два броска к одному
разрыву невозможны по построению).
Раунды — tools/demos.py (rounds_of: конец freeze … конец раунда, переигранные раунды отброшены); бросок вне раунда не берётся.

Поля броска (throws.json → throws[]):
  demo, round (номер раунда с 1), side (T/CT), type (smoke/flash/he/molotov; decoy — только в счёте), weapon, steamid, name,
  tick, t (с от конца freeze), pos [X, Y, Z] (ноги игрока, ед. игры), yaw, pitch (как в демке: вниз +), duck (присед),
  vel [vx, vy, vz], hspeed (ед/с), move (stand / walk / run / jump — move_of), strength (сила броска: null — подбирает В2),
  det: {tick, dt (с от броска), pos [x, y, z], entityid} или null (не связался);
  после В2 (check.js --fill): strength (1 / 0.5 / 0) и jumpBind (прыжок на бинде) — у совпавших с физикой, simErr [ед., с].
"""
import json, os, sys, collections
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from demos import DEMOS, MAPNAME, TICK, demo_names, rounds_of, event  # noqa: E402
import mapdir  # noqa: E402

TYPES = {'weapon_smokegrenade': 'smoke', 'weapon_flashbang': 'flash', 'weapon_hegrenade': 'he',
         'weapon_molotov': 'molotov', 'weapon_incgrenade': 'molotov', 'weapon_decoy': 'decoy'}
DET = {'smoke': 'smokegrenade_detonate', 'flash': 'flashbang_detonate', 'he': 'hegrenade_detonate', 'molotov': 'inferno_startburn'}
# окно поиска разрыва после броска, с: флешка/HE — запал 1,5 с + запас; молотов — до разрыва в воздухе (≈ 2 с) + запас;
# смок — пока катится до остановки (бывает долго). Окна только отсекают чужие разрывы; сколько реально — в отчёте.
WIN = {'flash': 3.0, 'he': 3.0, 'molotov': 4.0, 'smoke': 15.0}


def move_of(hs, vz):
    """стоял / шёл / бежал / прыжок по скорости игрока в момент броска. Прыжок — |vz| > 60 (на скатах и ступенях у CS2
    в демке |vz| до ~60 и на земле). «Джампбросок» на бинде здесь не виден: в тик броска скорость ещё без прыжка (В2 его
    подбирает, как силу)."""
    if abs(vz) > 60: return 'jump'
    if hs < 10: return 'stand'
    if hs < 160: return 'walk'          # шаг с Shift — до 0,52 × 250 = 130 ед/с; присед — до 85
    return 'run'


def main():
    out, cnt = [], collections.Counter()
    unl_det = collections.Counter()
    demos_used, demos_skipped = [], []
    for demo in demo_names():
        f = os.path.join(DEMOS, demo + '_weapon_fire_full.csv.gz')
        if not os.path.exists(f):
            demos_skipped.append(demo); continue
        demos_used.append(demo)
        wf = pd.read_csv(f, low_memory=False)
        wf = wf[wf.weapon.isin(TYPES)].copy()
        wf['type'] = wf.weapon.map(TYPES)
        R = rounds_of(demo)
        dets = {}
        for k, e in DET.items():
            d = event(demo, e)
            if 'x' not in d.columns: d = pd.DataFrame(columns=['entityid', 'tick', 'total_rounds_played', 'user_steamid', 'x', 'y', 'z'])
            dets[k] = d.sort_values('tick')
        # раунд каждого броска / разрыва: по границам rounds_of (тик в [t0, t1])
        def rnd(tick):
            for r in R:
                if r['t0'] <= tick <= r['t1']: return r
            return None
        used = {k: set() for k in DET}
        for _, w in wf.sort_values('tick').iterrows():
            r = rnd(int(w.tick))
            if r is None:
                cnt['вне раунда'] += 1; continue
            ty = w.type
            cnt['бросков'] += 1; cnt['бросков_' + ty] += 1
            if ty == 'decoy':
                continue
            sid = int(w.user_steamid)
            vx, vy, vz = float(w.user_velocity_X), float(w.user_velocity_Y), float(w.user_velocity_Z)
            hs = float(np.hypot(vx, vy))
            th = {'demo': demo, 'round': r['num'] + 1, 'side': {2: 'T', 3: 'CT'}.get(int(w.user_team_num), '?'),
                  'type': ty, 'weapon': w.weapon[7:], 'steamid': str(sid), 'name': str(w.user_name).strip(),
                  'tick': int(w.tick), 't': round((int(w.tick) - r['t0']) / TICK, 2),
                  'pos': [round(float(w.user_X), 1), round(float(w.user_Y), 1), round(float(w.user_Z), 1)],
                  'yaw': round(float(w.user_yaw), 2), 'pitch': round(float(w.user_pitch), 2),
                  'duck': bool(w.user_ducking == True), 'vel': [round(vx, 1), round(vy, 1), round(vz, 1)],  # noqa: E712
                  'hspeed': round(hs, 1), 'move': move_of(hs, vz), 'strength': None, 'det': None}
            d = dets[ty]
            cand = d[(d.user_steamid.astype('int64') == sid) & (d.tick > w.tick) & (d.tick <= w.tick + WIN[ty] * TICK)
                     & (d.tick <= r['t1'] + 5 * TICK)]
            for i, e in cand.iterrows():
                if i in used[ty]: continue
                used[ty].add(i)
                th['det'] = {'tick': int(e.tick), 'dt': round((int(e.tick) - int(w.tick)) / TICK, 3),
                             'pos': [round(float(e.x), 1), round(float(e.y), 1), round(float(e.z), 1)],
                             'entityid': int(e.entityid) if 'entityid' in e and not pd.isna(e.entityid) else None}
                break
            cnt['связано_' + ty if th['det'] else 'не связано_' + ty] += 1
            out.append(th)
        # разрывы без броска (в раундах): бросок не попал в выгрузку / окно
        for k, d in dets.items():
            for i, e in d.iterrows():
                if i not in used[k] and rnd(int(e.tick)) is not None: unl_det[k] += 1
    # повтор entityid у связанных (в пределах демки) — проверка, что два броска не взяли один разрыв
    ent = collections.Counter((t['demo'], t['type'], t['det']['entityid'], t['det']['tick']) for t in out if t['det'])
    dup = sum(1 for v in ent.values() if v > 1)
    summary = {'карта': MAPNAME, 'демок': len(demos_used), 'без weapon_fire_full (не взяты)': demos_skipped,
               'счёт': dict(sorted(cnt.items())), 'разрывов без броска': dict(unl_det), 'двойных связей': dup,
               'окна, с': WIN}
    res = {'_about': 'В1: броски гранат про (tools/nades/throws.py). Поля — в шапке скрипта. Сила броска (strength) — '
                     '1 ЛКМ / 0.5 обе / 0 ПКМ, подбирается в В2 (tools/nades/check.js) по точке разрыва.',
           'summary': summary, 'throws': out}
    fo = mapdir.path(MAPNAME, 'throws.json')
    with open(fo, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(res, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps(summary, ensure_ascii=False)[:1500])
    print('->', fo, len(out))


if __name__ == '__main__':
    main()
