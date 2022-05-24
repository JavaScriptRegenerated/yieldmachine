// TODO: remove? Replaced by send?
export interface Call<A extends Array<any>> {
  type: "call";
  f: (...args: A) => void;
  args: A;
}

export interface EntryActionBody {
  // (): void;
  ({ signal }: { signal: AbortSignal }): void;
}
export interface ExitActionBody {
  (): void;
}

export interface EntryAction {
  type: "entry";
  f: EntryActionBody;
  message?: [string | symbol, any[]];
}
export interface ExitAction {
  type: "exit";
  f: ExitActionBody;
}

export type PrimitiveState = boolean | number | string | symbol;
export type StateDefinition = () => Generator<Yielded, any, unknown>;
export type ChoiceDefinition = Map<(() => boolean) | null, StateDefinition>;

export interface Cond {
  type: "cond";
  cond:
    | ((readContext: (contextName: string | symbol) => unknown) => boolean)
    | boolean;
  target: StateDefinition;
}
export interface Compound {
  type: "compound";
  targets: Array<StateDefinition> | ChoiceDefinition;
}
export interface Mapper<State> {
  type: "mapper";
  transform: (current: State) => State;
}
export type Target =
  | StateDefinition
  | Cond
  | Compound
  | Mapper<boolean>
  | Mapper<number>
  | Mapper<string>
  | Mapper<symbol>
  | ChoiceDefinition;
export interface On {
  type: "on";
  on: string | symbol;
  target: Target;
}

export interface ListenTo {
  type: "listenTo";
  eventNames: Array<string>;
  sender: EventTarget;
}
export interface Always {
  type: "always";
  target: Target;
}

export interface Send<Method extends string | symbol, Arguments extends any[]> {
  type: "send";
  // targetName: string | symbol;
  target: () => Record<Method, (...args: Arguments) => void>;
  method: Method;
  args: Arguments;
}

export interface Accumulate {
  type: "accumulate";
  eventName: string | symbol;
  resultKey: symbol;
}

export interface ReadContext {
  type: "readContext";
  contextName: string | symbol;
}

export type Yielded =
  | On
  | Always
  | Cond
  | EntryAction
  | ExitAction
  | ListenTo
  | ReadContext
  | Accumulate
  | Call<any>;

export function on<Event extends string | symbol | ErrorConstructor>(
  event: Event,
  target: Target
): On {
  return {
    type: "on",
    on: typeof event === "function" && "name" in event ? event.name : event,
    target,
  };
}

export function map<T extends PrimitiveState>(
  transform: (current: T) => T
): Mapper<T> {
  return {
    type: "mapper",
    transform,
  };
}

export function call<Arguments extends Array<any>>(
  f: (...args: Arguments) => void,
  args: Arguments
): Call<Arguments> {
  return { type: "call", f, args };
}

export function entry(f: EntryActionBody | Send<string, any[]>): EntryAction {
  if (typeof f === "function") {
    return { type: "entry", f };
  } else {
    return { type: "entry", f: f.target, message: [f.method, f.args] };
  }
}

export function exit(f: ExitActionBody): ExitAction {
  return { type: "exit", f };
}

export function listenTo(
  sender: EventTarget,
  eventNames: Array<string>
): ListenTo {
  return { type: "listenTo", sender, eventNames: Array.from(eventNames) };
}

export function send<Method extends string | symbol, Arguments extends any[]>(
  target: () => Record<Method, (...args: Arguments) => void>,
  method: Method,
  args: Arguments
): Send<Method, Arguments> {
  return { type: "send", target, method, args };
}

export function always(target: Target): Always {
  return { type: "always", target };
}

export function cond(
  cond:
    | ((readContext: (contextName: string | symbol) => unknown) => boolean)
    | boolean,
  target: StateDefinition
): Cond {
  return { type: "cond", cond, target };
}

// TODO: rename to child() or nested() or something else?
export function compound(...targets: Array<StateDefinition>): Compound {
  return { type: "compound", targets };
}

export function choice(choice: ChoiceDefinition): Compound {
  return { type: "compound", targets: choice };
}

export function accumulate(
  eventName: string | symbol,
  resultKey: symbol
): Accumulate {
  return { type: "accumulate", eventName, resultKey };
}

export function readContext(contextName: string | symbol): ReadContext {
  return { type: "readContext", contextName };
}

