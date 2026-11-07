use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

use crate::target::Target;
use crate::window::APP_NAME;

const MANIFEST_PATH: &str = "api/desktop/latest.json";
const DISABLE_VAR: &str = "MINESCRIPT_NO_UPDATE";
const FIRST_CHECK: Duration = Duration::from_secs(5);
const RECHECK: Duration = Duration::from_hours(6);
const TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Default)]
pub struct Declined(Mutex<Option<String>>);

pub fn enabled() -> bool {
    !cfg!(debug_assertions)
        && std::env::var(DISABLE_VAR)
            .ok()
            .is_none_or(|value| value.trim().is_empty() || value.trim() == "0")
}

pub fn manifest_url(remote: &Url) -> Option<Url> {
    remote.join(MANIFEST_PATH).ok()
}

pub fn spawn(app: &AppHandle) {
    app.manage(Declined::default());
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_CHECK).await;
        loop {
            if let Err(error) = check_once(&app).await {
                eprintln!("MineScript Desktop frissítés: {error}");
            }
            tokio::time::sleep(RECHECK).await;
        }
    });
}

async fn check_once(app: &AppHandle) -> Result<(), String> {
    let remote = app.state::<Target>().remote.clone();
    let endpoint = manifest_url(&remote).ok_or("érvénytelen frissítési cím")?;
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|error| error.to_string())?
        .timeout(TIMEOUT)
        .build()
        .map_err(|error| error.to_string())?;
    let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
        return Ok(());
    };
    if already_declined(app, &update.version) {
        return Ok(());
    }
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    if ask(app, &update).await {
        update.install(&bytes).map_err(|error| error.to_string())?;
        app.restart();
    }
    remember_declined(app, &update.version);
    Ok(())
}

fn already_declined(app: &AppHandle, version: &str) -> bool {
    app.state::<Declined>()
        .0
        .lock()
        .is_ok_and(|slot| slot.as_deref() == Some(version))
}

fn remember_declined(app: &AppHandle, version: &str) {
    if let Ok(mut slot) = app.state::<Declined>().0.lock() {
        *slot = Some(version.to_owned());
    }
}

async fn ask(app: &AppHandle, update: &Update) -> bool {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.dialog()
        .message(prompt(&update.current_version, &update.version))
        .title(APP_NAME)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Frissítés és újraindítás".to_owned(),
            "Később".to_owned(),
        ))
        .show(move |accepted| {
            let _ = sender.send(accepted);
        });
    receiver.await.unwrap_or(false)
}

fn prompt(current: &str, next: &str) -> String {
    format!(
        "Elérhető a {APP_NAME} új verziója: {next} (jelenlegi: {current}).\n\nA frissítés letöltődött. Telepíted most? A program újraindul, a munkád a szerveren megmarad."
    )
}

#[cfg(test)]
mod tests {
    use super::{manifest_url, prompt};
    use url::Url;

    #[test]
    fn manifest_lives_under_the_server_api() {
        let remote = Url::parse("https://csapat13.dusza.cloudsyso.com/").unwrap();
        assert_eq!(
            manifest_url(&remote).unwrap().as_str(),
            "https://csapat13.dusza.cloudsyso.com/api/desktop/latest.json"
        );
        let local = Url::parse("http://localhost:8080").unwrap();
        assert_eq!(
            manifest_url(&local).unwrap().as_str(),
            "http://localhost:8080/api/desktop/latest.json"
        );
    }

    #[test]
    fn prompt_names_both_versions() {
        let text = prompt("0.1.3", "0.1.7");
        assert!(text.contains("0.1.3"));
        assert!(text.contains("0.1.7"));
    }
}
