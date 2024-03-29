/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import user from "@testing-library/user-event";
import { on, listenTo, start, choice } from "./index";

describe("Element focus", () => {
  function* ButtonFocusListener(el: HTMLElement) {
    const checkingActive = new Map([
      [() => el.ownerDocument.activeElement === el, Active],
      [null, Inactive],
    ]);

    yield listenTo(el, ["blur", "focus"]);
    // yield listenTo(el.ownerDocument, "focusin");
    // yield on("focusin", jumpTo(CheckingActive));
    yield on("focus", choice(checkingActive));
    yield on("blur", choice(checkingActive));

    function* Inactive() {}
    function* Active() {}

    return checkingActive;
  }

  it("listens when element receives and loses focus", () => {
    const aborter = new AbortController();
    const button = document.body.appendChild(document.createElement("button"));
    const input = document.body.appendChild(document.createElement("input"));

    const machine = start(ButtonFocusListener.bind(null, button), {
      signal: aborter.signal,
    });
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Inactive",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 1,
      state: "Active",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 1,
      state: "Active",
    });

    input.focus();
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Inactive",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 3,
      state: "Active",
    });

    button.blur();
    expect(machine.value).toMatchObject({
      change: 4,
      state: "Inactive",
    });

    aborter.abort();
    button.remove();
    input.remove();
  });

  it("is initially Active if element is already focused when starting", () => {
    const aborter = new AbortController();
    const button = document.body.appendChild(document.createElement("button"));

    button.focus();
    const machine = start(ButtonFocusListener.bind(null, button), {
      signal: aborter.signal,
    });
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Active",
    });

    button.remove();
    aborter.abort();
  });
});

describe("Textbox validation", () => {
  function* RequiredInputValidationResponder(el: HTMLInputElement) {
    const checkingActive = new Map([
      [() => el.ownerDocument.activeElement === el, Active],
      [null, Inactive],
    ]);
    const checkingValid = new Map([
      [() => el.value === "", InvalidCannotBeEmpty],
      [() => /^[a-z]+$/.test(el.value) === false, InvalidMustBeLowercase],
      [null, Valid],
    ]);

    yield listenTo(el, ["input", "blur", "focus"]);
    yield on("focus", choice(checkingActive));
    yield on("blur", choice(checkingActive));
    yield on("input", choice(checkingValid));

    function* Inactive() {}
    function* Active() {}
    function* Valid() {}
    function* InvalidCannotBeEmpty() {}
    function* InvalidMustBeLowercase() {}

    return checkingActive;
  }

  it("listens when element receives and loses focus", async () => {
    const aborter = new AbortController();
    const input = document.body.appendChild(document.createElement("input"));

    const machine = start(RequiredInputValidationResponder.bind(null, input), {
      signal: aborter.signal,
    });
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Inactive",
    });

    await user.click(input);
    expect(machine.value).toMatchObject({
      change: 1,
      state: "Active",
    });

    await user.click(document.body);
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Inactive",
    });

    await user.click(input);
    expect(machine.value).toMatchObject({
      change: 3,
      state: "Active",
    });
    await user.paste("hello");
    expect(machine.value).toMatchObject({
      change: 4,
      state: "Valid",
    });

    await user.clear(input);
    expect(machine.value).toMatchObject({
      change: 5,
      state: "InvalidCannotBeEmpty",
    });

    await user.click(input);
    await user.paste("HELLO");
    expect(machine.value).toMatchObject({
      change: 6,
      state: "InvalidMustBeLowercase",
    });

    input.remove();
    aborter.abort();
  });
});
