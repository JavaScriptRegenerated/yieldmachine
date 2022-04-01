/**
 * @jest-environment jsdom
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
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
    const abortControllerRef = useRef<AbortController | null>(null);
    function ensureCreated() {
      if (abortControllerRef.current === null) {
        abortControllerRef.current = new AbortController();
      }
    }
    useEffect(() => {
      ensureCreated();
      return () => {
        abortControllerRef.current?.abort();
      }
    });
    ensureCreated();
    return abortControllerRef.current!.signal;
  }

  function Button() {
    const abortSignal = useAbortSignal();
    const machineRef = useRef<MachineInstance | null>(null);
    if (machineRef.current === null) {
      const machine = start(ClickMachine, { signal: abortSignal });
      machineRef.current = machine;
    }

    const state = useSyncExternalStore((callback: () => void) => {
      machineRef.current?.eventTarget.addEventListener('StateChanged', callback);
      return () => {
        machineRef.current?.eventTarget.removeEventListener('StateChanged', callback);
      }
    }, () => machineRef.current?.value.state)

    return <>
      <button onClick={() => {
        machineRef.current?.next('click');
      }}>Click me</button>
      <output>{state}</output>
    </>
  }

  test("starts as initially", () => {
    const queries = render(<Button />);
    expect(queries.getByRole('status')).toHaveTextContent('Initial');
  });

  test("changes on click as initially", async () => {
    const queries = render(<Button />);
    await user.click(queries.getByRole('button', { name: 'Click me' }));
    expect(queries.getByRole('status')).toHaveTextContent('Activated');
  });
});
