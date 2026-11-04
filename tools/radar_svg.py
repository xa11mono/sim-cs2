#!/usr/bin/env python3
"""Радар CS2 (.vtex_c, BGRA8888 + LZ4) → векторный SVG 4096×4096.

  pip install vtracer lz4 pillow numpy scipy
  python3 tools/radar_svg.py <de_X_radar_psd.vtex_c> <out.svg> [--png out.png]

Как устроено:
  1) распаковка текстуры (формат 28 = BGRA8888, LZ4-блок после заголовков);
  2) слой «карта» (alpha ≥ 128) — плоские цвета с резкими краями, без теней и
     растушёвки: палитра = цвета «чистых» мест (цвет не меняется в 3×3) + центры
     цветных и тонких линий (поручни, обводки). Всё размытое (тени, переходы)
     получает цвет той соседней чистой области, на которую больше похоже, —
     граница встаёт посередине перехода. Затем ×4 и трассировка vtracer, цвета
     путей прижимаются к палитре;
  3) слой «сетка» (полупрозрачные метки вне карты): маска ×4 → бинарная
     трассировка, один цвет с прозрачностью.
"""
import re, sys, struct, argparse, tempfile, os
import numpy as np, lz4.block, vtracer
from PIL import Image, ImageFilter
from scipy import ndimage as nd

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

def rng(x,k):
  return np.max([nd.maximum_filter(x[...,c],k)-nd.minimum_filter(x[...,c],k) for c in range(3)],0)
def flatten(a,SC=4,FT=6,FK=5,K=24,K2=12,ST=100,R=5,AT=128,C=14,K3=16,MAJ=2):
  rgb=a[...,:3].astype(np.int16); al=a[...,3]
  op=nd.minimum_filter(al,FK)==255
  flat=(rng(rgb,FK)<=FT)&op
  hsv=np.array(Image.fromarray(a[...,:3]).convert('HSV')).astype(np.int16)
  sat=(hsv[...,1]>=ST)&(hsv[...,2]>=60)&(al==255)
  satc=sat&(hsv[...,1]>=nd.maximum_filter(hsv[...,1],3)-15)&~flat
  L=np.where(al>=128,rgb@np.array([30,59,11])/100.,255.)
  rid=np.zeros(L.shape,bool)
  for ax in (0,1):
    for d in (1,2):
      p=np.roll(L,d,ax); m=np.roll(L,-d,ax)
      p1=np.roll(L,max(d-1,0),ax) if d>1 else L
      # ridge of width<=d: centre vs both sides at distance d (for d=2 also neighbour d-1 similar)
      mx=(L-p>=C)&(L-m>=C); mn=(p-L>=C)&(m-L>=C)
      if d==2:
        mx&=(L>=np.roll(L,1,ax)-6)|(L>=np.roll(L,-1,ax)-6); mn&=(L<=np.roll(L,1,ax)+6)|(L<=np.roll(L,-1,ax)+6)
      rid|=mx|mn
  rid&=(al==255)&~flat
  def pal(px,k):
    q=Image.fromarray(px.astype(np.uint8).reshape(1,-1,3),'RGB').quantize(k,method=Image.Quantize.MEDIANCUT)
    p=np.array(q.getpalette()[:k*3]).reshape(-1,3); n=np.bincount(np.array(q).ravel(),minlength=k); return p[n>0]
  P=pal(rgb[flat],K)
  if satc.sum(): P=np.vstack([P,pal(rgb[satc],K2)])
  if rid.sum(): P=np.vstack([P,pal(rgb[rid&~satc],K3)])
  P=P.astype(np.float32)
  H,W=al.shape; N=(W*SC,H*SC)
  up=np.array(Image.fromarray(a[...,:3]).resize(N,Image.BICUBIC)).astype(np.float32)
  kn=np.array(Image.fromarray(((flat|satc|rid)*255).astype(np.uint8)).resize(N,Image.BILINEAR))>=128
  alu=np.array(Image.fromarray(al).resize(N,Image.BICUBIC))
  # nearest palette for known pixels
  lab=np.zeros(up.shape[:2],np.int16); best=np.full(up.shape[:2],1e12,np.float32)
  for i,c in enumerate(P):
    d=((up-c)**2).sum(-1); m=d<best; best[m]=d[m]; lab[m]=i
  # unknown: pick among palette colors present (known) within radius, the closest in color
  unk=~kn; rr=R*SC
  best2=np.full(up.shape[:2],1e12,np.float32); lab2=np.full(up.shape[:2],-1,np.int16)
  for i,c in enumerate(P):
    pres=kn&(lab==i)
    if not pres.any(): continue
    pres=nd.maximum_filter(pres,size=2*rr+1)&unk
    if not pres.any(): continue
    d=((up[pres]-c)**2).sum(-1); b=best2[pres]; m=d<b
    idx=np.flatnonzero(pres.ravel())[m]; best2.ravel()[idx]=d[m]; lab2.ravel()[idx]=i
  lab=np.where(unk,lab2,lab)
  lab[alu<AT]=-1
  miss=(lab==-1)&(alu>=AT)
  if miss.any():  # fallback: nearest by distance
    t=lab.copy(); t[miss]=-3; m2=t==-3
    _,(iy,ix)=nd.distance_transform_edt(m2,return_indices=True); lab=np.where(m2,t[iy,ix],lab)
  # фильтр большинства: убирает рваные края и одиночные пиксели
  ids=np.unique(lab)
  for _ in range(MAJ):
    best=np.zeros(lab.shape,np.float32); nl=lab.copy()
    for i in ids:
      f=nd.uniform_filter((lab==i).astype(np.float32),5); m=f>best; best[m]=f[m]; nl[m]=i
    lab=nl
  out=np.zeros(up.shape[:2]+(4,),np.uint8); o=lab>=0
  out[o,:3]=P[lab[o]].astype(np.uint8); out[o,3]=255
  return out,P
