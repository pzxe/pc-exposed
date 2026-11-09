//! Physical memory via sysinfo.

use super::{model::*, Collected};
use sysinfo::{MemoryRefreshKind, RefreshKind, System};

pub fn build(total: u64, available: u64) -> Option<MemoryInfo> {
    if total == 0 {
        return None;
    }
    let available = available.min(total);
    let used = total - available;
    Some(MemoryInfo {
        total_bytes: total,
        used_bytes: used,
        available_bytes: available,
        utilization_percent: (used as f64 / total as f64 * 100.0) as f32,
    })
}

pub fn collect() -> Collected<MemoryInfo> {
    let sys = System::new_with_specifics(
        RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
    );
    let info = build(sys.total_memory(), sys.available_memory())
        .ok_or("total physical memory reported as 0")?;
    Ok((info, Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_used_and_percent() {
        let m = build(16_000, 4_000).unwrap();
        assert_eq!(m.used_bytes, 12_000);
        assert!((m.utilization_percent - 75.0).abs() < 0.01);
    }

    #[test]
    fn zero_total_is_unavailable_and_available_is_clamped() {
        assert!(build(0, 0).is_none());
        assert_eq!(build(100, 500).unwrap().used_bytes, 0);
    }
}
