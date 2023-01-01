/**
 * @jest-environment jsdom
 */

import React, {
  StrictMode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import user from "@testing-library/user-event";
import { on } from "yieldmachine";
import { useMachine } from "./index"

describe("simple button", () => {
  function ClickMachine() {
    function* Initial() {
      yield on("click", Once);
    }
    function* Once() {
      yield on("click", Twice);
    }
    function* Twice() {}

    return Initial;
  }

  function Button() {
    const [state, dispatch] = useMachine(ClickMachine);

    return (
      <>
        <button
          onClick={() => {
            dispatch("click");
          }}
        >
          Click me
        </button>
        <output>{JSON.stringify(state)}</output>
      </>
    );
  }

  it("starts as initially", () => {
    const queries = render(
      <StrictMode>
        <Button />
      </StrictMode>
    );
    expect(queries.getByRole("status")).toHaveTextContent("Initial");
    // queries.unmount();
  });

  it("allows one event", async () => {
    const queries = render(
      <StrictMode>
        <Button />
      </StrictMode>
    );
    await user.click(queries.getByRole("button", { name: "Click me" }));
    expect(queries.getByRole("status")).toHaveTextContent("Once");
    // queries.unmount();
  });

  it("allows multiple events", async () => {
    const queries = render(
      <StrictMode>
        <Button />
      </StrictMode>
    );
    const button = queries.getByRole("button", { name: "Click me" });
    await user.click(button);
    await user.click(button);
    expect(queries.getByRole("status")).toHaveTextContent("Twice");
    // queries.unmount();
  });

  it("works with server rendering", () => {
    document.body.innerHTML = renderToStaticMarkup(
      <StrictMode>
        <Button />
      </StrictMode>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Initial");
  });
});
