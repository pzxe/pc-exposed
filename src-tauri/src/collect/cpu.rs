//! CPU: identity and core counts from WMI (with sysinfo fallback), live
//! utilization from a short sysinfo sampling window.

use super::{model::*, Collected, CPU_SAMPLE};
use serde::Deserialize;
use sysinfo::{CpuRefreshKind, RefreshKind, System};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32Processor {
    name: Option<String>,
    manufacturer: Option<String>,
    number_of_cores: Option<u32>,
    number_of_logical_processors: Option<u32>,
    max_clock_speed: Option<u32>,
}

/// Collapses vendor strings like "GenuineIntel" to a friendly name.
pub fn normalize_vendor(raw: &str) -> String {
    match raw.trim() {
        "GenuineIntel" => "Intel".into(),
        "AuthenticAMD" => "AMD".into(),
        other => other.to_string(),
    }
}

/// (name, manufacturer, physical cores, logical processors, max clock MHz)
type MergedCpu = (
    Option<String>,
    Option<String>,
    Option<u32>,
    Option<u32>,
    Option<u32>,
);

/// Sums per-socket WMI rows. Returns None if the slice is empty.
fn merge_rows(rows: &[Win32Processor]) -> Option<MergedCpu> {
    let first = rows.first()?;
    let sum = |f: fn(&Win32Processor) -> Option<u32>| {
        let v: Vec<u32> = rows.iter().filter_map(f).collect();
        if v.is_empty() {
            None
        } else {
            Some(v.iter().sum())
        }
    };
    Some((
        first.name.as_ref().map(|s| s.trim().to_string()),
        first.manufacturer.as_ref().map(|s| normalize_vendor(s)),
        sum(|r| r.number_of_cores),
        sum(|r| r.number_of_logical_processors),
        rows.iter().filter_map(|r| r.max_clock_speed).max(),
    ))
}

pub fn collect() -> Collected<CpuInfo> {
    let mut warnings = Vec::new();

    let wmi_rows: Option<Vec<Win32Processor>> = wmi::WMIConnection::new()
        .and_then(|c| c.raw_query("SELECT Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor"))
        .map_err(|e| warnings.push(format!("WMI processor query failed: {e}")))
        .ok();
    let merged = wmi_rows.as_deref().and_then(merge_rows);

    // Utilization: needs two refreshes separated by the minimum interval.
    let mut sys =
        System::new_with_specifics(RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()));
    std::thread::sleep(CPU_SAMPLE);
    sys.refresh_cpu_usage();
    let logical_sys = sys.cpus().len() as u32;
    let usage = if logical_sys > 0 {
        Some(sys.global_cpu_usage())
    } else {
        None
    };
    let sys_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty());
    let sys_vendor = sys
        .cpus()
        .first()
        .map(|c| normalize_vendor(c.vendor_id()))
        .filter(|s| !s.is_empty());
    let sys_physical = System::physical_core_count().map(|n| n as u32);

    let (w_name, w_vendor, w_cores, w_logical, w_clock) =
        merged.unwrap_or((None, None, None, None, None));

    let info = CpuInfo {
        name: Reading::from_option(w_name.or(sys_brand), "processor name not reported"),
        manufacturer: Reading::from_option(w_vendor.or(sys_vendor), "manufacturer not reported"),
        physical_cores: Reading::from_option(
            w_cores.or(sys_physical),
            "physical core count not reported",
        ),
        logical_processors: Reading::from_option(
            w_logical.or(if logical_sys > 0 {
                Some(logical_sys)
            } else {
                None
            }),
            "logical processor count not reported",
        ),
        utilization_percent: Reading::from_option(usage, "utilization could not be sampled"),
        max_clock_mhz: Reading::from_option(
            w_clock.filter(|&m| m > 0),
            "clock speed not reported by firmware",
        ),
    };
    Ok((info, warnings))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vendor_normalization() {
        assert_eq!(normalize_vendor("GenuineIntel"), "Intel");
        assert_eq!(normalize_vendor("AuthenticAMD "), "AMD");
        assert_eq!(normalize_vendor("Other"), "Other");
    }

    #[test]
    fn merges_multi_socket_rows() {
        let rows = vec![
            Win32Processor {
                name: Some(" CPU A ".into()),
                manufacturer: Some("GenuineIntel".into()),
                number_of_cores: Some(8),
                number_of_logical_processors: Some(16),
                max_clock_speed: Some(3000),
            },
            Win32Processor {
                name: Some("CPU A".into()),
                manufacturer: Some("GenuineIntel".into()),
                number_of_cores: Some(8),
                number_of_logical_processors: Some(16),
                max_clock_speed: Some(3200),
            },
        ];
        let (name, vendor, cores, logical, clock) = merge_rows(&rows).unwrap();
        assert_eq!(name.as_deref(), Some("CPU A"));
        assert_eq!(vendor.as_deref(), Some("Intel"));
        assert_eq!((cores, logical, clock), (Some(16), Some(32), Some(3200)));
        assert!(merge_rows(&[]).is_none());
    }
}
