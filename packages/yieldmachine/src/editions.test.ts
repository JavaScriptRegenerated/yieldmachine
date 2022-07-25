import {
  newEditionList,
  append,
  replace,
  Revision,
  newEdition,
  nextEdition,
  Edition,
} from "./editions";

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

  test("Authorization", () => {
    let status = newEdition("initial");
    status = nextEdition(status, () => "checking");
    status = nextEdition(status, () => "signedIn");

    expect(status[Revision]).toEqual(2);
    expect(status.value).toEqual("signedIn");
  });

  describe("Async", () => {
    async function nextEditionAsync<Value>(
      original: Edition<Value>,
      transform: (helpers: {
        signal: AbortSignal;
      }) => AsyncGenerator<Value, void>,
      onError?: (error: unknown) => Value
    ): Promise<Edition<Value>> {
      const controller = new AbortController();
      let value = original.value;
      let revision = original[Revision];
      try {
        for await (const next of transform(controller)) {
          value = next;
          revision++;
        }
      }
      catch (error) {
        if (onError) {
          return nextEdition(original, () => onError(error), revision + 1)
        } else {
          return nextEdition(original, () => original.value, revision + 1)
        }
      }
      return nextEdition(original, () => value, revision);
    }

    test("Authorization Async", async () => {
      async function checkSignedIn() {
        return true;
      }

      let status = newEdition("initial");
      status = await nextEditionAsync(status, async function* ({ signal }) {
        yield "checking";
        yield (await checkSignedIn()) ? "signedIn" : "signedOut";
      });

      expect(status[Revision]).toEqual(2);
      expect(status.value).toEqual("signedIn");
    });

    test("Authorization Async throwing no handler rolls back", async () => {
      let status = newEdition("initial");
      status = await nextEditionAsync(status, async function* ({ signal }) {
        yield "checking";
        throw new Error("Whoops!")
      });

      expect(status[Revision]).toEqual(2);
      expect(status.value).toEqual("initial");
    });

    test("Authorization Async throwing with handler uses handler value", async () => {
      let status = newEdition("initial");
      status = await nextEditionAsync(status, async function* ({ signal }) {
        yield "checking";
        throw new Error("Whoops!")
      }, error => {
        return "failed"
      });

      expect(status[Revision]).toEqual(2);
      expect(status.value).toEqual("failed");
    });
  });
});
