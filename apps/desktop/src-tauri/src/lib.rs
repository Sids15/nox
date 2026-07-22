mod secret_store;

/// Nox desktop shell. The whole UI is the Expo web build running in the system WebView2; this crate
/// owns the window, the `nox://` deep link, and the OS-keystore backing for the auth session.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Registered BEFORE deep-link, per the plugin's requirement: on Windows a `nox://…` link spawns a
    // new process with the URL in argv, and this hands it to the running instance rather than opening
    // a second Nox. The closure body can stay empty — the `deep-link` feature does the forwarding.
    #[cfg(any(windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            secret_store::secret_get,
            secret_store::secret_set,
            secret_store::secret_delete,
        ])
        .setup(|_app| {
            // Installers register `nox://` for us, but a dev build was never installed, so claim the
            // scheme at runtime. Windows-only in effect; harmless to call each launch.
            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                _app.deep_link().register_all()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Nox");
}
