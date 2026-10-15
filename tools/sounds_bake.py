#!/usr/bin/env python3
"""Звуки страницы (v329, М46; v331 — новый пак): data/sounds/src/*.wav → data/sounds/sounds.json (MP3 моно 22 кГц, base64).

python3 tools/sounds_bake.py
Источник — пак, сделанный на заказ для владельца (15.10, v331: «похожие на CS2», имена — как в игре по просьбе владельца),
см. data/sounds/README.md. Ключ — имя файла без .wav: <ОРУЖИЕ>_1/_2 (варианты), <ОРУЖИЕ>_far (издалека), n_* гранаты,
c4_* бомба, step_* шаги; какое событие каким звуком играет — src/game.html (snd*). Длиннее MAX_SEC — обрезается с затуханием.
Вставляет в опубликованную страницу src/mkpub.py (в sim.html для замеров звуки не нужны).
"""
import base64, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'sounds', 'src')
OUT = os.path.join(ROOT, 'data', 'sounds', 'sounds.json')
KBPS = '48k'               # MP3 48 кбит/с моно 22 кГц — выстрел ~10 КБ; проектное число (размер страницы ↔ качество)
MAX_SEC, FADE = 4.0, 0.6   # дым шипит 14 с — на странице 4 с с затуханием 0,6 с; проектные числа (размер страницы)


def main():
    out = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.wav'):
            continue
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SRC, f), '-t', str(MAX_SEC),
                            '-af', 'afade=t=out:st=%.2f:d=%.2f' % (MAX_SEC - FADE, FADE), '-ac', '1', '-ar', '22050', '-b:a', KBPS,
                            '-f', 'mp3', '-'], capture_output=True)
        if r.returncode:
            sys.exit('ffmpeg: ' + f + ' ' + r.stderr.decode()[:200])
        out[f[:-4]] = base64.b64encode(r.stdout).decode()
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    print('записано %s: звуков %d, %.0f КБ' % (os.path.relpath(OUT, ROOT), len(out), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
