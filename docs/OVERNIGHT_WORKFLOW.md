# sim-cs2 — workflow for long autonomous Claude Code sessions

## Choose the right environment

- For work that should continue after closing the browser: use Claude Code on the web at `claude.ai/code`, select the connected `xa11mono/sim-cs2` GitHub repository, and select a dedicated feature branch. Cloud sessions run in an isolated environment and typically push a branch and prepare a PR when done; review before merging. Ensure all relevant project instructions are committed to the repository because cloud sessions do not inherit files stored only on your local computer.
- For work requiring the local game install, local replay files, local demos or local tools: use Claude Code in Desktop local mode or a terminal opened in the repository root. A local session depends on the computer and process remaining available.
- A normal Claude chat with GitHub files attached is useful for code review and discussion, but it is not by itself the same as an active Claude Code coding session.

## Starting a task
1. Verify the repository and branch shown in the interface. Do not work against the wrong repo or default branch.
2. Confirm `CLAUDE.md` is present at the repository root and the relevant `docs/` requirements have actually been added/committed.
3. First run a read-only baseline review: working tree, recent history, available tests, and current failures.
4. Then authorize implementation in stages. Do not ask for a complete rewrite of every issue in one patch.
5. Enable only appropriate project/file/test permissions. Never use unrestricted permission bypass simply to avoid approvals.
6. Keep pushes limited to an isolated branch / PR. Do not auto-merge.

## When a session stops
Read `docs/OVERNIGHT_PROGRESS.md`, `docs/OVERNIGHT_BACKLOG.md`, and `docs/OVERNIGHT_TEST_MATRIX.md`; then verify git status, last commit, and actual test results before continuing. Do not trust a previous summary without checking current files.
