# Карта новых имён файлов (предложение, не выполнено)

Этап 4, 24.11.2026. 90 файлов `src/game` → структура без числовых префиксов (`ARCHITECTURE_ADDENDUM.md` §7). Карта проверена скриптом:
учтены все файлы, новые имена не повторяются. Распределение: `engine/bot` 15, `engine/team` 11, `engine/nades` 9, `engine/match` 7,
`engine/know` 6, `engine/map` 5, `engine/nav` 3, `engine/sense` 3, `engine/core` 2 (+ `dmath`, `types`, `state` — новые), `engine/debug` 1,
`view` 9, `view/editors` 6, `view/hud` 6, `view/page` 5, `view/debug` 2.

Как выполнять (`ROADMAP_CHANGES.md`, Р4): только когда порядок загрузки задан импортами или списком `engine/order.json`; одним шагом
переименования **без правки кода**; отпечаток бит в бит; тем же скриптом — ссылки в `rebuild/*.json`, `CLAUDE.md` («Где что»),
`docs/ARCHITECTURE.md`, инструментах и комментариях вида «(110)». Расширение `.ts` — когда файл действительно переведён на TypeScript
(до этого — `.js` с тем же именем). Крупные файлы, которые правила проекта велят делить (`tBrain`, `ctBrain`, `stepTick`, `draw`,
`640_scoreboard_players.js` — 593 КБ), делятся **после** переименования, отдельными шагами.

