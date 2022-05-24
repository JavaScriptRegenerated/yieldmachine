import { choice, on, start } from "./index";

describe("toggle syncing from external state", () => {
  let openValue = false;
  function* ToggleExternalState() {
    const checkingOpen = new Map([
      [() => openValue, Open],
      [true as any, Closed],
    ]);

    yield on("toggle", choice(checkingOpen));

    function* Closed() {}
    function* Open() {}

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
          [true as any, invalid],
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
