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
  function* ButtonFocusListener(el: HTMLElement) {
    yield listenTo(el, ["blur", "focus"]);
    // yield listenTo(el.ownerDocument, "focusin");
    // yield on("focusin", compound(CheckingActive));
    yield on("focus", compound(CheckingActive));
    yield on("blur", compound(CheckingActive));

    function* Inactive() {}
    function* Active() {}
    function* CheckingActive() {
      yield cond(el.ownerDocument.activeElement === el, Active);
      yield always(Inactive);
    }

    return CheckingActive;
  }

  it("listens when element receives and loses focus", () => {
    const button = document.body.appendChild(document.createElement("button"));
    const input = document.body.appendChild(document.createElement("input"));

    const machine = start(ButtonFocusListener.bind(null, button));
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Inactive",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Active",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Active",
    });

    input.focus();
    expect(machine.value).toMatchObject({
      change: 4,
      state: "Inactive",
    });

    button.focus();
    expect(machine.value).toMatchObject({
      change: 6,
      state: "Active",
    });

    button.blur();
    expect(machine.value).toMatchObject({
      change: 8,
      state: "Inactive",
    });

    machine.abort();
    button.remove();
    input.remove();
  });

  it("is initially Active if element is already focused when starting", () => {
    const button = document.body.appendChild(document.createElement("button"));

    button.focus();
    const machine = start(ButtonFocusListener.bind(null, button));
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Active",
    });

    button.remove();
    machine.abort();
  });
});

describe("Textbox validation", () => {
  function* RequiredInputValidationResponder(el: HTMLInputElement) {
    yield listenTo(el, ["input", "blur", "focus"]);
    yield on("focus", compound(_CheckingActive));
    yield on("blur", compound(_CheckingActive));
    yield on("input", compound(_CheckingValid));

    function* Inactive() {}
    function* Active() {}
    function* _CheckingActive() {
      yield cond(el.ownerDocument.activeElement === el, Active);
      yield always(Inactive);
    }
    function* Valid() {}
    function* InvalidCannotBeEmpty() {}
    function* InvalidMustBeLowercase() {}
    function* _CheckingValid() {
      yield cond(el.value === '', InvalidCannotBeEmpty);
      yield cond(/^[a-z]+$/.test(el.value) === false, InvalidMustBeLowercase);
      // yield cond(false)(/^[a-z]+$/.test(el.value), InvalidMustBeLowercase);
      yield always(Valid);
    }

    return _CheckingActive;
  }

  it("listens when element receives and loses focus", () => {
    const input = document.body.appendChild(document.createElement("input"));

    const machine = start(RequiredInputValidationResponder.bind(null, input));
    expect(machine.value).toMatchObject({
      change: 0,
      state: "Inactive",
    });

    user.click(input);
    expect(machine.value).toMatchObject({
      change: 2,
      state: "Active",
    });
    
    user.click(document.body);
    expect(machine.value).toMatchObject({
      change: 4,
      state: "Inactive",
    });
    
    user.paste(input, "hello");
    expect(machine.value).toMatchObject({
      change: 8,
      state: "Valid",
    });
    
    user.clear(input);
    expect(machine.value).toMatchObject({
      change: 10,
      state: "InvalidCannotBeEmpty",
    });
    
    user.paste(input, "HELLO");
    expect(machine.value).toMatchObject({
      change: 12,
      state: "InvalidMustBeLowercase",
    });

    input.remove();
    machine.abort();
  });
});