interface MachineValue {
  readonly change: number;
  readonly state: null | PrimitiveState | Record<string, PrimitiveState>;
  readonly actions: Array<EntryAction | ExitAction>;
  readonly results: null | Promise<unknown>;
}

export interface MachineInstance
  extends Iterator<MachineValue, void, string | symbol> {
  readonly value: MachineValue;
  readonly changeCount: number;
  // TODO: remove `current`
  readonly current: null | PrimitiveState | Record<string, PrimitiveState>;
  readonly results: null | Promise<unknown>;
  readonly accumulations: Map<symbol | string, Array<symbol | string | Event>>;
  readonly done: boolean;
  readonly eventTarget: EventTarget;
  next(arg: string | symbol): IteratorResult<MachineValue>;
  // abort(): void;
}

class Handlers {
  private aborter = new AbortController();
  private eventsMap = new Map<string | symbol, Target>();
  private alwaysArray = new Array<Target>();
  private entryActions = [] as Array<EntryAction>;
  private exitActions = [] as Array<ExitAction>;
  private promises = [] as Array<Promise<unknown> | unknown>;
  private actionResults = new Map<string | symbol, unknown>();
  private promise: null | Promise<Array<unknown>> = null;
  public readonly eventsToListenTo = new Array<[string, EventTarget]>();
  public readonly eventsToAccumulate = new Array<[string | symbol, symbol]>();

  get signal() {
    return this.aborter.signal;
  }

  *actions(): Generator<EntryAction, void, undefined> {
    yield* this.entryActions;
  }

  reset() {
    this.aborter.abort();
    this.aborter = new AbortController();

    this.eventsMap.clear();
    this.entryActions.splice(0, Infinity);
    this.exitActions.splice(0, Infinity);
    this.alwaysArray.splice(0, Infinity);
    this.promises.splice(0, Infinity);
    this.actionResults.clear();
    this.eventsToListenTo.splice(0, Infinity);
    this.eventsToAccumulate.splice(0, Infinity);
  }

  add(
    value: Yielded,
    readContext: (contextName: string | symbol) => unknown
  ): unknown | void {
    if (value.type === "entry") {
      this.entryActions.push(value);

      const skip = Symbol();
      const resultPromise = new Promise((resolve) => {
        if (value.message === undefined) {
          const result = value.f({ signal: this.aborter.signal });
          this.actionResults.set(value.f.name, result);
          resolve(result);
        } else {
          const instance = this.actionResults.get(value.f.name);
          const [method, args] = value.message;
          if (instance != null && method in (instance as {})) {
            (instance as Record<string | symbol, Function>)[method].apply(
              instance,
              args
            );
          }
          resolve(skip);
        }
      }).then((result) => {
        if (result !== skip) {
          return { [value.f.name]: result };
        }
        return undefined;
      });
      this.promises.push(resultPromise);
    } else if (value.type === "exit") {
      this.exitActions.push(value);
    } else if (value.type === "on") {
      this.eventsMap.set(value.on, value.target);
    } else if (value.type === "always") {
      this.alwaysArray.push(value.target);
    } else if (value.type === "cond") {
      this.alwaysArray.push(value);
    } else if (value.type === "listenTo") {
      for (const eventName of value.eventNames) {
        this.eventsToListenTo.push([eventName, value.sender]);
      }
    } else if (value.type === "accumulate") {
      this.eventsToAccumulate.push([value.eventName, value.resultKey]);
    } else if (value.type === "readContext") {
      return readContext(value.contextName);
    }
    return undefined;
  }

  finish(): null | Promise<Record<string, any>> {
    if (this.promises.length === 0) return null;

    const promise = Promise.resolve(this.promise)
      .catch(() => {})
      .then(() => Promise.all(this.promises))
      .then((resultObjects) => Object.assign({}, ...resultObjects));

    this.promise = promise;

    return promise;
  }

  runExit() {
    this.exitActions.forEach((action) => {
      action.f();
    });
  }

  runAlways(process: (target: Target) => boolean) {
    this.alwaysArray.some(process);
  }

  targetForEvent(event: string | symbol) {
    return this.eventsMap.get(event);
  }
}

function isPrimitiveState(value: unknown): value is PrimitiveState {
  return (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "symbol"
  );
}

