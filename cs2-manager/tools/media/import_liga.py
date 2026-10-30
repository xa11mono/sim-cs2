#!/usr/bin/env python3
"""Заполнение медиатеки CS2 Manager из локальной копии репозитория playliga/mods (GitHub, GPL-3.0).

Источник: базы модов «Real_CS_2026» и «Pro-Journey-Teams» связывают название команды с файлом
логотипа (Team.blazon) и ник игрока с фото (Player.avatar). Совпадение — по точному нормализованному
имени (без регистра и знаков), для команд — плюс известные варианты названий (Team Spirit ↔ Spirit).

Запуск:
  git clone --depth 1 https://github.com/playliga/mods.git /tmp/liga
  python3 tools/media/import_liga.py /tmp/liga [entities.json]
entities.json — {"teams": [...], "players": [...]} из игры; без него берутся все совпадения модов.
Результат: assets/media/{teams,players}/*, assets/media/media-manifest.json и media-manifest.js.
"""
import json, os, re, sqlite3, sys, shutil, hashlib, datetime
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'media')
MODS = ['Real_CS_2026', 'Pro-Journey-Teams']          # порядок = приоритет
ALIASES = {  # игра → варианты в модах
    'Team Spirit': ['Spirit'], 'Team Falcons': ['Falcons'], 'Team Vitality': ['Vitality'], 'Team Liquid': ['Liquid'],
    'NAVI': ['Natus Vincere', "NAVI"], 'FAZE': ['FaZe', 'FaZe Clan'], 'NIP': ['Ninjas in Pyjamas', 'NiP'], 'MOUZ': ['mousesports'],
    'Virtus.pro': ['Virtus pro', 'VP'], 'BC.GAME': ['BC Game', 'bc'], 'The MongolZ': ['MongolZ'], 'BETBOOM': ['BetBoom'],
    '100 Thieves': ['100T'], 'Eternal Fire': ['EF'], 'Lynn Vision': ['Lynn Vision Gaming'], 'Iberian Soul': ['IBS'],
}
norm = lambda s: re.sub(r'[^a-z0-9]', '', str(s).lower().replace('team ', '').replace('esports', '').replace('gaming', ''))
pnorm = lambda s: re.sub(r'[^a-z0-9]', '', str(s).lower())

def load(mods_dir):
    teams, players = {}, {}
    for m in MODS:
        base = os.path.join(mods_dir, 'mods', m, 'custom')
        db = os.path.join(base, 'saves', 'save_0.db')
        if not os.path.exists(db): continue
        c = sqlite3.connect(db)
        for name, blazon in c.execute('select name, blazon from Team'):
            if not blazon or not blazon.startswith('custom://'): continue
            f = os.path.join(base, blazon.replace('custom://', ''))
            if os.path.exists(f): teams.setdefault(norm(name), (name, f, m))
        for name, avatar, team, cc in c.execute('select p.name, p.avatar, t.name, co.code from Player p left join Team t on t.id = p.teamId left join Country co on co.id = p.countryId'):
            f = None
            if avatar and avatar.startswith('custom://'): f = os.path.join(base, avatar.replace('custom://', ''))
            else:
                for cand in (name, name.lower()):
                    p = os.path.join(base, 'avatars', cand + '.png')
                    if os.path.exists(p): f = p; break
            if f and os.path.exists(f): players.setdefault(pnorm(name), []).append((name, f, m, team or '', (cc or '').upper()))
    return teams, players

def sha(path):
    h = hashlib.sha1()
    with open(path, 'rb') as fh: h.update(fh.read())
    return h.hexdigest()[:12]

def main():
    mods_dir = sys.argv[1]
    ents = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
    T, P = load(mods_dir)
    for d in ('teams', 'players', 'players/full', 'tournaments', 'news', 'backgrounds', 'trophies', '.raw'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    man = {'v': 1, 'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sources': [{'id': 'liga', 'name': 'playliga/mods (LIGA Esports Manager mods)', 'url': 'https://github.com/playliga/mods', 'license': 'GPL-3.0 (репозиторий); логотипы и фото — материалы правообладателей'}],
           'teams': {}, 'players': {}, 'tournaments': {}, 'news': {}, 'missing': {'teams': [], 'players': []}}
    seen = {}
    want_t = ents['teams'] if ents else [v[0] for v in T.values()]
    for name in want_t:
        hit = T.get(norm(name)) or next((T.get(norm(a)) for a in ALIASES.get(name, []) if T.get(norm(a))), None)
        if not hit: man['missing']['teams'].append(name); continue
        src_name, f, mod = hit; ext = os.path.splitext(f)[1].lower(); h = sha(f)
        if h in seen: rel = seen[h]
        else:
            rel = f'teams/{pnorm(name) or h}.webp'
            raw = os.path.join(OUT, '.raw', f'teams-{pnorm(name) or h}{ext}'); shutil.copyfile(f, raw)
            seen[h] = rel
        man['teams'][name] = {'file': 'assets/media/' + rel, 'src': 'liga:' + mod, 'match': src_name}
    want_p = ents['players'] if ents else [v[0][0] for v in P.values()]
    meta = {x['nick']: x for x in (ents.get('playerMeta') or [])} if ents else {}
    for nick in want_p:
        cands, m_ = P.get(pnorm(nick)) or [], meta.get(nick, {})
        def score(c):  # тот же человек: страна обязана совпасть (если известна), команда — плюс
            if m_.get('country') and c[4] and c[4] != m_['country']: return -1
            return 2 * (norm(c[3]) == norm(m_.get('team', ''))) + (c[4] == m_.get('country'))
        cands = sorted([c for c in cands if score(c) >= 0], key=score, reverse=True)
        if not cands: man['missing']['players'].append(nick); continue
        src_name, f, mod = cands[0][:3]; h = sha(f)
        if h in seen: rel = seen[h]
        else:
            rel = f'players/{pnorm(nick)}.webp'
            raw = os.path.join(OUT, '.raw', f'players-{pnorm(nick)}{os.path.splitext(f)[1].lower()}'); shutil.copyfile(f, raw)
            seen[h] = rel
        man['players'][nick] = {'file': 'assets/media/' + rel, 'src': 'liga:' + mod, 'match': src_name}
    with open(os.path.join(OUT, 'media-manifest.json'), 'w') as fh: json.dump(man, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'media-manifest.js'), 'w') as fh: fh.write('/* создано tools/media — не редактировать вручную */\nwindow.CS2_MEDIA = ' + json.dumps(man, ensure_ascii=False) + ';\n')
    print('Дальше: node tools/media/process.mjs — обрезка, центрирование, оптимизация')
    print(f"teams: {len(man['teams'])}/{len(want_t)}  players: {len(man['players'])}/{len(want_p)}  files: {len(seen)}")
    print('missing teams:', ', '.join(man['missing']['teams']))

if __name__ == '__main__': main()
