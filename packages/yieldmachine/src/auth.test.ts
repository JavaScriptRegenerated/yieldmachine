import { always, cond, entry, on, ReadContextCallback, start } from "./index";

function* Session({ onSignOut }: { onSignOut: () => void }) {
  const checkingValid = new Map([
    [(read: ReadContextCallback) => read("isAuthorized") === true, SignedIn as any],
    [null, SignedOut],
  ]);

  function* SignedOut() {
    yield entry(onSignOut);
    yield on("DID_SIGN_IN", checkingValid);
  }
  function* SignedIn() {
    yield on("REFRESH", checkingValid);
    yield on("SIGN_OUT", SignedOut);
  }

  return checkingValid;
}

describe("Session", () => {
  it("is initially signed out", () => {
    const aborter = new AbortController();
    const onSignOut = jest.fn();
    const instance = start(Session.bind(null, { onSignOut }), { signal: aborter.signal });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    aborter.abort();
  });

  it("can sign in", () => {
    const aborter = new AbortController();
    const onSignOut = jest.fn();
    const instance = start(Session.bind(null, { onSignOut }), { signal: aborter.signal });
    instance.next('DID_SIGN_IN');
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(instance.value.state).toBe("SignedOut");
    aborter.abort();
  });
})
