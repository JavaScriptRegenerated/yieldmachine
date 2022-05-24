import { listenTo, on } from "./index";

// function* DetailsListenerNamedStates(el: HTMLDetailsElement) {
//   const checkingOpen: ReadonlyMap<boolean | (() => boolean), any> = new Map([
//       [() => el.open, Open],
//       [true, Closed]
//   ])

//   yield listenTo(el, ["toggle"]);
//   yield on("toggle", checkingOpen);

//   function* Closed() { }
//   function* Open() { }

//   return checkingOpen;
// }

// function* DetailsListenerBoolean(el: HTMLDetailsElement) {
//   yield listenTo(el, ["toggle"]);
//   yield on("toggle", () => el.open);

//   return el.open;
// }

describe("it works with a Map", () => {
  it.todo("works")
})
