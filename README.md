# ich-habe-fertig

A simple desktop todo app written in C++17 with Qt6 Widgets and SQLite. 📝

## Features

- ➕ Add / delete / inline-edit / complete todos
- 🚨 Per-item urgent flag, 🏷️ free-text category (hash-coloured row), 📅 due date
- 📝 Notes editor with line-number gutter (debounced auto-save)
- ☑️ Sub-tasks (add / inline-edit / check / delete, hide-completed filter)
- 🖼️ Image attachments (paste from clipboard or drag-from-file URLs); thumbnails;
  Ctrl+wheel zoom; double-click opens via external `cheder`
- 🎉 Confetti celebration when an item is completed

## Build

Requires Qt6 (Widgets + Sql + Test) and CMake ≥ 3.21.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

Outputs:

- `build/ich-habe-fertig` — the GUI app
- `build/tests/test_todo_store` — unit tests (`ctest --test-dir build`)

For a fully static binary, point `CMAKE_PREFIX_PATH` at a static-built Qt6 and pass `-DBUILD_STATIC=ON`.

## Run

```sh
./build/ich-habe-fertig /path/to/data-dir   # explicit dir
./build/ich-habe-fertig                      # opens directory chooser
```

All data is stored under the chosen directory: `todos.db` for the todo state and `images/<id>/` for attached images.

## License

MIT — see [LICENSE](LICENSE).
