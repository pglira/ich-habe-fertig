#!/usr/bin/env bash
# Builds ich-habe-fertig in release mode and installs it for the current user:
#
#   bin/ich-habe-fertig                            launcher, starts the app detached from the terminal
#   lib/ich-habe-fertig/ich-habe-fertig            the binary
#   share/applications/ich-habe-fertig.desktop     desktop entry (Linux)
#   share/icons/hicolor/*/apps/ich-habe-fertig.png icons (Linux)
#
# All paths are below $PREFIX (default: ~/.local).
#
# Usage: scripts/install.sh [--no-build] [--no-desktop] [--uninstall]
set -euo pipefail

NAME=ich-habe-fertig
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"
LIB_DIR="$PREFIX/lib/$NAME"
APP_DIR="$PREFIX/share/applications"
ICON_DIR="$PREFIX/share/icons/hicolor"

build=1
desktop=1
uninstall=0
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    --no-desktop) desktop=0 ;;
    --uninstall) uninstall=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "error: unknown option $arg" >&2; exit 1 ;;
  esac
done

refresh_caches() {
  if command -v update-desktop-database >/dev/null; then update-desktop-database -q "$APP_DIR" || true; fi
}

if [[ $uninstall == 1 ]]; then
  rm -f "$BIN_DIR/$NAME" "$APP_DIR/$NAME.desktop"
  rm -rf "$LIB_DIR"
  rm -f "$ICON_DIR/128x128/apps/$NAME.png" "$ICON_DIR/512x512/apps/$NAME.png"
  refresh_caches
  echo "$NAME is uninstalled from $PREFIX."
  exit 0
fi

if [[ $build == 1 ]]; then
  (cd "$ROOT" && pnpm install --frozen-lockfile && pnpm tauri build --no-bundle)
fi

BINARY="$ROOT/src-tauri/target/release/$NAME"
if [[ ! -x "$BINARY" ]]; then
  echo "error: $BINARY does not exist. Run without --no-build." >&2
  exit 1
fi

install -Dm755 "$BINARY" "$LIB_DIR/$NAME"

# The launcher makes a relative path argument absolute, then starts the app in
# the background, so that the terminal is free at once.
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/$NAME" <<LAUNCHER
#!/usr/bin/env bash
args=()
for arg in "\$@"; do
  if [[ "\$arg" != -* ]]; then
    args+=("\$(realpath -m "\$arg")")
  else
    args+=("\$arg")
  fi
done
nohup "$LIB_DIR/$NAME" "\${args[@]}" >/dev/null 2>&1 &
disown >/dev/null 2>&1 || true
LAUNCHER
chmod 755 "$BIN_DIR/$NAME"
echo "Installed: $BIN_DIR/$NAME"

if [[ $desktop == 1 && "$(uname -s)" == "Linux" ]]; then
  install -Dm644 "$ROOT/src-tauri/icons/128x128.png" "$ICON_DIR/128x128/apps/$NAME.png"
  install -Dm644 "$ROOT/src-tauri/icons/icon.png" "$ICON_DIR/512x512/apps/$NAME.png"
  mkdir -p "$APP_DIR"
  cat > "$APP_DIR/$NAME.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=ich-habe-fertig
GenericName=Todo List
Comment=A simple desktop todo app
Exec="$LIB_DIR/$NAME"
Icon=$NAME
Terminal=false
Categories=Office;ProjectManagement;
StartupWMClass=$NAME
DESKTOP
  refresh_caches
  echo "Installed: $APP_DIR/$NAME.desktop"
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Note: $BIN_DIR is not on your PATH." ;;
esac
