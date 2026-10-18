// Binds an asynchronous operation to the network and account it started on. Wallet state is shared
// and can change while a request is awaiting (a network switch, an account switch, a disconnect);
// the view invalidates the scope on each change, and an operation that was begun earlier finds
// `isCurrent()` false after its next await and drops its result instead of applying it to the new
// state. Every `await` in an operation is followed by an `isCurrent()` check.

/** A handle to one operation's scope. */
export interface OperationToken {
  /** True until the scope is invalidated after this token was issued. */
  isCurrent(): boolean
}

/** A scope that operations begin in and that a state change invalidates. */
export interface OperationScope {
  /** Issue a token for an operation that is starting now. */
  begin(): OperationToken
  /** Invalidate every token issued so far (the network or account changed). */
  invalidate(): void
}

export function createOperationScope(): OperationScope {
  let generation = 0
  return {
    begin() {
      const issued = generation
      return { isCurrent: () => issued === generation }
    },
    invalidate() {
      generation++
    },
  }
}
