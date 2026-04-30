#pragma once
#include <QString>

class QWidget;

class ImagePaster {
public:
    // Reads an image from the clipboard (raster data or local file URL),
    // saves it under <dataDir>/images/<itemId>/<timestamp>_<rand>.<ext>
    // and returns the relative path on success. On failure or empty
    // clipboard, returns an empty string and shows a QMessageBox on `parent`.
    static QString pasteFromClipboard(QWidget *parent,
                                      const QString &dataDir,
                                      const QString &itemId);
};
