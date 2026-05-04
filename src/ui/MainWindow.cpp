#include "MainWindow.h"

#include "AddItemDialog.h"
#include "CelebrationOverlay.h"
#include "ImagePaster.h"
#include "NotesEditor.h"
#include "ThumbnailListWidget.h"

#include <QCheckBox>
#include <QCryptographicHash>
#include <QDateEdit>
#include <QDir>
#include <QFile>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QHash>
#include <QHeaderView>
#include <QInputDialog>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMessageBox>
#include <QPixmap>
#include <QProcess>
#include <QPushButton>
#include <QSplitter>
#include <QStatusBar>
#include <QStyledItemDelegate>
#include <QTimer>
#include <QTreeWidget>
#include <QVBoxLayout>

namespace {

const int kNotesDebounceMs = 300;
const int kCategoryDebounceMs = 300;
const int kDueRefreshMs = 60 * 1000;

const char *kPaletteColors[] = {
    "#2c3e50", "#34495e", "#3b3f4a", "#4a3b52",
    "#3a4a3c", "#523f3b", "#3a4852", "#42384a",
};

QString fmtDateTime(const QDateTime &dt) {
    if (!dt.isValid()) return QStringLiteral("—");
    return dt.toLocalTime().toString("yyyy-MM-dd HH:mm");
}

class NoFocusDelegate : public QStyledItemDelegate {
public:
    using QStyledItemDelegate::QStyledItemDelegate;
    void paint(QPainter *p, const QStyleOptionViewItem &option,
               const QModelIndex &index) const override {
        QStyleOptionViewItem opt = option;
        opt.state &= ~QStyle::State_HasFocus;
        QStyledItemDelegate::paint(p, opt, index);
    }
    QWidget *createEditor(QWidget *parent, const QStyleOptionViewItem &option,
                          const QModelIndex &index) const override {
        // Read-only columns in the todo tree: 1 = urgent, 2 = category, 4 = due-in
        int c = index.column();
        if (c == 1 || c == 2 || c == 4) return nullptr;
        return QStyledItemDelegate::createEditor(parent, option, index);
    }
};

} // namespace

MainWindow::MainWindow(TodoStore *store, const QString &dataDir, QWidget *parent)
    : QMainWindow(parent), m_store(store), m_dataDir(dataDir) {
    setWindowTitle("ich-habe-fertig");
    resize(1100, 680);
    buildUi();
    statusBar()->showMessage("Data directory: " + m_dataDir);

    m_dueRefreshTimer = new QTimer(this);
    connect(m_dueRefreshTimer, &QTimer::timeout, this, &MainWindow::refreshDueColumn);
    m_dueRefreshTimer->start(kDueRefreshMs);

    m_categoryDebounce = new QTimer(this);
    m_categoryDebounce->setSingleShot(true);
    connect(m_categoryDebounce, &QTimer::timeout, this, &MainWindow::persistCategory);

    m_notesDebounce = new QTimer(this);
    m_notesDebounce->setSingleShot(true);
    connect(m_notesDebounce, &QTimer::timeout, this, &MainWindow::persistNotes);

    m_celebration = new CelebrationOverlay(this);

    refreshList();
    clearDetail();
}

