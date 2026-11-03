# ich-habe-fertig

A simple desktop todo app, built with Tauri (Rust) and React. 📝

## Features

- ➕ Add / delete / inline-edit / complete todos
- 🏷️ Categories: chosen from a dropdown; managed in a dialog (add, rename/merge, color, archive, delete); automatic hash color unless a color is set
- 📅 Due date, editable creation date; the list is sorted by creation date
- 📝 Notes editor with line numbers (debounced auto-save)
- ☑️ Sub-tasks (add / inline-edit / check / delete, hide-completed filter); the list shows open/total
- 🖼️ Image attachments (paste from the clipboard or drag from the file manager); thumbnails;
  Ctrl+wheel zoom; double-click opens the image in the external viewer `cheder`
- 🎉 Confetti when an item is completed
- ⚙️ Settings (gear button): the font of the notes editor. Stored in `~/.config/ich-habe-fertig/settings.json`

## Keyboard

| Key | Action |
| --- | --- |
| `Ctrl N` | Add a todo |
| `Ctrl H` | Hide or show the completed todos (also in the settings menu) |
| `Ctrl V` | Paste an image to the selected todo (outside of text fields) |
| `↑` / `↓` | Select the previous / next todo |
| `Space` | Complete the selected todo |
| `F2`, `Enter` | Rename the selected todo |
| `Delete` | Delete the selected todo, sub-task or image |

## Build

Requires Rust, Node.js, pnpm and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
pnpm install
pnpm tauri build --no-bundle    # src-tauri/target/release/ich-habe-fertig
pnpm tauri build                # also an AppImage in src-tauri/target/release/bundle/appimage/
scripts/install.sh              # builds and installs below ~/.local (launcher, desktop entry, icons)
```

Development: `pnpm tauri dev`.

## Tests

```sh
cd src-tauri && cargo test      # store, image and CLI tests
pnpm test                       # frontend helpers
pnpm typecheck
```

## Run

```sh
ich-habe-fertig /path/to/data-dir   # explicit directory, created if necessary
ich-habe-fertig                     # opens a directory chooser
```

All data is stored under the chosen directory: `todos.db` (SQLite) for the todo state and `images/<id>/` for attached images.

## Layout

- `src-tauri/src/store.rs` — `TodoStore`: the SQLite schema and all changes to the data, with unit tests.
- `src-tauri/src/categories.rs` — categories: list, add, rename, color, archive, delete.
- `src-tauri/src/images.rs` — image files below `images/<id>/`, the clipboard.
- `src-tauri/src/commands.rs` — Tauri commands.
- `src-tauri/src/settings.rs` — the settings file in the configuration directory of the user.
- `src-tauri/src/protocol.rs` — the `ihf` URI scheme that serves the image files to the webview.
- `src/App.tsx` — the main view; `src/components/` — list, details, notes, sub-tasks, images, confetti.
- `src/styles/index.css` — the design tokens, shared with Galley: always dark, square corners, IBM Plex Sans and Mono.

## License

MIT — see [LICENSE](LICENSE).
