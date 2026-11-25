#!/usr/bin/env python3
"""Make a measurement-only copy of a standard, built sim.html."""
import argparse
import re
from pathlib import Path

# MAP.radar is emitted on the opening line of the MAP declaration.
MAP = re.compile(rb'(?m)^[ \t]*var MAP = (\{[^\r\n]*)')
RADAR = re.compile(rb'(\"radar\"[ \t]*:[ \t]*\")data:image/png;base64,[A-Za-z0-9+/=]+(\")')
PORTRAITS = re.compile(rb'(?m)^([ \t]*var PLAYER_PHOTO = )\{[^\r\n]*\};')
PIXEL = b'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+hJLkAAAAASUVORK5CYII='


def lighten(page):
    matches = list(MAP.finditer(page))
    if len(matches) != 1:
        raise ValueError('Ожидалась одна декларация MAP обычной тестовой сборки')
    source = matches[0]
    radar, n_radars = RADAR.subn(rb'\g<1>data:image/png;base64,' + PIXEL + rb'\g<2>', source[1])
    if n_radars != 1:
        raise ValueError('Ожидалось одно встроенное изображение MAP.radar')
    copy = page[:source.start(1)] + radar + page[source.end(1):]
    copy, n_portraits = PORTRAITS.subn(rb'\g<1>{};', copy)
    if n_portraits != 1:
        raise ValueError('Ожидалась одна декларация PLAYER_PHOTO')
    return copy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('укажите отдельный файл для сборки замеров')
    source = args.source.read_bytes()
    copy = lighten(source)
    args.output.write_bytes(copy)
    print(f'{len(source)} → {len(copy)} байт HTML')


if __name__ == '__main__':
    main()
