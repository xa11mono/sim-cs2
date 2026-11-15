# Убранные вечные переключатели BAL (перестройка, фаза 1)

Каждый ключ всегда имел одно значение и нигде не менялся; условия с ним свёрнуты (`tools/rebuild/bal_fold.js`), игра та же (отпечаток на ПК). Здесь — описание ключа из `080_bal.js` дословно, где он стоял (файл:строка до свёртки) и выброшенные ветки дословно (старое поведение до версии ключа). Решения отсюда переходят в реестр решений фазы 2.

## `BAL.midCover2` = true
Описание: v165: мид за погибшего мидера берёт ближайший свободный CT; пересмотр каждые 3с; в пути — "идёт на мид"
Где стоял: src/game/320_pro_lineups_ct_early.js:300

## `BAL.siteRebal` = true
Описание: v165: двое на одном входе / тиммейт подпушил — второй берёт свободный вход или встаёт под размен
Где стоял: src/game/110_post_routes.js:267, src/game/300_roles_fallback_rebalance.js:96

## `BAL.nadeMore` = true
Описание: v164: + ~150 редких про-лайнапов из демок (≥3 матчей)
Где стоял: src/game/320_pro_lineups_ct_early.js:8

## `BAL.nadeBuy` = true
Описание: v164: гранаты и на эко/пистолетке (флешка/смок/HE), на форсе до 2
Где стоял: src/game/360_nades_buy_smoke_vision.js:66, src/game/360_nades_buy_smoke_vision.js:73, src/game/360_nades_buy_smoke_vision.js:74, src/game/360_nades_buy_smoke_vision.js:76, src/game/360_nades_buy_smoke_vision.js:84, src/game/360_nades_buy_smoke_vision.js:85, src/game/360_nades_buy_smoke_vision.js:86
- выброшено (ветка ?: (ложь)) `src/game/360_nades_buy_smoke_vision.js:73`:

```js
1
```
- выброшено (ветка ?: (ложь)) `src/game/360_nades_buy_smoke_vision.js:74`:

```js
0
```

## `BAL.nadeReach` = true
Описание: v164: про-лайнапы кидает ближайший в 8–11 м (было 4–7 м), задание на "тайминговый" лайнап живёт 12с
Где стоял: src/game/390_nades_lineups.js:129, src/game/390_nades_lineups.js:133, src/game/390_nades_lineups.js:136, src/game/390_nades_lineups.js:137, src/game/390_nades_lineups.js:245
- выброшено (ветка ?: (ложь)) `src/game/390_nades_lineups.js:129`:

```js
480
```
- выброшено (ветка ?: (ложь)) `src/game/390_nades_lineups.js:136`:

```js
700
```
- выброшено (ветка ?: (ложь)) `src/game/390_nades_lineups.js:137`:

```js
400
```

## `BAL.proSpots` = true
Описание: v162: позиции удержания и направление взгляда — из библиотеки точек про (демки)
Где стоял: src/game/110_post_routes.js:384, src/game/270_look_plan_smooth.js:476

## `BAL.proCtSetup` = true
Описание: v160: веса расстановок как у про (в основном стандарт), стаки/ранние пики реже; опорник отходит только при реальном выходе (видели 2+ или гранаты выхода)
Где стоял: src/game/140_named_spots_ct_setup.js:115, src/game/340_ctbrain.js:564
- выброшено (ветка ?: (ложь)) `src/game/140_named_spots_ct_setup.js:115`:

```js
1.6
```

## `BAL.ppFar` = true
Описание: v159: пост-плант T держит бомбу с дистанции 180–520px (у про медиана 283px), а не стоит на ней
Где стоял: src/game/170_tbrain.js:1028, src/game/170_tbrain.js:1028, src/game/170_tbrain.js:1028

## `BAL.groupRetake` = true
Описание: v158: ретейк ждёт всех, кто успевает дойти; заход синхронный (ближние ждут дальних, ≤2,5с); сейв при меньшинстве на 2
Где стоял: src/game/180_save_retake.js:266, src/game/180_save_retake.js:408, src/game/340_ctbrain.js:343

## `BAL.groupPlay` = true
Описание: v157: дабл-пик с ~300px, второй разменщик до 450px, охота на последнего парой (ведущий ждёт напарника), одиночка T сейвит раньше
Где стоял: src/game/190_team_intel_lkp_calls.js:304, src/game/330_endgame_smoke_push.js:197, src/game/480_assist_flank_reload.js:60, src/game/480_assist_flank_reload.js:102, src/game/480_assist_flank_reload.js:118, src/game/480_assist_flank_reload.js:118
- выброшено (ветка ?: (ложь)) `src/game/190_team_intel_lkp_calls.js:304`:

```js
350
```
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:60`:

```js
160
```
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:102`:

```js
160
```
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:118`:

```js
{x:(b.x+mate.x)/2, y:(b.y+mate.y)/2}
```
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:118`:

```js
110
```

## `BAL.postKill` = true
Описание: v156: после фрага — добор (враг один/ранен, есть размен), откат (их много, мало HP) или остаться
Где стоял: src/game/500_decide_afterkill_cover.js:292

## `BAL.proTempo` = true
Описание: v155: раши ~5–8% раундов (в основном эко/пистолетка), время выхода по распределению плантов про (медиана ~66с), длинный сетап начинается с дефолта
Где стоял: src/game/130_tactics_match_adapt.js:272, src/game/130_tactics_match_adapt.js:279, src/game/130_tactics_match_adapt.js:295, src/game/130_tactics_match_adapt.js:325, src/game/130_tactics_match_adapt.js:325, src/game/170_tbrain.js:14, src/game/170_tbrain.js:80, src/game/170_tbrain.js:224, src/game/170_tbrain.js:252, src/game/170_tbrain.js:252, src/game/170_tbrain.js:401
- выброшено (ветка ?: (ложь)) `src/game/130_tactics_match_adapt.js:275`:

```js
null
```
- выброшено (ветка ?: (ложь)) `src/game/170_tbrain.js:224`:

```js
Math.max(tick + 10*TICK_HZ, Math.min(tt.execTick, tick + 15*TICK_HZ))
```
- выброшено (ветка ?: (ложь)) `src/game/170_tbrain.js:252`:

```js
12
```

## `BAL.duelValue` = true
Описание: v154: дуэль оценивается с учётом размена рядом (≤350px), перевеса и ситуации: один без размена — не лезет
Где стоял: src/game/190_team_intel_lkp_calls.js:292, src/game/500_decide_afterkill_cover.js:46

