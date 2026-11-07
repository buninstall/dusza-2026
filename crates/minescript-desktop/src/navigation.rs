use url::Url;

use crate::target::Target;

#[derive(Debug, PartialEq, Eq)]
pub enum Route {
    Inside,
    Rewrite(Url),
    External,
    Blocked,
}

pub fn classify(url: &Url, target: &Target) -> Route {
    if matches!(url.scheme(), "tauri" | "about" | "blob" | "data")
        || is_bundled(url)
        || same_origin(url, target.app_origin())
    {
        return Route::Inside;
    }
    if let Some(local) = &target.local
        && same_origin(url, &target.remote)
    {
        return Route::Rewrite(rebase(url, local));
    }
    match url.scheme() {
        "http" | "https" | "mailto" => Route::External,
        _ => Route::Blocked,
    }
}

pub fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

pub fn rebase(url: &Url, origin: &Url) -> Url {
    let mut rebased = origin.clone();
    rebased.set_path(url.path());
    rebased.set_query(url.query());
    rebased.set_fragment(url.fragment());
    rebased
}

fn is_bundled(url: &Url) -> bool {
    url.host_str() == Some("tauri.localhost")
}

#[cfg(test)]
mod tests {
    use super::{Route, classify};
    use crate::target::Target;
    use url::Url;

    const REMOTE: &str = "https://csapat13.dusza.cloudsyso.com/";

    fn direct(raw: &str) -> Route {
        let target = Target {
            remote: Url::parse(REMOTE).unwrap(),
            local: None,
        };
        classify(&Url::parse(raw).unwrap(), &target)
    }

    fn gateway(raw: &str) -> Route {
        let target = Target {
            remote: Url::parse(REMOTE).unwrap(),
            local: Some(Url::parse("minescript://localhost/").unwrap()),
        };
        classify(&Url::parse(raw).unwrap(), &target)
    }

    #[test]
    fn keeps_the_game_and_the_splash_inside() {
        assert_eq!(
            direct("https://csapat13.dusza.cloudsyso.com/play/3"),
            Route::Inside
        );
        assert_eq!(direct("tauri://localhost/index.html"), Route::Inside);
        assert_eq!(direct("http://tauri.localhost/index.html"), Route::Inside);
        assert_eq!(
            direct("blob:https://csapat13.dusza.cloudsyso.com/abc"),
            Route::Inside
        );
    }

    #[test]
    fn sends_foreign_links_to_the_browser() {
        assert_eq!(
            direct("https://github.com/futozs/dusza-2026"),
            Route::External
        );
        assert_eq!(
            direct("http://csapat13.dusza.cloudsyso.com/"),
            Route::External
        );
        assert_eq!(direct("mailto:csapat13@example.com"), Route::External);
    }

    #[test]
    fn blocks_everything_else() {
        assert_eq!(direct("file:///etc/passwd"), Route::Blocked);
        assert_eq!(direct("javascript:alert(1)"), Route::Blocked);
        assert_eq!(direct("minescript://localhost/"), Route::Blocked);
    }

    #[test]
    fn gateway_mode_keeps_server_links_behind_the_gateway() {
        assert_eq!(gateway("minescript://localhost/play/3"), Route::Inside);
        assert_eq!(
            gateway("https://csapat13.dusza.cloudsyso.com/play/3?x=1"),
            Route::Rewrite(Url::parse("minescript://localhost/play/3?x=1").unwrap())
        );
        assert_eq!(gateway("https://github.com/"), Route::External);
    }
}