void MainWindow::buildUi() {
    auto *central = new QWidget(this);
    auto *outer = new QHBoxLayout(central);
    outer->setContentsMargins(6, 6, 6, 6);
    setCentralWidget(central);

    auto *hSplit = new QSplitter(Qt::Horizontal, central);
    outer->addWidget(hSplit);

    // ----- Left -----
    auto *leftWrap = new QWidget;
    auto *leftLay = new QVBoxLayout(leftWrap);
    leftLay->setContentsMargins(0, 0, 0, 0);
    leftLay->addWidget(new QLabel("Todos"));

    m_tree = new QTreeWidget;
    m_tree->setRootIsDecorated(false);
    m_tree->setUniformRowHeights(true);
    m_tree->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_tree->setColumnCount(5);
    m_tree->setHeaderLabels({"", "", "Category", "Title", "Due"});
    m_tree->header()->setStretchLastSection(false);
    m_tree->header()->resizeSection(0, 30);
    m_tree->header()->resizeSection(1, 26);
    m_tree->header()->resizeSection(2, 130);
    m_tree->header()->setSectionResizeMode(3, QHeaderView::Stretch);
    m_tree->header()->resizeSection(4, 110);
    m_tree->setEditTriggers(QAbstractItemView::DoubleClicked | QAbstractItemView::EditKeyPressed);
    m_tree->setItemDelegate(new NoFocusDelegate(m_tree));
    m_tree->setStyleSheet(
        "QTreeView { outline: 0; }"
        "QTreeView::item { padding: 3px 2px; }"
    );
    connect(m_tree, &QTreeWidget::itemSelectionChanged, this, &MainWindow::onSelectionChanged);
    connect(m_tree, &QTreeWidget::itemChanged, this, &MainWindow::onListItemChanged);
    connect(m_tree, &QTreeWidget::itemDoubleClicked, this, &MainWindow::onListItemDoubleClicked);
    leftLay->addWidget(m_tree, 1);

    auto *meta = new QGroupBox("Details");
    auto *form = new QFormLayout(meta);
    m_urgentBox = new QCheckBox("Urgent");
    connect(m_urgentBox, &QCheckBox::toggled, this, &MainWindow::onUrgentToggled);
    form->addRow(m_urgentBox);

    m_categoryEdit = new QLineEdit;
    connect(m_categoryEdit, &QLineEdit::textEdited, this, &MainWindow::onCategoryEdited);
    form->addRow("Category:", m_categoryEdit);

    m_createdLabel = new QLabel("—");
    m_createdLabel->setTextInteractionFlags(Qt::TextSelectableByMouse);
    form->addRow("Created:", m_createdLabel);
    m_completedLabel = new QLabel("—");
    m_completedLabel->setTextInteractionFlags(Qt::TextSelectableByMouse);
    form->addRow("Completed:", m_completedLabel);

    auto *dueRow = new QHBoxLayout;
    m_dueEdit = new QDateEdit;
    m_dueEdit->setCalendarPopup(true);
    m_dueEdit->setDisplayFormat("yyyy-MM-dd");
    m_dueEdit->setDate(QDate::currentDate());
    m_dueSetBtn = new QPushButton("Set");
    m_dueClearBtn = new QPushButton("Clear");
    connect(m_dueSetBtn, &QPushButton::clicked, this, &MainWindow::onDueSet);
    connect(m_dueClearBtn, &QPushButton::clicked, this, &MainWindow::onDueClear);
    dueRow->addWidget(m_dueEdit, 1);
    dueRow->addWidget(m_dueSetBtn);
    dueRow->addWidget(m_dueClearBtn);
    auto *dueWrap = new QWidget; dueWrap->setLayout(dueRow);
    form->addRow("Due:", dueWrap);

    leftLay->addWidget(meta);

    auto *btnRow = new QHBoxLayout;
    m_addBtn = new QPushButton("Add");
    m_deleteBtn = new QPushButton("Delete");
    m_hideCompleted = new QCheckBox("Hide completed");
    m_hideCompleted->setChecked(true);
    connect(m_addBtn, &QPushButton::clicked, this, &MainWindow::onAdd);
    connect(m_deleteBtn, &QPushButton::clicked, this, &MainWindow::onDelete);
    connect(m_hideCompleted, &QCheckBox::toggled, this, &MainWindow::onHideCompletedToggled);
    btnRow->addWidget(m_addBtn);
    btnRow->addWidget(m_deleteBtn);
    btnRow->addStretch(1);
    btnRow->addWidget(m_hideCompleted);
    leftLay->addLayout(btnRow);

    hSplit->addWidget(leftWrap);

    // ----- Right -----
    auto *vSplit = new QSplitter(Qt::Vertical);

    // Notes
    auto *notesWrap = new QWidget;
    auto *notesLay = new QVBoxLayout(notesWrap);
    notesLay->setContentsMargins(0, 0, 0, 0);
    notesLay->addWidget(new QLabel("Notes"));
    m_notes = new NotesEditor;
    connect(m_notes, &QPlainTextEdit::textChanged, this, &MainWindow::onNotesChanged);
    notesLay->addWidget(m_notes, 1);
    vSplit->addWidget(notesWrap);

    // Subtasks
    auto *subWrap = new QWidget;
    auto *subLay = new QVBoxLayout(subWrap);
    subLay->setContentsMargins(0, 0, 0, 0);
    auto *subHead = new QHBoxLayout;
    subHead->addWidget(new QLabel("Sub-tasks"));
    subHead->addStretch(1);
    m_subHideCompleted = new QCheckBox("Hide completed");
    m_subHideCompleted->setChecked(true);
    connect(m_subHideCompleted, &QCheckBox::toggled, this, &MainWindow::onSubtaskHideCompletedToggled);
    subHead->addWidget(m_subHideCompleted);
    subLay->addLayout(subHead);
    m_subtasks = new QListWidget;
    m_subtasks->setEditTriggers(QAbstractItemView::DoubleClicked | QAbstractItemView::EditKeyPressed);
    m_subtasks->setItemDelegate(new NoFocusDelegate(m_subtasks));
    m_subtasks->setStyleSheet(
        "QListView { outline: 0; }"
        "QListView::item { padding: 3px 2px; }"
    );
    connect(m_subtasks, &QListWidget::itemChanged, this, &MainWindow::onSubtaskItemChanged);
    subLay->addWidget(m_subtasks, 1);
    auto *subBtns = new QHBoxLayout;
    m_subAddBtn = new QPushButton("Add Sub-task");
    m_subDelBtn = new QPushButton("Delete Sub-task");
    connect(m_subAddBtn, &QPushButton::clicked, this, &MainWindow::onSubtaskAdd);
    connect(m_subDelBtn, &QPushButton::clicked, this, &MainWindow::onSubtaskDelete);
    subBtns->addWidget(m_subAddBtn);
    subBtns->addWidget(m_subDelBtn);
    subBtns->addStretch(1);
    subLay->addLayout(subBtns);
    vSplit->addWidget(subWrap);

    // Images
    auto *imgWrap = new QWidget;
    auto *imgLay = new QVBoxLayout(imgWrap);
    imgLay->setContentsMargins(0, 0, 0, 0);
    imgLay->addWidget(new QLabel("Images"));
    m_images = new ThumbnailListWidget;
    connect(m_images, &QListWidget::itemDoubleClicked, this, &MainWindow::onImageDoubleClicked);
    imgLay->addWidget(m_images, 1);
    auto *imgBtns = new QHBoxLayout;
    m_imgPasteBtn = new QPushButton("Paste Image");
    m_imgRemoveBtn = new QPushButton("Remove Image");
    connect(m_imgPasteBtn, &QPushButton::clicked, this, &MainWindow::onImagePaste);
    connect(m_imgRemoveBtn, &QPushButton::clicked, this, &MainWindow::onImageRemove);
    imgBtns->addWidget(m_imgPasteBtn);
    imgBtns->addWidget(m_imgRemoveBtn);
    imgBtns->addStretch(1);
    imgLay->addLayout(imgBtns);
    vSplit->addWidget(imgWrap);

    vSplit->setStretchFactor(0, 3);
    vSplit->setStretchFactor(1, 2);
    vSplit->setStretchFactor(2, 1);

    hSplit->addWidget(vSplit);
    hSplit->setStretchFactor(0, 1);
    hSplit->setStretchFactor(1, 2);
}

