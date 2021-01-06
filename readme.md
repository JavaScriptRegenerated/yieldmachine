<div align="center">
  <h1>💎 Unyielding</h1>
  <a href="https://bundlephobia.com/result?p=unyielding">
    <img src="https://badgen.net/bundlephobia/minzip/unyielding@0.1.1" alt="minified and gzipped size">
    <img src="https://badgen.net/bundlephobia/min/unyielding@0.1.1" alt="minified size">
    <img src="https://badgen.net/bundlephobia/dependency-count/unyielding@0.1.1" alt="zero dependencies">
  </a>
</div>

Lightweight Components using Generator Functions

## Install

```console
npm add unyielding
```

## Examples

### Components

```javascript
import { html, renderToString } from "unyielding";

function* NavLink(link) {
  yield html`<li>`;
  yield html`<a href="${link.url}">`;
  yield link.title;
  yield html`</a>`;
  yield html`<li>`;
}

function* Nav(links) {
  yield html`<nav aria-label="Primary">`;
  yield html`<ul>`;

  for (const link of links) {
    yield NavLink(link);
  }

  yield html`</ul>`;
  yield html`</nav>`;
}

function* PrimaryNav() {
  yield Nav([
    { url: '/', title: 'Home' },
    { url: '/pricing', title: 'Pricing' },
    { url: '/features', title: 'Features' },
    { url: '/terms', title: 'Terms & Conditions' },
  ]);
}

const html = await renderToString([PrimaryNav()]);
```

### Attributes

```javascript
import { attributes, html } from "unyielding";

function CreatePhotoForm() {
  yield html`<form ${attributes({ method: 'post', action: '/photo' })}>`;
  // …
  yield html`</form>`;
}
```

### Data attributes

```javascript
import { dataset, html } from "unyielding";

function Item({ uuid, title }) {
  yield html`<article ${dataset({ uuid })}>`;
  yield html`<h2>`;
  yield title;
  yield html`</h2>`;
  yield html`</article>`;
}
```

## TODO / Ideas

```javascript
// Yield function with name of HTML tag
function Nav(links) {
  yield html`<nav aria-label="Primary">`;

  yield function* ul() {
    for (const link of links) {
      yield NavLink(link);
    }
  };

  yield html`</nav>`;
}

// Yield function with name of landmark
function Page() {
  yield PrimaryNav();

  yield function* main() { // <main>
    yield Heading("Welcome!");
  }

  yield function* contentinfo() { // <footer role=contentinfo>
    yield FooterLinks();
  }
}

// Perhaps allow attributes to be set
function Nav2(links) {
  yield function* nav() {
    yield attributes({ "aria-label": "Primary" });

    yield function* ul() {
      for (const link of links) {
        yield NavLink(link);
      }
    };
  }
}
```
