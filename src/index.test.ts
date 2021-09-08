import { always, compound, cond, entry, exit, on, start } from "./index";

const fetch = jest.fn();
beforeEach(fetch.mockClear);

const finishedLoading = jest.fn();
beforeEach(finishedLoading.mockClear);

const succeeded = jest.fn();
beforeEach(succeeded.mockClear);

describe("Machine with entry and exit actions", () => {
  const someURL = new URL("https://example.org/");
  function fetchData() {
    return fetch(someURL.toString());
  }

  function Loader() {
    function* idle() {
      yield on("FETCH", loading);
    }
    function* loading() {
      yield entry(fetchData);
      yield exit(finishedLoading);
      yield on("SUCCESS", success);
      yield on("FAILURE", failure);
    }
    function* success() {
      yield entry(succeeded);
    }
    function* failure() {
      yield on("RETRY", loading);
    }

    return idle;
  }

  test("creating", () => {
    const loader = start(Loader);
    expect(loader).toBeDefined();
  });

  describe("when fetch succeeds", () => {
    beforeEach(() => {
      fetch.mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader);
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      loader.next("NOOP");
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/");
      expect(transitionResult.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.results).resolves.toEqual({ fetchData: 42 });
      await expect(Promise.resolve(transitionResult)).resolves.toEqual({ fetchData: 42 });
      expect(finishedLoading).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      const transitionResult2 = loader.next("FETCH");
      // expect(transitionResult2.actions).toEqual([]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      await loader.results;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(new Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader);
      expect(loader.current).toEqual("idle");

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");
      expect(transitionResult.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      await expect(loader.results).rejects.toEqual(new Error("Failed!"));
      await expect(Promise.resolve(transitionResult)).rejects.toEqual(
        new Error("Failed!")
      );
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("failure");

      loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);

      loader.next("RETRY");
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(3);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");

      await expect(loader.results).resolves.toEqual({ fetchData: 42 });
      expect(loader.changeCount).toEqual(4);
      expect(loader.current).toEqual("success");
    });
  });
});

describe("Form Field Machine with always()", () => {
  const isValid = jest.fn();
  beforeEach(isValid.mockClear);

  function FormField() {
    function* initial() {
      yield on("CHANGE", editing);
    }
    function* editing() {
      yield on("CHANGE", editing);
      yield on("BLUR", validating);
    }
    function* validating() {
      yield cond(isValid, valid);
      // yield cond(true, invalid);
      yield always(invalid);
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
      expect(formField.current).toEqual("initial");

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("BLUR");
      expect(formField.current).toEqual("valid");
      expect(formField.changeCount).toEqual(3);
    });
  });

  describe("when is invalid", () => {
    beforeEach(() => {
      isValid.mockReturnValue(false);
    });

    test("sending events", () => {
      const formField = start(FormField);
      expect(formField).toBeDefined();
      expect(formField.current).toEqual("initial");

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("BLUR");
      expect(formField.current).toEqual("invalid");
      expect(formField.changeCount).toEqual(3);
    });
  });
});

describe("Hierarchical Traffic Lights Machine", () => {
  // const validate = jest.fn();
  // beforeEach(validate.mockClear);
  const isValid = jest.fn();
  beforeEach(isValid.mockClear);

  function PedestrianFactory() {
    function* walk() {
      yield on("PED_COUNTDOWN", wait);
    }
    function* wait() {
      yield on("PED_COUNTDOWN", stop);
    }
    function* stop() {}
    function* blinking() {}

    return { walk, blinking };
  }
  function* TrafficLights() {
    const { walk, blinking } = PedestrianFactory();

    function* green() {
      yield on("TIMER", yellow);
    }
    function* yellow() {
      yield on("TIMER", red);
    }
    function* red() {
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
    expect(machine.current).toEqual("green");

    machine.next("TIMER");
    expect(machine.current).toEqual("yellow");
    expect(machine.changeCount).toEqual(1);

    machine.next("TIMER");
    expect(machine.current).toEqual({ "red": "walk" });
    // expect(machine.current).toEqual([["red", "walk"]]); // Like a Map key
    // expect(machine.currentMap).toEqual(new Map([["red", "walk"]]));
    expect(machine.changeCount).toEqual(3);

    machine.next("TIMER");
    expect(machine.current).toEqual("green");
    expect(machine.changeCount).toEqual(4);
    
    machine.next("POWER_RESTORED");
    expect(machine.current).toEqual({ "red": "walk" });
    expect(machine.changeCount).toEqual(6);
    
    machine.next("POWER_OUTAGE");
    expect(machine.current).toEqual({ "red": "blinking" });
    expect(machine.changeCount).toEqual(7);
  });
});

describe("Switch", () => {
  function* Switch() {
    function* OFF() {
      yield on("FLICK", ON);
    }
    function* ON() {
      yield on("FLICK", OFF);
    }

    return OFF;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.current).toEqual("OFF");

    machine.next("FLICK");
    expect(machine.current).toEqual("ON");
    expect(machine.changeCount).toEqual(1);

    machine.next("FLICK");
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);
  });
});

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
