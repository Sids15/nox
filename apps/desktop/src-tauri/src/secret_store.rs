use keyring::{Entry, Error as KeyringError};

/// One namespace for every Nox credential, so a user can find (and revoke) them in the OS keystore.
const SERVICE: &str = "app.nox.desktop";

/// Only the names the session store uses (letters, digits, `-`, `_`, `.`, `:`; at most 128) — so the
/// webview can't use these commands as a general-purpose keychain reader or writer.
fn entry(key: &str) -> Result<Entry, String> {
    let ok = !key.is_empty()
        && key.len() <= 128
        && key.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'));
    if !ok {
        return Err("invalid secret name".into());
    }
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

/// Read a secret. A missing entry is `Ok(None)`, not an error — the caller treats it as "no session".
#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

/// Deleting an absent entry succeeds: removeItem must be idempotent for the storage adapter.
#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
