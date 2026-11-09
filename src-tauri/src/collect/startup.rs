//! Startup applications: registry Run keys and Startup folders.
//!
//! Read-only. Enabled/disabled state comes from the same StartupApproved keys
//! Task Manager uses. Scheduled tasks and services are NOT enumerated, so the
//! count is "startup entries found in Run keys and Startup folders".
//! Command lines are deliberately not stored (they can contain user paths).

use super::{model::*, Collected};
use std::io::ErrorKind;
use winreg::{
    enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    RegKey, HKEY,
};

const RUN: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
const APPROVED: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved";

/// StartupApproved binary values: first byte with bit 0 set means disabled
/// (02/06 = enabled, 03/07 = disabled). Missing or empty data = enabled.
pub fn is_enabled(approved: Option<&[u8]>) -> bool {
    match approved.and_then(|b| b.first()) {
        Some(b) => b & 1 == 0,
        None => true,
    }
}

fn approved_value(hive: HKEY, sub: &str, name: &str) -> Option<Vec<u8>> {
    RegKey::predef(hive)
        .open_subkey(format!(r"{APPROVED}\{sub}"))
        .ok()?
        .get_raw_value(name)
        .ok()
        .map(|v| v.bytes.to_vec())
}

fn scan_run_key(
    hive: HKEY,
    path: &str,
    approved_sub: &str,
    source: &str,
    out: &mut Vec<StartupEntry>,
    warnings: &mut Vec<String>,
) {
    let key = match RegKey::predef(hive).open_subkey(path) {
        Ok(k) => k,
        Err(e) if e.kind() == ErrorKind::NotFound => return,
        Err(e) => return warnings.push(format!("{source}: {e}")),
    };
    for item in key.enum_values() {
        let Ok((name, _)) = item else { continue };
        let approved = approved_value(hive, approved_sub, &name);
        out.push(StartupEntry {
            enabled: is_enabled(approved.as_deref()),
            name,
            source: source.into(),
        });
    }
}

fn scan_folder(
    dir: Option<std::path::PathBuf>,
    hive: HKEY,
    source: &str,
    out: &mut Vec<StartupEntry>,
    warnings: &mut Vec<String>,
) {
    let Some(dir) = dir else { return };
    let rd = match std::fs::read_dir(&dir) {
        Ok(r) => r,
        Err(e) if e.kind() == ErrorKind::NotFound => return,
        Err(e) => return warnings.push(format!("{source}: {e}")),
    };
    for entry in rd.flatten() {
        let file = entry.file_name().to_string_lossy().to_string();
        if file.eq_ignore_ascii_case("desktop.ini") {
            continue;
        }
        let approved = approved_value(hive, "StartupFolder", &file);
        let name = std::path::Path::new(&file)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or(file.clone());
        out.push(StartupEntry {
            enabled: is_enabled(approved.as_deref()),
            name,
            source: source.into(),
        });
    }
}

pub fn summarize(mut entries: Vec<StartupEntry>) -> StartupInfo {
    entries.sort_by_key(|e| e.name.to_lowercase());
    let enabled = entries.iter().filter(|e| e.enabled).count() as u32;
    StartupInfo {
        disabled_count: entries.len() as u32 - enabled,
        enabled_count: enabled,
        entries,
    }
}

pub fn collect() -> Collected<StartupInfo> {
    let (mut entries, mut warnings) = (Vec::new(), Vec::new());
    let (w, e) = (&mut warnings, &mut entries);
    scan_run_key(HKEY_CURRENT_USER, RUN, "Run", "Registry: HKCU Run", e, w);
    scan_run_key(HKEY_LOCAL_MACHINE, RUN, "Run", "Registry: HKLM Run", e, w);
    scan_run_key(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        "Run32",
        "Registry: HKLM Run (32-bit)",
        e,
        w,
    );
    let user_dir = std::env::var_os("APPDATA").map(|p| {
        std::path::PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs\Startup")
    });
    let common_dir = std::env::var_os("ProgramData").map(|p| {
        std::path::PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs\StartUp")
    });
    scan_folder(user_dir, HKEY_CURRENT_USER, "Startup folder (user)", e, w);
    scan_folder(
        common_dir,
        HKEY_LOCAL_MACHINE,
        "Startup folder (all users)",
        e,
        w,
    );
    Ok((summarize(entries), warnings))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approved_flag_semantics() {
        assert!(is_enabled(Some(&[0x02, 0, 0])));
        assert!(is_enabled(Some(&[0x06, 0, 0])));
        assert!(!is_enabled(Some(&[0x03, 0, 0])));
        assert!(!is_enabled(Some(&[0x07, 0, 0])));
        assert!(is_enabled(None));
        assert!(is_enabled(Some(&[])));
    }

    #[test]
    fn summary_counts_and_sorts() {
        let mk = |n: &str, en| StartupEntry {
            name: n.into(),
            source: "x".into(),
            enabled: en,
        };
        let s = summarize(vec![mk("b", true), mk("A", false), mk("c", true)]);
        assert_eq!((s.enabled_count, s.disabled_count), (2, 1));
        assert_eq!(s.entries[0].name, "A");
    }
}
