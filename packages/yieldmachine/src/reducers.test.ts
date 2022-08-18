import { on, accumulate, start, map } from "./index";

// See: https://components.guide/react+typescript/reducer-patterns

describe("Toggle Flag boolean map callback", () => {
  function* Switch() {
    yield on(
      "toggle",
      map((current: boolean) => !current)
    );

    return false;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(false);
    expect(machine.value.change).toEqual(0);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    expect(machine.value.change).toEqual(1);
    machine.next("toggle");
    expect(machine.value.state).toEqual(false);
    expect(machine.value.change).toEqual(2);
    machine.next("unrecognised");
    expect(machine.value.state).toEqual(false);
    expect(machine.value.change).toEqual(2);
  });
});

describe("One-Way Flag", () => {
  function* Switch() {
    yield on(
      "toggle",
      map<boolean>((current) => true)
    );

    return false;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(false);
    expect(machine.value.change).toEqual(0);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    expect(machine.value.change).toEqual(1);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    expect(machine.value.change).toEqual(2);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    expect(machine.value.change).toEqual(3);
    machine.next("unrecognised");
    expect(machine.value.state).toEqual(true);
    expect(machine.value.change).toEqual(3);
  });
});

describe("Counter number map callback", () => {
  function* Counter() {
    yield on(
      "increment",
      map((n: number) => n + 1)
    );

    return 0;
  }

  test("sending events", () => {
    const machine = start(Counter);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(0);
    expect(machine.value.change).toEqual(0);
    machine.next("increment");
    expect(machine.value.state).toEqual(1);
    expect(machine.value.change).toEqual(1);
    machine.next("increment");
    expect(machine.value.state).toEqual(2);
    expect(machine.value.change).toEqual(2);
  });
});

describe("Counter number with multiple events", () => {
  function* Counter() {
    yield on(
      "+1",
      map((n: number) => n + 1)
    );
    yield on(
      "+10",
      map((n: number) => n + 10)
    );

    return 0;
  }

  test("sending events", () => {
    const machine = start(Counter);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(0);
    machine.next("+1");
    expect(machine.value.state).toEqual(1);
    machine.next("+1");
    expect(machine.value.state).toEqual(2);
    machine.next("+10");
    expect(machine.value.state).toEqual(12);
    machine.next("+10");
    expect(machine.value.state).toEqual(22);
    machine.next("+1");
    expect(machine.value.state).toEqual(23);
    expect(machine.value.change).toEqual(5);
  });
});

describe("Compound number mapper", () => {
  function SwitchableCounter() {
    function* On() {
      yield on("flick", Off);
      yield on(
        "increment",
        map((n: number) => n + 1)
      );
      return 0;
    }
    function* Off() {
      yield on("flick", On);
    }

    return Off;
  }

  test("sending events", () => {
    const machine = start(SwitchableCounter);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual("Off");
    machine.next("increment");
    expect(machine.value.state).toEqual("Off");
    machine.next("flick");
    expect(machine.value.state).toEqual({ On: 0 });
    machine.next("increment");
    expect(machine.value.state).toEqual({ On: 1 });
    machine.next("increment");
    expect(machine.value.state).toEqual({ On: 2 });
    machine.next("flick");
    expect(machine.value.state).toEqual("Off");
    machine.next("flick");
    expect(machine.value.state).toEqual({ On: 0 });
    expect(machine.value.change).toEqual(5);
  });
});

describe("Menu/Exclusive Value string mapper", () => {
  function* Menu() {
    function onMenuItem(id: string) {
      return on(
        id,
        map((current: string) => (current === id ? "" : (id as string)))
      );
    }
    yield onMenuItem("file");
    yield onMenuItem("edit");
    yield onMenuItem("view");
    yield on(
      "close",
      map(() => "")
    );

    return "";
  }

  test("sending events", () => {
    const machine = start(Menu);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual("");
    machine.next("file");
    expect(machine.value.state).toEqual("file");
    machine.next("close");
    expect(machine.value.state).toEqual("");
    machine.next("file");
    expect(machine.value.state).toEqual("file");
    machine.next("file");
    expect(machine.value.state).toEqual("");
    machine.next("file");
    expect(machine.value.state).toEqual("file");
    machine.next("edit");
    expect(machine.value.state).toEqual("edit");
    machine.next("view");
    expect(machine.value.state).toEqual("view");
    machine.next("edit");
    expect(machine.value.state).toEqual("edit");
    machine.next("edit");
    expect(machine.value.state).toEqual("");
    machine.next("close");
    expect(machine.value.state).toEqual("");
    expect(machine.value.change).toEqual(10);
  });
});

describe("Menu/Exclusive Value symbol mapper", () => {
  const Closed = Symbol("closed");
  const File = Symbol("file");
  const Edit = Symbol("edit");
  const View = Symbol("view");
  function* Menu() {
    function closeIfCurrent(id: symbol) {
      return map((current: symbol) => (current === id ? Closed : id));
    }
    yield on("file", closeIfCurrent(File));
    yield on("edit", closeIfCurrent(Edit));
    yield on("view", closeIfCurrent(View));
    yield on(
      "close",
      map(() => Closed)
    );

    return Closed;
  }

  test("sending events", () => {
    const machine = start(Menu);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(Closed);
    machine.next("file");
    expect(machine.value.state).toEqual(File);
    machine.next("close");
    expect(machine.value.state).toEqual(Closed);
    machine.next("file");
    expect(machine.value.state).toEqual(File);
    machine.next("file");
    expect(machine.value.state).toEqual(Closed);
    machine.next("file");
    expect(machine.value.state).toEqual(File);
    machine.next("edit");
    expect(machine.value.state).toEqual(Edit);
    machine.next("view");
    expect(machine.value.state).toEqual(View);
    machine.next("edit");
    expect(machine.value.state).toEqual(Edit);
    machine.next("edit");
    expect(machine.value.state).toEqual(Closed);
    machine.next("close");
    expect(machine.value.state).toEqual(Closed);
    expect(machine.value.change).toEqual(10);
  });
});

describe.skip("Nested counters", () => {
  const increment = map((n: number) => n + 1);

  function Counters() {
    function* Counter1() {
      yield on("first", increment);
      return 0;
    }
    function* Counter2() {
      yield on("second", increment);
      return 0;
    }
    function* Counter3() {
      yield on("third", increment);
      return 0;
    }

    return [Counter1, Counter2, Counter3];
  }

  test("sending events", () => {
    const machine = start(Counters);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual({ Counter1: 0 });
    machine.next("first");
    expect(machine.value.state).toEqual({ Counter1: 1 });
    machine.next("first");
    expect(machine.value.state).toEqual({ Counter1: 2 });
  });
});