void MainWindow::resizeEvent(QResizeEvent *e) {
    QMainWindow::resizeEvent(e);
    if (m_celebration) m_celebration->setGeometry(rect());
}

QString MainWindow::currentSelectedId() const {
    auto items = m_tree->selectedItems();
    if (items.isEmpty()) return {};
    return items.first()->data(0, Qt::UserRole).toString();
}

QColor MainWindow::categoryColor(const QString &category) const {
    if (category.isEmpty()) return {};
    QByteArray hash = QCryptographicHash::hash(category.toUtf8(), QCryptographicHash::Md5);
    int idx = static_cast<unsigned char>(hash[0]) % (int)(sizeof(kPaletteColors) / sizeof(kPaletteColors[0]));
    return QColor(kPaletteColors[idx]);
}

QString MainWindow::dueInText(const QDateTime &dueAt) const {
    if (!dueAt.isValid()) return {};
    QDate today = QDateTime::currentDateTimeUtc().date();
    qint64 days = today.daysTo(dueAt.date());
    if (days < 0) return QString("Overdue %1d").arg(-days);
    if (days == 0) return "Today";
    if (days == 1) return "Tomorrow";
    return QString("In %1d").arg(days);
}

void MainWindow::applyRowStyle(QTreeWidgetItem *row, const TodoItem &item) {
    QFont titleFont = row->font(3);
    QColor fg;
    QColor bg;
    if (item.done) {
        titleFont.setStrikeOut(true);
        fg = QColor("#777777");
        bg = QColor();
    } else {
        titleFont.setStrikeOut(false);
        bg = categoryColor(item.category);
        if (bg.isValid()) fg = QColor("#ffffff");
    }
    for (int c = 0; c < m_tree->columnCount(); ++c) {
        if (c == 3) row->setFont(c, titleFont);
        if (fg.isValid()) row->setForeground(c, fg);
        else row->setForeground(c, m_tree->palette().text());
        if (bg.isValid()) row->setBackground(c, bg);
        else row->setBackground(c, QBrush());
    }
    if (item.urgent) {
        QFont urgentFont = row->font(1);
        urgentFont.setBold(true);
        urgentFont.setPointSizeF(urgentFont.pointSizeF() * 1.4);
        row->setFont(1, urgentFont);
        row->setForeground(1, QColor("#d32f2f"));
        row->setText(1, QStringLiteral("!"));
        row->setTextAlignment(1, Qt::AlignCenter);
    } else {
        row->setText(1, QString());
    }
}

