//! Saving share images.
//!
//! Security model: the webview has NO filesystem permission. It hands the PNG
//! bytes to this command, which (1) validates them as a real, size-limited PNG,
//! (2) shows the OS "Save as" dialog itself, and (3) writes only to the path the
//! user picked there. Nothing is ever uploaded.

use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

pub const MAX_PNG_BYTES: usize = 16 * 1024 * 1024;
const PNG_MAGIC: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

/// Accepts only data that starts with the PNG signature and is within the size limit.
pub fn validate_png(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("image is empty".into());
    }
    if bytes.len() > MAX_PNG_BYTES {
        return Err("image is larger than the 16 MB limit".into());
    }
    if bytes.len() < 8 || bytes[..8] != PNG_MAGIC {
        return Err("data is not a PNG image".into());
    }
    Ok(())
}

/// Reduces a suggested file name to safe characters and guarantees a `.png` extension.
pub fn sanitize_file_name(raw: &str) -> String {
    sanitize_with_ext(raw, "png", "pc-exposed")
}

/// Same, for any extension. `ext` must be a plain lowercase extension without the dot.
pub fn sanitize_with_ext(raw: &str, ext: &str, fallback_stem: &str) -> String {
    let suffix = format!(".{ext}");
    let stem: String = raw
        .trim_end_matches(suffix.as_str())
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let stem = stem.trim_matches('-');
    let stem: String = stem.chars().take(80).collect();
    if stem.is_empty() {
        format!("{fallback_stem}.{ext}")
    } else {
        format!("{stem}.{ext}")
    }
}

/// Forces a `.png` extension on the user-chosen path, then writes the bytes.
pub fn write_png(path: &Path, bytes: &[u8]) -> Result<PathBuf, String> {
    validate_png(bytes)?;
    let mut target = path.to_path_buf();
    if !target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("png"))
    {
        target.set_extension("png");
    }
    std::fs::write(&target, bytes).map_err(|e| format!("could not write the file: {e}"))?;
    Ok(target)
}

pub const MAX_REPORT_BYTES: usize = 1024 * 1024;
pub const REPORT_FORMAT: &str = "pc-exposed-report";

/// Accepts only UTF-8 JSON, within the size limit, that is an object tagged as a PC EXPOSED report.
pub fn validate_report_json(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("report is empty".into());
    }
    if bytes.len() > MAX_REPORT_BYTES {
        return Err("report is larger than the 1 MB limit".into());
    }
    let text = std::str::from_utf8(bytes).map_err(|_| "report is not valid UTF-8".to_string())?;
    let v: serde_json::Value =
        serde_json::from_str(text).map_err(|_| "report is not valid JSON".to_string())?;
    match v.get("format").and_then(|f| f.as_str()) {
        Some(REPORT_FORMAT) => Ok(()),
        _ => Err("data is not a PC EXPOSED report".into()),
    }
}

/// Forces a `.json` extension on the user-chosen path, then writes the report.
pub fn write_report(path: &Path, bytes: &[u8]) -> Result<PathBuf, String> {
    validate_report_json(bytes)?;
    let mut target = path.to_path_buf();
    if !target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("json"))
    {
        target.set_extension("json");
    }
    std::fs::write(&target, bytes).map_err(|e| format!("could not write the file: {e}"))?;
    Ok(target)
}

/// Shows the Save dialog and writes an exported report (JSON). Returns the saved path, or `None` if cancelled.
#[tauri::command]
pub async fn save_report_file(
    app: AppHandle,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(b) => b.clone(),
        InvokeBody::Json(_) => return Err("expected raw report bytes".into()),
    };
    validate_report_json(&bytes)?;
    let name = sanitize_with_ext(
        request
            .headers()
            .get("x-file-name")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("pc-exposed-report"),
        "json",
        "pc-exposed-report",
    );
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("PC EXPOSED report", &["json"])
            .set_file_name(&name)
            .blocking_save_file()
    })
    .await
    .map_err(|e| format!("save dialog failed: {e}"))?;
    match chosen {
        None => Ok(None),
        Some(fp) => {
            let path = fp.into_path().map_err(|e| format!("invalid path: {e}"))?;
            Ok(Some(
                write_report(&path, &bytes)?.to_string_lossy().to_string(),
            ))
        }
    }
}

