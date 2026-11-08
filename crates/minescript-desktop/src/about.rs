use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, Theme, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

use crate::target::Target;
use crate::window::{APP_NAME, BACKGROUND, bootstrap};

pub const LABEL: &str = "about";

pub fn show(app: &AppHandle) -> tauri::Result<()> {
    if let Some(existing) = app.get_webview_window(LABEL) {
        existing.unminimize()?;
        existing.show()?;
        return existing.set_focus();
    }

    let opener = app.clone();
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("about.html".into()))
        .title(format!("A {APP_NAME} névjegye"))
        .inner_size(360.0, 500.0)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .center()
        .visible(false)
        .theme(Some(Theme::Dark))
        .background_color(BACKGROUND)
        .title_bar_style(tauri::TitleBarStyle::Transparent)
        .hidden_title(true)
        .initialization_script(bootstrap(app, &app.state::<Target>()))
        .on_navigation(move |url| {
            if url.scheme() == "tauri" {
                return true;
            }
            if matches!(url.scheme(), "http" | "https") {
                let _ = opener.opener().open_url(url.as_str(), None::<&str>);
            }
            false
        })
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .build()?;
    Ok(())
}
