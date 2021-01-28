import { always, call, cond, entry, exit, on, start } from "./index";

const fetch = jest.fn();
beforeEach(fetch.mockClear);

const finishedLoading = jest.fn();
beforeEach(finishedLoading.mockClear);

describe("Machine with entry and exit actions", () => {
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
    function* success() {}
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
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      loader.next("NOOP");
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledWith("https://example.org/");
      expect(transitionResult.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);
      expect(finishedLoading).toHaveBeenCalledTimes(0);

      await expect(loader.resolved).resolves.toEqual([42]);
      await expect(Promise.resolve(transitionResult)).resolves.toEqual([42]);
      expect(finishedLoading).toHaveBeenCalledTimes(1);
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");

      const transitionResult2 = loader.next("FETCH");
      expect(transitionResult2.actions).toEqual([]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");

      await loader.resolved;
    });
  });

  describe("when fetch fails", () => {
    beforeEach(() => {
      fetch.mockRejectedValueOnce(new Error("Failed!")).mockResolvedValue(42);
    });

    test("sending events", async () => {
      const loader = start(Loader, [{ url: someURL }]);
      expect(loader.value).toEqual("idle");

      const transitionResult = loader.next("FETCH");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith("https://example.org/");
      expect(transitionResult.actions).toEqual([
        { type: "entry", f: fetchData },
      ]);
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      await expect(loader.resolved).rejects.toEqual(new Error("Failed!"));
      await expect(Promise.resolve(transitionResult)).rejects.toEqual(
        new Error("Failed!")
      );
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

      await expect(loader.resolved).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(4);
      expect(loader.value).toEqual("success");
    });
  });
});

describe("Form Field Machine with entry and exit actions", () => {
  // const validate = jest.fn();
  // beforeEach(validate.mockClear);
  const isValid = jest.fn();
  beforeEach(isValid.mockClear);

  function FormField() {
    function* initial() {
      yield on("CHANGE", editing);
    }
    function* editing() {
      // yield exit(validate);
      yield on("CHANGE", editing);
      yield on("BLUR", validating);
    }
    function* validating() {
      yield always(cond(isValid, valid));
      yield always(invalid);

      // yield on(null, cond(isValid, valid));
      // yield on(null, invalid);

      // yield always([cond(isValid, valid), invalid]);
      // return [cond(isValid, valid), invalid];
      // return conds([[isValid, valid], [true, invalid]]);
    }
    function* invalid() {}
    function* valid() {}

    return initial;
  }

  test("creating", () => {
    const formField = start(FormField);
    expect(formField).toBeDefined();
  });

  describe("when is valid", () => {
    beforeEach(() => {
      isValid.mockReturnValue(true);
    });

    test("sending events", () => {
      const formField = start(FormField);
      expect(formField).toBeDefined();
      expect(formField.value).toEqual("initial");

      formField.next("CHANGE");
      expect(formField.value).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("CHANGE");
      expect(formField.value).toEqual("editing");
      expect(formField.changeCount).toEqual(2);

      formField.next("BLUR");
      expect(formField.value).toEqual("valid");
      expect(formField.changeCount).toEqual(4);
    });
  });

  describe("when is invalid", () => {
    beforeEach(() => {
      isValid.mockReturnValue(false);
    });

    test("sending events", () => {
      const formField = start(FormField);
      expect(formField).toBeDefined();
      expect(formField.value).toEqual("initial");

      formField.next("CHANGE");
      expect(formField.value).toEqual("editing");
      expect(formField.changeCount).toEqual(1);

      formField.next("CHANGE");
      expect(formField.value).toEqual("editing");
      expect(formField.changeCount).toEqual(2);

      formField.next("BLUR");
      expect(formField.value).toEqual("invalid");
      expect(formField.changeCount).toEqual(4);
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
      await expect(loader.resolved).resolves.toEqual([]);

      loader.next("NOOP");
      expect(loader.value).toEqual("idle");
      expect(loader.changeCount).toEqual(0);
      await expect(loader.resolved).resolves.toEqual([]);

      loader.next("FETCH");
      expect(loader.value).toEqual("loading");
      expect(loader.changeCount).toEqual(1);

      expect(fetch).toHaveBeenCalledWith("https://example.org/");

      await expect(loader.resolved).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(2);
      expect(loader.value).toEqual("success");

      loader.next("FETCH");
      expect(loader.changeCount).toEqual(2);

      await loader.resolved;
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

      await expect(loader.resolved).rejects.toEqual(new Error("Failed!"));
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

      await expect(loader.resolved).resolves.toEqual([42]);
      expect(loader.changeCount).toEqual(4);
      expect(loader.value).toEqual("success");
    });
  });
});
