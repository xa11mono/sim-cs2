fn main() {
    #[cfg(feature = "napi")]
    {
        let gnu_windows = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("gnu");
        if !gnu_windows { napi_build::setup(); }
    }
}
