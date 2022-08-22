/**
 * @jest-environment jsdom
 */

import { choice, compound, listenTo, on, start } from "./index";

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

    const checkingOpen = choice(new Map([
      [() => openValue, Open],
      [null, Closed],
    ]));
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

describe("Wrapping navigator online as a state machine", () => {
  function* OfflineStatus() {
    yield listenTo(window, ["online", "offline"]);
    yield on("online", compound(Online));
    yield on("offline", compound(Offline));

    function* Online() {}
    function* Offline() {}

    return choice(new Map([
      [() => navigator.onLine, Online],
      [null, Offline],
    ]));
  }

  describe("when online", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      return () => spy.mockRestore();
    });

    it("is immediately in Online state", () => {
      const machine = start(OfflineStatus);
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(0);
    });

    it("reacts to offline & online events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event("offline"));
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(1);

      window.dispatchEvent(new Event("online"));
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(2);
    });
  });

  describe("when offline", () => {
    useEach(() => {
      const spy = jest.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      return () => spy.mockRestore();
    });

    it("is immediately in Offline state", () => {
      const machine = start(OfflineStatus);
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(0);
    });

    it("reacts to online & offline events", () => {
      const machine = start(OfflineStatus);
      window.dispatchEvent(new Event("online"));
      expect(machine.current).toEqual("Online");
      expect(machine.changeCount).toEqual(1);

      window.dispatchEvent(new Event("offline"));
      expect(machine.current).toEqual("Offline");
      expect(machine.changeCount).toEqual(2);
    });
  });
});
