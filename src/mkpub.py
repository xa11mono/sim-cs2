import sys
s=open('sim.html').read()
i=s.index('<body>\n')+len('<body>\n'); s=s[i:]
s=s.replace('</body></html>','')
s=s.replace('<title>Ancient Live Radar</title>','<title>Ancient Live Radar v141</title>',1)
s=s.replace('window.__ev=function(src){return eval(src);};\n','')
assert '__ev' not in s
open('ancient-radar-v141.html','w').write('\n'+s)
print(len(s))
