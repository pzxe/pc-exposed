//! Battery state via GetSystemPowerStatus. Desktops report "no battery".

use super::{model::*, Collected};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

pub fn interpret(ac_line: u8, flag: u8, percent: u8) -> BatteryInfo {
    // BatteryFlag 128 = no system battery. 255 = status unknown.
    if flag != 255 && flag & 128 != 0 {
        return BatteryInfo {
            present: false,
            percent: Reading::missing("no battery"),
            on_ac_power: Reading::missing("no battery"),
            charging: Reading::missing("no battery"),
        };
    }
    BatteryInfo {
        present: true,
        percent: if percent <= 100 {
            Reading::ok(percent)
        } else {
            Reading::missing("charge level unknown")
        },
        on_ac_power: match ac_line {
            0 => Reading::ok(false),
            1 => Reading::ok(true),
            _ => Reading::missing("AC status unknown"),
        },
        charging: if flag == 255 {
            Reading::missing("charging state unknown")
        } else {
            Reading::ok(flag & 8 != 0)
        },
    }
}

pub fn collect() -> Collected<BatteryInfo> {
    let mut s = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut s) }
        .map_err(|e| format!("power status unavailable: {e}"))?;
    Ok((
        interpret(s.ACLineStatus, s.BatteryFlag, s.BatteryLifePercent),
        Vec::new(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_has_no_battery() {
        let b = interpret(1, 128, 255);
        assert!(!b.present);
        assert!(b.percent.value().is_none());
    }

    #[test]
    fn laptop_charging() {
        let b = interpret(1, 8, 55);
        assert!(b.present);
        assert_eq!(b.percent, Reading::ok(55));
        assert_eq!(b.charging, Reading::ok(true));
        assert_eq!(b.on_ac_power, Reading::ok(true));
    }

    #[test]
    fn unknown_values_are_unavailable_not_zero() {
        let b = interpret(255, 255, 255);
        assert!(b.present);
        assert!(b.percent.value().is_none());
        assert!(b.on_ac_power.value().is_none());
        assert!(b.charging.value().is_none());
    }
}
