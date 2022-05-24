import { accumulate, compound, listenTo, on, start } from "./index";

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
