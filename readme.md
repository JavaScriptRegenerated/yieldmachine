<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <p>Components for State Machines, using Generator Functions</p>
  <div>
    <a href="https://bundlephobia.com/result?p=yieldmachine">
      <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.4.12" alt="minified and gzipped size">
      <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.4.12" alt="minified size">
      <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.4.12" alt="zero dependencies">
    </a>
  </div>
</div>

## Goals

- States and machines can be reused — components for state machines.
- Nest machines inside one another — aid reuse and clarity.
- Interops with native JavaScript & browser features such as Promise, AbortSignal, and EventTarget.
- Consistently use built-in browser features such as offline status, promises, fetch, IntersectionObserver, ResizeObserver, window.location. Manage these things in a consistent way with a consistent interface.

### Problems that state machines solve

- Making sure my code is 100% robust and doesn't fall into inconsistent states is hard.
- It's easy to forget about error handling.
- Built-in browser features (such as InteractionObserver) are powerful but a pain to manage correctly.
- Managing various flavors of state is hard: the current URL, local storage, focused element, fetch response, caches, offline/online.

## Install

Requires Node.js 14 and up.

```console
npm add yieldmachine
```

## Overview

You define your machine using a function. For example, you could define a state machine representing a light switch. We’ll name our function `Switch`.

```ts
function Switch() {

}
```

Inside you declare each state you want as a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*).

Our `Switch` will have two states: `Off` and `On`. We return `Off` as that’s what we want as our initial state to be — our light is off by default.

```ts
import { on, start } from "yieldmachine";

function Switch() {
  function* Off() {
  }
  function* On() {
  }

  return Off;
}
```

Our `Switch` can be flicked on and off. The string `"FLICK"` is our event that will represent the flicking on and off of our switch.

When our `Switch` is `Off` and it is sent a `FLICK` event, it transitions to `On`.

And, when our `Switch` is `On` and it is sent a `FLICK` event, it transitions back to `Off`.

```ts
import { on, start } from "yieldmachine";

function Switch() {
  function* Off() {
    yield on("FLICK", On);
  }
  function* On() {
    yield on("FLICK", Off);
  }

  return Off;
}
```

Now our machine is ready to be run. We pass our `Switch` to the `start` function we import from `yieldmachine`, and it will run an instance of our machine. And as we send it `"FLICK"` message, you’ll see the `value` of our machine instance change.

```ts
const machine = start(Switch);
machine.value; // { state: "Off", change: 0 }
machine.next("FLICK");
machine.value; // { state: "On", change: 1 }
machine.next("FLICK");
machine.value; // { state: "Off", change: 2 }
```

## Benefits of Generator Functions

- Generator Functions are a built-in feature of JavaScript and TypeScript.
- They have built-in syntax highlighting, autocompletion, and general rich language support in editors like Visual Studio Code.
- Our states are represented by actual JavaScript functions.
  - This means if we pass a state that’s either spelled incorrectly or isn’t in scope, our editor will tell us.
  - Our states use the name of the function.
  - Generator Functions can be reused, composed, and partially applied like any function. This increases the modularity and reuse of our machine parts.
- Coming soon: our machine definitions can be serialized and deserialized. This means they could be generated on a back-end and sent to the front-end. They could be stored away in a database. They could even be generated dynamically on the fly.

## Documentation

### `start(machineDefinition: Function | GeneratorFunction, options: { signal?: AbortSignal })`

Starts a machine, transitioning to its initially returned state.

### `.value`

#### `.value.state: string | Record<string, unknown>`

The current state of the machine. If machines were nested then an object is returned with the parent machine as the key, and its current state as the value.

#### `.value.change: number`

The number of times this machine has transitioned. Useful for consumers updating only when changes have been made.

#### `.value.results: Promise<unknown>`

The result of calling functions passed to `entry()` or `exit()`.

### `.next(eventName: string | symbol)`

Sends an event to the machine, transitioning if the event was recognised. Unrecognised events are ignored.

### `.stop()`

Cleans up the machine.


## Messages

### `on(eventName: string | symbol, target: GeneratorFunction | Cond | Mapper)`

Transitions to the target state when the given event occurs.

```ts
import { on, start } from "yieldmachine";

function Switch() {
  function* Off() {
    yield on("FLICK", On);
    yield on("TOGGLE", On);
  }
  function* On() {
    yield on("FLICK", Off);
    yield on("TOGGLE", Off);
  }

  return Off;
}

const machine = start(Switch);
machine.value.state; // "Off"
machine.next("FLICK");
machine.value.state; // "On"
machine.next("TOGGLE");
machine.value.state; // "Off"
```