## `BAL.fallbackAll` = true
Описание: v154: откат после контакта без преимущества — и у T в дефолте, не только у выдвинутых CT
Где стоял: src/game/300_roles_fallback_rebalance.js:27

## `BAL.roamSmooth` = true
Описание: v153: роумер на чеке не дёргается ±14px 3 раза в секунду, а плавно выглядывает раз в ~2с
Где стоял: src/game/540_step_tick.js:657
- выброшено (else) `src/game/540_step_tick.js:657`:

```js
ramp = 14*Math.sin((tick - bot.roamCheckStart)*0.3);
```

## `BAL.holdTask` = true
Где стоял: src/game/170_tbrain.js:1024, src/game/320_pro_lineups_ct_early.js:249

## `BAL.egFix` = true
Где стоял: src/game/330_endgame_smoke_push.js:43, src/game/330_endgame_smoke_push.js:134

## `BAL.proPrior` = true
Описание: v147: позиции с учётом того, где реально стоят про (12 матчей)
Где стоял: src/game/100_sites_spots.js:205, src/game/140_named_spots_ct_setup.js:158, src/game/140_named_spots_ct_setup.js:216, src/game/320_pro_lineups_ct_early.js:118, src/game/340_ctbrain.js:551, src/game/340_ctbrain.js:554, src/game/340_ctbrain.js:637
- выброшено (ветка ?: (ложь)) `src/game/100_sites_spots.js:205`:

```js
null
```
- выброшено (ветка ?: (ложь)) `src/game/140_named_spots_ct_setup.js:216`:

```js
names[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * names.length)]
```
- выброшено (ветка ?: (ложь)) `src/game/320_pro_lineups_ct_early.js:116`:

```js
weightedPick(names.length, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1))
```
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:539`:

```js
weightedPick(names.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2))
```

## `BAL.proSetup` = true
Где стоял: src/game/340_ctbrain.js:550, src/game/340_ctbrain.js:703
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:538`:

```js
POS[kA].ctHold
```
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:691`:

```js
secondOnSite(b, ko2, apR)
```

## `BAL.ppSpread` = true
Где стоял: нигде (не использовался)

## `BAL.rearCut` = true
Описание: v148: не смотреть в свой тыл (Alley/90/First Lane), если там по инфе никого
Где стоял: src/game/260_look_threat.js:99
- выброшено (if(ложь)) `src/game/260_look_threat.js:99`:

```js
return false;
```

## `BAL.enemyward` = true
Где стоял: src/game/270_look_plan_smooth.js:157, src/game/270_look_plan_smooth.js:161, src/game/310_pro_positions.js:77

## `BAL.proLineups` = true
Где стоял: src/game/320_pro_lineups_ct_early.js:55, src/game/365_nade_plan.js:134, src/game/390_nades_lineups.js:19
- выброшено (if(ложь)) `src/game/320_pro_lineups_ct_early.js:55`:

```js
return false;
```
- выброшено (ветка ?: (ложь)) `src/game/390_nades_lineups.js:19`:

```js
L
```

## `BAL.smokeReact` = true
Где стоял: src/game/350_contact_reaction.js:328, src/game/400_nades_physics_damage.js:43, src/game/540_step_tick.js:692

## `BAL.fireExit` = true
Где стоял: src/game/535_move_mode.js:126, src/game/535_move_mode.js:134, src/game/535_move_mode.js:140
- выброшено (ветка ?: (ложь)) `src/game/535_move_mode.js:126`:

```js
0.3
```
- выброшено (ветка ?: (ложь)) `src/game/535_move_mode.js:140`:

```js
runSpeed
```

## `BAL.callFix` = true
Где стоял: src/game/340_ctbrain.js:77, src/game/340_ctbrain.js:80, src/game/340_ctbrain.js:90, src/game/340_ctbrain.js:91
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:75`:

```js
undefined
```
- выброшено (if(ложь)) `src/game/340_ctbrain.js:88`:

```js
nadeHere = 0;
```
- выброшено (if(ложь); условие с callFix,tacRead) `src/game/340_ctbrain.js:88`:

```js
{
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ) return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
```

## `BAL.tracerStyle` = true
Описание: v151: трассер и вспышка зависят от оружия (пистолет, ПП, винтовка, AWP)
Где стоял: src/game/620_draw.js:455

## `BAL.proRoles` = true
Описание: v151: роли игроков как у про (энтри, второй, саппорт/IGL, лёркер, снайпер), гранаты по роли
Где стоял: src/game/300_roles_fallback_rebalance.js:21
- выброшено (if(ложь)) `src/game/300_roles_fallback_rebalance.js:21`:

```js
return 0;
```

## `BAL.infoFallback` = true
Где стоял: src/game/300_roles_fallback_rebalance.js:139

## `BAL.proNades` = true
Описание: v151: закуп гранат как у про — на фулле 3–4 у каждого, набор по роли // v151: выдвинутый CT берёт инфу и откатывается (2+ врага, минус рядом, ранен)   // v151: пик со скоростью бега, плавно, короче      // v151: колл CT по сайтам — исправлен NaN (колл всегда висел на A, на B не появлялся)     // v151: из огня выходит всегда (даже если держал угол), путь наружу не перебивается    // v151: взгляд на место, где враг реально появится (угол на его пути), а не на середину прохода     // v151: прикрыть угол слепого со своего места, не залезая в тиммейта   // v150: HE в смок противника и смена позиции, когда смок закрыл угол   // v150: гранаты по реальным про-лайнапам из демок (с вероятностью и таймингом)    // v149: угол поста без инфы — видимый проход, откуда враг придёт раньше всего (не тыл)  // v148: делить направления только при заметной угрозе, иначе держат главный вход вместе     // v147: после планта бомбу видит один, остальные держат подходы (по демкам)     // v147: стандартная расстановка CT по данным демок (сколько где стоят)     // минимальный вес редкой позиции из списка названий        // v146: охота на последних — только рядом со свежим врагом; до планта T идут ставить     // v145: задача "держать район" + одна оценка позиции (пост-плант T, клатч CT)      // v141: единая оценка взгляда + вероятность только через невидимые входы
Где стоял: src/game/360_nades_buy_smoke_vision.js:72
- выброшено (ветка ?: (ложь)) `src/game/360_nades_buy_smoke_vision.js:72`:

```js
null
```

