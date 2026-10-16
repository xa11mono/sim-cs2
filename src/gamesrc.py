"""Исходник игры (v375) — одно место, откуда его читают все: склейка src/game/* в порядке имён (номер впереди).
Порядок важен: это порядок строк одного <script> (и разметки вокруг), склейка == прежний src/game.html байт в байт.

  from gamesrc import game_source;  s = game_source()
  python3 src/gamesrc.py [куда]   — записать склейку в файл (по умолчанию — в stdout), напр. для grep/diff по старому виду
"""
import os, sys

GAME_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game')


def game_files():
    return [os.path.join(GAME_DIR, f) for f in sorted(os.listdir(GAME_DIR)) if f.endswith(('.html', '.js'))]


def game_source():
    return b''.join(open(p, 'rb').read() for p in game_files()).decode('utf-8')


if __name__ == '__main__':
    s = game_source()
    if len(sys.argv) > 1: open(sys.argv[1], 'w', encoding='utf-8', newline='').write(s)
    else: sys.stdout.write(s)