#### `cond(predicate: (readContext: ReadContextCallback) => boolean, target: GeneratorFunction)`

Passed as the 2nd argument to `on()` to conditionally transition to an event. Can read from context to help make its decision.

### `entry(action: ({ signal }: { signal: AbortSignal }) => undefined | unknown | Promise<unknown>)`

Runs the provided function when this state is entered. If the function returns a promise, its value is made available in the `.results` property of the machine, keyed by the name of this passed function.

A signal is provided which is useful for passing to `fetch()` or `eventTarget.addEventListener()`. This signal is aborted on exit.

```ts
import { start, on, enter } from "yieldmachine";

let onCount = 0;
function recordOn() {
  onCount++;
}

function Switch() {
  function* Off() {
    yield on("FLICK", On);
  }
  function* On() {
    yield entry(recordOn);
    yield on("FLICK", Off);
  }

  return Off;
}

const machine = start(Switch);
machine.next("FLICK");
console.log(onCount, machine.value.state); // 1, "ON"
machine.next("FLICK");
console.log(onCount, machine.value.state); // 1, "OFF"
machine.next("FLICK");
console.log(onCount, machine.value.state); // 2, "ON"
```

### `exit(action: () => undefined | unknown | Promise<unknown>)`

Runs the provided function when this state is exited.

```ts
import { start, on, exit } from "yieldmachine";

let lastSessionEnded = null;
function recordSessionEnd() {
  lastSessionEnded = new Date();
}

function Session() {
  function* SignedOut() {
    yield on("AUTHENTICATE", SignedIn);
  }
  function* SignedIn() {
    yield exit(recordSessionEnd);
    yield on("LOG_OFF", SignedOut);
  }

  return SignedOut;
}

const machine = start(Switch);
console.log(lastSessionEnded, machine.value.state); // null, "SignedOut"
machine.next("AUTHENTICATE");
console.log(lastSessionEnded, machine.value.state); // null, "SignedIn"
machine.next("LOG_OFF");
console.log(lastSessionEnded, machine.value.state); // (current time), "SignedOut"
```

### `listenTo(sender: EventTarget, eventName: string | string[])`

Listens to an `EventTarget` — for example, an HTMLElement like a button.

