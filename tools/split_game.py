#!/usr/bin/env python3
"""(v377, одноразовый) Разрезать монолит src/game.html на модули src/game/NNN_имя.(html|js).

python3 tools/split_game.py [src/game.html] [--dry]

- Режет строго по порядку строк: склейка файлов src/game/* в порядке имён == исходник байт в байт (проверяется здесь же).
- JS режется только между операторами верхнего уровня (внутри обёртки `(function(){ … })();`): границы операторов
  берёт парсер acorn (node; путь — ACORN или /opt/npm-tools/node_modules/acorn). Если граница плана попадает внутрь
  оператора — ошибка, ничего не пишется.
- Комментарии над функцией/блоком уходят в тот же файл, что и она (граница поднимается над ними).
- План ниже — начало каждого куска (номер строки исходника) и имя по смыслу; номера файлов — по порядку с шагом 10.
После разрезки src/game.html больше не нужен: исходник игры — склейка src/game/* (src/gamesrc.py).
"""
import os, sys, json, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACORN = os.environ.get('ACORN', '/opt/npm-tools/node_modules/acorn')

# HTML-оболочка: (первая строка, имя файла). Код скрипта — от строки с «<script>» + 1 до строки «</script>» − 1.
HTML_HEAD = [(1, 'head.html'), (120, 'style.html'), (241, 'markup.html')]
HTML_TAIL = 'tail.html'

# JS: (строка начала, имя). Первая — открытие обёртки (function(){ ; последняя заканчивается })();
PLAN = [
    (447, 'map_zones_warp'),
    (687, 'map_navmesh_autowalls'),
    (999, 'map_walls_heights_cover_wallbang'),
    (1264, 'visibility'),
    (1502, 'nav_rebuild_paths'),
    (1918, 'zone_danger_user_zones'),
    (2171, 'weapons_bots_roam'),
    (2342, 'bal'),
    (2581, 'profiles_teams'),
    (2637, 'sites_spots'),
    (2873, 'post_routes'),
    (3111, 'bomb'),
    (3345, 'tactics_match_adapt'),
    (3529, 'named_spots_ct_setup'),
    (3770, 'lurker_probes_clear'),
    (4079, 'igl_replan'),
    (4269, 'tbrain'),
    (5138, 'save_retake'),
    (5496, 'team_intel_lkp_calls'),
    (5887, 'belief_reach'),
    (6032, 'know_hyp'),
    (6335, 'know_events_tick'),
    (6648, 'team_voice'),
    (6898, 'belief_tick'),
    (7028, 'look_prepeek_corners'),
    (7434, 'look_threat'),
    (7800, 'look_plan_smooth'),
    (8208, 'pos_pref_hold'),
    (8435, 'smoke_react'),
    (8605, 'roles_fallback_rebalance'),
    (8787, 'pro_positions'),
    (8870, 'pro_lineups_ct_early'),
    (9127, 'endgame_smoke_push'),
    (9363, 'ctbrain'),
    (10002, 'contact_reaction'),
    (10092, 'nades_buy_smoke_vision'),
    (10303, 'fire_nav_levels_ladders'),
    (10535, 'nades_throw'),
    (10768, 'nades_lineups'),
    (10973, 'nades_physics_damage'),
    (11189, 'nades_tactical_self'),
    (11460, 'nades_brains'),
    (11700, 'fov_roam'),
    (11777, 'voicepanel_console'),
    (11838, 'combat_items_knife'),
    (12094, 'sound_situations'),
    (12307, 'fight_cycle'),
    (12569, 'assist_flank_reload'),
    (12712, 'shoot'),
    (13046, 'decide_afterkill_cover'),
    (13387, 'engagements'),
    (13812, 'economy'),
    (14212, 'round_sides_match'),
    (14426, 'step_tick'),
    (15079, 'render_nav_zone_tools'),
    (15375, 'lineup_zone_editor'),
    (15853, 'maped_core_walls'),
    (16227, 'maped_heights'),
    (16571, 'maped_cover'),
    (16781, 'maped_wallbang'),
    (16927, 'vistool_lookdebug'),
    (17142, 'draw'),
    (17966, 'killfeed_banners_econ'),
    (18133, 'scoreboard_players'),
    (18319, 'marks_hook'),
    (18320, 'warmup'),
    (18405, 'observer'),
    (18636, 'sound_frame_buttons'),
]

