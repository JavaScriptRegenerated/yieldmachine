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
export interface Compound {
  type: "compound";
  targets: Array<StateDefinition>;
}
export type Target = StateDefinition | Cond | Compound;
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

export function compound(...targets: Array<StateDefinition>): Compound {
  return { type: "compound", targets };
}

export interface MachineInstance extends Iterator<null | string | Record<string, string>, void, string> {
  changeCount: number;
  current: null | string | Record<string, string>;
  results: null | Promise<Array<any>>;
  done: boolean;
  next(
    ...args: [string]
  ): IteratorResult<null | string | Record<string, string>> &
    PromiseLike<any> & {
      actions: Array<EntryAction | ExitAction>;
    };
}

class Handlers {
  private eventsMap = new Map<string, Target>();
  private alwaysArray = new Array<Target>();
  private entryActions = [] as Array<EntryAction>;
  private exitActions = [] as Array<ExitAction>;
  private promises = [] as Array<Promise<any>>;
  private promise: null | Promise<Array<any>> = null;
  
  *actions(): Generator<EntryAction, void, undefined> {
    yield* this.entryActions;
  }
  
  reset() {
    this.eventsMap.clear();
    this.entryActions.splice(0, Infinity);
    this.exitActions.splice(0, Infinity);
    this.alwaysArray.splice(0, Infinity);
    this.promises.splice(0, Infinity);
  }
  
  add(value: Yielded) {
    if (value.type === "entry") {
      this.entryActions.push(value);
      
      const resultPromise = new Promise((resolve) => {
        resolve(value.f());
      }).then(result => ({ [value.f.name]: result }));
      this.promises.push(resultPromise);
      
    } else if (value.type === "exit") {
      this.exitActions.push(value);
    } else if (value.type === "on") {
      this.eventsMap.set(value.on, value.target);
    } else if (value.type === "always") {
      this.alwaysArray.push(value.target);
    }
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
  
  targetForEvent(event: string) {
    return this.eventsMap.get(event);
  }
}

class InternalInstance {
  private definition: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)
  private parent: null | InternalInstance
  private globalHandlers = new Handlers()
  private resolved = null as Promise<Record<string, any>> | null
  child: null | InternalInstance = null
  
  constructor(
    parent: null | InternalInstance,
    machineDefinition: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>),
    private callbacks: {
      changeCount: number;
      didChange: () => void;
      sendEvent: (event: string, changeCount?: number) => void;
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
      return { [this.definition.name]: this.child.current };
    }
    // if (this.child === null) {
    //   return null;
    // }
    // 
    // return this.child.definition.name;
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
  }
  
  consume(stateGenerator: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)) {
    const initialReturn = stateGenerator();
    
    this.willEnter();
    
    this.globalHandlers.reset();
    
    if (initialReturn[Symbol.iterator]) {
      const iterator = initialReturn[Symbol.iterator]();
      while (true) {
        const item = iterator.next()
        if (item.done) {
          var initialGenerator = item.value;
          break;
        }
        
        this.globalHandlers.add(item.value);
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
      
    } else if (typeof initialReturn === 'function') {
      var initialGenerator = initialReturn as any;
    } else {
      // throw new Error(`State Machine definition returned invalid initial value ${initialReturn}`);
    }
    
    this.transitionTo(initialGenerator);
  }
  
  willEnter() {
    this.callbacks.didChange();
  }
  
  didEnter() {
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
        const result = target.cond();
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

  receive(event: string) {
    this.child?.receive(event);

    const target = this.globalHandlers.targetForEvent(event);
    if (target !== undefined) {
      this.processTarget(target);
    }
  }
}

export function start(
  machine: (() => StateDefinition) | (() => Generator<Yielded, StateDefinition, never>)
): MachineInstance {
  let changeCount = -1;
  
  const rootName = machine.name;
  const instance: InternalInstance = new InternalInstance(
    null,
    machine,
    {
      get changeCount() { return changeCount },
      didChange() { changeCount += 1 },
      sendEvent(event, snapshotCount) {
        if (typeof snapshotCount === "number" && snapshotCount !== changeCount) {
          return;
        }
        instance.receive(event);
      }
    }
  );
  
  changeCount = 0;

  return {
    get changeCount() {
      return changeCount;
    },
    get current() {
      return instance.current !== null ? instance.current[rootName] : null;
    },
    get results() {
      return instance.results;
    },
    next(event: string) {
      instance.receive(event);
      const promise = instance.results;
      return {
        value: instance.current !== null ? instance.current[rootName] : null,
        actions: instance.actions,
        then: promise?.then.bind(promise),
        done: false,
      };
    },
    get done() {
      return instance.child !== null;
    },
  };
}
