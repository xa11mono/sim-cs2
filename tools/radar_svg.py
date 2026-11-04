#!/usr/bin/env python3
"""Радар CS2 (.vtex_c, BGRA8888 + LZ4) → векторный SVG 4096×4096.

  pip install vtracer lz4 pillow numpy
  python3 tools/radar_svg.py <de_X_radar_psd.vtex_c> <out.svg> [--png out.png]

Как устроено:
  1) распаковка текстуры (формат 28 = BGRA8888, LZ4-блок после заголовков);
  2) слой «карта» (alpha ≥ 128): увеличение ×4 (Lanczos), цвета растягиваются
     линейно (LO..LO+140 → 0..255), чтобы трассировщик не слил слабые перепады
     (ступеньки лестниц), трассировка vtracer, цвета путей переводятся обратно;
  3) слой «сетка» (полупрозрачные метки вне карты): маска ×4 → бинарная
     трассировка, один цвет с прозрачностью.
"""
import re, sys, struct, argparse, tempfile, os
import numpy as np, lz4.block, vtracer
from PIL import Image, ImageFilter

def read_vtex(path):
    b = open(path, 'rb').read()
    nblk = struct.unpack_from('<I', b, 12)[0]
    data = None
    for i in range(nblk):
        p = 16 + i * 12
        if b[p:p+4] == b'DATA':
            off, size = struct.unpack_from('<II', b, p + 4)
            data = (p + 4 + off, size)
    o, size = data
    w, h, depth, fmt, mips = struct.unpack_from('<HHHBB', b, o + 20)
    assert fmt == 28 and mips == 1, f'формат {fmt}, мипов {mips} — не поддержано'
    raw = lz4.block.decompress(b[o + size:], uncompressed_size=w * h * 4)
    a = np.frombuffer(raw, np.uint8).reshape(h, w, 4)[:, :, [2, 1, 0, 3]].copy()
    return a

def body(f):
    s = open(f).read()
    return s[s.index('>', s.index('<svg')) + 1:s.rindex('</svg>')]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--png'); ap.add_argument('--scale', type=int, default=4)
    ap.add_argument('--alpha', type=int, default=128)
    g = ap.parse_args()
    a = read_vtex(g.src)
    if g.png: Image.fromarray(a, 'RGBA').save(g.png)
    H, W = a.shape[:2]; SC = g.scale; N = (W * SC, H * SC); al = a[..., 3]
    tmp = tempfile.mkdtemp()
    # слой «карта»
    LO, K = 10., 255 / 140.
    st = np.clip((a[..., :3].astype(float) - LO) * K, 0, 255).astype(np.uint8)
    rgb = np.array(Image.fromarray(st).resize(N, Image.LANCZOS))
    alu = np.array(Image.fromarray(al).resize(N, Image.BICUBIC))
    A = np.dstack([rgb, np.where(alu >= g.alpha, 255, 0).astype(np.uint8)])
    pa, sa = os.path.join(tmp, 'A.png'), os.path.join(tmp, 'A.svg')
    Image.fromarray(A, 'RGBA').save(pa)
    vtracer.convert_image_to_svg_py(pa, sa, colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=3, color_precision=8, layer_difference=1, corner_threshold=45,
        length_threshold=3.0, max_iterations=10, splice_threshold=45, path_precision=1)
    bA = re.sub(r'#([0-9A-Fa-f]{6})', lambda m: '#%02x%02x%02x' % tuple(
        min(255, int(round(int(m.group(1)[i:i+2], 16) / K + LO))) for i in (0, 2, 4)), body(sa))
    # слой «сетка»
    near = np.array(Image.fromarray(np.where(al >= g.alpha, 255, 0).astype(np.uint8))
                    .filter(ImageFilter.MaxFilter(5))) > 0
    fa = np.where(near, 0, al).astype(np.uint8)
    fu = np.array(Image.fromarray(fa).resize(N, Image.BICUBIC))
    pb, sb = os.path.join(tmp, 'B.png'), os.path.join(tmp, 'B.svg')
    Image.fromarray(np.where(fu >= 12, 0, 255).astype(np.uint8)).convert('RGB').save(pb)
    vtracer.convert_image_to_svg_py(pb, sb, colormode='binary', mode='spline', filter_speckle=1,
        corner_threshold=60, length_threshold=2.0, splice_threshold=45, path_precision=1)
    bB = re.sub(r'fill="[^"]*"', '', body(sb))
    sel = fa > 0; col = a[..., :3][sel].mean(0).astype(int); op = fa[sel].mean() / 255
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N[0]} {N[1]}" width="{N[0]}" height="{N[1]}">'
           f'<g id="grid" fill="rgb({col[0]},{col[1]},{col[2]})" fill-opacity="{op:.2f}">{bB}</g>'
           f'<g id="map">{bA}</g></svg>\n')
    open(g.out, 'w').write(svg)
    print(f'{g.out}: {len(svg)//1024} KB, путей {svg.count("<path")}')

if __name__ == '__main__':
    main()
