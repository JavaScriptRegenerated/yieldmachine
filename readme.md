<div align="center">
  <h1>👑 ⚙️ Yield Machine</h1>
  <a href="https://bundlephobia.com/result?p=yieldmachine">
    <img src="https://badgen.net/bundlephobia/minzip/yieldmachine@0.1.0" alt="minified and gzipped size">
    <img src="https://badgen.net/bundlephobia/min/yieldmachine@0.1.0" alt="minified size">
    <img src="https://badgen.net/bundlephobia/dependency-count/yieldmachine@0.1.0" alt="zero dependencies">
  </a>
</div>

State Machines using Generator Functions

## Install

```console
npm add yieldmachine
```

## Examples

```javascript
import { call, on, start } from "yieldmachine";

function Loader({ url }: { url: URL }) {
  function* idle() {
    yield on("FETCH", loading);
  }
  function* loading() {
    yield call(fetch, [url.toString()]);
    yield on("SUCCESS", success);
    yield on("FAILURE", failure);
  }
  function* success() {}
  function* failure() {
    yield on("RETRY", loading);
  }

  return idle;
}

const loader = start(Loader, { url: new URL("https://example.org/") });

loader.next("FETCH");
loader.value; // "loading"

loader.promisedValue.then(response => {
  // Use response of fetch()
});
```
