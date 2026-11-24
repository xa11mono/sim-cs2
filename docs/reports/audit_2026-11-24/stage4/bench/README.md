# Прототипы этапа 4 (игра не меняется)

Из этой папки; Rust stable с целью `wasm32-unknown-unknown`, Node 22, Playwright (Chromium из окружения). `target/`, `*.bin`, `*.node`,
`standalone.html`, `cmp20k.json`, `sens_*.json` — в репозиторий не кладутся.

1. `cargo build --release --manifest-path prec/Cargo.toml` и `… --target wasm32-unknown-unknown --lib`; `(cd prec && ./target/release/dump 200000)`.
2. `node node_cmp.js` — Math JS против Rust std / libm, нативно и WASM (→ `node_result.json`).
3. `node make_standalone.js && node br.js` — то же в Chromium по `file://`: главный поток и Worker из Blob, WASM внутри HTML.
4. `node br2.js && python3 cr_check.py` — какая реализация правильно округлена (нужен `pip install mpmath`).
5. `node game_sens.js base 20000 a`, `… base 20000 b`, `… libm 20000 a` — матч 3 как есть дважды и с `Math` из libm; нужен `sim.html`
   в корне (`python3 src/build.py`).
6. `cargo build --release --manifest-path nap/Cargo.toml && cp nap/target/release/libnap.so nap/nap.node && node napi_bench.js` — цена вызова
   JS / WASM / N-API.