void MainWindow::populateRow(QTreeWidgetItem *row, const TodoItem &item) {
    row->setData(0, Qt::UserRole, item.id);
    row->setFlags(row->flags() | Qt::ItemIsUserCheckable | Qt::ItemIsEditable);
    row->setCheckState(0, item.done ? Qt::Checked : Qt::Unchecked);
    row->setTextAlignment(0, Qt::AlignCenter);
    row->setTextAlignment(1, Qt::AlignCenter);
    row->setText(2, item.category);
    row->setText(3, item.text);
    row->setText(4, dueInText(item.dueAt));
    applyRowStyle(row, item);
}

QTreeWidgetItem *MainWindow::findRow(const QString &id) const {
    for (int i = 0; i < m_tree->topLevelItemCount(); ++i) {
        auto *r = m_tree->topLevelItem(i);
        if (r->data(0, Qt::UserRole).toString() == id) return r;
    }
    return nullptr;
}

void MainWindow::updateRowFor(const QString &id) {
    QTreeWidgetItem *row = findRow(id);
    auto fresh = m_store->get(id);
    bool hideDone = m_hideCompleted && m_hideCompleted->isChecked();

    if (!fresh) {
        if (row) delete row;
        return;
    }
    if (hideDone && fresh->done) {
        if (row) delete row;
        return;
    }
    if (!row) {
        // Row wasn't visible but should be now (e.g. unticked while hide-completed on)
        refreshList(id);
        return;
    }
    m_refreshingList = true;
    populateRow(row, *fresh);
    m_refreshingList = false;
}

