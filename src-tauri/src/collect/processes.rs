//! Process resource usage: top consumers by memory, grouped by executable name.
//! Only processes visible to a standard user are included. No command lines,
//! paths or window titles are read.

use super::{model::*, Collected, CPU_SAMPLE};
use std::collections::HashMap;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

pub fn group_top(
    rows: impl IntoIterator<Item = (String, u64, f32)>,
    limit: usize,
) -> Vec<ProcessUsage> {
    let mut map: HashMap<String, ProcessUsage> = HashMap::new();
    for (name, mem, cpu) in rows {
        let e = map.entry(name.to_lowercase()).or_insert(ProcessUsage {
            name,
            memory_bytes: 0,
            cpu_percent: 0.0,
        });
        e.memory_bytes += mem;
        e.cpu_percent += cpu;
    }
    let mut v: Vec<ProcessUsage> = map.into_values().collect();
    v.sort_by(|a, b| {
        b.memory_bytes
            .cmp(&a.memory_bytes)
            .then(a.name.cmp(&b.name))
    });
    v.truncate(limit);
    v
}

pub fn collect() -> Collected<ProcessesInfo> {
    let mut sys = System::new();
    let kind = ProcessRefreshKind::nothing().with_memory().with_cpu();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
    std::thread::sleep(CPU_SAMPLE);
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);

    let total = sys.processes().len() as u32;
    if total == 0 {
        return Err("no processes were visible".into());
    }
    let top = group_top(
        sys.processes().values().map(|p| {
            (
                p.name().to_string_lossy().to_string(),
                p.memory(),
                p.cpu_usage(),
            )
        }),
        8,
    );
    Ok((
        ProcessesInfo {
            total_count: total,
            top_by_memory: top,
        },
        Vec::new(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_same_name_and_sorts_by_memory() {
        let top = group_top(
            vec![
                ("chrome.exe".into(), 100, 1.0),
                ("Chrome.exe".into(), 300, 2.0),
                ("a.exe".into(), 350, 0.0),
                ("b.exe".into(), 10, 0.0),
            ],
            2,
        );
        assert_eq!(top.len(), 2);
        assert_eq!(top[0].memory_bytes, 400);
        assert_eq!(top[1].name, "a.exe");
    }
}
