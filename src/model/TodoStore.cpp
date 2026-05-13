#include "TodoStore.h"

#include <QFile>
#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>
#include <QVariant>
#include <QtGlobal>

namespace {

QString isoOrNull(const QDateTime &dt) {
    if (!dt.isValid()) return {};
    return dt.toUTC().toString(Qt::ISODateWithMs);
}

QDateTime parseUtc(const QVariant &v) {
    if (v.isNull()) return {};
    QString s = v.toString();
    if (s.isEmpty()) return {};
    QDateTime dt = QDateTime::fromString(s, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(s, Qt::ISODate);
    if (!dt.isValid()) return {};
    if (dt.timeSpec() == Qt::LocalTime) dt.setTimeSpec(Qt::UTC);
    return dt.toUTC();
}

} // namespace

TodoStore::TodoStore(const QString &dataDir)
    : m_dataDir(dataDir) {
    if (!m_dataDir.exists()) {
        m_dataDir.mkpath(".");
    }
    m_connectionName = QStringLiteral("ihf_") + QUuid::createUuid().toString(QUuid::WithoutBraces);
    m_db = QSqlDatabase::addDatabase("QSQLITE", m_connectionName);
    m_db.setDatabaseName(m_dataDir.absoluteFilePath("todos.db"));
    if (!m_db.open()) {
        qWarning("TodoStore: failed to open database: %s", qUtf8Printable(m_db.lastError().text()));
        return;
    }
    QSqlQuery pragma(m_db);
    pragma.exec("PRAGMA foreign_keys = ON");
    pragma.exec("PRAGMA journal_mode = WAL");
    ensureSchema();
}

TodoStore::~TodoStore() {
    if (m_db.isOpen()) m_db.close();
    m_db = QSqlDatabase();
    QSqlDatabase::removeDatabase(m_connectionName);
}

void TodoStore::ensureSchema() {
    QSqlQuery q(m_db);
    q.exec(R"(CREATE TABLE IF NOT EXISTS todos (
        id           TEXT PRIMARY KEY,
        text         TEXT NOT NULL,
        notes        TEXT NOT NULL DEFAULT '',
        done         INTEGER NOT NULL DEFAULT 0,
        urgent       INTEGER NOT NULL DEFAULT 0,
        category     TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL,
        completed_at TEXT,
        due_at       TEXT,
        position     INTEGER NOT NULL
    ))");
    q.exec(R"(CREATE TABLE IF NOT EXISTS images (
        todo_id  TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        rel_path TEXT NOT NULL,
        ord      INTEGER NOT NULL,
        PRIMARY KEY (todo_id, rel_path)
    ))");
    q.exec(R"(CREATE TABLE IF NOT EXISTS subtasks (
        id       TEXT PRIMARY KEY,
        todo_id  TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        text     TEXT NOT NULL,
        done     INTEGER NOT NULL DEFAULT 0,
        ord      INTEGER NOT NULL
    ))");
    q.exec("CREATE INDEX IF NOT EXISTS idx_subtasks_todo ON subtasks(todo_id)");
    q.exec("CREATE INDEX IF NOT EXISTS idx_images_todo ON images(todo_id)");
}

bool TodoStore::itemExists(const QString &id) const {
    QSqlQuery q(m_db);
    q.prepare("SELECT 1 FROM todos WHERE id = ?");
    q.addBindValue(id);
    if (!q.exec()) return false;
    return q.next();
}

QString TodoStore::resolveDataPath(const QString &relPath) const {
    QString base = m_dataDir.absolutePath();
    QFileInfo fi(m_dataDir.absoluteFilePath(relPath));
    QString resolved = fi.absoluteFilePath();
    if (!resolved.startsWith(base + QDir::separator()) && resolved != base) {
        return {};
    }
    return resolved;
}

