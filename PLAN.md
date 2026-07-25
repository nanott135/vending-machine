# Vending Machine Simulator

## Context

Building a greenfield vending machine simulator: Angular front end, ASP.NET Core Web API back end, SQL Server persistence. The repo (`C:\dev\vending-machine`) is currently empty (just `CLAUDE.md`) and not yet a git repo, so this plan covers scaffolding both apps from scratch.

Confirmed decisions from review:
- **Full coin simulation**: user inserts real denominations (5c/10c/25c/$1); the machine keeps its own coin inventory and makes change from it on purchase (can decline a sale if it can't make exact change).
- **DB**: local SQL Server via connection string (no Docker). This machine has a SQL Server Express named instance (`.\SQLEXPRESS`) running as a Windows service rather than the lightweight LocalDB runtime, so the connection string targets that instance.
- **Products**: 12 products seeded via EF Core migration (no admin UI) — code, name, price, quantity, with a couple seeded at quantity 0 to demonstrate the out-of-stock light.

One addition beyond the original ask, included because "full simulation" implies it: a **Return Coins** action, so a user who inserts money without buying isn't stuck. Flagging it here for visibility — easy to drop if unwanted.

**Authentication: none.** Considered an API key or JWT to gate the API, but scrapped it — this is a single-user, browser-delivered SPA with no real users/identity, and any credential shipped to the Angular bundle is visible to whoever opens the page (dev tools/network tab), so it can't function as real security here, only as a soft deterrent. Not worth the added complexity for a local simulator with no sensitive data. The API is scoped down purely via CORS (only the Angular dev origin is allowed to call it). If this ever needs to be reachable beyond localhost or gets an admin surface, revisit this — the real fix at that point is a server-side component holding any secret, not a browser-visible key/token.

## Architecture

**Money is stored as integer cents everywhere** (`PriceCents`, `BalanceCents`) to avoid floating-point rounding bugs.

**State model:**
- *Durable (SQL Server, via EF Core)*: `Products` (stock/price) and `MachineCoinInventory` (coins physically loaded in the machine, used both to accept deposits and to make change). These are what actually need to survive a restart.
- *Ephemeral (in-memory singleton on the API)*: the current pending balance / coins-inserted-this-transaction. A real machine has exactly one pending sale at a time, so a simple thread-safe singleton service models this correctly without persisting transient session data.

**Change-making**: greedy largest-denomination-first (Dollar → Quarter → Dime → Nickel) against the machine's live coin inventory. This coin system makes greedy optimal. If exact change isn't achievable, the purchase is rejected and nothing is mutated (balance and inventory stay untouched).

**Grid/codes**: 3 columns × 4 rows = 12 slots, coded like the example (`C3`) as row letter A–D + column number 1–3. `Product.Code` is the row+column code directly (A1, A2, A3, B1, … D3).

### Backend — `backend/VendingMachine.Api` (.NET 10 Web API — current LTS, matches the installed SDK) + `backend/VendingMachine.Api.Tests` (xUnit)

Single API project (no extra Domain/Infrastructure layering — not warranted at this scope), folders:
- `Models/` — `Product`, `MachineCoinInventoryItem`, `CoinDenomination` enum (`Nickel=5, Dime=10, Quarter=25, Dollar=100`)
- `Data/` — `VendingMachineDbContext`, EF Core migrations, `DbSeeder` (seeds 12 products + starting coin inventory, e.g. 20 nickels/dimes/quarters, 10 dollar coins)
- `Services/` — `IChangeMakingService` (pure change algorithm, easiest to unit test in isolation), `IMachineStateService` (in-memory pending balance/inserted-coins singleton), `IVendingMachineService` (orchestrates purchase: validate stock → validate funds → make change → persist product decrement + inventory update in one DB transaction → reset pending balance)
- `Controllers/` — `ProductsController` (`GET /api/products`), `MachineController` (`POST /api/machine/coins` insert, `POST /api/machine/coins/return` refund, `GET /api/machine/balance`), `PurchaseController` (`POST /api/purchase` `{ productCode }`)
- `Dtos/` — request/response contracts (`ProductDto`, `InsertCoinRequest`, `PurchaseRequest`, `PurchaseResponse` with change breakdown, etc.)
- `Program.cs` — EF Core + SQL Server (LocalDB connection string in `appsettings.Development.json`), CORS policy allowing `http://localhost:4200`, Swagger in dev

Purchase flow (`IVendingMachineService.Purchase`):
1. Look up product by code; 404/error if missing, error if `Quantity == 0`.
2. Error if pending balance < price (return amount still needed).
3. Compute change owed; try to make it from `MachineCoinInventory` via `IChangeMakingService`. If not possible → reject, no mutations.
4. On success, in one DB transaction: decrement product quantity, add inserted coins into inventory, subtract dispensed change coins from inventory, save.
5. Reset in-memory pending balance to 0; return dispensed change breakdown + updated product.

### Frontend — `frontend/vending-machine-app` (Angular CLI 22, standalone components, signals for state — no NgRx/Router needed for a single-screen app)

- `core/models/` — TS interfaces mirroring the DTOs
- `core/services/` — `product.service.ts` (fetch products), `machine.service.ts` (insert coin, return coins, purchase)
- `features/vending-machine/`
  - `vending-machine.component.ts` — top-level container: holds balance + product-list signals, wires coin insert / code entry / purchase together, shows result/error messages
  - `product-grid.component.ts` — lays out the 3×4 grid
  - `product-slot.component.ts` — one tile: code, name, price, out-of-stock light (red/green indicator driven by `quantity === 0`)
  - `coin-slot.component.ts` — 5c/10c/25c/$1 insert buttons, current balance display, Return Coins button
  - `keypad.component.ts` — text entry (e.g. "C3") + Select button to trigger purchase
- Plain SCSS for the grid/lights/machine chrome — no UI framework dependency needed at this scope.

### Testing
- Backend: xUnit tests for `ChangeMakingService` (exact-change success, insufficient-inventory failure) and `VendingMachineService` (successful purchase, insufficient funds, out of stock, no-exact-change), using EF Core's InMemory provider for service tests.
- Frontend: default Angular CLI test runner (Vitest, the CLI 22 default - not Karma/Jasmine as originally noted) for `product-slot` (out-of-stock rendering) and `coin-slot` (balance display).

### Git workflow (per repo's `CLAUDE.md`)
Working on feature branch `feat/vending-machine-simulator`, with incremental commits as logical pieces land (domain/migrations → services → controllers → frontend scaffold → components → wiring → tests), each shown for review before committing. PR opened at the end via `gh pr create --fill` (once a remote exists — will confirm before that step since there's no remote configured yet).

### Docs
Update root `CLAUDE.md` at the end with real build/test/run commands and the architecture summary above, once the structure exists to document.

## Verification
- Backend: `dotnet test` (all xUnit tests green); `dotnet run` + Swagger UI to manually exercise `GET /api/products`, insert coins, and purchase flows (including an insufficient-funds and an out-of-stock case).
- Frontend: `ng test` for component specs; `ng serve` against the running API and manually walk the golden path in a browser — insert coins, buy a product by code, confirm change + stock update + out-of-stock light on a zero-quantity slot — plus the insufficient-funds and no-exact-change edge cases.
