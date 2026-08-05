# Future Enhancements

Known improvements that are understood but not yet done. Each entry states the problem, the proposed
change, and why it hasn't been made — so a future reader can judge whether it's still worth doing
rather than rediscovering the reasoning.

Nothing here is a live bug unless it says so.

---

## 1. Make the shared constant tables genuinely immutable

**Status:** not started · **Scope:** frontend · **Size:** small

### Problem

Several module-level lookup tables are declared `const`, which protects the *binding* but leaves the
object freely mutable. Where one is exposed on a component, `readonly` protects the property and
likewise not the contents.

The clearest case is `features/vending-machine/keypad/keypad.ts`:

```typescript
const ROWS = ['A', 'B', 'C', 'D'];      // module-level: shared by every Keypad instance
const COLUMNS = ['1', '2', '3'];
...
protected readonly rows = ROWS;
```

`this.rows.push('E')` compiles cleanly. Because `ROWS` is module scope, that mutation would affect
every `Keypad` in the application, and the same array is handed to every template.

Affected declarations:

| File | Declaration |
|---|---|
| `features/vending-machine/keypad/keypad.ts` | `ROWS`, `COLUMNS` |
| `core/utils/product-image.ts` | `SLOT_IMAGES` |
| `core/utils/coin-image.ts` | `COIN_IMAGES` |
| `core/services/sound.service.ts` | `COIN_PITCH` |

**This is latent, not live.** Nothing currently writes to any of them. The value of fixing it is
turning "we don't do that" into something the compiler enforces.

### Proposed change

`as const` on the arrays, `Readonly<Record<...>>` on the lookup maps:

```typescript
const ROWS = ['A', 'B', 'C', 'D'] as const;
const COLUMNS = ['1', '2', '3'] as const;

const SLOT_IMAGES: Readonly<Record<string, string>> = { ... };
const COIN_IMAGES: Readonly<Record<CoinDenomination, string>> = { ... };
const COIN_PITCH: Readonly<Record<CoinDenomination, number>> = { ... };
```

Both are erased at compile time, so there is no runtime cost and no bundle change.

### Things to watch

- **`as const` narrows to literal types.** `ROWS` becomes `readonly ["A", "B", "C", "D"]` rather than
  `string[]`. That's usually an improvement, but check that `press(key: string)` and the `@for` loops
  still typecheck — a literal union is assignable to `string`, so they should, but verify rather than
  assume.
- **`Readonly<Record<K, V>>` is shallow.** Fine here, since all the values are primitives.
- **Compile-time only.** If a runtime guarantee is ever needed, that's `Object.freeze`, and it is also
  shallow. See the appendix in
  [`frontend/docs/README.md`](frontend/docs/README.md#17-appendix-const-readonly-and-actually-preventing-mutation).

### Verification

`ng test` should stay green with no changes to the specs. The real check is that
`ROWS.push('E')` now fails to compile — worth confirming manually, since a change that silently
doesn't take effect is the failure mode here.

---

## Also known

These are already written up elsewhere; listed here so this file is a complete picture rather than a
partial one.

| Item | Where it's described | Note |
|---|---|---|
| **Race on the last item in stock** | `backend/docs/README.md`, exercise 6 | The only entry here that is a **real bug**. Two concurrent purchases can both pass the stock check. Needs a row version and `DbUpdateConcurrencyException` handling. |
| **TypeScript models are hand-mirrored from the API** | `frontend/docs/README.md` §8, exercise 7 | A renamed C# property doesn't break the build — the field silently becomes `undefined`. Generating types from the OpenAPI document prevents the drift. |
| **No HTTP-level frontend tests** | `frontend/docs/README.md` §14 | The container's error-handling branch is unverified. `HttpTestingController` is the tool. |
| **Transaction rollback isn't proven** | `backend/docs/README.md` §11 | The EF in-memory provider has no real transactions, so atomicity is reasoned about rather than tested. SQLite in-memory would close this. |
| **API base URL is hard-coded** | `frontend/docs/README.md`, exercise 6 | `core/services/api-config.ts` points at `localhost:5022`. Fine for local development, blocks any other deployment. |

---

## Conventions for this file

- One heading per enhancement, numbered, with **status / scope / size** on the first line.
- State the problem before the solution, and say plainly whether it is a live bug or a latent one.
- Record what was considered and rejected. A future reader needs to know a path was explored, not
  just which one was taken.
- Delete an entry when it ships. Git history keeps it; a backlog full of done items stops being read.
