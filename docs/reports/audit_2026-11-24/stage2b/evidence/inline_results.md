# Результаты коротких проб (24.11, облако, сборки коммита 334860d; вывод скопирован из запуска как есть)

react_probe.js (Mirage, сцена audit/scenarios.js №1 с поправками):
{"zAsTest":{"first":null,"expect":16,"zBefore":[-263,-163],"zAfter":[-263,-163],"P":[[1388,942],[1034,883]],"log":[[0,false,0,1,"patrol"],...]},
 "zFixed":{"first":19,"expect":16,"zBefore":[-263,-163],"zAfter":[-94,-163],...,"log":[[0,true,1,0,"hold"],...]}}

nnt.js (Mirage, сцена audit/scenarios.js №7, обёртка throwNadeTry):
{"tnt":[[1024,"CT2","he",0,"не долетит: стена / потолок",1,36],[1024,"CT2","molly",0,"пауза: подбор броска — в следующем тике",0,0],
 [1024,"CT2","he",0,"пауза: подбор броска — в следующем тике",0,0],[1224,"CT2","he",0,"не долетит: стена / потолок",0,0]],"los":false,"wall":true,"nav":false}

navdrop.js:
anc {"atLoad":{"edges":5956,"drop":24,"auto":551,"step":24},"afterRebuild":{"edges":5951,"drop":8,"auto":551,"step":24},"rebuildWithStep8":{"edges":5967,"drop":24,"auto":551,"step":8}}
mir {"atLoad":{"edges":7862,"drop":14,"auto":763,"step":24},"afterRebuild":{"edges":7871,"drop":1,"auto":763,"step":24},"rebuildWithStep8":{"edges":7884,"drop":14,"auto":763,"step":8}}
(числа edges сразу после rebuildNav — до ленивой navCutTall; см. navbisect)

navbisect.js (rebuildNav с шагом 8 + один поиск пути, разница с графом загрузки [только при загрузке, только после]):
anc {"plain":[0,0],"plain2":[0,0],"JUMP_UP=undef":[0,0],"NAV_NEAR_DIRS=undef":"ERR TypeError ...length"}
mir {"plain":[0,0],"plain2":[0,0],"JUMP_UP=undef":[0,0],"NAV_NEAR_DIRS=undef":"ERR TypeError ...length"}

ladders.js: anc lad 5 / up 5 / cut 11 — одинаково при загрузке и после перестройки; mir lad 82 / up 80 / cut 37 — одинаково.

plen.js (Mirage м3, 25 000 тиков, раз в 64 тика, боты с постом дальше 100 px):
{"samples":1182,"walkingSamples":353,"diff10":3,"diff25":0,"walkingDiff10":3,"ex":[]}

facing.js (Mirage м3, 30 000 тиков, раз в 16 тиков): см. facing_range.json — min −14,04, max 16,14 рад, 1328 из 14181 снимков вне [−2π, 4π].
