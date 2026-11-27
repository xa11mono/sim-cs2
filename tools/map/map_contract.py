"""Optional runtime data contract at map-check/package admission."""
import json
import math
from pathlib import Path
import sys


TYPES = {'object': dict, 'array': list, 'string': str, 'number': (int, float)}


def problem(data, field):
    missing = object()
    value = data
    for part in field['key'].split('.') if field['key'] else ():
        value = value.get(part, missing) if isinstance(value, dict) else missing
        if value is missing:
            return None if field.get('optional') else 'missing'
    if value is None and field.get('nullable'):
        return None
    tag = field['type']
    if not isinstance(value, TYPES[tag]) or (tag == 'number' and (isinstance(value, bool) or not math.isfinite(value))):
        return f'expected {tag}'
    if field.get('nonempty') and not value:
        return 'empty'
    if field.get('positive') and value <= 0:
        return 'expected positive value'
    return None


def check_contract(root, maps, manifest):
    sys.path.insert(0, str(root / 'src'))
    from mapset import MAP_FILES
    fields = manifest['runtimeContract']['fields']
    represented = {f['file'] for f in fields}
    current = represented | {row['file'] for row in manifest['items']}
    bad = 0
    if missing := sorted(set(MAP_FILES) - current):
        print('runtimeContract missing mandatory map files:', ', '.join(missing))
        bad += len(missing)
    for name in maps:
        data = root / 'data' / 'maps' / name
        cache = {}
        start = bad
        for field in fields:
            path = field['file']
            if path not in cache:
                target = data / path
                try:
                    cache[path] = json.loads(target.read_text(encoding='utf-8'))
                except FileNotFoundError:
                    cache[path] = None
                except (OSError, ValueError) as exc:
                    cache[path] = None
                    print(f'{name} {path}: {exc}')
                    bad += 1
            payload = cache[path]
            issue = problem(payload, field) if payload is not None else (
                None if field.get('optional') else 'file absent')
            if issue:
                print(f'{name} {path}:{field["key"]}: {issue}')
                bad += 1
        base = cache.get('map.json')
        radar = base.get('radar') if isinstance(base, dict) else None
        if isinstance(radar, str):
            target = (data / radar).resolve()
            if not target.is_relative_to(data.resolve()) or not target.is_file():
                print(f'{name} map.json: radar asset missing or outside map directory')
                bad += 1
        print(f'{name}: {bad - start} runtime contract issues')
    return bad
