import json,collections
d=json.load(open('an.json'));F=d['F']
ROOTS=[
 ("S1 фриз","freezeLookTick nadePrecalcTick"),
 ("S2 режимы","sbTick dvTick"),
 ("S3 после раунда","weaponPickupTick itemPickupTick"),
 ("S4a бомба","bombTick"),("S4b маршрут","routeTick"),("S4c контакт","contactTick hurtReactTick"),("S4d задержка CT","ctDelayNade"),
 ("S4e мозг T","tBrain"),("S4f мозг CT","ctBrain"),("S4g эндгейм","endgameBrain"),("S4h лайнапы","lineupTick"),
 ("S4i смоки/огонь","smokeEdgeTick smokeLineTick fireSmokeTick"),("S4j подбор","weaponPickupTick itemPickupTick"),("S4k LKP","lkpTick"),
 ("S4l ситуации","reloadPeek assistPeek lowHpBack finishPush smokeFadeTick awpSmokeTick bombPassTick"),
 ("S5 гранаты","nadeBrains updateNadeTasks nadesTick tClearCalls bombBeepTick"),
 ("S6 бот: место/ход","updatePost updateReload updateRoamer floorViewTick moveWalkTick knifeTick prePeekTick exposedShiftTick jumpCheckTick weaponSpeedMul moveSpeedTick"),
 ("S6 бот: перестрелка","fightCycleTick fcSwingGo ambushHoldFire"),
 ("S6 бот: шаг/физика","inWater moveSoundEmit ladderTick assignNewDestination stepBlocked navFollowFloor escapeWallLine navSnap navUnlinkBlocked snapToWalkable strafeKeysTick buildWaypointPath crossesWall"),
 ("S7 бой/взгляд","resolveEngagements"),
 ("S8 восприятие→знание","ecoKnowSeeTick smokeSpamTick infoFallbackTick smokeHeTick teamInfoTick posTick knowTick teamTick beliefTick"),
 ("S9 конец/сторож","checkRoundEnd probTick"),
 ("E события","applyDamage feedKill feedBombKill detonate endRound resetRound buyPhase newMatch freshMatch throwNade emitSound hearReal"),
]
stage={}
order=[]
for name,roots in ROOTS:
  q=collections.deque(r for r in roots.split() if r in F)
  seen=set(q)
  while q:
    f=q.popleft()
    stage.setdefault(f,[])
    if name not in stage[f]: stage[f].append(name)
    for c in F[f]['calls']:
      if c in F and c not in seen and c not in ('stepTick',): seen.add(c); q.append(c)
json.dump(stage,open('stage.json','w'),ensure_ascii=False)
sim=[f for f,i in F.items() if i['file']!='top' and int(i['file'])<550]
nost=[f for f in sim if f not in stage]
print('sim funcs',len(sim),'with stage',len(sim)-len(nost),'unreached',len(nost))
# callers
callers=collections.defaultdict(set)
for f,i in F.items():
  for c in i['calls']: callers[c].add(f)
dead=[f for f in nost if not callers.get(f)]
print('unreached & no callers (candidates unused):',len(dead))
print(sorted((F[f]['file'],f) for f in dead))
print('unreached but called (from display/tools/data init?):', sorted((F[f]['file'],f,sorted(callers[f])[:3]) for f in nost if callers.get(f))[:80])
