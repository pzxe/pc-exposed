//! Integration test: runs the real collectors on the host Windows machine and
//! checks invariants that must hold on any Windows 10/11 PC. Set
//! `PCX_DUMP=path` to write the scan JSON (used for manual inspection).

use pc_exposed_lib::collect::{model::*, run_scan};

#[test]
fn real_scan_produces_consistent_report() {
    let r = run_scan();
    assert_eq!(r.schema_version, SCHEMA_VERSION);

    let mem = r.memory.value().expect("memory must be readable");
    assert!(mem.total_bytes > 0);
    assert_eq!(mem.used_bytes + mem.available_bytes, mem.total_bytes);

    let cpu = r.cpu.value().expect("cpu must be readable");
    assert!(*cpu.logical_processors.value().unwrap() >= 1);
    if let (Some(p), Some(l)) = (cpu.physical_cores.value(), cpu.logical_processors.value()) {
        assert!(p <= l);
    }
    if let Some(u) = cpu.utilization_percent.value() {
        assert!((0.0..=100.0).contains(u));
    }

    let os = r.os.value().expect("os must be readable");
    assert!(os.uptime_seconds > 0);
    assert_eq!(os.architecture, "x86_64");

    let st = r.storage.value().expect("storage must be readable");
    assert!(st.logical_drive_count >= 1);
    for d in &st.drives {
        assert_eq!(d.used_bytes + d.free_bytes, d.total_bytes);
    }

    let gpus = r.gpus.value().expect("gpu enumeration must work");
    assert!(!gpus.is_empty());
    for g in gpus {
        // Unimplemented vendor metrics must be Unavailable, never a fake 0.
        assert!(g.utilization_percent.value().is_none());
        assert!(g.temperature_c.value().is_none());
    }

    let st = r.startup.value().expect("startup must be readable");
    assert_eq!(
        st.enabled_count + st.disabled_count,
        st.entries.len() as u32
    );

    let apps = r.apps.value().expect("apps must be readable");
    assert!(apps
        .notable
        .iter()
        .all(|n| n.category == "rgb" || n.category == "launcher"));

    let json = serde_json::to_string_pretty(&r).unwrap();
    assert!(!json.contains("NaN"));
    if let Ok(path) = std::env::var("PCX_DUMP") {
        std::fs::write(path, json).unwrap();
    }
    println!(
        "scan took {} ms, issues: {:?}",
        r.scan_duration_ms, r.issues
    );
}

#[test]
fn report_round_trips_through_json() {
    let r = run_scan();
    let json = serde_json::to_string(&r).unwrap();
    let back: ScanReport = serde_json::from_str(&json).unwrap();
    assert_eq!(back.schema_version, r.schema_version);
    assert_eq!(
        back.memory.value().map(|m| m.total_bytes),
        r.memory.value().map(|m| m.total_bytes)
    );
}
