/**
 * @jest-environment jsdom
 */

import {
  cond,
  entry,
  exit,
  on,
  listenTo,
  start,
  ReadContextCallback,
  send
} from "./index";

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
    function* Aborted() { }

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
      expect(machine.value).toMatchObject({
        change: 0,
        state: "Aborted",
      });
    });

    it("tells AbortController to abort", () => {
      const aborter = new AbortController();
      const machine = start(AbortForwarder.bind(null, aborter));

      expect(machine.value).toMatchObject({
        change: 0,
        state: "Initial",
      });

      expect(aborter.signal.aborted).toBe(false);

      machine.next("abort");
      expect(machine.value).toMatchObject({
        change: 1,
        state: "Aborted",
      });

      expect(aborter.signal.aborted).toBe(true);
    });
  });

  describe("AbortListener", () => {
    it("is already aborted if passed controller is aborted", () => {
      const aborter = new AbortController();
      aborter.abort();
      const machine = start(AbortListener.bind(null, aborter));
      expect(machine.value).toMatchObject({
        change: 0,
        state: "Aborted",
      });
    });

    it("listens when AbortController aborts", () => {
      const aborter = new AbortController();
      const machine = start(AbortListener.bind(null, aborter));

      expect(machine.value).toMatchObject({
        change: 0,
        state: "Initial",
      });
      expect(aborter.signal.aborted).toBe(false);

      aborter.abort();
      expect(machine.value).toMatchObject({
        change: 1,
        state: "Aborted",
      });
    });
  });

  describe("AbortOwner", () => {
    it.skip("aborts", async () => {
      const machine = start(AbortOwner);

      expect(machine.value).toMatchObject({
        change: 0,
        state: "Initial",
      });

      const { controller } = (await machine.results) as {
        controller: AbortController;
      };
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);

      machine.next("abort");
      expect(machine.value).toMatchObject({
        change: 1,
        state: "Aborted",
      });

      expect(controller.signal.aborted).toBe(true);
    });
  });
});