## `BAL.beliefRot` = true
Описание: раздел 13: сколько CT ротирует — по оценке числа врагов   // раздел 13: взгляд на посту — по карте вероятностей
Где стоял: src/game/340_ctbrain.js:473
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:461`:

```js
oldRot
```

## `BAL.tProbe` = true
Описание: раздел 12: пробы/подпуши T в сетапе
Где стоял: src/game/150_lurker_probes_clear.js:128
- выброшено (if(ложь)) `src/game/150_lurker_probes_clear.js:128`:

```js
return;
```

## `BAL.fakeRead` = true
Описание: (6) CT фейк-дефуз не каждый раз; T слушают ~0.8с, продолжается ли дефуз, если успевают
Где стоял: src/game/120_bomb.js:158, src/game/120_bomb.js:318, src/game/170_tbrain.js:523, src/game/170_tbrain.js:538
- выброшено (if(ложь)) `src/game/120_bomb.js:158`:

```js
return "all";
```

## `BAL.fakeBait` = true
Описание: (30.10) ВРЕМЕННО, на время сравнения A/B (прогон ПК): false — CT не делают фейк-дефуз, T не делают байт-пик (снять после решения)
Где стоял: src/game/120_bomb.js:170, src/game/120_bomb.js:318
- выброшено (ветка ?: (ложь)) `src/game/120_bomb.js:169`:

```js
null
```

## `BAL.oneStore` = true
Где стоял: src/game/190_team_intel_lkp_calls.js:54, src/game/190_team_intel_lkp_calls.js:67, src/game/190_team_intel_lkp_calls.js:110, src/game/340_ctbrain.js:74
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:72`:

```js
est.n
```

## `BAL.tradeReflex` = true
Где стоял: src/game/190_team_intel_lkp_calls.js:284, src/game/190_team_intel_lkp_calls.js:389

## `BAL.duelPlace` = true
Описание: прицел на уровне головы: точность на выходе зависит от того, стоял ли прицел на угле
Где стоял: src/game/490_shoot.js:226, src/game/490_shoot.js:298

## `BAL.timing` = true
Описание: зоны "враг мог уже добежать" (тайминги) — непроверенные углы в оценке взгляда
Где стоял: src/game/260_look_threat.js:109, src/game/260_look_threat.js:216, src/game/270_look_plan_smooth.js:20, src/game/270_look_plan_smooth.js:24, src/game/270_look_plan_smooth.js:77, src/game/270_look_plan_smooth.js:104, src/game/270_look_plan_smooth.js:107, src/game/270_look_plan_smooth.js:570

## `BAL.syncExec` = true
Где стоял: src/game/170_tbrain.js:48

## `BAL.iglReplan` = true
Описание: IGL перестраивает план по ходу: минус в сетапе, провал выхода, поп-флешка на убийцу энтри
Где стоял: src/game/170_tbrain.js:210, src/game/190_team_intel_lkp_calls.js:369

## `BAL.retakeRoles` = true
Описание: ретейк CT: флешка ДО захода, первый входящий, дефузер не тапает сразу
Где стоял: src/game/180_save_retake.js:290, src/game/180_save_retake.js:291, src/game/180_save_retake.js:318, src/game/180_save_retake.js:398, src/game/180_save_retake.js:417, src/game/180_save_retake.js:434

## `BAL.countRot` = true
Где стоял: src/game/340_ctbrain.js:218, src/game/340_ctbrain.js:271, src/game/340_ctbrain.js:506

## `BAL.awpRepos` = true
Описание: AWP после фрага уходит с угла на новый угол той же линии (рискованный иногда репикает)
Где стоял: src/game/490_shoot.js:313, src/game/490_shoot.js:322, src/game/500_decide_afterkill_cover.js:264
- выброшено (правая часть || (не вычислялась)) `src/game/490_shoot.js:306`:

```js
true
```
- выброшено (ветка ?: (ложь); условие с awpRepos,styles) `src/game/490_shoot.js:306`:

```js
false
```
- выброшено (правая часть || (не вычислялась)) `src/game/490_shoot.js:315`:

```js
true
```

## `BAL.styles` = true
Где стоял: src/game/340_ctbrain.js:406, src/game/340_ctbrain.js:552, src/game/490_shoot.js:313, src/game/490_shoot.js:322, src/game/500_decide_afterkill_cover.js:265, src/game/500_decide_afterkill_cover.js:294

## `BAL.soundDir` = true
Описание: звук даёт НАПРАВЛЕНИЕ с погрешностью (через стены — хуже), а не точку с шумом во все стороны
Где стоял: src/game/460_sound_situations.js:7, src/game/540_step_tick.js:48
- выброшено (if(ложь)) `src/game/460_sound_situations.js:7`:

```js
return null;
```