NODE = r"""
const fs = require('fs'); const acorn = require(process.argv[1]);
const js = fs.readFileSync(0, 'utf8');
const ls = [0]; for (let i = 0; i < js.length; i++) if (js[i] === '\n') ls.push(i + 1);
const lineOf = p => { let lo = 0, hi = ls.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ls[m] <= p) lo = m; else hi = m - 1; } return lo; };
let body = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' }).body;
if (body.length !== 1) throw new Error('ожидалась одна обёртка (function(){…})()');
const w = body[0];
body = w.expression.callee.body.body;
console.log(JSON.stringify({ wrap: [lineOf(w.start), lineOf(w.end - 1)],
  st: body.map(s => [lineOf(s.start), lineOf(s.end - 1), s.start - ls[lineOf(s.start)], s.type]) }));
"""


def statements(lines, a, b):
    """Операторы внутри обёртки: [(первая, последняя строка исходника, 1-based)], обёртка."""
    js = ''.join(lines[a:b - 1]).replace('@@MAP@@', 'null   ')
    out = subprocess.run(['node', '-e', NODE, ACORN], input=js, capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    off = a + 1   # строка 0 скрипта = строка a+1 (1-based)
    return [(s + off, e + off, col, t) for s, e, col, t in d['st']], (d['wrap'][0] + off, d['wrap'][1] + off)


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    path = args[0] if args else os.path.join(ROOT, 'src', 'game.html')
    raw = open(path, 'rb').read()
    lines = raw.decode('utf-8').splitlines(keepends=True)
    strip = [l.rstrip('\r\n') for l in lines]
    a = strip.index('<script>') + 1             # 1-based строка «<script>»
    b = len(strip) - strip[::-1].index('</script>')   # 1-based строка «</script>»
    assert strip.count('<script>') == 1 and strip.count('</script>') == 1, 'больше одного <script> — план не про это'
    st, wrap = statements(lines, a, b)
    assert wrap == (a + 1, b - 1), ('обёртка не на своих строках', wrap)
    inside = set()           # строки, на которых граница запрещена (продолжение оператора)
    for s, e, col, t in st:
        for L in range(s + 1, e + 1): inside.add(L)
    starts = {s for s, e, col, t in st}
    multi = {s for s, e, col, t in st if col != 0}

    def snap(L):
        """Граница перед строкой L: поднять над комментариями прямо над ней (они — её шапка)."""
        if L == a + 1: return L
        assert L not in inside, ('граница внутри оператора', L)
        up = L in starts   # граница у самой функции/блока — шапку-комментарий забрать с собой; у баннера — как есть
        while up and L - 1 > a + 1 and strip[L - 2].lstrip().startswith(('//', '/*', '*')) and (L - 1) not in inside and (L - 1) not in starts:
            L -= 1
        assert L not in inside and L not in multi, ('граница внутри оператора', L)
        return L

    cuts = [(snap(L), name) for L, name in PLAN]
    for (l1, n1), (l2, n2) in zip(cuts, cuts[1:]):
        assert l1 < l2, ('план не по порядку', n1, n2)
    # куски: (имя файла, первая, последняя строка 1-based)
    parts = []
    hb = [L for L, _ in HTML_HEAD] + [a + 1]
    for i, (L, nm) in enumerate(HTML_HEAD):
        parts.append(('%03d_%s' % (i * 2, nm), L, hb[i + 1] - 1))
    ends = [L for L, _ in cuts[1:]] + [b]
    for i, ((L, nm), E) in enumerate(zip(cuts, ends)):
        parts.append(('%03d_%s.js' % (10 + i * 10, nm), L, E - 1))
    parts.append(('990_' + HTML_TAIL, b, len(lines)))
    # проверка: склейка == исходник
    glued = b''.join(''.join(lines[s - 1:e]).encode('utf-8') for _, s, e in parts)
    assert glued == raw, 'склейка не совпала с исходником'
    for nm, s, e in parts: print('%5d  %s' % (e - s + 1, nm))
    print('файлов:', len(parts), ' самый большой:', max(e - s + 1 for _, s, e in parts), 'строк')
    if '--dry' in sys.argv: return
    out = os.path.join(ROOT, 'src', 'game'); os.makedirs(out, exist_ok=True)
    assert not os.listdir(out), 'src/game/ не пуст'
    for nm, s, e in parts:
        open(os.path.join(out, nm), 'wb').write(''.join(lines[s - 1:e]).encode('utf-8'))


if __name__ == '__main__':
    main()
