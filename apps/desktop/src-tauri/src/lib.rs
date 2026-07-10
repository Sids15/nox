/// Nox desktop shell. The whole UI is the Expo web build running in the system WebView2;
/// this crate only owns the window and, later, the OS-keystore session adapter.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Nox");
}
