#pragma once
#include <QElapsedTimer>
#include <QTimer>
#include <QWidget>

struct Particle {
    QPointF pos;
    QPointF vel;
    QColor color;
    qreal size;
    qreal life;
};

class CelebrationOverlay : public QWidget {
    Q_OBJECT
public:
    explicit CelebrationOverlay(QWidget *parent);
    void trigger();

protected:
    void paintEvent(QPaintEvent *) override;

private slots:
    void step();

private:
    QTimer m_timer;
    QElapsedTimer m_clock;
    qint64 m_lastMs = 0;
    QList<Particle> m_particles;
};
