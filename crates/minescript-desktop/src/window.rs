use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::window::Color;
use tauri::{AppHandle, Manager, Theme, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use url::Url;

use crate::downloads;
use crate::navigation::{Route, classify};
use crate::target::Target;

pub const MAIN: &str = "main";
pub const APP_NAME: &str = "MineScript Desktop";
pub const BACKGROUND: Color = Color(0x11, 0x0f, 0x0d, 0xff);

pub fn open(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let target = app.state::<Target>();
    let start = target.splash().map_or_else(
        || WebviewUrl::App("index.html".into()),
        WebviewUrl::External,
    );
    let bootstrap = bootstrap(&target);

    let navigation_app = app.clone();
    let popup_app = app.clone();

    let builder = WebviewWindowBuilder::new(app, MAIN, start)
        .title(APP_NAME)
        .inner_size(1440.0, 900.0)
        .min_inner_size(960.0, 600.0)
        .center()
        .visible(false)
        .theme(Some(Theme::Dark))
        .background_color(BACKGROUND)
        .initialization_script(bootstrap)
        .use_https_scheme(true)
        .zoom_hotkeys_enabled(!cfg!(target_os = "macos"))
        .on_navigation(
            move |url| match classify(url, &navigation_app.state::<Target>()) {
                Route::Inside => true,
                Route::Rewrite(local) => {
                    navigate(&navigation_app, local);
                    false
                }
                Route::External => {
                    open_external(&navigation_app, url);
                    false
                }
                Route::Blocked => false,
            },
        )
        .on_new_window(move |url, _features| {
            match classify(&url, &popup_app.state::<Target>()) {
                Route::Inside => navigate(&popup_app, url),
                Route::Rewrite(local) => navigate(&popup_app, local),
                Route::External => open_external(&popup_app, &url),
                Route::Blocked => {}
            }
            NewWindowResponse::Deny
        })
        .on_document_title_changed(|window, title| {
            let _ = window.set_title(&window_title(&title));
        })
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished && !window.is_visible().unwrap_or(true) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .on_download(downloads::handler(app.clone()));

    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Transparent);

    let window = builder.build()?;

    #[cfg(target_os = "macos")]
    crate::zoom::restore(app, &window);

    Ok(window)
}

pub fn reveal(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN) else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
pub fn hide_on_close(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event
        && window.label() == MAIN
        && !window.is_fullscreen().unwrap_or(false)
    {
        api.prevent_close();
        let _ = window.hide();
    }
}

fn window_title(page: &str) -> String {
    let page = page.trim();
    if page.is_empty() || page == "MineScript" || page == APP_NAME {
        APP_NAME.to_owned()
    } else {
        format!("{page} · {APP_NAME}")
    }
}

fn navigate(app: &AppHandle, url: Url) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.navigate(url);
    }
}

fn open_external(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

pub fn bootstrap(target: &Target) -> String {
    let shell = serde_json::json!({
        "url": target.remote.as_str(),
        "gateway": target.local.is_some(),
        "tauri": tauri::VERSION,
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
    });
    include_str!("bootstrap.js").replace("__SHELL__", &shell.to_string())
}

#[cfg(test)]
mod tests {
    use super::window_title;

    #[test]
    fn window_title_always_names_the_desktop_app() {
        assert_eq!(window_title("MineScript"), "MineScript Desktop");
        assert_eq!(window_title("  "), "MineScript Desktop");
        assert_eq!(window_title("Ranglista"), "Ranglista · MineScript Desktop");
    }
}
