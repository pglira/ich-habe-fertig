#pragma once
#include <QListWidget>

class ThumbnailListWidget : public QListWidget {
    Q_OBJECT
public:
    explicit ThumbnailListWidget(QWidget *parent = nullptr);
    void setThumbnailSize(int px);
    int thumbnailSize() const { return m_size; }

signals:
    void thumbnailSizeChanged(int px);

protected:
    void wheelEvent(QWheelEvent *e) override;

private:
    int m_size = 96;
};