class InternalInstance {
  private definition:
    | (() => StateDefinition)
    | (() => Generator<Yielded, StateDefinition, never>)
    | (() => Generator<Yielded, PrimitiveState, never>)
    | (() => Generator<Yielded, ChoiceDefinition, never>);
  private parent: null | InternalInstance;
  private globalHandlers = new Handlers();
  private resolved = null as Promise<Record<string, any>> | null;
  private accumulations: Map<symbol | string, Array<symbol | string | Event>> =
    new Map();
  private aborter = new AbortController();
  child: null | PrimitiveState | InternalInstance = null;

  constructor(
    parent: null | InternalInstance,
    machineDefinition:
      | (() => StateDefinition)
      | (() => Generator<Yielded, StateDefinition, never>)
      | (() => Generator<Yielded, PrimitiveState, never>)
      | (() => Generator<Yielded, ChoiceDefinition, never>),
    private signal: AbortSignal,
    private callbacks: {
      readonly changeCount: number;
      willChangeState: () => void;
      didChangeState: (state: PrimitiveState | Record<string, unknown>) => void;
      didChangeAccumulations: () => void;
      sendEvent: (event: string, changeCount?: number) => void;
      willHandleEvent: (event: Event) => void;
      didHandleEvent: (event: Event) => void;
      readContext: (contextName: string | symbol) => unknown;
    }
  ) {
    this.definition = machineDefinition;
    this.parent = parent;
    this.consume(machineDefinition);

    signal.addEventListener(
      "abort",
      () => {
        this.willExit();
      },
      { once: true }
    );
  }

  get current(): null | PrimitiveState | Record<string, unknown> {
    if (this.child === null) {
      return this.definition.name;
    } else if (isPrimitiveState(this.child)) {
      return { [this.definition.name]: this.child };
    } else {
      // return [[this.definition.name], this.child.current];
      return { [this.definition.name]: this.child.current };
    }
  }

  private *generateActions(): Generator<EntryAction, void, undefined> {
    yield* this.globalHandlers.actions();
    if (this.child instanceof InternalInstance) {
      yield* this.child.generateActions();
    }
  }

  get actions(): Array<EntryAction> {
    return Array.from(this.generateActions());
  }

  private async *valuePromises(): AsyncGenerator<
    Record<string, any>,
    void,
    undefined
  > {
    if (this.resolved !== null) {
      yield await this.resolved;
    }
    if (this.child instanceof InternalInstance) {
      yield* this.child.valuePromises();
    }
  }

  get results(): Promise<Array<any>> {
    const build = async () => {
      const objects: Array<any> = [];
      for await (const object of this.valuePromises()) {
        objects.push(object);
      }
      return objects;
    };

    return build().then((objects) => Object.assign({}, ...objects));
    // return build().then(pairs => Object.fromEntries(pairs as any));
  }

  *allAccumulations(): Generator<
    [symbol | string, Array<string | symbol | Event>]
  > /*: Generator<{ key: symbol | string, events: Array<string | symbol | Event> }>*/ {
    for (const [key, events] of this.accumulations) {
      // yield { key, events };
      yield [key, events];
    }

    if (this.child instanceof InternalInstance) {
      yield* this.child.allAccumulations();
    }
  }

  handleEvent(event: Event) {
    this.callbacks.willHandleEvent(event);
    this.receive(event);
    this.callbacks.didHandleEvent(event);
  }

  cleanup() {
    this.globalHandlers.reset();
  }

