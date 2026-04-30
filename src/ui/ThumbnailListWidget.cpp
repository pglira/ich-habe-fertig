#include "ThumbnailListWidget.h"

#include <QWheelEvent>

ThumbnailListWidget::ThumbnailListWidget(QWidget *parent) : QListWidget(parent) {
    setViewMode(QListView::IconMode);
    setResizeMode(QListView::Adjust);
    setMovement(QListView::Static);
    setUniformItemSizes(true);
    setSpacing(6);
    setThumbnailSize(m_size);
}

void ThumbnailListWidget::setThumbnailSize(int px) {
    m_size = qBound(48, px, 256);
    setIconSize(QSize(m_size, m_size));
    setGridSize(QSize(m_size + 16, m_size + 16));
    emit thumbnailSizeChanged(m_size);
}

void ThumbnailListWidget::wheelEvent(QWheelEvent *e) {
    if (e->modifiers() & Qt::ControlModifier) {
        int delta = e->angleDelta().y() > 0 ? 16 : -16;
        setThumbnailSize(m_size + delta);
        e->accept();
        return;
    }
    QListWidget::wheelEvent(e);
}
