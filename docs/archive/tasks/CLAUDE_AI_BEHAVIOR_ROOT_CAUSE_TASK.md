# Claude task — root-cause analysis of 34 sim-cs2 incidents (NO CODE CHANGES)

Repository: https://github.com/xa11mono/sim-cs2

Read first:
- `docs/reports/AI_BEHAVIOR_ROOT_CAUSE_AUDIT_34_ISSUES.md`
- `docs/reports/evidence/2026-10-29_ai_behavior_observations.md`
- `CLAUDE.md`, `docs/PRINCIPLES.md`, existing regression plans and prior reports
- current implementation and git history related to tactical planning, movement/path replanning, nade tasks, perception/knowledge, combat actions, pause/round state, replay/UI, and 3D hit testing.

## Absolute instruction

This task is analysis only. Do not edit files, do not make patches, do not run formatters/migrations, do not change config/data, and do not commit. Do not claim a fix has been implemented. Wait for explicit owner approval before coding.

The original screenshots referred to in the user's message are not currently attached to this evidence bundle. Do not invent what they show. Use text observations as incident reports, and mark conclusions based only on text as hypotheses until code/log evidence confirms them.

## Required investigation

1. Verify current commit/branch, dirty working tree, and actual code paths. Never rely solely on old docs or previous assistant claims.
2. Preserve all 34 original observations; do not rewrite the user's symptom into a more convenient problem.
3. For each observation, determine whether the defect is reproducible from code, has a related test/log, or requires screenshots/replay data. Attach source paths and current line numbers.
4. Inspect prior commits/branches and prior attempts. For each recurring defect, explain why previous changes did not change the observable runtime outcome.
5. Start with a passive diagnostic trace for goal/path changes and lineup task lifecycle (OBS-12 and OBS-01/02/06/30). Then continue with tactic reassignment, knowledge/coverage, combat priorities, round/clutch lifecycle, and 3D cross-floor hit testing.
6. Investigate common root causes, but do not group issues merely because they look similar. A proposed shared root cause must explain each linked incident and list evidence that could falsify it.
7. Build a table for each issue: exact original observation, current execution path, candidate cause, evidence, competing hypotheses, proposed correction, affected systems, regression risks, test and acceptance criterion.
8. Check that tests verify outcomes, not merely that code runs. Require same-seed baseline/candidate comparisons and incident-level metrics; win rate alone is insufficient.
9. Do not alter game mechanics based only on plausible CS2 knowledge. Verify game-specific claims against reliable sources or in-game/replay data and label approximation vs confirmed mechanics.

## High-risk mechanisms to inspect

- One authoritative goal arbiter vs competing tactical/anchor/flank/lineup/support goals.
- Task owner, plan version, TTL/deadline, cancel reason, retry and reassignment behavior.
- Tactical plan lifecycle across coach/IGL calls, pause/resume, player death, execute and save.
- Per-agent knowledge vs ground truth; sound/visual/team communication source and age.
- `unknown` vs `empty` site state and checked-position coverage.
- Threat memory, incoming damage, HE avoidance, reload safety and smoke shooting.
- Post-plant position assignment, crossfire diversity, flank commitment and defuse contest decision.
- Authoritative alive counts, clutch predicate, round-end winner, reactions/replays event IDs.
- Replay seek/render/camera lifecycle and the 3D ray/hitbox/geometry coordinate contract.

The candidate files mentioned in older context include `130_tactics_match_adapt.js`, `160_igl_replan.js`, `170_tbrain.js`, `340_ctbrain.js`, `380_nades_throw.js`, `400_nades_physics_damage.js`, `035_map3d.js`. Verify their current existence and callers; do not assume they are the current root cause or that every issue belongs there.

## Required report

- Executive summary: confirmed causes vs hypotheses, no inflated counts.
- Evidence for all 34 incidents, including code paths and event timelines where available.
- Common-root-cause graph and explanation of which incidents are genuinely linked.
- Prior-fix/rollback analysis with commit hashes if accessible.
- The smallest risk-controlled correction plan in dependency order.
- For each proposed change: why it addresses the proven cause, possible regressions, tests, metrics and rollback condition.
- Explicitly list missing artifacts/data (especially screenshots/replay ticks) without fabricating them.
- State whether the working tree remained unchanged.

Do not start implementation at the end of the report. Stop and wait for approval.

## Success criterion

The analysis is useful only if a developer can reproduce or falsify each claim and knows exactly what evidence is still missing. Prefer “not proven yet; inspect this event/state/path” over an unsupported confident diagnosis.
