#include "TodoItem.h"

#include <QUuid>

QDateTime utcNow() {
    return QDateTime::currentDateTimeUtc();
}

QDateTime normalizeDueAt(const QDateTime &value) {
    if (!value.isValid()) {
        return {};
    }
    QDateTime asUtc = value.toUTC();
    return QDateTime(asUtc.date(), QTime(0, 0), Qt::UTC);
}

static QString newId() {
    return QUuid::createUuid().toString(QUuid::WithoutBraces).remove('-');
}

SubTask SubTask::create(const QString &text) {
    SubTask s;
    s.id = newId();
    s.text = text.trimmed();
    s.done = false;
    return s;
}

TodoItem TodoItem::create(const QString &text, const QString &notes) {
    TodoItem item;
    item.id = newId();
    item.text = text.trimmed();
    item.notes = notes;
    item.done = false;
    item.urgent = false;
    item.createdAt = utcNow();
    return item;
}
