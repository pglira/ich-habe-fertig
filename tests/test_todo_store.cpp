#include "model/TodoStore.h"

#include <QObject>
#include <QTemporaryDir>
#include <QtTest/QtTest>

class TestTodoStore : public QObject {
    Q_OBJECT
private slots:
    void loadEmpty();
    void addAndReload();
    void createdAtPersisted();
    void newItemsOnTop();
    void completeItem();
    void reactivateCompleted();
    void markCompletedIdempotent();
    void updateNotes();
    void updateText();
    void addAndRemoveImage();
    void deleteRemovesImageDir();
    void deleteItem();
    void urgentDefaultFalse();
    void setAndUnsetUrgent();
    void duePersistedAndNormalized();
    void dueSetAndClear();
    void addSubtask();
    void addBlankSubtaskFails();
    void setSubtaskDone();
    void deleteSubtask();
    void updateSubtaskText();
    void subtasksPersisted();
    void noSubtasksRowsLoadCleanly();
};

void TestTodoStore::loadEmpty() {
    QTemporaryDir d;
    TodoStore s(d.path());
    QCOMPARE(s.load().size(), 0);
}

void TestTodoStore::addAndReload() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto created = s.add("Buy milk", "2 liters");
    auto items = s.load();
    QCOMPARE(items.size(), 1);
    QCOMPARE(items[0].id, created.id);
    QCOMPARE(items[0].text, QString("Buy milk"));
    QCOMPARE(items[0].notes, QString("2 liters"));
    QVERIFY(!items[0].done);
}

void TestTodoStore::createdAtPersisted() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto created = s.add("Timestamped", "");
    auto items = s.load();
    QCOMPARE(items.size(), 1);
    QCOMPARE(items[0].createdAt.toMSecsSinceEpoch(), created.createdAt.toMSecsSinceEpoch());
    QVERIFY(items[0].createdAt.isValid());
}

void TestTodoStore::newItemsOnTop() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto first = s.add("First", "");
    auto second = s.add("Second", "");
    auto items = s.load();
    QCOMPARE(items.size(), 2);
    QCOMPARE(items[0].id, second.id);
    QCOMPARE(items[1].id, first.id);
}

void TestTodoStore::completeItem() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Write report", "");
    QVERIFY(s.markCompleted(c.id));
    auto it = s.load()[0];
    QVERIFY(it.done);
    QVERIFY(it.completedAt.isValid());
}

void TestTodoStore::reactivateCompleted() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Refactor", "");
    QVERIFY(s.setDone(c.id, true));
    QVERIFY(s.setDone(c.id, false));
    auto it = s.load()[0];
    QVERIFY(!it.done);
    QVERIFY(!it.completedAt.isValid());
}

void TestTodoStore::markCompletedIdempotent() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Deploy", "");
    QVERIFY(s.markCompleted(c.id));
    QVERIFY(!s.markCompleted(c.id));
}

void TestTodoStore::updateNotes() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Plan trip", "old");
    QVERIFY(s.updateNotes(c.id, "new notes"));
    QCOMPARE(s.load()[0].notes, QString("new notes"));
}

void TestTodoStore::updateText() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Old title", "");
    QVERIFY(s.updateText(c.id, "New title"));
    QCOMPARE(s.load()[0].text, QString("New title"));
}

void TestTodoStore::addAndRemoveImage() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Task with image", "");
    QString rel = "images/" + c.id + "/sample.png";
    QString abs = QDir(d.path()).absoluteFilePath(rel);
    QDir().mkpath(QFileInfo(abs).absolutePath());
    QFile f(abs); QVERIFY(f.open(QIODevice::WriteOnly)); f.write("png"); f.close();
    QVERIFY(s.addImage(c.id, rel));
    QCOMPARE(s.load()[0].images, QList<QString>{rel});
    QVERIFY(s.removeImage(c.id, rel));
    QCOMPARE(s.load()[0].images.size(), 0);
    QVERIFY(!QFile::exists(abs));
}

void TestTodoStore::deleteRemovesImageDir() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Task", "");
    QString rel = "images/" + c.id + "/sample.png";
    QString abs = QDir(d.path()).absoluteFilePath(rel);
    QDir().mkpath(QFileInfo(abs).absolutePath());
    QFile f(abs); QVERIFY(f.open(QIODevice::WriteOnly)); f.write("x"); f.close();
    s.addImage(c.id, rel);
    QVERIFY(s.deleteItem(c.id));
    QVERIFY(!QDir(QDir(d.path()).absoluteFilePath("images/" + c.id)).exists());
}

