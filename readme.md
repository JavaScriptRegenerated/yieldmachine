<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <p>Define State Machines using Generator Functions</p>
  <div>
    <a href="https://bundlephobia.com/result?p=yieldmachine">
      <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.4.1" alt="minified and gzipped size">
      <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.4.1" alt="minified size">
      <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.4.1" alt="zero dependencies">
    </a>
  </div>
</div>

## Install

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

Now our machine is ready to be run. We pass our `Switch` to the `start` function we import from `yieldmachine`, and it will run an instance of our machine. And as we send it `"FLICK"` message, you’ll see the `current` state of our machine instance change.

```ts
const machine = start(Switch);
machine.current; // "Off"
machine.next("FLICK");
machine.current; // "On"
machine.next("TOGGLE");
machine.current; // "Off"
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

### `start(machineDefinition: Function | GeneratorFunction)`

Starts a machine, transitioning to its initially returned state.

### `.current: string | Record<string, unknown>`

The current state of the machine. If machines were nested then an object is returned with the parent machine as the key, and its current state as the value.

### `.changeCount: number`

The number of times this machine has transitioned. Useful for consumers updating only when changes have been made.

### `.results: Promise<unknown>`

The result of any `entry()` or `exit()` messages.

### `.next(eventName: string | symbol)`

Sends an event to the machine, transitioning if the event was recognised. Unrecognised events are ignored.

### `.stop()`

Cleans up the machine.


## Messages

### `on(eventName: string | symbol, target: GeneratorFunction)`

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
machine.current; // "Off"
machine.next("FLICK");
machine.current; // "On"
machine.next("TOGGLE");
machine.current; // "Off"
```

### `enter(action: () => undefined | unknown | Promise<unknown>)`

Runs the provided function when this state is entered. If the function returns a promise, its value is made available in the `.results` property of the machine, keyed by the name of this passed function.

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
    yield enter(recordOn);
    yield on("FLICK", Off);
  }

  return Off;
}

const machine = start(Switch);
machine.next("FLICK");
console.log(recordOn, machine.current); // 1, "ON"
machine.next("FLICK");
console.log(recordOn, machine.current); // 1, "OFF"
machine.next("FLICK");
console.log(recordOn, machine.current); // 2, "ON"
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
console.log(lastSessionEnded, machine.current); // null, "SignedOut"
machine.next("AUTHENTICATE");
console.log(lastSessionEnded, machine.current); // null, "SignedIn"
machine.next("LOG_OFF");
console.log(lastSessionEnded, machine.current); // (current time), "SignedOut"
```

### `cond(predicate: () => boolean, target: GeneratorFunction)`

Immediately transitions to the target state if the provided predicate function returns `true`.

### `always(target: GeneratorFunction)`

Immediately transitions to the target state, if previous `cond()` did not pass.

### `listenTo(sender: EventTarget, eventName: string)`

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

machine.current; // "initial"
button.click();
machine.current; // "clicked"
button.click();
machine.current; // "clicked"
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
loader.current; // "idle"

loader.next("FETCH");
loader.current; // "loading"

loader.results.then((results) => {
  console.log("Fetched", results.fetchData); // Use response of fetch()
  loader.current; // "success"
});

/* Or with await: */
// const { fetchData } = await loader.results;
// loader.current; // "success"
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
loader.current; // "idle"

loader.next("FETCH");
loader.current; // "loading"

loader.results.then((results) => {
  console.log("Fetched", results.fetchData); // Use response of fetch()
  loader.current; // "success"
});
```

### `AbortController` wrapper

```ts
function AbortListener(controller: AbortController) {
  function* initial() {
    if (controller.signal.aborted) {
      yield always(aborted);
    } else {
      yield on("abort", aborted);
      yield listenTo(controller.signal, "abort");
    }
  }
  function* aborted() {}

  return initial;
}

const aborter = new AbortController();
const machine = start(AbortListener.bind(null, aborter));

machine.current; // "initial"
aborter.abort();
machine.current; // "aborted"
```

----

## TODO

- [ ] Parallel states by returning object for initial state
- [ ] Assign data somehow?
- [ ] Allow sending objects: `Event | { type: string }`
- [ ] More examples!
- [ ] Hook for React
- [ ] Hook for Preact

----

Further reading / inspiration:
- [XState](https://xstate.js.org/)
- [Robot](https://thisrobot.life/)
- [Welcome to the world of Statecharts](https://statecharts.github.io/)
    - [Resources](https://statecharts.github.io/resources.html)
- [Apache Commons guide to SCXML](https://commons.apache.org/proper/commons-scxml/guide/scxml-documents.html)
- [PingPong in P](https://github.com/p-org/P/wiki/PingPong-program)
