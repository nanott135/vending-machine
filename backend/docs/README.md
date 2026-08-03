# The Backend, Explained From Scratch

A complete guide to the vending machine API: the C# language features it uses, how ASP.NET Core
turns an HTTP request into a response, how Entity Framework Core talks to SQL Server, and why this
particular code is shaped the way it is.

**This assumes no prior knowledge of C#, .NET, ASP.NET Core, or Entity Framework.** It does assume
you can program in *something* — that you know what a function, a class, and a database table are.

Every code sample is real code from this project, not invented illustration. File paths are relative
to `backend/`.

---

## Table of contents

1. [What the backend actually is](#1-what-the-backend-actually-is)
2. [The shape of a .NET project](#2-the-shape-of-a-net-project)
3. [C# language features used here](#3-c-language-features-used-here)
4. [Program.cs: how the application starts](#4-programcs-how-the-application-starts)
5. [Dependency injection](#5-dependency-injection)
6. [Controllers: turning HTTP into method calls](#6-controllers-turning-http-into-method-calls)
7. [DTOs and JSON](#7-dtos-and-json)
8. [Entity Framework Core](#8-entity-framework-core)
9. [Migrations and seeding](#9-migrations-and-seeding)
10. [The domain logic](#10-the-domain-logic)
11. [Testing with xUnit](#11-testing-with-xunit)
12. [Running and troubleshooting](#12-running-and-troubleshooting)
13. [Exercises](#13-exercises)

---

## 1. What the backend actually is

The backend is a program that listens on a TCP port (5022 here), speaks HTTP, and answers questions
about a vending machine. It has no user interface. You can drive it entirely with `curl`:

```bash
curl http://localhost:5022/api/products
```

```json
[{"code":"A1","name":"Cola","priceCents":125,"quantity":10,"isOutOfStock":false,"slotOrder":1}, ...]
```

That is the whole contract. The Angular front end is just one possible client; Swagger UI, `curl`,
or a mobile app would all work identically.

### The four endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/products` | List all 12 products with stock and price |
| `GET` | `/api/machine/balance` | How much money is currently inserted |
| `POST` | `/api/machine/coins` | Insert one coin of a given denomination |
| `POST` | `/api/machine/coins/return` | Give the inserted coins back |
| `POST` | `/api/purchase` | Attempt to buy a product by its code |

### Why "REST"

You will hear this API called RESTful. The useful part of that idea, for our purposes, is:

- **URLs name things** (`/api/products` is the product collection), not actions.
- **HTTP verbs say what you're doing to them**: `GET` reads and changes nothing; `POST` performs an
  action or creates something.
- **HTTP status codes carry the outcome**: `200` fine, `404` no such thing, `409` conflict with
  current state, and so on.

That last point matters a lot here, and we come back to it in [section 6](#6-controllers-turning-http-into-method-calls).

---

## 2. The shape of a .NET project

### The SDK, the runtime, and the language

Three separate things share the ".NET" name:

- **C#** is the language you write.
- **The .NET runtime** executes the compiled result.
- **The .NET SDK** is the toolbox — compiler, package manager, test runner — exposed through the
  `dotnet` command.

This project targets **.NET 10**.

### Projects and solutions

A **project** is a unit of compilation producing one output (a `.dll` or executable). It's defined by
a `.csproj` file. A **solution** (`.sln`) groups related projects.

There are two projects here:

```
backend/
  VendingMachine.Api/          <- the web API itself
  VendingMachine.Api.Tests/    <- the automated tests
```

### Reading `VendingMachine.Api.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.10">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.10" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="10.2.3" />
  </ItemGroup>

</Project>
```

Line by line:

- **`Sdk="Microsoft.NET.Sdk.Web"`** — "this is a web project." It brings in the ASP.NET Core
  framework and web-specific build behaviour. The test project uses plain `Microsoft.NET.Sdk`.
- **`TargetFramework`** — which .NET version to build against.
- **`Nullable`** — enables **nullable reference types**, explained in
  [section 3](#nullable-reference-types). This is a big deal for how the code reads.
- **`ImplicitUsings`** — automatically adds `using System;`, `using System.Linq;` and a handful of
  other near-universal namespaces to every file, so you don't repeat them. It's why you'll see
  `Task` and `List<T>` used without any visible `using`.
- **`PackageReference`** — a NuGet dependency. NuGet is .NET's package registry, the equivalent of
  npm.
  - `EntityFrameworkCore.SqlServer` — the database provider.
  - `EntityFrameworkCore.Design` — the *design-time* tooling that powers `dotnet ef migrations`.
    `PrivateAssets="all"` means it isn't passed along to anything referencing this project — it's a
    build tool, not a runtime dependency.
  - `Swashbuckle.AspNetCore` — generates the Swagger/OpenAPI documentation UI.

### The folder layout

```
VendingMachine.Api/
  Controllers/    HTTP entry points
  Data/           database context + seed data
  Dtos/           the shapes sent over the wire
  Migrations/     generated database schema history
  Models/         the domain entities stored in the database
  Services/       business logic
  Program.cs      startup and configuration
  appsettings*.json  configuration files
```

This is a deliberately flat structure. Larger systems often split into separate Domain /
Application / Infrastructure projects to enforce dependency direction. At this size that would be
ceremony without benefit — but the folders still separate the same *concerns*, so the seams exist if
the project ever grows.

---

## 3. C# language features used here

If you come from JavaScript, Python, or Java, most of C# will look familiar. This section covers
what's likely to be unfamiliar, all of which appears in this codebase.

### Namespaces

A namespace is a naming scope, like a Python module path:

```csharp
namespace VendingMachine.Api.Services;   // file-scoped namespace declaration
```

The trailing semicolon (rather than braces around the whole file) is the modern "file-scoped" form —
it saves a level of indentation. Other files reach in with `using VendingMachine.Api.Services;`.

### Classes, properties, and `required`

```csharp
// Models/Product.cs
public class Product
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public int PriceCents { get; set; }
    public int Quantity { get; set; }
    public int SlotOrder { get; set; }
}
```

- **`{ get; set; }`** is an *auto-property*: a field plus a getter and setter, generated for you.
  Syntactically it's used like a field (`product.Quantity -= 1`) but it's really a pair of methods,
  so it can be made read-only, validated, or intercepted later without changing callers.
- **`required`** means the compiler refuses to let you construct a `Product` without assigning that
  property. It makes "a product always has a code" a compile-time guarantee instead of a convention.

### Nullable reference types

With `<Nullable>enable</Nullable>`, the compiler tracks whether a reference can be `null`:

```csharp
string name;    // must never be null
string? name;   // may be null, and the compiler forces you to check before using it
```

This is why the purchase result declares:

```csharp
public record PurchaseResult(
    PurchaseStatus Status,
    ProductDto? Product = null,      // the ? is meaningful: may genuinely be absent
    ...
```

A `ProductDto?` says "there may be no product here" — true when the code was not found. The compiler
then requires a null check before use, which is why the tests write `result.Product!.Quantity`. The
`!` is the *null-forgiving operator*: "I know better than you here, trust me." It's a deliberate
escape hatch, appropriate in a test that has just asserted the status.

### Records

```csharp
public record ProductDto(string Code, string Name, int PriceCents, int Quantity, bool IsOutOfStock, int SlotOrder);
```

One line, and you get: a constructor taking all six values, a read-only property per value,
value-based equality (two records with equal contents are `==`), and a readable `ToString()`.

**Records are for values; classes are for things with identity.** `ProductDto` is a snapshot of data
being shipped to a client, so it's a record. `Product` is a row in a table with a lifetime and an
`Id`, whose `Quantity` gets mutated during a sale, so it's a class.

### Enums with explicit values

```csharp
public enum CoinDenomination
{
    Nickel = 5,
    Dime = 10,
    Quarter = 25,
    Dollar = 100
}
```

The numbers are not arbitrary labels — **they are the coin's value in cents**. That choice pays off
repeatedly:

```csharp
var value = (int)denomination;         // ChangeMakingService: the coin's worth, by casting
BalanceCents += (int)denomination;     // MachineStateService: adding a coin to the balance
```

The cast `(int)denomination` extracts the underlying number. No lookup table needed. The trade-off:
if you ever added a denomination whose name didn't map to a unique value, this would break — but for
currency that can't happen.

### Primary constructors

```csharp
public class VendingMachineService(
    VendingMachineDbContext dbContext,
    IMachineStateService machineState,
    IChangeMakingService changeMakingService) : IVendingMachineService
```

The parameters after the class name are a **primary constructor** (C# 12). Those three values are
available throughout the class body as if they were fields. The older equivalent needed three field
declarations, a constructor, and three assignments — roughly eight lines of pure ceremony. Every
service and controller in this project uses this form.

`: IVendingMachineService` means "implements this interface."

### Interfaces

An interface is a contract with no implementation:

```csharp
public interface IChangeMakingService
{
    IReadOnlyDictionary<CoinDenomination, int>? MakeChange(
        int amountCents,
        IReadOnlyDictionary<CoinDenomination, int> availableInventory);
}
```

The `I` prefix is a .NET naming convention. Interfaces matter here for two reasons: dependency
injection resolves them to concrete types ([section 5](#5-dependency-injection)), and tests can
substitute alternative implementations.

### Collections and read-only views

- `List<T>` — a growable array.
- `Dictionary<TKey, TValue>` — a hash map.
- `IReadOnlyDictionary<TKey, TValue>` / `IReadOnlyList<T>` — interfaces exposing only the read
  operations.

Returning `IReadOnlyDictionary` communicates "don't modify this." Note it does *not* make the
underlying object immutable — a caller could cast back. `MachineStateService` therefore goes
further and returns an actual copy:

```csharp
public IReadOnlyDictionary<CoinDenomination, int> InsertedCoins
{
    get
    {
        lock (_lock)
        {
            return new Dictionary<CoinDenomination, int>(_insertedCoins);   // a copy
        }
    }
}
```

Copying means a caller iterating the result can't crash if another request inserts a coin midway.
More on that in [section 10](#the-machine-state-service).

### LINQ

LINQ (Language Integrated Query) is a set of methods for transforming sequences. If you know
JavaScript's `map`/`filter`/`reduce`, you already know the idea.

```csharp
var changeBreakdown = changeCoins
    .Select(kvp => new CoinCount(kvp.Key, kvp.Value))          // map
    .OrderByDescending(c => (int)c.Denomination)               // sort
    .ToList();                                                 // materialise
```

`kvp => ...` is a **lambda** — an anonymous function. Common operators used here: `Select` (map),
`Where` (filter), `OrderBy`/`OrderByDescending`, `SingleOrDefault`, `ToList`, `ToDictionary`,
`GetValueOrDefault`.

LINQ's real trick appears in [section 8](#linq-becomes-sql): against a database, the same syntax
compiles to SQL instead of running in memory.

### Collection expressions and spread

```csharp
private static readonly CoinDenomination[] DenominationsDescending =
    [.. Enum.GetValues<CoinDenomination>().OrderDescending()];
```

`[...]` is a **collection expression** (C# 12) and `..` inside it is the **spread** operator. This
reads: get every value of the enum, sort descending, splat into an array. Because it's
`static readonly`, it's computed once when the type loads, not per call.

Note what this buys: the change-making algorithm never hard-codes the coin list. Add a
`HalfDollar = 50` to the enum and the algorithm picks it up automatically.

### `async` / `await`

Database and network calls take milliseconds — an eternity for a CPU. Blocking a thread while
waiting wastes a resource that could serve other requests.

```csharp
public async Task<PurchaseResult> PurchaseAsync(string productCode, CancellationToken cancellationToken = default)
{
    var product = await dbContext.Products.SingleOrDefaultAsync(p => p.Code == productCode, cancellationToken);
    ...
}
```

- **`Task<T>`** — a promise of a `T` later. `Task` alone is a promise of "done, no value."
- **`async`** — marks a method as containing `await`.
- **`await`** — suspends this method until the operation completes, *releasing the thread* to do
  other work meanwhile. When the result arrives, execution resumes.

The convention is to suffix such methods with `Async`.

**`CancellationToken`** is how cancellation propagates. If the browser aborts the request, ASP.NET
Core signals the token, and EF Core abandons the query rather than finishing work nobody wants.
Passing it down through every layer is why you see it threaded through the controller into the
service into the query.

### Pattern matching and switch expressions

```csharp
return result.Status switch
{
    PurchaseStatus.Success => Ok(result),
    PurchaseStatus.ProductNotFound => NotFound(result),
    PurchaseStatus.OutOfStock => Conflict(result),
    PurchaseStatus.ChangeUnavailable => Conflict(result),
    PurchaseStatus.InsufficientFunds => StatusCode(StatusCodes.Status402PaymentRequired, result),
    _ => StatusCode(StatusCodes.Status500InternalServerError, result)
};
```

A **switch expression** produces a value rather than executing statements. `_` is the catch-all. The
compiler warns if you miss a case, which means adding a new `PurchaseStatus` surfaces every place
that needs updating.

### `is null` and null checks

```csharp
if (product is null)
```

`is null` is preferred over `== null` because `==` can be overloaded by a type to mean something
surprising, while `is null` cannot be intercepted.

### Deconstruction and tuples

```csharp
public (int ReturnedCents, IReadOnlyDictionary<CoinDenomination, int> ReturnedCoins) ReturnCoins();

// used as:
var (returnedCents, returnedCoins) = machineState.ReturnCoins();
```

A **named tuple** returns several values without declaring a type, and **deconstruction** unpacks
them. Good for a small, local, two-value result. If it grew or crossed more boundaries, a record
would be clearer.

`foreach (var (denomination, count) in insertedCoins)` deconstructs each dictionary entry the same
way.

### `lock`

```csharp
private readonly Lock _lock = new();

public int InsertCoin(CoinDenomination denomination)
{
    lock (_lock)
    {
        _insertedCoins[denomination] = _insertedCoins.GetValueOrDefault(denomination) + 1;
        BalanceCents += (int)denomination;
        return BalanceCents;
    }
}
```

A web server handles requests **concurrently on multiple threads**. Two simultaneous coin inserts
could interleave mid-update and corrupt the state — a classic race condition. `lock` guarantees only
one thread is inside the block at a time.

`System.Threading.Lock` is a dedicated lock type (newer than the traditional "lock on any object"
approach) that makes the intent explicit and is a little faster.

---

## 4. Program.cs: how the application starts

`Program.cs` is the entry point. It uses **top-level statements** — no `class Program`, no
`static void Main`, just executable code at file scope.

It has two halves, and the split is the thing to internalise:

```csharp
var builder = WebApplication.CreateBuilder(args);
//  ... PHASE 1: register services ...
var app = builder.Build();
//  ... PHASE 2: configure the request pipeline ...
app.Run();
```

**Phase 1 answers "what components exist?"** Everything is registered into a container.
**Phase 2 answers "what happens to each request?"** Middleware is assembled into a pipeline.
`app.Run()` starts listening and blocks until shutdown.

### Phase 1: service registration

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
```

`AddControllers()` registers the MVC machinery that discovers controller classes and routes requests
to them.

`JsonStringEnumConverter` is small but load-bearing. By default .NET serialises an enum as its
**number**, so `CoinDenomination.Quarter` would appear in JSON as `25`. With this converter it
appears as `"Quarter"`. That's why the TypeScript client can declare:

```typescript
export type CoinDenomination = 'Nickel' | 'Dime' | 'Quarter' | 'Dollar';
```

Remove this one line and the front-end contract silently breaks.

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
```

These generate an OpenAPI description of the API and serve an interactive UI at `/swagger`, which
lets you exercise every endpoint from a browser without writing a client.

```csharp
builder.Services.AddDbContext<VendingMachineDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VendingMachineDb")));
```

Registers the database context and tells EF Core to use SQL Server, reading the connection string
from configuration. Note `AddDbContext` registers it as **scoped** by default — see
[section 5](#5-dependency-injection).

```csharp
builder.Services.AddSingleton<IMachineStateService, MachineStateService>();
builder.Services.AddSingleton<IChangeMakingService, ChangeMakingService>();
builder.Services.AddScoped<IVendingMachineService, VendingMachineService>();
```

The heart of the DI setup. Each line says "when something asks for this interface, give it this
implementation, with this lifetime."

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularDevCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
```

**CORS — why it exists.** Browsers enforce the *same-origin policy*: JavaScript loaded from origin A
may not read responses from origin B. Without it, any site you visited could silently issue
authenticated requests to your bank and read the replies.

Our front end runs on `http://localhost:4200` and the API on `http://localhost:5022`. Different
port means different origin, so the browser blocks it *unless the server opts in*. This policy is
that opt-in, and it names exactly one origin. `curl` ignores CORS entirely — it is a browser
mechanism, not a server security boundary.

Since this API has no authentication, CORS is the only thing scoping who may call it from a browser.
That is a deliberate decision documented in `PLAN.md`, not an oversight.

### Phase 2: the request pipeline

```csharp
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(AngularDevCorsPolicy);
app.UseAuthorization();
app.MapControllers();

app.Run();
```

**Middleware** is a chain. Each request passes through every component in order; each may handle it,
modify it, or pass it along. **Order is behaviour, not style.** `UseCors` must come before
`MapControllers`, or the response reaches the client without the headers that permit the browser to
read it.

The `IsDevelopment()` check means Swagger exists only in development. Environment comes from the
`ASPNETCORE_ENVIRONMENT` variable, set to `Development` in `launchSettings.json`.

### Configuration

`appsettings.json` holds defaults; `appsettings.Development.json` overrides them in development:

```json
{
  "ConnectionStrings": {
    "VendingMachineDb": "Server=.\\SQLEXPRESS;Database=VendingMachineDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

- `Server=.\SQLEXPRESS` — the local machine's SQL Server Express named instance. (`\\` is an escaped
  backslash in JSON.)
- `Trusted_Connection=True` — authenticate with the current Windows account rather than a
  username/password. Which is why **there are no credentials in this repository at all** — nothing
  to leak.
- `TrustServerCertificate=True` — accept the local dev certificate. Reasonable locally, wrong in
  production.

Configuration layers: JSON files, then environment variables, then command-line arguments, each
overriding the previous. In production, the connection string would come from an environment
variable or a secret store, not a file.

### `launchSettings.json`

Local development only — never deployed. It defines the `http` profile used throughout this project:

```json
"http": {
  "commandName": "Project",
  "applicationUrl": "http://localhost:5022",
  "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
}
```

Hence `dotnet run --launch-profile http`, and hence the front end's hard-coded `localhost:5022`.

---

## 5. Dependency injection

### The problem

A class that constructs its own collaborators is welded to them:

```csharp
public class VendingMachineService
{
    private readonly ChangeMakingService _changeMaking = new();   // hard-wired
}
```

You cannot substitute a different implementation for a test, and the class now owns decisions about
object lifetime that aren't its business.

### The inversion

**Ask for what you need; let someone else supply it.**

```csharp
public class VendingMachineService(
    VendingMachineDbContext dbContext,
    IMachineStateService machineState,
    IChangeMakingService changeMakingService) : IVendingMachineService
```

`VendingMachineService` declares three dependencies and never constructs one. At startup, the
container learns how to build each; at request time it assembles the graph automatically.

`PurchaseController` asks for an `IVendingMachineService`; the container sees it needs a DbContext, a
state service, and a change-making service; it builds those (recursively, if they had dependencies of
their own) and hands back a finished object.

### The three lifetimes

| Lifetime | Instances | Used here for |
|---|---|---|
| **Transient** | A new one every time it's requested | *(not used here)* |
| **Scoped** | One per HTTP request | `DbContext`, `IVendingMachineService` |
| **Singleton** | One for the whole application | `IMachineStateService`, `IChangeMakingService` |

These choices are **deliberate and each is load-bearing**:

**`IMachineStateService` is a singleton** because it *is* the machine's physical state. A real
vending machine has one coin slot with one pending transaction. If it were scoped, each HTTP request
would get a fresh empty balance and inserting coins would do nothing — you'd insert a dollar and the
next request would see zero. Singleton is what makes the balance persist across requests.

This is also exactly why it needs `lock`: a singleton is shared by every concurrent request thread.

**`IChangeMakingService` is a singleton** because it is *stateless* — pure computation, same inputs
give same outputs, no fields to corrupt. Sharing one instance is free and thread-safe by
construction.

**`DbContext` is scoped** — this is the important one. A `DbContext` is a *unit of work*: it tracks
every entity it loads and the changes made to them, then writes them all in one `SaveChanges`.
That bookkeeping must not leak between requests.

- As a **singleton** it would accumulate every entity ever loaded (a memory leak), share tracked
  changes between unrelated users, and break — it is explicitly not thread-safe.
- As **transient**, two components in the same request would get different contexts, so changes made
  through one would be invisible to the other and `SaveChanges` would only persist half the work.

Scoped is the only correct answer: one unit of work per request.

**`IVendingMachineService` is scoped** because it depends on the scoped `DbContext`. A singleton may
not depend on a scoped service — it would capture the first request's context and keep using it
forever. ASP.NET Core detects this "captive dependency" at startup and throws, which is a good
example of the framework enforcing a rule rather than letting you discover it in production.

### Why interfaces

Registering `IMachineStateService → MachineStateService` rather than the concrete type lets tests
substitute a fake, and lets the implementation change without touching consumers.

### Why isn't `DbContext` injected as an interface?

Look at the constructor again and something should jump out:

```csharp
public class VendingMachineService(
    VendingMachineDbContext dbContext,        // concrete class
    IMachineStateService machineState,        // interface
    IChangeMakingService changeMakingService) // interface
```

Two interfaces and one concrete type. If you've been taught "always depend on abstractions," that
looks like an oversight. It isn't, and the reasons are worth understanding because they generalise.

**`DbContext` is already the abstraction.** It *is* the Unit of Work pattern — a workspace that
tracks changes and commits them together. `DbSet<T>` *is* the Repository pattern — a queryable
collection standing in for a table. An `IVendingMachineDbContext` would be an abstraction wrapping an
abstraction.

**The wrapper wouldn't decouple you from EF Core anyway.** The interface would have to expose
`DbSet<Product>` and `SaveChangesAsync`, both EF Core types. Consumers would still write LINQ that
must be translatable to SQL *by EF*, still depend on change tracking, still inherit deferred
execution. You'd have added a file and changed nothing about the coupling. Real decoupling needs
repository interfaces with domain-shaped methods returning plain types:

```csharp
public interface IProductRepository
{
    Task<Product?> FindByCodeAsync(string code, CancellationToken ct = default);
}
```

That is a genuine abstraction — and a much larger commitment, which buys nothing until there's a
second persistence mechanism to hide behind it.

**The testability motive doesn't apply, because EF already provides the seam.** Substitution happens
through *providers*, not types:

```csharp
var options = new DbContextOptionsBuilder<VendingMachineDbContext>()
    .UseInMemoryDatabase(Guid.NewGuid().ToString())
    .Options;
```

`VendingMachineServiceTests` swaps SQL Server for an in-memory store with no interface involved. The
seam you would be adding already exists one level down.

**Mocking a `DbContext` produces tests that lie.** To fake a `DbSet<T>` you must implement
`IQueryable` plus the async enumerable interfaces. Your LINQ then executes as LINQ-to-Objects, whose
semantics differ from LINQ-to-SQL in ways that matter:

- string comparison is case-sensitive in memory, and usually case-*insensitive* in SQL Server;
- null ordering and equality differ;
- an expression EF cannot translate throws against a real database but runs happily against a mock.

So the test passes and production breaks. A real provider has far higher fidelity, which is why the
tests here use one.

**Mechanically, `AddDbContext<T>` registers the concrete type.** Routing an interface to it takes
extra wiring, and it must *forward* to the existing registration rather than register separately —
otherwise you get two contexts per request, each with its own change tracker, and half your writes
silently disappear:

```csharp
builder.Services.AddScoped<IVendingMachineDbContext>(sp =>
    sp.GetRequiredService<VendingMachineDbContext>());
```

**When you genuinely would do it:** strict Clean Architecture, where an Application-layer project is
forbidden from referencing EF Core at all. The interface lives in the inner layer, the context
implements it in the outer one, and the compiler enforces the direction of dependency. That's a
coherent design — but it only means something if you have the layered project structure to enforce.
This codebase deliberately has one project with folders ([section 2](#the-folder-layout)), so the
rule would be self-imposed and unenforced. `ProductsController` injects the context directly for the
same reason.

### An honest note on the other two

Having defended the concrete `DbContext`, it's worth turning the question around: are the two
interfaces earning their place? The tests construct the real implementations:

```csharp
var sut = new VendingMachineService(context, new MachineStateService(), new ChangeMakingService());
```

Nothing is ever substituted. `IChangeMakingService` has the better case — a change-making *algorithm*
is genuinely swappable, and you could imagine a dynamic-programming implementation for a non-canonical
coin set. `IMachineStateService` is closer to reflex.

So the fair summary is not "the `DbContext` is inconsistent." It is: **the `DbContext` is the one
place where declining to add an interface is clearly correct, and the other two are debatable.**

The principle worth taking away: an interface is a seam, and seams have a cost — indirection, an
extra file, one more hop when reading the code. Add them where something will plausibly be
substituted, not everywhere on principle.

---

## 6. Controllers: turning HTTP into method calls

### Anatomy

```csharp
[ApiController]
[Route("api/products")]
public class ProductsController(VendingMachineDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetProducts(CancellationToken cancellationToken)
    {
        var products = await dbContext.Products
            .OrderBy(p => p.SlotOrder)
            .Select(p => new ProductDto(p.Code, p.Name, p.PriceCents, p.Quantity, p.Quantity == 0, p.SlotOrder))
            .ToListAsync(cancellationToken);

        return Ok(products);
    }
}
```

- **`[ApiController]`** — an attribute (metadata attached to a declaration, read at runtime). It
  opts into API conventions: automatic model validation, inferring that complex parameters come from
  the request body, and returning `400` automatically on malformed input.
- **`[Route("api/products")]`** — the base path for every action in this controller.
- **`ControllerBase`** — the base class for APIs, giving helpers like `Ok()`, `NotFound()`,
  `Conflict()`. (`Controller` — without "Base" — adds view-rendering support for server-rendered
  HTML, which we don't want.)
- **`[HttpGet]`** — this method answers `GET` on the controller's route.
- **`ActionResult<T>`** — either a `T` or an HTTP result like `NotFound()`. It lets one method
  return "here's your data" or "here's a status code" while keeping the payload type visible to
  Swagger.
- **`Ok(products)`** — HTTP 200 with `products` serialised as the body.

**Note this controller talks to `DbContext` directly**, with no service layer. That's an intentional
call: the operation is "read a list and shape it," with no business rules to speak of. Wrapping it in
a `ProductService` that only forwards the call would add a file and a layer to protect nothing. The
purchase flow, which *does* have rules, gets a service.

### `CancellationToken` for free

`GetProducts(CancellationToken cancellationToken)` — nobody passes this explicitly. ASP.NET Core
recognises the type and supplies a token tied to the client connection. If the browser gives up, the
token is cancelled and the query is abandoned.

### Model binding

```csharp
[HttpPost("coins")]
public ActionResult<MachineBalanceDto> InsertCoin([FromBody] InsertCoinRequest request)
```

`[FromBody]` deserialises the JSON request body into an `InsertCoinRequest`. The browser sends:

```json
{ "denomination": "Quarter" }
```

and `request.Denomination` is the `CoinDenomination.Quarter` enum value. The JSON is camelCase and
the C# is PascalCase; the serialiser bridges that automatically. `"Quarter"` becomes an enum member
thanks to the `JsonStringEnumConverter` registered in `Program.cs`.

### Status codes as a first-class outcome

The most interesting controller is `PurchaseController`:

```csharp
var result = await vendingMachineService.PurchaseAsync(request.ProductCode, cancellationToken);

return result.Status switch
{
    PurchaseStatus.Success            => Ok(result),                                              // 200
    PurchaseStatus.ProductNotFound    => NotFound(result),                                        // 404
    PurchaseStatus.OutOfStock         => Conflict(result),                                        // 409
    PurchaseStatus.ChangeUnavailable  => Conflict(result),                                        // 409
    PurchaseStatus.InsufficientFunds  => StatusCode(StatusCodes.Status402PaymentRequired, result), // 402
    _ => StatusCode(StatusCodes.Status500InternalServerError, result)
};
```

Notice the division of labour: **the service decides *what happened*; the controller decides *how to
say it in HTTP*.** The service returns a `PurchaseStatus` and knows nothing about status codes. Swap
the transport for gRPC or a message queue and the service is unchanged.

Why these particular codes:

- **404 Not Found** — the named resource doesn't exist. Correct for an unknown product code.
- **409 Conflict** — the request is well-formed but conflicts with current state. Out of stock and
  can't-make-change are both "valid ask, wrong moment."
- **402 Payment Required** — reserved in the HTTP spec and rarely used, but here it is literally
  accurate.

**Crucially, the body is sent with the error too.** A 402 still carries the full `PurchaseResult`
including `amountStillNeededCents`, so the client can say "insert 75¢ more" rather than just
"failed." This shapes the front end: its error handler reads `err.error` and re-uses the same
result-handling path as success.

---

## 7. DTOs and JSON

### Why not just return the entity?

`ProductsController` could return `Product` objects directly. It doesn't, and the reasons are worth
understanding.

**A DTO (Data Transfer Object) is the public contract; the entity is a private implementation
detail.** Compare:

```csharp
public class Product          // entity — a database row
{
    public int Id { get; set; }                 // database key
    public required string Code { get; set; }
    ...
}

public record ProductDto(string Code, string Name, int PriceCents,
                         int Quantity, bool IsOutOfStock, int SlotOrder);
```

Differences:

1. **`Id` is not exposed.** It's a database implementation detail. Clients address products by
   `Code`, which is meaningful to the domain.
2. **`IsOutOfStock` is added.** It's computed (`Quantity == 0`), not stored. The client shouldn't
   have to know the rule.
3. **Renaming a database column can't break clients**, because the mapping is explicit and in one
   place.
4. **Accidental over-exposure is impossible.** Add a `SupplierCostCents` field to the entity and it
   does *not* silently appear in the API response.

The mapping lives in one small function:

```csharp
private static ProductDto ToDto(Product product) =>
    new(product.Code, product.Name, product.PriceCents, product.Quantity, product.Quantity == 0, product.SlotOrder);
```

(`=>` here is an *expression-bodied member* — shorthand for a method whose body is a single
expression. `new(...)` omits the type name because the return type already states it.)

### The naming bridge

| Layer | Convention | Example |
|---|---|---|
| C# | PascalCase | `PriceCents` |
| JSON on the wire | camelCase | `priceCents` |
| TypeScript | camelCase | `priceCents` |

`System.Text.Json` camelCases by default. The TypeScript interfaces mirror the JSON exactly, so the
two languages agree without any code generation — at the cost that nothing *enforces* the agreement.
Change a DTO property name here and the TypeScript still compiles; the field just arrives
`undefined` at runtime. That's the main hazard of hand-mirrored contracts, and it's why the
[frontend guide](../../frontend/docs/README.md) treats the model files as a contract to keep in sync
deliberately.

---

## 8. Entity Framework Core

### What an ORM is for

Talking to a database directly means writing SQL strings, executing them, and copying columns into
objects by hand — repetitive, and easy to get wrong in ways that only show up at runtime. An
**Object-Relational Mapper** maps tables to classes and generates the SQL for you.

The trade-off is real: you gain type safety and speed of development, and you lose some visibility
into exactly what SQL runs. Knowing what EF is doing underneath is the difference between using it
well and being surprised by it.

### The DbContext

```csharp
public class VendingMachineDbContext(DbContextOptions<VendingMachineDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<MachineCoinInventoryItem> CoinInventory => Set<MachineCoinInventoryItem>();
    ...
}
```

A `DbContext` is two things at once:

1. **A description of the model** — which classes map to which tables.
2. **A unit of work** — an in-memory workspace tracking loaded entities and their changes, flushed
   by `SaveChanges`.

Each `DbSet<T>` is a queryable collection representing a table. `=> Set<Product>()` is an
expression-bodied property, equivalent to a getter returning `Set<Product>()`.

### Change tracking, and why the purchase code looks odd

This is the single most surprising thing about EF Core for a newcomer. Look carefully:

```csharp
var product = await dbContext.Products.SingleOrDefaultAsync(p => p.Code == productCode, cancellationToken);
...
product.Quantity -= 1;
...
await dbContext.SaveChangesAsync(cancellationToken);
```

**There is no "save this product" call.** No `Update(product)`. We mutate a plain object and later
call `SaveChanges()`.

It works because when EF loads an entity it keeps a snapshot of the original values. `SaveChanges`
compares current state to that snapshot, finds `Quantity` changed from 25 to 24, and emits:

```sql
UPDATE Products SET Quantity = 24 WHERE Id = 11;
```

Only changed columns, only changed rows. The same applies to the coin inventory:

```csharp
var inventoryItems = await dbContext.CoinInventory.ToListAsync(cancellationToken);
var inventoryByDenomination = inventoryItems.ToDictionary(i => i.Denomination);

foreach (var (denomination, count) in insertedCoins)
{
    inventoryByDenomination[denomination].Count += count;
}
```

`inventoryByDenomination` is a plain `Dictionary` — but it holds **references to the same tracked
objects** in `inventoryItems`. Mutating through the dictionary mutates the tracked entities, so
`SaveChanges` picks it all up. The dictionary is purely an ergonomic index for lookup by
denomination.

The corollary: an entity loaded into a context is *live*. Mutating it accidentally and calling
`SaveChanges` for an unrelated reason will persist that mutation too.

### LINQ becomes SQL

```csharp
var products = await dbContext.Products
    .OrderBy(p => p.SlotOrder)
    .Select(p => new ProductDto(p.Code, p.Name, p.PriceCents, p.Quantity, p.Quantity == 0, p.SlotOrder))
    .ToListAsync(cancellationToken);
```

This does *not* load products and then sort them in C#. `DbSet<T>` implements `IQueryable<T>`, so
the lambdas are captured as **expression trees** — data structures describing the code — which EF
translates to SQL:

```sql
SELECT [p].[Code], [p].[Name], [p].[PriceCents], [p].[Quantity],
       CASE WHEN [p].[Quantity] = 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END,
       [p].[SlotOrder]
FROM [Products] AS [p]
ORDER BY [p].[SlotOrder]
```

Even `p.Quantity == 0` became a SQL `CASE`. Two consequences worth holding onto:

**Deferred execution.** Nothing runs until `ToListAsync` (or `SingleOrDefaultAsync`, or a `foreach`).
Up to that point you're composing a query, not executing one.

**`Select` before materialising is a real optimisation.** Because the projection is part of the SQL,
only those six columns cross the wire, and **no entities are tracked** — there's nothing to track,
since `ProductDto` isn't an entity. For a read-only list endpoint that's exactly right: less data,
less memory, no change-tracking overhead.

Contrast with the purchase flow, which loads *entities* precisely because it intends to modify and
save them.

**The trap:** if EF can't translate an expression, older versions would silently fetch everything and
filter in memory; modern EF throws instead. Either way, calling `.ToList()` too early and then
filtering means you've moved the whole table into memory. Materialise last.

### `SingleOrDefaultAsync` and friends

| Method | No match | Multiple matches |
|---|---|---|
| `SingleOrDefaultAsync` | returns `null` | **throws** |
| `FirstOrDefaultAsync` | returns `null` | returns the first |
| `SingleAsync` | **throws** | **throws** |

`SingleOrDefaultAsync` is right for the product lookup: absence is expected and handled
(`ProductNotFound`), but two products sharing a code would mean the database has been corrupted, and
a loud exception beats silently picking one. The unique index on `Code` makes that impossible
anyway — the two decisions reinforce each other.

### Model configuration

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Product>(entity =>
    {
        entity.Property(p => p.Code).HasMaxLength(4).IsRequired();
        entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
        entity.HasIndex(p => p.Code).IsUnique();
        entity.HasData(DbSeeder.Products);
    });

    modelBuilder.Entity<MachineCoinInventoryItem>(entity =>
    {
        entity.HasIndex(c => c.Denomination).IsUnique();
        entity.HasData(DbSeeder.CoinInventory);
    });
}
```

EF infers a lot by convention — a property called `Id` becomes the primary key, and an integer key
becomes auto-incrementing. `OnModelCreating` is where you state what convention can't infer:

- **`HasMaxLength(4)`** — `nvarchar(4)` instead of `nvarchar(max)`. Smaller, indexable, and a
  guard against nonsense data.
- **`IsUnique()` on `Code`** — the database enforces that no two products share a code. This is a
  *constraint*, not a validation: it holds even if a bug in the C# tries to violate it. It also
  makes lookups by code fast.
- **`IsUnique()` on `Denomination`** — guarantees exactly one inventory row per coin type, which is
  what makes `ToDictionary(i => i.Denomination)` safe (that would throw on a duplicate key).
- **`HasData`** — seed data baked into migrations. See the next section.

---

## 9. Migrations and seeding

### The problem migrations solve

Your C# model evolves. The database schema must evolve with it, on every developer machine and every
environment, in the right order, without losing data. Migrations are that history: an ordered set of
schema changes, each knowing how to apply and reverse itself.

### The generated files

```
Migrations/
  20260725153919_InitialCreate.cs           <- Up() and Down()
  20260725153919_InitialCreate.Designer.cs  <- model snapshot at this migration
  VendingMachineDbContextModelSnapshot.cs   <- current cumulative model
```

The timestamp prefix orders them. `Up()` applies the change; `Down()` reverses it. The snapshot lets
EF diff your current model against the last known state to generate the *next* migration — which is
why the snapshot must be committed, and why hand-editing it causes strange diffs.

### The workflow

```bash
# after changing an entity class:
dotnet ef migrations add AddSupplierColumn   # generate a migration from the model diff
dotnet ef database update                    # apply pending migrations to the database
dotnet ef database drop --force              # delete the database entirely (dev only)
```

Run these from `backend/VendingMachine.Api/`. They need the `dotnet-ef` global tool:

```bash
dotnet tool install --global dotnet-ef
```

**Always read a generated migration before applying it.** EF infers intent from a model diff, and it
can't distinguish "renamed a column" from "dropped one column and added another" — one preserves
data, the other destroys it.

### Seeding with `HasData`

```csharp
public static IReadOnlyList<Product> Products { get; } =
[
    new() { Id = 1, Code = "A1", Name = "Cola", PriceCents = 125, Quantity = 10, SlotOrder = 1 },
    ...
    new() { Id = 3, Code = "A3", Name = "Root Beer", PriceCents = 125, Quantity = 0, SlotOrder = 3 },
    ...
];
```

`HasData` makes seed data **part of the migration** — the `InitialCreate` migration contains the
`INSERT` statements. Consequences:

- A fresh `database update` produces a fully populated database. No separate seeding step, no "run
  this script first."
- **Explicit `Id` values are mandatory.** EF needs a stable key to know whether a later migration
  should insert, update, or delete a seed row. Change `Cola`'s price and the next migration emits an
  `UPDATE` for `Id = 1` — it's tracked data, not a one-off script.
- The seed is versioned in Git alongside the schema.

Note `A3` and `C2` are seeded at `Quantity = 0` **on purpose**: the front end has an out-of-stock
indicator, and without a zero-stock product it could never be seen without first buying out a slot.
The seed data is chosen to demonstrate the system's states.

Coin inventory is seeded at 40/40/40/15 — enough float that change-making usually succeeds, few
enough dollars that it's possible to exhaust them and see the failure path.

### Resetting

```bash
dotnet ef database drop --force && dotnet ef database update
```

Stop the API first — SQL Server refuses to drop a database with open connections. This is the fast
way back to a known-good state after experimenting.

---

## 10. The domain logic

Now the actual vending machine.

### Money is integer cents, everywhere

Every monetary value in this codebase is an `int` of cents: `PriceCents`, `BalanceCents`,
`ChangeDueCents`, `AmountStillNeededCents`.

This is not fussiness. Binary floating point cannot represent most decimal fractions exactly:

```csharp
0.1 + 0.2 == 0.3     // false, for double
```

Accumulate a few of those in a loop that must land on exactly zero, and change-making becomes
unpredictable. Integers are exact, and the domain is naturally discrete anyway — there is no such
thing as half a cent in a coin machine.

The cost is that formatting for display becomes the client's job: `priceCents / 100` in the Angular
currency pipe. That's a good trade — presentation belongs at the edge.

(C#'s `decimal` is the other correct choice for money: base-10, exact for decimal fractions. For a
coin machine where every amount is a whole number of cents, `int` is simpler and faster.)

### The change-making service

```csharp
public class ChangeMakingService : IChangeMakingService
{
    private static readonly CoinDenomination[] DenominationsDescending =
        [.. Enum.GetValues<CoinDenomination>().OrderDescending()];

    public IReadOnlyDictionary<CoinDenomination, int>? MakeChange(
        int amountCents,
        IReadOnlyDictionary<CoinDenomination, int> availableInventory)
    {
        var result = new Dictionary<CoinDenomination, int>();
        var remaining = amountCents;

        foreach (var denomination in DenominationsDescending)
        {
            if (remaining <= 0)
            {
                break;
            }

            var value = (int)denomination;
            var available = availableInventory.GetValueOrDefault(denomination);
            var count = Math.Min(available, remaining / value);

            if (count > 0)
            {
                result[denomination] = count;
                remaining -= count * value;
            }
        }

        return remaining == 0 ? result : null;
    }
}
```

**The algorithm:** walk denominations from largest to smallest. At each, take as many as you can —
bounded by both what's in stock (`available`) and what's still owed (`remaining / value`, integer
division). Subtract and continue. If you reach zero, you've made change; if anything remains, return
`null`.

**Worked example — 75¢ from a full float:**

| Coin | `remaining / value` | Available | Take | Remaining |
|---|---|---|---|---|
| Dollar (100) | 0 | 15 | 0 | 75 |
| Quarter (25) | 3 | 40 | 3 | 0 |
| Dime | — | — | — | *(loop breaks)* |

Result: 3 quarters.

**Worked example — 75¢ with no quarters:**

| Coin | `remaining / value` | Available | Take | Remaining |
|---|---|---|---|---|
| Dollar | 0 | 15 | 0 | 75 |
| Quarter | 3 | **0** | 0 | 75 |
| Dime | 7 | 40 | 7 | 5 |
| Nickel | 1 | 40 | 1 | 0 |

Result: 7 dimes and a nickel. The inventory bound is what makes it degrade gracefully instead of
failing.

**Why greedy is *correct* here, not just convenient.** Greedy algorithms are usually heuristics — for
an arbitrary coin system they can fail. The textbook counterexample: with coins {1, 3, 4}, making 6
greedily gives 4+1+1 (three coins) when 3+3 (two coins) is optimal.

US coinage {5, 10, 25, 100} is *canonical*: greedy is provably optimal for it. So this simple
implementation is not a shortcut that happens to work — it's the right algorithm for this domain.
**If you added a denomination, that guarantee would need rechecking**, and a general solution would
need dynamic programming. That's precisely the kind of thing worth a comment, and the class has one.

**Design notes:**

- Returning `null` for "impossible" rather than throwing: failing to make change is an *expected
  business outcome*, not an exceptional condition. The caller handles it as one branch among several.
- The service is **pure** — no database, no state, no I/O. Which makes it trivially unit-testable and
  safe as a singleton.
- `GetValueOrDefault` returns 0 for a missing key rather than throwing, so a partially-populated
  inventory dictionary is handled naturally.

### The machine state service

```csharp
public class MachineStateService : IMachineStateService
{
    private readonly Lock _lock = new();
    private readonly Dictionary<CoinDenomination, int> _insertedCoins = [];

    public int BalanceCents { get; private set; }
    ...
}
```

This models the coins sitting in the slot, paid but not yet spent.

**Why it isn't in the database.** A real machine's pending balance doesn't survive a power cut, and
there is exactly one pending sale at a time. Persisting it would model something that doesn't exist —
and would raise questions with no good answers ("whose balance is it?" "when does it expire?"). An
in-memory singleton is a *more* accurate model, not a lazier one.

The visible consequence: restart the API and any pending balance is gone. That's correct behaviour,
not a bug.

**`{ get; private set; }`** — readable from anywhere, writable only from inside the class. Callers
change the balance only through `InsertCoin`/`ReturnCoins`/`Reset`, which keeps `BalanceCents` and
`_insertedCoins` consistent with each other.

**Thread safety.** As a singleton it's shared across concurrent requests, so every operation that
touches either field takes the lock. Note the getter locks *and copies*:

```csharp
return new Dictionary<CoinDenomination, int>(_insertedCoins);
```

Without the copy, a caller iterating the dictionary while another thread inserted a coin would get an
exception mid-loop. The lock alone wouldn't help — it protects the copy, not the caller's later
iteration.

### The purchase flow

`VendingMachineService.PurchaseAsync` is where everything meets. Read it as a sequence of gates, each
returning early:

```csharp
// Gate 1: does the product exist?
var product = await dbContext.Products.SingleOrDefaultAsync(p => p.Code == productCode, cancellationToken);
if (product is null)
{
    return new PurchaseResult(PurchaseStatus.ProductNotFound);
}

// Gate 2: is it in stock?
if (product.Quantity <= 0)
{
    return new PurchaseResult(PurchaseStatus.OutOfStock, ToDto(product));
}

// Gate 3: has enough money been inserted?
var balanceCents = machineState.BalanceCents;
if (balanceCents < product.PriceCents)
{
    return new PurchaseResult(
        PurchaseStatus.InsufficientFunds,
        ToDto(product),
        AmountStillNeededCents: product.PriceCents - balanceCents);
}
```

**The ordering is a product decision.** Stock is checked before funds, so selecting a sold-out slot
tells you it's empty rather than demanding money first. Reverse them and the machine would take your
money before admitting it has nothing to sell.

`AmountStillNeededCents:` is a **named argument** — it labels which optional parameter is being set,
skipping the ones between. It also documents the value at the call site.

```csharp
// Gate 4: can we make the change?
var changeDueCents = balanceCents - product.PriceCents;
var insertedCoins = machineState.InsertedCoins;

var inventoryItems = await dbContext.CoinInventory.ToListAsync(cancellationToken);
var availableForChange = inventoryItems.ToDictionary(i => i.Denomination, i => i.Count);
foreach (var (denomination, count) in insertedCoins)
{
    availableForChange[denomination] = availableForChange.GetValueOrDefault(denomination) + count;
}

var changeCoins = changeMakingService.MakeChange(changeDueCents, availableForChange);
if (changeCoins is null)
{
    return new PurchaseResult(PurchaseStatus.ChangeUnavailable, ToDto(product), changeDueCents);
}
```

**The coins you just inserted count toward your own change.** That's what the `foreach` adds. A real
machine drops your coins into the same hopper it pays out from, so paying with a dollar for a 75¢
item can be settled with that very dollar's worth of float. Omitting this would reject sales the
machine could actually complete.

Note that `availableForChange` is a *separate* dictionary of counts (`i => i.Count` projects the
number out), not a view onto the entities. Building it can't accidentally mutate inventory — which
matters, because this is still the "decide" phase.

**Every gate so far has mutated nothing.** The machine only commits once it knows the whole sale can
succeed.

```csharp
// Commit
await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

product.Quantity -= 1;

var inventoryByDenomination = inventoryItems.ToDictionary(i => i.Denomination);
foreach (var (denomination, count) in insertedCoins)
{
    inventoryByDenomination[denomination].Count += count;      // deposit
}
foreach (var (denomination, count) in changeCoins)
{
    inventoryByDenomination[denomination].Count -= count;      // pay out
}

await dbContext.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);

machineState.Reset();
```

**The transaction.** A transaction makes several statements atomic: all commit, or none do. Here it
spans decrementing stock and adjusting coin inventory. Without it, a crash between the two writes
could leave the machine having dispensed a product it never charged for — or taken coins without
reducing stock.

`await using` is the asynchronous form of `using`: it disposes the transaction when the block exits,
including on an exception. If `SaveChangesAsync` throws, `CommitAsync` is never reached and disposal
rolls back automatically. **The failure path needs no explicit code** — that's the point of the
construct.

(In practice `SaveChangesAsync` already wraps its work in a transaction. The explicit one is about
intent and future-proofing: it makes the atomic boundary visible, and it stays correct if a second
`SaveChanges` or another operation is added inside.)

`machineState.Reset()` clears the pending balance *after* the commit succeeds. Order matters: reset
first and a failed commit would have swallowed the customer's money.

```csharp
var changeBreakdown = changeCoins
    .Select(kvp => new CoinCount(kvp.Key, kvp.Value))
    .OrderByDescending(c => (int)c.Denomination)
    .ToList();

return new PurchaseResult(PurchaseStatus.Success, ToDto(product), changeDueCents, changeBreakdown);
```

The breakdown is sorted largest-first purely so the UI reads naturally ("1 Dollar, 2 Quarters").

Note `ToDto(product)` is called *after* the decrement, so the returned product carries the new
quantity — which is what lets the front end update its grid from the response.

---

## 11. Testing with xUnit

### The framework

**xUnit** is the test framework. A test is a method marked `[Fact]`:

```csharp
[Fact]
public void MakeChange_ZeroAmount_ReturnsEmptyBreakdown()
{
    var result = _sut.MakeChange(0, new Dictionary<CoinDenomination, int>());

    Assert.NotNull(result);
    Assert.Empty(result);
}
```

Run them all with `dotnet test` from `backend/`.

**Naming convention:** `MethodUnderTest_Scenario_ExpectedOutcome`. A failure message then reads like
a sentence, and you can tell what broke without opening the file.

**`_sut`** is a common abbreviation for *system under test* — the thing being tested, as opposed to
its collaborators.

**Arrange / Act / Assert** structures each test: set up the world, perform one action, check the
outcome. You can see the three blocks in every test here.

### Testing pure logic

`ChangeMakingServiceTests` is the easy case — no database, no mocks, just inputs and outputs:

```csharp
[Fact]
public void MakeChange_ExactChangeAvailable_PrefersLargestDenominationsFirst()
{
    var inventory = new Dictionary<CoinDenomination, int>
    {
        [CoinDenomination.Dollar] = 5,
        [CoinDenomination.Quarter] = 5,
        [CoinDenomination.Dime] = 5,
        [CoinDenomination.Nickel] = 5,
    };

    var result = _sut.MakeChange(125, inventory);

    Assert.NotNull(result);
    Assert.Equal(1, result[CoinDenomination.Dollar]);
    Assert.Equal(1, result[CoinDenomination.Quarter]);
    Assert.False(result.ContainsKey(CoinDenomination.Dime));
    Assert.False(result.ContainsKey(CoinDenomination.Nickel));
}
```

The last two assertions matter as much as the first two: they prove the algorithm didn't return
*some* valid combination but specifically the largest-denomination-first one. Asserting the absence
of dimes is what pins the behaviour down.

This is the payoff for keeping `ChangeMakingService` pure. No setup, no cleanup, microseconds to run.

### Testing against a database

`VendingMachineServiceTests` needs a `DbContext`. Rather than a real SQL Server, it uses EF Core's
**in-memory provider**:

```csharp
private static VendingMachineDbContext CreateContext()
{
    var options = new DbContextOptionsBuilder<VendingMachineDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
        .Options;

    var context = new VendingMachineDbContext(options);
    context.Database.EnsureCreated();
    return context;
}
```

Three deliberate details:

1. **`Guid.NewGuid().ToString()` as the database name.** Each test gets a uniquely-named store, so
   tests are isolated and can run in parallel. Reuse a fixed name and one test's writes would leak
   into another — the classic source of "passes alone, fails in the suite."

2. **`ConfigureWarnings(... TransactionIgnoredWarning)`.** The in-memory provider has no real
   transactions, so `BeginTransactionAsync` is a no-op and EF warns loudly (by default, throws). The
   test suppresses it — with a comment noting transactional behaviour was verified against real SQL
   Server manually. **This is a genuine limitation to be honest about:** these tests do not prove
   atomicity. They prove the logic around it.

3. **`EnsureCreated()`** creates the schema *and applies the `HasData` seed*. So every test starts
   from the same 12 products and coin float the real application starts from. Tests reference `A3`
   knowing it's out of stock and `D2` knowing it costs 75¢, rather than building fixtures by hand.

### What the tests actually pin down

```csharp
[Fact]
public async Task PurchaseAsync_NoExactChangeAvailable_RejectsPurchaseWithoutMutatingState()
{
    await using var context = CreateContext();

    var coinItems = await context.CoinInventory.ToListAsync();
    foreach (var item in coinItems) { item.Count = 0; }      // empty the float
    await context.SaveChangesAsync();

    var machineState = new MachineStateService();
    var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

    machineState.InsertCoin(CoinDenomination.Dollar);
    machineState.InsertCoin(CoinDenomination.Dollar);

    var result = await sut.PurchaseAsync("A1");              // A1 costs 125c, so 75c change is owed

    Assert.Equal(PurchaseStatus.ChangeUnavailable, result.Status);
    Assert.Equal(75, result.ChangeDueCents);

    // nothing was mutated: balance, stock, and inventory all unchanged
    Assert.Equal(200, machineState.BalanceCents);
    var product = await context.Products.SingleAsync(p => p.Code == "A1");
    Assert.Equal(10, product.Quantity);
    Assert.All(await context.CoinInventory.ToListAsync(), c => Assert.Equal(0, c.Count));
}
```

The assertions after the comment are the valuable ones. It's easy to write a test that only checks
the returned status; this one verifies the **absence of side effects** — the customer keeps their
$2.00, the stock is untouched, the inventory is untouched. That's the property that actually matters
to a user, and it's the kind of thing a refactor breaks silently.

Similarly, the success test asserts persisted state, not just the return value:

```csharp
var dollars = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Dollar);
Assert.Equal(16, dollars.Count);   // seeded 15 + 1 inserted
var quarters = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Quarter);
Assert.Equal(39, quarters.Count);  // seeded 40 - 1 dispensed as change
```

It re-queries the context and checks the deposit *and* the payout landed. A bug that added the
customer's dollar but forgot to remove the change quarter would pass a status-only test and fail this
one.

### What isn't tested

Worth stating plainly:

- **Controllers.** Status-code mapping is a `switch` with no branching logic worth defending;
  integration tests via `WebApplicationFactory` would be the tool if it grew.
- **Real transaction rollback**, per the in-memory limitation above.
- **Concurrency.** `MachineStateService`'s locking is reasoned about, not exercised by a
  multi-threaded test.

Knowing what your suite *doesn't* cover is as useful as knowing what it does.

---

## 12. Running and troubleshooting

```bash
cd backend
dotnet build                                        # compile
dotnet test                                         # run all tests
dotnet run --project VendingMachine.Api --launch-profile http
```

With the API running, Swagger UI is at <http://localhost:5022/swagger> — the fastest way to try
endpoints without a client.

### A manual walkthrough

```bash
curl http://localhost:5022/api/products

curl -X POST http://localhost:5022/api/machine/coins \
  -H "Content-Type: application/json" -d '{"denomination":"Dollar"}'
# {"balanceCents":100}

curl -X POST http://localhost:5022/api/purchase \
  -H "Content-Type: application/json" -d '{"productCode":"D2"}'
# {"status":"Success","product":{...},"changeDueCents":25,"changeBreakdown":[{"denomination":"Quarter","count":1}], ...}
```

Try the failure paths too — `"A3"` for out of stock, an empty balance for insufficient funds. Use
`-i` to see status codes.

### Common problems

| Symptom | Cause and fix |
|---|---|
| `A network-related or instance-specific error...` | SQL Server isn't running, or the instance name differs. Check the `MSSQL$SQLEXPRESS` service and the connection string. |
| `Cannot open database ... requested by the login` | Database not created. `dotnet ef database update`. |
| `Cannot drop database ... currently in use` | The API holds a connection. Stop it, then drop. |
| `dotnet ef` not recognised | `dotnet tool install --global dotnet-ef`. |
| Browser: `blocked by CORS policy` | The front end isn't on `http://localhost:4200`, which is the only allowed origin. |
| Balance resets unexpectedly | The API restarted. Pending balance is in-memory by design. |
| Purchase returns 409 `ChangeUnavailable` | The coin float can't make exact change. Reset the DB or pay closer to exact. |

---

## 13. Exercises

Roughly increasing in difficulty. Each touches a different layer.

1. **Add a `GET /api/machine/inventory` endpoint** returning current coin counts. Practises:
   controller, DTO, EF query.

2. **Add a half-dollar coin.** Add `HalfDollar = 50` to the enum, seed some, generate a migration.
   Notice the change-making algorithm needs no edit — and check whether greedy is still optimal for
   {5, 10, 25, 50, 100}. (It is. Convince yourself why.)

3. **Reject a purchase when the machine can't hold more coins.** Add a capacity rule and a new
   `PurchaseStatus`. Notice the compiler pointing you at the controller's `switch`.

4. **Write a failing test first.** Assert that inserting a coin then returning it leaves the coin
   inventory unchanged (returned coins are the customer's, never banked). Make it pass.

5. **Replace the in-memory test provider with SQLite in-memory**, which supports real transactions.
   Write a test proving a failure mid-purchase rolls back both writes — closing the gap
   [section 11](#what-isnt-tested) admits to.

6. **Add optimistic concurrency.** Give `Product` a `[Timestamp]` row version and handle
   `DbUpdateConcurrencyException` for two simultaneous purchases of the last item. This is the real
   bug hiding in the current design: nothing stops two concurrent requests both passing the stock
   check.

---

## Where to go next

- **The front end**: [`frontend/docs/README.md`](../../frontend/docs/README.md) — the same treatment
  for Angular, TypeScript, and the browser platform.
- **Design rationale**: `PLAN.md` at the repository root, for decisions taken before any code existed.
- **Working conventions**: `CLAUDE.md` at the repository root.

Official documentation worth bookmarking:

- [ASP.NET Core](https://learn.microsoft.com/aspnet/core/)
- [Entity Framework Core](https://learn.microsoft.com/ef/core/)
- [C# language reference](https://learn.microsoft.com/dotnet/csharp/)
- [xUnit](https://xunit.net/)
