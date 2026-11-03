//! The data directory from the command line.

use std::path::{Path, PathBuf};

/// The first argument that is not a flag, if there is one.
pub fn data_dir_arg(args: &[String]) -> Option<&str> {
    args.iter().skip(1).find(|a| !a.starts_with('-')).map(String::as_str)
}

/// Creates the directory if necessary and makes sure that it is writable.
/// Returns the canonical path.
pub fn prepare_dir(path: &Path) -> Result<PathBuf, String> {
    if path.exists() && !path.is_dir() {
        return Err(format!("Not a directory: {}", path.display()));
    }
    std::fs::create_dir_all(path).map_err(|e| format!("Could not create directory {}: {e}", path.display()))?;
    let dir = path.canonicalize().map_err(|e| format!("Invalid directory {}: {e}", path.display()))?;
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", dir.display()));
    }
    let probe = dir.join(format!(".ihf_write_test_{}", uuid::Uuid::new_v4().simple()));
    std::fs::write(&probe, b"").map_err(|_| format!("Directory is not writable: {}", dir.display()))?;
    let _ = std::fs::remove_file(probe);
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn picks_first_positional_argument() {
        assert_eq!(data_dir_arg(&args(&["app"])), None);
        assert_eq!(data_dir_arg(&args(&["app", "--flag", "/x"])), Some("/x"));
    }

    #[test]
    fn creates_missing_directory() {
        let d = tempdir().unwrap();
        let sub = d.path().join("a/b");
        let got = prepare_dir(&sub).unwrap();
        assert!(got.is_dir());
        assert_eq!(std::fs::read_dir(&got).unwrap().count(), 0);
    }

    #[test]
    fn refuses_a_file() {
        let d = tempdir().unwrap();
        let f = d.path().join("file");
        std::fs::write(&f, "").unwrap();
        assert!(prepare_dir(&f).unwrap_err().starts_with("Not a directory"));
    }
}
