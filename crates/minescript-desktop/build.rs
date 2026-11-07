use url::Url;

const BASE_VAR: &str = "MINESCRIPT_BASE_URL";
const DEFAULT_BASE: &str = "https://csapat13.dusza.cloudsyso.com/";

fn main() {
    println!("cargo:rerun-if-env-changed={BASE_VAR}");
    let configured = std::env::var(BASE_VAR)
        .ok()
        .filter(|raw| !raw.trim().is_empty());
    let raw = configured.as_deref().unwrap_or(DEFAULT_BASE).trim();
    match Url::parse(raw) {
        Ok(url) if matches!(url.scheme(), "http" | "https") && url.host_str().is_some() => {
            println!("cargo:rustc-env=MINESCRIPT_DESKTOP_BASE_URL={url}");
            if configured.is_some() {
                println!("cargo:warning=MineScript Desktop base URL: {url}");
            }
        }
        _ => {
            eprintln!("{BASE_VAR} must be an absolute http(s) URL, got: {raw}");
            std::process::exit(1);
        }
    }
    tauri_build::build();
}
