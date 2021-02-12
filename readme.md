<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <div style="margin-bottom: 1em">Define State Machines using Generator Functions</div>
  <div>
    <a href="https://bundlephobia.com/result?p=yieldmachine">
      <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.2.0" alt="minified and gzipped size">
      <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.2.0" alt="minified size">
      <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.2.0" alt="zero dependencies">
    </a>
  </div>
</div>

## Install

```console
npm add yieldmachine
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
    yield entry(fetchData);
    yield on("SUCCESS", success);
    yield on("FAILURE", failure);
  }
  // States can be final
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
loader.value; // "idle"

loader.next("FETCH");
loader.value; // "loading"

loader.resolved.then((result) => {
  console.log("Fetched", result.fetchData);
  // Use response of fetch()
  loader.value; // "success"
});

/* Or with await: */
// const { fetchData } = await loader.resolved;
// loader.value; // "success"
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
loader.value; // "idle"

loader.next("FETCH");
loader.value; // "loading"

loader.resolved.then(([response]) => {
  // Use response of fetch()
  loader.value; // "success"
});
```


----

## TODO

- [ ] Parallel states by returning object for initial state
- [ ] More examples!
- [ ] Hook for React
- [ ] Hook for Preact

----

Further reading / inspiration:
- [XState](https://xstate.js.org/)
- [Robot](https://thisrobot.life/)
- [Welcome to the world of Statecharts](https://statecharts.github.io/)
- [Apache Commons guide to SCXML](https://commons.apache.org/proper/commons-scxml/guide/scxml-documents.html)
- [PingPong in P](https://github.com/p-org/P/wiki/PingPong-program)
