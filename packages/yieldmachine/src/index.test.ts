/**
 * @jest-environment jsdom
 */

import {
  compound,
  entry,
  on,
  listenTo,
  send,
  start,
  onceStateChangesTo,
  Yielded,
  expose,
} from "./index";

test("node version " + process.version, () => { });

describe("Switch", () => {
  function Switch() {
    function* Off() {
      yield expose("Off");
      // yield respondsTo("Off");
      // Exposes a set that can be queried for membership.
      // An important detail is that multiple states could expose the same member.
      // yield member("Off");
      // yield fulfill(has("Off"));
      // yield includes("Off");
      // yield primary("Off");
      yield on("flick", On);
    }
    function* On() {
      yield expose("On");
      yield on("flick", Off);
    }

    return Off;
  }

  it("changes state and change count", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Off",
      // query: "Off="
    });

    machine.next("flick");
    expect(machine.value).toMatchObject({
      change: 1,
      state: "On",
    });

    machine.next("flick");
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Off",
    });
  });

  it("emits events to signal", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.eventTarget).toBeInstanceOf(EventTarget);

    const eventListener = jest.fn();
    machine.eventTarget.addEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.value.state).toEqual("On")
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "StateChanged", value: "On" })
    );

    machine.next("flick");
    expect(machine.value.state).toEqual("Off");
    expect(eventListener).toHaveBeenCalledTimes(2);
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "StateChanged", value: "Off" })
    );

    machine.eventTarget.removeEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.value.state).toEqual("On");
    expect(eventListener).toHaveBeenCalledTimes(2);
  });

  it("can produce a promise that resolves when state changes to ON", async () => {
    const machine = start(Switch);

    const whenPromiseResolves = jest.fn();
    const aborter = new AbortController();
    const onPromise = onceStateChangesTo(machine, "On", aborter.signal);
    onPromise.then(whenPromiseResolves);

    await null;
    expect(whenPromiseResolves).toHaveBeenCalledTimes(0);

    machine.next("flick");
    await null;
    expect(whenPromiseResolves).toHaveBeenCalledTimes(1);
  });
});

describe("Switch with symbol messages", () => {
  const flick = Symbol("flick");

  function Switch() {
    function* Off() {
      yield on(flick, On);
    }
    function* On() {
      yield on(flick, Off);
    }

    return Off;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual("Off");

    machine.next(flick);
    expect(machine.value).toMatchObject({
      change: 1,
      state: "On",
    });

    machine.next(flick);
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Off",
    });

    machine.next(Symbol("will be ignored"));
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Off",
    });
  });
});

describe("Switch machine as class", () => {
  class Switch {
    onCount: number;

    constructor() {
      // this.Off = Object.assign(this.Off.bind(this), { name: "Off" });
      this.Off = this.Off.bind(this);
      this.On = this.On.bind(this);

      // Set up any internal state needed.
      this.onCount = 0;

      // return this.Off as any;
    }

    get initial() {
      return this.Off;
    }

    *Off() {
      yield on("FLICK", this.On);
    }
    *On() {
      this.onCount++;
      yield on("FLICK", this.Off);
    }
  }

  test("sending events", () => {
    const instance = new Switch();
    const machine = start(() => instance.initial);
    expect(machine).toBeDefined();
    expect(machine.value).toMatchObject({
      change: 0,
      state: "bound Off",
    });
    expect(instance.onCount).toEqual(0);

    machine.next("FLICK");
    expect(machine.value).toMatchObject({
      change: 1,
      state: "bound On",
    });
    expect(instance.onCount).toEqual(1);

    machine.next("FLICK");
    expect(machine.value).toMatchObject({
      change: 2,
      state: "bound Off",
    });

    machine.next(Symbol("will be ignored"));
    expect(machine.value).toMatchObject({
      change: 2,
      state: "bound Off",
    });
  });
});

describe("Switch with states as classes", () => {
  class StateDefinition {
    static *apply() {
      const instance = new this;
      yield* instance.body();
    }

    *body(): Generator<Yielded, any, unknown> { }
  }

  function Switch() {
    class Off extends StateDefinition {
      *body() {
        yield on("flick", On);
      }
    }
    class On extends StateDefinition {
      *body() {
        yield on("flick", Off);
      }
    }

    return Off;
  }

  test("sending events", () => {
    const machine = start(Switch as any);
    expect(machine).toBeDefined();
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Off",
    });

    machine.next("flick");
    expect(machine.value).toMatchObject({
      change: 1,
      state: "On",
    });

    machine.next("flick");
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Off",
    });

    machine.next(Symbol("will be ignored"));
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Off",
    });
  });
});

describe("Form Field Machine with conditional validation using Map", () => {
  const isValid = jest.fn();
  beforeEach(isValid.mockClear);

  function FormField() {
    const validating = new Map([
      [isValid, valid as any],
      [null, invalid],
    ]);

    function* initial() {
      yield on("CHANGE", editing);
    }
    function* editing() {
      yield on("CHANGE", editing);
      yield on("BLUR", validating);
    }
    function* invalid() {
      yield on("CHANGE", editing);
    }
    function* valid() {
      yield on("CHANGE", editing);
    }

    return initial;
  }

  describe("when is valid", () => {
    beforeEach(() => {
      isValid.mockReturnValue(true);
    });

    test("sending events", () => {
      const formField = start(FormField);
      expect(formField).toBeDefined();
      expect(formField.value).toMatchObject({
        change: 0,
        state: "initial",
      });

      formField.next("CHANGE");
      expect(formField.value).toMatchObject({
        change: 1,
        state: "editing",
      });

      formField.next("CHANGE");
      expect(formField.value).toMatchObject({
        change: 1,
        state: "editing",
      });

      formField.next("BLUR");
      expect(formField.value).toMatchObject({
        change: 2,
        state: "valid",
      });
    });
  });

  describe("when is invalid", () => {
    beforeEach(() => {
      isValid.mockReturnValue(false);
    });

    test("sending events", () => {
      const formField = start(FormField);
      expect(formField).toBeDefined();
      expect(formField.value).toMatchObject({
        change: 0,
        state: "initial",
      });

      formField.next("CHANGE");
      expect(formField.value).toMatchObject({
        change: 1,
        state: "editing",
      });

      formField.next("CHANGE");
      expect(formField.value).toMatchObject({
        change: 1,
        state: "editing",
      });

      formField.next("BLUR");
      expect(formField.value).toMatchObject({
        change: 2,
        state: "invalid",
      });
    });
  });
});

