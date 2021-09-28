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

    expect(machine.current).toEqual("Inactive");
    expect(machine.changeCount).toEqual(0);

    button.focus();
    expect(machine.current).toEqual("Active");
    expect(machine.changeCount).toEqual(2);

    button.focus();
    expect(machine.current).toEqual("Active");
    expect(machine.changeCount).toEqual(2);

    input.focus();
    expect(machine.current).toEqual("Inactive");
    expect(machine.changeCount).toEqual(4);

    button.focus();
    expect(machine.current).toEqual("Active");
    expect(machine.changeCount).toEqual(6);

    button.blur();
    expect(machine.current).toEqual("Inactive");
    expect(machine.changeCount).toEqual(8);

    machine.abort();
    button.remove();
    input.remove();
  });

  it("is initially Active if element is already focused when starting", () => {
    const button = document.body.appendChild(document.createElement("button"));

    button.focus();
    const machine = start(ButtonFocusListener.bind(null, button));

    expect(machine.current).toEqual("Active");
    expect(machine.changeCount).toEqual(0);

    button.remove();
    machine.abort();
  });
});

describe("Textbox validation", () => {
  function* RequiredInputValidationResponder(el: HTMLInputElement) {
    yield listenTo(el, ["input", "blur", "focus"]);
    yield on("focus", compound(CheckingActive));
    yield on("blur", compound(CheckingActive));
    yield on("input", compound(CheckingValid));

    function* Inactive() {}
    function* Active() {}
    function* CheckingActive() {
      yield cond(el.ownerDocument.activeElement === el, Active);
      yield always(Inactive);
    }
    function* Valid() {}
    function* InvalidCannotBeEmpty() {}
    function* InvalidMustBeLowercase() {}
    function* CheckingValid() {
      yield cond(el.value === '', InvalidCannotBeEmpty);
      yield cond(/^[a-z]+$/.test(el.value) === false, InvalidMustBeLowercase);
      yield always(Valid);
    }

    return CheckingActive;
  }

  it("listens when element receives and loses focus", () => {
    const input = document.body.appendChild(document.createElement("input"));

    const machine = start(RequiredInputValidationResponder.bind(null, input));

    expect(machine.current).toEqual("Inactive");
    expect(machine.changeCount).toEqual(0);

    user.click(input);
    expect(machine.current).toEqual("Active");
    expect(machine.changeCount).toEqual(2);
    
    user.click(document.body);
    expect(machine.current).toEqual("Inactive");
    expect(machine.changeCount).toEqual(4);
    
    user.type(input, "hello");
    expect(machine.current).toEqual("Valid");
    
    user.clear(input);
    expect(machine.current).toEqual("InvalidCannotBeEmpty");
    
    user.type(input, "HELLO");
    expect(machine.current).toEqual("InvalidMustBeLowercase");

    user.type(input, "lowercase");
    expect(machine.current).toEqual("InvalidMustBeLowercase");

    input.remove();
    machine.abort();
  });
});
