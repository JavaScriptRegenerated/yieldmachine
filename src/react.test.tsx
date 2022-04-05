/**
 * @jest-environment jsdom
 */

import React, { StrictMode, useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
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
  MachineInstance,
  StateDefinition,
  Yielded,
} from "./index";

describe("simple button", () => {
  function ClickMachine() {
    function* Initial() {
      yield on('click', Activated);
    }
    function* Activated() { }

    return Initial;
  }

  function useAbortSignal() {
    const [controller, dispatch] = useReducer((controller: AbortController | null, create: boolean) => {
      if (create) {
        if (controller !== null && !controller.signal.aborted) {
          return controller;
        }
        return new AbortController();
      } else {
        controller?.abort();
        return controller;
      }
    }, null, () => new AbortController());

    useEffect(() => {
      // console.log('send create');
      dispatch(true);
      return () => {
        console.log('send abort');
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

    const state = useSyncExternalStore((callback: () => void) => {
      machineRef.current?.eventTarget.addEventListener('StateChanged', callback);
      return () => {
        machineRef.current?.eventTarget.removeEventListener('StateChanged', callback);
      };
    }, () => machineRef.current?.value.state);

    function dispatch(event: string | symbol) {
      machineRef.current?.next(event);
    }

    return Object.freeze([state, dispatch]);
  }

  function Button() {
    const [state, dispatch] = useMachine(ClickMachine);

    return <>
      <button onClick={() => {
        dispatch('click');
      }}>Click me</button>
      <output>{state}</output>
    </>
  }

  test("starts as initially", () => {
    const queries = render(<StrictMode><Button /></StrictMode>);
    expect(queries.getByRole('status')).toHaveTextContent('Initial');
    // queries.unmount();
  });

  test("changes on click as initially", async () => {
    const queries = render(<StrictMode><Button /></StrictMode>);
    await user.click(queries.getByRole('button', { name: 'Click me' }));
    expect(queries.getByRole('status')).toHaveTextContent('Activated');
    // queries.unmount();
  });
});
