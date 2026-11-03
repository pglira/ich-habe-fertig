//! The todo store: the SQLite database `todos.db` and the image files below
//! `images/<id>/` in the data directory.
//!
//! Time stamps are stored as UTC ISO 8601 text with milliseconds, for example
//! `2026-03-20T12:30:00.000Z`. The due date is stored as midnight UTC of the
//! due day.

use crate::error::{AppError, Result};
use chrono::{DateTime, NaiveDate, NaiveDateTime, SecondsFormat, TimeZone, Utc};
use md5::{Digest, Md5};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SubTask {
    pub id: String,
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TodoItem {
    pub id: String,
    pub text: String,
    pub notes: String,
    pub done: bool,
    pub category: String,
    /// The hue (0..360) of the automatic color of the category; `None` for no category.
    pub category_hue: Option<u16>,
    /// The color `#rrggbb` that the user set for the category, if any.
    pub category_color: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub due_at: Option<NaiveDate>,
    /// Paths relative to the data directory.
    pub images: Vec<String>,
    pub subtasks: Vec<SubTask>,
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS todos (
    id           TEXT PRIMARY KEY,
    text         TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    done         INTEGER NOT NULL DEFAULT 0,
    category     TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    completed_at TEXT,
    due_at       TEXT,
    position     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
    todo_id  TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    rel_path TEXT NOT NULL,
    ord      INTEGER NOT NULL,
    PRIMARY KEY (todo_id, rel_path)
);
CREATE TABLE IF NOT EXISTS subtasks (
    id       TEXT PRIMARY KEY,
    todo_id  TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0,
    ord      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_images_todo ON images(todo_id);
CREATE TABLE IF NOT EXISTS categories (
    name     TEXT PRIMARY KEY,
    color    TEXT,
    archived INTEGER NOT NULL DEFAULT 0
);
";

const ITEM_COLUMNS: &str = "id, text, notes, done, category, created_at, completed_at, due_at";

/// A new random ID: 32 lowercase hex digits.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

/// The current time in UTC, truncated to milliseconds (the stored precision).
pub fn utc_now() -> DateTime<Utc> {
    let now = Utc::now();
    Utc.timestamp_millis_opt(now.timestamp_millis()).unwrap()
}

pub fn format_utc(dt: &DateTime<Utc>) -> String {
    dt.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Parses a stored time stamp. A time stamp without a time zone is UTC.
pub fn parse_utc(s: &str) -> Option<DateTime<Utc>> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc));
    }
    for fmt in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"] {
        if let Ok(n) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(Utc.from_utc_datetime(&n));
        }
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .ok()
        .map(|d| Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap()))
}

fn format_due(d: &NaiveDate) -> String {
    format_utc(&Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap()))
}

/// The hue of the color of a category: the first byte of the MD5 hash of the
/// UTF-8 text, scaled to 0..360.
pub fn category_hue(category: &str) -> Option<u16> {
    if category.is_empty() {
        return None;
    }
    let hash = Md5::digest(category.as_bytes());
    Some((hash[0] as u32 * 360 / 256) as u16)
}

/// Adds the columns that older versions of the schema do not have.
fn migrate(conn: &Connection) -> Result<()> {
    let has_archived = conn
        .prepare("SELECT 1 FROM pragma_table_info('categories') WHERE name = 'archived'")?
        .exists([])?;
    if !has_archived {
        conn.execute_batch("ALTER TABLE categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")?;
    }
    Ok(())
}

pub struct TodoStore {
    dir: PathBuf,
    pub(crate) conn: Connection,
}

impl TodoStore {
    /// Opens (and if necessary creates) the store in `dir`.
    pub fn open(dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(dir)?;
        let dir = dir.canonicalize()?;
        let conn = Connection::open(dir.join("todos.db"))?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
        conn.execute_batch(SCHEMA)?;
        migrate(&conn)?;
        Ok(Self { dir, conn })
    }

    pub fn data_dir(&self) -> &Path {
        &self.dir
    }

    /// The absolute path of a path relative to the data directory. Refuses
    /// absolute paths and paths that leave the data directory.
    pub fn resolve(&self, rel: &str) -> Option<PathBuf> {
        let p = Path::new(rel);
        if rel.is_empty() || !p.components().all(|c| matches!(c, Component::Normal(_))) {
            return None;
        }
        Some(self.dir.join(p))
    }

