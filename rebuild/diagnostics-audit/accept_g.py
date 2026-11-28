"""Проверка записей этапа G с полными матчами и выгрузка причин для проверки A/B."""
import argparse
from collections import Counter
import gzip
from hashlib import sha256
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[2] / 'tools' / 'measure'))
from audit.watch_validate import watch_revision


def read(path):
    with (gzip.open(path,'rt',encoding='utf-8') if path.suffix == '.gz' else path.open(encoding='utf-8')) as stream:
        return json.load(stream)


def match_file(folder, stem):
    raw = folder / f'{stem}.json'
    return raw if raw.exists() else raw.with_suffix('.json.gz')


def validate_record(record, match, reference=None):
    if record['match'] != match or watch_revision(record) != 2:
        raise ValueError(f'запись m{match} не соответствует контракту G')
    if reference is not None and (not record['finished'] or record.get('fingerprint') != reference):
        raise ValueError(f'нет полного отпечатка m{match} или отличается от базы')
    rows = record['watch']['all']
    releases = Counter((r[0],r[1],r[4]['type']) for r in rows.get('nade',[])
                       if r[4]['stage'] in ('thrown','unassigned'))
    if releases != Counter((r[0],r[3],r[2]) for r in record['nades']):
        raise ValueError(f'm{match}: выпуски WATCH и REC.nades разошлись')
    detonations = Counter((r[0],r[1] or '',r[4]['type']) for r in rows.get('nade',[]) if r[4]['stage'] == 'detonated')
    if detonations != Counter((r[0],r[6],r[2]) for r in record['det']):
        raise ValueError(f'm{match}: детонации WATCH и REC.det разошлись')
    rot = Counter(r[4] for r in record['rotx']['ev'])
    for key in ('rev','back','drop'):
        if rot[key] != record['rotx'][key]:
            raise ValueError(f'm{match}: журнал ротаций расходится по {key}')
    if rot['start'] + rot['rev'] + rot['back'] != record['rotx']['n']:
        raise ValueError(f'm{match}: расходится общий итог ротаций')
    jit = Counter(r[0] for r in record['jit']['ev'])
    for event,key in [('look','look'),('eng','moveEng'),('idle','moveIdle'),('other','moveOther')]:
        if jit[event] != record['jit'][key]:
            raise ValueError(f'm{match}: журнал дёрганий расходится по {key}')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate',type=Path)
    parser.add_argument('base',type=Path)
    parser.add_argument('out',type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    summary = {}
    for map_name in ('ancient','mirage'):
        records = args.candidate / f'g-rec-{map_name}'
        base = args.base / f'g-fp-base-{map_name}'
        results = {}
        with gzip.open(args.out / f'g-review-{map_name}.jsonl.gz','wt',encoding='utf-8') as out:
            for match in (3,7,11,13,17,19,23,29):
                ref = read(match_file(base,f'fp_{match}'))
                file = match_file(records,f'rec_{match}')
                rec = read(file)
                rows = validate_record(rec,match,ref)
                fingerprint_sha = sha256(json.dumps(ref,sort_keys=True,separators=(',',':')).encode()).hexdigest()
                results[match] = {'ticks':rec['ticks'],'fingerprint_sha256':fingerprint_sha,
                                  'counts':rec['watch']['n'],'file_sha256':sha256(file.read_bytes()).hexdigest()}
                for key in ('wait','flip','danger','nade','smokeProjected'):
                    for row in rows.get(key,[]):
                        print(json.dumps({'match':match,'kind':key,'row':row},ensure_ascii=False),file=out)
                for row in rec['prob']:
                    print(json.dumps({'match':match,'kind':row[2],'row':row},ensure_ascii=False),file=out)
        summary[map_name] = results
    (args.out / 'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('16 полных матчей: версии, отпечатки, последовательность и числители проверены')


if __name__ == '__main__':
    main()
