# Case study: the purchase error-body check

A defect in the front end's purchase error handler, found while documenting the code rather than
while using it. It is a small bug with a useful shape: locally reasonable, invisible from the source,
and obvious the moment the running API was asked what it actually returns.

| | |
|---|---|
| **Where** | `features/vending-machine/vending-machine/vending-machine.ts`, the `onSelectCode` error callback |
| **Severity** | Latent — not reachable from the UI as it stands. See [Latent, not live](#latent-not-live). |
| **Symptom, had it been reachable** | Rejection buzz, the previous message left on the display, no report of the failure, plus one needless balance request |
| **Found by** | Probing the running API with a malformed request while writing [appendix 20](../frontend/docs/README.md#20-appendix-error-handling-across-the-api-boundary) |
| **Fixed in** | Commit `8e2bd5d`, PR #19 — a type guard plus six tests |

---

## Background: why a check is needed at all

The API answers business outcomes with non-2xx status codes and a full body. `PurchaseController`
maps them like this:

```csharp
PurchaseStatus.Success           => Ok(result),                                          // 200
PurchaseStatus.ProductNotFound   => NotFound(result),                                    // 404
PurchaseStatus.OutOfStock        => Conflict(result),                                     // 409
PurchaseStatus.ChangeUnavailable => Conflict(result),                                     // 409
PurchaseStatus.InsufficientFunds => StatusCode(StatusCodes.Status402PaymentRequired, result), // 402
```

`HttpClient` maps HTTP onto an Observable's three channels by status code, and the rule is blunt: 2xx
goes to `next`, everything else goes to `error`. There is no third option. So four of the five normal
outcomes of using a vending machine arrive on the *failure* channel, each carrying a perfectly good
`PurchaseResult`.

The error callback therefore has to answer a question: **is this a business outcome to render, or a
genuine failure?**

## The defect

```typescript
error: (err: HttpErrorResponse) => {
  const result = err.error as PurchaseResult | undefined;
  if (result?.status) {              // <- the defect
    this.handlePurchaseResult(result);
  } else {
    this.sound.reject();
    this.message.set('Something went wrong. Please try again.');
  }
},
```

Two things are happening, and only one of them does any work:

- `as PurchaseResult | undefined` is a **type assertion**. It changes what the compiler believes and
  checks nothing at runtime.
- `if (result?.status)` is therefore the whole runtime test, and all it asks is *"does this object
  have a truthy `status` property?"*

## Why that is wrong

`PurchaseResult` is not the only body this API can return. ASP.NET Core's `[ApiController]`
attribute generates RFC 9110 problem details for model-validation failures, and those carry a
`status` of their own — a number. Captured from the running API by posting an empty object to
`/api/purchase`:

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1",
 "title":"One or more validation errors occurred.",
 "status":400,
 "errors":{"ProductCode":["The ProductCode field is required."]}}
```

`400` is truthy, so the body passes the check and is handed to `handlePurchaseResult` as though it
were a purchase result. What follows:

1. `if (result.status === 'Success')` is false, so `this.sound.reject()` fires the buzz.
2. `switch (result.status)` with `status === 400` matches **none** of the five cases and falls
   straight through — `this.message.set(...)` is never reached.
3. `this.refreshBalance()` runs at the end, issuing a **needless `GET /api/machine/balance`**.

The result on screen: a rejection noise, the **previous** message still displayed, and no indication
that anything failed. Strictly worse than the generic "Something went wrong. Please try again." the
other branch would have shown.

## Latent, not live

`Keypad` composes its code from one row button (`A`–`D`) and one column button (`1`–`3`), and only
enables `Select` at `entry().length === 2`. Every `productCode` the front end can send is therefore
exactly two characters, and model validation never fails. An unknown code such as `Z9` comes back as
404 with a real `PurchaseResult` of `ProductNotFound`, not a 400.

So no user could reach this. It is worth being precise about that rather than inflating it: the check
was wrong, and it would have become reachable the moment anything changed — another caller, a new
field on the request, added server-side validation — but nothing was broken for anyone at the time it
was found.

## How it surfaced

Not by re-reading the handler. The trigger was documenting what `err.error` contains in each failure
mode, and choosing to ask the running API instead of reasoning about it:

```bash
curl -s -i -X POST http://localhost:5022/api/purchase \
  -H "Content-Type: application/json" -d '{}'
```

The problem-details response above came back, and the gap was immediately obvious.

That is the transferable part. **The defect was invisible from the code and obvious from the wire.**
The handler reads as reasonable in isolation; seeing the flaw requires knowing what *else* the server
can send, and the server is the authority on that — not the client that consumes it. Another pass of
reading the TypeScript would not have surfaced it.

## The fix

A real type guard, next to the interface it narrows, in `core/models/purchase-result.model.ts`:

```typescript
export const PURCHASE_STATUSES = [
  'Success', 'ProductNotFound', 'OutOfStock', 'InsufficientFunds', 'ChangeUnavailable',
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export function isPurchaseResult(body: unknown): body is PurchaseResult {
  return (
    typeof body === 'object' &&
    body !== null &&
    PURCHASE_STATUSES.includes((body as PurchaseResult).status)
  );
}
```

```typescript
// vending-machine.ts
error: (err: HttpErrorResponse) => {
  if (isPurchaseResult(err.error)) {
    this.handlePurchaseResult(err.error);
  } else {
    this.sound.reject();
    this.message.set('Something went wrong. Please try again.');
  }
},
```

Three things carry the fix:

1. **Membership, not presence.** Testing against a known list is what closes the hole — `400` is not
   in it.
2. **`body is PurchaseResult` is a type predicate.** A `true` return narrows the argument's type for
   the compiler, so the caller keeps the assertion's ergonomics and gains a check that actually runs.
3. **The union is derived from the array** via `(typeof PURCHASE_STATUSES)[number]`, rather than
   declared separately. One list, so the compile-time type and the runtime check cannot drift when a
   status is added.

### What the guard deliberately does not do

It validates the discriminant, not the whole shape. A body claiming `status: 'Success'` with a
malformed `product` still passes. Validating every field means a schema validator (Zod and similar),
which is the right call when the API is not one you control. Here the same repository owns both ends,
and the [contract hazard](../frontend/docs/README.md#the-contract-is-a-promise-not-a-guarantee) is
documented rather than defended against.

## Tests, and proving they catch it

Six tests came with the fix:

- **Four unit tests on the guard** — every real status accepted; problem details rejected; the
  `ProgressEvent` handed over when a request never completes rejected; `null`, `undefined`, and a raw
  string rejected.
- **Two component tests** through `HttpTestingController` — a flushed 402 renders
  `Insufficient funds - insert $1.25 more.`; a flushed 400 problem-details body produces the generic
  message.

A test that passes against the fix proves little on its own. To confirm the second component test is
a genuine regression test, the old `result?.status` check was temporarily restored and the suite rerun.
It failed twice on the same test:

```
FAIL  vending-machine.spec.ts > VendingMachine
      > shows the generic message when the error body is not a purchase result

  expect(messageText()).toBe('Something went wrong. Please try again.')

Error: Expected no open requests, found 1: GET http://localhost:5022/api/machine/balance
  ❯ HttpClientTestingBackend.verify
```

Once on the message assertion, and once on `http.verify()` — because the wrong branch's
`refreshBalance()` left a request outstanding. The test pins the side effect as well as the symptom.
The fix was then restored and the suite confirmed green at 25 of 25.

## Takeaways

- **Ask the system, not the source.** A boundary defect lives in the gap between what the client
  believes the server sends and what it sends. Only one of those is discoverable by reading client
  code.
- **An assertion is not a check.** `as T` and a type predicate look similar at the call site and are
  nothing alike at runtime. Where data crosses into the program from outside, the difference is the
  whole point.
- **Discriminate on a known set, not on presence.** "Has a `status`" is a much weaker claim than "has
  a status I recognise", and the difference only shows up when a third party puts the same field name
  in a different message.
- **Derive the runtime list and the compile-time type from one declaration.** Two hand-maintained
  copies of the same set will eventually disagree.
- **Verify that a regression test fails without the fix.** Otherwise it documents the fix rather than
  defending it.

## References

- Fix: commit `8e2bd5d`, merged in PR #19
- Longer treatment of the boundary as a whole:
  [appendix 20 of the front-end guide](../frontend/docs/README.md#20-appendix-error-handling-across-the-api-boundary)
- Related hazard: [the contract is a promise, not a guarantee](../frontend/docs/README.md#the-contract-is-a-promise-not-a-guarantee)