std::optional<TodoItem> TodoStore::get(const QString &id) const {
    QSqlQuery q(m_db);
    q.prepare("SELECT id, text, notes, done, urgent, category, created_at, "
              "completed_at, due_at FROM todos WHERE id = ?");
    q.addBindValue(id);
    if (!q.exec() || !q.next()) return std::nullopt;
    TodoItem it;
    it.id = q.value(0).toString();
    it.text = q.value(1).toString();
    it.notes = q.value(2).toString();
    it.done = q.value(3).toBool();
    it.urgent = q.value(4).toBool();
    it.category = q.value(5).toString();
    it.createdAt = parseUtc(q.value(6));
    it.completedAt = parseUtc(q.value(7));
    it.dueAt = normalizeDueAt(parseUtc(q.value(8)));

    QSqlQuery iq(m_db);
    iq.prepare("SELECT rel_path FROM images WHERE todo_id = ? ORDER BY ord ASC");
    iq.addBindValue(id);
    if (iq.exec()) while (iq.next()) it.images.append(iq.value(0).toString());

    QSqlQuery sq(m_db);
    sq.prepare("SELECT id, text, done FROM subtasks WHERE todo_id = ? ORDER BY ord ASC");
    sq.addBindValue(id);
    if (sq.exec()) {
        while (sq.next()) {
            SubTask s;
            s.id = sq.value(0).toString();
            s.text = sq.value(1).toString();
            s.done = sq.value(2).toBool();
            if (!s.id.isEmpty() && !s.text.isEmpty()) it.subtasks.append(s);
        }
    }
    return it;
}

QList<TodoItem> TodoStore::load() const {
    QList<TodoItem> items;
    QSqlQuery q(m_db);
    if (!q.exec("SELECT id, text, notes, done, urgent, category, created_at, "
                "completed_at, due_at FROM todos ORDER BY created_at DESC, position ASC")) {
        return items;
    }
    while (q.next()) {
        TodoItem it;
        it.id = q.value(0).toString();
        it.text = q.value(1).toString();
        it.notes = q.value(2).toString();
        it.done = q.value(3).toBool();
        it.urgent = q.value(4).toBool();
        it.category = q.value(5).toString();
        it.createdAt = parseUtc(q.value(6));
        it.completedAt = parseUtc(q.value(7));
        it.dueAt = normalizeDueAt(parseUtc(q.value(8)));
        if (it.id.isEmpty() || it.text.isEmpty()) continue;
        items.append(it);
    }
    for (TodoItem &it : items) {
        QSqlQuery iq(m_db);
        iq.prepare("SELECT rel_path FROM images WHERE todo_id = ? ORDER BY ord ASC");
        iq.addBindValue(it.id);
        if (iq.exec()) while (iq.next()) it.images.append(iq.value(0).toString());

        QSqlQuery sq(m_db);
        sq.prepare("SELECT id, text, done FROM subtasks WHERE todo_id = ? ORDER BY ord ASC");
        sq.addBindValue(it.id);
        if (sq.exec()) {
            while (sq.next()) {
                SubTask s;
                s.id = sq.value(0).toString();
                s.text = sq.value(1).toString();
                s.done = sq.value(2).toBool();
                if (!s.id.isEmpty() && !s.text.isEmpty()) it.subtasks.append(s);
            }
        }
    }
    return items;
}

TodoItem TodoStore::add(const QString &text, const QString &notes) {
    TodoItem item = TodoItem::create(text, notes);
    QSqlQuery minQ(m_db);
    minQ.exec("SELECT COALESCE(MIN(position), 0) FROM todos");
    int newPos = 0;
    if (minQ.next()) newPos = minQ.value(0).toInt() - 1;

    QSqlQuery q(m_db);
    q.prepare("INSERT INTO todos (id, text, notes, done, urgent, category, "
              "created_at, completed_at, due_at, position) "
              "VALUES (?, ?, ?, 0, 0, '', ?, NULL, NULL, ?)");
    q.addBindValue(item.id);
    q.addBindValue(item.text);
    q.addBindValue(item.notes.isNull() ? QString("") : item.notes);
    q.addBindValue(isoOrNull(item.createdAt));
    q.addBindValue(newPos);
    if (!q.exec()) {
        qWarning("TodoStore::add INSERT failed: %s", qUtf8Printable(q.lastError().text()));
    }
    return item;
}

