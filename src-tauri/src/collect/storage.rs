//! Drives via sysinfo plus GetLogicalDrives for the logical drive count.

use super::{model::*, Collected};
use sysinfo::{DiskKind, Disks};
use windows::Win32::Storage::FileSystem::GetLogicalDrives;

pub fn kind_reading(k: DiskKind) -> Reading<DriveKind> {
    match k {
        DiskKind::SSD => Reading::ok(DriveKind::Ssd),
        DiskKind::HDD => Reading::ok(DriveKind::Hdd),
        DiskKind::Unknown(_) => Reading::missing("drive type not reported by Windows"),
    }
}

fn is_system_mount(mount: &str, system_drive: &str) -> bool {
    !system_drive.is_empty()
        && mount
            .to_ascii_uppercase()
            .starts_with(&system_drive.to_ascii_uppercase())
}

pub fn collect() -> Collected<StorageInfo> {
    let system_drive = std::env::var("SystemDrive").unwrap_or_default();
    let disks = Disks::new_with_refreshed_list();
    let mut drives = Vec::new();

    for d in disks.list() {
        let total = d.total_space();
        if total == 0 {
            continue; // empty card readers etc.: no media, nothing to report
        }
        let free = d.available_space().min(total);
        let mount = d.mount_point().to_string_lossy().to_string();
        let label = d.name().to_string_lossy().trim().to_string();
        let fs = d.file_system().to_string_lossy().trim().to_string();
        drives.push(DriveInfo {
            is_system_drive: is_system_mount(&mount, &system_drive),
            mount_point: mount,
            label: if label.is_empty() {
                Reading::missing("drive has no label")
            } else {
                Reading::ok(label)
            },
            kind: kind_reading(d.kind()),
            is_removable: d.is_removable(),
            filesystem: if fs.is_empty() {
                Reading::missing("filesystem not reported")
            } else {
                Reading::ok(fs)
            },
            total_bytes: total,
            free_bytes: free,
            used_bytes: total - free,
        });
    }
    if drives.is_empty() {
        return Err("no drives with media were reported".into());
    }
    drives.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));

    let mask = unsafe { GetLogicalDrives() };
    let system_free = drives
        .iter()
        .find(|d| d.is_system_drive)
        .map(|d| d.free_bytes);

    Ok((
        StorageInfo {
            logical_drive_count: mask.count_ones(),
            system_drive_free_bytes: Reading::from_option(
                system_free,
                "system drive not found among reported drives",
            ),
            drives,
        },
        Vec::new(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_kind_unknown_is_unavailable() {
        assert_eq!(kind_reading(DiskKind::SSD), Reading::ok(DriveKind::Ssd));
        assert_eq!(kind_reading(DiskKind::HDD), Reading::ok(DriveKind::Hdd));
        assert!(kind_reading(DiskKind::Unknown(-1)).value().is_none());
    }

    #[test]
    fn system_mount_matching() {
        assert!(is_system_mount("C:\\", "C:"));
        assert!(is_system_mount("c:\\", "C:"));
        assert!(!is_system_mount("D:\\", "C:"));
        assert!(!is_system_mount("C:\\", ""));
    }
}
