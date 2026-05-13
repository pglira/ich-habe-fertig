#pragma once

#include "TodoItem.h"

#include <QDir>
#include <QSqlDatabase>
#include <QString>
#include <optional>

class TodoStore {
public:
    explicit TodoStore(const QString &dataDir);
    ~TodoStore();

    TodoStore(const TodoStore &) = delete;
    TodoStore &operator=(const TodoStore &) = delete;

    QString dataDir() const { return m_dataDir.absolutePath(); }

    QList<TodoItem> load() const;
    std::optional<TodoItem> get(const QString &id) const;

    TodoItem add(const QString &text, const QString &notes = QString());

    bool setDone(const QString &id, bool done);
    bool markCompleted(const QString &id) { return setDone(id, true); }

    bool setUrgent(const QString &id, bool urgent);
    bool setCategory(const QString &id, const QString &category);
    bool setDueAt(const QString &id, const QDateTime &dueAt);
    bool setCreatedAt(const QString &id, const QDateTime &createdAt);

    bool addImage(const QString &id, const QString &relPath);
    bool removeImage(const QString &id, const QString &relPath);

    bool updateNotes(const QString &id, const QString &notes);
    bool updateText(const QString &id, const QString &text);

    SubTask addSubtask(const QString &itemId, const QString &text, bool *ok = nullptr);
    bool setSubtaskDone(const QString &itemId, const QString &subtaskId, bool done);
    bool deleteSubtask(const QString &itemId, const QString &subtaskId);
    bool updateSubtaskText(const QString &itemId, const QString &subtaskId, const QString &text);

    bool deleteItem(const QString &id);

private:
    void ensureSchema();
    bool itemExists(const QString &id) const;
    QString resolveDataPath(const QString &relPath) const;

    QDir m_dataDir;
    QString m_connectionName;
    QSqlDatabase m_db;
};
