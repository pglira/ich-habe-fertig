//! The `ihf` URI scheme serves the image files of the open data directory.
//! It refuses all paths outside the `images` folder of the data directory.

use crate::commands::AppState;
use percent_encoding::percent_decode_str;
use std::borrow::Cow;
use std::path::Path;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext};

pub const SCHEME: &str = "ihf";

type Body = Cow<'static, [u8]>;

/// The path relative to the data directory of a request URI path. The
/// frontend encodes the relative path as one path segment.
fn rel_path(uri_path: &str) -> Option<String> {
    let encoded = uri_path.strip_prefix('/').unwrap_or(uri_path);
    let decoded = percent_decode_str(encoded).decode_utf8().ok()?;
    decoded.starts_with("images/").then(|| decoded.into_owned())
}

fn mime_type(path: &Path) -> &'static str {
    match crate::images::image_ext(path).as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    }
}

fn status(code: StatusCode) -> Response<Body> {
    Response::builder().status(code).body(Cow::Borrowed(&[][..])).unwrap()
}

pub fn handle<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: Request<Vec<u8>>) -> Response<Body> {
    let Some(rel) = rel_path(request.uri().path()) else {
        return status(StatusCode::FORBIDDEN);
    };
    let state = ctx.app_handle().state::<AppState>();
    let abs = state.store.lock().unwrap().as_ref().and_then(|s| s.resolve(&rel));
    let Some(abs) = abs else {
        return status(StatusCode::FORBIDDEN);
    };
    match std::fs::read(&abs) {
        Ok(bytes) => Response::builder()
            .header(header::CONTENT_TYPE, mime_type(&abs))
            .body(Cow::Owned(bytes))
            .unwrap(),
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_relative_image_paths() {
        assert_eq!(rel_path("/images%2Fab%2Fx%20y.png").as_deref(), Some("images/ab/x y.png"));
        assert_eq!(rel_path("/todos.db"), None);
    }

    #[test]
    fn guesses_image_types() {
        assert_eq!(mime_type(Path::new("a.JPG")), "image/jpeg");
        assert_eq!(mime_type(Path::new("a")), "application/octet-stream");
    }
}
