"""Картинки расстановок CT для владельца (15.11): радар, где стоят CT-боты на 20-й секунде и куда смотрят (черта), входы T (зелёный — его
видит хотя бы один CT, красный — никто; мерка игры portalWatched), где на этой структуре стоят CT у про (мелкие точки). Данные —
tools/ct_cover.js (боты, входы) и tools/ct_cover_pro.py (про). Один снимок бота на расстановку (первый раунд) + доля раундов, где вход закрыт.
Запуск: python3 tools/ct_setup_shot.py --map mirage --cov=<ct_cover.json> --pro=<ct_cover_pro.json> --out=<папка>"""
import sys, os, json, math
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
MAP = mapdir.current()
arg = lambda k: next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--' + k + '=')), None)
ST = {'ctStd_221': '2-2-1', 'ctStd_212': '2-1-2', 'ctRot_131': '1-3-1', 'ctStack_311': '3-1-1', 'ctStd_122': '1-2-2',
      'ctStack_302': '3-0-2', 'ctStack_401': '4-0-1', 'ctStack_203': '2-0-3'}   # структура расстановки у про (ctshare.json struct)


def font(n):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()


def main():
    C = json.load(open(arg('cov'))); P = json.load(open(arg('pro'))); out = arg('out'); os.makedirs(out, exist_ok=True)
    try: ST.update(json.load(open(mapdir.path(MAP, 'ctshare.json'), encoding='utf-8'))['struct'])
    except Exception: pass
    base = Image.open(mapdir.path(MAP, 'radar.png')).convert('RGB'); W = 1400; k = W / 2048.0
    base = base.resize((W, W)); F = font(18); Fs = font(14); E = C['ent']
    for sid in dict.fromkeys(b['setup'] for b in C['bot']):
        B = [b for b in C['bot'] if b['setup'] == sid]; st = ST.get(sid, '?')
        im = base.copy(); d = ImageDraw.Draw(im, 'RGBA')
        for r in P['rounds']:
            if r['st'] != st: continue
            for p in r['ct']: d.ellipse([p[0]*k-2, p[1]*k-2, p[0]*k+2, p[1]*k+2], fill=(240, 189, 98, 70))
        share = [sum(1 for b in B if b['cov'][i]) / len(B) for i in range(len(E))]
        for i, e in enumerate(E):
            x, y = e['x']*k, e['y']*k; col = (90, 210, 110, 235) if B[0]['cov'][i] else (235, 70, 60, 235)
            d.ellipse([x-9, y-9, x+9, y+9], outline=col, width=4); d.text((x+11, y-9), '%s %d%%' % (e['from'][:12], round(100*share[i])), fill=(255, 255, 255, 230), font=Fs)
        for c in B[0]['ct']:
            x, y = c['x']*k, c['y']*k; L = 70
            d.line([x, y, x + math.cos(c['f'])*L, y + math.sin(c['f'])*L], fill=(143, 192, 239, 255), width=4)
            d.ellipse([x-8, y-8, x+8, y+8], fill=(143, 192, 239, 255), outline=(10, 20, 30, 255), width=2)
            d.text((x+10, y+6), '%s %s' % (c['id'], (c['tag'] or '').split(':')[-1][:10]), fill=(255, 255, 255, 255), font=Fs)
        n = sum(1 for v in B[0]['cov'] if v)
        d.rectangle([0, 0, W, 56], fill=(10, 12, 10, 200))
        d.text((12, 6), '%s  (%s) — 20-я с, раунд %d' % (B[0]['name'], sid, B[0]['round']), fill=(255, 255, 255, 255), font=F)
        d.text((12, 30), 'входов закрыто %d из %d (зелёный — видит CT; %% — доля из %d раундов); мелкие точки — CT у про на %s' % (n, len(E), len(B), st),
               fill=(220, 220, 220, 255), font=Fs)
        f = os.path.join(out, '%s.png' % sid); im.save(f); print(f, n, '/', len(E))


if __name__ == '__main__':
    main()
