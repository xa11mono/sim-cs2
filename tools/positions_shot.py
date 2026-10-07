#!/usr/bin/env python3
"""Картинки для проверки глазами: позиции и Setup'ы на радаре.

python3 tools/positions_shot.py [папка]      (по умолчанию tools/positions_shots/)

Читает src/data/positions.json и setups.json (их делает tools/positions_bake.py),
рисует поверх src/data/radar.png:
  points_CT.png / points_T.png — все точки стороны: залитый круг — standard,
      пустой — off, квадратик внутри — peek (держит из-за края укрытия);
      линия — луч взгляда до того, что закрывает обзор; жёлтый пунктир —
      кроссфайр-пара (только CT); размер круга — в скольких раундах стояли;
  ct_<id>.png — CT Setup: слоты с ролями (крупно), напарники по кроссфайру
      (жёлтая линия), запасные точки слотов (мелкие серые);
  t_<id>.png — T execute: гранаты по порядку (номер, тип, секунда от начала),
      вход и плант.
В игру не лезет, данные не меняет.
"""
import json, math, os, sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', 'positions_shots')
CROP = (150, 120, 1950, 1950)      # игровая часть карты (ед. 0..2048)
SCALE = 0.75                       # итоговая картинка ≈ 1350×1370

COL = {'CT': (70, 150, 255), 'T': (255, 170, 40)}
NADE = {'smoke': (220, 220, 220), 'flash': (255, 255, 120), 'molly': (255, 90, 40), 'he': (120, 255, 120)}
PAIR = (255, 230, 0)


def font(sz):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


F_S, F_M, F_L = font(15), font(19), font(26)


def base():
    im = Image.open(os.path.join(DATA, 'radar.png')).convert('RGB').resize((2048, 2048))
    im = Image.blend(im, Image.new('RGB', im.size, (0, 0, 0)), 0.35)   # притушить, чтобы метки читались
    return im, ImageDraw.Draw(im)


def save(im, name, title, lines):
    im = im.crop(CROP)
    im = im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    y = 8
    for i, t in enumerate([title] + lines):
        f = F_L if i == 0 else F_S
        d.text((10, y), t, font=f, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
        y += 32 if i == 0 else 20
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name))
    return os.path.join(OUT, name)


def text(d, x, y, t, f=F_S, fill=(255, 255, 255)):
    d.text((x, y), t, font=f, fill=fill, stroke_width=3, stroke_fill=(0, 0, 0))


def point(d, p, col, r=None, label=None, faint=False):
    r = r or (6 + min(p['rounds'], 40) / 3)
    x, y = p['x'], p['y']
    if faint:
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(130, 130, 130))
        return
    d.line([(x, y), (p['angle']['x'], p['angle']['y'])], fill=col, width=3)
    if p['type'] == 'standard':
        d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=(255, 255, 255), width=2)
    else:
        d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=4)
    if p.get('peek'):
        d.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(0, 0, 0))
    if label:
        text(d, x + r + 3, y - 10, label)


def dashed(d, a, b, col, w=3, step=14):
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    n = max(1, int(L / step))
    for i in range(0, n, 2):
        t0, t1 = i / n, min(1, (i + 1) / n)
        d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=col, width=w)


def short(pid):
    return pid.split('_', 1)[1]


