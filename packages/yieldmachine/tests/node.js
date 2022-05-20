const assert = require('assert');
const { start, on } = require("../dist/yieldmachine");

function Switch() {
  function* OFF() {
    yield on("FLICK", ON);
  }
  function* ON() {
    yield on("FLICK", OFF);
  }

  return OFF;
}

const machine = start(Switch);
assert.ok(machine);
assert.strictEqual(machine.current, "OFF");

machine.next("FLICK");
assert.strictEqual(machine.current, "ON");
assert.strictEqual(machine.changeCount, 1);

machine.next("FLICK");
assert.strictEqual(machine.current, "OFF");
assert.strictEqual(machine.changeCount, 2);
