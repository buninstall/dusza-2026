use url::Url;

use crate::navigation::{rebase, same_origin};

const BASE_URL: &str = env!("MINESCRIPT_DESKTOP_BASE_URL");
const OVERRIDE_VAR: &str = "MINESCRIPT_URL";
const SPLASH_PATH: &str = "__shell/index.html";

pub struct Target {
    pub remote: Url,
    pub local: Option<Url>,
}

impl Target {
    pub fn app_origin(&self) -> &Url {
        self.local.as_ref().unwrap_or(&self.remote)
    }

    pub fn splash(&self) -> Option<Url> {
        self.local
            .as_ref()
            .and_then(|local| local.join(SPLASH_PATH).ok())
    }

    #[cfg(any(target_os = "macos", test))]
    pub fn to_remote(&self, url: &Url) -> Url {
        match &self.local {
            Some(local) if same_origin(url, local) => rebase(url, &self.remote),
            _ => url.clone(),
        }
    }
}

pub fn resolve_remote() -> Result<Url, String> {
    choose(std::env::var(OVERRIDE_VAR).ok().as_deref())
}

fn choose(override_url: Option<&str>) -> Result<Url, String> {
    match override_url.filter(|raw| !raw.trim().is_empty()) {
        Some(raw) => {
            parse(raw).ok_or_else(|| format!("A {OVERRIDE_VAR} értéke érvénytelen: {raw}"))
        }
        None => parse(BASE_URL).ok_or_else(|| format!("A beépített cím érvénytelen: {BASE_URL}")),
    }
}

fn parse(raw: &str) -> Option<Url> {
    Url::parse(raw.trim())
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https") && url.host_str().is_some())
}

#[cfg(test)]
mod tests {
    use super::{BASE_URL, Target, choose, parse};
    use url::Url;

    #[test]
    fn built_in_address_is_used_without_override() {
        assert_eq!(
            choose(None).unwrap().as_str(),
            parse(BASE_URL).unwrap().as_str()
        );
        assert_eq!(
            choose(Some("  ")).unwrap().as_str(),
            parse(BASE_URL).unwrap().as_str()
        );
    }

    #[test]
    fn override_wins_over_the_built_in_address() {
        assert_eq!(
            choose(Some("http://localhost:5173")).unwrap().as_str(),
            "http://localhost:5173/"
        );
    }

    #[test]
    fn invalid_override_is_an_error_not_a_silent_fallback() {
        assert!(choose(Some("localhost:5173")).is_err());
        assert!(choose(Some("file:///tmp")).is_err());
    }

    #[test]
    fn accepts_http_and_https() {
        assert!(parse("http://localhost:5173").is_some());
        assert!(parse(" https://example.com/ ").is_some());
    }

    #[test]
    fn rejects_other_schemes_and_garbage() {
        assert!(parse("file:///etc/passwd").is_none());
        assert!(parse("javascript:alert(1)").is_none());
        assert!(parse("nem url").is_none());
    }

    #[test]
    fn maps_gateway_urls_back_to_the_server() {
        let target = Target {
            remote: Url::parse("https://csapat13.dusza.cloudsyso.com/").unwrap(),
            local: Some(Url::parse("minescript://localhost/").unwrap()),
        };
        let local = Url::parse("minescript://localhost/play/3?step=2#top").unwrap();
        assert_eq!(
            target.to_remote(&local).as_str(),
            "https://csapat13.dusza.cloudsyso.com/play/3?step=2#top"
        );
        assert_eq!(
            target.splash().unwrap().as_str(),
            "minescript://localhost/__shell/index.html"
        );
    }
}
