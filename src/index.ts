// TODO: remove? Replaced by send?
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
  message?: [string | symbol, any[]];
}
export interface ExitAction {
  type: "exit";
  f: ActionBody;
}

export type StateDefinition = () => Generator<Yielded, any, unknown>;
export interface Cond {
  type: "cond";
  cond: ((readContext: (contextName: string | symbol) => unknown) => boolean) | boolean;
  target: StateDefinition;
}
export interface Compound {
  type: "compound";
  targets: Array<StateDefinition>;
}
export type Target = StateDefinition | Cond | Compound;
export interface On {
  type: "on";
  on: string | symbol;
  target: Target;
}

export interface ListenTo {
  type: "listenTo";
  eventNames: Array<string>;
  sender: EventTarget
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

export type Yielded = On | Always | Cond | EntryAction | ExitAction | ListenTo | ReadContext | Accumulate | Call<any>;

export function on<Event extends string | symbol>(event: Event, target: Target): On {
  return { type: "on", on: event, target };
}

export function call<Arguments extends Array<any>>(
  f: (...args: Arguments) => void,
  args: Arguments
): Call<Arguments> {
  return { type: "call", f, args };
}

export function entry(f: ActionBody | Send<string, any[]>): EntryAction {
  if (typeof f === 'function') {
    return { type: "entry", f };
  } else {
    return { type: "entry", f: f.target, message: [f.method, f.args] };
  }
}

export function exit(f: ActionBody): ExitAction {
  return { type: "exit", f };
}

export function listenTo(sender: EventTarget, eventNames: string | Array<string>): ListenTo {
  return { type: "listenTo", sender, eventNames: ([] as Array<string>).concat(eventNames) };
}

export function send<Method extends string | symbol, Arguments extends any[]>(target: () => Record<Method, (...args: Arguments) => void>, method: Method, args: Arguments): Send<Method, Arguments> {
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

export function compound(...targets: Array<StateDefinition>): Compound {
  return { type: "compound", targets };
}

export function accumulate(eventName: string | symbol, resultKey: symbol): Accumulate {
  return { type: "accumulate", eventName, resultKey };
}

export function readContext(contextName: string | symbol): ReadContext {
  return { type: "readContext", contextName };
}

interface MachineValue {
  readonly change: number;
  readonly state: null | string | Record<string, string>;
  readonly actions: Array<EntryAction | ExitAction>;
  readonly results: null | Promise<unknown>;
}

export interface MachineInstance extends Iterator<MachineValue, void, string | symbol> {
  readonly value: MachineValue;
  readonly changeCount: number;
  readonly current: null | string | Record<string, string>;
  readonly results: null | Promise<unknown>;
  readonly accumulations: Map<symbol | string, Array<symbol | string | Event>>;
  readonly done: boolean;
  readonly signal: AbortSignal;
  next(arg: string | symbol): IteratorResult<MachineValue>;
  abort(): void;
}

class Handlers {
  private eventsMap = new Map<string | symbol, Target>();
  private alwaysArray = new Array<Target>();
  private entryActions = [] as Array<EntryAction>;
  private exitActions = [] as Array<ExitAction>;
  private promises = [] as Array<Promise<unknown> | unknown>;
  private actionResults = new Map<string | symbol, unknown>();
  private promise: null | Promise<Array<unknown>> = null;
  public readonly eventsToListenTo = new Array<[string, EventTarget]>();
  public readonly eventsToAccumulate = new Array<[string | symbol, symbol]>();
  
  *actions(): Generator<EntryAction, void, undefined> {
    yield* this.entryActions;
  }
  
  reset() {
    this.eventsMap.clear();
    this.entryActions.splice(0, Infinity);
    this.exitActions.splice(0, Infinity);
    this.alwaysArray.splice(0, Infinity);
    this.promises.splice(0, Infinity);
    this.actionResults.clear();
    this.eventsToListenTo.splice(0, Infinity);
    this.eventsToAccumulate.splice(0, Infinity);
  }
  
  add(value: Yielded, readContext: (contextName: string | symbol) => unknown): unknown | void {
    if (value.type === "entry") {
      this.entryActions.push(value);
      
      const skip = Symbol();
      const resultPromise = new Promise((resolve) => {
        if (value.message === undefined) {
          const result = value.f();
          this.actionResults.set(value.f.name, result);
          resolve(result);
        } else {
          const instance = this.actionResults.get(value.f.name);
          const [method, args] = value.message;
          if (instance != null && method in (instance as {})) {
            (instance as {})[method].apply(instance, args);
          }
          resolve(skip);
        }
      }).then((result) => {
        if (result !== skip) {
          return ({ [value.f.name]: result })
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
    } else if (value.type === 'listenTo') {
      for (const eventName of value.eventNames) {
        this.eventsToListenTo.push([eventName, value.sender]);
      }
    } else if (value.type === 'accumulate') {
      this.eventsToAccumulate.push([value.eventName, value.resultKey]);
    } else if (value.type === 'readContext') {
      return readContext(value.contextName);
    }
    return undefined;
  }
  
  finish(): null | Promise<Record<string, any>> {
    if (this.promises.length === 0) return null;
    
    const promise = Promise.resolve(this.promise)
      .catch(() => {})
      .then(() => Promise.all(this.promises))
      .then(resultObjects => Object.assign({}, ...resultObjects));
    
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

class InternalInstance {
  private definition: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)
  private parent: null | InternalInstance
  private globalHandlers = new Handlers()
  private resolved = null as Promise<Record<string, any>> | null
  private accumulations: Map<symbol | string, Array<symbol | string | Event>> = new Map();
  private eventAborter = new AbortController();
  child: null | InternalInstance = null
  
  constructor(
    parent: null | InternalInstance,
    machineDefinition: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>),
    private callbacks: {
      readonly changeCount: number;
      willChangeState: () => void;
      didChangeState: () => void;
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
  }
  
  get current(): null | string | Record<string, any> {
    if (this.child === null) {
      return this.definition.name;
    } else {
      // return [[this.definition.name], this.child.current];
      return { [this.definition.name]: this.child.current };
    }
  }
  
  private *generateActions(): Generator<EntryAction, void, undefined> {
    yield* this.globalHandlers.actions();
    if (this.child !== null) {
      yield* this.child.generateActions();
    }
  }
  
  get actions(): Array<EntryAction> {
    return Array.from(this.generateActions());
  }
  
  private async *valuePromises(): AsyncGenerator<Record<string, any>, void, undefined> {
    if (this.resolved !== null) {
      yield await this.resolved;
    }
    if (this.child !== null) {
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
    }
    
    return build().then(objects => Object.assign({}, ...objects));
    // return build().then(pairs => Object.fromEntries(pairs as any));
  }

  *allAccumulations(): Generator<[symbol | string, Array<string | symbol | Event>]> /*: Generator<{ key: symbol | string, events: Array<string | symbol | Event> }>*/ {
    for (const [key, events] of this.accumulations) {
      // yield { key, events };
      yield [key, events];
    }

    if (this.child !== null) {
      yield *this.child.allAccumulations();
    }
  }

  handleEvent(event: Event) {
    this.callbacks.willHandleEvent(event);
    this.receive(event);
    this.callbacks.didHandleEvent(event);
  }

  cleanup() {
    for (const [event, target] of this.globalHandlers.eventsToListenTo) {
      // Not sure if we still need this if we have abort signals, and for what versions of Node/browsers?
      target.removeEventListener(event, this);
    }
    this.eventAborter.abort();

    this.globalHandlers.reset();
  }
  
  consume(stateGenerator: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)) {
    this.cleanup();
    this.eventAborter = new AbortController();
    
    this.willEnter();

    const initialReturn = stateGenerator();    
    if (initialReturn[Symbol.iterator]) {
      const iterator = initialReturn[Symbol.iterator]();
      let reply: unknown = undefined;
      while (true) {
        const item = iterator.next(reply)
        if (item.done) {
          var initialGenerator = item.value;
          break;
        }
        
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
        target.addEventListener(event, this, { signal: this.eventAborter.signal } as AddEventListenerOptions);
      }
      
    } else if (typeof initialReturn === 'function') {
      var initialGenerator = initialReturn as any;
    } else {
      // throw new Error(`State Machine definition returned invalid initial value ${initialReturn}`);
    }
    
    this.transitionTo(initialGenerator);
  }
  
  willEnter() {
    this.callbacks.willChangeState();
  }
  
  didEnter() {
    this.callbacks.didChangeState();
    this.globalHandlers.runAlways(target => this.processTarget(target));
  }
  
  willExit() {
    this.globalHandlers.runExit();
  }
  
  transitionTo(stateDefinition?: StateDefinition) {
    if (stateDefinition !== undefined) {
      if (this.child !== null) {
        if (this.child.definition === stateDefinition) {
          return;
        }
        
        this.child.willExit();  
      }
      
      this.willExit();
  
      // this.resolved = null;
      
      const childInstance = new InternalInstance(this, stateDefinition, this.callbacks);
      this.child = childInstance;
      childInstance.didEnter();
    }
    
    // this.didEnter();
  }
  
  processTarget(target: Target): boolean {
    if ('type' in target) {
      if (target.type === "cond") {
        const result = typeof target.cond === 'boolean' ? target.cond : target.cond(this.callbacks.readContext);
        if (result) {
          if (this.parent !== null) {
            this.parent.transitionTo(target.target);
            return true;
          }
        }
      } else if (target.type === "compound") {
        let receiver: InternalInstance = this;
        for (const nestedTarget of target.targets) {
          receiver.transitionTo(nestedTarget);
          if (receiver.child !== null) {
            receiver = receiver.child;
          } else {
            break;
          }
        }
        // const targetA = target.targets[0];
        // this.transitionTo(targetA);
      }
    } else {
      if (this.parent !== null) {
        this.parent.transitionTo(target);
        return true;
      }
    }

    return false;
  }

  receive(event: string | symbol | Event) {
    this.child?.receive(event);

    const eventName = typeof event === 'string' || typeof event === 'symbol' ? event : event.type;

    const target = this.globalHandlers.targetForEvent(eventName);
    if (target !== undefined) {
      this.processTarget(target);
    }

    for (const [iteratedEventName, resultKey] of this.globalHandlers.eventsToAccumulate) {
      if (iteratedEventName === eventName) {
        const current = this.accumulations.get(resultKey) ?? [];
        this.accumulations.set(resultKey, current.concat(event));
        this.callbacks.didChangeAccumulations();
      }
    }
  }
}

class MachineStateChangedEvent extends Event {
  readonly value: string;

  constructor(type: string, value: string) {
    super(type)
    this.value = value;
  }
}

export function start(
  machine: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)
): MachineInstance {
  let _changeCount = -1;
  let _activeEvent: null | Event = null;
  let _aborter: null | AbortController = null;
  function ensureAborter(): AbortController {
    if (_aborter !== null) return _aborter;

    const newAborter = new AbortController();
    const signal = newAborter.signal;

    signal.addEventListener('abort', () => {
      instance.cleanup();
    }, { once: true });
    
    _aborter = newAborter;

    return newAborter;
  }
  
  const rootName = machine.name;
  const instance: InternalInstance = new InternalInstance(
    null,
    machine,
    {
      get changeCount() { return _changeCount },
      willChangeState() {
        _changeCount += 1;
      },
      didChangeState() {
        _aborter?.signal.dispatchEvent(new MachineStateChangedEvent('StateChanged', getCurrent() as string));
      },
      didChangeAccumulations() {
        _aborter?.signal.dispatchEvent(new Event('AccumulationsChanged'));
      },
      sendEvent(event, snapshotCount) {
        if (typeof snapshotCount === "number" && snapshotCount !== _changeCount) {
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
      }
    }
  );

  function getCurrent() {
    const current = instance.current;
    return current !== null ? current[rootName] : null;
  }

  let _cachedValue: undefined | MachineValue;
  function getValue() {
    if (_cachedValue?.change === _changeCount) {
      return _cachedValue;
    }

    let resultCache: undefined | Promise<unknown> = undefined;
    _cachedValue = Object.freeze({
      change: _changeCount,
      state: getCurrent(),
      actions: instance.actions,
      get results() {
        if (resultCache === undefined) {
          resultCache = instance.results;
        }
        return resultCache;
      }
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
      return getCurrent();
    },
    get signal() {
      return ensureAborter().signal;
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
    abort() {
      ensureAborter().abort();
    },
    get done() {
      return instance.child !== null;
    },
  };
}

export function onceStateChangesTo(machineInstance: MachineInstance, state: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    machineInstance.signal.addEventListener("StateChanged", (event: MachineStateChangedEvent) => {
      if (event.value === state) {
        resolve();
      }
    }, { signal, once: true });
  })
}