void MainWindow::refreshList(const QString &keepSelectionId) {
    m_refreshingList = true;
    QString prevId = keepSelectionId.isEmpty() ? currentSelectedId() : keepSelectionId;
    m_tree->clear();
    auto items = m_store->load();
    bool hideDone = m_hideCompleted && m_hideCompleted->isChecked();
    QTreeWidgetItem *toSelect = nullptr;
    for (const auto &item : items) {
        if (hideDone && item.done) continue;
        auto *row = new QTreeWidgetItem(m_tree);
        populateRow(row, item);
        if (item.id == prevId) toSelect = row;
    }
    if (toSelect) {
        m_tree->setCurrentItem(toSelect);
        toSelect->setSelected(true);
    } else {
        m_tree->setCurrentIndex(QModelIndex());
        if (auto *sm = m_tree->selectionModel()) {
            sm->clearSelection();
            sm->clearCurrentIndex();
        }
    }
    m_refreshingList = false;
    if (!toSelect) clearDetail();
}

void MainWindow::onSelectionChanged() {
    if (m_refreshingList) return;
    QString id = currentSelectedId();
    if (id.isEmpty()) clearDetail();
    else loadDetail(id);
}

void MainWindow::clearDetail() {
    m_currentId.clear();
    m_loadingDetail = true;
    m_urgentBox->setChecked(false);
    m_categoryEdit->clear();
    m_createdLabel->setText("—");
    m_completedLabel->setText("—");
    m_dueEdit->setDate(QDate::currentDate());
    m_notes->clear();
    m_subtasks->clear();
    m_images->clear();
    m_loadingDetail = false;

    bool en = false;
    for (auto *w : {(QWidget*)m_urgentBox, (QWidget*)m_categoryEdit, (QWidget*)m_dueEdit,
                    (QWidget*)m_dueSetBtn, (QWidget*)m_dueClearBtn,
                    (QWidget*)m_notes, (QWidget*)m_subtasks, (QWidget*)m_images,
                    (QWidget*)m_subAddBtn, (QWidget*)m_subDelBtn,
                    (QWidget*)m_imgPasteBtn, (QWidget*)m_imgRemoveBtn}) {
        w->setEnabled(en);
    }
    m_deleteBtn->setEnabled(false);
}

void MainWindow::loadDetail(const QString &id) {
    auto fresh = m_store->get(id);
    if (!fresh) { clearDetail(); return; }
    const TodoItem *found = &(*fresh);

    m_currentId = id;
    m_loadingDetail = true;

    m_urgentBox->setChecked(found->urgent);
    m_categoryEdit->setText(found->category);
    m_createdLabel->setText(fmtDateTime(found->createdAt));
    m_completedLabel->setText(fmtDateTime(found->completedAt));
    if (found->dueAt.isValid()) m_dueEdit->setDate(found->dueAt.date());
    else m_dueEdit->setDate(QDate::currentDate());
    m_notes->setPlainText(found->notes);

    m_refreshingSubtasks = true;
    m_subtasks->clear();
    for (const auto &s : found->subtasks) {
        if (m_subHideCompleted->isChecked() && s.done) continue;
        auto *li = new QListWidgetItem(s.text, m_subtasks);
        li->setData(Qt::UserRole, s.id);
        li->setFlags(li->flags() | Qt::ItemIsUserCheckable | Qt::ItemIsEditable);
        li->setCheckState(s.done ? Qt::Checked : Qt::Unchecked);
        QFont f = li->font();
        f.setStrikeOut(s.done);
        li->setFont(f);
        if (s.done) li->setForeground(QColor("#888888"));
    }
    m_refreshingSubtasks = false;

    m_images->clear();
    for (const QString &rel : found->images) {
        QString abs = QDir(m_dataDir).absoluteFilePath(rel);
        QPixmap pm(abs);
        QIcon icon = pm.isNull() ? QIcon::fromTheme("image-x-generic") : QIcon(pm);
        auto *li = new QListWidgetItem(icon, QString(), m_images);
        li->setData(Qt::UserRole, rel);
        li->setToolTip(rel);
    }

    m_loadingDetail = false;

    for (auto *w : {(QWidget*)m_urgentBox, (QWidget*)m_categoryEdit, (QWidget*)m_dueEdit,
                    (QWidget*)m_dueSetBtn, (QWidget*)m_dueClearBtn,
                    (QWidget*)m_notes, (QWidget*)m_subtasks, (QWidget*)m_images,
                    (QWidget*)m_subAddBtn, (QWidget*)m_subDelBtn,
                    (QWidget*)m_imgPasteBtn, (QWidget*)m_imgRemoveBtn}) {
        w->setEnabled(true);
    }
    m_deleteBtn->setEnabled(true);
}

