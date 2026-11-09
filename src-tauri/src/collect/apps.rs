//! Installed applications from the standard Uninstall registry locations.
//! Only counts and (where an app registered one) EstimatedSize are used.

use super::{model::*, Collected};
use std::collections::HashMap;
use std::io::ErrorKind;
use winreg::{
    enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    RegKey, HKEY,
};

const UNINSTALL: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
const UNINSTALL_32: &str = r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall";

#[derive(Debug, Clone, Default)]
pub struct RawApp {
    pub name: Option<String>,
    pub publisher: Option<String>,
    pub system_component: bool,
    pub has_parent: bool,
    pub release_type: Option<String>,
    pub estimated_size_kb: Option<u32>,
}

/// Filters out system components, patches/updates and nameless entries.
pub fn is_user_app(a: &RawApp) -> bool {
    let Some(name) = a.name.as_deref().map(str::trim) else {
        return false;
    };
    if name.is_empty() || a.system_component || a.has_parent {
        return false;
    }
    !matches!(
        a.release_type.as_deref(),
        Some("Update")
            | Some("Hotfix")
            | Some("Security Update")
            | Some("Update Rollup")
            | Some("Service Pack")
    )
}

/// (match text, exact?, category, display name). Matching is case-insensitive.
const NOTABLE: &[(&str, bool, &str, &str)] = &[
    ("icue", false, "rgb", "Corsair iCUE"),
    ("razer synapse", false, "rgb", "Razer Synapse"),
    ("armoury crate", false, "rgb", "ASUS Armoury Crate"),
    ("signalrgb", false, "rgb", "SignalRGB"),
    ("openrgb", false, "rgb", "OpenRGB"),
    ("nzxt cam", false, "rgb", "NZXT CAM"),
    ("mystic light", false, "rgb", "MSI Mystic Light"),
    ("msi center", false, "rgb", "MSI Center"),
    ("logitech g hub", false, "rgb", "Logitech G HUB"),
    ("steelseries gg", false, "rgb", "SteelSeries GG"),
    ("rgb fusion", false, "rgb", "Gigabyte RGB Fusion"),
    ("ngenuity", false, "rgb", "HyperX NGENUITY"),
    ("steam", true, "launcher", "Steam"),
    (
        "epic games launcher",
        false,
        "launcher",
        "Epic Games Launcher",
    ),
    ("gog galaxy", false, "launcher", "GOG Galaxy"),
    ("battle.net", false, "launcher", "Battle.net"),
    ("ubisoft connect", false, "launcher", "Ubisoft Connect"),
    ("ea app", true, "launcher", "EA app"),
];

/// Maps a registry display name to an allowlisted notable app, if any.
pub fn notable_for(name: &str) -> Option<(&'static str, &'static str)> {
    let n = name.trim().to_lowercase();
    NOTABLE
        .iter()
        .find(|(m, exact, _, _)| if *exact { n == *m } else { n.contains(m) })
        .map(|(_, _, cat, disp)| (*cat, *disp))
}

/// De-duplicates by case-insensitive name (32/64-bit and per-user duplicates),
/// keeping the entry that has size information.
pub fn aggregate(raw: Vec<RawApp>) -> AppsInfo {
    let mut map: HashMap<String, InstalledApp> = HashMap::new();
    for a in raw.iter().filter(|a| is_user_app(a)) {
        let name = a.name.clone().unwrap().trim().to_string();
        let size = a
            .estimated_size_kb
            .filter(|&k| k > 0)
            .map(|k| k as u64 * 1024);
        let app = InstalledApp {
            name: name.clone(),
            publisher: a.publisher.clone().filter(|p| !p.trim().is_empty()),
            size_bytes: size,
        };
        map.entry(name.to_lowercase())
            .and_modify(|e| {
                if e.size_bytes.is_none() {
                    e.size_bytes = app.size_bytes;
                }
            })
            .or_insert(app);
    }
    let with_size = map.values().filter(|a| a.size_bytes.is_some()).count() as u32;
    let mut sized: Vec<InstalledApp> = map
        .values()
        .filter(|a| a.size_bytes.is_some())
        .cloned()
        .collect();
    sized.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes).then(a.name.cmp(&b.name)));
    sized.truncate(10);
    let mut notable: Vec<NotableApp> = Vec::new();
    for a in map.values() {
        if let Some((cat, disp)) = notable_for(&a.name) {
            if !notable.iter().any(|n| n.name == disp) {
                notable.push(NotableApp {
                    name: disp.into(),
                    category: cat.into(),
                });
            }
        }
    }
    notable.sort_by(|a, b| a.name.cmp(&b.name));
    AppsInfo {
        count: map.len() as u32,
        notable,
        largest: sized,
        apps_with_size_info: with_size,
    }
}

