---
name: run-stack
description: Launch the full vending machine stack (SQL Server Express, the ASP.NET Core API, the Angular dev server) and smoke-test a purchase end to end. Use when asked to run, start, serve, or screenshot the app, or to confirm a change works in the real app rather than only in tests.
---

# Running the stack

Three pieces, two of them long-running processes:

| Piece | Command (from repo root) | Endpoint |
|---|---|---|
| SQL Server Express | Windows service, usually already up | `.\SQLEXPRESS` |
| API | `dotnet run --project backend/VendingMachine.Api --launch-profile http` | http://localhost:5022 |
| Frontend | `npm start --prefix frontend/vending-machine-app` | http://localhost:4200 |

Start both servers with `run_in_background: true` — they don't exit, and a foreground call will
just burn the timeout.

## Order and readiness

**1. Check SQL Server.** `Get-Service MSSQL$SQLEXPRESS` — start it if stopped. The API fails at
first request, not at startup, so a dead database looks like a working API until you hit
`/api/products`.

**2. Start the API**, then poll until it answers. Don't sleep a fixed interval:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:5022/api/products
```

`200` with twelve products means the API *and* the database are both good. In PowerShell 5.1
`curl` is an alias for `Invoke-WebRequest`, not curl — write `curl.exe`, or use
`Invoke-RestMethod`.

**3. Start `ng serve`**, then poll `http://localhost:4200`. First build takes appreciably longer
than a rebuild. If `node_modules` is absent, `npm install --prefix frontend/vending-machine-app`
first.

## Two flags that are not optional

**`--launch-profile http`.** The `https` profile binds `https://localhost:7234;http://localhost:5022`.
The frontend's `core/services/api-config.ts` points at `http://localhost:5022/api`, and the API's
CORS policy allows exactly one origin, `http://localhost:4200`. Get this wrong and the browser
reports a CORS failure — which reads as a frontend bug and isn't one.

**Port 4200 specifically.** If 4200 is occupied, `ng serve` offers another port; accepting it
breaks CORS the same way. Free 4200 instead — `netstat -ano | findstr :4200`, then stop the owner.

## Smoke test

Curl alone proves the API; it does not prove the app. Do both.

**API** — this sequence exercises stock, balance, and change-making together. Coin denominations
serialize as strings (`JsonStringEnumConverter`), not integers:

```
GET  /api/products                                    → 200, 12 products, A3 and C2 at quantity 0
POST /api/machine/coins   {"denomination":"Dollar"}   → 200, balanceCents 100
POST /api/purchase        {"productCode":"D2"}        → 200, Gum (75c), 25c change as one Quarter
```

D2 is the useful case: it forces `ChangeMakingService` to actually make change. An exact-payment
product proves less. For the rejection paths, `A3` is seeded out of stock (→ 409) and an
unseeded code like `Z9` → 404.

Purchase mutates durable state — stock and coin inventory. Re-run the smoke test enough times and
seeded quantities drift. Reset when that matters:

```
dotnet ef database drop --force   # from backend/VendingMachine.Api/
dotnet ef database update
```

**Browser** — the parts curl can't see: the fit-to-viewport scaler, the dispenser animation, and
the artwork. Load http://localhost:4200, insert coins, key a code on the keypad, watch the product
drop into the bin. If asked for a screenshot, take it after the drop animation settles — the item
fades at 2.3s and leaves the DOM at 3.15s, so a screenshot timed late catches an empty bin.

## When something looks wrong

- **CORS error in the browser console** — almost always the launch profile or the frontend port.
  Check both before suspecting `Program.cs`.
- **API up, `/api/products` 500** — database. Confirm the service is running and the connection
  string in `appsettings.Development.json` matches this machine (`.\SQLEXPRESS` here, not LocalDB).
- **Grid renders but slots are blank** — artwork is keyed by slot code (`A1`..`D3`) in
  `core/utils/product-image.ts`, not by product name. A code outside that range falls back to the
  candy bar image.
- **Silent audio** — expected until a user gesture. The `AudioContext` is created lazily on first
  sound, and `SoundService` no-ops when it's unavailable or muted.

## Shutting down

Stop both background processes when done. Leaving `ng serve` holding 4200 makes the *next* run
fail in the confusing CORS way described above.
