/**
 * @jest-environment jsdom
 */

import React, {
  StrictMode,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import user from "@testing-library/user-event";
import {
  on,
  start,
  MachineInstance
} from "./index";

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

  function useAbortSignal() {
    const [controller, dispatch] = useReducer(
      (controller: AbortController | null, create: boolean) => {
        if (create) {
          if (controller !== null && !controller.signal.aborted) {
            return controller;
          }
          return new AbortController();
        } else {
          controller?.abort();
          return controller;
        }
      },
      null,
      () => new AbortController()
    );

    useEffect(() => {
      // console.log('send create');
      dispatch(true);
      return () => {
        console.log("send abort");
        dispatch(false);
      };
    }, [dispatch]);

    return controller?.signal;
  }

  function useMachine(machineDefinition: Parameters<typeof start>[0]) {
    const abortSignal = useAbortSignal();
    const machineRef = useRef<MachineInstance | null>(null);
    if (machineRef.current === null) {
      const machine = start(machineDefinition, { signal: abortSignal });
      machineRef.current = machine;
    }

    const state = useSyncExternalStore(
      (callback: () => void) => {
        machineRef.current?.eventTarget.addEventListener(
          "StateChanged",
          callback
        );
        return () => {
          machineRef.current?.eventTarget.removeEventListener(
            "StateChanged",
            callback
          );
        };
      },
      () => machineRef.current?.value.state,
      () => machineRef.current?.value.state
    );

    function dispatch(event: string | symbol) {
      machineRef.current?.next(event);
    }

    return Object.freeze([state, dispatch] as const);
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
