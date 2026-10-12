#!/usr/bin/env python3
"""Прогон аудита поведения: python3 tools/measure/audit/run_audit.py <метка> [--sim=путь.html] [--matches=3,7] [--ticks=200000] [--jobs=2]
Делает из сборки копию с записывающими крючками (только запись, игра та же), играет матчи, кладёт JSON
в tools/measure/audit/runs/<метка>/aud_<матч>.json. Разбор — analyze.py."""
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
label = args[0] if args else 'audit'
sim = os.path.join(ROOT, 'sim.html'); matches = [3, 7, 11, 13, 17, 19]; ticks = 200000; jobs = 2; rec = 'audit_rec.js'; prefix = 'aud'
for a in sys.argv[1:]:
    if a.startswith('--sim='): sim = os.path.abspath(a.split('=', 1)[1])
    if a.startswith('--matches='): matches = [int(x) for x in a.split('=')[1].split(',')]
    if a.startswith('--ticks='): ticks = int(a.split('=')[1])
    if a.startswith('--jobs='): jobs = int(a.split('=')[1])
    if a.startswith('--rec='): rec = a.split('=', 1)[1]; prefix = os.path.splitext(os.path.basename(rec))[0]   # другая запись, напр. fight_rec.js
OUT = os.path.join(HERE, 'runs', label); os.makedirs(OUT, exist_ok=True)

# крючки: только вызов __AUD (запись) и метка источника у гипотезы «слышали здесь» (поле, которое игра не читает)
HOOKS = [
    ('reachOpen(team, hb.x, hb.y); lkpSet(team, eid, hb.x, hb.y, "sound");',
     'if(window.__AUD) __AUD.leak(team, eid, hb); reachOpen(team, hb.x, hb.y); lkpSet(team, eid, hb.x, hb.y, "sound");'),
    [('if(h.heard && zone){ h.x = s.x; h.y = s.y; h.zone = h.route[0] = zone; h.inView = false; h.htick = tick; }',
      'if(h.heard && zone){ h.x = s.x; h.y = s.y; h.zone = h.route[0] = zone; h.inView = false; h.htick = tick; h.src = opt.voice ? "voice" : "ear:" + b.id; }'),
     ('h.inView = false; h.htick = tick; h.voice = !!opt.voice; }',
      'h.inView = false; h.htick = tick; h.voice = !!opt.voice; h.src = opt.voice ? "voice" : "ear:" + b.id; }')],
    [('route: [zone], windows: [], weight: take, heard: true, htick: tick});',
      'route: [zone], windows: [], weight: take, heard: true, htick: tick, src: opt.voice ? "voice" : "ear:" + b.id});'),
     ('heard: true, htick: tick, voice: !!opt.voice});',
      'heard: true, htick: tick, voice: !!opt.voice, src: opt.voice ? "voice" : "ear:" + b.id});')],
    ('    var isNew = !ct.call || ct.call.site !== best.site;\n',
     '    var isNew = !ct.call || ct.call.site !== best.site;\n    if(window.__AUD) __AUD.call(best, isNew);\n'),
    ('    if(why) continue;   // не прозвучало',
     '    if(why){ if(window.__AUD && __AUD.vdrop) __AUD.vdrop(n, why, T); continue; }   // не прозвучало'),
]
src = open(sim, encoding='utf-8').read()
for h in HOOKS:
    alts = h if isinstance(h, list) else [h]   # варианты для версий кода до и после правок
    for a, b in alts:
        if src.count(a) == 1: src = src.replace(a, b); break
    else: sys.exit('крючок не найден ровно один раз: %s' % alts[0][0][:60])
aud_html = os.path.join(OUT, 'sim_audit.html'); open(aud_html, 'w', encoding='utf-8').write(src)
tpl = open(os.path.join(HERE, rec), encoding='utf-8').read()
for i in range(0, len(matches), jobs):
    ps = []
    for m in matches[i:i+jobs]:
        code = tpl.replace('__M__', str(m)).replace('__T__', str(ticks))
        fo = open(os.path.join(OUT, '%s_%d.json' % (prefix if prefix != 'audit_rec' else 'aud', m)), 'w')
        ps.append((subprocess.Popen(['timeout', '3600', 'node', os.path.join(ROOT, 'src', 'q.js'), aud_html, code], cwd=ROOT, stdout=fo), fo, m))
    for p, fo, m in ps:
        p.wait(); fo.close(); print('матч', m, 'готов, код', p.returncode, flush=True)
