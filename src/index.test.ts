import { call, entry, on, start } from "./index";

const fetch = jest.fn();
beforeEach(fetch.mockClear);

describe("Machine with entry", () => {
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

  const someURL = new URL("https://example.org/");
  function fetchData() {
    return fetch(someURL.toString());
  }

  test("creating", () => {
    const loader = start(Loader);
    expect(loader).toBeDefined();
  });

  describe("when fetch succeeds", () => {
    beforeEach(() => {
      fetch.mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader);
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      loader.next("NOOP");
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      const { actions } = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/");
      expect(actions).toEqual([{ type: "entry", then: fetchData }]);
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      await expect(loader.promisedValue).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");
      
      loader.next("FETCH");
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");

      await loader.promisedValue;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(new Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader, [{ url: someURL }]);
      expect(loader.value).toEqual("idle");

      const { actions } = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");
      expect(actions).toEqual([{ type: "entry", then: fetchData }]);
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      await expect(loader.promisedValue).rejects.toEqual(new Error("Failed!"));
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("failure");

      loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);
      
      loader.next("RETRY");
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(3);
      
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");

      await expect(loader.promisedValue).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(4);
      expect(loader.value).toEqual("success");
    });
  });
});

describe("Machine with call", () => {
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

  const someURL = new URL("https://example.org/");

  test("creating", () => {
    const loader = start(Loader, [{ url: someURL }]);
    expect(loader).toBeDefined();
  });

  describe("when fetch succeeds", () => {
    beforeEach(() => {
      fetch.mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader, [{ url: someURL }]);
      expect(loader.value).toEqual("idle");
      await expect(loader.promisedValue).resolves.toEqual([]);

      loader.next("NOOP");
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);
      await expect(loader.promisedValue).resolves.toEqual([]);

      loader.next("FETCH");
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      expect(fetch).toHaveBeenCalledWith("https://example.org/");

      await expect(loader.promisedValue).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");

      loader.next("FETCH");
      expect(loader.changeCount).toEqual(2);

      await loader.promisedValue;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(new Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader, [{ url: someURL }]);
      expect(loader.value).toEqual("idle");

      loader.next("FETCH");
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");

      await expect(loader.promisedValue).rejects.toEqual(new Error("Failed!"));
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("failure");

      loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);

      loader.next("RETRY");
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(3);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");

      await expect(loader.promisedValue).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(4);
      expect(loader.value).toEqual("success");
    });
  });
});
