/**
 * @jest-environment jsdom
 */

import {
  always,
  compound,
  cond,
  entry,
  exit,
  on,
  listenTo,
  send,
  start,
  accumulate,
  onceStateChangesTo,
  readContext,
} from "./index";

test("node version " + process.version, () => { });

function useEach(work: () => () => void) {
  let cleanup: null | (() => void) = null;
  beforeEach(() => {
    cleanup = work();
  })
  afterEach(() => {
    cleanup?.call(null);
  });
}

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
      expect(loader.value).toMatchObject({
        change: 0,
        state: "idle",
        actions: []
      });
      expect(loader.value).toBe(loader.value);
      expect(loader.changeCount).toEqual(0);
      expect(loader.current).toEqual("idle");

      const valueA = loader.value;

      loader.next("NOOP");
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);
      expect(loader.value).toBe(valueA);

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/");
      expect(transitionResult.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [
          { type: "entry", f: fetchData }
        ]
      });
      expect(loader.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [
          { type: "entry", f: fetchData }
        ]
      });
      expect(loader.value).not.toBe(valueA);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.value.results).resolves.toEqual({ fetchData: 42 });
      await expect(Promise.resolve(transitionResult.value.results)).resolves.toEqual({
        fetchData: 42,
      });
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
      expect(loader.value).toMatchObject({
        change: 0,
        state: "idle",
        actions: []
      });

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");
      expect(transitionResult.value.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [
          { type: "entry", f: fetchData },
        ]
      });

      // await expect(loader.value.results).rejects.toEqual(new Error("Failed!"));
      await expect(loader.value.results).rejects.toBeInstanceOf(Error);
      await expect(Promise.resolve(transitionResult.value.results)).rejects.toEqual(
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

describe.skip("Fetch with abort signal", () => {
  const someURL = new URL("https://example.org/");
  function fetchData() {
    return fetch(someURL.toString());
  }

  function Loader() {
    const aborterKey = Symbol("aborter");
    // yield register(aborterKey, () => new AbortController());
    // yield register(function aborter() { return new AbortController() });

    function* idle() {
      yield on("FETCH", loading);
    }
    function* loading() {
      // yield entry(aborterKey);

      yield entry(fetchData);
      yield exit(finishedLoading);
      yield on("SUCCESS", success);
      yield on("FAILURE", failure);
      // yield forward(AbortController.prototype.abort, aborter);
      // yield forward("abort", aborter);
      // yield forward("CANCEL", aborter);
      // yield forward("CANCEL", aborterKey);
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
      expect(transitionResult.value.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.results).resolves.toEqual({ fetchData: 42 });
      await expect(Promise.resolve(transitionResult)).resolves.toEqual({
        fetchData: 42,
      });
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
      expect(transitionResult.value.actions).toEqual([
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
    function* stop() { }
    function* blinking() { }

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
    expect(machine.current).toEqual({ red: "walk" });
    // expect(machine.current).toEqual([["red", "walk"]]); // Like a Map key
    // expect(machine.currentMap).toEqual(new Map([["red", "walk"]]));
    expect(machine.changeCount).toEqual(3);

    machine.next("TIMER");
    expect(machine.current).toEqual("green");
    expect(machine.changeCount).toEqual(4);

    machine.next("POWER_RESTORED");
    expect(machine.current).toEqual({ red: "walk" });
    expect(machine.changeCount).toEqual(6);

    machine.next("POWER_OUTAGE");
    expect(machine.current).toEqual({ red: "blinking" });
    expect(machine.changeCount).toEqual(7);
  });
});

describe("Switch", () => {
  function Switch() {
    function* Off() {
      yield on("flick", On);
    }
    function* On() {
      yield on("flick", Off);
    }

    return Off;
  }

  it("changes state and change count", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.current).toEqual("OFF");

    machine.next("flick");
    expect(machine.current).toEqual("ON");
    expect(machine.changeCount).toEqual(1);

    machine.next("flick");
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);
  });

  it("emits events to signal", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.eventTarget).toBeInstanceOf(EventTarget);

    const eventListener = jest.fn();
    machine.eventTarget.addEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.current).toEqual("ON");
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener).toHaveBeenLastCalledWith(expect.objectContaining({ type: "StateChanged", value: "ON" }));

    machine.next("flick");
    expect(machine.current).toEqual("OFF");
    expect(eventListener).toHaveBeenCalledTimes(2);
    expect(eventListener).toHaveBeenLastCalledWith(expect.objectContaining({ type: "StateChanged", value: "OFF" }));

    machine.eventTarget.removeEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.current).toEqual("ON");
    expect(eventListener).toHaveBeenCalledTimes(2);
  });

  it("can produce a promise that resolves when state changes to ON", async () => {
    const machine = start(Switch);

    const whenPromiseResolves = jest.fn();
    const aborter = new AbortController();
    const onPromise = onceStateChangesTo(machine, "ON", aborter.signal)
    onPromise.then(whenPromiseResolves)

    await null;
    expect(whenPromiseResolves).toHaveBeenCalledTimes(0);

    machine.next("flick");
    await null;
    expect(whenPromiseResolves).toHaveBeenCalledTimes(1);
  })
});

