"""Directed navmesh entries into source-backed site volumes, for offline review."""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapdir
from demo_evidence import digest, geometry_inputs, preparation_path, revision
from demo_geometry import Geometry, inside


def polygon_edges(points):
    return zip(points, points[1:] + points[:1])


def side(a, b, p):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def segments_cross(a, b, c, d):
    def bounds_overlap(axis):
        return (max(min(a[axis], b[axis]), min(c[axis], d[axis]))
                <= min(max(a[axis], b[axis]), max(c[axis], d[axis])))
    return (bounds_overlap(0) and bounds_overlap(1)
            and side(a, b, c) * side(a, b, d) <= 0
            and side(c, d, a) * side(c, d, b) <= 0)


def overlaps(a, b):
    return (any(inside(*p, b) for p in a) or any(inside(*p, a) for p in b)
            or any(segments_cross(p, q, r, s) for p, q in polygon_edges(a) for r, s in polygon_edges(b)))


def area_surface(area):
    points = area['points']
    xy = [(p['x'], p['y']) for p in points]
    heights = [p.get('z') for p in points]
    if None in heights:
        if area.get('z') is None:
            return xy, None, 'missing'
        heights = [area['z']]
        method = 'area_mean'
    else:
        method = 'vertex_heights'
    return xy, [min(heights), max(heights)], method


def select_areas(geometry, polygon, z_bounds):
    """Keep partial and vertical-disjoint overlaps separate from the fully contained core."""
    lower, upper = z_bounds
    if len(polygon) < 3 or not all(math.isfinite(v) for p in polygon for v in p) or not lower < upper:
        raise ValueError('invalid site polygon or bounds')
    convex = all(side(u, v, p) >= 0 for u, v in polygon_edges(polygon) for p in polygon)
    core, boundary, other_heights = set(), set(), set()
    for area in geometry.areas.values():
        xy, heights, method = area_surface(area)
        if not overlaps(xy, polygon):
            continue
        ident = area['id']
        if heights is None or heights[1] < lower or heights[0] > upper:
            other_heights.add(ident)
        elif (heights[0] >= lower and heights[1] <= upper
              and convex and all(inside(*p, polygon) for p in xy)):
            # Core containment via vertices is sufficient only for a convex boundary.
            core.add(ident)
        else:
            boundary.add(ident)
    return core, boundary, other_heights


def approaches(geometry, core, boundary):
    """Record directed links into the core or boundary, with both endpoint heights."""
    edges = []
    for start, links in geometry.links.items():
        exits = links | {b for a, b in geometry.ladders if a == start}
        for end in sorted(exits):
            if (start in core or end not in core | boundary or start == end
                    or (start in boundary and end in boundary)):
                continue
            if end not in geometry.areas:
                raise ValueError(f'connection to missing area {end}')
            _, start_z, start_method = area_surface(geometry.areas[start])
            _, end_z, end_method = area_surface(geometry.areas[end])
            edges.append({
                'from': start, 'to': end, 'kind': geometry.transition(start, end),
                'fromZ': start_z, 'toZ': end_z, 'heightEvidence': [start_method, end_method],
                'membership': 'core_entry' if end in core else 'boundary_approach',
                'fromZone': geometry.zones.get(str(start)), 'toZone': geometry.zones.get(str(end)),
            })
    return sorted(edges, key=lambda e: (e['from'], e['to']))


def read_layout(name, spec_path):
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    directory = Path(mapdir.path(name))
    entity_path = directory / 'geom3d' / 'entities.json'
    inputs = geometry_inputs(name)
    local_revision = revision(inputs)
    entity_hash = digest(entity_path)
    if (spec['map'] != name or spec['geometryRevision'] != local_revision
            or spec['entitiesSha256'] != entity_hash):
        raise ValueError('site layout specification is for another map or geometry')
    entities = json.loads(entity_path.read_text(encoding='utf-8'))
    models = {x['model']: x for x in entities['bombsites'] if x.get('model')}
    zones = json.loads((directory / 'zones.json').read_text(encoding='utf-8'))
    by_zone = {z['id']: z for z in zones['zonemap']['zones']}
    geometry = Geometry(name)
    layers, memberships = {}, {}
    if not spec.get('sites'):
        raise ValueError('site layout specification must declare at least one labelled site')
    used_models = set()
    for site, selection in sorted(spec['sites'].items()):
        model = selection['triggerModel']
        if model in used_models or not selection.get('labelEvidence'):
            raise ValueError('site models must be unique and have label evidence')
        used_models.add(model)
        trigger = models[model]
        # Convert source-world XY exactly with the map recipe. The serialized entity
        # radar polygon is rounded and is retained independently in entities.json.
        polygon = [geometry.transform(*p) for p in trigger['poly']]
        signed_area = sum(side((0, 0), a, b) for a, b in polygon_edges(polygon))
        if signed_area == 0:
            raise ValueError('trigger polygon has zero area')
        if signed_area < 0:
            polygon.reverse()
        heights = [trigger['min'][2], trigger['max'][2]]
        core, boundary, other = select_areas(geometry, polygon, heights)
        if not (core or boundary):
            raise ValueError(f'{site}: trigger contains no estimable navigation areas')
        project = by_zone.get(selection.get('projectZoneId'))
        project_poly_raw = [(p['x'], p['y']) for p in project['points']] if project else None
        project_poly = [geometry.zone_transform(*p) for p in project_poly_raw] if project_poly_raw else None
        compatible_zone = overlaps(project_poly, polygon) if project_poly else None
        layers[site] = {
            'triggerModel': model, 'triggerTargetName': trigger.get('targetname'),
            'heightBoundsWorld': heights, 'triggerPolygonWorldXY': trigger['poly'],
            'triggerPolygonRadarXY': polygon, 'projectZoneId': selection.get('projectZoneId'),
            'projectZoneOverlapsTriggerXY': compatible_zone,
            'projectZoneRawOverlapsTriggerXY': overlaps(project_poly_raw, polygon) if project_poly_raw else None,
            'labelEvidence': selection['labelEvidence'],
            'coreAreas': sorted(core), 'boundaryAreas': sorted(boundary), 'otherHeightAreas': sorted(other),
            'directedApproaches': approaches(geometry, core, boundary),
        }
        if core:
            memberships[site] = sorted(core)
    return {'map': name, 'geometryRevision': local_revision, 'geometryInputs': inputs,
            'source': {'entitiesSha256': entity_hash, 'siteSpecSha256': digest(spec_path),
                       'semantics': 'Valve bomb trigger XY hull and Z bounds; authored zone overlap is diagnostic'},
            'edition': 'local_project_geometry', 'sites': memberships, 'layout': layers}


def main():
    name = mapdir.current()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--retake-layout', required=True, type=Path)
    parser.add_argument('--site-spec', required=True, type=Path)
    args = parser.parse_args()
    try:
        target = preparation_path(args.retake_layout)
        layout = read_layout(name, args.site_spec)
        with target.open('x', encoding='utf-8', newline='\n') as file:
            json.dump(layout, file, ensure_ascii=False, indent=2, allow_nan=False)
            file.write('\n')
    except (ValueError, KeyError, OSError, TypeError) as exc:
        parser.exit(1, f'{exc}\n')


if __name__ == '__main__':
    main()
