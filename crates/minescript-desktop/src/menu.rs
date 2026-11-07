use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;
use url::Url;

use crate::about;
use crate::target::Target;
use crate::window::{APP_NAME, MAIN};
use crate::zoom::{self, Step};

const ABOUT: &str = "about";
const RELOAD: &str = "reload";
const HOME: &str = "home";
const BACK: &str = "back";
const FORWARD: &str = "forward";
const ZOOM_IN: &str = "zoom-in";
const ZOOM_OUT: &str = "zoom-out";
const ZOOM_RESET: &str = "zoom-reset";
const BROWSER: &str = "open-in-browser";
#[cfg(debug_assertions)]
const DEVTOOLS: &str = "devtools";
const SPLASH: &str = "tauri://localhost/index.html";

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let separator = || PredefinedMenuItem::separator(app);
    let item = |id: &str, text: &str, accelerator: &str| {
        MenuItem::with_id(app, id, text, true, Some(accelerator))
    };

    let application = Submenu::with_items(
        app,
        APP_NAME,
        true,
        &[
            &MenuItem::with_id(
                app,
                ABOUT,
                "A MineScript Desktop névjegye",
                true,
                None::<&str>,
            )?,
            &separator()?,
            &PredefinedMenuItem::services(app, Some("Szolgáltatások"))?,
            &separator()?,
            &PredefinedMenuItem::hide(app, Some("A MineScript Desktop elrejtése"))?,
            &PredefinedMenuItem::hide_others(app, Some("A többi elrejtése"))?,
            &PredefinedMenuItem::show_all(app, Some("Az összes mutatása"))?,
            &separator()?,
            &PredefinedMenuItem::quit(app, Some("Kilépés a MineScript Desktopból"))?,
        ],
    )?;

    let edit = Submenu::with_items(
        app,
        "Szerkesztés",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Visszavonás"))?,
            &PredefinedMenuItem::redo(app, Some("Ismétlés"))?,
            &separator()?,
            &PredefinedMenuItem::cut(app, Some("Kivágás"))?,
            &PredefinedMenuItem::copy(app, Some("Másolás"))?,
            &PredefinedMenuItem::paste(app, Some("Beillesztés"))?,
            &PredefinedMenuItem::select_all(app, Some("Az összes kijelölése"))?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        "Nézet",
        true,
        &[
            &item(RELOAD, "Újratöltés", "CmdOrCtrl+R")?,
            &item(HOME, "Kezdőlap", "CmdOrCtrl+Shift+H")?,
            &separator()?,
            &item(ZOOM_RESET, "Tényleges méret", "CmdOrCtrl+0")?,
            &item(ZOOM_IN, "Nagyítás", "CmdOrCtrl+=")?,
            &item(ZOOM_OUT, "Kicsinyítés", "CmdOrCtrl+-")?,
            &separator()?,
            &PredefinedMenuItem::fullscreen(app, Some("Teljes képernyő"))?,
            #[cfg(debug_assertions)]
            &separator()?,
            #[cfg(debug_assertions)]
            &item(DEVTOOLS, "Fejlesztői eszközök", "Alt+CmdOrCtrl+I")?,
        ],
    )?;

    let history = Submenu::with_items(
        app,
        "Előzmények",
        true,
        &[
            &item(BACK, "Vissza", "CmdOrCtrl+[")?,
            &item(FORWARD, "Előre", "CmdOrCtrl+]")?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Ablak",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("Kis méret"))?,
            &PredefinedMenuItem::maximize(app, Some("Nagyítás"))?,
            &separator()?,
            &PredefinedMenuItem::close_window(app, Some("Ablak bezárása"))?,
        ],
    )?;

    let help = Submenu::with_items(
        app,
        "Súgó",
        true,
        &[&item(
            BROWSER,
            "Megnyitás böngészőben",
            "CmdOrCtrl+Shift+O",
        )?],
    )?;

    Menu::with_items(
        app,
        &[&application, &edit, &view, &history, &window_menu, &help],
    )
}

pub fn handle(app: &AppHandle, event: &MenuEvent) {
    if event.id().as_ref() == ABOUT {
        let _ = about::show(app);
        return;
    }
    let Some(main) = app.get_webview_window(MAIN) else {
        return;
    };
    match event.id().as_ref() {
        RELOAD => {
            let _ = main.reload();
        }
        HOME => {
            let splash = app
                .state::<Target>()
                .splash()
                .or_else(|| Url::parse(SPLASH).ok());
            if let Some(splash) = splash {
                let _ = main.navigate(splash);
            }
        }
        BACK => {
            let _ = main.eval("history.back()");
        }
        FORWARD => {
            let _ = main.eval("history.forward()");
        }
        ZOOM_IN => zoom::step(app, &main, &Step::In),
        ZOOM_OUT => zoom::step(app, &main, &Step::Out),
        ZOOM_RESET => zoom::step(app, &main, &Step::Reset),
        BROWSER => {
            let target = app.state::<Target>();
            let current = main
                .url()
                .ok()
                .map(|url| target.to_remote(&url))
                .filter(|url| matches!(url.scheme(), "http" | "https"))
                .unwrap_or_else(|| target.remote.clone());
            let _ = app.opener().open_url(current.as_str(), None::<&str>);
        }
        #[cfg(debug_assertions)]
        DEVTOOLS => main.open_devtools(),
        _ => {}
    }
}
