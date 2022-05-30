import { on, accumulate, start, map } from "./index";

describe("Pagination", () => {
  function* Paginator() {
    yield on("previous_page", map((page: number) => Math.max(1, page - 1)));
    yield on("next_page", map((page: number) => page + 1));

    return 1;
  }

  test("sending events", () => {
    const machine = start(Paginator);
    expect(machine).toBeDefined();
    expect(machine.value.state).toEqual(1);
    machine.next("next_page");
    expect(machine.value.state).toEqual(2);
    machine.next("next_page");
    expect(machine.value.state).toEqual(3);
    machine.next("previous_page");
    expect(machine.value.state).toEqual(2);
    machine.next("previous_page");
    expect(machine.value.state).toEqual(1);
    machine.next("previous_page");
    expect(machine.value.state).toEqual(1);
  });
});
