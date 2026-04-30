#include "CelebrationOverlay.h"

#include <QPainter>
#include <QRandomGenerator>

namespace {
const QColor kPalette[] = {
    QColor("#FF595E"), QColor("#FFCA3A"), QColor("#8AC926"),
    QColor("#1982C4"), QColor("#6A4C93"), QColor("#FF924C"), QColor("#F7B2BD"),
};
}

CelebrationOverlay::CelebrationOverlay(QWidget *parent) : QWidget(parent) {
    setAttribute(Qt::WA_TransparentForMouseEvents);
    setAttribute(Qt::WA_NoSystemBackground);
    setAttribute(Qt::WA_TranslucentBackground);
    hide();
    connect(&m_timer, &QTimer::timeout, this, &CelebrationOverlay::step);
}

void CelebrationOverlay::trigger() {
    if (!parentWidget()) return;
    setGeometry(parentWidget()->rect());
    raise();
    show();
    auto *rng = QRandomGenerator::global();
    int n = 80;
    for (int i = 0; i < n; ++i) {
        Particle p;
        p.pos = QPointF(width() / 2.0 + rng->bounded(-40, 40), height() / 2.0);
        qreal angle = rng->generateDouble() * 6.283;
        qreal speed = 150.0 + rng->generateDouble() * 270.0;
        p.vel = QPointF(qCos(angle) * speed, -qFabs(qSin(angle) * speed) - 100);
        p.color = kPalette[rng->bounded(int(sizeof(kPalette) / sizeof(kPalette[0])))];
        p.size = rng->bounded(4, 9);
        p.life = 1.0;
        m_particles.append(p);
    }
    m_clock.restart();
    m_lastMs = 0;
    if (!m_timer.isActive()) m_timer.start(16);
}

void CelebrationOverlay::step() {
    qint64 now = m_clock.elapsed();
    qreal dt = qBound<qreal>(0.0, (now - m_lastMs) / 1000.0, 0.05);
    m_lastMs = now;
    const qreal gravity = 900.0;
    for (auto &p : m_particles) {
        p.vel.setY(p.vel.y() + gravity * dt);
        p.pos += p.vel * dt;
        p.life -= dt * 0.5;
    }
    m_particles.erase(std::remove_if(m_particles.begin(), m_particles.end(),
                                     [](const Particle &p) { return p.life <= 0; }),
                      m_particles.end());
    update();
    if (m_particles.isEmpty()) {
        m_timer.stop();
        hide();
    }
}

void CelebrationOverlay::paintEvent(QPaintEvent *) {
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    for (const auto &p : m_particles) {
        QColor c = p.color;
        c.setAlphaF(qBound<qreal>(0.0, p.life, 1.0));
        painter.setBrush(c);
        painter.setPen(Qt::NoPen);
        painter.drawEllipse(p.pos, p.size, p.size);
    }
}
