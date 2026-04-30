#pragma once
#include <QPlainTextEdit>

class LineNumberArea;

class NotesEditor : public QPlainTextEdit {
    Q_OBJECT
public:
    explicit NotesEditor(QWidget *parent = nullptr);
    void lineNumberAreaPaintEvent(QPaintEvent *event);
    int lineNumberAreaWidth();

protected:
    void resizeEvent(QResizeEvent *e) override;

private slots:
    void updateLineNumberAreaWidth(int);
    void updateLineNumberArea(const QRect &rect, int dy);
    void highlightCurrentLine();

private:
    LineNumberArea *m_gutter;
};