describe("Switch with symbol messages", () => {
  const FLICK = Symbol("FLICK");

  function Switch() {
    function* OFF() {
      yield on(FLICK, ON);
    }
    function* ON() {
      yield on(FLICK, OFF);
    }

    return OFF;
  }

  test("sending events", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.current).toEqual("OFF");

    machine.next(FLICK);
    expect(machine.current).toEqual("ON");
    expect(machine.changeCount).toEqual(1);

    machine.next(FLICK);
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);

    machine.next(Symbol("will be ignored"));
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);
  });
});

describe.skip("Switch as class", () => {
  class Switch {
    constructor() {
      // Set up any internal state needed.
      return this.Off as any;
    }

    get initial() {
      return this.Off;
    }

    *Off() {
      yield on("FLICK", this.On);
    }
    *On() {
      yield on("FLICK", this.Off);
    }
  }

  test("sending events", () => {
    const machine = start(() => new Switch() as any);
    expect(machine).toBeDefined();
    expect(machine.current).toEqual("OFF");

    machine.next("FLICK");
    expect(machine.current).toEqual("ON");
    expect(machine.changeCount).toEqual(1);

    machine.next("FLICK");
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);

    machine.next(Symbol("will be ignored"));
    expect(machine.current).toEqual("OFF");
    expect(machine.changeCount).toEqual(2);
  });
});

describe("Wrapping navigator online as a state machine", () => {
  function* OfflineStatus() {
    yield listenTo(window, ["online", "offline"]);
    yield on("online", compound(Online));
    yield on("offline", compound(Offline));

    function* Online() { }
    function* Offline() { }

    return function* Pending() {
      yield cond(navigator.onLine, Online);
      yield always(Offline);
    }
  }

  describe("when online", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      return () => spy.mockRestore();
    });

    it("is immediately in Online state", () => {
      const machine = start(OfflineStatus);
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(0);
    });

    it("reacts to offline & online events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event('offline'))
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(1);

      window.dispatchEvent(new Event('online'))
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(2);
    });
  });

  describe("when offline", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      return () => spy.mockRestore();
    });

    it("is immediately in Offline state", () => {
      const machine = start(OfflineStatus);
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(0);
    });

    it("reacts to online & offline events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event('online'))
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(1);

      window.dispatchEvent(new Event('offline'))
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(2);
    });
  });
});

