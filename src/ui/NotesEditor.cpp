#include "NotesEditor.h"

#include <QPaintEvent>
#include <QPainter>
#include <QTextBlock>

class LineNumberArea : public QWidget {
public:
    LineNumberArea(NotesEditor *editor) : QWidget(editor), m_editor(editor) {}
    QSize sizeHint() const override { return QSize(m_editor->lineNumberAreaWidth(), 0); }
protected:
    void paintEvent(QPaintEvent *e) override { m_editor->lineNumberAreaPaintEvent(e); }
private:
    NotesEditor *m_editor;
};

NotesEditor::NotesEditor(QWidget *parent) : QPlainTextEdit(parent) {
    m_gutter = new LineNumberArea(this);
    connect(this, &NotesEditor::blockCountChanged, this, &NotesEditor::updateLineNumberAreaWidth);
    connect(this, &NotesEditor::updateRequest, this, &NotesEditor::updateLineNumberArea);
    connect(this, &NotesEditor::cursorPositionChanged, this, &NotesEditor::highlightCurrentLine);
    updateLineNumberAreaWidth(0);
    highlightCurrentLine();
}

int NotesEditor::lineNumberAreaWidth() {
    int digits = 1;
    int max = qMax(1, blockCount());
    while (max >= 10) { max /= 10; ++digits; }
    return 10 + fontMetrics().horizontalAdvance(QLatin1Char('9')) * digits;
}

void NotesEditor::updateLineNumberAreaWidth(int) {
    setViewportMargins(lineNumberAreaWidth(), 0, 0, 0);
}

void NotesEditor::updateLineNumberArea(const QRect &rect, int dy) {
    if (dy) m_gutter->scroll(0, dy);
    else m_gutter->update(0, rect.y(), m_gutter->width(), rect.height());
    if (rect.contains(viewport()->rect())) updateLineNumberAreaWidth(0);
}

void NotesEditor::resizeEvent(QResizeEvent *e) {
    QPlainTextEdit::resizeEvent(e);
    QRect cr = contentsRect();
    m_gutter->setGeometry(QRect(cr.left(), cr.top(), lineNumberAreaWidth(), cr.height()));
}

void NotesEditor::highlightCurrentLine() {
    QList<QTextEdit::ExtraSelection> sels;
    if (!isReadOnly()) {
        QTextEdit::ExtraSelection sel;
        sel.format.setBackground(palette().alternateBase().color());
        sel.format.setProperty(QTextFormat::FullWidthSelection, true);
        sel.cursor = textCursor();
        sel.cursor.clearSelection();
        sels.append(sel);
    }
    setExtraSelections(sels);
}

void NotesEditor::lineNumberAreaPaintEvent(QPaintEvent *e) {
    QPainter painter(m_gutter);
    painter.fillRect(e->rect(), palette().alternateBase().color());
    QTextBlock block = firstVisibleBlock();
    int blockNumber = block.blockNumber();
    int top = qRound(blockBoundingGeometry(block).translated(contentOffset()).top());
    int bottom = top + qRound(blockBoundingRect(block).height());
    QColor numberColor = palette().placeholderText().color();
    while (block.isValid() && top <= e->rect().bottom()) {
        if (block.isVisible() && bottom >= e->rect().top()) {
            QString number = QString::number(blockNumber + 1);
            painter.setPen(numberColor);
            painter.drawText(0, top, m_gutter->width() - 4, fontMetrics().height(),
                             Qt::AlignRight, number);
        }
        block = block.next();
        top = bottom;
        bottom = top + qRound(blockBoundingRect(block).height());
        ++blockNumber;
    }
}