/// Shows the Save dialog and writes the PNG. Returns the saved path, or `None` if cancelled.
#[tauri::command]
pub async fn save_share_image(
    app: AppHandle,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(b) => b.clone(),
        InvokeBody::Json(_) => return Err("expected raw PNG bytes".into()),
    };
    validate_png(&bytes)?;
    let name = sanitize_file_name(
        request
            .headers()
            .get("x-file-name")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("pc-exposed"),
    );

    let chosen = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("PNG image", &["png"])
            .set_file_name(&name)
            .blocking_save_file()
    })
    .await
    .map_err(|e| format!("save dialog failed: {e}"))?;

    match chosen {
        None => Ok(None),
        Some(fp) => {
            let path = fp.into_path().map_err(|e| format!("invalid path: {e}"))?;
            Ok(Some(
                write_png(&path, &bytes)?.to_string_lossy().to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(extra: usize) -> Vec<u8> {
        let mut v = PNG_MAGIC.to_vec();
        v.extend(std::iter::repeat(0u8).take(extra));
        v
    }

    #[test]
    fn accepts_png_rejects_others() {
        assert!(validate_png(&png(10)).is_ok());
        assert!(validate_png(&[]).is_err());
        assert!(validate_png(b"<html>not an image</html>").is_err());
        assert!(validate_png(b"MZ\x90\x00 executable").is_err());
        assert!(validate_png(&PNG_MAGIC[..4]).is_err());
    }

    #[test]
    fn enforces_size_limit() {
        assert!(validate_png(&png(MAX_PNG_BYTES)).is_err());
        assert!(validate_png(&png(MAX_PNG_BYTES - 8)).is_ok());
    }

    #[test]
    fn file_names_are_sanitized() {
        assert_eq!(
            sanitize_file_name("pc-exposed-identity-portrait.png"),
            "pc-exposed-identity-portrait.png"
        );
        assert_eq!(
            sanitize_file_name("..\\..\\Windows\\evil.exe"),
            "Windows-evil-exe.png"
        );
        assert_eq!(sanitize_file_name("a/b:c*d?.png"), "a-b-c-d.png");
        assert_eq!(sanitize_file_name(""), "pc-exposed.png");
        assert_eq!(sanitize_file_name("///"), "pc-exposed.png");
        assert!(sanitize_file_name(&"x".repeat(500)).len() <= 84);
    }

    #[test]
    fn report_json_validation() {
        assert!(
            validate_report_json(br#"{"format":"pc-exposed-report","formatVersion":1}"#).is_ok()
        );
        assert!(validate_report_json(b"").is_err());
        assert!(validate_report_json(b"not json").is_err());
        assert!(validate_report_json(br#"{"format":"something-else"}"#).is_err());
        assert!(validate_report_json(br#"["pc-exposed-report"]"#).is_err());
        assert!(validate_report_json(&[0xFF, 0xFE, 0xFD]).is_err());
        let big = format!(
            r#"{{"format":"pc-exposed-report","pad":"{}"}}"#,
            "x".repeat(MAX_REPORT_BYTES)
        );
        assert!(validate_report_json(big.as_bytes()).is_err());
    }

    #[test]
    fn report_names_get_json_extension() {
        assert_eq!(
            sanitize_with_ext("my report.json", "json", "pc-exposed-report"),
            "my-report.json"
        );
        assert_eq!(
            sanitize_with_ext(r"..\x", "json", "pc-exposed-report"),
            "x.json"
        );
        assert_eq!(
            sanitize_with_ext("", "json", "pc-exposed-report"),
            "pc-exposed-report.json"
        );
    }

    #[test]
    fn writes_report_with_forced_extension_and_rejects_non_reports() {
        let dir = std::env::temp_dir().join(format!("pcx-report-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ok = br#"{"format":"pc-exposed-report","formatVersion":1}"#;
        let out = write_report(&dir.join("r.txt"), ok).unwrap();
        assert_eq!(out.extension().unwrap(), "json");
        assert!(write_report(&dir.join("bad.json"), b"{\"format\":\"nope\"}").is_err());
        assert!(!dir.join("bad.json").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn writes_only_valid_png_and_forces_extension() {
        let dir = std::env::temp_dir().join(format!("pcx-export-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let out = write_png(&dir.join("card.txt"), &png(32)).unwrap();
        assert_eq!(out.extension().unwrap(), "png");
        assert_eq!(std::fs::read(&out).unwrap().len(), 40);
        assert!(write_png(&dir.join("bad.png"), b"not a png at all").is_err());
        assert!(!dir.join("bad.png").exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}