## `BAL.soundMore` = true
Где стоял: src/game/110_post_routes.js:497, src/game/350_contact_reaction.js:367, src/game/460_sound_situations.js:51, src/game/470_fight_cycle.js:310, src/game/480_assist_flank_reload.js:135, src/game/480_assist_flank_reload.js:146, src/game/480_assist_flank_reload.js:172, src/game/540_step_tick.js:366
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:135`:

```js
0.35
```
- выброшено (ветка ?: (ложь)) `src/game/480_assist_flank_reload.js:146`:

```js
64
```

## `BAL.smartPlant` = true
Где стоял: src/game/340_ctbrain.js:415

## `BAL.dangerWalk` = true
Где стоял: src/game/535_move_mode.js:48

## `BAL.clearQuiet` = true
Где стоял: src/game/470_fight_cycle.js:569

## `BAL.tSave` = true
Где стоял: src/game/170_tbrain.js:273

## `BAL.timingVar` = true
Описание: время выхода T гуляет: быстрый / обычный / поздний
Где стоял: src/game/130_tactics_match_adapt.js:287

## `BAL.nadeReact` = true
Описание: гранаты по ситуации: молотов на раш по звуку, HE в стак, флешка себе перед соло-пиком
Где стоял: src/game/420_nades_brains.js:217

## `BAL.partialVis` = true
Описание: стоящего/сидящего вдали замечают позже, бегущего — сразу
Где стоял: src/game/490_shoot.js:120, src/game/490_shoot.js:125

## `BAL.ctPatience` = true
Описание: CT не дёргаются на одного: ротация на слабую инфу — с задержкой
Где стоял: src/game/340_ctbrain.js:199

## `BAL.numbersPlay` = true
Описание: 5v4: T не спешат (контроль карты), CT в меньшинстве — без ранних пиков
Где стоял: src/game/160_igl_replan.js:64, src/game/320_pro_lineups_ct_early.js:137, src/game/460_sound_situations.js:55

## `BAL.bombCarrier` = true
Где стоял: src/game/120_bomb.js:269

## `BAL.safeRot` = true
Описание: ротация CT не через место, где только что видели T: крюк через CT-спавн, если он не сильно длиннее
Где стоял: src/game/470_fight_cycle.js:358
- выброшено (if(ложь)) `src/game/470_fight_cycle.js:358`:

```js
return;
```

## `BAL.ninjaDefuse` = true
Описание: все T известны далеко от бомбы — дефуз сразу и тихо, без сбора и гранат
Где стоял: src/game/180_save_retake.js:245

## `BAL.reloadCover` = true
Описание: перезарядка не на виду у известного врага: сначала шаг за укрытие
Где стоял: src/game/480_assist_flank_reload.js:150, src/game/480_assist_flank_reload.js:161

## `BAL.lowHpBack` = true
Описание: ≤ LOW_HP (25) HP один на угле рядом с врагом — отходит к своим
Где стоял: src/game/350_contact_reaction.js:369, src/game/470_fight_cycle.js:427

## `BAL.blindPlay` = true
Описание: ослеплённый: стоп/шаг назад за укрытие, а не идти дальше вслепую
Где стоял: src/game/400_nades_physics_damage.js:83, src/game/535_move_mode.js:154

## `BAL.flashAware` = true
Описание: увернуться от флешки можно, только если видел/слышал бросок (поп-флешку из-за стены — почти нет)
Где стоял: src/game/380_nades_throw.js:293, src/game/400_nades_physics_damage.js:71, src/game/400_nades_physics_damage.js:73
- выброшено (ветка ?: (ложь)) `src/game/400_nades_physics_damage.js:71`:

```js
0.25 + 0.3*(b.skill-0.8)/0.4
```

## `BAL.pistolSwap` = true
Описание: кончились патроны в бою, враг рядом — пистолет вместо долгой перезарядки
Где стоял: src/game/460_sound_situations.js:207, src/game/480_assist_flank_reload.js:141, src/game/480_assist_flank_reload.js:142

## `BAL.tagging` = true
Описание: попадание замедляет на ~0.25с (как в CS2)
Где стоял: src/game/450_combat_items_knife.js:52, src/game/490_shoot.js:296, src/game/535_move_mode.js:163

## `BAL.ctEarlyUtil` = true
Где стоял: src/game/320_pro_lineups_ct_early.js:175, src/game/320_pro_lineups_ct_early.js:176

## `BAL.ctClutch` = true
Описание: последний CT до планта: выбирает сайт (по инфе или угадывает) и играет его, не мечется
Где стоял: src/game/340_ctbrain.js:441

## `BAL.midCover` = true
Где стоял: src/game/340_ctbrain.js:443

## `BAL.midSafe` = true
Описание: мидер CT: чаще глубокие позиции; двое+ T на миде — отходит, а не дуэлит один
Где стоял: src/game/340_ctbrain.js:616, src/game/340_ctbrain.js:637

## `BAL.weaponSpeed` = true
Описание: скорость бега от оружия (CS2): пистолеты/SMG быстрее, AK чуть медленнее M4, AWP медленнее, AWP в прицеле — вдвое
Где стоял: src/game/450_combat_items_knife.js:186

## `BAL.heClearsSmoke` = true
Описание: HE в дыму на ~1.3с проделывает дыру; ждущий у смока с HE кидает её в дым перед проходом
Где стоял: src/game/330_endgame_smoke_push.js:265, src/game/400_nades_physics_damage.js:88

## `BAL.bombPass` = true
Описание: пас бомбы: лёркер/энтри отдают её основной группе, раненый носитель — здоровому рядом
Где стоял: src/game/460_sound_situations.js:71

## `BAL.timeouts` = true
Описание: тайм-ауты: 3 поражения подряд → пауза, IGL/CT меняют тактики и расстановки
Где стоял: src/game/130_tactics_match_adapt.js:98, src/game/130_tactics_match_adapt.js:233, src/game/130_tactics_match_adapt.js:249, src/game/130_tactics_match_adapt.js:280, src/game/140_named_spots_ct_setup.js:124
- выброшено (if(ложь)) `src/game/130_tactics_match_adapt.js:97`:

```js
return;
```

## `BAL.clearOrder` = true
Описание: энтри на выходе чистит углы по очереди (ближний → следующий), каждый — короткий чек
Где стоял: src/game/170_tbrain.js:792

## `BAL.defuseSmoke` = true
Описание: ретейк: смок на бомбу, дефуз под ним
Где стоял: src/game/180_save_retake.js:309

## `BAL.utilDump` = true
Описание: мало HP и враг рядом — выкинуть оставшиеся гранаты во врага, пока жив
Где стоял: src/game/410_nades_tactical_self.js:207

## `BAL.bombBeep` = true
Описание: CT знают точку бомбы по писку примерно (±140px, точнее к концу таймера), точно — увидев или подойдя
Где стоял: src/game/180_save_retake.js:137

## `BAL.fakePlant` = true
Описание: носитель иногда начинает плант и прерывает — выманить CT под прицел своих
Где стоял: src/game/120_bomb.js:244

## `BAL.awpSave` = true
Описание: AWP сейвит отдельно, когда раунд почти проигран (2v3+ ретейк, 2v4 T)
Где стоял: src/game/340_ctbrain.js:401

## `BAL.ctAntiEco` = true
Описание: CT против эко: без ранних пиков и доборов, держат вместе
Где стоял: src/game/140_named_spots_ct_setup.js:140

## `BAL.heFinish` = true
Описание: HE по раненому за укрытием
Где стоял: src/game/410_nades_tactical_self.js:219

## `BAL.lookCommit` = true
Где стоял: src/game/470_fight_cycle.js:536

## `BAL.prefireStrict` = true
Описание: префаер только по своему свежему (≤1.4с) визуальному контакту, и менее точный
Где стоял: src/game/490_shoot.js:131, src/game/490_shoot.js:132, src/game/490_shoot.js:136, src/game/490_shoot.js:202
- выброшено (ветка ?: (ложь)) `src/game/490_shoot.js:131`:

```js
CAUTION_TICKS
```
- выброшено (ветка ?: (ложь)) `src/game/490_shoot.js:202`:

```js
1.3 + 1.4*(1-prefireConfidence)
```

## `BAL.midWeapon` = true
Описание: мидер: позиция под оружие (пистолет/ПП — ближний угол, AWP — дальняя точка)
Где стоял: src/game/140_named_spots_ct_setup.js:192, src/game/340_ctbrain.js:646

## `BAL.anchorFall` = true
Описание: опорник один против 3+ на своём сайте — отходит к входу CT, живым на ретейк
Где стоял: src/game/340_ctbrain.js:563

## `BAL.rotGroup` = true
Описание: ротация в стак — не по одному: ждут второго у входа CT (до 5с)
Где стоял: src/game/340_ctbrain.js:495

## `BAL.tClutch` = true
Описание: (5) клатч T: по одному, после планта — на время до звука дефуза
Где стоял: src/game/170_tbrain.js:1013, src/game/500_decide_afterkill_cover.js:25

## `BAL.mollyClear` = true
Описание: (7) молотов в ближний угол сайта на выходе "на всякий"
Где стоял: src/game/420_nades_brains.js:148

## `BAL.tempoShift` = true
Описание: (8) после двух проигрышей в одном темпе T меняют темп
Где стоял: src/game/130_tactics_match_adapt.js:224, src/game/130_tactics_match_adapt.js:260

## `BAL.midOutnum` = true
Описание: (1) мидер/роумер CT: 2+ известных T и некому разменять — отход
Где стоял: src/game/500_decide_afterkill_cover.js:36

## `BAL.roundMem` = true
Описание: (10) память между раундами: линия AWP (смок), агрессивные пики CT (аккуратный угол), раш (ранняя граната), мидер (глубже)
Где стоял: src/game/140_named_spots_ct_setup.js:120, src/game/190_team_intel_lkp_calls.js:237, src/game/250_look_prepeek_corners.js:141, src/game/320_pro_lineups_ct_early.js:139, src/game/340_ctbrain.js:618, src/game/340_ctbrain.js:639, src/game/420_nades_brains.js:78, src/game/530_round_sides_match.js:147

## `BAL.fightPickup` = true
Описание: (9) в бою с пистолетом/ПП — поднять винтовку убитого рядом, если врага не видно ~0.5с
Где стоял: src/game/450_combat_items_knife.js:272

## `BAL.pickFix` = true
Описание: за оружием — общий лимит 7с (раньше метался между двумя ганами и стоял)
Где стоял: src/game/450_combat_items_knife.js:246, src/game/450_combat_items_knife.js:309

## `BAL.popAim` = true
Описание: флешка себе — в поле зрения держащего (на линии держащий→угол), без цели не кидает
Где стоял: src/game/250_look_prepeek_corners.js:178, src/game/250_look_prepeek_corners.js:184, src/game/250_look_prepeek_corners.js:188

## `BAL.pieSlice` = true
Описание: (1,2) угол впереди: прицел на край, последние метры шагом; как брать угол (флешка/вдвоём/джиггл) — до контакта
Где стоял: src/game/250_look_prepeek_corners.js:112, src/game/490_shoot.js:94, src/game/535_move_mode.js:16, src/game/535_move_mode.js:92, src/game/535_move_mode.js:93
- выброшено (if(ложь)) `src/game/250_look_prepeek_corners.js:112`:

```js
{ b._pie = null; return; }
```
- выброшено (ветка ?: (ложь)) `src/game/490_shoot.js:94`:

```js
45
```

## `BAL.oneAngle` = true
Описание: (3) из-за угла два опасных направления — второе тиммейту или флешкой
Где стоял: src/game/250_look_prepeek_corners.js:151

## `BAL.heardMe` = true
Описание: (4) бежал рядом с вероятным врагом — "меня слышали": не выходит сразу
Где стоял: src/game/250_look_prepeek_corners.js:144, src/game/540_step_tick.js:383

## `BAL.seenShift` = true
Описание: (5) ранили/стреляли, контакт кончился — уходит глубже без фрага
Где стоял: src/game/250_look_prepeek_corners.js:207

## `BAL.ctUtilSmart` = true
Описание: гранаты CT во вход — только по инфе; смок "отрезать вход" на ретейке — если есть кого отрезать
Где стоял: src/game/420_nades_brains.js:241

## `BAL.holdShift` = true
Описание: после фрага/контакта с угла, когда врагов рядом ещё много — смена позиции глубже
Где стоял: src/game/110_post_routes.js:366, src/game/500_decide_afterkill_cover.js:307

## `BAL.moreWeapons` = true
Описание: (7) M4A1-S, SSG 08, UMP-45, MP7, P90, AUG, SG 553 в закупе
Где стоял: src/game/520_economy.js:65, src/game/520_economy.js:71, src/game/520_economy.js:351

## `BAL.hitbox` = true
Описание: (6) хитбоксы по высоте модели + паттерн отдачи
Где стоял: src/game/490_shoot.js:199, src/game/490_shoot.js:229, src/game/490_shoot.js:234, src/game/490_shoot.js:246
- выброшено (else) `src/game/490_shoot.js:246`:

```js
{
  if(aimHead){ pHead = pIn(hA); pAny = pIn(bA*1.25); }
  else { pAny = pIn(bA*1.6); pHead = 0.10*pAny; }
  var r = hashRand(seedS);
  headshot = r < pHead; hit = r < pAny;
  }
