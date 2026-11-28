"""(28.11, H-20) Задание ПК запускается, только если пуш в ветку measure/… изменил tools/measure/request.json. 27.11 пуш служебной ветки
measure/q17-ctrl-eco (правка данных гранат, задание не менялось) запустил прогон 351 со старым request.json из истории (v386, b2_mir_a5) —
8 лишних матчей. Пуск вручную (workflow_dispatch) — всегда. Читает событие GitHub (GITHUB_EVENT_PATH): изменённые файлы всех коммитов пуша.
(28.11, ПК 354) Задание ПК обычно пушится НОВОЙ веткой — в событии новой ветки списка изменённых файлов нет (commits пуст), и нормальное
задание было пропущено. Поэтому второй признак: в задании указана эта же ветка ("branch": "measure/<имя>", GITHUB_REF_NAME) — задание из
истории другой ветки его не имеет. Новое задание пишет "branch" (docs/rules/runs.md)."""
import json, os

REQ = 'tools/measure/request.json'


def changed_in_push(event):
    files = set()
    for c in (event.get('commits') or []) + ([event['head_commit']] if event.get('head_commit') else []):
        for k in ('added', 'modified'):
            files.update(c.get(k) or [])
    return files


def should_run(env=os.environ, req=None):
    """(запускать?, причина); req — задание (поле branch)"""
    if env.get('GITHUB_EVENT_NAME') != 'push' or not env.get('GITHUB_EVENT_PATH'):
        return True, 'не пуш (вручную или локально)'
    try:
        ev = json.load(open(env['GITHUB_EVENT_PATH'], encoding='utf-8'))
    except (OSError, ValueError) as e:
        return True, 'событие не прочитано (%s) — запуск' % e
    if REQ in changed_in_push(ev):
        return True, 'задание изменено в этом пуше'
    if req and req.get('branch') and req.get('branch') == env.get('GITHUB_REF_NAME'):
        return True, 'задание для этой ветки (branch = %s)' % req['branch']
    return False, 'в этом пуше tools/measure/request.json не менялся и задание не для этой ветки (нет "branch": "%s") — задание из истории не запускается (H-20)' % env.get('GITHUB_REF_NAME', '?')


def mark_skipped(env=os.environ):   # следующий шаг (publish_results.py) видит пропуск через GITHUB_ENV
    if env.get('GITHUB_ENV'):
        with open(env['GITHUB_ENV'], 'a', encoding='utf-8') as f:
            f.write('SIMCS2_SKIP=1\n')
