<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <a href="https://bundlephobia.com/result?p=yieldmachine">
    <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.1.1" alt="minified and gzipped size">
    <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.1.1" alt="minified size">
    <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.1.1" alt="zero dependencies">
  </a>
</div>

State Machines using Generator Functions

## Install

```console
npm add yieldmachine
```

## Examples

```javascript
import { entry, on, start } from "yieldmachine";

const exampleURL = new URL("https://example.org/");
function fetchData() {
  return fetch(exampleURL.toString());
}

function Loader() {
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

const loader = start(Loader);
loader.value; // "idle"

loader.next("FETCH");
loader.value; // "loading"

loader.resolved.then(([response]) => {
  // Use response of fetch()
  loader.value; // "success"
});

/* Or with await: */
// const [response] = await loader.resolved;
// loader.value; // "success"
```
