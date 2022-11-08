/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import user from "@testing-library/user-event"
import {
  on,
  listenTo,
  start,
  choice,
} from "./index";

describe("Syncing from HTML <details> element with choice Map", () => {
  function* DetailsListener(el: HTMLDetailsElement) {
    const checkingOpen = new Map([
      [() => el.open, Open],
      [null, Closed],
    ]);

    yield listenTo(el, ["toggle"]);
    yield on("toggle", choice(checkingOpen));

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

    expect(machine.value).toMatchObject({
      change: 0,
      state: "Closed",
    });

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(true);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.value).toMatchObject({
      change: 1,
      state: "Open",
    });

    await user.click(summaryEl);
    expect(detailsEl.open).toBe(false);
    detailsEl.dispatchEvent(new Event('toggle'));
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Closed",
    });

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

    expect(machine.value).toMatchObject({
      change: 0,
      state: "Open",
    });

    aborter.abort();
    detailsEl.remove();
  });
});