describe("Hierarchical Traffic Lights Machine", () => {
  function PedestrianFactory() {
    function* walk() {
      yield on("PED_COUNTDOWN", wait);
    }
    function* wait() {
      yield on("PED_COUNTDOWN", stop);
    }
    function* stop() { }
    function* blinking() {
      // yield expose("red", "blinking");
    }

    return { walk, blinking };
  }
  function* TrafficLights() {
    const { walk, blinking } = PedestrianFactory();

    function* green() {
      // See also: CustomStateSet
      // yield primitive("green");
      // yield new URLSearchParams("green");
      // yield primary("green");
      yield expose("green");
      // yield member("green");
      yield on("TIMER", yellow);
    }
    function* yellow() {
      yield expose("yellow");
      // yield member("yellow");
      yield on("TIMER", red);
    }
    function* red() {
      yield expose("red");
      // yield member("red");
      yield on("TIMER", green);

      return walk;
    }

    yield on("POWER_OUTAGE", compound(red, blinking));
    yield on("POWER_RESTORED", compound(red));

    return green;
  }

  test("sending events", () => {
    const machine = start(TrafficLights);
    expect(machine).toBeDefined();
    expect(machine.value).toMatchObject({
      change: 0,
      state: "green",
      // query: "green"
    });

    machine.next("TIMER");
    expect(machine.value).toMatchObject({
      change: 1,
      state: "yellow",
    });

    machine.next("TIMER");
    expect(machine.value).toMatchObject({
      change: 3,
      state: { red: "walk" },
    });
    // expect(machine.current).toEqual([["red", "walk"]]); // Like a Map key
    // expect(machine.currentMap).toEqual(new Map([["red", "walk"]]));

    machine.next("TIMER");
    expect(machine.value).toMatchObject({
      change: 4,
      state: "green",
    });

    machine.next("POWER_RESTORED");
    expect(machine.value).toMatchObject({
      change: 6,
      state: { red: "walk" },
    });

    machine.next("POWER_OUTAGE");
    expect(machine.value).toMatchObject({
      change: 7,
      state: { red: "blinking" },
    });
  });
});

// describe("Parallel", () => {
//   // See: https://twitter.com/StateML_org/status/1445502469497188362

//   function* FileManager() {
//     function* upload() {
//       function* idle() {}
//       function* pending() {}
//       function* playground() {}

//     }
//   }

//   it("can run", () => {
//     const machine = start(Example);
//     expect(machine.value.state).toEqual({ tooling: { viz:} })
//   })
// });

/*describe("Counter", () => {
  function* Counter() {
    function* initial() {
      yield entry(function counter() { return 0 });
    }
    function* positive() {
      yield entry(function counter(n) {
        console.log({ n });
        return 1
      });
      // yield on("INCREMENT", action(function counter(n) { return n + 1 }));
    }

    // yield association(function *(events) {
    //   let n = 0;
    //   yield n;

    //   for (const event of events()) {
    //     if (event.type === "INCREMENT") {
    //       n += 1;
    //       yield n;
    //     }
    //   }
    // })

    yield on("RESET", compound(initial));
    yield on("INCREMENT", compound(positive));

    // const counter = yield reducer("counter", 0, n => n + 1);
    // const counter = yield reducer(0, {
    //   increment: n => n + 1,
    //   reset: () => 0
    // });

    // yield on("INCREMENT", counter.increment);
    // yield on("RESET", counter.reset);

    //////////

    const Counter = yield atom(0);
    yield output("counter", Counter);
    // yield output("counter", Counter(n => n));
    // yield output("counter", Counter, n => n);

    // const Counter = yield atom(function counter() {
    //   return 0;
    // });

    // const { increment, reset } = (yield atom(function counter() {
    //   return 0;
    // }))({ increment: (n) => n + 1, reset: () => 0 });


    yield on("INCREMENT", Counter(n => n + 1));
    yield on("RESET", Counter(0));

    // yield on("INCREMENT", counter(n => n + 1));
    // yield on("RESET", counter(() => 0));

    return initial;
  }

  test("sending events", () => {
    const machine = start(Counter);
    expect(machine.current).toEqual("initial");
    expect(machine.results).resolves.toEqual({ counter: 0 });

    machine.next("INCREMENT");
    expect(machine.current).toEqual("positive");
    expect(machine.changeCount).toEqual(1);
    expect(machine.results).resolves.toEqual({ counter: 1 });

    machine.next("INCREMENT");
    expect(machine.current).toEqual("positive");
    expect(machine.changeCount).toEqual(1);
    expect(machine.results).resolves.toEqual({ counter: 1 });

    machine.next("RESET");
    expect(machine.current).toEqual("initial");
    expect(machine.changeCount).toEqual(2);
    expect(machine.results).resolves.toEqual({ counter: 0 });


  });
});*/
