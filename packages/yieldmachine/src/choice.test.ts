import { on, start } from "./index";

describe("it works with a Map", () => {
  let openValue = false;
  function* ToggleExternalState() {
    const checkingOpen = new Map([
      [() => openValue, Open],
      [true as any, Closed],
    ]);

    yield on("toggle", checkingOpen);

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
  })
});
