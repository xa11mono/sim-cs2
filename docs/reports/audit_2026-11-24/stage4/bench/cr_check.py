# Какая реализация Math правильно округлена: сравнение с mpmath (200 бит) на первых 5000 входах из cmp20k.json (его пишет br2.js).
import json, mpmath, math
mpmath.mp.prec=200
d=json.load(open('cmp20k.json')); NF=9; n=len(d['node'])//NF
r=12345
def u():
    global r; r=(r*1664525+1013904223)&0xffffffff; return r/4294967296
ins=[]
for i in range(n):
    a=(u()-0.5)*8*math.pi; x=(u()-0.5)*6000; y=(u()-0.5)*6000; e=u()*25-20; l=u()*1e4+1e-9; pb=u()*10+1e-9; pe=(u()-0.5)*6
    ins.append((a,x,y,e,l,pb,pe))
fn={0:lambda t:mpmath.sin(t[0]),1:lambda t:mpmath.cos(t[0]),2:lambda t:mpmath.tan(t[0]),3:lambda t:mpmath.atan2(t[2],t[1]),4:lambda t:mpmath.exp(t[3]),5:lambda t:mpmath.log(t[4]),6:lambda t:mpmath.power(t[5],t[6])}
names=["sin","cos","tan","atan2","exp","log","pow"]
for f,g in fn.items():
    cn=cc=0; m=min(n,5000)
    for i in range(m):
        cr=float(g(tuple(mpmath.mpf(v) for v in ins[i])))
        cn+= d['node'][i*NF+f]==cr; cc+= d['chromium'][i*NF+f]==cr
    print(f"{names[f]:6} правильно округлено из {m}: node {cn}  chromium {cc}")