    fn exists(&self, id: &str) -> Result<bool> {
        Ok(self
            .conn
            .query_row("SELECT 1 FROM todos WHERE id = ?", [id], |_| Ok(()))
            .optional()?
            .is_some())
    }

    fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<TodoItem> {
        let category: String = row.get(4)?;
        let ts = |i: usize| -> rusqlite::Result<Option<DateTime<Utc>>> {
            Ok(row.get::<_, Option<String>>(i)?.as_deref().and_then(parse_utc))
        };
        Ok(TodoItem {
            id: row.get(0)?,
            text: row.get(1)?,
            notes: row.get(2)?,
            done: row.get::<_, i64>(3)? != 0,
            category_hue: category_hue(&category),
            category_color: None,
            category,
            created_at: ts(5)?,
            completed_at: ts(6)?,
            due_at: ts(7)?.map(|d| d.date_naive()),
            images: Vec::new(),
            subtasks: Vec::new(),
        })
    }

    fn fill_children(&self, item: &mut TodoItem) -> Result<()> {
        let mut q = self
            .conn
            .prepare_cached("SELECT rel_path FROM images WHERE todo_id = ? ORDER BY ord ASC")?;
        item.images = q
            .query_map([&item.id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        let mut q = self
            .conn
            .prepare_cached("SELECT id, text, done FROM subtasks WHERE todo_id = ? ORDER BY ord ASC")?;
        item.subtasks = q
            .query_map([&item.id], |r| {
                Ok(SubTask { id: r.get(0)?, text: r.get(1)?, done: r.get::<_, i64>(2)? != 0 })
            })?
            .filter_map(|s| s.ok())
            .filter(|s| !s.id.is_empty() && !s.text.is_empty())
            .collect();
        Ok(())
    }

    /// All items, newest creation date first.
    pub fn load(&self) -> Result<Vec<TodoItem>> {
        let mut q = self.conn.prepare(&format!(
            "SELECT {ITEM_COLUMNS} FROM todos ORDER BY created_at DESC, position ASC"
        ))?;
        let mut items: Vec<TodoItem> = q
            .query_map([], Self::row_to_item)?
            .filter_map(|r| r.ok())
            .filter(|it| !it.id.is_empty() && !it.text.is_empty())
            .collect();
        let colors = self.category_colors()?;
        for it in &mut items {
            self.fill_children(it)?;
            it.category_color = colors.get(&it.category).cloned();
        }
        Ok(items)
    }

    pub fn get(&self, id: &str) -> Result<Option<TodoItem>> {
        let item = self
            .conn
            .query_row(&format!("SELECT {ITEM_COLUMNS} FROM todos WHERE id = ?"), [id], Self::row_to_item)
            .optional()?;
        match item {
            Some(mut it) => {
                self.fill_children(&mut it)?;
                it.category_color = self.category_colors()?.remove(&it.category);
                Ok(Some(it))
            }
            None => Ok(None),
        }
    }

    pub fn add(&self, text: &str, notes: &str) -> Result<TodoItem> {
        let text = text.trim();
        if text.is_empty() {
            return Err(AppError::Invalid("the title is empty".into()));
        }
        let pos: i64 =
            self.conn.query_row("SELECT COALESCE(MIN(position), 0) FROM todos", [], |r| r.get(0))?;
        let item = TodoItem {
            id: new_id(),
            text: text.to_string(),
            notes: notes.to_string(),
            done: false,
            category: String::new(),
            category_hue: None,
            category_color: None,
            created_at: Some(utc_now()),
            completed_at: None,
            due_at: None,
            images: Vec::new(),
            subtasks: Vec::new(),
        };
        self.conn.execute(
            "INSERT INTO todos (id, text, notes, done, category, created_at, completed_at, due_at, position) \
             VALUES (?, ?, ?, 0, '', ?, NULL, NULL, ?)",
            params![item.id, item.text, item.notes, format_utc(item.created_at.as_ref().unwrap()), pos - 1],
        )?;
        Ok(item)
    }

    /// Reads one column of an item; `None` if the item does not exist.
    fn column<T: rusqlite::types::FromSql>(&self, col: &str, id: &str) -> Result<Option<T>> {
        Ok(self
            .conn
            .query_row(&format!("SELECT {col} FROM todos WHERE id = ?"), [id], |r| r.get(0))
            .optional()?)
    }

    /// Sets the done state. Returns false if the item does not exist or the
    /// state does not change.
    pub fn set_done(&self, id: &str, done: bool) -> Result<bool> {
        match self.column::<i64>("done", id)? {
            Some(cur) if (cur != 0) != done => {}
            _ => return Ok(false),
        }
        let completed = done.then(|| format_utc(&utc_now()));
        self.conn.execute(
            "UPDATE todos SET done = ?, completed_at = ? WHERE id = ?",
            params![done as i64, completed, id],
        )?;
        Ok(true)
    }

    pub fn set_category(&self, id: &str, category: &str) -> Result<bool> {
        let category = category.trim();
        match self.column::<String>("category", id)? {
            Some(cur) if cur != category => {}
            _ => return Ok(false),
        }
        self.conn.execute("UPDATE todos SET category = ? WHERE id = ?", params![category, id])?;
        Ok(true)
    }

    pub fn set_created_at(&self, id: &str, created_at: DateTime<Utc>) -> Result<bool> {
        let Some(cur) = self.column::<String>("created_at", id)? else {
            return Ok(false);
        };
        let norm = Utc.timestamp_millis_opt(created_at.timestamp_millis()).unwrap();
        if parse_utc(&cur) == Some(norm) {
            return Ok(false);
        }
        self.conn
            .execute("UPDATE todos SET created_at = ? WHERE id = ?", params![format_utc(&norm), id])?;
        Ok(true)
    }

    /// Sets or clears (`None`) the due date.
    pub fn set_due_at(&self, id: &str, due: Option<NaiveDate>) -> Result<bool> {
        let Some(cur) = self.column::<Option<String>>("due_at", id)? else {
            return Ok(false);
        };
        let cur = cur.as_deref().and_then(parse_utc).map(|d| d.date_naive());
        if cur == due {
            return Ok(false);
        }
        self.conn.execute(
            "UPDATE todos SET due_at = ? WHERE id = ?",
            params![due.as_ref().map(format_due), id],
        )?;
        Ok(true)
    }

    pub fn update_notes(&self, id: &str, notes: &str) -> Result<bool> {
        match self.column::<String>("notes", id)? {
            Some(cur) if cur != notes => {}
            _ => return Ok(false),
        }
        self.conn.execute("UPDATE todos SET notes = ? WHERE id = ?", params![notes, id])?;
        Ok(true)
    }

    pub fn update_text(&self, id: &str, text: &str) -> Result<bool> {
        let text = text.trim();
        if text.is_empty() {
            return Ok(false);
        }
        match self.column::<String>("text", id)? {
            Some(cur) if cur != text => {}
            _ => return Ok(false),
        }
        self.conn.execute("UPDATE todos SET text = ? WHERE id = ?", params![text, id])?;
        Ok(true)
    }

    pub fn add_image(&self, id: &str, rel: &str) -> Result<bool> {
        if !self.exists(id)? {
            return Ok(false);
        }
        let dup = self
            .conn
            .query_row("SELECT 1 FROM images WHERE todo_id = ? AND rel_path = ?", [id, rel], |_| Ok(()))
            .optional()?;
        if dup.is_some() {
            return Ok(false);
        }
        let ord: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(ord), -1) + 1 FROM images WHERE todo_id = ?",
            [id],
            |r| r.get(0),
        )?;
        self.conn
            .execute("INSERT INTO images (todo_id, rel_path, ord) VALUES (?, ?, ?)", params![id, rel, ord])?;
        Ok(true)
    }

