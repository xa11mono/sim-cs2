#!/usr/bin/env python3
"""Автозамер: python3 measure/measure.py <метка> [--no-build] [--matches=3,7,11]
Собирает sim.html, играет воспроизводимые матчи, считает метрики отчёта и
сравнивает с про (демки) и с прошлым прогоном."""
import sys, os, json, subprocess, pickle, glob, time
import numpy as np, pandas as pd
HERE=os.path.dirname(os.path.abspath(__file__)); SIM=os.path.dirname(HERE); CMP='/home/claude/heat/cmp'
os.chdir(CMP)
G={}
for f in ('metrics.py','extra.py','mech.py','smooth.py'):
    src='\n'.join(l for l in open(f).read().split('\n') if not l.startswith("exec(open('metrics.py')"))
    exec(src.split("\nif __name__")[0], G)
args=[a for a in sys.argv[1:] if not a.startswith('--')]
label=args[0] if args else time.strftime('run_%H%M')
matches=[3,7,11,13,17,19,23,29]
for a in sys.argv[1:]:
    if a.startswith('--matches'): matches=[int(x) for x in a.split('=')[1].split(',')]
TICKS=200000
OUT=os.path.join(HERE,'runs',label); os.makedirs(OUT,exist_ok=True)
if '--no-build' not in sys.argv:
    subprocess.run(['python3','build.py','sim.html'],cwd=SIM,check=True)
if '--no-play' not in sys.argv:
    tpl=open(os.path.join(HERE,'rec2.js')).read()
    for i in range(0,len(matches),2):
        ps=[]
        for m in matches[i:i+2]:
            src=tpl.replace('__M__',str(m)).replace('__T__',str(TICKS))
            fo=open(os.path.join(OUT,f'rec_{m}.json'),'w')
            ps.append((subprocess.Popen(['timeout','2400','node','q.js','sim.html',src],cwd=SIM,stdout=fo),fo))
        for p,fo in ps: p.wait(); fo.close()
files=[os.path.join(OUT,f'rec_{m}.json') for m in matches]
# --- загрузка ботов (с ножом) ---
def load(files):
    R,K,P=G['load_bot'](files)
    # нож: 9-е поле pos
    kn=[]
    for f in files:
        d=json.load(open(f)); m=f.split('/')[-1]
        rounds=[r for r in d['rounds'] if 't1' in r]
        p=pd.DataFrame(d['pos']); 
        if p.shape[1]>=9:
            p=p[p[5]==1]; 
            for i,r in enumerate(rounds):
                s=p[(p[0]>=r['t0'])&(p[0]<=r['t1'])]
                kn.append(s[8].mean() if len(s) else np.nan)
    return R,K,P,np.nanmean(kn) if kn else None
R,K,P,knife=load(files)
M={}
M.update(G['metrics'](R,K,P,'bot')); M.update(G['extra'](R,K,P))
M.update(G['mech'](R,K,P,G['bomb_bot'](files),G['econ_bot'](files)))
M.update(G['smooth'](G['bot_yaw'](files)))
M['с ножом в руках % времени']=round(knife*100,1) if knife==knife else None
jit={'alive':0,'look':0,'moveEng':0,'moveIdle':0,'moveOther':0}; nd={'CT':0,'T':0}; nrounds=0; idle=[]
for f in files:
    d=json.load(open(f))
    for k in jit: jit[k]+=d['jit'][k]
    for n in d['nades']: nd[n[1]]+=1
    nrounds+=len([r for r in d['rounds'] if 't1' in r])
    idle+=[e for e in d['jit']['ev'] if e[0]=='idle'][:5]
# первая смерть раунда — этот T (по ролям), % раундов (как openDeath в демках)
fdr={}; nr2=0
for f in files:
    d=json.load(open(f)); rr=[r for r in d['rounds'] if 't1' in r]
    for r in rr:
        ks=[k for k in d['kills'] if r['t0']<=k[0]<=r['t1']]
        if not ks or len(ks[0])<13: continue
        nr2+=1
        if ks[0][6]=='T': fdr[ks[0][12]]=fdr.get(ks[0][12],0)+1
for role in ('entry','lurker','awp'):
    M[f'первым из T погиб: {role} % раундов']=round(fdr.get(role,0)/nr2*100,1) if nr2 else None
