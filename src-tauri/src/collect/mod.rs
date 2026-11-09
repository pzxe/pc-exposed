//! Read-only system investigation.
//!
//! Each collector runs on its own thread so that (a) COM state never leaks
//! between collectors, (b) they run in parallel, and (c) a panic in one is
//! converted to an `Unavailable` section plus a visible `CollectionIssue`
//! instead of aborting the scan. Nothing here requires administrator rights,
//! writes to the system, or reads user documents or browser data.

pub mod apps;
pub mod battery;
pub mod cpu;
pub mod gpu;
pub mod memory;
pub mod model;
pub mod network;
pub mod os;
pub mod processes;
pub mod startup;
pub mod storage;

use model::*;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// A collector's result: the value plus non-fatal warnings about partial data.
pub type Collected<T> = Result<(T, Vec<String>), String>;

fn run_section<T>(
    section: &str,
    issues: &Mutex<Vec<CollectionIssue>>,
    f: impl FnOnce() -> Collected<T>,
) -> Reading<T> {
    let push = |message: String| {
        if let Ok(mut g) = issues.lock() {
            g.push(CollectionIssue {
                section: section.to_string(),
                message,
            });
        }
    };
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(Ok((value, warnings))) => {
            for w in warnings {
                push(w);
            }
            Reading::ok(value)
        }
        Ok(Err(e)) => {
            push(e.clone());
            Reading::missing(e)
        }
        Err(_) => {
            let m = "collector crashed unexpectedly".to_string();
            push(m.clone());
            Reading::missing(m)
        }
    }
}

fn join_section<T>(
    h: std::thread::ScopedJoinHandle<'_, Reading<T>>,
    name: &str,
    issues: &Mutex<Vec<CollectionIssue>>,
) -> Reading<T> {
    h.join().unwrap_or_else(|_| {
        if let Ok(mut g) = issues.lock() {
            g.push(CollectionIssue {
                section: name.into(),
                message: "collector thread failed".into(),
            });
        }
        Reading::missing("collector thread failed")
    })
}

/// Runs every collector and assembles a `ScanReport`.
pub fn run_scan() -> ScanReport {
    let started = Instant::now();
    let issues = Mutex::new(Vec::new());
    let iss = &issues;

    let (cpu, gpus, memory, storage, os, startup, apps, battery, network, processes) =
        std::thread::scope(|s| {
            let cpu = s.spawn(move || run_section("cpu", iss, cpu::collect));
            let gpus = s.spawn(move || run_section("gpu", iss, gpu::collect));
            let memory = s.spawn(move || run_section("memory", iss, memory::collect));
            let storage = s.spawn(move || run_section("storage", iss, storage::collect));
            let os = s.spawn(move || run_section("os", iss, os::collect));
            let startup = s.spawn(move || run_section("startup", iss, startup::collect));
            let apps = s.spawn(move || run_section("apps", iss, apps::collect));
            let battery = s.spawn(move || run_section("battery", iss, battery::collect));
            let network = s.spawn(move || run_section("network", iss, network::collect));
            let processes = s.spawn(move || run_section("processes", iss, processes::collect));
            (
                join_section(cpu, "cpu", iss),
                join_section(gpus, "gpu", iss),
                join_section(memory, "memory", iss),
                join_section(storage, "storage", iss),
                join_section(os, "os", iss),
                join_section(startup, "startup", iss),
                join_section(apps, "apps", iss),
                join_section(battery, "battery", iss),
                join_section(network, "network", iss),
                join_section(processes, "processes", iss),
            )
        });

    let mut issues = issues.into_inner().unwrap_or_default();
    issues.sort_by(|a, b| a.section.cmp(&b.section));

    ScanReport {
        schema_version: SCHEMA_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        scanned_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        scan_duration_ms: started.elapsed().as_millis() as u64,
        cpu,
        gpus,
        memory,
        storage,
        os,
        startup,
        apps,
        battery,
        network,
        processes,
        issues,
    }
}

/// Minimum sampling window sysinfo needs for a meaningful CPU usage delta.
pub(crate) const CPU_SAMPLE: std::time::Duration = sysinfo::MINIMUM_CPU_UPDATE_INTERVAL;
