# (v461) Проверка синтаксиса JS собранной страницы — до замеров и публикации: ошибка видна сразу, а не после 20 минут прогона
# (v460: комментарий посреди строки сломал страницу, прогон на ПК прошёл впустую). Нужен node; нет node — проверка пропускается.
import subprocess, shutil, sys
CHECK = r"""
const fs=require('fs');const h=fs.readFileSync(process.argv[1],'utf8');const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;let m,i=0,bad=0;
while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){bad++;const p=h.slice(0,m.index).split('\n').length;console.error('скрипт '+i+' (строка '+p+'): '+e.message);}}
process.exit(bad?1:0);
"""
def check(path):
    node = shutil.which('node') or shutil.which('node.exe')
    if not node: print('проверка синтаксиса: node не найден — пропущено'); return
    r = subprocess.run([node, '-e', CHECK, path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        sys.stderr.write('ОШИБКА СИНТАКСИСА в ' + path + ':\n' + r.stderr); sys.exit(1)
