#!/usr/bin/env python3
"""Звуки страницы (v329, М46): data/sounds/src/*.wav → data/sounds/sounds.json (MP3 моно 22 кГц, base64).

python3 tools/sounds_bake.py
Источник — набор владельца из его другого проекта (15.10: «похожие на CS2, не из игры»), см. data/sounds/README.md.
Ключ — имя файла без .wav; какое оружие / событие каким звуком играет — SND_MAP в src/game.html.
Вставляет в опубликованную страницу src/mkpub.py (в sim.html для замеров звуки не нужны).
"""
import base64, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'sounds', 'src')
OUT = os.path.join(ROOT, 'data', 'sounds', 'sounds.json')
KBPS = '48k'   # MP3 48 кбит/с моно 22 кГц — выстрел ~10 КБ; проектное число (размер страницы ↔ качество)


def main():
    out = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.wav'):
            continue
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, f), '-ac', '1', '-ar', '22050', '-b:a', KBPS,
                            '-f', 'mp3', '-'], capture_output=True)
        if r.returncode:
            sys.exit('ffmpeg: ' + f + ' ' + r.stderr.decode()[:200])
        out[f[:-4]] = base64.b64encode(r.stdout).decode()
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    print('записано %s: звуков %d, %.0f КБ' % (os.path.relpath(OUT, ROOT), len(out), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
