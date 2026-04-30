# ich-habe-fertig

C++/Qt6 port of [`do-re-mi-fa-so-la-si-done`](../do-re-mi-fa-so-la-si-done) — a simple desktop todo app.

Behavior-equivalent to the original, with these intentional differences:

- Storage is **SQLite** (`todos.db`) instead of JSONL.
- UI layout is idiomatic Qt/C++ — same features, not pixel-faithful.

## Features

- Add / delete / inline-edit / complete todos
- Per-item urgent flag, free-text category (hash-coloured row), due date
- Notes editor with line-number gutter (debounced auto-save)
- Sub-tasks (add / inline-edit / check / delete, hide-completed filter)
- Image attachments (paste from clipboard or drag-from-file URLs); thumbnails;
  Ctrl+wheel zoom; double-click opens via external `vimiv`
- Confetti celebration when an item is completed

## Build

Requires Qt6 (Widgets + Sql + Test) and CMake ≥ 3.21.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

Outputs:

- `build/ich-habe-fertig` — the GUI app
- `build/migrate-jsonl` — one-shot importer (see below)
- `build/tests/test_todo_store` — unit tests (`ctest --test-dir build`)

For a fully static binary, point `CMAKE_PREFIX_PATH` at a static-built Qt6 and pass `-DBUILD_STATIC=ON`.

## Run

```sh
./build/ich-habe-fertig /path/to/data-dir   # explicit dir
./build/ich-habe-fertig                      # opens directory chooser
```

## Importing data from the Python app

The Python app stores todos in `todos.jsonl`. Import them into a SQLite store with:

```sh
./build/migrate-jsonl /path/to/python-data-dir            # writes todos.db in-place
./build/migrate-jsonl /path/to/source /path/to/dest       # or to a separate dir
```

The original `todos.jsonl` is left untouched. The `images/<id>/` layout is unchanged, so existing image attachments are picked up directly.

## License

MIT — see [LICENSE](LICENSE).
