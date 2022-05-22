import { useReducer, useEffect, useRef, useSyncExternalStore } from "react"
import { start, MachineInstance } from "yieldmachine"

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

export function useMachine(machineDefinition: Parameters<typeof start>[0]) {
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
