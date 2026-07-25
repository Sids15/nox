//! Desktop notification scheduler.
//!
//! Tauri's notification plugin only fires *immediately* — it has no OS-level scheduling like iOS. And
//! a WebView2 window minimised to the tray throttles JS timers, so a frontend `setInterval` can't be
//! trusted to fire on time. So the schedule lives here: the frontend computes WHAT to fire and when
//! (reusing the same pure planner the native build uses) and hands us a flat list; this background
//! thread fires each item at its time, running regardless of window visibility.

use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_notification::NotificationExt;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scheduled {
    pub id: String,
    pub fire_at_ms: i64,
    pub title: String,
    pub body: String,
    #[allow(dead_code)] // carried for a future tap-to-open; desktop toast click-through is OS-limited.
    pub task_id: Option<String>,
}

#[derive(Default)]
pub struct SchedulerState {
    inner: Mutex<Scheduler>,
}

#[derive(Default)]
struct Scheduler {
    items: Vec<Scheduled>,
    fired: HashSet<String>,
    /// The cursor: only items with last_check < fire_at <= now fire, so nothing already past-due at
    /// the first `set` is ever fired retroactively (no stale-notification flood on cold start).
    last_check_ms: Option<i64>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Replace the schedule. Called by the frontend whenever tasks/toggles change and on a periodic
/// re-send (so daily nudges roll forward). Idempotent: fired ids for items still present are kept, so
/// re-sending the same schedule never re-fires.
#[tauri::command]
pub fn set_notifications(items: Vec<Scheduled>, state: State<'_, SchedulerState>) {
    let mut s = state.inner.lock().unwrap();
    if s.last_check_ms.is_none() {
        s.last_check_ms = Some(now_ms());
    }
    let present: HashSet<String> = items.iter().map(|i| i.id.clone()).collect();
    s.fired.retain(|id| present.contains(id));
    s.items = items;
}

/// Fire a notification immediately, bypassing the schedule. Used by Settings' "Send test
/// notification" so a user (or we) can confirm the OS toast plumbing works independently of the
/// reminder scheduling.
#[tauri::command]
pub fn notify_now<R: Runtime>(app: AppHandle<R>, title: String, body: String) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Drop the whole schedule. Called on sign-out — one user's reminders carry their task titles and
/// must never fire for the next user on a shared device.
#[tauri::command]
pub fn clear_notifications(state: State<'_, SchedulerState>) {
    let mut s = state.inner.lock().unwrap();
    s.items.clear();
    s.fired.clear();
    // last_check_ms is intentionally left set, so the next `set` still can't retro-fire.
}

/// Spawn the tick loop. A plain OS thread (not a webview timer) so it keeps firing while the window is
/// hidden in the tray.
pub fn spawn_scheduler<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));

        let due: Vec<Scheduled> = {
            let state = app.state::<SchedulerState>();
            let mut guard = state.inner.lock().unwrap();
            let sched = &mut *guard;
            let now = now_ms();
            let last = sched.last_check_ms.unwrap_or(now);

            let mut due = Vec::new();
            for item in sched.items.iter() {
                if item.fire_at_ms > last && item.fire_at_ms <= now && !sched.fired.contains(&item.id)
                {
                    due.push(item.clone());
                }
            }
            for item in &due {
                sched.fired.insert(item.id.clone());
            }
            sched.last_check_ms = Some(now);
            due
        };

        for item in due {
            let _ = app
                .notification()
                .builder()
                .title(&item.title)
                .body(&item.body)
                .show();
        }
    });
}
