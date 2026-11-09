//! Data model for a system scan. Mirrored by `src/lib/scanTypes.ts`.
//!
//! Core rule: a metric that could not be read is `Reading::Unavailable` with a
//! reason. It is never encoded as 0, an empty string or a guessed value.

use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

/// A value that was either measured or could not be obtained.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum Reading<T> {
    Available { value: T },
    Unavailable { reason: String },
}

impl<T> Reading<T> {
    pub fn ok(value: T) -> Self {
        Reading::Available { value }
    }
    pub fn missing(reason: impl Into<String>) -> Self {
        Reading::Unavailable {
            reason: reason.into(),
        }
    }
    pub fn from_option(v: Option<T>, reason: &str) -> Self {
        match v {
            Some(value) => Reading::Available { value },
            None => Reading::missing(reason),
        }
    }
    pub fn value(&self) -> Option<&T> {
        match self {
            Reading::Available { value } => Some(value),
            Reading::Unavailable { .. } => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub name: Reading<String>,
    pub manufacturer: Reading<String>,
    pub physical_cores: Reading<u32>,
    pub logical_processors: Reading<u32>,
    /// Instantaneous utilization over a short sampling window, 0-100.
    pub utilization_percent: Reading<f32>,
    /// Rated maximum clock reported by the firmware/driver (not a live reading).
    pub max_clock_mhz: Reading<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub manufacturer: Reading<String>,
    pub dedicated_vram_bytes: Reading<u64>,
    pub shared_memory_bytes: Reading<u64>,
    pub utilization_percent: Reading<f32>,
    pub temperature_c: Reading<f32>,
    /// True for software adapters such as "Microsoft Basic Render Driver".
    pub is_software: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub utilization_percent: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DriveKind {
    Ssd,
    Hdd,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub mount_point: String,
    pub label: Reading<String>,
    pub kind: Reading<DriveKind>,
    pub is_removable: bool,
    pub filesystem: Reading<String>,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub is_system_drive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub drives: Vec<DriveInfo>,
    pub logical_drive_count: u32,
    pub system_drive_free_bytes: Reading<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    pub name: Reading<String>,
    pub version: Reading<String>,
    pub build: Reading<String>,
    pub architecture: String,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartupEntry {
    pub name: String,
    /// Where the entry was found, e.g. "Registry: HKCU Run" or "Startup folder (user)".
    pub source: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartupInfo {
    pub entries: Vec<StartupEntry>,
    pub enabled_count: u32,
    pub disabled_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub publisher: Option<String>,
    /// Size in bytes, only when the application registered an estimate.
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NotableApp {
    /// Canonical display name from a fixed allowlist (never the raw registry string).
    pub name: String,
    /// "rgb" (lighting/peripheral suites) or "launcher" (game launchers).
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppsInfo {
    pub count: u32,
    /// Well-known RGB/peripheral and game-launcher apps found. Allowlist only:
    /// the full application list is never exported.
    pub notable: Vec<NotableApp>,
    /// Apps with a registered size, largest first (max 10).
    pub largest: Vec<InstalledApp>,
    pub apps_with_size_info: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub present: bool,
    pub percent: Reading<u8>,
    pub on_ac_power: Reading<bool>,
    pub charging: Reading<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkAdapter {
    pub name: String,
    pub connected: Reading<bool>,
    pub speed_bits_per_sec: Reading<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessUsage {
    pub name: String,
    pub memory_bytes: u64,
    pub cpu_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessesInfo {
    pub total_count: u32,
    /// Top processes by memory. Visible to a standard user only.
    pub top_by_memory: Vec<ProcessUsage>,
}

/// A collector that failed or partially failed. Never silently dropped.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CollectionIssue {
    pub section: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub schema_version: u32,
    pub app_version: String,
    /// Unix epoch milliseconds.
    pub scanned_at_ms: u64,
    pub scan_duration_ms: u64,
    pub cpu: Reading<CpuInfo>,
    pub gpus: Reading<Vec<GpuInfo>>,
    pub memory: Reading<MemoryInfo>,
    pub storage: Reading<StorageInfo>,
    pub os: Reading<OsInfo>,
    pub startup: Reading<StartupInfo>,
    pub apps: Reading<AppsInfo>,
    pub battery: Reading<BatteryInfo>,
    pub network: Reading<Vec<NetworkAdapter>>,
    pub processes: Reading<ProcessesInfo>,
    pub issues: Vec<CollectionIssue>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_is_distinct_from_zero() {
        let zero: Reading<u32> = Reading::ok(0);
        let none: Reading<u32> = Reading::missing("no sensor");
        assert_ne!(zero, none);
        assert_eq!(zero.value(), Some(&0));
        assert_eq!(none.value(), None);
    }

    #[test]
    fn reading_json_shape_is_tagged() {
        let v = serde_json::to_value(Reading::ok(5u32)).unwrap();
        assert_eq!(v, serde_json::json!({"status":"available","value":5}));
        let v = serde_json::to_value(Reading::<u32>::missing("x")).unwrap();
        assert_eq!(v, serde_json::json!({"status":"unavailable","reason":"x"}));
    }
}
