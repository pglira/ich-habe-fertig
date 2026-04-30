#pragma once

#include <QDateTime>
#include <QList>
#include <QString>

struct SubTask {
    QString id;
    QString text;
    bool done = false;

    static SubTask create(const QString &text);
};

struct TodoItem {
    QString id;
    QString text;
    QString notes;
    bool done = false;
    bool urgent = false;
    QString category;
    QDateTime createdAt;     // UTC
    QDateTime completedAt;   // UTC; null if !done
    QDateTime dueAt;         // UTC midnight; null if unset
    QList<QString> images;   // relative paths under data dir
    QList<SubTask> subtasks;

    static TodoItem create(const QString &text, const QString &notes = QString());
};

QDateTime utcNow();
QDateTime normalizeDueAt(const QDateTime &value);
