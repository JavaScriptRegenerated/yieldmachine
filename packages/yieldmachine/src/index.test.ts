/**
 * @jest-environment jsdom
 */

import {
  compound,
  cond,
  entry,
  exit,
  on,
  listenTo,
  send,
  start,
  onceStateChangesTo,
  ReadContextCallback,
  Yielded,
} from "./index";

test("node version " + process.version, () => {});

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
    expect(machine.current).toEqual("Off");

    machine.next("flick");
    expect(machine.current).toEqual("On");
    expect(machine.changeCount).toEqual(1);

    machine.next("flick");
    expect(machine.current).toEqual("Off");
    expect(machine.changeCount).toEqual(2);
  });

  it("emits events to signal", () => {
    const machine = start(Switch);
    expect(machine).toBeDefined();
    expect(machine.eventTarget).toBeInstanceOf(EventTarget);

    const eventListener = jest.fn();
    machine.eventTarget.addEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.current).toEqual("On");
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "StateChanged", value: "On" })
    );

    machine.next("flick");
    expect(machine.current).toEqual("Off");
    expect(eventListener).toHaveBeenCalledTimes(2);
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "StateChanged", value: "Off" })
    );

    machine.eventTarget.removeEventListener("StateChanged", eventListener);

    machine.next("flick");
    expect(machine.current).toEqual("On");
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
    expect(machine.current).toEqual("Off");

    machine.next(flick);
    expect(machine.current).toEqual("On");
    expect(machine.changeCount).toEqual(1);

    machine.next(flick);
    expect(machine.current).toEqual("Off");
    expect(machine.changeCount).toEqual(2);

    machine.next(Symbol("will be ignored"));
    expect(machine.current).toEqual("Off");
    expect(machine.changeCount).toEqual(2);
  });
});

describe("Switch machine as class", () => {
  class Switch {
    onCount: number;

    constructor() {
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
    expect(machine.current).toEqual("bound Off");
    expect(instance.onCount).toEqual(0);

    machine.next("FLICK");
    expect(machine.current).toEqual("bound On");
    expect(machine.changeCount).toEqual(1);
    expect(instance.onCount).toEqual(1);

    machine.next("FLICK");
    expect(machine.current).toEqual("bound Off");
    expect(machine.changeCount).toEqual(2);

    machine.next(Symbol("will be ignored"));
    expect(machine.current).toEqual("bound Off");
    expect(machine.changeCount).toEqual(2);
  });
});

describe("Switch with states as classes", () => {
  class StateDefinition {
    static *apply() {
      const instance = new this;
      yield* instance.body();
    }

    *body(): Generator<Yielded, any, unknown> {}
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
    expect(machine.current).toEqual("Off");

    machine.next("flick");
    expect(machine.current).toEqual("On");
    expect(machine.changeCount).toEqual(1);

    machine.next("flick");
    expect(machine.current).toEqual("Off");
    expect(machine.changeCount).toEqual(2);

    machine.next(Symbol("will be ignored"));
    expect(machine.current).toEqual("Off");
    expect(machine.changeCount).toEqual(2);
  });
});

