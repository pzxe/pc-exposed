//! PC EXPOSED native core.
//!
//! Module map:
//! - `app_info` : static build/application metadata
//! - `collect`  : read-only hardware & system collectors (see `collect::model`)
//! - `export`   : validated, user-confirmed saving of share images
//!
//! The native side only *collects*. Scoring, personality and roast logic live
//! in the TypeScript analysis engine so they stay unit-testable and
//! independent from the UI.

mod app_info;
pub mod collect;
pub mod export;

/// Runs a full read-only system scan off the UI thread.
#[tauri::command]
async fn run_scan() -> Result<collect::model::ScanReport, String> {
    tauri::async_runtime::spawn_blocking(collect::run_scan)
        .await
        .map_err(|e| format!("scan task failed: {e}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_info::get_app_info,
            run_scan,
            export::save_share_image,
            export::save_report_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running PC EXPOSED");
}
