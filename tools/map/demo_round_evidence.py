"""Observed track and event evidence. Hypotheses are explicit, never decision inputs."""
from collections import Counter, defaultdict
from itertools import groupby

from boosts_bake import MIN_SUSTAIN_TICKS, stacked
from jumps_bake import vertical_return

SIDES = {2: 'T', 3: 'CT'}
TEAM_VALUES = {2: 'T', 3: 'CT', '2': 'T', '3': 'CT', '2.0': 'T', '3.0': 'CT', 'T': 'T', 'CT': 'CT'}
FRAME = ('tick', 'worldXYZ', 'radarXY', 'navCandidates', 'alive', 'hp', 'yaw', 'pitch', 'activeWeapon', 'extra')
EARLY = 'before_plant'


def team(value):
    return TEAM_VALUES.get(value)


def observed_roles(round_info, actors, events, first_site, geometry):
    """Role evidence by stable player identifier, with no permanent assignment."""
    shots = Counter(e.get('user_steamid') for e in events.get('weapon_fire', ()))
    kills = Counter(e.get('attacker_steamid') for e in events.get('player_death', ())
                    if team(e.get('attacker_team_num')) and team(e.get('user_team_num'))
                    and team(e.get('attacker_team_num')) != team(e.get('user_team_num'))
                    and e.get('attacker_steamid') != e.get('user_steamid'))
    defusers = {e.get('user_steamid') for e in events.get('bomb_defused', ())}
    utility_types = ('smokegrenade_detonate', 'flashbang_detonate', 'inferno_startburn', 'hegrenade_detonate')
    utility = {kind: Counter(e.get('user_steamid') for e in events[kind])
               for kind in utility_types if kind in events}
    contacts = [e for e in events.get('player_hurt', ())
                if team(e.get('attacker_team_num')) and team(e.get('user_team_num'))
                and team(e.get('attacker_team_num')) != team(e.get('user_team_num'))]
    opening = min((e['tick'] for e in contacts), default=None)
    opening_players = {e.get('attacker_steamid') for e in contacts if e['tick'] == opening}
    orders = {e['player']: e['tick'] for e in first_site if e['status'] == 'observed_inside_after_outside'}
    out = {}
    plant = round_info['tplant']
    for player, actor in actors.items():
        live = [p for p in actor['track'] if p[4]]
        before = [p for p in live if plant is None or p[0] < plant]
        out[player] = {
            'side': actor['side'], 'aliveSamples': len(live), 'prePlantSamples': len(before),
            'activeAwpSamples': sum(p[8] == 'AWP' for p in live),
            'navAreasBeforePlant': dict(Counter(str(p[3][0][0]) for p in before if len(p[3]) == 1)),
            'navZonesBeforePlant': dict(Counter(geometry.zones[str(p[3][0][0])] for p in before
                                                if len(p[3]) == 1 and str(p[3][0][0]) in geometry.zones)),
            'openingDamageAttacker': player in opening_players if opening is not None else None,
            'utilityDetonations': {kind: rows[player] for kind, rows in utility.items()},
            'weaponFireRows': shots[player] if 'weapon_fire' in events else None,
            'enemyKillRows': kills[player] if 'player_death' in events else None,
            'planted': player == str(round_info['planter']),
            'defused': player in defusers if 'bomb_defused' in events else None,
            'siteCrossingSampleTick': orders.get(player),
        }
    return out


def crossings(actors, plant, site, geometry, verified):
    """Earliest sampled crossing, with missing and already-inside observations explicit."""
    out = []
    if plant is None or site is None:
        return out
    for player, actor in actors.items():
        if actor['side'] != 'CT':
            continue
        earlier = None
        for p in actor['track']:
            if not p[4] or p[0] < plant:
                continue
            where = geometry.site(site, p[2], p[3], verified)
            if where is None:
                earlier = None
                continue
            method, inside = where
            if inside:
                out.append({'player': player, 'tick': p[0], 'previousOutsideTick': earlier,
                            'status': ('observed_inside_after_outside' if earlier is not None
                                       else 'inside_at_first_resolved_sample'),
                            'method': method})
                break
            earlier = p[0]
    return sorted(out, key=lambda p: (p['tick'], p['player']))


def clutches(frames, roster):
    """Alive census from complete sampled frames; no extrapolation through missing frames."""
    ranges, active = [], None
    for tick, players in sorted(frames.items()):
        if set(players) != roster:
            active = None
            continue
        live = {side: sorted(i for i, (s, p) in players.items() if s == side and p[4])
                for side in SIDES.values()}
        lone = next(((side, ids[0], live['T' if side == 'CT' else 'CT']) for side, ids in live.items()
                     if len(ids) == 1 and len(live['T' if side == 'CT' else 'CT']) > 1), None)
        if lone is None:
            active = None
        elif active and (active['side'], active['player'], active['opponents']) == lone:
            active['lastObservedTick'] = tick
            active['samples'] += 1
        else:
            active = {'side': lone[0], 'player': lone[1], 'opponents': lone[2],
                      'firstObservedTick': tick, 'lastObservedTick': tick, 'samples': 1}
            ranges.append(active)
    return ranges


