// (Р0.13, 25.11) napi-build на windows-gnu требует libnode.dll (Node как разделяемая библиотека) — в официальном Node для Windows её нет.
// napi-sys на Windows берёт функции Node из процесса во время работы (libloading), компоновка с Node не нужна — поэтому на windows-gnu
// setup() не вызывается. На остальных целях — как раньше.
fn main() {
    let gnu_windows = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("gnu");
    if !gnu_windows { napi_build::setup(); }
}
