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
  `HttpClient` wrappers; plus `SoundService` (see *Audio* below)
- `core/utils/` - `product-image.ts` / `coin-image.ts`, which map a product **slot code** (`A1`..`D3`)
  or coin denomination to its artwork. Product art is keyed by code, not by name keyword: the
  original keyword matcher resolved `Chocolate Bar` to the cola art because `'chocolate'` contains
  `'cola'`. Adding a product outside `A1`..`D3` falls back to the candy bar art.
- `features/vending-machine/` - `VendingMachine` (container: owns balance/product-list signals, calls
  the services, translates `PurchaseStatus` into a user-facing message, and owns the viewport
  scaler), `ProductGrid` / `ProductSlot` (3x4 grid, out-of-stock light), `CoinSlot` (denomination
  buttons, balance, return), `Keypad` (builds a 2-character row+column code, e.g. `C3`, then emits
  it), `DispenserBin` (the delivery tray - see *Dispenser* below)

No routing, no NgRx - it's a single-screen app using Angular signals for state, which is enough at
this scope.

**Layout** - the product window sits on the left of the panel with a console strip down the right
holding the balance/coins, keypad, message display and dispenser bin, inside a cabinet with a fixed
780px natural width.

**Fit-to-viewport scaling** - the whole cabinet is scaled uniformly so it always fits without
scrolling (`html, body { overflow: hidden }`). `VendingMachine` computes the factor from the
cabinet's `offsetWidth/offsetHeight` - which ignore transforms, so the scale can't feed back into
its own input - and recomputes on window resize and via a `ResizeObserver`. Two things look
arbitrary but are not - change either and the cabinet stops fitting the viewport:
- centring is `scale()` applied **before** `translate(-50%, -50%)` on an absolutely positioned box,
  so the translate shifts by half the *scaled* size. Flex and grid centring both top-left align a
  box larger than its container, which leaves the cabinet hanging off the edge once scaled;
- there is deliberately **no responsive breakpoint**. A viewport-width media query fights the
  scaler - stacking made the natural box taller and forced a *smaller* scale than not stacking.

**Dispenser** (`features/vending-machine/dispenser-bin/`) - on a successful purchase the container
passes the product down with an incrementing id. The id matters: `@for` tracking by it recreates the
element per vend, so buying the same product twice replays the animation. The product drops in,
holds, fades out at 2.3s, and the component clears it from the DOM at 3.15s - removing it rather
than leaving it at `opacity: 0`, which would keep it in the accessibility tree.

**Audio** (`core/services/sound.service.ts`) - every sound is synthesized at play time with the Web
Audio API (oscillators for tones, bandpass-filtered noise for coin strikes). There are no audio
assets. The `AudioContext` is created lazily on the first sound because browsers only allow it to
start after a user gesture, and it returns `null` when unavailable or muted, which makes every play
method a silent no-op - that is what keeps the service safe under test and SSR. Sounds: keypad blip,
coin insert (strike, five uneven chute impacts, ramp slide, settle - pitched by denomination), coin
return cascade, vend thunk-and-chime, and a reject buzz. A mute toggle in the marquee persists to
`localStorage`.

**Artwork** - all imagery is hand-authored SVG in `public/images/` (`products/<code>-<name>.svg`,
`coins/`, `machine-facade.svg`), roughly 20KB in total. The mid-century palette and fonts live as
CSS custom properties in `src/styles.scss` (`--cream`, `--cream-deep`, `--coral`, `--coral-dark`,
`--turquoise`, `--teal-deep`, `--mustard`, `--charcoal`, `--chrome`, `--script`, `--readout`); use
those in SCSS rather than hard-coding hex values. The SVGs *cannot* use them - they load as separate
documents (`<img src>` for products and coins, `background-image: url()` for the facade), and
`:root` custom properties don't cascade across that boundary. Artwork colours are therefore literal
hex, and many are deliberate variations on a palette value rather than copies of one (the cola can
is `#C0392B`, not `--coral`'s `#E2543F`), so a palette change needs a hand pass over the SVGs -
find-and-replace on the old hex will miss things.

**Animation and motion** - `prefers-reduced-motion` is honoured in the dispenser bin (no fall, no
drift, opacity-only fade on the same schedule). Keep new motion behind the same guard.

## Conventions

### Secrets

- Never commit secrets.

### Dev agents

Implementation work is split along the stack seam by two project agents in `.claude/agents/`:
`frontend-dev` owns `frontend/vending-machine-app/`, `backend-dev` owns `backend/`. Neither may edit
the other's tree, and **neither runs git** — the orchestrating session owns branching, diff review,
commits and the PR, so the review rules below still apply.

Each agent verifies its own stack before reporting (`npm test` / `npm run build`;
`dotnet build` / `dotnet test`). End-to-end checks stay with the orchestrator via the `run-stack`
skill — two agents would contend for ports 5022 and 4200.

For cross-stack work, settle the API contract first and hand it to both agents; run `backend-dev`
first whenever the front end consumes a new or changed contract.

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
- `--fill` takes the PR title from the first commit, which misleads on a
  multi-commit branch (a branch whose second commit replaces the first
  gets titled after the work that was thrown away). Pass an explicit
  `--title`/`--body` in that case.
- Don't pass `--delete-branch` while another open PR targets that branch —
  deleting the base closes the dependent PR outright rather than
  retargeting it, and reopening it requires pushing the base ref back
  first. Retarget the dependent PR before merging its base.
