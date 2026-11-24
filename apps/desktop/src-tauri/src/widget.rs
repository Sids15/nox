//! The desktop widget: a small frameless window running the same web app with `?view=widget`.
//! It shares the session (OS keystore) and data with the main window; the web side draws it.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

const LABEL: &str = "widget";

/// Show the widget (creating it the first time, near the top-right of the screen), or hide it.
pub fn toggle<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(LABEL) {
        if w.is_visible().unwrap_or(false) {
            w.hide()?;
        } else {
            w.show()?;
            w.set_focus()?;
        }
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html?view=widget".into()))
        .title("Nox widget")
        .inner_size(320.0, 440.0)
        .min_inner_size(260.0, 220.0)
        .max_inner_size(520.0, 900.0)
        .resizable(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true);

    // Top-right of the main window's screen, clear of the menu bar / edge.
    if let Some(monitor) = app.get_webview_window("main").and_then(|m| m.current_monitor().ok().flatten()) {
        let scale = monitor.scale_factor();
        let size = monitor.size().to_logical::<f64>(scale);
        let origin = monitor.position().to_logical::<f64>(scale);
        builder = builder.position(origin.x + size.width - 320.0 - 24.0, origin.y + 64.0);
    }

    builder.build()?;
    Ok(())
}

#[tauri::command]
pub fn toggle_widget<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    toggle(&app).map_err(|e| e.to_string())
}

/// From the widget: bring the main window forward (it navigates on the event the widget emits).
#[tauri::command]
pub fn show_main<R: Runtime>(app: AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