| сейчас | станет | слой |
|---|---|---|
| `000_head.html` | `view/page/head.html` | view |
| `001_fonts.html` | `view/page/fonts.html` | view |
| `002_style.html` | `view/page/style.html` | view |
| `004_markup.html` | `view/page/markup.html` | view |
| `010_map_zones_warp.js` | `engine/map/zones.ts` | engine |
| `020_map_navmesh_autowalls.js` | `engine/nav/navmesh.ts` | engine |
| `030_map_walls_heights_cover_wallbang.js` | `engine/map/walls-heights-cover.ts` | engine |
| `035_map3d.js` | `engine/map/geometry3d.ts` | engine |
| `040_visibility.js` | `engine/sense/vision.ts` | engine |
| `050_nav_rebuild_paths.js` | `engine/nav/paths.ts` | engine |
| `060_zone_danger_user_zones.js` | `engine/map/zone-danger.ts` | engine |
| `070_weapons_bots_roam.js` | `engine/match/weapons-bots.ts` | engine |
| `080_bal.js` | `engine/core/tuning.ts` | engine |
| `090_profiles_teams.js` | `engine/team/rosters.ts` | engine |
| `100_sites_spots.js` | `engine/map/sites-spots.ts` | engine |
| `110_post_routes.js` | `engine/bot/task.ts` | engine |
| `120_bomb.js` | `engine/match/bomb.ts` | engine |
| `130_tactics_match_adapt.js` | `engine/team/tactics.ts` | engine |
| `140_named_spots_ct_setup.js` | `engine/team/ct-setup.ts` | engine |
| `150_lurker_probes_clear.js` | `engine/team/lurker.ts` | engine |
| `160_igl_replan.js` | `engine/team/igl.ts` | engine |
| `170_tbrain.js` | `engine/bot/brain-t.ts` | engine |
| `180_save_retake.js` | `engine/team/save-retake.ts` | engine |
| `190_team_intel_lkp_calls.js` | `engine/know/intel.ts` | engine |
| `200_belief_reach.js` | `engine/know/reach.ts` | engine |
| `210_know_hyp.js` | `engine/know/knowledge.ts` | engine |
| `220_know_events_tick.js` | `engine/know/events.ts` | engine |
| `230_team_voice.js` | `engine/know/voice.ts` | engine |
| `240_belief_tick.js` | `engine/know/belief.ts` | engine |
| `250_look_prepeek_corners.js` | `engine/bot/look-peek.ts` | engine |
| `260_look_threat.js` | `engine/bot/look-threat.ts` | engine |
| `270_look_plan_smooth.js` | `engine/bot/look.ts` | engine |
| `275_look_turn.js` | `engine/bot/turn.ts` | engine |
| `280_pos_pref_hold.js` | `engine/bot/position.ts` | engine |
| `290_smoke_react.js` | `engine/nades/smoke-react.ts` | engine |
| `300_roles_fallback_rebalance.js` | `engine/team/roles.ts` | engine |
| `310_pro_positions.js` | `engine/team/pro-positions.ts` | engine |
| `320_pro_lineups_ct_early.js` | `engine/team/ct-early.ts` | engine |
| `330_endgame_smoke_push.js` | `engine/team/endgame.ts` | engine |
| `340_ctbrain.js` | `engine/bot/brain-ct.ts` | engine |
| `350_contact_reaction.js` | `engine/bot/contact.ts` | engine |
| `360_nades_buy_smoke_vision.js` | `engine/nades/smoke.ts` | engine |
| `365_nade_plan.js` | `engine/nades/plan.ts` | engine |
| `366_exec_sync.js` | `engine/nades/exec-sync.ts` | engine |
| `370_fire_nav_levels_ladders.js` | `engine/nav/levels.ts` | engine |
| `380_nades_throw.js` | `engine/nades/throw.ts` | engine |
| `385_nades_flight.js` | `engine/nades/flight.ts` | engine |
| `390_nades_lineups.js` | `engine/nades/lineups.ts` | engine |
| `400_nades_physics_damage.js` | `engine/match/damage.ts` | engine |
| `410_nades_tactical_self.js` | `engine/nades/self.ts` | engine |
| `420_nades_brains.js` | `engine/nades/decide.ts` | engine |
| `430_fov_roam.js` | `engine/sense/fov.ts` | engine |
| `435_match_events.js` | `engine/match/journal.ts` | engine |
| `440_voicepanel_console.js` | `view/hud/voice-console.js` | view |
| `450_combat_items_knife.js` | `engine/match/items.ts` | engine |
| `460_sound_situations.js` | `engine/sense/sound.ts` | engine |
| `470_fight_cycle.js` | `engine/bot/fight.ts` | engine |
| `480_assist_flank_reload.js` | `engine/bot/assist.ts` | engine |
| `490_shoot.js` | `engine/bot/shoot.ts` | engine |
| `495_highlights.js` | `view/hud/highlights.js` | view |
| `500_decide_afterkill_cover.js` | `engine/bot/fight-state.ts` | engine |
| `510_engagements.js` | `engine/bot/engagements.ts` | engine |
| `520_economy.js` | `engine/team/economy.ts` | engine |
| `530_round_sides_match.js` | `engine/match/round.ts` | engine |
| `535_move_mode.js` | `engine/bot/move.ts` | engine |
| `540_step_tick.js` | `engine/core/tick.ts` | engine |
| `545_problem_watch.js` | `engine/match/watch.ts` | engine |
| `550_render_nav_zone_tools.js` | `view/editors/nav-zones.js` | view |
| `560_lineup_zone_editor.js` | `view/editors/lineups.js` | view |
| `570_maped_core_walls.js` | `view/editors/map-walls.js` | view |
| `580_maped_heights.js` | `view/editors/map-heights.js` | view |
| `590_maped_cover.js` | `view/editors/map-cover.js` | view |
| `600_maped_wallbang.js` | `view/editors/map-wallbang.js` | view |
| `610_vistool_lookdebug.js` | `view/debug/look.js` | view |
| `612_team_debug.js` | `view/debug/team.js` | view |
| `620_draw.js` | `view/draw.js` | view |
| `625_view3d.js` | `view/view3d.js` | view |
| `630_killfeed_banners_econ.js` | `view/hud/killfeed.js` | view |
| `635_hud_fx.js` | `view/hud/fx.js` | view |
| `640_scoreboard_players.js` | `view/hud/scoreboard.js` | view |
| `645_decision_log.js` | `engine/debug/trace.ts` | engine |
| `650_marks_hook.js` | `view/marks-hook.js` | view |
| `660_warmup.js` | `view/warmup.js` | view |
| `670_observer.js` | `view/observer.js` | view |
| `675_replay.js` | `view/replay.js` | view |
| `676_timeout_show.js` | `view/hud/timeout.js` | view |
| `677_sandbox.js` | `view/sandbox.js` | view |
| `678_demo_view.js` | `view/demo.js` | view |
| `680_sound_frame_buttons.js` | `view/app.js` | view |
| `990_tail.html` | `view/page/tail.html` | view |
