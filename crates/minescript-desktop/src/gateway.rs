use std::fs;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;

use reqwest::redirect::Policy;
use reqwest_cookie_store::CookieStoreMutex;
use tauri::http::header::{self, HeaderMap, HeaderName, HeaderValue};
use tauri::http::{Method, Request, Response, StatusCode};
use tauri::{AppHandle, Manager};
use url::Url;

pub const SCHEME: &str = "minescript";
const TOKEN_VAR: &str = "MINESCRIPT_GATEWAY_TOKEN";
const HEADER: HeaderName = HeaderName::from_static("x-minescript-gateway-authorization");
const SHELL_PREFIX: &str = "/__shell/";
const SPLASH: &str = "/__shell/index.html";
const COOKIE_FILE: &str = "gateway-cookies.json";

const DROPPED_REQUEST: [HeaderName; 6] = [
    header::HOST,
    header::COOKIE,
    header::ACCEPT_ENCODING,
    header::CONTENT_LENGTH,
    header::CONNECTION,
    HEADER,
];

const DROPPED_RESPONSE: [HeaderName; 7] = [
    header::SET_COOKIE,
    header::CONTENT_ENCODING,
    header::CONTENT_LENGTH,
    header::TRANSFER_ENCODING,
    header::CONNECTION,
    header::STRICT_TRANSPORT_SECURITY,
    header::ALT_SVC,
];

pub fn token() -> Option<HeaderValue> {
    let raw = std::env::var(TOKEN_VAR).ok()?;
    let mut value = HeaderValue::from_str(raw.trim())
        .ok()
        .filter(|value| !value.is_empty())?;
    value.set_sensitive(true);
    Some(value)
}

pub fn local_origin() -> Option<Url> {
    let raw = if cfg!(windows) {
        "https://minescript.localhost/"
    } else {
        "minescript://localhost/"
    };
    Url::parse(raw).ok()
}

pub struct Gateway {
    client: reqwest::Client,
    remote: Url,
    remote_origin: String,
    local_origin: String,
    token: HeaderValue,
    jar: Arc<CookieStoreMutex>,
    jar_file: Option<PathBuf>,
}

impl Gateway {
    pub fn new(
        app: &AppHandle,
        remote: Url,
        local: &Url,
        token: HeaderValue,
    ) -> reqwest::Result<Self> {
        let jar_file = app
            .path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join(COOKIE_FILE));
        let store = jar_file
            .as_ref()
            .and_then(|path| fs::File::open(path).ok())
            .and_then(|file| cookie_store::serde::json::load(BufReader::new(file)).ok())
            .unwrap_or_default();
        let jar = Arc::new(CookieStoreMutex::new(store));
        let client = reqwest::Client::builder()
            .cookie_provider(Arc::clone(&jar))
            .redirect(Policy::none())
            .user_agent(concat!("MineScriptDesktop/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self {
            client,
            remote_origin: remote.origin().ascii_serialization(),
            local_origin: origin_of(local),
            remote,
            token,
            jar,
            jar_file,
        })
    }

    pub async fn handle(&self, app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
        let path = request.uri().path();
        if let Some(asset) = path.strip_prefix(SHELL_PREFIX) {
            return shell_asset(app, asset);
        }
        let document = is_document(&request);
        match self.forward(request).await {
            Ok(response) => response,
            Err(_) if document => redirect(SPLASH),
            Err(_) => plain(StatusCode::BAD_GATEWAY, "A szerver nem érhető el."),
        }
    }

    async fn forward(&self, request: Request<Vec<u8>>) -> reqwest::Result<Response<Vec<u8>>> {
        let (parts, body) = request.into_parts();
        let mut url = self.remote.clone();
        url.set_path(parts.uri.path());
        url.set_query(parts.uri.query());

        let mut headers = HeaderMap::with_capacity(parts.headers.len() + 1);
        for (name, value) in &parts.headers {
            if DROPPED_REQUEST.contains(name) {
                continue;
            }
            if name == header::ORIGIN {
                continue;
            }
            if name == header::REFERER {
                if let Some(value) =
                    Self::rebase_header(value, &self.local_origin, &self.remote_origin)
                {
                    headers.append(name.clone(), value);
                }
                continue;
            }
            headers.append(name.clone(), value.clone());
        }
        headers.insert(HEADER, self.token.clone());
        if !matches!(parts.method, Method::GET | Method::HEAD | Method::OPTIONS)
            && let Ok(origin) = HeaderValue::from_str(&self.remote_origin)
        {
            headers.insert(header::ORIGIN, origin);
        }

        let upstream = self
            .client
            .request(parts.method, url)
            .headers(headers)
            .body(body)
            .send()
            .await?;

        let status = upstream.status();
        let stores_cookies = upstream.headers().contains_key(header::SET_COOKIE);
        let mut response_headers = HeaderMap::with_capacity(upstream.headers().len());
        for (name, value) in upstream.headers() {
            if DROPPED_RESPONSE.contains(name) {
                continue;
            }
            if name == header::LOCATION {
                if let Some(value) =
                    Self::rebase_header(value, &self.remote_origin, &self.local_origin)
                {
                    response_headers.append(name.clone(), value);
                }
                continue;
            }
            response_headers.append(name.clone(), value.clone());
        }
        let bytes = upstream.bytes().await?;
        if stores_cookies {
            self.persist_cookies();
        }

        let mut response = Response::new(bytes.to_vec());
        *response.status_mut() = status;
        *response.headers_mut() = response_headers;
        Ok(response)
    }

    fn rebase_header(value: &HeaderValue, from: &str, to: &str) -> Option<HeaderValue> {
        let text = value.to_str().ok()?;
        match text.strip_prefix(from) {
            Some(rest) => HeaderValue::from_str(&format!("{to}{rest}")).ok(),
            None => Some(value.clone()),
        }
    }

    fn persist_cookies(&self) {
        let Some(path) = &self.jar_file else {
            return;
        };
        let Ok(store) = self.jar.lock() else {
            return;
        };
        let mut buffer = Vec::new();
        if cookie_store::serde::json::save(&store, &mut buffer).is_err() {
            return;
        }
        drop(store);
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let staging = path.with_extension("tmp");
        if fs::write(&staging, buffer).is_ok() {
            restrict(&staging);
            let _ = fs::rename(&staging, path);
        }
    }
}