bool TodoStore::setDone(const QString &id, bool done) {
    QSqlQuery cur(m_db);
    cur.prepare("SELECT done FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toBool() == done) return false;

    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET done = ?, completed_at = ? WHERE id = ?");
    q.addBindValue(done ? 1 : 0);
    q.addBindValue(done ? isoOrNull(utcNow()) : QVariant(QMetaType(QMetaType::QString)));
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::setUrgent(const QString &id, bool urgent) {
    QSqlQuery cur(m_db);
    cur.prepare("SELECT urgent FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toBool() == urgent) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET urgent = ? WHERE id = ?");
    q.addBindValue(urgent ? 1 : 0);
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::setCategory(const QString &id, const QString &category) {
    QSqlQuery cur(m_db);
    cur.prepare("SELECT category FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toString() == category) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET category = ? WHERE id = ?");
    q.addBindValue(category);
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::setCreatedAt(const QString &id, const QDateTime &createdAt) {
    if (!createdAt.isValid()) return false;
    QSqlQuery cur(m_db);
    cur.prepare("SELECT created_at FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    QDateTime existing = parseUtc(cur.value(0));
    QDateTime norm = createdAt.toUTC();
    if (existing == norm) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET created_at = ? WHERE id = ?");
    q.addBindValue(isoOrNull(norm));
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::setDueAt(const QString &id, const QDateTime &dueAt) {
    QDateTime norm = normalizeDueAt(dueAt);
    QSqlQuery cur(m_db);
    cur.prepare("SELECT due_at FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    QDateTime existing = parseUtc(cur.value(0));
    existing = normalizeDueAt(existing);
    if (existing == norm) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET due_at = ? WHERE id = ?");
    q.addBindValue(norm.isValid() ? isoOrNull(norm) : QVariant(QMetaType(QMetaType::QString)));
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::addImage(const QString &id, const QString &relPath) {
    if (!itemExists(id)) return false;
    QSqlQuery dup(m_db);
    dup.prepare("SELECT 1 FROM images WHERE todo_id = ? AND rel_path = ?");
    dup.addBindValue(id);
    dup.addBindValue(relPath);
    if (dup.exec() && dup.next()) return false;
    QSqlQuery maxOrd(m_db);
    maxOrd.prepare("SELECT COALESCE(MAX(ord), -1) FROM images WHERE todo_id = ?");
    maxOrd.addBindValue(id);
    int ord = 0;
    if (maxOrd.exec() && maxOrd.next()) ord = maxOrd.value(0).toInt() + 1;
    QSqlQuery q(m_db);
    q.prepare("INSERT INTO images (todo_id, rel_path, ord) VALUES (?, ?, ?)");
    q.addBindValue(id);
    q.addBindValue(relPath);
    q.addBindValue(ord);
    return q.exec();
}

bool TodoStore::removeImage(const QString &id, const QString &relPath) {
    QSqlQuery q(m_db);
    q.prepare("DELETE FROM images WHERE todo_id = ? AND rel_path = ?");
    q.addBindValue(id);
    q.addBindValue(relPath);
    if (!q.exec() || q.numRowsAffected() <= 0) return false;
    QString abs = resolveDataPath(relPath);
    if (!abs.isEmpty() && QFile::exists(abs)) QFile::remove(abs);
    return true;
}

bool TodoStore::updateNotes(const QString &id, const QString &notes) {
    QSqlQuery cur(m_db);
    cur.prepare("SELECT notes FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toString() == notes) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET notes = ? WHERE id = ?");
    q.addBindValue(notes);
    q.addBindValue(id);
    return q.exec();
}

bool TodoStore::updateText(const QString &id, const QString &text) {
    QString norm = text.trimmed();
    if (norm.isEmpty()) return false;
    QSqlQuery cur(m_db);
    cur.prepare("SELECT text FROM todos WHERE id = ?");
    cur.addBindValue(id);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toString() == norm) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE todos SET text = ? WHERE id = ?");
    q.addBindValue(norm);
    q.addBindValue(id);
    return q.exec();
}

SubTask TodoStore::addSubtask(const QString &itemId, const QString &text, bool *ok) {
    QString norm = text.trimmed();
    if (norm.isEmpty() || !itemExists(itemId)) {
        if (ok) *ok = false;
        return {};
    }
    SubTask s = SubTask::create(norm);
    QSqlQuery maxOrd(m_db);
    maxOrd.prepare("SELECT COALESCE(MAX(ord), -1) FROM subtasks WHERE todo_id = ?");
    maxOrd.addBindValue(itemId);
    int ord = 0;
    if (maxOrd.exec() && maxOrd.next()) ord = maxOrd.value(0).toInt() + 1;
    QSqlQuery q(m_db);
    q.prepare("INSERT INTO subtasks (id, todo_id, text, done, ord) VALUES (?, ?, ?, 0, ?)");
    q.addBindValue(s.id);
    q.addBindValue(itemId);
    q.addBindValue(s.text);
    q.addBindValue(ord);
    bool success = q.exec();
    if (ok) *ok = success;
    return s;
}

bool TodoStore::setSubtaskDone(const QString &itemId, const QString &subtaskId, bool done) {
    QSqlQuery cur(m_db);
    cur.prepare("SELECT done FROM subtasks WHERE id = ? AND todo_id = ?");
    cur.addBindValue(subtaskId);
    cur.addBindValue(itemId);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toBool() == done) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE subtasks SET done = ? WHERE id = ? AND todo_id = ?");
    q.addBindValue(done ? 1 : 0);
    q.addBindValue(subtaskId);
    q.addBindValue(itemId);
    return q.exec();
}

bool TodoStore::deleteSubtask(const QString &itemId, const QString &subtaskId) {
    QSqlQuery q(m_db);
    q.prepare("DELETE FROM subtasks WHERE id = ? AND todo_id = ?");
    q.addBindValue(subtaskId);
    q.addBindValue(itemId);
    return q.exec() && q.numRowsAffected() > 0;
}

bool TodoStore::updateSubtaskText(const QString &itemId, const QString &subtaskId, const QString &text) {
    QString norm = text.trimmed();
    if (norm.isEmpty()) return false;
    QSqlQuery cur(m_db);
    cur.prepare("SELECT text FROM subtasks WHERE id = ? AND todo_id = ?");
    cur.addBindValue(subtaskId);
    cur.addBindValue(itemId);
    if (!cur.exec() || !cur.next()) return false;
    if (cur.value(0).toString() == norm) return false;
    QSqlQuery q(m_db);
    q.prepare("UPDATE subtasks SET text = ? WHERE id = ? AND todo_id = ?");
    q.addBindValue(norm);
    q.addBindValue(subtaskId);
    q.addBindValue(itemId);
    return q.exec();
}

bool TodoStore::deleteItem(const QString &id) {
    if (!itemExists(id)) return false;
    QSqlQuery imgs(m_db);
    imgs.prepare("SELECT rel_path FROM images WHERE todo_id = ?");
    imgs.addBindValue(id);
    QStringList relPaths;
    if (imgs.exec()) while (imgs.next()) relPaths << imgs.value(0).toString();
    QSqlQuery q(m_db);
    q.prepare("DELETE FROM todos WHERE id = ?");
    q.addBindValue(id);
    if (!q.exec() || q.numRowsAffected() <= 0) return false;
    for (const QString &rel : relPaths) {
        QString abs = resolveDataPath(rel);
        if (!abs.isEmpty() && QFile::exists(abs)) QFile::remove(abs);
    }
    QString imgDir = m_dataDir.absoluteFilePath("images/" + id);
    QDir(imgDir).removeRecursively();
    return true;
}