void MainWindow::onAdd() {
    AddItemDialog dlg(this);
    if (dlg.exec() != QDialog::Accepted) return;
    QString title = dlg.text();
    if (title.isEmpty()) return;
    auto created = m_store->add(title);
    refreshList(created.id);
    loadDetail(created.id);
    QTimer::singleShot(0, this, [this]() { m_notes->setFocus(); });
}

void MainWindow::onDelete() {
    QString id = currentSelectedId();
    if (id.isEmpty()) return;
    if (QMessageBox::question(this, "Delete todo", "Delete this item permanently?",
                              QMessageBox::Yes | QMessageBox::No) != QMessageBox::Yes)
        return;
    m_store->deleteItem(id);
    refreshList();
}

void MainWindow::onListItemChanged(QTreeWidgetItem *item, int column) {
    if (m_refreshingList) return;
    QString id = item->data(0, Qt::UserRole).toString();
    if (column == 0) {
        bool checked = item->checkState(0) == Qt::Checked;
        bool changed = m_store->setDone(id, checked);
        bool celebrate = changed && checked;
        // Defer mutation of the tree — clear/delete from inside this slot
        // would invalidate the very QTreeWidgetItem Qt is still operating on.
        QTimer::singleShot(0, this, [this, id, celebrate]() {
            if (celebrate && m_celebration) {
                m_celebration->setGeometry(rect());
                m_celebration->trigger();
            }
            updateRowFor(id);
            if (id == m_currentId) loadDetail(id);
        });
    } else if (column == 3) {
        QString newText = item->text(3).trimmed();
        if (!newText.isEmpty()) m_store->updateText(id, newText);
        QTimer::singleShot(0, this, [this, id]() { updateRowFor(id); });
    }
}

void MainWindow::onListItemDoubleClicked(QTreeWidgetItem *item, int column) {
    if (column == 3) m_tree->editItem(item, 3);
}

void MainWindow::onUrgentToggled(bool checked) {
    if (m_loadingDetail || m_currentId.isEmpty()) return;
    if (m_store->setUrgent(m_currentId, checked)) updateRowFor(m_currentId);
}

void MainWindow::onCategoryEdited(const QString &) {
    if (m_loadingDetail || m_currentId.isEmpty()) return;
    m_categoryDebounce->start(kCategoryDebounceMs);
}

void MainWindow::persistCategory() {
    if (m_currentId.isEmpty()) return;
    if (m_store->setCategory(m_currentId, m_categoryEdit->text())) updateRowFor(m_currentId);
}

void MainWindow::onDueSet() {
    if (m_currentId.isEmpty()) return;
    QDateTime due(m_dueEdit->date(), QTime(0, 0), Qt::UTC);
    if (m_store->setDueAt(m_currentId, due)) updateRowFor(m_currentId);
}

void MainWindow::onDueClear() {
    if (m_currentId.isEmpty()) return;
    if (m_store->setDueAt(m_currentId, QDateTime())) updateRowFor(m_currentId);
}

void MainWindow::onHideCompletedToggled(bool) { refreshList(m_currentId); }

