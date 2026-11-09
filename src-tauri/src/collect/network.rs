//! Physical network adapters via WMI. MAC and IP addresses are deliberately
//! NOT collected: they are identifiers with no value for the roast/score.

use super::{model::*, Collected};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32NetworkAdapter {
    name: Option<String>,
    net_enabled: Option<bool>,
    speed: Option<u64>,
}

fn convert(rows: Vec<Win32NetworkAdapter>) -> Vec<NetworkAdapter> {
    rows.into_iter()
        .filter_map(|r| {
            let name = r.name?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let speed = r.speed.filter(|&s| s > 0 && s < i64::MAX as u64);
            Some(NetworkAdapter {
                name,
                connected: Reading::from_option(r.net_enabled, "connection state not reported"),
                speed_bits_per_sec: Reading::from_option(speed, "link speed not reported"),
            })
        })
        .collect()
}

pub fn collect() -> Collected<Vec<NetworkAdapter>> {
    let con = wmi::WMIConnection::new().map_err(|e| format!("WMI unavailable: {e}"))?;
    let rows: Vec<Win32NetworkAdapter> = con
        .raw_query(
            "SELECT Name, NetEnabled, Speed FROM Win32_NetworkAdapter WHERE PhysicalAdapter = TRUE",
        )
        .map_err(|e| format!("network adapter query failed: {e}"))?;
    Ok((convert(rows), Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_rows_and_treats_bad_speed_as_unavailable() {
        let out = convert(vec![
            Win32NetworkAdapter {
                name: Some("Ethernet".into()),
                net_enabled: Some(true),
                speed: Some(1_000_000_000),
            },
            Win32NetworkAdapter {
                name: Some("Wi-Fi".into()),
                net_enabled: None,
                speed: Some(i64::MAX as u64),
            },
            Win32NetworkAdapter {
                name: None,
                net_enabled: None,
                speed: None,
            },
        ]);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].speed_bits_per_sec, Reading::ok(1_000_000_000));
        assert!(out[1].connected.value().is_none());
        assert!(out[1].speed_bits_per_sec.value().is_none());
    }
}