```

## `BAL.knifeRun` = true
Описание: (10) бег с ножом там, где врага быть не может; доставание оружия ~0.4с
Где стоял: src/game/450_combat_items_knife.js:169, src/game/450_combat_items_knife.js:185, src/game/490_shoot.js:69
- выброшено (if(ложь)) `src/game/450_combat_items_knife.js:169`:

```js
return;
```

## `BAL.callDedup` = true
Описание: один и тот же колл CT не повторяется в войс (только если их стало больше / через 15с)
Где стоял: src/game/340_ctbrain.js:139

## `BAL.arriveNear` = true
Описание: бот в 30–70px от поста и ближе не подходит ~1.5с — считается дошедшим
Где стоял: src/game/110_post_routes.js:487

## `BAL.tacRead` = true
Описание: (11) CT читают выход по гранатам T у сайта (2+ за 6с — выход, 1 — намёк)
Где стоял: src/game/340_ctbrain.js:80, src/game/340_ctbrain.js:91, src/game/400_nades_physics_damage.js:42

## `BAL.nadeEarly` = true
Описание: (14) смоки/молотов выхода — за ~4с до выхода; выход ждёт, пока смоки встанут
Где стоял: src/game/170_tbrain.js:5, src/game/170_tbrain.js:59, src/game/390_nades_lineups.js:28, src/game/420_nades_brains.js:109, src/game/420_nades_brains.js:143
- выброшено (ветка ?: (ложь)) `src/game/420_nades_brains.js:109`:

```js
{}
```
- выброшено (ветка ?: (ложь)) `src/game/420_nades_brains.js:143`:

```js
{bkey:"T.exec.molly."+tt.site}
```

## `BAL.buyRead` = true
Описание: (13) закуп врага — по увиденному оружию на первых контактах, а не "знаем"
Где стоял: src/game/190_team_intel_lkp_calls.js:26, src/game/410_nades_tactical_self.js:7

## `BAL.saveMove` = true
Описание: (9) на сейве чекает проходы, после фрага меняет позицию
Где стоял: src/game/500_decide_afterkill_cover.js:248

## `BAL.saveRetake` = true
Описание: (8) на сейве выровняли (1v1/2v2/1v2 со временем) — идут ретейкать
Где стоял: src/game/340_ctbrain.js:356

## `BAL.plantReact` = true
Описание: (7) по плантеру стреляют — бросает плант и отвечает
Где стоял: src/game/120_bomb.js:212

## `BAL.carrierStay` = true
Описание: (6) носитель уже на сайте — перекол запрещён, ставит
Где стоял: src/game/160_igl_replan.js:21

## `BAL.recallStrict` = true
Описание: перекол "стак" — только по свежей реальной инфе (≥2 видели/слышали), не по памяти
Где стоял: src/game/170_tbrain.js:104, src/game/170_tbrain.js:105, src/game/170_tbrain.js:111, src/game/170_tbrain.js:152
- выброшено (ветка ?: (ложь)) `src/game/170_tbrain.js:105`:

```js
e.n
```

## `BAL.reachBlock` = true
Описание: (фото) враг не проходит сквозь зону, которую держит/видит живой свой
Где стоял: src/game/200_belief_reach.js:140

## `BAL.realSpeed` = true
Где стоял: src/game/080_bal.js:193, src/game/340_ctbrain.js:200
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:192`:

