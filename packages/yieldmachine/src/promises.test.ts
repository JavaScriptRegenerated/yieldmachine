/**
 * @jest-environment jsdom
 */

import { entry, exit, on, start } from "./index";

describe("Machine with entry and exit actions", () => {
  const fetch = jest.fn();
  beforeEach(fetch.mockClear);

  const finishedLoading = jest.fn();
  beforeEach(finishedLoading.mockClear);

  const succeeded = jest.fn();
  beforeEach(succeeded.mockClear);

  const someURL = new URL("https://example.org/");
  function fetchData() {
    return fetch(someURL.toString());
  }

  function Loader() {
    function* idle() {
      yield on("FETCH", loading);
    }
    function* loading() {
      yield entry(fetchData);
      yield exit(finishedLoading);
      yield on("SUCCESS", success);
      yield on("FAILURE", failure);
    }
    function* success() {
      yield entry(succeeded);
    }
    function* failure() {
      yield on("RETRY", loading);
    }

    return idle;
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
      expect(loader.value).toMatchObject({
        change: 0,
        state: "idle",
        actions: [],
      });
      expect(loader.changeCount).toEqual(0);
      expect(loader.current).toEqual("idle");

      const valueA = loader.value;
      loader.next("NOOP");
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);
      expect(loader.value).toBe(valueA);

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/");
      expect(transitionResult.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [{ type: "entry", f: fetchData }],
      });
      expect(loader.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [{ type: "entry", f: fetchData }],
      });
      expect(loader.value).not.toBe(valueA);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.value.results).resolves.toEqual({ fetchData: 42 });
      await expect(
        Promise.resolve(transitionResult.value.results)
      ).resolves.toEqual({
        fetchData: 42,
      });
      expect(finishedLoading).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      const transitionResult2 = loader.next("FETCH");
      // expect(transitionResult2.actions).toEqual([]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      await loader.results;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(new Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader);
      expect(loader.value).toMatchObject({
        change: 0,
        state: "idle",
        actions: [],
      });

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");
      expect(transitionResult.value.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.value).toMatchObject({
        change: 1,
        state: "loading",
        actions: [{ type: "entry", f: fetchData }],
      });

      // await expect(loader.value.results).rejects.toEqual(new Error("Failed!"));
      await expect(loader.value.results).rejects.toBeInstanceOf(Error);
      await expect(
        Promise.resolve(transitionResult.value.results)
      ).rejects.toEqual(new Error("Failed!"));
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("failure");

      loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);

      loader.next("RETRY");
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(3);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");

      await expect(loader.results).resolves.toEqual({ fetchData: 42 });
      expect(loader.changeCount).toEqual(4);
      expect(loader.current).toEqual("success");
    });
  });
});

describe("Fetch with abort signal", () => {
  const fetch = jest.fn();
  beforeEach(fetch.mockClear);

  const finishedLoading = jest.fn();
  beforeEach(finishedLoading.mockClear);

  const succeeded = jest.fn();
  beforeEach(succeeded.mockClear);

  const someURL = new URL("https://example.org/");
  function fetchData({ signal }: { signal: AbortSignal }) {
    return fetch(someURL.toString(), { signal });
  }

  function Loader() {
    const aborterKey = Symbol("aborter");
    // yield register(aborterKey, () => new AbortController());
    // yield register(function aborter() { return new AbortController() });

    function* idle() {
      yield on("FETCH", loading);
    }
    function* loading() {
      // yield entry(aborterKey);

      yield entry(fetchData);
      yield exit(finishedLoading);
      yield on("SUCCESS", success);
      yield on("FAILURE", failure);
      // yield forward(AbortController.prototype.abort, aborter);
      // yield forward("abort", aborter);
      // yield forward("CANCEL", aborter);
      // yield forward("CANCEL", aborterKey);
    }
    function* success() {
      yield entry(succeeded);
    }
    function* failure() {
      yield on("RETRY", loading);
    }

    return idle;
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
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      loader.next("NOOP");
      expect(loader.current).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/", {
        signal: expect.any(AbortSignal),
      });
      expect(transitionResult.value.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.value.results).resolves.toEqual({ fetchData: 42 });
      await expect(transitionResult.value.results).resolves.toEqual({
        fetchData: 42,
      });
      expect(finishedLoading).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      const transitionResult2 = loader.next("FETCH");
      // expect(transitionResult2.actions).toEqual([]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("success");
      expect(succeeded).toHaveBeenCalledTimes(1);

      await loader.results;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader);
      expect(loader.current).toEqual("idle");

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/", {
        signal: expect.any(AbortSignal),
      });
      expect(transitionResult.value.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      await expect(loader.results).rejects.toEqual(Error("Failed!"));
      await expect(transitionResult.value.results).rejects.toEqual(
        Error("Failed!")
      );
      expect(loader.changeCount).toEqual(2);
      expect(loader.current).toEqual("failure");

      loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);

      loader.next("RETRY");
      expect(loader.current).toEqual("loading");
      expect(loader.changeCount).toEqual(3);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/", {
        signal: expect.any(AbortSignal),
      });

      await expect(loader.results).resolves.toEqual({ fetchData: 42 });
      expect(loader.changeCount).toEqual(4);
      expect(loader.current).toEqual("success");
    });
  });
});
