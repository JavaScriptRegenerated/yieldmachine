import type {
  ChoiceDefinition,
  PrimitiveState,
  StateDefinition,
  Yielded,
} from "./index";
import { on } from "./index";

type MachineDefinition =
  | (() => StateDefinition)
  | (() => Generator<Yielded, StateDefinition, never>)
  | (() => Generator<Yielded, PrimitiveState, never>)
  | (() => Generator<Yielded, ChoiceDefinition, never>);

function convertToZigSourceCode(machine: MachineDefinition): string {
  const visited = new Set<MachineDefinition>();
  const states = new Set<string>();
  const transitions = new Map<string, Map<string, string>>();

  function addTransition(event: string, from: string, to: string) {
    if (!transitions.has(event)) {
      transitions.set(event, new Map);
    }
    const eventTransitions = transitions.get(event)!;
    eventTransitions.set(from, to);
  }

  function consume(stateDefinition: MachineDefinition) {
    if (visited.has(stateDefinition)) {
      return;
    }

    visited.add(stateDefinition);

    const result = stateDefinition();
    if ((result as any)[Symbol.iterator]) {
      const iterator: Iterator<any, unknown, unknown> = (result as any)[
        Symbol.iterator
      ]();
      let reply: unknown = undefined;
      while (true) {
        const item = iterator.next(reply);
        if (item.done) {
          if (typeof item.value === "function") {
            states.add(item.value.name);
            consume(item.value as any);
          }
          break;
        }

        const value = item.value;
        if (value != null && "type" in value && typeof value.type === "string") {
          if (value.type === "on") {
            if (typeof value.target === "function") {
              states.add(value.target.name);
              addTransition(value.on.toString(), stateDefinition.name, value.target.name);

              consume(value.target);
            }
          }
        }
      }
    } else if (typeof result === "function") {
      states.add(result.name);
      consume(result as any);
    }
  }

  consume(machine);

  return `const mem = @import("std").mem;
const ComptimeStringMap = @import("std").ComptimeStringMap;
const testing = @import("std").testing;

const Switch = struct {
    pub const State = enum(u8) {
        ${Array.from(states).join(",\n        ")},
    };

    pub const Event = enum {
        ${Array.from(transitions.keys()).join(",\n        ")},

        pub fn transition(self: Event, state: State) State {
            switch (self) {
                ${Array.from(transitions, ([event, fromTo]) => {
                  return `.${event} => {
                    return switch (state) {
                        ${Array.from(fromTo, ([from, to]) => {
                          return `State.${from} => State.${to},`
                        }).join("\n                        ")}
                    };
                },`
                }).join("\n")}
            }
        }
    };

    const Events = ComptimeStringMap(Event, .{.{ @tagName(Event.flick), .flick }});

    state: State,
    change: u64 = 0,

    pub fn transition(self: Switch, event: Event) Switch {
        var copy = self;
        copy.state = event.transition(self.state);
        copy.change += 1;
        return copy;
    }

    pub fn next(self: Switch, eventName: [:0]const u8) Switch {
        if (Events.get(eventName)) |event| {
            return self.transition(event);
        }

        return self;
    }
};`;
}

test("binary switch", () => {
  function Switch() {
    function* Off() {
      yield on("flick", On);
    }
    function* On() {
      yield on("flick", Off);
    }

    return Off;
  }

  const output = `
const mem = @import("std").mem;
const ComptimeStringMap = @import("std").ComptimeStringMap;
const testing = @import("std").testing;

const Switch = struct {
    pub const State = enum(u8) {
        Off,
        On,
    };

    pub const Event = enum {
        flick,

        pub fn transition(self: Event, state: State) State {
            switch (self) {
                .flick => {
                    return switch (state) {
                        State.Off => State.On,
                        State.On => State.Off,
                    };
                },
            }
        }
    };

    const Events = ComptimeStringMap(Event, .{.{ @tagName(Event.flick), .flick }});

    state: State,
    change: u64 = 0,

    pub fn transition(self: Switch, event: Event) Switch {
        var copy = self;
        copy.state = event.transition(self.state);
        copy.change += 1;
        return copy;
    }

    pub fn next(self: Switch, eventName: [:0]const u8) Switch {
        if (Events.get(eventName)) |event| {
            return self.transition(event);
        }

        return self;
    }
};
`.trim();

  expect(convertToZigSourceCode(Switch)).toEqual(output);
});
