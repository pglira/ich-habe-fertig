// One-shot importer: reads todos.jsonl from a Python-app data dir
// and ingests into a SQLite todos.db in the same (or a different) dir.
// Existing todos.jsonl is left untouched. Images dir layout is already compatible.

#include "model/TodoStore.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QTextStream>
#include <QUuid>
#include <iostream>

namespace {

QDateTime parseIso(const QString &s) {
    if (s.isEmpty()) return {};
    QString n = s;
    if (n.endsWith('Z')) n.replace(n.size() - 1, 1, "+00:00");
    QDateTime dt = QDateTime::fromString(n, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(n, Qt::ISODate);
    return dt.toUTC();
}

QString isoOrNull(const QDateTime &dt) {
    if (!dt.isValid()) return {};
    return dt.toUTC().toString(Qt::ISODateWithMs);
}

} // namespace

int main(int argc, char **argv) {
    QCoreApplication app(argc, argv);
    if (argc < 2) {
        std::cerr << "Usage: migrate-jsonl <source_dir> [dest_dir]\n"
                     "  Reads <source_dir>/todos.jsonl and writes <dest_dir>/todos.db.\n"
                     "  If dest_dir is omitted, source_dir is used.\n";
        return 2;
    }
    QString src = QString::fromLocal8Bit(argv[1]);
    QString dst = (argc >= 3) ? QString::fromLocal8Bit(argv[2]) : src;

    QFile in(QDir(src).absoluteFilePath("todos.jsonl"));
    if (!in.open(QIODevice::ReadOnly | QIODevice::Text)) {
        std::cerr << "cannot open " << qUtf8Printable(in.fileName()) << "\n";
        return 1;
    }

    // Initialize the destination schema via TodoStore, then close it so we can do raw inserts
    {
        TodoStore probe(dst);
        Q_UNUSED(probe);
    }

    QString conn = "ihf_migrate_" + QUuid::createUuid().toString(QUuid::WithoutBraces);
    {
        auto db = QSqlDatabase::addDatabase("QSQLITE", conn);
        db.setDatabaseName(QDir(dst).absoluteFilePath("todos.db"));
        if (!db.open()) {
            std::cerr << "cannot open db\n";
            return 1;
        }
        QSqlQuery(db).exec("PRAGMA foreign_keys = ON");
        db.transaction();

        // Find current min position so the imported items keep their order (top-of-file = newest)
        int basePos = 0;
        {
            QSqlQuery q(db);
            q.exec("SELECT COALESCE(MIN(position), 0) FROM todos");
            if (q.next()) basePos = q.value(0).toInt();
        }

        QTextStream ts(&in);
        int lineNum = 0;
        int imported = 0;
        int skipped = 0;
        QStringList existingIds;
        {
            QSqlQuery q(db);
            q.exec("SELECT id FROM todos");
            while (q.next()) existingIds << q.value(0).toString();
        }

        QStringList lines;
        while (!ts.atEnd()) lines << ts.readLine();

        // First line = newest in JSONL; assign positions so newest gets the smallest position.
        // posOffset: line 0 -> basePos - lines.size(), increasing to basePos - 1
        for (int i = 0; i < lines.size(); ++i) {
            ++lineNum;
            QString line = lines[i].trimmed();
            if (line.isEmpty()) continue;
            QJsonParseError err;
            QJsonDocument doc = QJsonDocument::fromJson(line.toUtf8(), &err);
            if (err.error != QJsonParseError::NoError || !doc.isObject()) {
                ++skipped;
                continue;
            }
            QJsonObject o = doc.object();
            QString id = o.value("id").toString();
            QString text = o.value("text").toString().trimmed();
            if (id.isEmpty() || text.isEmpty()) { ++skipped; continue; }
            if (existingIds.contains(id)) { ++skipped; continue; }

            QString notes = o.value("notes").toString();
            bool done = o.value("done").toBool();
            bool urgent = o.value("urgent").toBool();
            QString category = o.value("category").toString();
            QDateTime createdAt = parseIso(o.value("created_at").toString());
            if (!createdAt.isValid()) createdAt = QDateTime::currentDateTimeUtc();
            QDateTime completedAt = parseIso(o.value("completed_at").toString());
            QDateTime dueAt = normalizeDueAt(parseIso(o.value("due_at").toString()));

            int pos = basePos - (lines.size() - i);

            QSqlQuery ins(db);
            ins.prepare("INSERT INTO todos (id, text, notes, done, urgent, category, "
                        "created_at, completed_at, due_at, position) VALUES (?,?,?,?,?,?,?,?,?,?)");
            ins.addBindValue(id);
            ins.addBindValue(text);
            ins.addBindValue(notes);
            ins.addBindValue(done ? 1 : 0);
            ins.addBindValue(urgent ? 1 : 0);
            ins.addBindValue(category);
            ins.addBindValue(isoOrNull(createdAt));
            ins.addBindValue(completedAt.isValid() ? isoOrNull(completedAt)
                                                   : QVariant(QMetaType(QMetaType::QString)));
            ins.addBindValue(dueAt.isValid() ? isoOrNull(dueAt)
                                             : QVariant(QMetaType(QMetaType::QString)));
            ins.addBindValue(pos);
            if (!ins.exec()) { ++skipped; continue; }

            // images
            QJsonArray images = o.value("images").toArray();
            int ord = 0;
            for (const QJsonValue &iv : images) {
                QString rel = iv.toString();
                if (rel.isEmpty()) continue;
                QSqlQuery iq(db);
                iq.prepare("INSERT OR IGNORE INTO images (todo_id, rel_path, ord) VALUES (?,?,?)");
                iq.addBindValue(id);
                iq.addBindValue(rel);
                iq.addBindValue(ord++);
                iq.exec();
            }

            // subtasks
            QJsonArray subs = o.value("subtasks").toArray();
            int subOrd = 0;
            for (const QJsonValue &sv : subs) {
                if (!sv.isObject()) continue;
                QJsonObject so = sv.toObject();
                QString sid = so.value("id").toString();
                QString stext = so.value("text").toString().trimmed();
                bool sdone = so.value("done").toBool();
                if (sid.isEmpty() || stext.isEmpty()) continue;
                QSqlQuery sq(db);
                sq.prepare("INSERT OR IGNORE INTO subtasks (id, todo_id, text, done, ord) VALUES (?,?,?,?,?)");
                sq.addBindValue(sid);
                sq.addBindValue(id);
                sq.addBindValue(stext);
                sq.addBindValue(sdone ? 1 : 0);
                sq.addBindValue(subOrd++);
                sq.exec();
            }

            ++imported;
        }
        db.commit();
        db.close();
        std::cout << "Imported " << imported << " items from " << lines.size()
                  << " JSONL lines (skipped " << skipped << ").\n";
        std::cout << "Wrote " << qUtf8Printable(QDir(dst).absoluteFilePath("todos.db")) << "\n";
        Q_UNUSED(lineNum);
    }
    QSqlDatabase::removeDatabase(conn);

    // Copy images dir if dst != src
    if (QDir(src).absolutePath() != QDir(dst).absolutePath()) {
        QString srcImg = QDir(src).absoluteFilePath("images");
        QString dstImg = QDir(dst).absoluteFilePath("images");
        if (QDir(srcImg).exists()) {
            QDir().mkpath(dstImg);
            std::cout << "Note: image directory not auto-copied; copy "
                      << qUtf8Printable(srcImg) << " -> " << qUtf8Printable(dstImg)
                      << " manually if you used a separate dest dir.\n";
        }
    }
    return 0;
}
