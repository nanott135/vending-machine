# Vending Machine Simulator

A working vending machine: insert coins, punch a slot code, watch the product drop into the tray and
your change come back. Angular front end, ASP.NET Core Web API, SQL Server persistence.

![The vending machine: a 3x4 product grid with two slots dark and lit out-of-stock, a console strip
holding the balance readout, coin buttons, keypad and message display, and an Orange Soda sitting in
the dispenser tray after a purchase](docs/screenshot.png)

It exists as a study of **agent-assisted development**. The code was written primarily by
[Claude Code](https://claude.com/claude-code) under direction, on a problem with enough real
constraints — money, inventory, transactions, an API boundary — to find out where that works and
where it needs a gate. The documentation is not incidental to the project; it is most of the point.

## The stack

| | |
|---|---|
| Front end | Angular 22 — signals, zoneless, no routing, no NgRx |
| Back end | ASP.NET Core Web API on .NET 10 |
| Data | SQL Server via EF Core, seeded by migration |
| Tests | Vitest (25) and xUnit (9) |
| Artwork and audio | Hand-authored SVG; every sound synthesized at runtime with the Web Audio API — no binary assets |

## What it actually does

- **Full coin simulation.** The machine holds its own coin inventory, accepts nickels through
  dollars, and makes change from what it physically has. It will decline a sale it can't make exact
  change for rather than short you.
- **Money is integer cents everywhere**, so there is no floating-point rounding to reason about.
- **A purchase is one transaction** — stock decrement and coin inventory update commit together or
  not at all.
- **Twelve products** across a 3×4 grid, two seeded empty to exercise the out-of-stock light.
- **Return coins** at any time before buying.

## Running it

**Prerequisites:** .NET 10 SDK, Node.js 20+, and a local SQL Server instance. The dev connection
string targets SQL Server Express (`.\SQLEXPRESS`) with Windows authentication — adjust
`backend/VendingMachine.Api/appsettings.Development.json` if yours differs.

**API** — http://localhost:5022, Swagger UI at `/swagger`:

```bash
cd backend
dotnet run --project VendingMachine.Api --launch-profile http
```

**Front end** — http://localhost:4200:

```bash
cd frontend/vending-machine-app
npm install
ng serve
```

Both need to be running: the app calls the API directly, and the API's CORS policy allows only
`http://localhost:4200`.

The database is created and seeded from the initial EF Core migration. To reset it:

```bash
cd backend/VendingMachine.Api
dotnet ef database drop --force
dotnet ef database update
```

**Tests:**

```bash
cd backend && dotnet test
cd frontend/vending-machine-app && ng test
```

## Documentation

Two long-form guides explain the whole system from first principles, assuming no prior knowledge of
the frameworks involved:

- [**The Front End, Explained From Scratch**](frontend/docs/README.md) — TypeScript, how an Angular
  app boots, signals, HTTP and Observables, then the specifics: the dispenser animation, the Web
  Audio synthesis, the fit-to-viewport scaler.
- [**The Back End, Explained From Scratch**](backend/docs/README.md) — C#, ASP.NET Core, dependency
  injection, EF Core, and the purchase transaction in detail.

One write-up covers a single defect end to end:

- [**Case study: the purchase error-body check**](docs/case-study-purchase-error-defect.md) — a
  boundary defect that was invisible from the source and obvious from the wire, how probing the
  running API surfaced it, the type guard that fixed it, and how the regression test was confirmed to
  fail without the fix.

Three shorter files carry the reasoning:

- [`PLAN.md`](PLAN.md) — the original design decisions and why, including why there is no
  authentication.
- [`ENHANCEMENTS.md`](ENHANCEMENTS.md) — known improvements not yet made, each with the reason it
  hasn't been. Nothing here is a live bug unless it says so.
- [`CLAUDE.md`](CLAUDE.md) — the instructions the coding agent reads: architecture invariants, the
  constraints that look arbitrary but aren't, and the git conventions below.

## How it was built

Every change went through the same loop, and the conventions exist to keep agent output reviewable:

- One feature branch per change; nothing commits directly to `main`.
- A commit per logical change with a Conventional Commits message, rather than one batch at the end —
  in practice about five files per commit, which is small enough to actually read.
- The diff and proposed message reviewed *before* the commit, not after.
- A pull request for every branch, with the reasoning in the body.

Those rules live in `CLAUDE.md` so the agent applies them without being reminded each session. They
are convention rather than automation — there is no CI in this repo — which is the honest limit of
the approach at this scale.

## License

MIT — see [LICENSE](LICENSE).