```js
2.5
```

## `BAL.cornerSlow` = true
Описание: (10) на крутом повороте притормаживает, а не трётся дугой о угол   // (3) скорость бега как в CS2 (было в 1.5 раза быстрее)
Где стоял: src/game/540_step_tick.js:474

## `BAL.setup111` = true
Описание: (7) CT читают расстановку 1-1-1: не ротируют всей командой на одну инфу
Где стоял: src/game/340_ctbrain.js:248

## `BAL.ppCommit` = true
Описание: (15) CT после планта: одна точка сбора и один путь, без перевыбора
Где стоял: src/game/330_endgame_smoke_push.js:69

## `BAL.openAngles` = true
Описание: (2) позиции: штраф за точку, которую видно с многих выходов врага
Где стоял: src/game/100_sites_spots.js:204
- выброшено (ветка ?: (ложь)) `src/game/100_sites_spots.js:204`:

```js
null
```

## `BAL.tPostPlant` = true
Описание: (1) пост-плант T: имя позиции — по укрытости, а не "ближайшая"
Где стоял: src/game/170_tbrain.js:1048

## `BAL.bStageLow` = true
Описание: (13) сбор на B — T Lower / T Upper, а не Ruins // взгляд: зоны, куда враг по таймингу ещё не мог добежать, и сектор, который уже смотрит тиммейт, — почти не смотрим
Где стоял: src/game/160_igl_replan.js:146, src/game/160_igl_replan.js:174
- выброшено (if(ложь)) `src/game/160_igl_replan.js:146`:

```js
return;
```

## `BAL.nadeDedup` = true
Описание: не дублировать гранату одного типа в одну точку разными механиками  // стрейф с винтовкой и на средней дистанции (от ~3м), шаги короче
Где стоял: src/game/380_nades_throw.js:387

## `BAL.ecoRead` = true
Описание: закуп с оглядкой на деньги соперника (оценка ±$500): SMG против эко, не форсить в их фулл-бай
Где стоял: src/game/520_economy.js:140

## `BAL.ctPreSave` = true
Описание: CT сейвят и до планта, если 1v3+/2v5 и выход на сайт уже идёт
Где стоял: src/game/340_ctbrain.js:375

## `BAL.overtime` = true
Описание: 12:12 — овертайм MR3 ($10000 на половину, до 16/19/…)
Где стоял: src/game/130_tactics_match_adapt.js:102, src/game/530_round_sides_match.js:38, src/game/530_round_sides_match.js:41, src/game/530_round_sides_match.js:55, src/game/530_round_sides_match.js:158
- выброшено (if(ложь)) `src/game/530_round_sides_match.js:41`:

```js
return sCT >= MATCH_WIN || sT >= MATCH_WIN || r >= regRounds();
```

## `BAL.awpClose` = true
Описание: AWP вблизи: ноускоп или пистолет после промаха
Где стоял: src/game/490_shoot.js:38, src/game/490_shoot.js:330

## `BAL.pickupMore` = true
Описание: подбор лучшего оружия активнее (дальше, чаще), AK в приоритете; AWP — если своей AWP у команды нет
Где стоял: src/game/450_combat_items_knife.js:191, src/game/450_combat_items_knife.js:210, src/game/450_combat_items_knife.js:310, src/game/450_combat_items_knife.js:313
- выброшено (if(ложь)) `src/game/450_combat_items_knife.js:209`:

```js
return false;
```
- выброшено (ветка ?: (ложь)) `src/game/450_combat_items_knife.js:308`:

```js
230
```
- выброшено (ветка ?: (ложь)) `src/game/450_combat_items_knife.js:311`:

```js
2
```

## `BAL.oneWay` = true
Где стоял: src/game/510_engagements.js:32, src/game/510_engagements.js:32

## `BAL.hurtCall` = true
Описание: "он на 20": знают, что враг ранен — добивают
Где стоял: src/game/350_contact_reaction.js:370, src/game/460_sound_situations.js:94, src/game/490_shoot.js:302, src/game/500_decide_afterkill_cover.js:73

## `BAL.coverBlind` = true
Описание: тиммейта ослепили рядом — закрывают его угол
Где стоял: src/game/460_sound_situations.js:188

