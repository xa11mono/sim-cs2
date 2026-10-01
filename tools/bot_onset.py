exec(open('onset.py').read())
import sys
tag=sys.argv[1]; files=sys.argv[2:]
allo=[]
for f in files:
    r=pd.DataFrame(json.load(open(f)),columns=['round','tick','pid','ct','x','y','ang','ph'])
    r['round']=f+'|'+r['round'].astype(str)
    r=r.sort_values(['pid','tick']); sp=np.hypot(r.groupby(['round','pid']).x.diff(),r.groupby(['round','pid']).y.diff())/(16/64)
    r['still']=(sp<25*0.6).values
    allo.append(onsets(r))
O=pd.concat(allo)
P=pd.read_csv('pro_onsets.csv')
print(pd.concat([summarize(P,'про'),summarize(O,tag)],axis=1).to_string())
