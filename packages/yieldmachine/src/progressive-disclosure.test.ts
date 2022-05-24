/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import user from "@testing-library/user-event"
import {
  always,
  compound,
  cond,
  on,
  listenTo,
  start,
} from "./index";

describe("Syncing from HTML <details> element with choice Map", () => {
  function* DetailsListener(el: HTMLDetailsElement) {
    const checkingOpen = new Map([
      [() => el.open, Open],
      [true as any, Closed],
    ]);

    yield listenTo(el, ["toggle"]);
    yield on("toggle", checkingOpen);

    function* Closed() { }
    function* Open() { }

    return checkingOpen;
  }

  it("listens when opens and closed", async () => {
    const aborter = new AbortController();

    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(0);

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(true);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(1);

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(false);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(2);

    aborter.abort();
    detailsEl.remove();
  });

  it("is initially Open if element is already open when starting", async () => {
    const aborter = new AbortController();
    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    await user.click(summaryEl);

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(0);

    aborter.abort();
    detailsEl.remove();
  });
});

describe("Syncing from HTML <details> element with cond and always", () => {
  function* DetailsListener(el: HTMLDetailsElement) {
    yield listenTo(el, ["toggle"]);
    yield on("toggle", compound(checkingOpen));

    function* Closed() { }
    function* Open() { }
    function* checkingOpen() {
      yield cond(el.open, Open);
      yield always(Closed);
    }

    return checkingOpen;
  }

  it("listens when opens and closed", async () => {
    const aborter = new AbortController();

    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(0);

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(true);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(4);

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(false);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(8);

    aborter.abort();
    detailsEl.remove();
  });

  it("is initially Open if element is already open when starting", async () => {
    const aborter = new AbortController();
    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    await user.click(summaryEl);

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(0);

    aborter.abort();
    detailsEl.remove();
  });
});
