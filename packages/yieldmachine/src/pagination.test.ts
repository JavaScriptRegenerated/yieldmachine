import { on, start, map, Mapper, readContext } from "./index";

function exposeAs(
  key: Symbol,
  mapper?: Mapper<boolean> | Mapper<number> | Mapper<string> | Mapper<symbol>
) {
  return {
    type: "expose",
    key,
    mapper,
  };
}

describe("Pagination", () => {
  const currentPage = Symbol("currentPage");
  const loadPageData = Symbol("loadPageData");
  const loadPageError = Symbol("loadPageError");
  function* Paginator() {
    yield on(
      "previous_page",
      map((page: number) => Math.max(1, page - 1))
    );
    yield on(
      "next_page",
      map((page: number) => page + 1)
    );
    // yield exposeAs(currentPage);

    return 1;
  }

  test("sending events", () => {
    const machine = start(Paginator);
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

describe.skip("Pagination future", () => {
  const currentPage = Symbol("currentPage");
  const loadPageData = Symbol("loadPageData");
  const loadPageError = Symbol("loadPageError");
  function* Paginator() {
    function* PaginationState() {
      yield on(
        "previous_page",
        map((page: number) => Math.max(1, page - 1))
      );
      yield on(
        "next_page",
        map((page: number) => page + 1)
      );
      yield exposeAs(currentPage);

      return 1;
    }
    function* Fetcher() {
      const page = readContext(currentPage);

      yield on("resolve", exposeAs([page, loadPageData]));

      yield fetch(`/movies?${new URLSearchParams({ page: page.toString() })}`);
    }

    yield on(
      "previous_page",
      map((page: number) => Math.max(1, page - 1))
    );
    yield on(
      "next_page",
      map((page: number) => page + 1)
    );
    // yield exposeAs(currentPage);

    return [Paginator, Fetcher];
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
