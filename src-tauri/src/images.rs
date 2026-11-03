//! Image attachments: files below `images/<id>/` in the data directory.

use crate::error::{AppError, Result};
use crate::store::TodoStore;
use percent_encoding::percent_decode_str;
use std::path::{Path, PathBuf};

const ALLOWED_EXTS: &[&str] = &["png", "jpg", "jpeg", "bmp", "webp", "gif"];

/// The lowercase extension of a path, if it is an allowed image type.
pub fn image_ext(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    ALLOWED_EXTS.contains(&ext.as_str()).then_some(ext)
}

/// A new unique path, relative to the data directory, for an image of an item.
fn new_rel_path(item_id: &str, ext: &str) -> String {
    let ts = chrono::Local::now().format("%Y%m%dT%H%M%S");
    let rand = &uuid::Uuid::new_v4().simple().to_string()[..8];
    format!("images/{item_id}/{ts}_{rand}.{ext}")
}

fn target(store: &TodoStore, item_id: &str, ext: &str) -> Result<(String, PathBuf)> {
    let rel = new_rel_path(item_id, ext);
    let abs = store.resolve(&rel).ok_or_else(|| AppError::Invalid(format!("invalid item id: {item_id}")))?;
    std::fs::create_dir_all(abs.parent().unwrap())?;
    Ok((rel, abs))
}

/// Writes image data to a new file and attaches it to the item.
pub fn save_bytes(store: &TodoStore, item_id: &str, bytes: &[u8], ext: &str) -> Result<String> {
    let (rel, abs) = target(store, item_id, ext)?;
    std::fs::write(&abs, bytes)?;
    store.add_image(item_id, &rel)?;
    Ok(rel)
}

/// Copies an image file into the data directory and attaches it to the item.
/// Returns `None` if the file is not an image of an allowed type.
pub fn import_file(store: &TodoStore, item_id: &str, src: &Path) -> Result<Option<String>> {
    let Some(ext) = image_ext(src) else { return Ok(None) };
    if !src.is_file() {
        return Ok(None);
    }
    let (rel, abs) = target(store, item_id, &ext)?;
    std::fs::copy(src, &abs)?;
    store.add_image(item_id, &rel)?;
    Ok(Some(rel))
}

/// The local file paths in a text: `file://` URIs or absolute paths, one per line.
pub fn parse_file_list(text: &str) -> Vec<PathBuf> {
    text.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .filter_map(|l| {
            if let Some(rest) = l.strip_prefix("file://") {
                let path = rest.strip_prefix("localhost").unwrap_or(rest);
                percent_decode_str(path).decode_utf8().ok().map(|p| PathBuf::from(p.as_ref()))
            } else if l.starts_with('/') {
                Some(PathBuf::from(l))
            } else {
                None
            }
        })
        .collect()
}

/// The image content of the system clipboard.
pub enum ClipboardImage {
    Png(Vec<u8>),
    Files(Vec<PathBuf>),
}

fn encode_png(width: usize, height: usize, rgba: &[u8]) -> Result<Vec<u8>> {
    let mut out = Vec::new();
    let mut enc = png::Encoder::new(&mut out, width as u32, height as u32);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut w = enc.write_header().map_err(|e| AppError::Invalid(e.to_string()))?;
    w.write_image_data(rgba).map_err(|e| AppError::Invalid(e.to_string()))?;
    w.finish().map_err(|e| AppError::Invalid(e.to_string()))?;
    Ok(out)
}

/// Reads an image from the clipboard: image data, else a list of image files.
pub fn read_clipboard() -> Result<ClipboardImage> {
    let mut cb = arboard::Clipboard::new().map_err(|e| AppError::Invalid(format!("clipboard: {e}")))?;
    if let Ok(img) = cb.get_image() {
        return Ok(ClipboardImage::Png(encode_png(img.width, img.height, &img.bytes)?));
    }
    let files: Vec<PathBuf> = cb
        .get_text()
        .map(|t| parse_file_list(&t))
        .unwrap_or_default()
        .into_iter()
        .filter(|p| image_ext(p).is_some())
        .collect();
    if files.is_empty() {
        return Err(AppError::Invalid("The clipboard has no usable image.".into()));
    }
    Ok(ClipboardImage::Files(files))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn allowed_extensions() {
        assert_eq!(image_ext(Path::new("a.PNG")).as_deref(), Some("png"));
        assert_eq!(image_ext(Path::new("a.jpeg")).as_deref(), Some("jpeg"));
        assert_eq!(image_ext(Path::new("a.txt")), None);
        assert_eq!(image_ext(Path::new("a")), None);
    }

    #[test]
    fn parses_file_lists() {
        let t = "file:///home/a%20b.png\r\n# comment\nfile://localhost/x.jpg\n/abs/c.gif\nrel.png\n";
        assert_eq!(
            parse_file_list(t),
            vec![PathBuf::from("/home/a b.png"), PathBuf::from("/x.jpg"), PathBuf::from("/abs/c.gif")]
        );
    }

    #[test]
    fn saves_and_imports() {
        let d = tempdir().unwrap();
        let s = TodoStore::open(d.path()).unwrap();
        let it = s.add("Task", "").unwrap();
        let rel = save_bytes(&s, &it.id, b"data", "png").unwrap();
        assert!(rel.starts_with(&format!("images/{}/", it.id)));
        assert_eq!(std::fs::read(s.resolve(&rel).unwrap()).unwrap(), b"data");

        let src = d.path().join("src.jpg");
        std::fs::write(&src, b"jpg").unwrap();
        let rel2 = import_file(&s, &it.id, &src).unwrap().unwrap();
        assert!(rel2.ends_with(".jpg"));
        assert!(import_file(&s, &it.id, &d.path().join("todos.db")).unwrap().is_none());
        assert_eq!(s.get(&it.id).unwrap().unwrap().images, vec![rel, rel2]);
    }

    #[test]
    fn encodes_png() {
        let png = encode_png(1, 1, &[255, 0, 0, 255]).unwrap();
        assert_eq!(&png[1..4], b"PNG");
    }
}
