#!/usr/bin/env python3
"""В2 (21.10.2026): геометрия столкновений карты → двоичный файл для физики гранат на JS (tools/nades/world.js).

python3 tools/nades/export_world.py ancient|mirage   → data/maps/<карта>/geom3d/nade_world.bin (в .gitignore, ≈ 10–40 МБ,
пересобирается за секунды из world_physics.npz).

Пишутся ВСЕ треугольники и блоки с номером группы столкновений; что из них останавливает гранату — решает world.js по
таблице групп (маска выбирается при загрузке, чтобы проверить варианты: playerclip, grenadeclip и т. п.).
Формат: 'NADW' u32 версия, u32 длина JSON, JSON {groups:[{as, exclude}], ntri, nhull, nplane}, затем
  tri:   ntri × 9 float32 (вершины), ntri × u8 группа, (выравнивание до 4)
  hull:  nhull × u32 начало плоскостей, nhull × u32 число плоскостей, nhull × u8 группа, (выравнивание),
         nplane × 4 float32 (nx, ny, nz, d: внутри n·p ≤ d), nhull × 6 float32 (охват: min xyz, max xyz)
  sky:   nsky × 9 float32 (небо — отдельно: граната от него отскакивает);
  surf:  ntri × u8, nhull × u8 — материал (номер в head.surf)."""
import json, os, struct, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')


def main(m):
    z = np.load(os.path.join(ROOT, 'data', 'maps', m, 'geom3d', 'world_physics.npz'))
    A = json.loads(str(z['attr_json']))
    V = z['mesh_v'].astype(np.float32); T = z['mesh_t']
    tri = V[T].reshape(-1, 9).astype(np.float32)
    tg = z['mesh_attr'].astype(np.uint8)
    hv = z['hull_v'].astype(np.float64); hn = z['hull_vn']; hp = z['hull_p'].astype(np.float64); pn = z['hull_pn']
    hv_off = np.concatenate([[0], np.cumsum(hn)]); hp_off = np.concatenate([[0], np.cumsum(pn)])
    # знак плоскостей — как в tools/map3d/raycast.py: центр блока «внутри» (n·c − d < 0)
    c = np.array([hv[hv_off[k]:hv_off[k + 1]].mean(0) for k in range(len(hn))]) if len(hn) else np.zeros((0, 3))
    hid = np.repeat(np.arange(len(pn)), pn)
    if len(hn):
        s = np.einsum('ij,ij->i', hp[:, :3], c[hid]) - hp[:, 3]
        if (s < 0).mean() < 0.5: hp = -hp
    hg = z['hull_attr'].astype(np.uint8)
    sky = (z['sky_v'][z['sky_t']].reshape(-1, 9).astype(np.float32)) if len(z['sky_t']) else np.zeros((0, 9), np.float32)
    head = {'map': m, 'groups': [{'as': [x.lower() for x in a.get('as', [])], 'exclude': [x.lower() for x in a.get('exclude', [])]}
                                  for a in A],
            'ntri': int(len(tri)), 'nhull': int(len(hn)), 'nplane': int(len(hp)), 'nsky': int(len(sky)),
            'surf': [str(x).lower() for x in z['surf_names']]}
    hj = json.dumps(head).encode()
    fo = os.path.join(ROOT, 'data', 'maps', m, 'geom3d', 'nade_world.bin')
    pad = lambda n: b'\0' * ((4 - n % 4) % 4)
    with open(fo, 'wb') as f:
        f.write(b'NADW' + struct.pack('<II', 1, len(hj)) + hj + pad(len(hj)))
        f.write(tri.tobytes()); f.write(tg.tobytes()); f.write(pad(len(tg)))
        f.write(hp_off[:-1].astype(np.uint32).tobytes()); f.write(pn.astype(np.uint32).tobytes())
        f.write(hg.tobytes()); f.write(pad(len(hg)))
        f.write(hp.astype(np.float32).tobytes())
        bb = np.array([np.r_[hv[hv_off[k]:hv_off[k + 1]].min(0), hv[hv_off[k]:hv_off[k + 1]].max(0)] for k in range(len(hn))],
                      np.float32).reshape(-1, 6)
        f.write(bb.tobytes()); f.write(sky.tobytes())
        ts = z['mesh_surf'].astype(np.uint8); hs = z['hull_surf'].astype(np.uint8)
        f.write(ts.tobytes()); f.write(hs.tobytes())
    print(fo, os.path.getsize(fo) >> 20, 'МБ', head['ntri'], 'треуг.', head['nhull'], 'блоков', head['nsky'], 'неба')


if __name__ == '__main__':
    main(sys.argv[1])
