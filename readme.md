<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <p>Composable State Machines using Generator Functions</p>
  <div>
    <a href="https://bundlephobia.com/result?p=yieldmachine">
      <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.4.1" alt="minified and gzipped size">
      <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.4.1" alt="minified size">
      <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.4.1" alt="zero dependencies">
    </a>
  </div>
</div>

## Overview

- Define state machine components using generators functions.
- States can be reused.
- Nest machines inside one another.
- Use native JavaScript features such as Promise, AbortSignal, and EventTarget.
- Conform various stateful things such as offline status, promises, fetch, IntersectionObserver, ResizeObserver, window.location. Manage these things in a consistent way with a consistent interface.

### Problems

+ Making sure my code is 100% robust and doesn't fall into inconsistent states is hard.
- It's easy to forget about error handling.
- Built-in browser features (such as InteractionObserver) are powerful but a pain to manage correctly.
- Managing various flavors of state is hard: the current URL, local storage, focused element, fetch response, caches, offline/online.

## Install

```console
npm add yieldmachine
```

## `start(machineDefinition: GeneratorFunction)`

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

### `enter(action: () => undefined | unknown | Promise<unknown>)`

Runs the provided function when this state is entered. If the function returns a promise, its value is made available in the `.results` property of the machine, keyed by the name of this passed function.

### `exit(action: () => undefined | unknown | Promise<unknown>)`

Runs the provided function when this state is exited.

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
