#!/usr/bin/env python3
"""Сущности карты из файла игры (А2, 20.10.2026): python3 tools/map3d/vpk_entities.py <de_карта.vpk> <карта>
Пишет data/maps/<карта>/geom3d/entities.json (единицы игры + координаты радара 0..2048):
  spawns_t / spawns_ct — точки появления (info_player_terrorist / info_player_counterterrorist): origin, angles, priority, enabled;
  solid_entities       — предметы со своей физикой (func_brush, prop_physics…, двери): класс, модель, origin, angles — для А3;
  bombsites            — зоны закладки (func_bomb_target): имя, по модели — коробка min/max (единицы игры), многоугольник XY;
  buyzones             — зоны закупки (func_buyzone), так же; all_classes — сколько сущностей каждого класса.
Как устроено: vpk → maps/<карта>/entities/*.vents_c (или вложенные «лампы» сущностей) → блок DATA = KV3 → m_entityKeyValues[]:
ключи — хешами MurmurHash2 (m_keyValuesData, версия 1) или KV3 (keyValues3Data); «щёточные» сущности ссылаются на модель
maps/<карта>/entities/…vmdl_c, её PHYS (KV3) даёт форму зоны."""
import sys, os, json, struct, io
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import kv3, vpk  # noqa
VPK, MAPN = sys.argv[1], sys.argv[2]
files, read = vpk.open_vpk(VPK)
NAME = {kv3.murmur2(s): s.lower() for s in json.load(open(os.path.join(HERE, 'known_strings.json')))}

def kv_blob(b):
    r = io.BytesIO(bytes(b)); u32 = lambda: struct.unpack('<I', r.read(4))[0]
    ver = u32(); assert ver == 1, ver
    nh, ns = u32(), u32(); out = {}
    def cstr():
        s = b''
        while True:
            c = r.read(1)
            if not c or c == b'\0': return s.decode('utf-8', 'replace')
            s += c
    def val():
        t = u32()
        if t == 6: return r.read(1) != b'\0'
        if t == 1: return struct.unpack('<f', r.read(4))[0]
        if t == 0x22: return struct.unpack('<d', r.read(8))[0]
        if t == 9: return list(r.read(4))
        if t == 5: return struct.unpack('<i', r.read(4))[0]
        if t == 0x25: return struct.unpack('<I', r.read(4))[0]
        if t == 0x21: return struct.unpack('<Q', r.read(8))[0]
        if t in (3, 0x27): return list(struct.unpack('<3f', r.read(12)))
        if t == 0x1e: return cstr()
        raise ValueError('тип поля %d' % t)
    for _ in range(nh):
        h = u32(); out[NAME.get(h, 'h%d' % h)] = val()
    for _ in range(ns):
        h = u32(); k = cstr(); out[k.lower()] = val()
    return out

def kv_kv3(o):
    out = {}
    for part in ('values', 'attributes'):
        for k, v in (o.get(part) or {}).items(): out[k.lower()] = v
    return out

ents = []
lumps = [f for f in files if f.startswith('maps/%s/entities/' % MAPN.join(['de_', ''])) and f.endswith('.vents_c')] or \
        [f for f in files if f.endswith('.vents_c')]
for f in sorted(lumps):
    data = kv3.parse(kv3.resource_blocks(read(f))['DATA'])
    for e in data.get('m_entityKeyValues', []):
        d = kv_kv3(e['keyValues3Data']) if 'keyValues3Data' in e else kv_blob(e['m_keyValuesData'])
        d['_lump'] = f; ents.append(d)

sys.path.insert(0, os.path.join(HERE, '..'))
try:
    import mapdir; g2m = mapdir.game_to_map(MAPN)
except Exception:
    g2m = None
def vec(s):
    if isinstance(s, (list, tuple)): return [float(x) for x in s]
    return [float(x) for x in str(s).split()]
