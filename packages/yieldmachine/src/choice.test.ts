/**
 * @jest-environment jsdom
 */

import {
  choice,
  jumpTo,
  listenTo,
  on,
  ReadContextCallback,
  start,
} from "./index";

function useEach(work: () => () => void) {
  let cleanup: null | (() => void) = null;
  beforeEach(() => {
    cleanup = work();
  });
  afterEach(() => {
    cleanup?.call(null);
  });
}

describe("toggle syncing from external state", () => {
  let openValue = false;
  function* ToggleExternalState() {
    function* Closed() {}
    function* Open() {}

    const checkingOpen = choice(
      new Map([
        [() => openValue, Open],
        [null, Closed],
      ])
    );
    yield on("toggle", checkingOpen);

    return checkingOpen;
  }

  test("sending events", () => {
    openValue = false;
    const machine = start(ToggleExternalState);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual("Closed");
    machine.next("toggle");
    expect(machine.value.state).toEqual("Closed");
    openValue = true;
    expect(machine.value.state).toEqual("Closed");
    machine.next("toggle");
    expect(machine.value.state).toEqual("Open");
    machine.next("toggle");
    expect(machine.value.state).toEqual("Open");
    openValue = false;
    expect(machine.value.state).toEqual("Open");
    machine.next("toggle");
    expect(machine.value.state).toEqual("Closed");
  });
});

describe("Form Field Machine with external validation", () => {
  const isValid = jest.fn();
  beforeEach(isValid.mockClear);

  function FormField() {
    function* initial() {
      yield on("CHANGE", editing);
    }
    function* editing() {
      yield on("CHANGE", editing);
      yield on(
        "BLUR",
        new Map([
          [isValid, valid],
          [null, invalid],
        ])
      );
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

describe("Wrapping navigator online as a state machine", () => {
  function* OfflineStatus() {
    yield listenTo(window, ["online", "offline"]);
    yield on("online", jumpTo(Online));
    yield on("offline", jumpTo(Offline));

    function* Online() {}
    function* Offline() {}

    return choice(
      new Map([
        [() => navigator.onLine, Online],
        [null, Offline],
      ])
    );

    // return choice(when(() => navigator.onLine, Online), always(Offline));
  }

  describe("when online", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      return () => spy.mockRestore();
    });

    it("is immediately in Online state", () => {
      const machine = start(OfflineStatus);
      expect(machine.value).toMatchObject({
        change: 0,
        state: "Online",
      });
    });

    it("reacts to offline & online events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event("offline"));
      expect(machine.value).toMatchObject({
        change: 1,
        state: "Offline",
      });

      window.dispatchEvent(new Event("online"));
      expect(machine.value).toMatchObject({
        change: 2,
        state: "Online",
      });
    });
  });

  describe("when offline", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      return () => spy.mockRestore();
    });

    it("is immediately in Offline state", () => {
      const machine = start(OfflineStatus);
      expect(machine.value).toMatchObject({
        change: 0,
        state: "Offline",
      });
    });

    it("reacts to online & offline events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event("online"));
      expect(machine.value).toMatchObject({
        change: 1,
        state: "Online",
      });

      window.dispatchEvent(new Event("offline"));
      expect(machine.value).toMatchObject({
        change: 2,
        state: "Offline",
      });
    });
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

    // TODO: wrap in choice(new Map(…))
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
