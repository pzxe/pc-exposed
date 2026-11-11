//! Static application metadata exposed to the frontend.

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub license: &'static str,
    pub os: &'static str,
    pub arch: &'static str,
}

pub fn build_app_info() -> AppInfo {
    AppInfo {
        name: "PC EXPOSED",
        version: env!("CARGO_PKG_VERSION"),
        license: "MIT",
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    build_app_info()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_package_version() {
        let info = build_app_info();
        assert_eq!(info.name, "PC EXPOSED");
        assert_eq!(info.version, "0.2.0-beta.1");
        assert_eq!(info.license, "MIT");
    }

    #[test]
    fn serializes_camel_case() {
        let json = serde_json::to_value(build_app_info()).unwrap();
        assert!(json.get("version").is_some());
        assert!(json.get("arch").is_some());
    }
}
