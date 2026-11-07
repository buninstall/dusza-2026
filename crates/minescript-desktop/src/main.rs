#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
mod about;
mod downloads;
mod gateway;
#[cfg(target_os = "macos")]
mod menu;
mod navigation;
mod target;
mod window;
#[cfg(target_os = "macos")]
mod zoom;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

use crate::gateway::Gateway;
use crate::target::Target;

fn main() {
    let remote = match target::resolve_remote() {
        Ok(remote) => remote,
        Err(message) => fail(&message),
    };
    let token = gateway::token();
    let local = token.as_ref().and_then(|_| gateway::local_origin());
    let gateway_enabled = local.is_some();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::reveal(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .with_denylist(&["about"])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(Target { remote, local })
        .setup(move |app| {
            let handle = app.handle();
            let target = handle.state::<Target>();
            if let (Some(token), Some(local)) = (token.clone(), target.local.clone()) {
                handle.manage(Gateway::new(handle, target.remote.clone(), &local, token)?);
            }
            window::open(handle)?;
            Ok(())
        });

    if gateway_enabled {
        builder = builder.register_asynchronous_uri_scheme_protocol(
            gateway::SCHEME,
            |context, request, responder| {
                let app = context.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let response = match app.try_state::<Gateway>() {
                        Some(gateway) => gateway.handle(&app, request).await,
                        None => gateway::unavailable(),
                    };
                    responder.respond(response);
                });
            },
        );
    }

    #[cfg(target_os = "macos")]
    let builder = builder
        .manage(zoom::Zoom::default())
        .menu(menu::build)
        .on_menu_event(|app, event| menu::handle(app, &event))
        .on_window_event(window::hide_on_close);

    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(error) => fail(&format!("A MineScript Desktop nem indult el: {error}")),
    };

    app.run(|handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            window::reveal(handle);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (handle, event);
    });
}

fn fail(message: &str) -> ! {
    eprintln!("{message}");
    std::process::exit(1);
}