describe("Form Field Machine with always()", () => {
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
      expect(formField.current).toEqual("initial");

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("CHANGE");
      expect(formField.current).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("BLUR");
      expect(formField.current).toEqual("valid");
      expect(formField.changeCount).toEqual(2);
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
      expect(formField.changeCount).toEqual(2);
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

describe("Wrapping AbortController as a state machine", () => {
  function* AbortForwarder(controller: AbortController) {
    function* Initial() {
      yield on("abort", Aborted);
    }
    function* Aborted() {
      // yield entry(controller.abort.bind(controller));
      yield entry(function abort() {
        controller.abort();
      });
    }

    return new Map([
      [() => controller.signal.aborted, Aborted as any],
      [null, Initial],
    ]);
  }

  function* AbortListener(controller: AbortController) {
    function* Initial() {
      yield on("abort", Aborted);
      yield listenTo(controller.signal, ["abort"]);
    }
    function* Aborted() {}

    return new Map([
      [() => controller.signal.aborted, Aborted],
      [null, Initial],
    ]);
  }

  // TODO: remove or do this another way. It could implement Instance!
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
      const machine = start(AbortForwarder.bind(null, aborter));
      expect(machine.current).toEqual("Aborted");
      expect(machine.changeCount).toEqual(0);
    });

    it("tells AbortController to abort", () => {
      const aborter = new AbortController();
      const machine = start(AbortForwarder.bind(null, aborter));

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

      const { controller } = (await machine.results) as {
        controller: AbortController;
      };
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
    function* Clicked() {}

    return Initial;
  }

  it("listens when button clicks", () => {
    const button = document.createElement("button");
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
        signal.addEventListener(
          "abort",
          () => {
            el.removeEventListener("pointerdown", handler);
          },
          { once: true }
        );
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
        // TODO: remove this?
        signal.addEventListener(
          "abort",
          () => {
            el.removeEventListener("pointermove", handler);
          },
          { once: true }
        );
      });
      yield listenTo(el, ["pointerup"]);
      yield on("pointerup", Dropped);

      // const downEvent = yield lastReceived("pointerdown");
      // const moveEvent = yield lastReceived("pointermove");
      // yield effect(() => {
      //   const deltaX = moveEvent().clientX - downEvent().clientX;
      //   const deltaY = moveEvent().clientY - downEvent().clientY;
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

  it("works with clicking", () => {
    const button = document.createElement("button");
    const machine = start(DraggableMachine.bind(null, button));

    expect(machine.value).toMatchObject({ state: "Up", change: 0 });
    expect(pointerDownListener).toHaveBeenCalledTimes(0);
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(0);
    expect(enteredDown).toHaveBeenCalledTimes(0);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerdown"));
    expect(machine.value).toMatchObject({ state: "Down", change: 1 });
    expect(pointerDownListener).toHaveBeenCalledTimes(1);
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerup"));
    expect(machine.value).toMatchObject({ state: "Clicked", change: 2 });
    expect(pointerDownListener).toHaveBeenCalledTimes(1);
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerdown"));
    expect(machine.value).toMatchObject({ state: "Down", change: 3 });
    expect(pointerDownListener).toHaveBeenCalledTimes(2);
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerup"));
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
    const button = document.createElement("button");
    const machine = start(DraggableMachine.bind(null, button));

    expect(machine.value).toMatchObject({ state: "Up", change: 0 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(0);
    expect(enteredDown).toHaveBeenCalledTimes(0);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerdown"));
    expect(machine.value).toMatchObject({ state: "Down", change: 1 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(0);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointermove"));
    expect(machine.value).toMatchObject({ state: "Dragging", change: 2 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointermove"));
    expect(machine.value).toMatchObject({ state: "Dragging", change: 2 });
    expect(enteredUp).toHaveBeenCalledTimes(1);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(0);

    button.dispatchEvent(new MouseEvent("pointerup"));
    expect(machine.value).toMatchObject({ state: "Dropped", change: 3 });
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(1);
    expect(enteredDown).toHaveBeenCalledTimes(1);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(1);

    button.dispatchEvent(new MouseEvent("pointerdown"));
    expect(machine.value).toMatchObject({ state: "Down", change: 4 });
    expect(enteredUp).toHaveBeenCalledTimes(2);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(0);
    expect(enteredDropped).toHaveBeenCalledTimes(1);

    button.dispatchEvent(new MouseEvent("pointerup"));
    expect(machine.value).toMatchObject({ state: "Clicked", change: 5 });
    expect(enteredUp).toHaveBeenCalledTimes(3);
    expect(exitedUp).toHaveBeenCalledTimes(2);
    expect(enteredDown).toHaveBeenCalledTimes(2);
    expect(enteredDragging).toHaveBeenCalledTimes(1);
    expect(enteredClicked).toHaveBeenCalledTimes(1);
    expect(enteredDropped).toHaveBeenCalledTimes(1);
  });
});

describe("Specific keyboard shortcut handler", () => {
  function KeyShortcutListener(el: HTMLElement) {
    function isEscapeKey(readContext: ReadContextCallback) {
      const event = readContext("event");
      return event instanceof KeyboardEvent && event.key === "Escape";
    }
    function isEnterKey(readContext: ReadContextCallback) {
      const event = readContext("event");
      return event instanceof KeyboardEvent && event.key === "Enter";
    }

    const openChoiceKeydown = new Map([
      [isEscapeKey, Closed],
      [null, Open as any],
    ]);
    const closedChoiceKeydown = new Map([
      [isEnterKey, Open],
      [null, Closed as any],
    ]);

    function* Open() {
      yield on("keydown", openChoiceKeydown);
      yield listenTo(el, ["keydown"]);
    }
    function* Closed() {
      yield on("keydown", closedChoiceKeydown);
      yield listenTo(el, ["keydown"]);
    }

    return Closed;
  }

  it("listens when keys are pressed", () => {
    const aborter = new AbortController();
    const input = document.createElement("input");
    const addEventListenerSpy = jest.spyOn(input, "addEventListener");
    const machine = start(KeyShortcutListener.bind(null, input), {
      signal: aborter.signal,
    });
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 0,
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 1,
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 1,
    });

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(machine.value).toMatchObject({
      state: "Open",
      change: 1,
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 2,
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(3);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(machine.value).toMatchObject({
      state: "Closed",
      change: 2,
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(3);

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
    const input = document.createElement("input");
    const machine = start(KeyShortcutListener.bind(null, input), {
      signal: aborter.signal,
    });

    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(0);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(2);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(2);

    aborter.abort();
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
