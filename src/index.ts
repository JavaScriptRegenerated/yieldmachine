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
  then: ActionBody;
}
export interface ExitAction {
  type: "exit";
  then: ActionBody;
}

export interface On {
  type: "on";
  on: string;
  target: Function;
}

export type Yielded = EntryAction | On | Call<any>;

export function call<Arguments extends Array<any>>(
  f: (...args: Arguments) => void,
  args: Arguments
): Call<Arguments> {
  return { type: "call", f, args };
}

export function entry(then: ActionBody): EntryAction {
  return { type: "entry", then };
}

export function exit(then: ActionBody): ExitAction {
  return { type: "exit", then };
}

export function on<Event extends string>(event: Event, target: Function): On {
  return { type: "on", on: event, target };
}

export interface MachineInstance extends Iterator<string, void, string> {
  changeCount: number;
  value: string;
  promisedValue: null | Promise<Array<any>>;
  done: boolean;
  next(
    ...args: [string]
  ): IteratorResult<string, void> & {
    actions: Array<EntryAction | ExitAction>;
  };
}

export function start<Arguments extends Array<any>>(
  machine: (...args: Arguments) => () => Generator<Yielded>,
  args?: Arguments
): MachineInstance {
  const initialGenerator = machine.apply(null, args);

  const eventsMap = new Map();

  let state = {
    changeCount: -1,
    current: "",
    actions: [] as Array<EntryAction | ExitAction>,
    promisedValue: null as Promise<Array<any>> | null,
  };

  function receive(event: string, count: number) {
    if (count !== state.changeCount) return;

    const target = eventsMap.get(event);
    if (target) {
      transitionTo(target);
    }
  }

  function transitionTo(stateGenerator: () => Generator<Yielded>) {
    state.changeCount++;
    state.current = stateGenerator.name;
    state.promisedValue = null;
    eventsMap.clear();

    const results: Array<any> = [];

    const iterable = stateGenerator();
    for (const value of iterable) {
      if (value.type === "entry") {
        state.actions.push(value);
        // const result = Promise.resolve(value);
        const result = new Promise((resolve) => {
          resolve(value.then())
        });
        results.push(result);
      } else if (value.type === "call") {
        const result = new Promise((resolve) =>
          resolve(value.f.apply(null, value.args))
        );
        results.push(result);
      } else if (value.type === "on") {
        eventsMap.set(value.on, value.target);
      }
    }

    // const promise = Promise.all(results);
    const promise = Promise.resolve(state.promisedValue)
      .catch(() => {})
      .then(() => Promise.all(results));
    state.promisedValue = promise;

    const snapshotCount = state.changeCount;
    promise
      .then(() => receive("SUCCESS", snapshotCount))
      .catch(() => receive("FAILURE", snapshotCount));
  }

  transitionTo(initialGenerator);

  return {
    get changeCount() {
      return state.changeCount;
    },
    get value() {
      return state.current;
    },
    get promisedValue() {
      return state.promisedValue;
    },
    next(event: string) {
      receive(event, state.changeCount);
      return {
        value: state.current,
        actions: Array.from(state.actions),
        done: false,
      };
    },
    get done() {
      return false;
    },
  };
}