fn read_root(hive: HKEY, path: &str, out: &mut Vec<RawApp>, warnings: &mut Vec<String>) {
    let root = match RegKey::predef(hive).open_subkey(path) {
        Ok(k) => k,
        Err(e) if e.kind() == ErrorKind::NotFound => return,
        Err(e) => return warnings.push(format!("uninstall key unreadable: {e}")),
    };
    for sub in root.enum_keys().flatten() {
        let Ok(k) = root.open_subkey(&sub) else {
            continue;
        };
        out.push(RawApp {
            name: k.get_value("DisplayName").ok(),
            publisher: k.get_value("Publisher").ok(),
            system_component: k
                .get_value::<u32, _>("SystemComponent")
                .map(|v| v == 1)
                .unwrap_or(false),
            has_parent: k.get_value::<String, _>("ParentKeyName").is_ok(),
            release_type: k.get_value("ReleaseType").ok(),
            estimated_size_kb: k.get_value("EstimatedSize").ok(),
        });
    }
}

pub fn collect() -> Collected<AppsInfo> {
    let (mut raw, mut warnings) = (Vec::new(), Vec::new());
    read_root(HKEY_LOCAL_MACHINE, UNINSTALL, &mut raw, &mut warnings);
    read_root(HKEY_LOCAL_MACHINE, UNINSTALL_32, &mut raw, &mut warnings);
    read_root(HKEY_CURRENT_USER, UNINSTALL, &mut raw, &mut warnings);
    Ok((aggregate(raw), warnings))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(name: &str, kb: Option<u32>) -> RawApp {
        RawApp {
            name: Some(name.into()),
            estimated_size_kb: kb,
            ..Default::default()
        }
    }

    #[test]
    fn filters_system_components_updates_and_nameless() {
        assert!(is_user_app(&app("Firefox", None)));
        assert!(!is_user_app(&RawApp {
            name: None,
            ..Default::default()
        }));
        assert!(!is_user_app(&RawApp {
            name: Some("x".into()),
            system_component: true,
            ..Default::default()
        }));
        assert!(!is_user_app(&RawApp {
            name: Some("x".into()),
            has_parent: true,
            ..Default::default()
        }));
        assert!(!is_user_app(&RawApp {
            name: Some("KB1".into()),
            release_type: Some("Security Update".into()),
            ..Default::default()
        }));
    }

    #[test]
    fn notable_allowlist_matching() {
        assert_eq!(
            notable_for("CORSAIR iCUE 5 Software"),
            Some(("rgb", "Corsair iCUE"))
        );
        assert_eq!(notable_for("Steam"), Some(("launcher", "Steam")));
        assert_eq!(notable_for("Steamworks Common Redistributables"), None);
        assert_eq!(notable_for("Notepad++"), None);
        let info = aggregate(vec![
            app("Steam", None),
            app("steam", None),
            app("OpenRGB 1.0", None),
            app("Other", None),
        ]);
        assert_eq!(info.notable.len(), 2);
    }

    #[test]
    fn dedups_and_ranks_only_apps_with_sizes() {
        let info = aggregate(vec![
            app("Big", Some(2_000_000)),
            app("big", None),
            app("Small", Some(10)),
            app("NoSize", None),
            app("Zero", Some(0)),
        ]);
        assert_eq!(info.count, 4);
        assert_eq!(info.apps_with_size_info, 2);
        assert_eq!(info.largest[0].name, "Big");
        assert_eq!(info.largest[0].size_bytes, Some(2_000_000 * 1024));
    }
}
