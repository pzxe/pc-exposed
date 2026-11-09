//! GPU enumeration through DXGI (accurate VRAM; WMI's AdapterRAM caps at 4 GB).
//!
//! Utilization and temperature need vendor APIs (NVML / ADL / IGCL). They are
//! not implemented, so they are reported as Unavailable rather than guessed.

use super::{model::*, Collected};
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
};

pub fn vendor_name(vendor_id: u32) -> Option<&'static str> {
    match vendor_id {
        0x10DE => Some("NVIDIA"),
        0x1002 | 0x1022 => Some("AMD"),
        0x8086 => Some("Intel"),
        0x1414 => Some("Microsoft"),
        0x5143 => Some("Qualcomm"),
        _ => None,
    }
}

fn adapter_name(desc: &[u16]) -> String {
    let end = desc.iter().position(|&c| c == 0).unwrap_or(desc.len());
    String::from_utf16_lossy(&desc[..end]).trim().to_string()
}

pub fn collect() -> Collected<Vec<GpuInfo>> {
    let factory: IDXGIFactory1 =
        unsafe { CreateDXGIFactory1() }.map_err(|e| format!("DXGI factory unavailable: {e}"))?;

    let mut gpus = Vec::new();
    let mut i = 0;
    while let Ok(adapter) = unsafe { factory.EnumAdapters1(i) } {
        i += 1;
        let Ok(desc) = (unsafe { adapter.GetDesc1() }) else {
            continue;
        };
        let is_software = desc.Flags & (DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0;
        gpus.push(GpuInfo {
            name: adapter_name(&desc.Description),
            manufacturer: Reading::from_option(
                vendor_name(desc.VendorId).map(String::from),
                "unknown PCI vendor id",
            ),
            dedicated_vram_bytes: Reading::ok(desc.DedicatedVideoMemory as u64),
            shared_memory_bytes: Reading::ok(desc.SharedSystemMemory as u64),
            utilization_percent: Reading::missing(
                "GPU utilization needs a vendor API (not implemented in this beta)",
            ),
            temperature_c: Reading::missing(
                "GPU temperature needs a vendor API (not implemented in this beta)",
            ),
            is_software,
        });
    }
    if gpus.is_empty() {
        return Err("no graphics adapters reported by DXGI".into());
    }
    Ok((gpus, Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_vendors() {
        assert_eq!(vendor_name(0x10DE), Some("NVIDIA"));
        assert_eq!(vendor_name(0x1002), Some("AMD"));
        assert_eq!(vendor_name(0x8086), Some("Intel"));
        assert_eq!(vendor_name(0xFFFF), None);
    }

    #[test]
    fn decodes_utf16_name() {
        let mut buf = [0u16; 8];
        for (i, c) in "RTX".encode_utf16().enumerate() {
            buf[i] = c;
        }
        assert_eq!(adapter_name(&buf), "RTX");
    }
}