Uses [`.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) to listen to the event. The listener is removed when transitioning to a different state or when the machine is stopped, so no extra clean up is necessary.

```ts
function ButtonClickListener(button: HTMLButtonElement) {
  function* initial() {
    yield on("click", clicked);
    yield listenTo(button, "click");
  }
  function* clicked() {}

  return initial;
}

const button = document.createElement('button');
const machine = start(ButtonClickListener.bind(null, button));

machine.value; // { state: "initial", change: 0 }
button.click();
machine.value; // { state: "clicked", change: 1 }
button.click();
machine.value; // { state: "initial", change: 1 }
```

## Examples

### HTTP Loader

```javascript
import { entry, on, start } from "yieldmachine";

const exampleURL = new URL("https://example.org/");
function fetchData() {
  return fetch(exampleURL);
}

// Define a machine just using functions
function Loader() {
  // Each state is a generator function
  function* idle() {
    yield on("FETCH", loading);
  }
  // This is the ‘loading’ state
  function* loading() {
    // This function will be called when this state is entered.
    // Its return value is available at `loader.results.fetchData`
    yield entry(fetchData);
    // If the promise succeeds, we will transition to the `success` state
    // If the promise fails, we will transition to the `failure` state
    yield on("SUCCESS", success);
    yield on("FAILURE", failure);
  }
  // States that don’t yield anything are final
  function* success() {}
  // Or they can define transitions to other states
  function* failure() {
    // When the RETRY event happens, we transition from ‘failure’ to ‘loading’
    yield on("RETRY", loading);
  }

  // Return the initial state from your machine definition
  return idle;
}

const loader = start(Loader);
loader.value; // { state: "idle", change: 0 }

loader.next("FETCH");
loader.value; // { state: "loading", change: 1, results: Promise }

loader.value.results.then((results) => {
  console.log("Fetched", results.fetchData); // Use response of fetch()
  loader.value.state; // "success"
});

/* Or with await: */
// const { fetchData } = await loader.value.results;
// loader.value.state; // "success"
```

### Passing parameters to a machine with closures

```javascript
import { entry, on, start } from "yieldmachine";

// Function taking as many arguments as you like
function GenericLoader(url) {
  function fetchData() {
    return fetch(url);
  }

  function* idle() {
    yield on("FETCH", loading);
  }
  function* loading() {
    yield entry(fetchData);
    yield on("SUCCESS", success);
    yield on("FAILURE", failure);
  }
  function* success() {}
  function* failure() {
    yield on("RETRY", loading);
  }

  return idle;
}

// Function taking no arguments that will define our machine
function SpecificLoader() {
  const exampleURL = new URL("https://example.org/");
  return GenericLoader(exampleURL);
}

// Start our specific loader machine
const loader = start(SpecificLoader);
loader.value; // { state: "idle", change: 0 }

loader.next("FETCH");
loader.value; // { state: "loading", change: 1, results: Promise }

loader.value.results.then((results) => {
  console.log("Fetched", results.fetchData); // Use response of fetch()
  loader.value.state; // "success"
});
```

### `AbortController` wrapper that listens to "abort" event

```ts
function* AbortListener(controller: AbortController) {
  function* Initial() {
    yield on("abort", Aborted);
    yield listenTo(controller.signal, ["abort"]);
  }
  function* Aborted() {}

  return new Map([
    [() => controller.signal.aborted, Aborted],
    [null, Initial],
  ]);
}

const aborter = new AbortController();
const machine = start(AbortListener.bind(null, aborter));

machine.value; // { state: "initial", change: 0 }
aborter.abort();
machine.value; // { state: "aborted", change: 1 }
```

----

## Minifiers

If you use a minifier then your function name will be changed to a short name like `d` instead of `On`. To get around this, you can specify your states as methods (which are not usually minified) like so:

```js
function SwitchMachine() {
  const { On, Off } = {
    *Off() {
      yield on("FLICK", On);
    },
    *On() {
      yield on("FLICK", Off);
    }
  };
  return Off;
}
```

----

## TODO

- [ ] Parallel states by returning object for initial state
- [ ] Assign data somehow?
- [ ] Allow sending objects: `Event | { type: string }`
- [ ] More examples!
- [ ] Hook for React
- [ ] Hook for Preact
- [ ] Hook for Vue

```js
function *Parallel() {
  function Light1() {
    function* Off() {
      yield on('toggle_switch_1', On);
    }
    function* On() {
      yield on('toggle_switch_1', Off);
    }
    return Off;
  }

  function Light2() {
    function* Off() {
      yield on('toggle_switch_2', On);
    }
    function* On() {
      yield on('toggle_switch_2', Off);
    }
    return Off;
  }

  return [
    Light1,
    Light2
  ];
}
```

```js
function *ParallelWithANDState() {
  function Light1() {
    function* Off() {
      yield on('toggle_switch_1', On);
    }
    function* On() {
      yield on('toggle_switch_1', Off);
    }
    return Off;
  }

  function Light2() {
    function* Off() {
      yield on('toggle_switch_2', On);
    }
    function* On() {
      yield on('toggle_switch_2', Off);
    }
    return Off;
  }

  // function* Light3() {
  //   function* Off() {}
  //   function* On() {}

  //   return conds(new Map([
  //     [hasState(Light1, 'Off'), Off],
  //     [hasState(Light2, 'Off'), Off],
  //     [true, On],
  //   ]));
  // }

  function* Light3() {
    const light1Off = yield readHasState(Light1, 'Off');
    const light2Off = yield readHasState(Light2, 'Off');

    function* Off() {}
    function* On() {}
    function* checking() {
      yield cond(light1Off, Off);
      yield cond(light2Off, Off);
      yield always(On);
    }

    return checking;
  }

  // Alternative
  function* Light3() {
    const onCount = yield readCountSiblings('Off');

    function* Off() {}
    function* On() {}
    function* checking() {
      yield cond(onCount === 2, Off);
      // yield cond(`${onCount} === ${2}`, Off);
      // yield condIs(Off, onCount, 2);
      yield always(On);
    }

    return checking;
  }

  return [
    Light1,
    Light2,
    Light3
  ];
}
```

----

Further reading / inspiration:
- [XState](https://xstate.js.org/)
- [Robot](https://thisrobot.life/)
- [Welcome to the world of Statecharts](https://statecharts.github.io/)
    - [Resources](https://statecharts.github.io/resources.html)
- [Apache Commons guide to SCXML](https://commons.apache.org/proper/commons-scxml/guide/scxml-documents.html)
- [PingPong in P](https://github.com/p-org/P/wiki/PingPong-program)