def main():
    pos = json.load(open(os.path.join(DATA, 'positions.json'), encoding='utf-8'))
    st = json.load(open(os.path.join(DATA, 'setups.json'), encoding='utf-8'))
    P = {p['id']: p for p in pos['points']}
    made = []

    # все точки стороны
    for side in ('CT', 'T'):
        im, d = base()
        if side == 'CT':
            for pr in pos['pairs']:
                a, b = P[pr['a']], P[pr['b']]
                dashed(d, (a['x'], a['y']), (b['x'], b['y']), PAIR)
        ps = [p for p in pos['points'] if p['side'] == side]
        for p in ps:
            point(d, p, COL[side], label=short(p['id']))
        ns, no = sum(p['type'] == 'standard' for p in ps), sum(p['type'] == 'off' for p in ps)
        lines = ['%d точек: %d standard (залиты), %d off (пустые); чёрный квадрат — держит из-за края укрытия' % (len(ps), ns, no),
                 'линия — куда смотрит (до стены/края); размер — сколько раундов стояли (из %d)' % pos['rounds']]
        if side == 'CT':
            lines.append('жёлтый пунктир — кроссфайр-пары (%d)' % len(pos['pairs']))
        made.append(save(im, 'points_%s.png' % side, 'Позиции %s — Ancient, демки про' % side, lines))

    # CT Setup'ы
    for s in st['ct']:
        im, d = base()
        for p in pos['points']:
            if p['side'] == 'CT':
                point(d, p, None, faint=True)
        slot_pts = {sl['role']: P[sl['point']] for sl in s['slots']}
        for sl in s['slots']:
            if sl['pairWith'] and sl['pairWith'] in slot_pts:
                a, b = slot_pts[sl['role']], slot_pts[sl['pairWith']]
                d.line([(a['x'], a['y']), (b['x'], b['y'])], fill=PAIR, width=5)
        for sl in s['slots']:
            point(d, P[sl['point']], COL['CT'], r=16, label='%s (%s)' % (sl['role'], short(sl['point'])))
        sp = s['split']
        made.append(save(im, '%s.png' % s['id'], 'CT Setup «%s»: A %d / мид %d / B %d' % (s['name'], sp['A'], sp['mid'], sp['B']),
                         ['%d раундов из демок (%d %%); серые — остальные CT-точки (запасные для выбора по роли)'
                          % (s['rounds'], round(s['share'] * 100)),
                          'жёлтая линия — кроссфайр-напарники в этом Setup']))

    # T execute
    sites = {}
    for e in st['t']:
        im, d = base()
        k = 0
        for stp in e['steps']:
            if stp['action'].startswith('throw_'):
                k += 1
                typ = stp['action'][6:]
                x, y = stp['at']
                c = NADE.get(typ, (255, 255, 255))
                d.ellipse([x - 26, y - 26, x + 26, y + 26], outline=c, width=4)
                text(d, x - 7, y - 12, str(k), F_M, c)
                text(d, x + 28, y - 10, '%s %.1fс' % (typ, stp['sec']), F_S, c)
        lines = []
        k = 0
        for stp in e['steps']:
            if stp['action'].startswith('throw_'):
                k += 1
                dep = stp['dependsOn']
                lines.append('%d. %s → %s, %.1f с, в %d %% раундов%s' % (
                    k, stp['action'][6:], stp['target'], stp['sec'], round(stp['share'] * 100),
                    ' (после смока %s)' % dep['afterSmokeLands'] if 'afterSmokeLands' in dep else ''))
            elif stp['actor'] == 'entry':
                lines.append('вход на %s: %.1f с (не позже %.1f с после последней флешки)' % (
                    stp['target'], stp['sec'], stp['dependsOn'].get('maxDelayTicks', 0) / 64))
            elif stp['actor'] == 'bomb':
                lines.append('плант: %.1f с от начала execute' % stp['sec'])
            elif stp['actor'] == 'lurker':
                lines.append('люркер (необязательно, в %d %% раундов): %s' % (round(stp['share'] * 100), stp['target']))
        tm = e['timing']
        lines.append('начало execute ≈ %.0f-я с раунда, плант ≈ %.0f-я с; %d раундов (%d %% плантов)'
                     % (tm['startSec'], tm['plantSec'], e['rounds'], round(e['share'] * 100)))
        made.append(save(im, '%s.png' % e['id'], 'T execute: %s, маршрут %s' % (e['site'], e['route']), lines))
    print('\n'.join(made))


if __name__ == '__main__':
    main()
