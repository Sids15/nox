mod notify;
mod secret_store;
mod widget;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::{Manager, WindowEvent};

/// Bring the main window back from the tray (or from behind another window) to the foreground.
fn reveal_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Nox desktop shell. The whole UI is the Expo web build running in the system webview (WebView2 on
/// Windows, WKWebView on macOS); this crate
/// owns the window, the `nox://` deep link, the OS-keystore backing for the auth session, and the
/// local-notification scheduler + tray.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Registered BEFORE deep-link, per the plugin's requirement: on Windows a `nox://…` link spawns a
    // new process with the URL in argv, and this hands it to the running instance rather than opening
    // a second Nox. (macOS delivers links to the running app itself, so it needs no such plugin.)
    #[cfg(any(windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        reveal_main(app);
    }));

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
            notify::notify_now,
            widget::toggle_widget,
            widget::show_main,
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
            let widget_item = MenuItem::with_id(app, "widget", "Show or hide widget", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &widget_item, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Nox")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => reveal_main(app),
                    "widget" => {
                        let _ = widget::toggle(app);
                    }
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
            // macOS menu bar: a monochrome template image (the wordmark), which the system tints for
            // light and dark menu bars. The full-colour app icon looked out of place there.
            #[cfg(target_os = "macos")]
            {
                let template = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
                tray = tray.icon(template).icon_as_template(true);
            }
            #[cfg(not(target_os = "macos"))]
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            notify::spawn_scheduler(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Nox")
        .run(|app, event| {
            // macOS: closing the window only hides it (reminders keep running), so clicking the Dock
            // icon has to bring it back — the standard Mac behaviour.
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                reveal_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