describe("Wrapping AbortController as a state machine", () => {
  function AbortSender(controller: AbortController) {
    function* Initial() {
      yield cond(controller.signal.aborted, Aborted);
      yield on("abort", Aborted);
    }
    function* Aborted() {
      // yield entry(controller.abort.bind(controller));
      yield entry(function abort() {
        controller.abort();
      });
    }

    return Initial;
  }

  function AbortListener(controller: AbortController) {
    function* Initial() {
      if (controller.signal.aborted) {
        yield always(Aborted);
      } else {
        yield on("abort", Aborted);
        yield listenTo(controller.signal, ["abort"]);
      }
    }
    function* Aborted() { }

    return Initial;
  }

  function AbortOwner() {
    // const controllerKey = Symbol('AbortController');
    function controller() {
      return new AbortController();
    }

    function* Initial() {
      yield entry(controller);
      yield on("abort", Aborted);
    }
    function* Aborted() {
      yield entry(send(controller, "abort", []));
    }

    return Initial;
  }

  describe("AbortSender", () => {
    it("is already aborted if passed controller is aborted", () => {
      const aborter = new AbortController();
      aborter.abort();
      const machine = start(AbortSender.bind(null, aborter));
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(0);
    });

    it("tells AbortController to abort", () => {
      const aborter = new AbortController();
      const machine = start(AbortSender.bind(null, aborter));

      expect(machine.current).toEqual("Initial");
      expect(machine.changeCount).toEqual(0);

      expect(aborter.signal.aborted).toBe(false);

      machine.next("abort");
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(1);

      expect(aborter.signal.aborted).toBe(true);
    });
  });

  describe("AbortListener", () => {
    it("is already aborted if passed controller is aborted", () => {
      const aborter = new AbortController();
      aborter.abort();
      const machine = start(AbortListener.bind(null, aborter));
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(0);
    });

    it("listens when AbortController aborts", () => {
      const aborter = new AbortController();
      const machine = start(AbortListener.bind(null, aborter));

      expect(machine.current).toEqual("Initial");
      expect(machine.changeCount).toEqual(0);
      expect(aborter.signal.aborted).toBe(false);

      aborter.abort();
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(1);
    });
  });

  describe("AbortOwner", () => {
    it.skip("aborts", async () => {
      const machine = start(AbortOwner);

      expect(machine.current).toEqual("Initial");
      expect(machine.changeCount).toEqual(0);

      const { controller } = await machine.results as { controller: AbortController };
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);

      machine.next("abort");
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(1);

      expect(controller.signal.aborted).toBe(true);
    });
  });
});

describe("Button click", () => {
  function ButtonClickListener(button: HTMLButtonElement) {
    function* Initial() {
      yield on("click", Clicked);
      yield listenTo(button, ["click"]);
    }
    function* Clicked() { }

    return Initial;
  }

  it("listens when button clicks", () => {
    const button = document.createElement('button');
    const machine = start(ButtonClickListener.bind(null, button));

    expect(machine.current).toEqual("Initial");
    expect(machine.changeCount).toEqual(0);

    button.click();
    expect(machine.current).toEqual("Clicked");
    expect(machine.changeCount).toEqual(1);

    button.click();
    expect(machine.current).toEqual("Clicked");
    expect(machine.changeCount).toEqual(1);
  });
});

