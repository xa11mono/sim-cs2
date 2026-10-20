#!/usr/bin/env python3
"""Геометрия столкновений карты из файла игры: python3 tools/map3d/vpk_physics.py <de_карта.vpk> <карта>
Пишет data/maps/<карта>/geom3d/world_physics.npz (единицы игры, как в демках):
  mesh_v, mesh_t, mesh_id   — треугольные сетки (вершины, треугольники, номер сетки у треугольника);
  mesh_attr, mesh_surf      — у каждого треугольника: группа столкновений (номер в attr_json) и материал поверхности (номер в surf_names);
  hull_v / hull_vn, hull_p / hull_pn — выпуклые блоки (вершины и их число на блок; плоскости n·p = d и их число);
  hull_attr, hull_surf      — то же у каждого блока;
  sky_v, sky_t              — «небо» (группа с тегом sky): взгляд и пули его не касаются, гранаты отскакивают (владелец 20.10);
  attr_json                 — группы столкновений: [{group, as: [теги «чем является»], with: [с чем сталкивается], exclude: [...]}];
  surf_names                — названия материалов поверхности (хеши m_surfacePropertyHashes → имена по списку известных строк Source 2).
Рядом — phys_attrs.json: сводка (сколько треугольников / площади / блоков у каждой группы и материала).
Как устроено (А2, 20.10.2026; заменяет прежний поиск блобов по размерам): vpk (tools/map3d/vpk.py) → maps/<карта>/world_physics.vmdl_c →
блок PHYS = двоичный KV3 (tools/map3d/kv3.py) → m_parts[].m_rnShape: m_hulls[] / m_meshes[] (у каждого m_nCollisionAttributeIndex,
m_nSurfacePropertyIndex; у сетки m_Materials — материал по треугольникам), m_collisionAttributes, m_surfacePropertyHashes."""
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import kv3, vpk  # noqa
VPK, MAPN = sys.argv[1], sys.argv[2]
OUT = os.path.join(HERE, '..', '..', 'data', 'maps', MAPN, 'geom3d')
files, read = vpk.open_vpk(VPK)
base = os.path.basename(VPK)[:-4]
phys = kv3.parse(kv3.resource_blocks(read('maps/%s/world_physics.vmdl_c' % base))['PHYS'])
KNOWN = json.load(open(os.path.join(HERE, 'known_strings.json')))
NAME = {kv3.murmur2(s): s for s in KNOWN}
surf_names = [NAME.get(int(h), 'unknown_%d' % int(h)) for h in phys.get('m_surfacePropertyHashes', [])] or ['default']
attrs = []
for a in phys.get('m_collisionAttributes', []):
    attrs.append({'group': a.get('m_CollisionGroupString', ''), 'as': a.get('m_InteractAsStrings', []) or a.get('m_PhysicsTagStrings', []),
                  'with': a.get('m_InteractWithStrings', []), 'exclude': a.get('m_InteractExcludeStrings', [])})
f32 = lambda b, w: np.frombuffer(bytes(b), dtype='<f4').reshape(-1, w) if isinstance(b, (bytes, bytearray)) else np.array(b, np.float32).reshape(-1, w)
hulls, meshes = [], []
for part in phys['m_parts']:
    sh = part['m_rnShape']
    for h in sh.get('m_hulls', []):
        H = h['m_Hull']; vk = 'm_VertexPositions' if 'm_VertexPositions' in H else 'm_Vertices'
        hulls.append((f32(H[vk], 3), f32(H['m_Planes'], 4), h.get('m_nCollisionAttributeIndex', 0), h.get('m_nSurfacePropertyIndex', 0)))
    for m in sh.get('m_meshes', []):
        M = m['m_Mesh']; v = f32(M['m_Vertices'], 3)
        t = np.frombuffer(bytes(M['m_Triangles']), dtype='<i4').reshape(-1, 3) if isinstance(M['m_Triangles'], (bytes, bytearray)) else np.array(M['m_Triangles']).reshape(-1, 3)
        mat = M.get('m_Materials')
        mat = (np.frombuffer(bytes(mat), np.uint8).astype(np.int32) if isinstance(mat, (bytes, bytearray)) else np.array(mat, np.int32)) if mat is not None and len(mat) else None
        surf = mat if mat is not None and len(mat) == len(t) else np.full(len(t), m.get('m_nSurfacePropertyIndex', 0), np.int32)
        meshes.append((v, t, m.get('m_nCollisionAttributeIndex', 0), surf))