## `BAL.awpSmoke` = true
Описание: засветили AWP — смок на его линию тому, кто туда идёт/стоит
Где стоял: src/game/460_sound_situations.js:147

## `BAL.bombWatch` = true
Описание: CT увидели бомбу на земле — один держит её с укрытия
Где стоял: src/game/340_ctbrain.js:27

## `BAL.coverPlant` = true
Описание: пока ставят — двое прикрывают подходы к ставящему
Где стоял: src/game/170_tbrain.js:732

## `BAL.defuseReach` = true
Описание: услышали дефуз, но не успеть — сейв вместо бега на троих
Где стоял: src/game/170_tbrain.js:906

## `BAL.smokeFade` = true
Описание: смок уходит — готовятся к выходу из-за него
Где стоял: src/game/460_sound_situations.js:124

## `BAL.rotRead` = true
Описание: T слышат ротацию CT на свой сайт — (не всегда) переходят на другой, но не считают его пустым
Где стоял: src/game/160_igl_replan.js:87

## `BAL.retakeAwpSmoke` = true
Описание: ретейк: смок на линию известного AWP T
Где стоял: src/game/180_save_retake.js:345

## `BAL.ppSplit` = true
Описание: пост-плант 2v2: не стоять вдвоём в одной точке     // стоящий в краю дыма видит наружу, а его снаружи — нет (ван-вей)   // убили мидера — ротатор/роумер берёт мид с безопасной позиции// CT в начале раунда: молотов/HE во вход T на задержку, флешка себе под ранний пик     // пост-плант: CT не идут — T отходят дальше от бомбы и играют на время (слушают дефуз)// бомбу несёт не энтри/лёркер/AWP; носитель не идёт первым      // T сейвят, когда раунд безнадёжен (1v3+ мало времени, 2v4), вместо смертника на плант // после колла "чисто" не срываются на бег, если враг недавно был рядом с путём // взгляд не упирается в стену в метре: цель за стеной — смотрит в ближайший открытый проход к ней // шифт там, где враг МОЖЕТ быть (по таймингу и карте вероятностей), бег — где точно пусто или надо спешить // CT не бегут сбивать плант в меньшинстве (кроме конца раунда)
Где стоял: src/game/170_tbrain.js:1064

## `BAL.assistPeek` = true
Описание: тиммейт рядом в перестрелке — второй выходит вместе (дабл-пик), а не стоит за спиной  // новые звуки: перезарядка (пик на неё), зум AWP, шаги по воде (громко, даже шифтом)    // характер игрока влияет на макро: ранний пик агрессивных CT, добор после фрага, офф-углы  // ротации CT по счёту: сколько T уже учтено, сколько своих живо  // синхронный выход: не идти на сайт, пока группа не собралась на точках (до ~5с ожидания)
Где стоял: src/game/350_contact_reaction.js:368, src/game/480_assist_flank_reload.js:93

## `BAL.pairs` = true
Описание: пробы/пики парой: второй в 1–2с за первым, держит тот же угол и разменивает
Где стоял: src/game/150_lurker_probes_clear.js:178, src/game/150_lurker_probes_clear.js:223

## `BAL.probeUtil` = true
Описание: проба выходит под флешку/смок тиммейта, если есть
Где стоял: src/game/150_lurker_probes_clear.js:187

## `BAL.tAdapt` = true
Описание: T меняют паттерн: где за матч умерли ≥2 раз — туда не пикают на сухую, стоят иначе // смерть тиммейта рядом — ближайший сразу идёт разменивать, срываясь с тактики // вся инфа о врагах — в одном хранилище (belief); false — старые отдельные копии
Где стоял: src/game/150_lurker_probes_clear.js:155, src/game/150_lurker_probes_clear.js:155, src/game/150_lurker_probes_clear.js:170, src/game/160_igl_replan.js:159, src/game/170_tbrain.js:386
- выброшено (ветка ?: (ложь)) `src/game/150_lurker_probes_clear.js:154`:

```js
0
```
- выброшено (ветка ?: (ложь)) `src/game/150_lurker_probes_clear.js:154`:

```js
0
```
- выброшено (ветка ?: (ложь)) `src/game/160_igl_replan.js:158`:

```js
[]
```
- выброшено (ветка ?: (ложь)) `src/game/170_tbrain.js:386`:

```js
[]
```

## `BAL.shiftOnClear` = true
Описание: проба увидела "пусто" → двое идут брать контроль в другом месте
Где стоял: src/game/150_lurker_probes_clear.js:247

## `BAL.soloSlow` = true
Описание: T в клатче с бомбой без инфы идёт на шифте, а не бежит // постоянная инфа: последняя известная позиция врага держится, пока не обновят
Где стоял: src/game/535_move_mode.js:41

## `BAL.ctSetups` = true
Описание: раздел 13: привычки CT для T, пул расстановок CT
Где стоял: src/game/140_named_spots_ct_setup.js:132, src/game/340_ctbrain.js:535
- выброшено (ветка ?: (ложь)) `src/game/140_named_spots_ct_setup.js:132`:

```js
(BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0])
```

## `BAL.endgame` = true
Описание: раздел 13: привычки CT для T, пул расстановок CT
Где стоял: src/game/330_endgame_smoke_push.js:44

## `BAL.smokeEntry` = true
Описание: раздел 13: привычки CT для T, пул расстановок CT
Где стоял: src/game/420_nades_brains.js:170

## `BAL.smokePush` = true
Описание: раздел 13: привычки CT для T, пул расстановок CT
Где стоял: src/game/330_endgame_smoke_push.js:251

## `BAL.weaponDrop` = true
Описание: раздел 13: привычки CT для T, пул расстановок CT
Где стоял: src/game/450_combat_items_knife.js:227

## `BAL.namedPos` = true
Где стоял: src/game/170_tbrain.js:388, src/game/170_tbrain.js:773, src/game/170_tbrain.js:839, src/game/170_tbrain.js:844, src/game/170_tbrain.js:1034, src/game/180_save_retake.js:179, src/game/320_pro_lineups_ct_early.js:113, src/game/340_ctbrain.js:556, src/game/340_ctbrain.js:597, src/game/340_ctbrain.js:641, src/game/340_ctbrain.js:674, src/game/340_ctbrain.js:686
- выброшено (if(ложь)) `src/game/170_tbrain.js:839`:

