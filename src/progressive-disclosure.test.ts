/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { within } from "@testing-library/dom";
import user from "@testing-library/user-event"
import {
  always,
  compound,
  cond,
  entry,
  exit,
  on,
  listenTo,
  send,
  start,
  accumulate,
  onceStateChangesTo,
  readContext,
} from "./index";

describe("Element focus", () => {
  function* DetailsListener(el: HTMLDetailsElement) {
    yield listenTo(el, ["toggle"]);
    yield on("toggle", compound(CheckingOpen));

    function* Closed() { }
    function* Open() { }
    function* CheckingOpen() {
      yield cond(el.open, Open);
      yield always(Closed);
    }

    return CheckingOpen;
  }

  it("listens when opens and closed", () => {
    const aborter = new AbortController();

    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(0);

    user.click(summaryEl);
    expect(detailsEl.open).toBe(true);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(2);

    user.click(summaryEl);
    expect(detailsEl.open).toBe(false);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.current).toEqual("Closed");
    expect(machine.changeCount).toEqual(4);

    aborter.abort();
    detailsEl.remove();
  });

  it("is initially Open if element is already open when starting", () => {
    const aborter = new AbortController();
    const detailsEl = document.body.appendChild(document.createElement("details"));
    const summaryEl = detailsEl.appendChild(document.createElement("summary"));
    detailsEl.appendChild(document.createElement("div"));

    user.click(summaryEl);

    const machine = start(DetailsListener.bind(null, detailsEl), { signal: aborter.signal });

    expect(machine.current).toEqual("Open");
    expect(machine.changeCount).toEqual(0);

    aborter.abort();
    detailsEl.remove();
  });
});
