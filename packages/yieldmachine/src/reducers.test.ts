import { on, accumulate, start, map } from "./index";

// See: https://components.guide/react+typescript/reducer-patterns

describe("Toggle Flag boolean map callback", () => {
  function* Switch() {
    yield on("toggle", map((current: boolean) => !current));

    return false;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(false);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    machine.next("toggle");
    expect(machine.value.state).toEqual(false);
    machine.next("unrecognised");
    expect(machine.value.state).toEqual(false);
  });
});

describe("One-Way Flag", () => {
  function* Switch() {
    yield on("toggle", map((current: boolean) => true as boolean));

    return false;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(false);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    machine.next("toggle");
    expect(machine.value.state).toEqual(true);
    machine.next("unrecognised");
    expect(machine.value.state).toEqual(true);
  });
});

describe("Counter number map callback", () => {
  function* Counter() {
    yield on("increment", map((n: number) => n + 1));

    return 0;
  }

  test("sending events", () => {
    const machine = start(Counter);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(0);
    machine.next("increment");
    expect(machine.value.state).toEqual(1);
    machine.next("increment");
    expect(machine.value.state).toEqual(2);
  });
});

describe("Compound number mapper", () => {
  function SwitchableCounter() {
    function *On() {
      yield on("flick", Off);
      yield on("increment", map((n: number) => n + 1));
      return 0;
    }
    function *Off() {
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
    expect(machine.value.state).toEqual({ "On": 0 });
    machine.next("increment");
    expect(machine.value.state).toEqual({ "On": 1 });
    machine.next("increment");
    expect(machine.value.state).toEqual({ "On": 2 });
    machine.next("flick");
    expect(machine.value.state).toEqual("Off");
    machine.next("flick");
    expect(machine.value.state).toEqual({ "On": 0 });
  });
});

describe("Menu/Exclusive Value string mapper", () => {
  function* Menu() {
    function onMenuItem(id: string) {
      return on(id, map((current: string) => current === id ? "" : id as string))
    }
    yield onMenuItem("file");
    yield onMenuItem("edit");
    yield onMenuItem("view");
    yield on("close", map(() => ""));

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
  });
});

describe("Menu/Exclusive Value symbol mapper", () => {
  const Closed = Symbol("closed");
  const File = Symbol("file");
  const Edit = Symbol("edit");
  const View = Symbol("view");
  function* Menu() {
    function onMenuItem(id: symbol) {
      return on(id, map((current: symbol) => current === id ? Closed : id as symbol))
    }
    yield onMenuItem(File);
    yield onMenuItem(Edit);
    yield onMenuItem(View);
    yield on("close", map(() => Closed as symbol));

    return Closed;
  }

  test("sending events", () => {
    const machine = start(Menu);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(Closed);
    machine.next(File);
    expect(machine.value.state).toEqual(File);
    machine.next("close");
    expect(machine.value.state).toEqual(Closed);
    machine.next(File);
    expect(machine.value.state).toEqual(File);
    machine.next(File);
    expect(machine.value.state).toEqual(Closed);
    machine.next(File);
    expect(machine.value.state).toEqual(File);
    machine.next(Edit);
    expect(machine.value.state).toEqual(Edit);
    machine.next(View);
    expect(machine.value.state).toEqual(View);
    machine.next(Edit);
    expect(machine.value.state).toEqual(Edit);
    machine.next(Edit);
    expect(machine.value.state).toEqual(Closed);
    machine.next("close");
    expect(machine.value.state).toEqual(Closed);
  });
});