def model_shape(model, origin):
    """форма «щёточной» сущности из её модели: все вершины PHYS + origin"""
    name = model if model.endswith('_c') else model + '_c'
    if name not in files: return None
    ph = kv3.resource_blocks(read(name)).get('PHYS')
    if ph is None: return None
    ph = kv3.parse(ph); pts = []
    for part in ph['m_parts']:
        for h in part['m_rnShape'].get('m_hulls', []):
            H = h['m_Hull']; vk = 'm_VertexPositions' if 'm_VertexPositions' in H else 'm_Vertices'
            pts.append(np.frombuffer(bytes(H[vk]), '<f4').reshape(-1, 3))
        for m in part['m_rnShape'].get('m_meshes', []):
            pts.append(np.frombuffer(bytes(m['m_Mesh']['m_Vertices']), '<f4').reshape(-1, 3))
    if not pts: return None
    P = np.concatenate(pts) + np.array(origin)
    lo, hi = P.min(0), P.max(0)
    # многоугольник XY — выпуклая оболочка вершин
    xy = np.unique(P[:, :2].round(1), axis=0)
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    pts2 = sorted(map(tuple, xy)); lower, upper = [], []
    for p in pts2:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(pts2):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    poly = lower[:-1] + upper[:-1]
    out = {'min': lo.round(1).tolist(), 'max': hi.round(1).tolist(), 'poly': [list(map(float, p)) for p in poly]}
    if g2m: out['poly_radar'] = [[round(float(c), 1) for c in g2m(x, y)] for x, y in poly]
    return out
def pt(e):
    o = vec(e.get('origin', '0 0 0')); r = {'origin': o, 'angles': vec(e.get('angles', '0 0 0'))}
    if g2m: r['radar'] = [round(float(c), 1) for c in g2m(o[0], o[1])]
    for k in ('targetname', 'priority', 'enabled', 'startdisabled'):
        if k in e: r[k] = e[k]
    return r
OUT = {'spawns_t': [pt(e) for e in ents if e.get('classname') == 'info_player_terrorist'],
       'spawns_ct': [pt(e) for e in ents if e.get('classname') == 'info_player_counterterrorist'],
       'bombsites': [], 'buyzones': [], 'all_classes': {}}
for cls, key in (('func_bomb_target', 'bombsites'), ('func_buyzone', 'buyzones')):
    for e in ents:
        if e.get('classname') != cls: continue
        r = pt(e); r['model'] = e.get('model'); sh = model_shape(str(e.get('model', '')), r['origin'])
        if sh: r.update(sh)
        if 'teamnum' in e: r['teamnum'] = e['teamnum']
        if 'heistbomb' in e: r['heistbomb'] = e['heistbomb']
        OUT[key].append(r)
# предметы-сущности со своей физикой (в world_physics их нет): двери, бочки, стулья, стёкла… — для А3 (форма — по модели, с поворотом)
SOLID_CLS = ('func_brush', 'prop_physics_multiplayer', 'prop_physics', 'prop_physics_override', 'prop_dynamic', 'prop_dynamic_override',
             'func_breakable', 'func_clip_vphysics', 'func_door', 'func_door_rotating', 'prop_door_rotating')
OUT['solid_entities'] = []
for e in ents:
    if e.get('classname') not in SOLID_CLS: continue
    r = pt(e); r['classname'] = e['classname']; r['model'] = e.get('model')
    for k in ('solid', 'startdisabled', 'disableshadows', 'targetname'):
        if k in e: r[k] = e[k]
    OUT['solid_entities'].append(r)
from collections import Counter
OUT['all_classes'] = dict(Counter(str(e.get('classname')) for e in ents).most_common())
dst = os.path.join(HERE, '..', '..', 'data', 'maps', MAPN, 'geom3d', 'entities.json'); os.makedirs(os.path.dirname(dst), exist_ok=True)
json.dump(OUT, open(dst, 'w'), ensure_ascii=False, indent=1)
print('сущностей %d; спавнов T %d, CT %d; зон закладки %d; закупки %d' % (len(ents), len(OUT['spawns_t']), len(OUT['spawns_ct']), len(OUT['bombsites']), len(OUT['buyzones'])))