  consume(
    stateGenerator:
      | (() => StateDefinition)
      | (() => Generator<Yielded, StateDefinition, never>)
      | (() => Generator<Yielded, PrimitiveState, never>)
      | (() => Generator<Yielded, ChoiceDefinition, never>)
  ) {
    // this.cleanup();

    this.willEnter();

    if (typeof stateGenerator !== "function") {
      // return
      throw Error(
        `Expected state generator to be a function, got: ${typeof stateGenerator}`
      );
    }

    const initialReturn = stateGenerator();
    // Generator function
    if ((initialReturn as any)[Symbol.iterator]) {
      const iterator: Iterator<any, unknown, unknown> = (initialReturn as any)[
        Symbol.iterator
      ]();
      let reply: unknown = undefined;
      while (true) {
        const item = iterator.next(reply);
        if (item.done) {
          var initialStateDefinition = item.value as unknown;
          break;
        }

        // reply = this.globalHandlers.add(item.value, this.signal, this.callbacks.readContext);
        reply = this.globalHandlers.add(item.value, this.callbacks.readContext);
      }

      const promise = this.globalHandlers.finish();
      this.resolved = promise;

      if (promise !== null) {
        const snapshotCount = this.callbacks.changeCount;
        promise
          .then(() => {
            this.callbacks.sendEvent("SUCCESS", snapshotCount);
          })
          .catch(() => {
            this.callbacks.sendEvent("FAILURE", snapshotCount);
          });
      }

      for (const [event, target] of this.globalHandlers.eventsToListenTo) {
        target.addEventListener(event, this, {
          signal: this.globalHandlers.signal,
        } as AddEventListenerOptions);
      }
    }
    // Normal function
    else if (typeof initialReturn === "function") {
      var initialStateDefinition = initialReturn as unknown;
    } else {
      throw Error(
        `State Machine definition returned invalid initial value ${initialReturn}`
      );
    }

    if (isPrimitiveState(initialStateDefinition)) {
      this.child = initialStateDefinition;
    } else if (initialStateDefinition instanceof Map) {
      for (const [cond, checkTarget] of initialStateDefinition) {
        // const result = typeof cond === "boolean" ? cond : cond(this.callbacks.readContext);
        const result: boolean = cond === null ? true : cond();
        if (result === true) {
          this.transitionTo(checkTarget);
          return;
        }
      }
    } else {
      this.transitionTo(initialStateDefinition as StateDefinition | undefined);
    }
  }

  willEnter() {
    this.callbacks.willChangeState();
  }

  didEnter() {
    this.callbacks.didChangeState(this.current!);
    this.globalHandlers.runAlways((target) => this.processTarget(target));
  }

  willMutate() {
    this.callbacks.willChangeState();
  }

  didMutate() {
    this.callbacks.didChangeState(this.current!);
  }

  willExit() {
    this.aborter.abort();
    this.globalHandlers.runExit();
    this.globalHandlers.reset();
  }

  transitionTo(stateDefinition?: StateDefinition) {
    if (stateDefinition === undefined) {
      return;
    }
    if (
      this.child instanceof InternalInstance &&
      this.child.definition === stateDefinition
    ) {
      return;
    }

    this.aborter.abort();

    this.aborter = new AbortController();
    const childInstance = new InternalInstance(
      this,
      stateDefinition,
      this.aborter.signal,
      this.callbacks
    );
    this.child = childInstance;
    childInstance.didEnter();
  }

  processTarget(target: Target): boolean {
    if ("type" in target) {
      if (target.type === "cond") {
        const result =
          typeof target.cond === "boolean"
            ? target.cond
            : target.cond(this.callbacks.readContext);
        if (result === true && this.parent !== null) {
          this.parent.transitionTo(target.target);
          return true;
        }
      } else if (target.type === "compound") {
        let receiver: InternalInstance = this;
        if (target.targets instanceof Map) {
          for (const [cond, checkTarget] of target.targets) {
            // const result = typeof cond === "boolean" ? cond : cond(this.callbacks.readContext);
            const result: boolean = cond === null ? true : cond();
            if (result === true) {
              this.transitionTo(checkTarget);
              return true;
            }
          }
        } else {
          for (const nestedTarget of target.targets) {
            receiver.transitionTo(nestedTarget);
            if (receiver.child instanceof InternalInstance) {
              receiver = receiver.child;
            } else {
              break;
            }
          }
        }
      } else if (target.type === "mapper") {
        if (this.child === null || this.child instanceof InternalInstance) {
          throw Error(
            "Can only map on primitive state of type: boolean, number, or string."
          );
        }

        this.willMutate();
        this.child = (target as Mapper<typeof this.child>).transform(
          this.child
        );
        this.didMutate();
      }
    } else if (target instanceof Map && this.parent !== null) {
      for (const [cond, checkTarget] of target) {
        // const result = typeof cond === "boolean" ? cond : cond(this.callbacks.readContext);
        const result: boolean = cond === null ? true : cond();
        if (result === true) {
          this.parent.transitionTo(checkTarget);
          return true;
        }
      }
    } else if (this.parent !== null) {
      if (typeof target === "function") {
        this.parent.transitionTo(target);
        return true;
      }
    }

    return false;
  }

