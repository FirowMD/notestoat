use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fmt::Write as _;
use std::fs;
use std::io::ErrorKind;
use std::time::UNIX_EPOCH;

const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024;

#[derive(Serialize)]
pub struct FileData {
    content: String,
    hash: String,
    modified: u64,
}

#[derive(Serialize)]
pub struct SavedFileData {
    hash: String,
    modified: u64,
}

fn calculate_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    let mut output = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(&mut output, "{byte:02x}");
    }
    output
}

fn permission_aware_error(error: std::io::Error) -> String {
    if error.kind() == ErrorKind::PermissionDenied {
        format!("PERMISSION_DENIED: {error}")
    } else {
        error.to_string()
    }
}

fn modified_timestamp(metadata: &fs::Metadata) -> Result<u64, String> {
    metadata
        .modified()
        .map_err(|error| error.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())
        .map(|duration| duration.as_secs())
}

fn decode_content(bytes: &[u8], encoding: &str) -> String {
    match encoding.to_ascii_uppercase().as_str() {
        "UTF-16LE" => encoding_rs::UTF_16LE.decode(bytes).0.into_owned(),
        "UTF-16BE" => encoding_rs::UTF_16BE.decode(bytes).0.into_owned(),
        "WINDOWS-1252" => WINDOWS_1252.decode(bytes).0.into_owned(),
        _ => String::from_utf8_lossy(bytes).into_owned(),
    }
}

fn encode_content(content: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding.to_ascii_uppercase().as_str() {
        "UTF-16LE" => {
            let mut bytes = Vec::with_capacity(content.len() * 2 + 2);
            bytes.extend_from_slice(&[0xff, 0xfe]);
            for unit in content.encode_utf16() {
                bytes.extend_from_slice(&unit.to_le_bytes());
            }
            Ok(bytes)
        }
        "UTF-16BE" => {
            let mut bytes = Vec::with_capacity(content.len() * 2 + 2);
            bytes.extend_from_slice(&[0xfe, 0xff]);
            for unit in content.encode_utf16() {
                bytes.extend_from_slice(&unit.to_be_bytes());
            }
            Ok(bytes)
        }
        "WINDOWS-1252" => {
            let (bytes, _, had_errors) = WINDOWS_1252.encode(content);
            if had_errors {
                Err("Content contains characters that cannot be represented as Windows-1252".into())
            } else {
                Ok(bytes.into_owned())
            }
        }
        _ => Ok(content.as_bytes().to_vec()),
    }
}

#[tauri::command]
pub fn read_file(path: &str, encoding: Option<String>) -> Result<FileData, String> {
    let metadata = fs::metadata(path).map_err(permission_aware_error)?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err("File too large (>100MB). Large files are not supported.".into());
    }

    let bytes = fs::read(path).map_err(permission_aware_error)?;
    let content = decode_content(&bytes, encoding.as_deref().unwrap_or("utf-8"));
    let hash = calculate_hash(&content);
    let modified = modified_timestamp(&metadata)?;

    Ok(FileData {
        content,
        hash,
        modified,
    })
}

#[tauri::command]
pub fn save_file(
    path: &str,
    content: &str,
    encoding: Option<String>,
) -> Result<SavedFileData, String> {
    let bytes = encode_content(content, encoding.as_deref().unwrap_or("utf-8"))?;
    fs::write(path, bytes).map_err(permission_aware_error)?;
    let metadata = fs::metadata(path).map_err(permission_aware_error)?;

    Ok(SavedFileData {
        hash: calculate_hash(content),
        modified: modified_timestamp(&metadata)?,
    })
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    trash::delete(path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{decode_content, encode_content};

    #[test]
    fn utf16_round_trips() {
        for encoding in ["utf-16le", "utf-16be"] {
            let bytes = encode_content("Hello, мир", encoding).unwrap();
            assert_eq!(decode_content(&bytes, encoding), "Hello, мир");
        }
    }

    #[test]
    fn windows_1252_rejects_unrepresentable_content() {
        assert!(encode_content("Hello, мир", "windows-1252").is_err());
    }
}