void MainWindow::onNotesChanged() {
    if (m_loadingDetail || m_currentId.isEmpty()) return;
    m_notesDebounce->start(kNotesDebounceMs);
}

void MainWindow::persistNotes() {
    if (m_currentId.isEmpty()) return;
    m_store->updateNotes(m_currentId, m_notes->toPlainText());
}

void MainWindow::refreshDueColumn() {
    QHash<QString, QDateTime> byId;
    for (const auto &it : m_store->load()) byId.insert(it.id, it.dueAt);
    for (int i = 0; i < m_tree->topLevelItemCount(); ++i) {
        auto *row = m_tree->topLevelItem(i);
        auto it = byId.constFind(row->data(0, Qt::UserRole).toString());
        if (it != byId.constEnd()) row->setText(4, dueInText(*it));
    }
}

void MainWindow::onSubtaskAdd() {
    if (m_currentId.isEmpty()) return;
    QInputDialog dlg(this);
    dlg.setWindowTitle("Add sub-task");
    dlg.setLabelText("Text:");
    dlg.setInputMode(QInputDialog::TextInput);
    dlg.setTextEchoMode(QLineEdit::Normal);
    dlg.resize(640, dlg.sizeHint().height());
    if (dlg.exec() != QDialog::Accepted) return;
    QString text = dlg.textValue();
    text = text.trimmed();
    if (text.isEmpty()) return;
    m_store->addSubtask(m_currentId, text);
    loadDetail(m_currentId);
}

void MainWindow::onSubtaskDelete() {
    if (m_currentId.isEmpty()) return;
    auto sel = m_subtasks->selectedItems();
    if (sel.isEmpty()) return;
    QString sid = sel.first()->data(Qt::UserRole).toString();
    m_store->deleteSubtask(m_currentId, sid);
    loadDetail(m_currentId);
}

void MainWindow::onSubtaskItemChanged(QListWidgetItem *item) {
    if (m_refreshingSubtasks || m_loadingDetail || m_currentId.isEmpty()) return;
    QString sid = item->data(Qt::UserRole).toString();
    bool checked = item->checkState() == Qt::Checked;
    bool changed = m_store->setSubtaskDone(m_currentId, sid, checked);
    bool celebrate = changed && checked;
    QString newText = item->text().trimmed();
    if (!newText.isEmpty()) m_store->updateSubtaskText(m_currentId, sid, newText);
    QString id = m_currentId;
    QTimer::singleShot(0, this, [this, id, celebrate]() {
        if (celebrate && m_celebration) {
            m_celebration->setGeometry(rect());
            m_celebration->trigger();
        }
        if (id == m_currentId) loadDetail(id);
    });
}

void MainWindow::onSubtaskHideCompletedToggled(bool) {
    if (!m_currentId.isEmpty()) loadDetail(m_currentId);
}

void MainWindow::onImagePaste() {
    if (m_currentId.isEmpty()) return;
    QString rel = ImagePaster::pasteFromClipboard(this, m_dataDir, m_currentId);
    if (rel.isEmpty()) return;
    m_store->addImage(m_currentId, rel);
    loadDetail(m_currentId);
}

void MainWindow::onImageRemove() {
    if (m_currentId.isEmpty()) return;
    auto sel = m_images->selectedItems();
    if (sel.isEmpty()) return;
    QString rel = sel.first()->data(Qt::UserRole).toString();
    m_store->removeImage(m_currentId, rel);
    loadDetail(m_currentId);
}

void MainWindow::onImageDoubleClicked(QListWidgetItem *item) {
    QString rel = item->data(Qt::UserRole).toString();
    QString abs = QDir(m_dataDir).absoluteFilePath(rel);
    if (!QFile::exists(abs)) {
        QMessageBox::warning(this, "Missing", "Image file not found:\n" + abs);
        return;
    }
    if (!QProcess::startDetached("vimiv", {abs})) {
        QMessageBox::critical(this, "Launch failed", "Could not launch 'vimiv'. Is it installed?");
    }
}
