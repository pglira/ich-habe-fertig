#include "ImagePaster.h"

#include <QBuffer>
#include <QClipboard>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QGuiApplication>
#include <QImage>
#include <QMessageBox>
#include <QMimeData>
#include <QRandomGenerator>
#include <QStringList>
#include <QUrl>
#include <QVariant>

namespace {

QString allowedExt(const QString &candidate) {
    static const QStringList kExts = {"png", "jpg", "jpeg", "bmp", "webp", "gif"};
    QString lc = candidate.toLower();
    return kExts.contains(lc) ? lc : QString();
}

} // namespace

QString ImagePaster::pasteFromClipboard(QWidget *parent,
                                        const QString &dataDir,
                                        const QString &itemId) {
    const QClipboard *cb = QGuiApplication::clipboard();
    const QMimeData *md = cb ? cb->mimeData() : nullptr;
    if (!md) {
        QMessageBox::information(parent, "Clipboard empty", "No image data on clipboard.");
        return {};
    }

    QString ext;
    QByteArray bytes;
    QString sourcePath;

    if (md->hasImage()) {
        QImage img = qvariant_cast<QImage>(md->imageData());
        if (!img.isNull()) {
            ext = "png";
            QBuffer buf(&bytes);
            buf.open(QIODevice::WriteOnly);
            img.save(&buf, "PNG");
        }
    }
    if (bytes.isEmpty() && md->hasUrls()) {
        for (const QUrl &u : md->urls()) {
            if (!u.isLocalFile()) continue;
            QString p = u.toLocalFile();
            QString cand = allowedExt(QFileInfo(p).suffix());
            if (!cand.isEmpty() && QFile::exists(p)) {
                sourcePath = p;
                ext = cand;
                break;
            }
        }
    }
    if (bytes.isEmpty() && sourcePath.isEmpty()) {
        QMessageBox::information(parent, "No image", "Clipboard has no usable image.");
        return {};
    }

    QString ts = QDateTime::currentDateTime().toString("yyyyMMddHHmmss");
    QString rand = QString::number(QRandomGenerator::global()->bounded(0x10000000, 0xFFFFFFF), 16);
    QString fname = ts + "_" + rand + "." + ext;
    QString relDir = "images/" + itemId;
    QString rel = relDir + "/" + fname;
    QString absDir = QDir(dataDir).absoluteFilePath(relDir);
    QDir().mkpath(absDir);
    QString abs = QDir(dataDir).absoluteFilePath(rel);

    bool wrote = false;
    if (!bytes.isEmpty()) {
        QFile f(abs);
        if (f.open(QIODevice::WriteOnly)) {
            f.write(bytes);
            f.close();
            wrote = true;
        }
    } else {
        wrote = QFile::copy(sourcePath, abs);
    }
    if (!wrote) {
        QMessageBox::critical(parent, "Save error", "Could not save image to:\n" + abs);
        return {};
    }
    return rel;
}
