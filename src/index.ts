export interface Call<A extends Array<any>> {
  type: "call";
  f: (...args: A) => void;
  args: A;
}

export interface ActionBody {
  (): void;
}

export interface EntryAction {
  type: "entry";
  f: ActionBody;
}
export interface ExitAction {
  type: "exit";
  f: ActionBody;
}

export type StateDefinition = () => Generator<Yielded, any, unknown>;
export interface Cond {
  type: "cond";
  cond: Function;
  target: StateDefinition;
}
export type Target = StateDefinition | Cond;
export interface On {
  type: "on";
  on: string;
  target: Target;
}
export interface Always {
  type: "always";
  target: Target;
}

export type Yielded = On | Always | EntryAction | ExitAction | Call<any>;

export function call<Arguments extends Array<any>>(
  f: (...args: Arguments) => void,
  args: Arguments
): Call<Arguments> {
  return { type: "call", f, args };
}

export function entry(f: ActionBody): EntryAction {
  return { type: "entry", f };
}

export function exit(f: ActionBody): ExitAction {
  return { type: "exit", f };
}

export function on<Event extends string>(event: Event, target: Target): On {
  return { type: "on", on: event, target };
}

export function always(target: Target): Always {
  return { type: "always", target };
}

export function cond(cond: () => boolean, target: StateDefinition): Cond {
  return { type: "cond", cond, target };
}

export interface MachineInstance extends Iterator<string, void, string> {
  changeCount: number;
  value: string;
  resolved: null | Promise<Array<any>>;
  done: boolean;
  next(
    ...args: [string]
  ): IteratorResult<string, void> &
    PromiseLike<any> & {
      actions: Array<EntryAction | ExitAction>;
    };
}

export function start<Arguments extends Array<any>>(
  machine: (...args: Arguments) => () => Generator<Yielded>,
  args?: Arguments
): MachineInstance {
  const initialGenerator = machine.apply(null, args);

  const eventsMap: Map<string, Target> = new Map();
  const alwaysArray: Array<Target> = [];

  let state = {
    changeCount: -1,
    current: "",
    entryActions: [] as Array<EntryAction>,
    exitActions: [] as Array<ExitAction>,
    resolved: null as Promise<Array<any>> | null,
  };

  function processTarget(target: Target): boolean {
    if ('type' in target) {
      const result = target.cond();
      if (result) {
        transitionTo(target.target);
        return true;
      }
    } else {
      transitionTo(target);
      return true;
    }

    return false;
  }

  function receive(event: string, count: number) {
    if (count !== state.changeCount) return;

    const target = eventsMap.get(event);
    if (target) {
      processTarget(target);
    }
  }

  function transitionTo(stateGenerator: () => Generator<Yielded>) {
    state.exitActions.forEach((action) => {
      action.f();
    });

    state.changeCount++;
    state.current = stateGenerator.name;
    state.entryActions.splice(0, Infinity);
    state.exitActions.splice(0, Infinity);
    state.resolved = null;
    eventsMap.clear();
    alwaysArray.splice(0, Infinity);

    const results: Array<any> = [];

    const iterable = stateGenerator();
    for (const value of iterable) {
      if (value.type === "entry") {
        state.entryActions.push(value);
        // const result = Promise.resolve(value);
        const result = new Promise((resolve) => {
          resolve(value.f());
        });
        results.push(result);
      } else if (value.type === "exit") {
        state.exitActions.push(value);
      } else if (value.type === "call") {
        const result = new Promise((resolve) =>
          resolve(value.f.apply(null, value.args))
        );
        results.push(result);
      } else if (value.type === "on") {
        eventsMap.set(value.on, value.target);
      } else if (value.type === "always") {
        alwaysArray.push(value.target);
      }
    }

    // const promise = Promise.all(results);
    const promise = Promise.resolve(state.resolved)
      .catch(() => {})
      .then(() => Promise.all(results));
    state.resolved = promise;

    const snapshotCount = state.changeCount;
    promise
      .then(() => receive("SUCCESS", snapshotCount))
      .catch(() => receive("FAILURE", snapshotCount));
    
    alwaysArray.some(processTarget);
  }

  transitionTo(initialGenerator);

  return {
    get changeCount() {
      return state.changeCount;
    },
    get value() {
      return state.current;
    },
    get resolved() {
      return state.resolved;
    },
    next(event: string) {
      receive(event, state.changeCount);
      const promise = state.resolved!;
      Promise.resolve;
      return {
        value: state.current,
        actions: Array.from(state.entryActions),
        then: promise.then.bind(promise),
        done: false,
      };
    },
    get done() {
      return false;
    },
  };
}
