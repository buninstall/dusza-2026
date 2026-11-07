use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::webview::DownloadEvent;
use tauri::{AppHandle, Webview};
use tauri_plugin_opener::OpenerExt;

pub fn handler(
    app: AppHandle,
) -> impl Fn(Webview, DownloadEvent<'_>) -> bool + Send + Sync + 'static {
    let pending: Arc<Mutex<Option<PathBuf>>> = Arc::default();
    move |_, event| {
        match event {
            DownloadEvent::Requested { destination, .. } => {
                if let Ok(mut slot) = pending.lock() {
                    *slot = Some(destination.clone());
                }
            }
            DownloadEvent::Finished { path, success, .. } => {
                let remembered = pending.lock().ok().and_then(|mut slot| slot.take());
                if success
                    && let Some(file) = path.filter(|p| !p.as_os_str().is_empty()).or(remembered)
                {
                    let _ = app.opener().reveal_item_in_dir(file);
                }
            }
            _ => {}
        }
        true
    }
}