  receive(event: string | symbol | Event) {
    if (this.child instanceof InternalInstance) {
      this.child.receive(event);
    }

    const eventName =
      typeof event === "string" || typeof event === "symbol"
        ? event
        : event.type;

    const target = this.globalHandlers.targetForEvent(eventName);
    if (target !== undefined) {
      this.processTarget(target);
    }

    for (const [iteratedEventName, resultKey] of this.globalHandlers
      .eventsToAccumulate) {
      if (iteratedEventName === eventName) {
        // TODO: have different strategies rather than just storing every single event.
        const current = this.accumulations.get(resultKey) ?? [];
        this.accumulations.set(resultKey, current.concat(event));
        this.callbacks.didChangeAccumulations();
      }
    }
  }
}

const FallbackEvent = class Event {
  public readonly type: string;
  constructor(type: string, eventInitDict?: EventInit | undefined) {
    this.type = type;
  }
} as typeof Event;
const BaseEvent = typeof Event !== "undefined" ? Event : FallbackEvent;

class MachineStateChangedEvent extends BaseEvent {
  readonly value: PrimitiveState | Record<string, unknown>;

  constructor(type: string, value: PrimitiveState | Record<string, unknown>) {
    super(type);
    this.value = value;
  }
}

export function start(
  machine:
    | (() => StateDefinition)
    | (() => Generator<Yielded, StateDefinition, never>)
    | (() => Generator<Yielded, PrimitiveState, never>)
    | (() => Generator<Yielded, ChoiceDefinition, never>),
  options: { signal?: AbortSignal } = {}
): MachineInstance {
  let _changeCount = -1;
  let _activeEvent: null | Event = null;
  let _aborter = new AbortController();
  let _eventTarget = new EventTarget();

  const rootName = machine.name;
  const instance: InternalInstance = new InternalInstance(
    null,
    machine,
    _aborter.signal,
    {
      get changeCount() {
        return _changeCount;
      },
      willChangeState() {
        // _changeCount += 1;
      },
      didChangeState(state) {
        _changeCount += 1;
        _eventTarget.dispatchEvent(
          new MachineStateChangedEvent("StateChanged", state)
        );
      },
      didChangeAccumulations() {
        _eventTarget.dispatchEvent(new BaseEvent("AccumulationsChanged"));
      },
      sendEvent(event, snapshotCount) {
        if (
          typeof snapshotCount === "number" &&
          snapshotCount !== _changeCount
        ) {
          // TODO: add a test that verifies this behaviour.
          return;
        }
        instance.receive(event);
      },
      willHandleEvent(event) {
        _activeEvent = event;
      },
      didHandleEvent(event) {
        _activeEvent = null;
      },
      readContext(key) {
        if (key === "event") {
          return _activeEvent;
        }
        return undefined;
      },
    }
  );

  if (options.signal && !options.signal.aborted) {
    options.signal.addEventListener(
      "abort",
      () => {
        instance.cleanup();
      },
      { once: true }
    );
  }

  // function getCurrent() {
  //   const current = instance.current;
  //   return current !== null ? current[rootName] : null;
  // }

  let _cachedValue: undefined | MachineValue;
  function getValue() {
    if (_cachedValue?.change === _changeCount) {
      return _cachedValue;
    }

    let resultCache: undefined | Promise<unknown> = undefined;
    _cachedValue = Object.freeze({
      change: _changeCount,
      state:
        instance.current !== null && typeof instance.current === "object"
          ? (instance.current[rootName] as any)
          : instance.current,
      actions: instance.actions,
      get results() {
        if (resultCache === undefined) {
          resultCache = instance.results;
        }
        return resultCache;
      },
    });
    return _cachedValue;
  }

  _changeCount = 0;

  return {
    get value() {
      return getValue();
    },
    get changeCount() {
      return _changeCount;
    },
    get current() {
      return getValue().state;
    },
    get eventTarget() {
      return _eventTarget;
    },
    get results() {
      return instance.results;
    },
    get accumulations() {
      return new Map(instance.allAccumulations());
    },
    next(event: string | symbol) {
      instance.receive(event);
      return {
        value: getValue(),
        done: false,
      };
    },
    get done() {
      return instance.child !== null;
    },
  };
}

export function onceStateChangesTo(
  machineInstance: MachineInstance,
  state: PrimitiveState,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    machineInstance.eventTarget.addEventListener(
      "StateChanged",
      (event) => {
        if (
          event instanceof MachineStateChangedEvent &&
          event.value === state
        ) {
          resolve();
        }
      },
      { signal, once: true }
    );
  });
}
