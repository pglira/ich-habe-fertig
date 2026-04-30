#include "model/TodoStore.h"
#include "ui/MainWindow.h"

#include <QApplication>
#include <QCommandLineParser>
#include <QDir>
#include <QFileDialog>
#include <QFileInfo>
#include <QMessageBox>
#include <QStandardPaths>
#include <QTemporaryFile>
#include <QTextStream>
#include <iostream>
#include <unistd.h>

static bool isWritableDir(const QString &path) {
    QFileInfo fi(path);
    if (!fi.exists() || !fi.isDir()) return false;
    QTemporaryFile probe(QDir(path).absoluteFilePath(".ihf_write_test_XXXXXX"));
    return probe.open();
}

static QString prepareDirectory(const QString &target) {
    QDir d(target);
    if (!d.exists() && !d.mkpath(".")) {
        QMessageBox::critical(nullptr, "Invalid directory", "Could not create directory:\n" + target);
        return {};
    }
    if (!isWritableDir(d.absolutePath())) {
        QMessageBox::critical(nullptr, "Invalid directory", "Directory is not writable:\n" + target);
        return {};
    }
    return d.absolutePath();
}

static QString promptDirectoryFromTerminal() {
    if (!isatty(fileno(stdin))) return {};
    std::cout << "No data directory provided.\n"
                 "Enter a directory path to store todo data (empty = cancel): " << std::flush;
    std::string typed;
    std::getline(std::cin, typed);
    QString q = QString::fromStdString(typed).trimmed();
    if (q.isEmpty()) return {};
    return q;
}

static QString resolveDataDirectory(const QString &cliDir) {
    if (!cliDir.isEmpty()) return prepareDirectory(QDir::cleanPath(cliDir));
    QString chosen = QFileDialog::getExistingDirectory(
        nullptr, "Select todo data directory", QDir::homePath(),
        QFileDialog::DontUseNativeDialog | QFileDialog::ShowDirsOnly);
    if (chosen.isEmpty()) chosen = promptDirectoryFromTerminal();
    if (chosen.isEmpty()) return {};
    return prepareDirectory(chosen);
}

int main(int argc, char **argv) {
    QApplication app(argc, argv);
    app.setApplicationName("ich-habe-fertig");

    QCommandLineParser parser;
    parser.setApplicationDescription("ich-habe-fertig — todo app");
    parser.addHelpOption();
    parser.addPositionalArgument("data_dir", "Directory where todo data is stored (optional).");
    parser.process(app);

    QString cliDir;
    auto pos = parser.positionalArguments();
    if (!pos.isEmpty()) cliDir = pos.first();

    QString dataDir = resolveDataDirectory(cliDir);
    if (dataDir.isEmpty()) return 0;

    TodoStore store(dataDir);
    MainWindow window(&store, dataDir);
    window.show();
    return app.exec();
}
