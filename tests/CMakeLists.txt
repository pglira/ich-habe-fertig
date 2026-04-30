add_executable(test_todo_store test_todo_store.cpp)
target_link_libraries(test_todo_store PRIVATE ich_habe_fertig_core Qt6::Test)
add_test(NAME test_todo_store COMMAND test_todo_store)