def vertical_candidates(actors, frames, cadence):
    jumps, boosts = [], []
    for player, actor in actors.items():
        for k in range(len(actor['track']) - 3):
            p = actor['track'][k:k + 4]
            if not all(t[4] for t in p):
                continue
            ticks = [t[0] for t in p]
            # A sampled vertical excursion must have a continuous four-point window.
            if set(b - a for a, b in zip(ticks, ticks[1:])) == {cadence} and vertical_return(ticks, [t[1] for t in p]):
                jumps.append({'player': player, 'ticks': ticks, 'kind': 'legacy_vertical_return_proxy'})
    pending = {}
    for tick, all_players in sorted(frames.items()):
        live = [(i, s, p) for i, (s, p) in all_players.items() if p[4]]
        current = {}
        for upper, side, a in live:
            for lower, other_side, b in live:
                if upper == lower or side != other_side or not stacked(a[2] + [a[1][2]], b[2] + [b[1][2]]):
                    continue
                key = upper, lower
                old = pending.pop(key, None)
                if old and old['lastTick'] + cadence == tick:
                    old['lastTick'] = tick
                    current[key] = old
                else:
                    if old and old['lastTick'] - old['firstTick'] >= MIN_SUSTAIN_TICKS:
                        boosts.append(old)
                    current[key] = {'upper': upper, 'lower': lower, 'firstTick': tick, 'lastTick': tick,
                                    'kind': 'legacy_stacked_teammates_proxy'}
        boosts.extend(p for p in pending.values() if p['lastTick'] - p['firstTick'] >= MIN_SUSTAIN_TICKS)
        pending = current
    boosts.extend(p for p in pending.values() if p['lastTick'] - p['firstTick'] >= MIN_SUSTAIN_TICKS)
    return jumps, boosts


def round_evidence(info, samples, events, geometry, cadence, verified):
    actors, frames, quality = {}, defaultdict(dict), Counter()
    for sample in samples:
        tick, player, side, name, xyz, alive, hp, yaw, pitch, weapon, extra = sample
        actor = actors.setdefault(player, {'name': name, 'side': side, 'track': []})
        if tick in frames and player in frames[tick]:
            raise ValueError(f'{info["rid"]}: duplicate player/tick {player}/{tick}')
        if side != actor['side']:
            raise ValueError(f'{info["rid"]}: player switches sides within round')
        xy, areas = geometry.point(*xyz)
        state = [tick, xyz, xy, areas, alive, hp, yaw, pitch, weapon, extra]
        frames[tick][player] = side, state
        if alive:
            quality['aliveSamples'] += 1
            if not areas:
                quality['outsideNavXY'] += 1
            elif len(areas) > 1:
                quality['multipleNavAreas'] += 1
                if len({z for _, z in areas}) > 1:
                    quality['multipleNavHeights'] += 1
        actor['track'].append(state)

    for actor in actors.values():
        actor['track'].sort(key=lambda p: p[0])
        for a, b in zip(actor['track'], actor['track'][1:]):
            if a[4] and b[4] and a[3] and b[3] and len(a[3]) == len(b[3]) == 1:
                left, right = a[3][0][0], b[3][0][0]
                if left != right:
                    quality[geometry.transition(left, right)] += 1

    endings = [e for e in events.get('round_end', ()) if e['tick'] == info['t1'] and team(e.get('winner'))]
    end = endings[0] if len(endings) == 1 else None
    winner = team(end.get('winner')) if end else None
    last = max(frames, default=None)
    roster = set(actors)
    full_last = last is not None and set(frames[last]) == roster
    # A surviving player on the losing side supplies a candidate, not intent.
    # Keep the exact sample and the outcome event so a reviewer can exclude other explanations.
    saves = [{'player': i, 'lastCompleteSampleTick': last, 'side': s, 'kind': 'loser_alive_near_end'}
             for i, (s, p) in frames.get(last, {}).items() if p[4] and s != winner]
    if not (winner and full_last and end['tick'] == info['t1']):
        saves = []
    else:
        later_deaths = {e.get('user_steamid') for e in events.get('player_death', ()) if e['tick'] >= last}
        saves = [row for row in saves if row['player'] not in later_deaths]
    order = crossings(actors, info['tplant'], info['site'], geometry, verified)
    jumps, boosts = vertical_candidates(actors, frames, cadence)
    awp = []
    for player, actor in actors.items():
        for (phase, held), points in groupby(actor['track'], lambda p: (
                EARLY if info['tplant'] is None or p[0] < info['tplant'] else 'after_plant', p[4] and p[8] == 'AWP')):
            if held:
                awp.append({'player': player, 'phase': phase, 'sampleTicks': [p[0] for p in points]})
    return {
        **info, 'siteMethod': 'legacy_recipe_projection' if info['site'] else None,
        'players': actors, 'events': events, 'winner': winner, 'quality': dict(quality),
        'observerFacts': {'clutchSamples': clutches(frames, roster), 'awpActive': awp,
                          'roleEvidence': observed_roles(info, actors, events, order, geometry)},
        'reviewCandidates': {'save': saves, 'siteEntries': order, 'checkJump': jumps, 'boost': boosts},
    }