describe("Hovering machine", () => {
  const pointerDownListener = jest.fn();
  beforeEach(pointerDownListener.mockClear);
  const enteredUp = jest.fn();
  beforeEach(enteredUp.mockClear);
  const exitedUp = jest.fn();
  beforeEach(exitedUp.mockClear);
  const enteredDown = jest.fn();
  beforeEach(enteredDown.mockClear);
  const enteredDragging = jest.fn();
  beforeEach(enteredDragging.mockClear);
  const enteredClicked = jest.fn();
  beforeEach(enteredClicked.mockClear);
  const enteredDropped = jest.fn();
  beforeEach(enteredDropped.mockClear);

  function DraggableMachine(el: HTMLElement) {
    let dragOrigin: null | { x: number; y: number } = null;

    function* Up() {
      yield entry(({ signal }) => {
        function handler(event: PointerEvent) {
          dragOrigin = { x: event.clientX, y: event.clientY };
          pointerDownListener();
        }
        el.addEventListener("pointerdown", handler, { signal });
        // Have to do this as it seems jsdom doesn’t support passing a signal.
        signal.addEventListener('abort', () => {
          el.removeEventListener('pointerdown', handler);
        }, { once: true });
      });
      yield entry(enteredUp);
      yield exit(exitedUp);
      yield listenTo(el, ["pointerdown"]);
      yield on("pointerdown", Down);

    }
    function* Down() {
      yield entry(enteredDown);
      yield listenTo(el, ["pointermove", "pointerup"]);
      yield on("pointermove", Dragging);
      yield on("pointerup", Clicked);
    }
    function* Dragging() {
      yield entry(enteredDragging);
      yield entry(({ signal }) => {
        function handler(event: PointerEvent) {
          if (dragOrigin == null) return;

          const deltaX = event.clientX - dragOrigin.x;
          const deltaY = event.clientY - dragOrigin.y;
          el.style.left = `${deltaX}px`;
          el.style.top = `${deltaY}px`;
        }
        el.addEventListener("pointermove", handler, { signal });
        signal.addEventListener('abort', () => {
          el.removeEventListener('pointermove', handler);
        }, { once: true });
      });
      yield listenTo(el, ["pointerup"]);
      yield on("pointerup", Dropped);

      // const downEvent = yield lastReceived("pointerdown");
      // const moveEvent = yield lastReceived("pointermove");
      // yield effect(() => {
      //   const deltaX = moveEvent.clientX - downEvent.clientX;
      //   const deltaY = moveEvent.clientY - downEvent.clientY;
      //   el.style.left = `${deltaX}px`;
      //   el.style.top = `${deltaY}px`;
      // })
    }
    function* Clicked() {
      yield entry(enteredClicked);
      yield* Up();
    }
    function* Dropped() {
      yield entry(enteredDropped);
      yield* Up();
    }

    return Up;
  }

  it.only("works with clicking", () => {
    const button = document.createElement('button');
    const machine = start(DraggableMachine.bind(null, button));

    expect(machine.value).toMatchObject({ state: "Up", change: 0 });
    expect(pointerDownListener).toHaveBeenCalledTimes(0);
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(0);
    expect(enteredDown).toHaveBeenCalledTimes(0);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerdown'));
    expect(machine.value).toMatchObject({ state: "Down", change: 1 });
    expect(pointerDownListener).toHaveBeenCalledTimes(1);
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerup'));
    expect(machine.value).toMatchObject({ state: "Clicked", change: 2 });
    expect(pointerDownListener).toHaveBeenCalledTimes(1);
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerdown'));
    expect(machine.value).toMatchObject({ state: "Down", change: 3 });
    expect(pointerDownListener).toHaveBeenCalledTimes(2);
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerup'));
    expect(machine.value).toMatchObject({ state: "Clicked", change: 4 });
    expect(pointerDownListener).toHaveBeenCalledTimes(2);
    expect(enteredUp).toHaveBeenCalledTimes(3);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(2);
    expect(enteredDropped).toHaveBeenCalledTimes(0);
  });

  it("works with dragging", () => {
    const button = document.createElement('button');
    const machine = start(DraggableMachine.bind(null, button));

    expect(machine.value).toMatchObject({ state: "Up", change: 0 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(0);
    expect(enteredDown).toHaveBeenCalledTimes(0);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerdown'));
    expect(machine.value).toMatchObject({ state: "Down", change: 1 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointermove'));
    expect(machine.value).toMatchObject({ state: "Dragging", change: 2 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointermove'));
    expect(machine.value).toMatchObject({ state: "Dragging", change: 2 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent('pointerup'));
    expect(machine.value).toMatchObject({ state: "Dropped", change: 3 });
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(1);

    button.dispatchEvent(new MouseEvent('pointerdown'));
    expect(machine.value).toMatchObject({ state: "Down", change: 4 });
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(1);

    button.dispatchEvent(new MouseEvent('pointerup'));
    expect(machine.value).toMatchObject({ state: "Clicked", change: 5 });
    expect(enteredUp).toHaveBeenCalledTimes(3);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(1);
  });
});

describe("FIXME: Key shortcut click highlighting too many event listeners bug", () => {
  function KeyShortcutListener(el: HTMLElement) {
    function* Open() {
      yield on("keydown", OpenCheckingKey);
      yield listenTo(el, ["keydown"]);
    }
    function* OpenCheckingKey() {
      const event: KeyboardEvent = yield readContext("event");
      yield cond(event.key === 'Escape', Closed);
      // yield revert();
      yield always(Open);
    }
    function* Closed() {
      yield on("keydown", ClosedCheckingKey);
      yield listenTo(el, ["keydown"]);
    }
    function* ClosedCheckingKey() {
      const event: KeyboardEvent = yield readContext("event");
      yield cond(event.key === 'Enter', Open);
      // yield revert();
      yield always(Closed);
    }

    return Closed;
  }

  it("listens when keys are pressed", () => {
    // FIXME: there’s lots of event listeners being created!
    const aborter = new AbortController();
    const input = document.createElement('input');
    const machine = start(KeyShortcutListener.bind(null, input), { signal: aborter.signal });
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 0,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 2,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 4,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 6,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 8,
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 10,
    });

    aborter.abort();
  });
});

describe("Key shortcut cond reading event", () => {
  function KeyShortcutListener(el: HTMLElement) {
    function* Open() {
      yield listenTo(el, ["keydown"]);
      yield on(
        "keydown",
        cond((readContext) => {
          const event = readContext("event") as KeyboardEvent;
          return event.key === "Escape";
        }, Closed)
      );
    }
    function* Closed() {
      yield listenTo(el, ["keydown"]);
      yield on(
        "keydown",
        cond((readContext) => {
          const event = readContext("event") as KeyboardEvent;
          return event.key === "Enter";
        }, Open)
      );
    }

    return Closed;
  }

  it("listens when keys are pressed", () => {
    const aborter = new AbortController();
    const input = document.createElement('input');
    const machine = start(KeyShortcutListener.bind(null, input), { signal: aborter.signal });

    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(2);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(2);

    aborter.abort();
  });
});

describe("accumulate()", () => {
  const messagesKey = Symbol("messages");

  function* Machine(eventTarget: EventTarget) {
    // yield on(new Map([["type", "error"], ["readyState", EventSource.CLOSED]]), Closed);
    yield listenTo(eventTarget, ["error"]);
    yield on("error", compound(Closed));

    function* Open() {
      yield listenTo(eventTarget, ["message"]);
      yield accumulate("message", messagesKey);
      // TODO:
      // yield accumulate("message", messagesKey, function*(event, previous) {
      //   if (previous) {
      //     yield *previous;
      //   }
      //   yield event;
      // });
    }
    function* Closed() { }

    return function* Connecting() {
      yield listenTo(eventTarget, ["open"]);
      yield on("open", Open);
    }
  }

  it("appends dispatched events to array", () => {
    const eventTarget = (new AbortController()).signal;
    const machine = start(Machine.bind(null, eventTarget));

    const stateChangedListener = jest.fn();
    const accumulationsChangedListener = jest.fn();
    machine.eventTarget.addEventListener("StateChanged", stateChangedListener);
    machine.eventTarget.addEventListener("AccumulationsChanged", accumulationsChangedListener);

    expect(machine.current).toEqual("Connecting");

    eventTarget.dispatchEvent(new Event("open"));
    expect(machine.current).toEqual("Open");
    expect(machine.accumulations).toEqual(new Map());
    expect(stateChangedListener).toHaveBeenCalledTimes(1);
    expect(stateChangedListener).toHaveBeenLastCalledWith(expect.objectContaining({ type: "StateChanged" }));
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(0);

    const event1 = new Event("message");
    const event2 = new Event("message");
    const event3 = new Event("message");
    const event4 = new Event("message");

    eventTarget.dispatchEvent(event1);
    expect(machine.current).toEqual("Open");
    expect(machine.accumulations).toEqual(new Map([[messagesKey, [event1]]]));
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(1);
    expect(accumulationsChangedListener).toHaveBeenLastCalledWith(expect.objectContaining({ type: "AccumulationsChanged" }));

    eventTarget.dispatchEvent(event2);
    expect(machine.current).toEqual("Open");
    expect(machine.accumulations).toEqual(new Map([[messagesKey, [event1, event2]]]));
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(2);
    expect(accumulationsChangedListener).toHaveBeenLastCalledWith(expect.objectContaining({ type: "AccumulationsChanged" }));

    eventTarget.dispatchEvent(event3);
    expect(machine.current).toEqual("Open");
    expect(machine.accumulations).toEqual(new Map([[messagesKey, [event1, event2, event3]]]));
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(3);

    eventTarget.dispatchEvent(new Event("error"));
    expect(machine.current).toEqual("Closed");
    expect(machine.accumulations).toEqual(new Map());
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(3);

    eventTarget.dispatchEvent(event4);
    expect(machine.current).toEqual("Closed");
    expect(machine.accumulations).toEqual(new Map());
    expect(accumulationsChangedListener).toHaveBeenCalledTimes(3);

    machine.eventTarget.removeEventListener("StateChanged", stateChangedListener);
    machine.eventTarget.removeEventListener("AccumulationsChanged", accumulationsChangedListener);
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