# «небо» — по группе столкновений (тег sky); прежний признак «выше 900 и шире 3000» ошибочно забирал сюда и playerclip над крышами
sky = [k for k, m in enumerate(meshes) if 'sky' in [x.lower() for x in attrs[m[2]]['as']]] if attrs else \
      [k for k, (v, t, a, s) in enumerate(meshes) if v[:, 2].max() > 900 and np.ptp(v[:, 0]) > 3000]
keep = [m for k, m in enumerate(meshes) if k not in sky]
os.makedirs(OUT, exist_ok=True); off = np.cumsum([0] + [len(m[0]) for m in keep])
cat = lambda xs, empty: np.concatenate(xs) if xs else empty
np.savez_compressed(os.path.join(OUT, 'world_physics.npz'),
    mesh_v=np.concatenate([m[0] for m in keep]).astype(np.float32),
    mesh_t=np.concatenate([m[1] + off[k] for k, m in enumerate(keep)]).astype(np.int32),
    mesh_id=np.concatenate([np.full(len(m[1]), k, np.int16) for k, m in enumerate(keep)]),
    mesh_attr=np.concatenate([np.full(len(m[1]), m[2], np.int16) for m in keep]),
    mesh_surf=np.concatenate([m[3] for m in keep]).astype(np.int16),
    hull_v=np.concatenate([h[0] for h in hulls]).astype(np.float32), hull_vn=np.array([len(h[0]) for h in hulls], np.int32),
    hull_p=np.concatenate([h[1] for h in hulls]).astype(np.float32), hull_pn=np.array([len(h[1]) for h in hulls], np.int32),
    hull_attr=np.array([h[2] for h in hulls], np.int16), hull_surf=np.array([h[3] for h in hulls], np.int16),
    sky_v=cat([meshes[k][0] for k in sky], np.zeros((0, 3))).astype(np.float32),
    sky_t=cat([meshes[k][1] + sum(len(meshes[j][0]) for j in sky[:n]) for n, k in enumerate(sky)], np.zeros((0, 3))).astype(np.int32),
    attr_json=np.array(json.dumps(attrs, ensure_ascii=False)), surf_names=np.array(surf_names))
# сводка
S = {'группы': [], 'материалы': {}}
for i, a in enumerate(attrs):
    tri = [(m[0], m[1]) for m in keep if m[2] == i]
    area = sum(float(0.5 * np.linalg.norm(np.cross(v[t[:, 1]] - v[t[:, 0]], v[t[:, 2]] - v[t[:, 0]]), axis=1).sum()) for v, t in tri)
    S['группы'].append(dict(a, i=i, треугольников=int(sum(len(t) for v, t in tri)), площадь=round(area), блоков=sum(1 for h in hulls if h[2] == i)))
ms = np.concatenate([m[3] for m in keep]); ma = np.concatenate([np.full(len(m[1]), m[2]) for m in keep])
for j, nm in enumerate(surf_names):
    S['материалы'][nm] = {'треугольников': int((ms == j).sum()), 'блоков': sum(1 for h in hulls if h[3] == j),
                          'по группам (треуг.)': {str(int(g)): int(((ms == j) & (ma == g)).sum()) for g in np.unique(ma[ms == j])}}
S['сетки'] = [{'k': k, 'группа': m[2], 'треугольников': len(m[1]), 'небо': k in sky} for k, m in enumerate(meshes)]
json.dump(S, open(os.path.join(OUT, 'phys_attrs.json'), 'w'), ensure_ascii=False, indent=1)
print('блоков %d, сеток %d (небо: %s), треугольников %d; групп %d, материалов %d' % (len(hulls), len(keep), sky, sum(len(m[1]) for m in keep), len(attrs), len(surf_names)))
