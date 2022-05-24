import { on, accumulate, start, map } from "./index";

// See: https://components.guide/react+typescript/reducer-patterns

describe("Toggle boolean map callback", () => {
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

// describe("Counter accumulate", () => {
//   const n = Symbol("n");
//   function* Counter() {
//     yield accumulate("increment", n);

//     return 0;
//   }

//   test("sending events", () => {
//     const machine = start(Counter);
//     expect(machine).toBeDefined();
//     expect(machine.value.state[n]).toEqual(0);
//     machine.next("increment");
//     expect(machine.value.state[n]).toEqual(1);
//     machine.next("increment");
//     expect(machine.value.state[n]).toEqual(2);
//   });
// });

// describe("Toggle raw value", () => {
//   const flag = Symbol("flag");
//   function* Counter() {
//     const current: boolean = yield read;
//     yield on("toggle", !current);

//     return false;
//   }

//   test("sending events", () => {
//     const machine = start(Counter);
//     expect(machine).toBeDefined();
//     expect(machine.value.state).toEqual(false);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(true);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(false);
//   });
// });

// describe("Toggle pair", () => {
//   const flag = Symbol("flag");
//   function* Counter() {
//     const currentValue: boolean = yield flag;
//     yield on("toggle", pair(flag, !currentValue));

//     return pair(flag, false);
//   }

//   test("sending events", () => {
//     const machine = start(Counter);
//     expect(machine).toBeDefined();
//     expect(machine.value.state).toEqual(false);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(true);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(false);
//   });
// });

// describe("Toggle Box", () => {
//   const flag = Symbol("flag");
//   const Flag = new Box("flag", false);
//   function* Counter() {
//     const currentValue: boolean = yield Flag;
//     yield on("toggle", Flag(!currentValue));

//     return Flag(false);
//   }

//   test("sending events", () => {
//     const machine = start(Counter);
//     expect(machine).toBeDefined();
//     expect(machine.value.state).toEqual(false);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(true);
//     machine.next("toggle");
//     expect(machine.value.state).toEqual(false);
//   });
// });
