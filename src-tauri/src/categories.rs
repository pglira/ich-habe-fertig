//! Categories. A todo names its category in the column `todos.category`. The
//! table `categories` holds the categories that the user adds and the colors
//! that the user sets. The list of categories is the union of both.

use crate::error::{AppError, Result};
use crate::store::{category_hue, TodoStore};
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Category {
    pub name: String,
    /// The color `#rrggbb` that the user set, if any.
    pub color: Option<String>,
    /// The hue (0..360) of the automatic color.
    pub hue: u16,
    /// An archived category is not offered for new assignments.
    pub archived: bool,
    /// The number of open todos and of all todos in the category.
    pub open: usize,
    pub total: usize,
}

/// True for a color `#rrggbb`.
pub fn is_hex_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn clean_name(name: &str) -> Result<&str> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Invalid("the category name is empty".into()));
    }
    Ok(name)
}

impl TodoStore {
    /// The colors that the user set, by category name.
    pub fn category_colors(&self) -> Result<HashMap<String, String>> {
        let mut q = self.conn.prepare_cached("SELECT name, color FROM categories WHERE color IS NOT NULL")?;
        let rows = q.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// All categories, sorted by name without regard to case.
    pub fn categories(&self) -> Result<Vec<Category>> {
        fn entry(map: &mut BTreeMap<String, Category>, name: String) -> &mut Category {
            map.entry(name.clone()).or_insert_with(|| Category {
                hue: category_hue(&name).unwrap_or(0),
                name,
                color: None,
                archived: false,
                open: 0,
                total: 0,
            })
        }
        let mut by_name: BTreeMap<String, Category> = BTreeMap::new();
        let mut q = self.conn.prepare("SELECT name, archived FROM categories")?;
        for row in q.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0)))? {
            let (name, archived) = row?;
            entry(&mut by_name, name).archived = archived;
        }
        let mut q = self.conn.prepare(
            "SELECT category, SUM(done = 0), COUNT(*) FROM todos WHERE category != '' GROUP BY category",
        )?;
        let counts: Vec<(String, i64, i64)> = q
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<_>>()?;
        for (name, open, total) in counts {
            let c = entry(&mut by_name, name);
            c.open = open as usize;
            c.total = total as usize;
        }
        for (name, color) in self.category_colors()? {
            if let Some(c) = by_name.get_mut(&name) {
                c.color = Some(color);
            }
        }
        let mut list: Vec<Category> = by_name.into_values().collect();
        list.sort_by_key(|c| c.name.to_lowercase());
        Ok(list)
    }

    /// Fails unless `name` is empty (no category) or an existing category.
    pub fn require_category(&self, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() || self.categories()?.iter().any(|c| c.name == name) {
            return Ok(());
        }
        Err(AppError::Invalid(format!("unknown category: {name}")))
    }

    /// Adds a category. Returns false if it exists already.
    pub fn add_category(&self, name: &str) -> Result<bool> {
        let name = clean_name(name)?;
        if self.categories()?.iter().any(|c| c.name == name) {
            return Ok(false);
        }
        self.conn.execute("INSERT INTO categories (name, color) VALUES (?, NULL)", [name])?;
        Ok(true)
    }

    /// Sets the color `#rrggbb` of a category, or `None` for the automatic color.
    pub fn set_category_color(&self, name: &str, color: Option<&str>) -> Result<()> {
        let name = clean_name(name)?;
        if let Some(c) = color {
            if !is_hex_color(c) {
                return Err(AppError::Invalid(format!("invalid color: {c}")));
            }
        }
        let color = color.map(str::to_ascii_lowercase);
        self.conn.execute(
            "INSERT INTO categories (name, color) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET color = ?2",
            params![name, color],
        )?;
        Ok(())
    }

    /// Archives a category, or restores it.
    pub fn set_category_archived(&self, name: &str, archived: bool) -> Result<()> {
        let name = clean_name(name)?;
        self.conn.execute(
            "INSERT INTO categories (name, archived) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET archived = ?2",
            params![name, archived as i64],
        )?;
        Ok(())
    }

    /// Renames a category in all todos. If the new name exists already, the
    /// two categories merge; the color and the archive state of the new name win.
    /// Returns the number of changed todos.
    pub fn rename_category(&self, old: &str, new: &str) -> Result<usize> {
        let new = clean_name(new)?;
        if old == new {
            return Ok(0);
        }
        let tx = self.conn.unchecked_transaction()?;
        let n = tx.execute("UPDATE todos SET category = ? WHERE category = ?", [new, old])?;
        let old_row: Option<(Option<String>, i64)> = tx
            .query_row("SELECT color, archived FROM categories WHERE name = ?", [old], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()?;
        if let Some((old_color, old_archived)) = old_row {
            tx.execute("DELETE FROM categories WHERE name = ?", [old])?;
            tx.execute(
                "INSERT INTO categories (name, color, archived) VALUES (?1, ?2, ?3) \
                 ON CONFLICT(name) DO UPDATE SET color = COALESCE(color, ?2)",
                params![new, old_color, old_archived],
            )?;
        }
        tx.commit()?;
        Ok(n)
    }

    /// Deletes a category. Its todos keep their data but get no category.
    /// Returns the number of changed todos.
    pub fn delete_category(&self, name: &str) -> Result<usize> {
        let tx = self.conn.unchecked_transaction()?;
        let n = tx.execute("UPDATE todos SET category = '' WHERE category = ?", [name])?;
        tx.execute("DELETE FROM categories WHERE name = ?", [name])?;
        tx.commit()?;
        Ok(n)
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

    fn names(s: &TodoStore) -> Vec<String> {
        s.categories().unwrap().into_iter().map(|c| c.name).collect()
    }

    #[test]
    fn lists_used_and_added_categories() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        let b = s.add("B", "").unwrap();
        s.set_category(&a.id, "work").unwrap();
        s.set_category(&b.id, "work").unwrap();
        s.set_done(&b.id, true).unwrap();
        assert!(s.add_category("Home").unwrap());
        assert!(!s.add_category(" Home ").unwrap());
        assert!(!s.add_category("work").unwrap());
        assert!(s.add_category("  ").is_err());
        let list = s.categories().unwrap();
        assert_eq!(names(&s), ["Home", "work"]);
        assert_eq!((list[0].open, list[0].total), (0, 0));
        assert_eq!((list[1].open, list[1].total), (1, 2));
        assert_eq!(list[1].hue, category_hue("work").unwrap());
    }

    #[test]
    fn sets_and_clears_colors() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        s.set_category(&a.id, "work").unwrap();
        s.set_category_color("work", Some("#AABBCC")).unwrap();
        assert_eq!(s.categories().unwrap()[0].color.as_deref(), Some("#aabbcc"));
        assert_eq!(s.load().unwrap()[0].category_color.as_deref(), Some("#aabbcc"));
        assert!(s.set_category_color("work", Some("red")).is_err());
        s.set_category_color("work", None).unwrap();
        assert_eq!(s.categories().unwrap()[0].color, None);
        assert_eq!(s.load().unwrap()[0].category_color, None);
    }

    #[test]
    fn renames_and_merges() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        let b = s.add("B", "").unwrap();
        s.set_category(&a.id, "old").unwrap();
        s.set_category(&b.id, "other").unwrap();
        s.set_category_color("old", Some("#112233")).unwrap();
        assert_eq!(s.rename_category("old", " new ").unwrap(), 1);
        assert_eq!(names(&s), ["new", "other"]);
        assert_eq!(s.categories().unwrap()[0].color.as_deref(), Some("#112233"));
        // Merge into a category with its own color: that color wins.
        s.set_category_color("other", Some("#445566")).unwrap();
        assert_eq!(s.rename_category("new", "other").unwrap(), 1);
        let list = s.categories().unwrap();
        assert_eq!(names(&s), ["other"]);
        assert_eq!((list[0].total, list[0].color.as_deref()), (2, Some("#445566")));
        assert!(s.rename_category("other", "").is_err());
    }

    #[test]
    fn delete_clears_the_todos() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        s.set_category(&a.id, "gone").unwrap();
        s.set_category_color("gone", Some("#000000")).unwrap();
        assert_eq!(s.delete_category("gone").unwrap(), 1);
        assert!(names(&s).is_empty());
        let it = &s.load().unwrap()[0];
        assert_eq!(it.category, "");
        assert_eq!(it.category_color, None);
    }

    #[test]
    fn category_of_a_todo_is_trimmed() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        s.set_category(&a.id, " work ").unwrap();
        assert_eq!(s.load().unwrap()[0].category, "work");
    }

    #[test]
    fn archives_and_restores() {
        let (_d, s) = store();
        let a = s.add("A", "").unwrap();
        s.set_category(&a.id, "old").unwrap();
        s.set_category_archived("old", true).unwrap();
        let c = &s.categories().unwrap()[0];
        assert!(c.archived);
        assert_eq!(c.total, 1);
        // The archive state stays with a rename.
        s.rename_category("old", "older").unwrap();
        assert!(s.categories().unwrap()[0].archived);
        s.set_category_archived("older", false).unwrap();
        assert!(!s.categories().unwrap()[0].archived);
    }

    #[test]
    fn migrates_the_categories_table() {
        let d = tempdir().unwrap();
        let conn = rusqlite::Connection::open(d.path().join("todos.db")).unwrap();
        conn.execute_batch("CREATE TABLE categories (name TEXT PRIMARY KEY, color TEXT); \
                            INSERT INTO categories VALUES ('a', '#000000');")
            .unwrap();
        drop(conn);
        let s = TodoStore::open(d.path()).unwrap();
        let c = &s.categories().unwrap()[0];
        assert_eq!((c.name.as_str(), c.color.as_deref(), c.archived), ("a", Some("#000000"), false));
    }

    #[test]
    fn requires_known_categories() {
        let (_d, s) = store();
        s.add_category("work").unwrap();
        assert!(s.require_category("work").is_ok());
        assert!(s.require_category(" work ").is_ok());
        assert!(s.require_category("").is_ok());
        assert!(s.require_category("new").is_err());
    }

    #[test]
    fn hex_colors() {
        assert!(is_hex_color("#a1B2c3"));
        assert!(!is_hex_color("a1b2c3"));
        assert!(!is_hex_color("#a1b2cg"));
        assert!(!is_hex_color("#abc"));
    }
}