pub fn unavailable() -> Response<Vec<u8>> {
    plain(StatusCode::SERVICE_UNAVAILABLE, "Az átjáró nem indult el.")
}

fn shell_asset(app: &AppHandle, path: &str) -> Response<Vec<u8>> {
    let Some(asset) = app.asset_resolver().get(path.to_owned()) else {
        return plain(StatusCode::NOT_FOUND, "Nincs ilyen fájl.");
    };
    let mut response = Response::new(asset.bytes);
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&asset.mime_type) {
        headers.insert(header::CONTENT_TYPE, value);
    }
    if let Some(value) = asset
        .csp_header
        .and_then(|csp| HeaderValue::from_str(&csp).ok())
    {
        headers.insert(header::CONTENT_SECURITY_POLICY, value);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

fn is_document(request: &Request<Vec<u8>>) -> bool {
    let headers = request.headers();
    let header_text = |name: &str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
    };
    request.method() == Method::GET
        && (header_text("sec-fetch-dest") == "document"
            || header_text("accept").contains("text/html"))
}

fn redirect(location: &'static str) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = StatusCode::SEE_OTHER;
    response
        .headers_mut()
        .insert(header::LOCATION, HeaderValue::from_static(location));
    response
}

fn plain(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    let mut response = Response::new(message.as_bytes().to_vec());
    *response.status_mut() = status;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    response
}

fn origin_of(url: &Url) -> String {
    let host = url.host_str().unwrap_or_default();
    match url.port() {
        Some(port) => format!("{}://{host}:{port}", url.scheme()),
        None => format!("{}://{host}", url.scheme()),
    }
}

#[cfg(unix)]
fn restrict(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict(_path: &std::path::Path) {}

#[cfg(test)]
mod tests {
    use super::origin_of;
    use url::Url;

    #[test]
    fn custom_scheme_origin_has_no_trailing_slash() {
        assert_eq!(
            origin_of(&Url::parse("minescript://localhost/").unwrap()),
            "minescript://localhost"
        );
        assert_eq!(
            origin_of(&Url::parse("https://minescript.localhost/").unwrap()),
            "https://minescript.localhost"
        );
    }
}