```js
{
      groupPost(rest.filter(function(b){ return b.tRole==="entry"; }), g.anchor, g.ctEntry, "clear"+tt.site, {rMax:130, minGap:50, see:[g.ctEntry]});
      groupPost(rest.filter(function(b){ return b.tRole==="support" || b.tRole==="igl"; }), plantPt, g.ctEntry, "sitehold"+tt.site, {rMin:40, rMax:210, minGap:60, see:[g.ctEntry]});
    }
```
- выброшено (if(ложь)) `src/game/170_tbrain.js:841`:

```js
groupPost(rest.filter(function(b){ return b.tRole==="awp" && b.primary!=="AWP"; }), plantPt, g.ctEntry, "sitehold"+tt.site, {rMin:40, rMax:210, minGap:60, see:[g.ctEntry]});
```
- выброшено (if(ложь)) `src/game/320_pro_lineups_ct_early.js:112`:

```js
return false;
```
- выброшено (ветка ?: (ложь)) `src/game/340_ctbrain.js:544`:

```js
null
```

## `BAL.midTake` = true
Где стоял: src/game/170_tbrain.js:214

## `BAL.stopPlant` = true
Где стоял: src/game/340_ctbrain.js:423

## `BAL.reangle` = true
Где стоял: src/game/340_ctbrain.js:445

## `BAL.silentWalk` = true
Где стоял: src/game/540_step_tick.js:367

## `BAL.antiDefuse` = true
Где стоял: src/game/170_tbrain.js:899

## `BAL.lurkCheck` = true
Где стоял: src/game/180_save_retake.js:371

## `BAL.profiles` = true
Описание: раздел 13 п.6–7: профили игроков, ошибки исполнения, профиль соперника // iglErr — доля раундов, когда IGL "не дочитал" инфу     // позиции по названиям зон (удержание, заход, пост-плант, ретейк)
Где стоял: src/game/500_decide_afterkill_cover.js:150

## `BAL.oppProfile` = true
Описание: раздел 13 п.6–7: профили игроков, ошибки исполнения, профиль соперника // iglErr — доля раундов, когда IGL "не дочитал" инфу     // позиции по названиям зон (удержание, заход, пост-плант, ретейк)
Где стоял: src/game/130_tactics_match_adapt.js:45, src/game/130_tactics_match_adapt.js:63
- выброшено (if(ложь)) `src/game/130_tactics_match_adapt.js:45`:

```js
return;
```
- выброшено (ветка ?: (ложь)) `src/game/130_tactics_match_adapt.js:62`:

```js
null
```

## `BAL.plantChoice` = true
Описание: раздел 12 (хвосты)
Где стоял: src/game/170_tbrain.js:667

## `BAL.repos` = true
Описание: раздел 12 (хвосты)
Где стоял: src/game/490_shoot.js:314

## `BAL.antiEco` = true
Описание: раздел 12 (хвосты)
Где стоял: src/game/410_nades_tactical_self.js:5, src/game/500_decide_afterkill_cover.js:131
- выброшено (if(ложь)) `src/game/410_nades_tactical_self.js:5`:

```js
return false;
```

## `BAL.offAngle` = true
Описание: раздел 12 (хвосты)
Где стоял: src/game/340_ctbrain.js:553

## `BAL.tUtil` = true
Описание: T используют гранаты на выходе
Где стоял: src/game/150_lurker_probes_clear.js:211, src/game/420_nades_brains.js:78, src/game/420_nades_brains.js:93, src/game/420_nades_brains.js:105, src/game/420_nades_brains.js:118

## `BAL.tSmoke` = true
Описание: по отдельности
Где стоял: src/game/420_nades_brains.js:114, src/game/420_nades_brains.js:115

## `BAL.tFlash` = true
Описание: по отдельности
Где стоял: src/game/420_nades_brains.js:123, src/game/420_nades_brains.js:126

## `BAL.tMolly` = true
Описание: по отдельности
Где стоял: src/game/420_nades_brains.js:143

## `BAL.ctUtilEarly` = true
Описание: CT кидают молотов/смок по входу сразу на первый звук/вид у сайта
Где стоял: src/game/420_nades_brains.js:193, src/game/420_nades_brains.js:194

## `BAL.cautious` = true
Описание: на ретейк/ротацию последние ~350px CT идут шагом (не влетают бегом под держащих)
Где стоял: src/game/535_move_mode.js:42

## выброшено (ключ инструмент по месту не определил — разобрано вручную)
`170_tbrain.js:1021` — три ветки ключа `ppFar` (пост-плант с дистанции, v159): было `rArea: BAL.ppFar ? 420 : 320, rMin: BAL.ppFar ? 180 : 90,
rMax: BAL.ppFar ? 520 : 420` — выброшены 320 / 90 / 420 (старый пост-плант вплотную). `620_draw.js:791` — `if(false){…}` стоял в коде
литералом ещё до свёртки (мёртвый показ линии взгляда), убран той же свёрткой.
- (ветка ?: (ложь)) `src/game/170_tbrain.js:1021`:

```js
320
```
- (ветка ?: (ложь)) `src/game/170_tbrain.js:1021`:

```js
90
```
- (ветка ?: (ложь)) `src/game/170_tbrain.js:1021`:

```js
420
```
- (if(ложь)) `src/game/620_draw.js:791`:

```js
{
      var fx = rx + Math.cos(vf)*r*1.8;
      var fy = ry + Math.sin(vf)*r*1.8;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2/view.scale;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(fx,fy); ctx.stroke();
    }
```

## Вручную (свёрнуто без смены значения)
- `src/game/170_tbrain.js` (`lateGrace`): `secLeft < 35 || !BAL.syncExec || …` → `secLeft < 35 || …` (`syncExec` = true).
- `src/game/420_nades_brains.js:193`: `(call.count >= 2 || BAL.ctUtilEarly)` → убрано целиком (`ctUtilEarly` = true; сравнение без
  побочных действий). Выброшено: `call.count >= 2` — старое правило «смок по входу только после второго колла».

## Оставлены
- `egPair` = false — единственный выключенный (v157), по плану не трогаем: выбросить его код — только по реестру с согласия владельца.
- `execErr` = true — его выключают инструменты (`tools/nades/*`, `tools/tests/*`: `BAL.execErr = false`), не вечный.
- `ppFix` — в `BAL` нет (всегда `undefined`), читает `170_tbrain.js` (`=== true`), ставит `tools/diag/mf.js` — разобрать в мёртвом коде.
