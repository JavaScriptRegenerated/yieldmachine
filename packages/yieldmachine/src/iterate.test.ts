/**
 * @jest-environment jsdom
 */

import { on, iterate, map, expose } from "./index";

describe("Switch", () => {
  function Switch() {
    function* Off() {
      yield expose("Off");
      yield on("flick", On);
    }
    function* On() {
      yield expose("On");
      yield on("flick", Off);
    }

    return Off;
  }

  it("changes state and change count", () => {
    const iterator = iterate(Switch);

    const i1 = iterator.next();
    expect(i1.value.state).toEqual("Off");
    expect(i1.value.change).toEqual(0);
    expect(i1.value.query).toEqual("Off=");
    expect(i1.done).toBe(false);
    
    const i2 = iterator.next("flick");
    expect(i2.value.state).toEqual("On");
    expect(i2.value.change).toEqual(1);
    expect(i2.value.query).toEqual("On=");
    expect(i2.done).toBe(false);

    const i3 = iterator.next("flick");
    expect(i3.value.state).toEqual("Off");
    expect(i3.value.change).toEqual(2);
    expect(i3.value.query).toEqual("Off=");
    expect(i3.done).toBe(false);

    const i4 = iterator.next("flick");
    expect(i4.value.state).toEqual("On");
    expect(i4.value.change).toEqual(3);
    expect(i4.value.query).toEqual("On=");
    expect(i4.done).toBe(false);
    
    const i5 = iterator.next("unknown");
    expect(i5.value.state).toEqual("On");
    expect(i5.value.change).toEqual(3);
    expect(i5.value.query).toEqual("On=");
    expect(i5.done).toBe(false);
  });
});

describe("Toggle Flag boolean map callback", () => {
  function* Toggle() {
    // yield expose(map((current: boolean) => current ? "flag" : null))
    // yield expose("flag", map((current: boolean) => current));
    yield expose("flag");

    yield on(
      "toggle",
      map((current: boolean) => !current)
    );

    return false;
  }

  test("sending events", () => {
    const iterator = iterate(Toggle);

    const i1 = iterator.next();
    expect(i1.value.state).toEqual(false);
    expect(i1.value.change).toEqual(0);
    // expect(i1.value.query).toEqual("");
    expect(i1.done).toBe(false);

    const i2 = iterator.next("toggle");
    expect(i2.value.state).toEqual(true);
    expect(i2.value.change).toEqual(1);
    expect(i2.done).toBe(false);

    const i3 = iterator.next("toggle");
    expect(i3.value.state).toEqual(false);
    expect(i3.value.change).toEqual(2);
    expect(i3.done).toBe(false);
  });
});

describe("Counter increment map callback", () => {
  function* Counter() {
    yield on(
      "increment",
      map((n: number) => n + 1)
    );

    return 0;
  }

  test("sending events", () => {
    const iterator = iterate(Counter);

    const i1 = iterator.next();
    expect(i1.value.state).toEqual(0);
    expect(i1.value.change).toEqual(0);
    expect(i1.done).toBe(false);

    const i2 = iterator.next("increment");
    expect(i2.value.state).toEqual(1);
    expect(i2.value.change).toEqual(1);
    expect(i2.done).toBe(false);

    const i3 = iterator.next("increment");
    expect(i3.value.state).toEqual(2);
    expect(i3.value.change).toEqual(2);
    expect(i3.done).toBe(false);
  });
});

describe("Counter number with multiple events", () => {
  function* Counter() {
    yield on(
      "+1",
      map((n: number) => n + 1)
    );
    yield on(
      "+10",
      map((n: number) => n + 10)
    );

    return 0;
  }

  test("sending events", () => {
    const iterator = iterate(Counter);

    const i1 = iterator.next();
    expect(i1.value.state).toEqual(0);
    expect(i1.value.change).toEqual(0);
    expect(i1.done).toBe(false);

    const i2 = iterator.next("+1");
    expect(i2.value.state).toEqual(1);
    expect(i2.value.change).toEqual(1);
    expect(i2.done).toBe(false);

    const i3 = iterator.next("+1");
    expect(i3.value.state).toEqual(2);
    expect(i3.value.change).toEqual(2);
    expect(i3.done).toBe(false);

    const i4 = iterator.next("+10");
    expect(i4.value.state).toEqual(12);
    expect(i4.value.change).toEqual(3);
    expect(i4.done).toBe(false);
  });
});