mins=jit['alive']/64/60
M['64Гц: флик взгляда туда-обратно вне боя (на минуту бота)']=round(jit['look']/mins,3)
M['64Гц: ёрзание без задания (на минуту бота)']=round(jit['moveIdle']/mins,3)
M['64Гц: разворот тела в бою (на минуту бота)']=round(jit['moveEng']/mins,3)
M['64Гц: разворот тела на задании вне боя (на минуту бота)']=round(jit['moveOther']/mins,3)
M['гранат за раунд: CT']=round(nd['CT']/nrounds,2); M['гранат за раунд: T']=round(nd['T']/nrounds,2)
print([k for k in M if not isinstance(k,str)]); M={str(k):v for k,v in M.items()}
json.dump(M,open(os.path.join(OUT,"metrics.json"),"w"),ensure_ascii=False,indent=1)
# --- про (кэш) ---
PF=os.path.join(HERE,'pro.json')
if not os.path.exists(PF):
    Rp,Kp,Pp=pickle.load(open('pro.pkl','rb'))
    Mp={}; Mp.update(G['metrics'](Rp,Kp,Pp,'pro')); Mp.update(G['extra'](Rp,Kp,Pp)); Mp.update(G['mech'](Rp,Kp,Pp,G['bomb_pro'](Rp),G['econ_pro'](Rp,Pp)))
    Mp.update(G['smooth'](G['pro_yaw']()))
    Mp['гранат за раунд: CT']=9.9; Mp['гранат за раунд: T']=9.4
    json.dump(Mp,open(PF,'w'),ensure_ascii=False,indent=1)
Mp=json.load(open(PF))
Mp.update({'первым из T погиб: entry % раундов':22.3,'первым из T погиб: lurker % раундов':13.1,'первым из T погиб: awp % раундов':4.4})
# --- прошлый прогон ---
runs=sorted([d for d in glob.glob(os.path.join(HERE,'runs','*')) if os.path.isdir(d) and d!=OUT and os.path.exists(os.path.join(d,'metrics.json'))],key=os.path.getmtime)
prev=json.load(open(os.path.join(runs[-1],'metrics.json'))) if runs else {}
prevname=os.path.basename(runs[-1]) if runs else '-'
KEY=['длительность раунда, медиана с','время планта, медиана с','CT выиграли раундов %','первый фраг, медиана с',
'T: смертей до 45 с (до планта)','CT: смертей до 45 с (до планта)','разменяли за 3 с %','раундов с 3+ фрагами у одного %','клатч выигран %',
'после фрага: остался (±40) %','после фрага: откатился (>40px дальше) %','плант: CT в 350px от сайта',
'пост-плант: T ближе 150px к бомбе (на бомбе) % времени','сейв CT: живых CT после взрыва','последний против 2+: сколько живёт, медиана с',
'взгляд туда-обратно >45° (на минуту)','стоя: средний поворот взгляда за 0,25 с, °','на бегу: взгляд вдоль движения (±30°) %',
'смерть до планта: рядом (≤350px) был свой %','первым из T погиб: entry % раундов','первым из T погиб: lurker % раундов','первым из T погиб: awp % раундов','64Гц: флик взгляда туда-обратно вне боя (на минуту бота)','64Гц: ёрзание без задания (на минуту бота)','с ножом в руках % времени','гранат за раунд: CT','гранат за раунд: T']
def fmt(v): return '—' if v is None else str(v)
lines=[f"Прогон «{label}»: {len(R)} раундов, матчи {matches}; сравнение с «{prevname}»",'',f"{'метрика':62s} {'про':>8s} {'боты':>8s} {'было':>8s}"]
for k in KEY:
    lines.append(f"{k[:62]:62s} {fmt(Mp.get(k)):>8s} {fmt(M.get(k)):>8s} {fmt(prev.get(k)):>8s}")
lines.append(''); lines.append('Примеры ёрзания без задания (тик, бот, x, y): '+'; '.join(f"{e[1]} {e[2]} {e[3]},{e[4]}" for e in idle[:8]))
txt='\n'.join(lines); open(os.path.join(OUT,'summary.txt'),'w').write(txt); print(txt)
