/**
 * @jest-environment jsdom
 */

import { on, iterate } from "./index";

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
    const iterator = iterate(Switch);

    const i1 = iterator.next();
    expect(i1.value.state).toEqual("Off");
    expect(i1.value.change).toEqual(0);
    expect(i1.done).toBe(false);

    const i2 = iterator.next("flick");
    expect(i2.value.state).toEqual("On");
    expect(i2.value.change).toEqual(1);
    expect(i2.done).toBe(false);

    const i3 = iterator.next("flick");
    expect(i3.value.state).toEqual("Off");
    expect(i3.value.change).toEqual(2);
    expect(i3.done).toBe(false);

    const i4 = iterator.next("flick");
    expect(i4.value.state).toEqual("On");
    expect(i4.value.change).toEqual(3);
    expect(i4.done).toBe(false);

    const i5 = iterator.next("unknown");
    expect(i5.value.state).toEqual("On");
    expect(i5.value.change).toEqual(3);
    expect(i5.done).toBe(false);
  });
});
