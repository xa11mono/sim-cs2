"""Bind existing parser exports to two archived copies of an identified Valve map."""
import json
from pathlib import Path


def load_bindings(path, name, revision):
    info = json.loads(path.read_text(encoding='utf-8'))
    if info['map'] != name or info['geometryRevision'] != revision:
        raise ValueError('revision bindings refer to another map or local geometry')
    if not info.get('geometryBakeReceipt'):
        raise ValueError('revision bindings require the local geometry extraction receipt')
    return info


def verify_file(base, item, digest):
    path = (base / item['file']).resolve()
    if digest(path) != item['sha256']:
        raise ValueError(f'revision source checksum mismatch: {path.name}')
    return item['sha256']


def verify_bindings(path, name, revision, digest):
    info = load_bindings(path, name, revision)
    local = verify_file(path.parent, info['localMapVpk'], digest)
    verified = {}
    if not info['demos']:
        raise ValueError('revision bindings have no demos')
    for demo, row in info['demos'].items():
        if not row.get('serverManifestRef') or not row.get('recordingRef'):
            raise ValueError(f'{demo}: recording and server manifest references are required')
        raw = verify_file(path.parent, row['rawDemo'], digest)
        server_map = verify_file(path.parent, row['serverMapVpk'], digest)
        verified[demo] = {
            'rawDemoSha256': raw, 'localMapVpkSha256': local, 'serverMapVpkSha256': server_map,
            'serverManifestRef': row['serverManifestRef'], 'recordingRef': row['recordingRef'],
            'identicalMapVpk': server_map == local,
        }
    return {'file': Path(path).name, 'sha256': digest(path),
            'geometryBakeReceipt': info['geometryBakeReceipt'], 'demos': verified}
