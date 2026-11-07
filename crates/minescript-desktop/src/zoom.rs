use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, WebviewWindow};

const LEVELS: [f64; 11] = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
const DEFAULT: usize = 5;

pub struct Zoom(Mutex<usize>);

impl Default for Zoom {
    fn default() -> Self {
        Self(Mutex::new(DEFAULT))
    }
}

pub enum Step {
    In,
    Out,
    Reset,
}

pub fn restore(app: &AppHandle, window: &WebviewWindow) {
    let saved = file(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| raw.trim().parse::<usize>().ok())
        .filter(|index| *index < LEVELS.len());
    if let Some(index) = saved {
        apply(app, window, index);
    }
}

pub fn step(app: &AppHandle, window: &WebviewWindow, step: &Step) {
    let current = app.state::<Zoom>().0.lock().map_or(DEFAULT, |index| *index);
    let next = match step {
        Step::In => (current + 1).min(LEVELS.len() - 1),
        Step::Out => current.saturating_sub(1),
        Step::Reset => DEFAULT,
    };
    apply(app, window, next);
    if let Some(path) = file(app) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(path, next.to_string());
    }
}

fn apply(app: &AppHandle, window: &WebviewWindow, index: usize) {
    let Some(level) = LEVELS.get(index) else {
        return;
    };
    if window.set_zoom(*level).is_ok()
        && let Ok(mut current) = app.state::<Zoom>().0.lock()
    {
        *current = index;
    }
}

fn file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("zoom"))
}
