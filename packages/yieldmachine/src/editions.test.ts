import { newEditionList, append, replace, Revision } from "./editions";

describe("Editions", () => {
  test("Todo List", () => {
    interface TodoItem {
      description: string;
      completedOn?: Date;
    }

    let todoList = newEditionList(new Array<TodoItem>(), Symbol("TodoList"));
    todoList = append(todoList, { description: "First" });
    const key = Symbol();
    todoList = append(todoList, { description: "Second" }, key);
    const withTwoItems = todoList;
    todoList = append(todoList, { description: "Third" });
    const completedOn = new Date();
    todoList = replace(todoList, key, (item) => ({ ...item, completedOn }));

    expect(todoList[Revision]).toEqual(4);
    expect(Array.from(todoList.value)).toEqual([
      {
        [Revision]: 1,
        key: expect.any(Symbol),
        value: { description: "First" },
      },
      { [Revision]: 4, key, value: { description: "Second", completedOn } },
      {
        [Revision]: 3,
        key: expect.any(Symbol),
        value: { description: "Third" },
      },
    ]);

    expect(withTwoItems[Revision]).toEqual(2);
    expect(Array.from(withTwoItems.value)).toEqual([
      {
        [Revision]: 1,
        key: expect.any(Symbol),
        value: { description: "First" },
      },
      { [Revision]: 2, key, value: { description: "Second" } },
    ]);
  });
});
