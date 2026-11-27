"""Offline coordinate checks against the navigation data of one map revision."""
import json
import math
from collections import defaultdict

import mapdir


def inside(x, y, points):
    """Closed polygon, including an exactly sampled boundary."""
    hit = False
    for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
        if ((x - ax) * (by - ay) == (y - ay) * (bx - ax)
                and min(ax, bx) <= x <= max(ax, bx) and min(ay, by) <= y <= max(ay, by)):
            return True
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def zone_transform(name):
    """Apply the baseline zone layer from the runtime, without browser overrides."""
    with open(mapdir.path(name, 'map.json'), encoding='utf-8') as file:
        layer = json.load(file)['zoneLayer']
    scale, dx, dy = (layer[k] for k in ('scale', 'dx', 'dy'))
    if not all(math.isfinite(v) for v in (scale, dx, dy)) or scale <= 0:
        raise ValueError('invalid zone layer transform')
    return lambda x, y: (1024 + (x - 1024) * scale + dx, 1024 + (y - 1024) * scale + dy)


def floor_z(x, y, points, mean):
    """Interpolate the triangles of a nav polygon when vertex Z is available."""
    if any(p.get('z') is None for p in points):
        return mean
    a = points[0]
    for b, c in zip(points[1:], points[2:]):
        ux, uy = b['x'] - a['x'], b['y'] - a['y']
        vx, vy = c['x'] - a['x'], c['y'] - a['y']
        det = ux * vy - uy * vx
        if not det:
            continue
        dx, dy = x - a['x'], y - a['y']
        u, v = (dx * vy - dy * vx) / det, (ux * dy - uy * dx) / det
        if u >= 0 and v >= 0 and u + v <= 1:
            return a['z'] + u * (b['z'] - a['z']) + v * (c['z'] - a['z'])
    return mean


class Geometry:
    def __init__(self, name, site_areas=None, site_layout=None):
        radar = mapdir.radar(name)
        if not all(math.isfinite(radar[k]) for k in ('pos_x', 'pos_y', 'scale')) or radar['scale'] <= 0:
            raise ValueError('invalid map radar transform')
        self.transform = mapdir.game_to_map(name)
        self.zone_transform = zone_transform(name)
        with open(mapdir.path(name, 'navmesh.json'), encoding='utf-8') as f:
            nav = json.load(f)
        with open(mapdir.path(name, 'zones.json'), encoding='utf-8') as f:
            zones = json.load(f)
        self.zones = zones.get('navZone', {})
        self.polygons = {s: ([self.zone_transform(*p) for p in xy], 'plant_polygon_xy_proxy')
                         for s, xy in zones.get('sites', {}).items() if xy}
        # Same site-role convention as the runtime, used only for a projected observation.
        for zone in zones.get('zonemap', {}).get('zones', ()):
            role = zone.get('name', '')
            if role.endswith('site') and len(zone.get('points', ())) >= 3:
                self.polygons.setdefault(role.removesuffix('site'), (
                    [self.zone_transform(p['x'], p['y']) for p in zone['points']], 'site_zone_xy_proxy'))
        self.areas = {a['id']: a for a in nav['areas']}
        if not self.areas or len(self.areas) != len(nav['areas']):
            raise ValueError('missing or duplicate nav areas')
        self.links = {a['id']: set(a['conn']) for a in nav['areas']}
        self.ladders = set()
        for ladder in nav.get('ladders', []):
            for bottom in ladder['below']:
                for top in ladder['above']:
                    if bottom not in self.areas or top not in self.areas:
                        raise ValueError('ladder references unknown nav area')
                    self.ladders.update(((bottom, top), (top, bottom)))
        self.site_areas = site_areas or {}
        self.site_layout = site_layout or {}
        if any(not ids or set(ids) - self.areas.keys() for ids in self.site_areas.values()):
            raise ValueError('site annotation references missing nav areas')
        if sum(map(len, self.site_areas.values())) != len(set().union(*self.site_areas.values())):
            raise ValueError('overlapping site area annotations')
        self.cell = 2048 / math.sqrt(len(self.areas))  # search index; radar convention from mapdir
        self.index = defaultdict(list)
        for a in nav['areas']:
            p = [(v['x'], v['y']) for v in a['points']]
            if len(p) < 3 or not all(math.isfinite(v) for point in p for v in point):
                raise ValueError('invalid nav polygon')
            if a.get('z') is not None and not math.isfinite(a['z']):
                raise ValueError('invalid nav height')
            for x in range(math.floor(min(v[0] for v in p) / self.cell),
                           math.floor(max(v[0] for v in p) / self.cell) + 1):
                for y in range(math.floor(min(v[1] for v in p) / self.cell),
                               math.floor(max(v[1] for v in p) / self.cell) + 1):
                    self.index[x, y].append((a, p))

    def point(self, X, Y, Z):
        x, y = self.transform(X, Y)
        areas = [(a['id'], floor_z(x, y, a['points'], a.get('z'))) for a, p in
                 self.index.get((math.floor(x / self.cell), math.floor(y / self.cell)), ())
                 if inside(x, y, p)]
        areas.sort(key=lambda a: (abs(Z - a[1]) if a[1] is not None else math.inf, a[0]))
        # Preserve every XY candidate. Distance to nav floor is evidence, not proof of support.
        return [x, y], areas

    def transition(self, left, right):
        if (left, right) in self.ladders:
            return 'ladder_link'
        if right in self.links.get(left, ()):
            return 'nav_link'
        return 'unsampled_or_unlinked'

    def site(self, site, xy, candidates, revision_verified, world_z=None):
        if not candidates:
            return None
        ids = self.site_areas.get(site)
        if ids and revision_verified:
            if candidates[0][1] is None:
                return None
            # Refuse a floor assignment for multiple overlapping polygons.
            # Same-floor adjacent areas can meet exactly at their boundary.
            floors = {z for _, z in candidates}
            if None in floors or len(floors) != 1:
                return None
            membership = {a in ids for a, _ in candidates}
            if len(membership) != 1:
                return None
            belongs = membership.pop()
            if site in self.site_layout:
                lo, hi = self.site_layout[site]['heightBoundsWorld']
                if world_z is None:
                    return None
                return 'nav_area_and_trigger_height', belongs and lo <= world_z <= hi
            return 'nav_area', belongs
        if site not in self.polygons or len(candidates) != 1:
            return None
        points, method = self.polygons[site]
        return method, inside(*xy, points)
