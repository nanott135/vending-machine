# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A vending machine simulator: Angular front end, ASP.NET Core Web API back end, SQL Server persistence.
See `PLAN.md` for the original design decisions and rationale (coin simulation model, no-auth
justification, state model, etc.).

## Commands

### Backend (`backend/`)

```
cd backend
dotnet build                    # build the solution
dotnet test                     # run all xUnit tests
dotnet run --project VendingMachine.Api   # run the API (Swagger UI at /swagger in dev)
```

EF Core migrations (run from `backend/VendingMachine.Api/`, requires the `dotnet-ef` global tool -
install once with `dotnet tool install --global dotnet-ef`):

```
dotnet ef migrations add <Name>
dotnet ef database update       # apply migrations to the DB in appsettings.Development.json
dotnet ef database drop --force # reset the dev DB back to a clean seeded state
```

The dev connection string in `appsettings.Development.json` targets a local SQL Server instance.
This machine has SQL Server Express running as a Windows service (`.\SQLEXPRESS`) rather than
LocalDB - adjust the connection string if your environment differs.

### Frontend (`frontend/vending-machine-app/`)

```
cd frontend/vending-machine-app
npm install
ng serve       # dev server at http://localhost:4200
ng test        # Vitest (Angular CLI 22 default, not Karma/Jasmine)
ng build
```

The frontend expects the API at `http://localhost:5022/api` (`core/services/api-config.ts`), which
matches the API's `http` launchSettings profile: `dotnet run --launch-profile http`. The API's CORS
policy only allows `http://localhost:4200`.

## Architecture

**Money is stored as integer cents everywhere** (`PriceCents`, `BalanceCents`, etc.) to avoid
floating-point rounding bugs.

**State model** - the split between what's durable and what's not is the key thing to understand:
- *Durable (SQL Server via EF Core)*: `Products` (stock/price) and `CoinInventory` (coins physically
  loaded in the machine, used both to accept deposits and to make change). Seeded via the initial
  migration's `HasData` (see `Data/DbSeeder.cs`) - 12 products (two seeded at quantity 0 for the
  out-of-stock light) and starting coin counts.
- *Ephemeral (in-memory singleton, `Services/MachineStateService.cs`)*: the current pending balance
  and which coins were inserted this transaction. A real machine has exactly one pending sale at a
  time and it doesn't survive a power cycle, so this intentionally isn't persisted.

**Purchase flow** (`Services/VendingMachineService.cs`, called from `PurchaseController`):
look up product by code -> validate stock -> validate pending balance covers the price -> compute
change owed and try to make it via `ChangeMakingService` (greedy largest-denomination-first against
DB inventory + coins inserted this transaction) -> if change can be made, atomically decrement stock
and update coin inventory in one DB transaction and reset the pending balance; if not, reject the
purchase without mutating anything. `PurchaseController` maps the resulting `PurchaseStatus` to HTTP
status codes (402 insufficient funds, 409 out-of-stock/change-unavailable, 404 unknown code).

**No authentication** - deliberate, not an oversight. See PLAN.md's Context section for why: this is
a single-user browser SPA with no real user identity, and a credential shipped to the JS bundle can't
be kept secret from whoever opens the page. The API is scoped down via CORS only.

**Frontend structure** (`frontend/vending-machine-app/src/app/`):
- `core/models/` - TS interfaces mirroring the backend DTOs
- `core/services/` - `ProductService`, `MachineService` (insert/return coins, purchase), both thin
  `HttpClient` wrappers
- `features/vending-machine/` - `VendingMachine` (container: owns balance/product-list signals, calls
  the services, translates `PurchaseStatus` into a user-facing message), `ProductGrid` /
  `ProductSlot` (3x4 grid, out-of-stock light), `CoinSlot` (denomination buttons, balance, return),
  `Keypad` (builds a 2-character row+column code, e.g. `C3`, then emits it)

No routing, no NgRx - it's a single-screen app using Angular signals for state, which is enough at
this scope.

## Conventions

### Secrets

- Never commit secrets.

### Git workflow

- Never commit directly to `main`.
- One feature branch per feature, named `feat/<short-description>`.
- Commit after each logical change with a clear Conventional Commits message
  (`feat:`, `fix:`, `refactor:`, etc.) — don't batch everything into one
  commit at the end.
- Before each commit, show the diff and the proposed commit message for
  review.
- After pushing, open a PR with the host's CLI:
  - GitHub: `gh pr create --fill`
  - Azure DevOps: `az repos pr create`
