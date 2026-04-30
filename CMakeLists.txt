cmake_minimum_required(VERSION 3.21)
project(ich-habe-fertig CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

option(BUILD_STATIC "Link against a static Qt6 build (requires static-built Qt in CMAKE_PREFIX_PATH)" OFF)

find_package(Qt6 6.4 REQUIRED COMPONENTS Widgets Sql Test)

set(APP_SOURCES
    src/model/TodoItem.h
    src/model/TodoItem.cpp
    src/model/TodoStore.h
    src/model/TodoStore.cpp
    src/ui/AddItemDialog.h
    src/ui/AddItemDialog.cpp
    src/ui/ImagePaster.h
    src/ui/ImagePaster.cpp
    src/ui/NotesEditor.h
    src/ui/NotesEditor.cpp
    src/ui/ThumbnailListWidget.h
    src/ui/ThumbnailListWidget.cpp
    src/ui/CelebrationOverlay.h
    src/ui/CelebrationOverlay.cpp
    src/ui/MainWindow.h
    src/ui/MainWindow.cpp
)

add_library(ich_habe_fertig_core STATIC ${APP_SOURCES})
target_include_directories(ich_habe_fertig_core PUBLIC src)
target_link_libraries(ich_habe_fertig_core PUBLIC Qt6::Widgets Qt6::Sql)

add_executable(ich-habe-fertig src/main.cpp)
target_link_libraries(ich-habe-fertig PRIVATE ich_habe_fertig_core)

add_executable(migrate-jsonl src/migrate.cpp)
target_link_libraries(migrate-jsonl PRIVATE ich_habe_fertig_core)

if(WIN32)
    set_target_properties(ich-habe-fertig PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

enable_testing()
add_subdirectory(tests)
