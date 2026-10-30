#!/usr/bin/env python3
"""Оптимизация медиатеки: растровые файлы → WebP (игроки 320px, команды/турниры 256px), дубликаты по хэшу → одна копия."""
import json, os, hashlib
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); M = os.path.join(ROOT, 'assets', 'media'); MAN = os.path.join(M, 'media-manifest.json')
man = json.load(open(MAN)); seen = {}
for kind, size in (('players', 320), ('teams', 256), ('tournaments', 256), ('news', 960)):
    for name, x in (man.get(kind) or {}).items():
        f = os.path.join(ROOT, x['file'])
        if not os.path.exists(f): continue
        h = hashlib.sha1(open(f, 'rb').read()).hexdigest()
        if h in seen and seen[h] != x['file']: os.remove(f); x['file'] = seen[h]; continue
        if f.endswith(('.png', '.jpg', '.jpeg', '.gif')):
            out = os.path.splitext(f)[0] + '.webp'; im = Image.open(f).convert('RGBA'); im.thumbnail((size, size)); im.save(out, 'WEBP', quality=84); os.remove(f)
            x['file'] = os.path.relpath(out, ROOT).replace(os.sep, '/')
        seen[h] = x['file']
json.dump(man, open(MAN, 'w'), ensure_ascii=False, indent=1)
open(os.path.join(M, 'media-manifest.js'), 'w').write('/* создано tools/media — не редактировать вручную */\nwindow.CS2_MEDIA = ' + json.dumps(man, ensure_ascii=False) + ';\n')
print('ok')
