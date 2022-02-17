import { always, cond, entry, on, start } from "./index";

function Session({ onSignOut }: { onSignOut: () => void }) {
  function* SignedOut() {
    yield entry(onSignOut);
    yield on("DID_SIGN_IN", checkingValid);
  }
  function* SignedIn() {
    yield on("REFRESH", checkingValid);
    yield on("SIGN_OUT", SignedOut);
  }
  function* checkingValid() {
    // yield guard(SignedIn, ["isAuthorized"]);
    // yield when(["isAuthorized"], SignedIn);
    // yield when(true, SignedOut);
    // yield guard(SignedIn, (read) => read("isAuthorized"));
    yield cond((read) => read("isAuthorized") === true, SignedIn);
    // yield cond(function *(): Generator<string, boolean> {
    //   return (yield "isAuthorized") === true;
    // }, SignedIn);
    yield always(SignedOut);
  }

  return checkingValid;
}

describe("Session", () => {
it("is initially signed out", () => {
    const onSignOut = jest.fn();
    const instance = start(Session.bind(null, { onSignOut }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    instance.abort();
  });

  it("can sign in", () => {
    const onSignOut = jest.fn();
    const instance = start(Session.bind(null, { onSignOut }));
    instance.next('DID_SIGN_IN');
    expect(onSignOut).toHaveBeenCalledTimes(2);
    expect(instance.value.state).toBe("SignedOut");
    instance.abort();
  });
})