def body(f):
    s = open(f).read()
    return s[s.index('>', s.index('<svg')) + 1:s.rindex('</svg>')]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--png'); ap.add_argument('--flat-png'); ap.add_argument('--scale', type=int, default=4)
    g = ap.parse_args()
    a = read_vtex(g.src) if g.src.endswith('vtex_c') else np.array(Image.open(g.src).convert('RGBA'))
    if g.png: Image.fromarray(a, 'RGBA').save(g.png)
    H, W = a.shape[:2]; SC = g.scale; N = (W * SC, H * SC); al = a[..., 3]
    tmp = tempfile.mkdtemp()
    # слой «карта»: плоские цвета, резкие края
    F, P = flatten(a, SC=SC)
    if g.flat_png: Image.fromarray(F, 'RGBA').save(g.flat_png)
    pa, sa = os.path.join(tmp, 'A.png'), os.path.join(tmp, 'A.svg')
    Image.fromarray(F, 'RGBA').save(pa)
    vtracer.convert_image_to_svg_py(pa, sa, colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=3, color_precision=8, layer_difference=1, corner_threshold=60,
        length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=1)
    Pi = P.astype(int)
    def snap(m):
        c = np.array([int(m.group(1)[i:i+2], 16) for i in (0, 2, 4)])
        return '#%02x%02x%02x' % tuple(Pi[((Pi - c) ** 2).sum(1).argmin()])
    bA = re.sub(r'#([0-9A-Fa-f]{6})', snap, body(sa))
    # слой «сетка» (фон как в оригинале: полупрозрачные метки вне карты)
    near = np.array(Image.fromarray(np.where(al >= 128, 255, 0).astype(np.uint8))
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
    print(f'{g.out}: {len(svg)//1024} KB, путей {svg.count("<path")}, цветов {len(P)}')

if __name__ == '__main__':
    main()
