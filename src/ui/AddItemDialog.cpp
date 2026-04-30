#include "AddItemDialog.h"
#include <QDialogButtonBox>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QPushButton>
#include <QVBoxLayout>

AddItemDialog::AddItemDialog(QWidget *parent) : QDialog(parent) {
    setWindowTitle("Add todo");
    auto *lay = new QVBoxLayout(this);
    lay->addWidget(new QLabel("Title:", this));
    m_edit = new QLineEdit(this);
    lay->addWidget(m_edit);
    auto *bb = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    lay->addWidget(bb);
    connect(bb, &QDialogButtonBox::rejected, this, &QDialog::reject);
    connect(bb, &QDialogButtonBox::accepted, this, [this]() {
        if (m_edit->text().trimmed().isEmpty()) {
            QMessageBox::warning(this, "Empty title", "Title cannot be empty.");
            return;
        }
        accept();
    });
    resize(360, 100);
}

QString AddItemDialog::text() const { return m_edit->text().trimmed(); }
