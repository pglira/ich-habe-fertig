#pragma once
#include <QDialog>
class QLineEdit;

class AddItemDialog : public QDialog {
    Q_OBJECT
public:
    explicit AddItemDialog(QWidget *parent = nullptr);
    QString text() const;
private:
    QLineEdit *m_edit;
};
