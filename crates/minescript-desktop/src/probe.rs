use std::time::Duration;

use tauri::http::StatusCode;
use tauri::{AppHandle, Manager};

use crate::target::Target;

const HEALTH_PATH: &str = "api/health";
const TIMEOUT: Duration = Duration::from_secs(8);

#[tauri::command]
pub async fn probe(app: AppHandle) -> &'static str {
    let remote = app.state::<Target>().remote.clone();
    let Ok(url) = remote.join(HEALTH_PATH) else {
        return "offline";
    };
    let Ok(client) = reqwest::Client::builder().timeout(TIMEOUT).build() else {
        return "offline";
    };
    let mut request = client.get(url);
    if let Some(token) = crate::gateway::token() {
        request = request.header(crate::gateway::HEADER, token);
    }
    match request.send().await {
        Ok(response) => verdict(response.status()),
        Err(_) => "offline",
    }
}

fn verdict(status: StatusCode) -> &'static str {
    if status == StatusCode::UNAUTHORIZED {
        "denied"
    } else if status.is_server_error() {
        "offline"
    } else {
        "ok"
    }
}

#[cfg(test)]
mod tests {
    use super::verdict;
    use tauri::http::StatusCode;

    #[test]
    fn status_maps_to_splash_state() {
        assert_eq!(verdict(StatusCode::OK), "ok");
        assert_eq!(verdict(StatusCode::FORBIDDEN), "ok");
        assert_eq!(verdict(StatusCode::UNAUTHORIZED), "denied");
        assert_eq!(verdict(StatusCode::BAD_GATEWAY), "offline");
    }
}
