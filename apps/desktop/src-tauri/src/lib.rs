mod notify;
mod secret_store;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

/// Bring the main window back from the tray (or from behind another window) to the foreground.
fn reveal_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Nox desktop shell. The whole UI is the Expo web build running in the system WebView2; this crate
/// owns the window, the `nox://` deep link, the OS-keystore backing for the auth session, and the
/// local-notification scheduler + tray.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Registered BEFORE deep-link, per the plugin's requirement: on Windows a `nox://…` link spawns a
    // new process with the URL in argv, and this hands it to the running instance rather than opening
    // a second Nox.
    #[cfg(any(windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            reveal_main(app);
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(notify::SchedulerState::default())
        .invoke_handler(tauri::generate_handler![
            secret_store::secret_get,
            secret_store::secret_set,
            secret_store::secret_delete,
            notify::set_notifications,
            notify::clear_notifications,
        ])
        // Close-to-tray: the reminder scheduler must keep running after the window is closed, so a
        // close request hides the window instead of quitting. The tray "Quit" item is the real exit.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Installers register `nox://` for us, but a dev build was never installed, so claim the
            // scheme at runtime. Windows-only in effect; harmless to call each launch.
            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            // Tray icon so a tray-resident (window-closed) app is still reachable — click or "Show"
            // to reopen, "Quit" to actually exit.
            let show = MenuItem::with_id(app, "show", "Show Nox", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Nox")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => reveal_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        reveal_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            notify::spawn_scheduler(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Nox");
}
