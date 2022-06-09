import { useEffect, useMemo, useSyncExternalStore } from "react"
import { start } from "yieldmachine"

// TODO: should this be renamed to useStartMachine
export function useMachine(machineDefinition: Parameters<typeof start>[0]) {
  const instance = useMemo(() => {
    const aborter = new AbortController();
    // TODO: only start the machine when we need to.
    // For server-rendering, we should interpret the machine to get the initial state so we don’t have a lingering AbortController.
    const machine = start(machineDefinition, { signal: aborter.signal });
    return {
      aborter, machine, dispatch: machine.next.bind(machine)
    };
  }, []);
  useEffect(() => {
    return () => {
      instance.aborter.abort();
    };
  });

  const state = useSyncExternalStore(
    (callback: () => void) => {
      instance.machine.eventTarget.addEventListener(
        "StateChanged",
        callback
      );
      return () => {
        instance.machine.eventTarget.removeEventListener(
          "StateChanged",
          callback
        );
      };
    },
    () => instance.machine.value.state,
    () => instance.machine.value.state
  );

  return Object.freeze([state, instance.dispatch] as const);
}
