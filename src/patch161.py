# v159 шаг 11: пост-плант T дальше от бомбы, как у про (медиана ~283px, на бомбе ≤20% времени)
rep("var BAL = {", """var BAL = {
  ppFar: true,        // v159: пост-плант T держит бомбу с дистанции 180–520px (у про медиана 283px), а не стоит на ней""")
rep("""      holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea:320, rMin:90, rMax:420, must:[bp0], mustFirst:BAL.ppSpread, rMax2:560,""","""      holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea: BAL.ppFar ? 420 : 320, rMin: BAL.ppFar ? 180 : 90, rMax: BAL.ppFar ? 520 : 420, must:[bp0], mustFirst:BAL.ppSpread, rMax2: BAL.ppFar ? 680 : 560,""")
rep("версия 158 · 01.10","версия 159 · 01.10")
