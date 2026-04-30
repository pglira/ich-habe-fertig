#pragma once
#include "model/TodoStore.h"

#include <QMainWindow>
#include <QPointer>
#include <QString>

class QCheckBox;
class QDateEdit;
class QLabel;
class QLineEdit;
class QListWidget;
class QListWidgetItem;
class QPushButton;
class QTimer;
class QTreeWidget;
class QTreeWidgetItem;

class NotesEditor;
class ThumbnailListWidget;
class CelebrationOverlay;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow(TodoStore *store, const QString &dataDir, QWidget *parent = nullptr);

protected:
    void resizeEvent(QResizeEvent *e) override;

private slots:
    void onAdd();
    void onDelete();
    void onSelectionChanged();
    void onListItemChanged(QTreeWidgetItem *item, int column);
    void onListItemDoubleClicked(QTreeWidgetItem *item, int column);
    void onUrgentToggled(bool checked);
    void onCategoryEdited(const QString &);
    void persistCategory();
    void onDueSet();
    void onDueClear();
    void onHideCompletedToggled(bool checked);
    void onNotesChanged();
    void persistNotes();
    void refreshDueColumn();

    void onSubtaskAdd();
    void onSubtaskDelete();
    void onSubtaskItemChanged(QListWidgetItem *item);
    void onSubtaskHideCompletedToggled(bool checked);

    void onImagePaste();
    void onImageRemove();
    void onImageDoubleClicked(QListWidgetItem *item);

private:
    void buildUi();
    void refreshList(const QString &keepSelectionId = QString());
    void loadDetail(const QString &id);
    void clearDetail();
    void populateRow(QTreeWidgetItem *row, const TodoItem &item);
    void applyRowStyle(QTreeWidgetItem *row, const TodoItem &item);
    void updateRowFor(const QString &id);
    QTreeWidgetItem *findRow(const QString &id) const;
    QString currentSelectedId() const;
    QString dueInText(const QDateTime &dueAt) const;
    QColor categoryColor(const QString &category) const;

    TodoStore *m_store;
    QString m_dataDir;

    QTreeWidget *m_tree = nullptr;
    QPushButton *m_addBtn = nullptr;
    QPushButton *m_deleteBtn = nullptr;
    QCheckBox *m_hideCompleted = nullptr;

    QCheckBox *m_urgentBox = nullptr;
    QLineEdit *m_categoryEdit = nullptr;
    QLabel *m_createdLabel = nullptr;
    QLabel *m_completedLabel = nullptr;
    QDateEdit *m_dueEdit = nullptr;
    QPushButton *m_dueSetBtn = nullptr;
    QPushButton *m_dueClearBtn = nullptr;

    NotesEditor *m_notes = nullptr;

    QListWidget *m_subtasks = nullptr;
    QPushButton *m_subAddBtn = nullptr;
    QPushButton *m_subDelBtn = nullptr;
    QCheckBox *m_subHideCompleted = nullptr;

    ThumbnailListWidget *m_images = nullptr;
    QPushButton *m_imgPasteBtn = nullptr;
    QPushButton *m_imgRemoveBtn = nullptr;

    QTimer *m_dueRefreshTimer = nullptr;
    QTimer *m_categoryDebounce = nullptr;
    QTimer *m_notesDebounce = nullptr;

    CelebrationOverlay *m_celebration = nullptr;

    QString m_currentId;
    bool m_loadingDetail = false;
    bool m_refreshingList = false;
    bool m_refreshingSubtasks = false;
};