    /// Removes an image from an item and deletes its file.
    pub fn remove_image(&self, id: &str, rel: &str) -> Result<bool> {
        let n = self.conn.execute("DELETE FROM images WHERE todo_id = ? AND rel_path = ?", [id, rel])?;
        if n == 0 {
            return Ok(false);
        }
        if let Some(abs) = self.resolve(rel) {
            let _ = std::fs::remove_file(abs);
        }
        Ok(true)
    }

    /// Adds a subtask. Returns `None` for an empty text or an unknown item.
    pub fn add_subtask(&self, item_id: &str, text: &str) -> Result<Option<SubTask>> {
        let text = text.trim();
        if text.is_empty() || !self.exists(item_id)? {
            return Ok(None);
        }
        let ord: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(ord), -1) + 1 FROM subtasks WHERE todo_id = ?",
            [item_id],
            |r| r.get(0),
        )?;
        let s = SubTask { id: new_id(), text: text.to_string(), done: false };
        self.conn.execute(
            "INSERT INTO subtasks (id, todo_id, text, done, ord) VALUES (?, ?, ?, 0, ?)",
            params![s.id, item_id, s.text, ord],
        )?;
        Ok(Some(s))
    }

    fn subtask_column<T: rusqlite::types::FromSql>(&self, col: &str, item_id: &str, sub_id: &str) -> Result<Option<T>> {
        Ok(self
            .conn
            .query_row(
                &format!("SELECT {col} FROM subtasks WHERE id = ? AND todo_id = ?"),
                [sub_id, item_id],
                |r| r.get(0),
            )
            .optional()?)
    }

    pub fn set_subtask_done(&self, item_id: &str, sub_id: &str, done: bool) -> Result<bool> {
        match self.subtask_column::<i64>("done", item_id, sub_id)? {
            Some(cur) if (cur != 0) != done => {}
            _ => return Ok(false),
        }
        self.conn.execute(
            "UPDATE subtasks SET done = ? WHERE id = ? AND todo_id = ?",
            params![done as i64, sub_id, item_id],
        )?;
        Ok(true)
    }

    pub fn update_subtask_text(&self, item_id: &str, sub_id: &str, text: &str) -> Result<bool> {
        let text = text.trim();
        if text.is_empty() {
            return Ok(false);
        }
        match self.subtask_column::<String>("text", item_id, sub_id)? {
            Some(cur) if cur != text => {}
            _ => return Ok(false),
        }
        self.conn.execute(
            "UPDATE subtasks SET text = ? WHERE id = ? AND todo_id = ?",
            params![text, sub_id, item_id],
        )?;
        Ok(true)
    }

    pub fn delete_subtask(&self, item_id: &str, sub_id: &str) -> Result<bool> {
        Ok(self.conn.execute("DELETE FROM subtasks WHERE id = ? AND todo_id = ?", [sub_id, item_id])? > 0)
    }

    /// Deletes an item, its image files and its folder `images/<id>/`.
    pub fn delete_item(&self, id: &str) -> Result<bool> {
        if !self.exists(id)? {
            return Ok(false);
        }
        let rels: Vec<String> = self
            .conn
            .prepare("SELECT rel_path FROM images WHERE todo_id = ?")?
            .query_map([id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        if self.conn.execute("DELETE FROM todos WHERE id = ?", [id])? == 0 {
            return Ok(false);
        }
        for rel in rels {
            if let Some(abs) = self.resolve(&rel) {
                let _ = std::fs::remove_file(abs);
            }
        }
        if let Some(dir) = self.resolve(&format!("images/{id}")) {
            let _ = std::fs::remove_dir_all(dir);
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{tempdir, TempDir};

    fn store() -> (TempDir, TodoStore) {
        let d = tempdir().unwrap();
        let s = TodoStore::open(d.path()).unwrap();
        (d, s)
    }

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    fn write_image(s: &TodoStore, id: &str) -> (String, PathBuf) {
        let rel = format!("images/{id}/sample.png");
        let abs = s.resolve(&rel).unwrap();
        std::fs::create_dir_all(abs.parent().unwrap()).unwrap();
        std::fs::write(&abs, b"png").unwrap();
        (rel, abs)
    }

    #[test]
    fn load_empty() {
        let (_d, s) = store();
        assert!(s.load().unwrap().is_empty());
    }

    #[test]
    fn add_and_reload() {
        let (_d, s) = store();
        let c = s.add("Buy milk", "2 liters").unwrap();
        let items = s.load().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, c.id);
        assert_eq!(items[0].text, "Buy milk");
        assert_eq!(items[0].notes, "2 liters");
        assert!(!items[0].done);
    }

    #[test]
    fn add_empty_title_fails() {
        let (_d, s) = store();
        assert!(s.add("   ", "").is_err());
    }

    #[test]
    fn created_at_persisted() {
        let (_d, s) = store();
        let c = s.add("Timestamped", "").unwrap();
        let items = s.load().unwrap();
        assert!(items[0].created_at.is_some());
        assert_eq!(items[0].created_at, c.created_at);
    }

    #[test]
    fn new_items_on_top() {
        let (_d, s) = store();
        let first = s.add("First", "").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let second = s.add("Second", "").unwrap();
        let items = s.load().unwrap();
        assert_eq!(items[0].id, second.id);
        assert_eq!(items[1].id, first.id);
    }

    #[test]
    fn sorted_by_created_at() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        let b = s.add("B", "").unwrap();
        let old = Utc.with_ymd_and_hms(2020, 1, 1, 10, 0, 0).unwrap();
        assert!(s.set_created_at(&b.id, old).unwrap());
        assert!(!s.set_created_at(&b.id, old).unwrap());
        let items = s.load().unwrap();
        assert_eq!(items[0].id, a.id);
        assert_eq!(items[1].id, b.id);
        assert_eq!(items[1].created_at, Some(old));
    }

    #[test]
    fn complete_item() {
        let (_d, s) = store();
        let c = s.add("Write report", "").unwrap();
        assert!(s.set_done(&c.id, true).unwrap());
        let it = &s.load().unwrap()[0];
        assert!(it.done);
        assert!(it.completed_at.is_some());
    }

    #[test]
    fn reactivate_completed() {
        let (_d, s) = store();
        let c = s.add("Refactor", "").unwrap();
        assert!(s.set_done(&c.id, true).unwrap());
        assert!(s.set_done(&c.id, false).unwrap());
        let it = &s.load().unwrap()[0];
        assert!(!it.done);
        assert!(it.completed_at.is_none());
    }

    #[test]
    fn mark_completed_idempotent() {
        let (_d, s) = store();
        let c = s.add("Deploy", "").unwrap();
        assert!(s.set_done(&c.id, true).unwrap());
        assert!(!s.set_done(&c.id, true).unwrap());
    }

    #[test]
    fn category_and_hue() {
        let (_d, s) = store();
        let c = s.add("Task", "").unwrap();
        assert!(s.set_category(&c.id, "AIT").unwrap());
        assert!(!s.set_category(&c.id, "AIT").unwrap());
        let it = &s.load().unwrap()[0];
        assert_eq!(it.category, "AIT");
        assert_eq!(it.category_hue, category_hue("AIT"));
        assert!(it.category_hue.unwrap() < 360);
        assert_eq!(category_hue(""), None);
    }

    #[test]
    fn hue_in_range() {
        // Categories with first MD5 bytes over the whole range 0..=255.
        for i in 0..2000 {
            assert!(category_hue(&format!("c{i}")).unwrap() < 360);
        }
    }

    #[test]
    fn update_notes() {
        let (_d, s) = store();
        let c = s.add("Plan trip", "old").unwrap();
        assert!(s.update_notes(&c.id, "new notes").unwrap());
        assert_eq!(s.load().unwrap()[0].notes, "new notes");
    }

    #[test]
    fn update_text() {
        let (_d, s) = store();
        let c = s.add("Old title", "").unwrap();
        assert!(s.update_text(&c.id, "New title").unwrap());
        assert!(!s.update_text(&c.id, "  ").unwrap());
        assert_eq!(s.load().unwrap()[0].text, "New title");
    }

    #[test]
    fn add_and_remove_image() {
        let (_d, s) = store();
        let c = s.add("Task with image", "").unwrap();
        let (rel, abs) = write_image(&s, &c.id);
        assert!(s.add_image(&c.id, &rel).unwrap());
        assert!(!s.add_image(&c.id, &rel).unwrap());
        assert_eq!(s.load().unwrap()[0].images, vec![rel.clone()]);
        assert!(s.remove_image(&c.id, &rel).unwrap());
        assert!(s.load().unwrap()[0].images.is_empty());
        assert!(!abs.exists());
    }

    #[test]
    fn delete_removes_image_dir() {
        let (_d, s) = store();
        let c = s.add("Task", "").unwrap();
        let (rel, abs) = write_image(&s, &c.id);
        s.add_image(&c.id, &rel).unwrap();
        assert!(s.delete_item(&c.id).unwrap());
        assert!(!abs.parent().unwrap().exists());
    }

    #[test]
    fn delete_item() {
        let (_d, s) = store();
        let c = s.add("Task", "").unwrap();
        assert!(s.delete_item(&c.id).unwrap());
        assert!(!s.delete_item(&c.id).unwrap());
        assert!(s.load().unwrap().is_empty());
    }

    #[test]
    fn due_persisted_and_normalized() {
        let (d, s) = store();
        let c = s.add("Due task", "").unwrap();
        assert!(s.set_due_at(&c.id, Some(date(2026, 3, 20))).unwrap());
        assert_eq!(s.load().unwrap()[0].due_at, Some(date(2026, 3, 20)));
        let raw: String = Connection::open(d.path().join("todos.db"))
            .unwrap()
            .query_row("SELECT due_at FROM todos", [], |r| r.get(0))
            .unwrap();
        assert_eq!(raw, "2026-03-20T00:00:00.000Z");
    }

    #[test]
    fn due_set_and_clear() {
        let (_d, s) = store();
        let c = s.add("Schedule task", "").unwrap();
        let due = Some(date(2026, 3, 22));
        assert!(s.set_due_at(&c.id, due).unwrap());
        assert!(!s.set_due_at(&c.id, due).unwrap());
        assert_eq!(s.load().unwrap()[0].due_at, due);
        assert!(s.set_due_at(&c.id, None).unwrap());
        assert!(!s.set_due_at(&c.id, None).unwrap());
        assert!(s.load().unwrap()[0].due_at.is_none());
    }

    #[test]
    fn add_subtask() {
        let (_d, s) = store();
        let p = s.add("Parent task", "").unwrap();
        let sub = s.add_subtask(&p.id, "Sub-task one").unwrap().unwrap();
        assert_eq!(sub.text, "Sub-task one");
        let items = s.load().unwrap();
        assert_eq!(items[0].subtasks.len(), 1);
        assert_eq!(items[0].subtasks[0].text, "Sub-task one");
        assert!(!items[0].subtasks[0].done);
    }

    #[test]
    fn add_blank_subtask_fails() {
        let (_d, s) = store();
        let p = s.add("Parent", "").unwrap();
        assert!(s.add_subtask(&p.id, "   ").unwrap().is_none());
        assert!(s.add_subtask("unknown", "Text").unwrap().is_none());
    }

    #[test]
    fn set_subtask_done() {
        let (_d, s) = store();
        let p = s.add("Parent", "").unwrap();
        let sub = s.add_subtask(&p.id, "Do something").unwrap().unwrap();
        assert!(s.set_subtask_done(&p.id, &sub.id, true).unwrap());
        assert!(s.load().unwrap()[0].subtasks[0].done);
        assert!(!s.set_subtask_done(&p.id, &sub.id, true).unwrap());
    }

    #[test]
    fn delete_subtask() {
        let (_d, s) = store();
        let p = s.add("Parent", "").unwrap();
        let sub = s.add_subtask(&p.id, "Remove me").unwrap().unwrap();
        assert!(s.delete_subtask(&p.id, &sub.id).unwrap());
        assert!(s.load().unwrap()[0].subtasks.is_empty());
    }

    #[test]
    fn update_subtask_text() {
        let (_d, s) = store();
        let p = s.add("Parent", "").unwrap();
        let sub = s.add_subtask(&p.id, "Old text").unwrap().unwrap();
        assert!(s.update_subtask_text(&p.id, &sub.id, "New text").unwrap());
        assert_eq!(s.load().unwrap()[0].subtasks[0].text, "New text");
    }

    #[test]
    fn subtasks_persisted() {
        let (d, s) = store();
        let p = s.add("Parent", "").unwrap();
        s.add_subtask(&p.id, "Step 1").unwrap();
        s.add_subtask(&p.id, "Step 2").unwrap();
        drop(s);
        let s = TodoStore::open(d.path()).unwrap();
        let items = s.load().unwrap();
        assert_eq!(items[0].subtasks.len(), 2);
        assert_eq!(items[0].subtasks[0].text, "Step 1");
        assert_eq!(items[0].subtasks[1].text, "Step 2");
    }

    #[test]
    fn no_subtask_rows_load_cleanly() {
        let (_d, s) = store();
        let c = s.add("Old item", "").unwrap();
        let items = s.load().unwrap();
        assert!(items[0].subtasks.is_empty());
        assert_eq!(items[0].id, c.id);
    }

    #[test]
    fn parses_stored_formats() {
        let expected = Utc.with_ymd_and_hms(2026, 3, 20, 12, 30, 0).unwrap();
        assert_eq!(parse_utc("2026-03-20T12:30:00.000Z"), Some(expected));
        assert_eq!(parse_utc("2026-03-20T12:30:00Z"), Some(expected));
        assert_eq!(parse_utc("2026-03-20T12:30:00"), Some(expected));
        assert_eq!(parse_utc(""), None);
        assert_eq!(format_utc(&expected), "2026-03-20T12:30:00.000Z");
    }

    #[test]
    fn resolve_stays_inside() {
        let (_d, s) = store();
        assert!(s.resolve("images/a/b.png").is_some());
        assert!(s.resolve("../x").is_none());
        assert!(s.resolve("/etc/passwd").is_none());
        assert!(s.resolve("").is_none());
    }
}

