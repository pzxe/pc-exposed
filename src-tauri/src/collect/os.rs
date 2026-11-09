//! Operating system details from the registry's CurrentVersion key (read-only).

use super::{model::*, Collected};
use sysinfo::System;
use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

/// Windows 11 still reports ProductName "Windows 10 ..." in the registry.
/// Build 22000+ is Windows 11, so correct the name by build number.
pub fn fix_product_name(product: &str, build: Option<u32>) -> String {
    match build {
        Some(b) if b >= 22000 => product.replacen("Windows 10", "Windows 11", 1),
        _ => product.to_string(),
    }
}

pub fn collect() -> Collected<OsInfo> {
    let mut warnings = Vec::new();
    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .map_err(|e| warnings.push(format!("registry CurrentVersion unreadable: {e}")))
        .ok();

    let get = |name: &str| {
        key.as_ref()
            .and_then(|k| k.get_value::<String, _>(name).ok())
            .filter(|s| !s.is_empty())
    };
    let build_str = get("CurrentBuild").or_else(System::kernel_version);
    let build_num = build_str.as_ref().and_then(|b| b.parse::<u32>().ok());
    let ubr = key.as_ref().and_then(|k| k.get_value::<u32, _>("UBR").ok());

    let name = get("ProductName")
        .map(|p| fix_product_name(&p, build_num))
        .or_else(System::name);
    let version = get("DisplayVersion")
        .or_else(|| get("ReleaseId"))
        .or_else(System::os_version);
    let build = build_str.map(|b| match ubr {
        Some(u) => format!("{b}.{u}"),
        None => b,
    });

    Ok((
        OsInfo {
            name: Reading::from_option(name, "OS name not reported"),
            version: Reading::from_option(version, "OS version not reported"),
            build: Reading::from_option(build, "OS build not reported"),
            architecture: std::env::consts::ARCH.to_string(),
            uptime_seconds: System::uptime(),
        },
        warnings,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corrects_windows_11_name() {
        assert_eq!(
            fix_product_name("Windows 10 Pro", Some(26100)),
            "Windows 11 Pro"
        );
        assert_eq!(
            fix_product_name("Windows 10 Pro", Some(19045)),
            "Windows 10 Pro"
        );
        assert_eq!(fix_product_name("Windows 10 Pro", None), "Windows 10 Pro");
    }
}
