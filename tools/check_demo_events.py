#!/usr/bin/env python3
"""Этап 4 аудита: проверка выгрузки демок для разбора перестрелок и флешек (до любых выводов по ним).
По каждой демке и в сумме: есть ли файлы player_hurt / player_blind / weapon_fire_full / ticks_fight; дубли; синхронизация:
  • player_hurt ↔ health в тиках: после события урона здоровье жертвы в ближайшем снимке не выше health из события;
  • player_hurt со смертельным уроном ↔ player_death того же игрока в пределах 2 тиков;
  • weapon_fire_full ⊇ прореженного weapon_fire (каждый первый выстрел в 0,5 с есть в полном);
  • снимки боя покрывают ±1 с вокруг ≥95 % выстрелов; шаг снимков;
  • player_blind: длительности (0 < blind_duration ≤ 6 с), у кого (свой/враг/сам) — по team_num.
python3 tools/check_demo_events.py [папка demo_export]   (по умолчанию data/demos)"""
import os, sys, glob, collections
import pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), 'data', 'demos')

def rd(name, ev, **kw):
    f = os.path.join(D, f'{name}_{ev}.csv.gz')
    return pd.read_csv(f, **kw) if os.path.exists(f) else None

def main():
    names = sorted(os.path.basename(f)[:-len('_ticks.csv.gz')] for f in glob.glob(os.path.join(D, '*_ticks.csv.gz')))
    T = collections.Counter(); per = []
    for n in names:
        hurt, blind, full, fight = rd(n, 'player_hurt'), rd(n, 'player_blind'), rd(n, 'weapon_fire_full'), rd(n, 'ticks_fight')
        T['демок'] += 1
        for k, v in (('player_hurt', hurt), ('player_blind', blind), ('weapon_fire_full', full), ('ticks_fight', fight)):
            T['есть ' + k] += v is not None
        row = {'демка': n}
        if hurt is not None and len(hurt):
            T['урон событий'] += len(hurt)
            dup = hurt.duplicated(['tick', 'user_steamid', 'attacker_steamid', 'dmg_health']).sum(); T['урон дублей'] += int(dup)
            ticks = pd.read_csv(os.path.join(D, f'{n}_ticks.csv.gz'), usecols=['tick', 'steamid', 'health'])
            G = {int(s): (g.tick.values, g.health.values) for s, g in ticks.groupby('steamid')}
            ok = bad = 0
            for tk, u, h in zip(hurt.tick.values, hurt.user_steamid.values, hurt.health.values if 'health' in hurt else [None]*len(hurt)):
                if h is None or u != u or int(u) not in G: continue
                tt, hh = G[int(u)]; i = tt.searchsorted(tk)
                if i >= len(tt) or tt[i] - tk > 16: continue
                if hh[i] <= h: ok += 1
                else: bad += 1
            T['урон сверен с health'] += ok; T['урон не сходится с health'] += bad
            death = rd(n, 'player_death')
            if death is not None and 'health' in hurt:
                lethal = hurt[hurt.health <= 0]
                dk = collections.defaultdict(list)
                for tk, u in zip(death.tick.values, death.user_steamid.values):
                    if u == u: dk[int(u)].append(int(tk))
                for tk, u in zip(lethal.tick.values, lethal.user_steamid.values):
                    T['смертельный урон'] += 1; T['смертельный урон → player_death ±2 тика'] += any(abs(x - tk) <= 2 for x in dk.get(int(u), []))
        if full is not None and len(full):
            T['выстрелов (полных)'] += len(full)
            T['выстрелов дублей'] += int(full.duplicated(['tick', 'user_steamid']).sum())
            thin = rd(n, 'weapon_fire')
            if thin is not None:
                S = set(zip(full.tick.values, full.user_steamid.values))
                T['прореженных'] += len(thin); T['прореженных есть в полном'] += sum((a, b) in S for a, b in zip(thin.tick.values, thin.user_steamid.values))
            if fight is not None and len(fight):
                ft = fight.tick.drop_duplicates().sort_values().values
                steps = pd.Series(ft).diff().dropna(); T['шаг снимков боя (мода)'] = int(steps.mode().iloc[0]) if len(steps) else 0
                cov = 0
                for tk in full.tick.values:
                    i = ft.searchsorted(tk - 64); j = ft.searchsorted(tk + 64)
                    cov += (j - i) >= 0.9 * (128 / max(1, T['шаг снимков боя (мода)']))
                T['выстрелов с полными снимками ±1 с'] += cov
                for c in ('velocity_X', 'velocity_Y'):
                    T['в снимках боя есть ' + c] += c in fight.columns
            for c in ('velocity_X', 'health', 'yaw'):
                T['у выстрелов есть ' + c] += ('user_' + c) in full.columns or c in full.columns
        if blind is not None and len(blind):
            T['ослеплений'] += len(blind)
            dcol = 'blind_duration' if 'blind_duration' in blind else None
            if dcol:
                T['ослеплений с длительностью 0–6 с'] += int(((blind[dcol] > 0) & (blind[dcol] <= 6)).sum())
            if 'user_team_num' in blind and 'attacker_team_num' in blind:
                same = blind.user_team_num == blind.attacker_team_num
                selfb = blind.user_steamid == blind.attacker_steamid
                T['ослеплений: сам'] += int(selfb.sum()); T['ослеплений: свой'] += int((same & ~selfb).sum()); T['ослеплений: враг'] += int((~same).sum())
        per.append(row)
    for k, v in T.items(): print(f'{k:45} {v}')
    if not T['есть player_hurt']:
        print('\nНет player_hurt / player_blind / weapon_fire_full: нужен перезапуск у владельца — python parse_demos.py <папка> --events')

if __name__ == '__main__':
    main()