void TestTodoStore::deleteItem() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Task", "");
    QVERIFY(s.deleteItem(c.id));
    QCOMPARE(s.load().size(), 0);
}

void TestTodoStore::urgentDefaultFalse() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Urgent task", "");
    QVERIFY(!c.urgent);
    QVERIFY(!s.load()[0].urgent);
}

void TestTodoStore::setAndUnsetUrgent() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Fix bug", "");
    QVERIFY(s.setUrgent(c.id, true));
    QVERIFY(s.load()[0].urgent);
    QVERIFY(s.setUrgent(c.id, false));
    QVERIFY(!s.load()[0].urgent);
}

void TestTodoStore::duePersistedAndNormalized() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Due task", "");
    QDateTime due(QDate(2026, 3, 20), QTime(12, 30), Qt::UTC);
    QVERIFY(s.setDueAt(c.id, due));
    QDateTime expected(QDate(2026, 3, 20), QTime(0, 0), Qt::UTC);
    QCOMPARE(s.load()[0].dueAt, expected);
}

void TestTodoStore::dueSetAndClear() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Schedule task", "");
    QDateTime due(QDate(2026, 3, 22), QTime(8, 0), Qt::UTC);
    QDateTime expected(QDate(2026, 3, 22), QTime(0, 0), Qt::UTC);
    QVERIFY(s.setDueAt(c.id, due));
    QVERIFY(!s.setDueAt(c.id, due));
    QCOMPARE(s.load()[0].dueAt, expected);
    QVERIFY(s.setDueAt(c.id, QDateTime()));
    QVERIFY(!s.setDueAt(c.id, QDateTime()));
    QVERIFY(!s.load()[0].dueAt.isValid());
}

void TestTodoStore::addSubtask() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent task", "");
    bool ok = false;
    auto sub = s.addSubtask(p.id, "Sub-task one", &ok);
    QVERIFY(ok);
    QCOMPARE(sub.text, QString("Sub-task one"));
    auto items = s.load();
    QCOMPARE(items[0].subtasks.size(), 1);
    QCOMPARE(items[0].subtasks[0].text, QString("Sub-task one"));
    QVERIFY(!items[0].subtasks[0].done);
}

void TestTodoStore::addBlankSubtaskFails() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent", "");
    bool ok = true;
    s.addSubtask(p.id, "   ", &ok);
    QVERIFY(!ok);
}

void TestTodoStore::setSubtaskDone() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent", "");
    auto sub = s.addSubtask(p.id, "Do something");
    QVERIFY(s.setSubtaskDone(p.id, sub.id, true));
    QVERIFY(s.load()[0].subtasks[0].done);
    QVERIFY(!s.setSubtaskDone(p.id, sub.id, true));
}

void TestTodoStore::deleteSubtask() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent", "");
    auto sub = s.addSubtask(p.id, "Remove me");
    QVERIFY(s.deleteSubtask(p.id, sub.id));
    QCOMPARE(s.load()[0].subtasks.size(), 0);
}

void TestTodoStore::updateSubtaskText() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent", "");
    auto sub = s.addSubtask(p.id, "Old text");
    QVERIFY(s.updateSubtaskText(p.id, sub.id, "New text"));
    QCOMPARE(s.load()[0].subtasks[0].text, QString("New text"));
}

void TestTodoStore::subtasksPersisted() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto p = s.add("Parent", "");
    s.addSubtask(p.id, "Step 1");
    s.addSubtask(p.id, "Step 2");
    auto items = s.load();
    QCOMPARE(items[0].subtasks.size(), 2);
    QCOMPARE(items[0].subtasks[0].text, QString("Step 1"));
    QCOMPARE(items[0].subtasks[1].text, QString("Step 2"));
}

void TestTodoStore::noSubtasksRowsLoadCleanly() {
    QTemporaryDir d;
    TodoStore s(d.path());
    auto c = s.add("Old item", "");
    QCOMPARE(s.load()[0].subtasks.size(), 0);
    QCOMPARE(s.load()[0].id, c.id);
}

QTEST_MAIN(TestTodoStore)
#include "test_todo_store.moc"
