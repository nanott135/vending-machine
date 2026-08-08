# The Front End, Explained From Scratch

A complete guide to the vending machine web app: the TypeScript it's written in, how Angular turns
components into a running page, how data flows between them, and how the sound, animation, and
scaling actually work.

**This assumes no prior knowledge of Angular, TypeScript, or reactive programming.** It does assume
you know roughly what HTML and CSS are, and that you can program in *something*.

Every code sample is real code from this project. File paths are relative to
`frontend/vending-machine-app/`.

---

## Table of contents

1. [What the front end actually is](#1-what-the-front-end-actually-is)
2. [TypeScript](#2-typescript)
3. [How an Angular app starts](#3-how-an-angular-app-starts)
4. [Components](#4-components)
5. [Templates](#5-templates)
6. [Signals: the reactivity model](#6-signals-the-reactivity-model)
7. [Dependency injection and services](#7-dependency-injection-and-services)
8. [HTTP and Observables](#8-http-and-observables)
9. [The app, walked through](#9-the-app-walked-through)
10. [The dispenser bin: effects, timers, and animation](#10-the-dispenser-bin-effects-timers-and-animation)
11. [The sound service: Web Audio from scratch](#11-the-sound-service-web-audio-from-scratch)
12. [Fit-to-viewport scaling](#12-fit-to-viewport-scaling)
13. [Styling](#13-styling)
14. [Testing](#14-testing)
15. [Build tooling](#15-build-tooling)
16. [Exercises](#16-exercises)
17. [Appendix: `const`, `readonly`, and actually preventing mutation](#17-appendix-const-readonly-and-actually-preventing-mutation)
18. [Appendix: what `@angular` means in an import path](#18-appendix-what-angular-means-in-an-import-path)
19. [Appendix: writable, derived, and why `computed` is read-only](#19-appendix-writable-derived-and-why-computed-is-read-only)

---

## 1. What the front end actually is

It is a **single-page application (SPA)**. The browser downloads one HTML shell plus a JavaScript
bundle; that JavaScript builds the entire UI in the DOM and keeps it updated. The page never
navigates or reloads.

The alternative — a server rendering fresh HTML per click — is simpler, but every interaction costs a
round trip. For a vending machine where pressing `C` should light up instantly, client-side is the
right shape.

The app knows nothing about SQL Server or C#. It knows five HTTP endpoints returning JSON. That is
the entire coupling between the halves of this system.

### The pieces

```
src/
  main.ts                     entry point
  styles.scss                 global styles and the colour palette
  index.html                  the HTML shell
  app/
    app.ts / app.html         root component
    app.config.ts             application-wide providers
    core/
      models/                 TypeScript interfaces mirroring the API's JSON
      services/               API clients + the sound engine
      utils/                  product/coin artwork lookup
    features/vending-machine/
      vending-machine/        the container component
      product-grid/           3x4 layout
      product-slot/           one product tile
      coin-slot/              balance + coin buttons
      keypad/                 code entry
      dispenser-bin/          the delivery tray
public/images/                hand-authored SVG artwork
```

`core/` holds things used across the app; `features/` holds one screen's components.

### Why `features/` and not `components/`?

A reasonable question, since every folder under `features/vending-machine/` contains a component. The
two names answer different questions:

- **`components/` groups by what a file *is*.** All components together, all services together, all
  pipes together — organised by technical type.
- **`features/` groups by what a file is *for*.** Everything belonging to one area of the app lives
  together, whatever type it happens to be.

Four reasons this project uses the second:

**Type-based grouping stops scaling.** With six components, `components/` is fine. At eighty, it is
a flat alphabetical list where `coin-slot` sits beside `invoice-line-item` with nothing to indicate
they belong to unrelated parts of the app. The folder name has also told you nothing — *everything*
in an Angular app is a component, so the label doesn't partition anything.

**Features co-locate what changes together.** This is the strongest argument. Working on the vending
machine means touching its components, its styles, and eventually its own service and routes.
Type-based grouping scatters those across four directories, so one logical change means four folders
open at once. A feature folder puts them in one place.

**Features are boundaries you can act on.** A feature can be lazy-loaded behind a route, assigned an
owner in `CODEOWNERS`, or deleted by deleting its folder. None of that applies to "all components" —
that isn't a thing which can be loaded, owned, or removed.

**It gives `core/` a meaning.** The two halves define each other:

```
core/       shared by everything — models, HTTP services, SoundService, image utils
features/   one folder per area of the app, self-contained
```

`SoundService` lives in `core/` because the keypad, the coin slot and the container all use it. Under
a flat `components/`, there would be no natural place for that distinction to live. Larger projects
often add a third folder, `shared/`, for reusable presentational components; this one hasn't needed
it.

The structure is meant to grow like this:

```
features/
  vending-machine/    <- what exists today
  admin/              <- restocking, pricing
  reporting/          <- sales history
```

Each self-contained, each independently loadable.

**The honest counterpoint:** at this project's size, `components/` would work perfectly well. There is
one feature and six components, so the feature folder buys structure the app does not yet need. It
also costs a directory level on every import — `../../../core/models/product.model` is three levels
of climbing.

Two things justify it regardless. It is the structure the Angular style guide recommends, so a
developer who knows Angular can open the repository and immediately find things. And converting *to*
it later means rewriting every import in the app, whereas starting with it costs nothing. It is cheap
insurance, not a claim that the app is complicated.

---

## 2. TypeScript

TypeScript is JavaScript plus a type system. Types are checked at compile time and then **erased** —
the browser runs plain JavaScript, and no type exists at runtime. This matters more than it sounds;
see [the section on API contracts](#the-contract-is-a-promise-not-a-guarantee).

### Basic annotations

```typescript
const width: number = element.offsetWidth;
function fitScale(element: HTMLElement): number { ... }
```

A parameter or return type after a colon. Most of the time you can omit it and let TypeScript infer.

### Interfaces

An interface describes an object's shape:

```typescript
// core/models/product.model.ts
export interface Product {
  code: string;
  name: string;
  priceCents: number;
  quantity: number;
  isOutOfStock: boolean;
  slotOrder: number;
}
```

Pass an object missing `priceCents`, or with it as a string, and compilation fails. Note this is
purely a compile-time description — there is no `Product` class at runtime.

### Union types

```typescript
// core/models/coin.model.ts
export type CoinDenomination = 'Nickel' | 'Dime' | 'Quarter' | 'Dollar';
```

A **string literal union**: the value must be one of exactly those four strings. This is genuinely
useful here — `coinImageFor('Nickle')` (typo) is a compile error, not a broken image at runtime.

It also pairs exactly with the backend. The C# enum is serialised as a string, so these four literals
*are* the wire format.

### Optional and nullable

```typescript
export interface PurchaseResult {
  status: PurchaseStatus;
  product: Product | null;              // present, but may be null
  changeBreakdown: CoinCount[] | null;
  ...
}
```

`Product | null` says the field is always there but may be null. `product?: Product` would mean the
key might be absent entirely. Under `strictNullChecks`, TypeScript forces you to handle the null
before using it — which is why the container writes `result.product?.name`.

`strictNullChecks` is on here even though nothing in this project's `tsconfig.json` sets `strict`.
It comes from TypeScript 6.0, which flipped `strict` to default *true*. On TypeScript 5.x the same
config would have left it off, and `result.product.name` would have compiled silently. If you are
reading this against an older toolchain, check `tsc --showConfig` rather than assuming.

`?.` is **optional chaining**: evaluates to `undefined` instead of throwing if the left side is
null/undefined.

### Generics

```typescript
getProducts(): Observable<Product[]> {
  return this.http.get<Product[]>(`${API_BASE_URL}/products`);
}
```

`Observable<Product[]>` is "an Observable of an array of Product." The `<Product[]>` on `get` tells
`HttpClient` what to expect, so the result is typed rather than `any`.

**Be clear about what this does and doesn't do:** it's an *assertion*, not a validation. Nothing
checks the JSON at runtime. If the API returned something else, TypeScript would be none the wiser.

#### So what actually happens if the shape is wrong?

Not a compile error — the compiler believes you. And usually **not a runtime error either**, which is
what makes this worth understanding. Types in TypeScript are **erased** during compilation. This:

```typescript
this.http.get<Product[]>(`${API_BASE_URL}/products`)
```

becomes exactly this in the browser:

```javascript
this.http.get(API_BASE_URL + "/products")
```

The `<Product[]>` is gone. There is no `Product` at runtime — `HttpClient` calls `JSON.parse` and
hands back a plain object, unexamined. Nothing compares it to your interface, because by then the
interface does not exist.

So if the API renamed `priceCents` to `price`, one of three things happens:

**1. Silent wrong data — the usual case.** `product.priceCents` is `undefined`, `undefined / 100` is
`NaN`, and the tile renders **`$NaN`**. No exception, nothing in the console. The app runs happily and
shows nonsense.

**2. A delayed `TypeError`.** If the missing value is used in a way that needs an object —
`product.description.toUpperCase()` — you get `Cannot read properties of undefined`. That *is* a
runtime error, but it fires wherever the value is finally touched, potentially several components
away from the HTTP call. The stack trace points at the symptom, not the cause.

**3. Nothing at all**, if the renamed field happens to be unused.

That is the whole meaning of "assertion, not validation": you are telling the compiler *trust me,
this is a `Product[]`* — not asking it to check. It obliges completely, then type-checks all your
downstream code against a promise that may be false.

The contrast with the backend is instructive. `System.Text.Json` deserialising into a `ProductDto`
genuinely constructs an object at runtime, so a missing JSON property has defined behaviour (it takes
the type's default). The server has runtime reality behind its types. The browser has none.

**If you want the failure to happen loudly, at the boundary:**

- **Runtime validation** with a library like [zod](https://zod.dev/) or valibot. You declare the
  schema once, derive the TypeScript type *from* it, and parse each response — a mismatch throws
  immediately, naming the offending field.
- **Generate the types from the API's OpenAPI document**, which prevents drift rather than detecting
  it. That's [exercise 7](#16-exercises).

### `readonly`, `const`, and template literals

```typescript
readonly product = input.required<Product>();     // property can't be reassigned
const MAX_SCALE = 1.6;                            // binding can't be reassigned
`${API_BASE_URL}/products`                        // template literal with interpolation
```

`readonly` prevents reassigning the property, not mutating the object it points at — and `const` is
the same guarantee at the variable level, so a `const` object is still freely mutable.
[Appendix 17](#17-appendix-const-readonly-and-actually-preventing-mutation) covers the distinction and
what to use when you genuinely need to prevent mutation.

### Decorators

```typescript
@Component({ selector: 'app-product-slot', ... })
export class ProductSlot { ... }
```

A decorator is metadata attached to a declaration with `@`. `@Component` doesn't change the class's
behaviour directly — it records configuration that Angular reads to know how to instantiate and
render it.

### Modules

```typescript
import { Component, input } from '@angular/core';   // from a package
import { Product } from '../../../core/models/product.model';   // relative path
export interface Product { ... }                    // make available to others
```

Only exported things are importable. Paths starting with `.` are relative files; anything else
resolves from `node_modules`.

---

## 3. How an Angular app starts

### The chain

`index.html` contains a single `<app-root></app-root>` and nothing else — no script tag. The Angular
CLI injects one at build time: it compiles `src/main.ts` (named as the entry point in `angular.json`)
into a hashed bundle and writes `<script src="main-<hash>.js" type="module">` into the served copy of
the HTML, along with a link to the compiled stylesheet. So the file the browser receives has a script
tag; the file in the repository does not.

That script runs `main.ts`:

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

`bootstrapApplication` finds the element matching `App`'s selector (`app-root`), instantiates the
component, renders its template inside, and recursively does the same for any components that
template uses.

This is the **standalone** bootstrap. Older Angular required an `NgModule` (`AppModule`) declaring
every component; modern Angular lets each component declare its own dependencies, and there's no
module here at all. If you find a tutorial full of `@NgModule`, it predates this.

### Application configuration

```typescript
// app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
  ]
};
```

`providers` registers things available for injection app-wide.

- **`provideHttpClient()`** makes `HttpClient` injectable. **Without this line, injecting
  `HttpClient` throws at runtime** — a common first stumble.
- **`provideBrowserGlobalErrorListeners()`** hooks unhandled errors and promise rejections into
  Angular's error reporting.

### The root component

```typescript
// app/app.ts
@Component({
  selector: 'app-root',
  imports: [VendingMachine],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

An empty class. Its only job is to host `<app-vending-machine />`. All the real work is one level
down, which keeps the root free to gain routing or a layout shell later.

---

## 4. Components

A component is a class plus a template plus styles. It is the unit Angular renders and updates.

```typescript
// features/vending-machine/product-slot/product-slot.ts
import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { productImageFor } from '../../../core/utils/product-image';

@Component({
  selector: 'app-product-slot',
  imports: [CurrencyPipe],
  templateUrl: './product-slot.html',
  styleUrl: './product-slot.scss',
})
export class ProductSlot {
  readonly product = input.required<Product>();

  protected readonly imageUrl = computed(() => productImageFor(this.product()));
}
```

- **`selector`** — the tag name. Writing `<app-product-slot />` renders this component.
- **`imports`** — what the *template* is allowed to use. `CurrencyPipe` is imported because the
  template writes `| currency`. Forget it and the template fails to compile. This is a real
  improvement over the old module system: dependencies are declared where they're used.
- **`templateUrl` / `styleUrl`** — external files. (`template:`/`styles:` inline are also valid; this
  project uses external files throughout for consistency.)

The `@angular` prefix on the first two import lines is an npm scope — a namespace for packages
published by the Angular team, resolved from `node_modules` rather than from this project. It is
unrelated to the `@` in `@Component` below it. See
[appendix 18](#18-appendix-what-angular-means-in-an-import-path) for the full explanation, including
why `@angular/core` and this project's own `core/` folder are different things.

### `protected` in a component class

```typescript
protected readonly imageUrl = computed(...);
```

Angular templates can read `public` and `protected` members but not `private`. Marking
template-only members `protected` says "this is for my template, not for other code" — the compiler
then stops other TypeScript from reaching in.

You'll see the pattern throughout: `readonly product = input...` is public (parents set it),
`protected` for template-facing state, `private` for internals.

---

## 5. Templates

Angular templates are HTML plus binding syntax.

### Interpolation — data into text

```html
<div class="slot__code">{{ product().code }}</div>
```

`{{ }}` evaluates an expression and inserts the result as text. It escapes HTML, so it can't inject
markup.

### Property binding — data into attributes

```html
<img class="slot__photo" [src]="imageUrl()" [alt]="product().name" />
```

Square brackets bind a **DOM property** to an expression. Without them, `src="imageUrl()"` would be
the literal string.

```html
<div class="slot" [class.out-of-stock]="product().isOutOfStock">
```

`[class.x]` toggles a single class on a boolean — the idiomatic way to drive conditional styling.

```html
<button [attr.aria-pressed]="muted()" [disabled]="entry().length !== 2">
```

`[attr.x]` sets an **HTML attribute** rather than a DOM property, needed for things like ARIA where
no matching property exists. `[disabled]` is a real property, so no prefix.

### Event binding — the DOM back into the class

```html
<button type="button" (click)="onInsert(coin.value)">
```

Parentheses bind an event. `$event` is available where the event object is needed.

### Control flow

Modern Angular uses `@if` / `@for` blocks (replacing the older `*ngIf` / `*ngFor` directives):

```html
@if (message()) {
  <p class="vending-machine__message">{{ message() }}</p>
}
```

```html
@for (product of products(); track product.code) {
  <app-product-slot [product]="product" />
}
```

**`track` is required, and it's important.** It tells Angular how to identify each item across
updates. With `track product.code`, re-fetching the product list after a purchase updates the
existing DOM elements in place. Without a stable key, Angular would destroy and rebuild every
tile — losing focus, restarting CSS animations, and doing needless work.

That property is used deliberately in [the dispenser bin](#why-the-id-exists), where recreating the
element is exactly what's wanted.

### Pipes

```html
<div class="slot__price">{{ product().priceCents / 100 | currency }}</div>
```

A pipe transforms a value for display. `| currency` formats `1.25` as `$1.25`. This is where integer
cents become human-readable — the [backend guide](../../backend/docs/README.md#money-is-integer-cents-everywhere)
explains why they're integers in the first place. Formatting at the very edge, in the view, is the
right place for it.

### Style encapsulation

Each component's styles are scoped to it by default. Angular adds a generated attribute to the
elements and rewrites selectors to match, so `.slot` in `product-slot.scss` cannot affect a `.slot`
anywhere else. You get to use short, obvious class names without collisions.

`:host` targets the component's own element:

```scss
// dispenser-bin.scss
:host {
  display: flex;
  flex: 1;
}
```

Needed because `<app-dispenser-bin>` is itself a DOM element sitting in the parent's flex column, and
something must give it layout behaviour.

---

## 6. Signals: the reactivity model

This is the most important concept in the app.

### The problem

The UI must reflect state. When state changes, the DOM must change. The question every framework
answers differently is: *how does the framework know something changed?*

Angular's historical answer was zone.js — patch every async browser API, and after anything
completes, re-check every binding in the application. It works but is coarse: a timer firing in one
component triggers a check of the entire tree.

**Signals** are the modern answer: a value that knows who's reading it.

### `signal`

```typescript
protected readonly balanceCents = signal(0);

this.balanceCents.set(balance.balanceCents);   // write
{{ balanceCents() }}                           // read (note the call parentheses)
```

`signal(0)` creates a writable signal. Call it with no arguments to read; `.set()` to replace;
`.update(fn)` to derive from the current value.

**Reading is a function call.** That's the mechanism, not syntax noise: when a template reads
`balanceCents()`, Angular records the dependency. On `.set()`, only the views that actually read it
are marked dirty. Precise updates instead of broad re-checks.

### `computed`

```typescript
protected readonly imageUrl = computed(() => productImageFor(this.product()));
```

A **derived** signal. It tracks which signals it read, recomputes only when one of them changes, and
caches otherwise. Read it like any signal: `imageUrl()`.

Use `computed` for anything derivable from other state. It cannot get out of sync, whereas a manually
maintained copy can.

**A computed cannot be set.** `computed()` returns a read-only `Signal<T>`, not the `WritableSignal<T>`
that `signal()` gives you, so `.set()` and `.update()` don't exist on it — you change a computed by
changing the signals it reads. If you need a value that is derived *and* directly writable, that's
`linkedSignal`. See [appendix 19](#19-appendix-writable-derived-and-why-computed-is-read-only).

### `input` — data from a parent

```typescript
readonly product = input.required<Product>();      // parent MUST provide
readonly item = input<DispensedItem | null>(null); // optional, with a default
```

Inputs *are* signals, read the same way. `input.required` means Angular errors if a parent omits it —
so `product()` is never undefined, and nothing downstream needs a null check.

The parent supplies it by property binding:

```html
<app-product-slot [product]="product" />
```

### `output` — events to a parent

```typescript
readonly insertCoin = output<CoinDenomination>();
readonly returnCoins = output<void>();

this.insertCoin.emit(denomination);
```

The parent listens with event binding:

```html
<app-coin-slot (insertCoin)="onInsertCoin($event)" (returnCoins)="onReturnCoins()" />
```

**This is the core architectural pattern: data flows down through inputs, events flow up through
outputs.** A child never reaches into a parent or mutates what it was given. `CoinSlot` doesn't know
what happens when a coin is inserted; it announces that one was, and the container decides.

That's what makes `CoinSlot` reusable and testable in isolation — you can render it, click a button,
and assert it emitted, with no API and no parent.

### Signals and events are not the same thing

`input()` and `output()` look symmetric, so it's worth being explicit that they are different kinds
of thing:

- A **signal** is a *value that changes over time*. It always has a current value, and you pull it by
  calling it.
- An **event** is a *discrete occurrence*. It happens, whoever is listening is notified, and it's
  gone. There is no current value to read.

The test: **can you ask what it is right now?** For a signal that question always has an answer; for
an event it isn't meaningful — "what is the click right now?" means nothing.

`CoinSlot` has one of each:

```typescript
readonly balanceCents = input.required<number>();   // signal — a value, readable at any time
readonly insertCoin = output<CoinDenomination>();   // event — fires at a moment
```

The types say so too. `input()` returns `InputSignal<T>`, which extends `Signal<T>` — an input really
is a signal, which is why you read it as `product()`. `output()` returns `OutputEmitterRef<T>`, a
class with `emit()` and `subscribe()` and nothing else. It isn't callable: `this.insertCoin()` does
not compile. **Inputs are signals; outputs are not.**

So an event is not a special sort of signal, and vice versa. State is modelled with signals;
occurrences are modelled with events.

Three separate things all get called "events" in casual conversation, and they're worth keeping
apart:

| | What it is | Seen in |
|---|---|---|
| DOM events | The browser's own, nothing to do with Angular | `(click)`, `(keydown)` |
| Component outputs | A child announcing something upward | `output()` / `.emit()` |
| Observables | A stream of pushed values — the event model extended over time | `HttpClient`, [section 8](#8-http-and-observables) |

The two models do convert where you need it: `toSignal()` turns an Observable into a signal (which
means giving it a current value, because a signal must have one), `outputToObservable()` goes the
other way, and `model()` is a genuine hybrid — `ModelSignal<T>` extends `WritableSignal`,
`InputSignal` *and* `OutputRef`. This project uses none of the three; they're worth knowing exist.

### `effect`

```typescript
effect(() => {
  const dispensed = this.item();
  if (!dispensed) {
    return;
  }
  this.current.set(dispensed);
  this.flapOpen.set(true);
  ...
});
```

An **effect** runs when the signals it reads change. It's for *side effects* — things outside the
reactive graph, like timers, logging, or manual DOM work.

**Use effects sparingly.** If you're computing a value, use `computed`. Effects are for reaching
outside the system, which is exactly what the dispenser does: it starts `setTimeout` timers.

### Why signals over the old approach

- **Precision** — only affected views update.
- **Explicit dependencies** — reading is a call, so the graph is knowable rather than inferred.
- **No zone.js.** Zoneless is the default from Angular v21 onwards — there is nothing to enable, and
  this project has no zone.js dependency at all. Smaller bundle, and no monkey-patching of browser
  APIs.
- **One idea for state** — plain state, derived state, and inputs are all signals, read the same way.
  Outputs are the deliberate exception, because
  [they model occurrences rather than values](#signals-and-events-are-not-the-same-thing).

---

## 7. Dependency injection and services

A **service** is a class holding logic or state that isn't a component's business.

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_BASE_URL}/products`);
  }
}
```

- **`@Injectable`** marks it available for injection.
- **`providedIn: 'root'`** means a single shared instance for the whole app, created lazily on first
  use, and tree-shaken away entirely if nothing injects it.
- **`inject(HttpClient)`** asks the injector for the dependency. (Constructor parameter injection is
  the older equivalent; `inject()` works in field initialisers and is now preferred.)

### Why singleton matters here

`SoundService` being a single shared instance is not incidental. It holds one `AudioContext` and one
mute flag. Two instances would mean two audio graphs and a mute button that only muted half the app.
`providedIn: 'root'` is what makes the mute toggle in the marquee affect the keypad's sounds.

### Why services at all

Components should render. Fetching, caching, and knowing URLs is separate work. Splitting it out
means the API base URL lives in one file, several components can share the logic, and each half can
be tested alone.

---

## 8. HTTP and Observables

### Observables vs Promises

`HttpClient` returns an **Observable**, from the RxJS library. Compared to a Promise:

| | Promise | Observable |
|---|---|---|
| Values | Exactly one | Zero, one, or many over time |
| Starts | Immediately on creation | Only when subscribed |
| Cancel | No | Yes, by unsubscribing |

For a single HTTP request the difference is mostly academic — except for that middle row:

```typescript
const request$ = this.http.get<Product[]>(url);   // no request has been sent
request$.subscribe(products => ...);              // NOW it is sent
```

**An Observable is cold: nothing happens until you subscribe.** Forgetting `.subscribe()` is the
classic Angular bug — the code looks right and silently does nothing.

(The `$` suffix on a variable name is a widespread convention meaning "this is an Observable.")

### Subscribing

```typescript
onInsertCoin(denomination: CoinDenomination): void {
  this.machineService.insertCoin(denomination).subscribe((balance) => {
    this.balanceCents.set(balance.balanceCents);
  });
}
```

The callback runs when the response arrives. Note the flow: the API is the authority on the balance,
so the local signal is set from *its* answer rather than being incremented optimistically. If the two
ever disagreed, the server would win.

Angular's `HttpClient` completes the Observable after one response, so these subscriptions clean
themselves up — no manual unsubscribe needed here.

### Error handling

```typescript
onSelectCode(code: string): void {
  this.machineService.purchase(code).subscribe({
    next: (result) => this.handlePurchaseResult(result),
    error: (err: HttpErrorResponse) => {
      const result = err.error as PurchaseResult | undefined;
      if (result?.status) {
        this.handlePurchaseResult(result);
      } else {
        this.sound.reject();
        this.message.set('Something went wrong. Please try again.');
      }
    },
  });
}
```

This is worth dwelling on, because it's where the two halves of the system meet.

The API returns **non-2xx status codes for expected business outcomes** — 402 for insufficient funds,
409 for out of stock. RxJS routes those to the `error` callback. But they are not really errors:
they're results, and they carry a full `PurchaseResult` body.

So the handler digs the body out of `err.error` and, if it looks like a real result, **feeds it
through the exact same `handlePurchaseResult` path as success**. Only a genuine failure — network
down, server crashed, no parseable body — falls through to the generic message.

The `?.status` check is what distinguishes them. `as PurchaseResult | undefined` is a **type
assertion**: `err.error` is `any`, and this tells the compiler what to treat it as. It does not
verify anything at runtime, which is exactly why the `if` is needed.

### The contract is a promise, not a guarantee

```csharp
// C#
public record ProductDto(string Code, string Name, int PriceCents, ...);
```
```typescript
// TypeScript
export interface Product { code: string; name: string; priceCents: number; ... }
```

These are hand-mirrored. `System.Text.Json` camelCases automatically, so `PriceCents` arrives as
`priceCents`. The C# enum serialises as a string, matching the TS union type.

**Nothing enforces this.** Rename a C# property and the TypeScript still compiles — the field just
becomes `undefined` at runtime, and you'll see `$NaN` in the UI rather than a build error. This is
type erasure biting at the system boundary; [section 2](#so-what-actually-happens-if-the-shape-is-wrong)
walks through why there is no error to catch.

Larger projects generate the TypeScript from the OpenAPI document to close that gap. Here the surface
is five endpoints, so it's maintained by hand and deliberately kept in `core/models/` where it's easy
to find — one folder to check when the API changes.

---

## 9. The app, walked through

### The component tree

```
App
└── VendingMachine                (container: owns state, calls services)
    ├── ProductGrid               (layout)
    │   └── ProductSlot × 12      (one tile each)
    ├── CoinSlot                  (balance, coin buttons, return)
    ├── Keypad                    (code entry)
    └── DispenserBin              (delivery tray)
```

This is the **container / presentational** split. `VendingMachine` knows about services, HTTP, and
business outcomes. Everything below it takes inputs and emits outputs, knowing nothing about the API.

### The container's state

```typescript
protected readonly products = signal<Product[]>([]);
protected readonly balanceCents = signal(0);
protected readonly message = signal<string | null>(null);
protected readonly muted = this.sound.muted;
protected readonly dispensed = signal<DispensedItem | null>(null);
```

Note `muted` is not a copy — it's a direct reference to the service's signal. Reading
`this.sound.muted` gives the signal object itself, so the template stays live against the service's
state with no synchronisation.

### Loading on startup

```typescript
ngOnInit(): void {
  this.refreshProducts();
  this.refreshBalance();
}
```

`ngOnInit` is a **lifecycle hook** — Angular calls it once after the component's inputs are set. It's
the conventional place for initial loads. (Other hooks exist: `ngOnDestroy` for cleanup,
`ngOnChanges` for input changes.)

Balance is fetched rather than assumed to be zero, because the API's balance is *server* state that
may already be non-zero — the user might have reloaded the page mid-transaction.

### The keypad

```typescript
export class Keypad {
  private readonly sound = inject(SoundService);
  readonly selectCode = output<string>();

  protected readonly entry = signal('');

  press(key: string): void {
    if (this.entry().length < 2) {
      this.entry.set(this.entry() + key);
      this.sound.keyPress();
    }
  }

  clear(): void {
    this.entry.set('');
    this.sound.keyPress();
  }

  submit(): void {
    if (this.entry().length !== 2) {
      return;
    }
    this.sound.keyPress();
    this.selectCode.emit(this.entry());
    this.entry.set('');
  }
}
```

The keypad owns its own draft state — a two-character buffer. That's genuinely local: nothing else
cares about a half-typed code. Only the completed code escapes, via `selectCode.emit()`.

The guard in `press` means a third keystroke is ignored *and* makes no sound, which is correct
feedback: nothing happened, so nothing should be heard.

Note the sound plays on the click rather than after a round trip, so the keypad feels instant.

### The purchase flow, end to end

1. User clicks `C`, then `3`. `Keypad.entry` becomes `"C3"`; `Select` enables via
   `[disabled]="entry().length !== 2"`.
2. `Select` emits `selectCode` with `"C3"`.
3. `VendingMachine.onSelectCode('C3')` calls `MachineService.purchase('C3')`.
4. `HttpClient` POSTs `{"productCode":"C3"}` to `/api/purchase`.
5. The API validates, commits, and responds — 200, or 402/404/409 with a body.
6. `handlePurchaseResult` runs, for success *or* handled failure.

```typescript
private handlePurchaseResult(result: PurchaseResult): void {
  if (result.status === 'Success') {
    this.sound.vend();
  } else {
    this.sound.reject();
  }

  switch (result.status) {
    case 'Success': {
      if (result.product) {
        this.dispensed.set({ id: ++this.dispenseCount, product: result.product });
      }
      const changeText = result.changeBreakdown?.length
        ? ` Change returned: ${result.changeBreakdown.map((c) => `${c.count}x ${c.denomination}`).join(', ')}.`
        : '';
      this.message.set(`Dispensed ${result.product?.name}.${changeText}`);
      this.refreshProducts();
      break;
    }
    case 'ProductNotFound':
      this.message.set('Unknown product code. Try again.');
      break;
    case 'OutOfStock':
      this.message.set(`${result.product?.name} is out of stock.`);
      break;
    case 'InsufficientFunds':
      this.message.set(
        `Insufficient funds - insert $${(result.amountStillNeededCents / 100).toFixed(2)} more.`,
      );
      break;
    case 'ChangeUnavailable':
      this.message.set('Exact change is not available right now. Please return your coins.');
      break;
  }
  this.refreshBalance();
}
```

Three things to notice:

**The audio decision is separated from the message.** One `if` covers success-vs-everything-else,
because every rejection sounds the same. The `switch` then handles wording. Merging them would repeat
`this.sound.reject()` four times.

**The status enum drives everything.** The backend's `PurchaseStatus` arrives as a string and the TS
union type mirrors it, so the `switch` is exhaustive against a shared vocabulary. Adding a status on
the server means adding a case here — the type system won't force it (an unhandled string just falls
through), which is a known soft spot.

**`refreshProducts()` after a success** re-fetches the grid so quantities and out-of-stock lights
update. The server is treated as the source of truth rather than decrementing locally — slower, but
it cannot drift.

`refreshBalance()` runs on *every* path, including failures, because a rejected purchase leaves the
balance intact and the display must reflect that.

---

## 10. The dispenser bin: effects, timers, and animation

The bin shows the product you just bought falling into a tray, then clears itself.

### Why the id exists

```typescript
export interface DispensedItem {
  id: number;
  product: Product;
}

this.dispensed.set({ id: ++this.dispenseCount, product: result.product });
```

```html
@for (dispensed of current() ? [current()!] : []; track dispensed.id) {
  <img class="bin__item" [src]="imageFor(dispensed.product)" ... />
}
```

An `@for` over a zero-or-one-element array looks odd next to a plain `@if`. It's deliberate.

A CSS animation runs when an element is **created**. With `@if`, buying the same product twice would
keep the same `<img>` in place — Angular would see no change worth acting on, and the drop animation
would not replay. Tracking by an incrementing id guarantees a *different* identity each vend, so
Angular destroys the old element and creates a new one, and the animation restarts.

`current()!` uses the **non-null assertion** `!` — the ternary has already established it isn't null,
but TypeScript can't infer that across the two calls.

### The effect and its timers

```typescript
constructor() {
  effect(() => {
    const dispensed = this.item();
    if (!dispensed) {
      return;
    }

    // A vend landing mid-fade restarts the whole cycle rather than inheriting old timers.
    this.clearTimers();
    this.current.set(dispensed);
    this.flapOpen.set(true);

    this.flapTimer = setTimeout(() => this.flapOpen.set(false), FLAP_OPEN_MS);
    this.removeTimer = setTimeout(() => this.current.set(null), REMOVE_AFTER_MS);
  });

  this.destroyRef.onDestroy(() => this.clearTimers());
}
```

Reading `this.item()` registers the dependency, so the effect re-runs whenever the parent sets a new
item.

**`clearTimers()` first is load-bearing.** Buy something at t=0 and something else at t=2s: without
cancelling, the first purchase's removal timer would still fire at t=3.15s and wipe out the *second*
product about a second after it arrived. There's a test for exactly this.

**`destroyRef.onDestroy`** cancels pending timers when the component is destroyed. A `setTimeout`
holds a reference to its closure — and through it, the component. Leaving them pending leaks the
component and risks writing to a signal on a destroyed view.

### The internal signal

`item` is the input; `current` is internal state mirroring it. Why not render `item` directly?

Because the component needs to clear it, and **a component cannot write to its own input** — the
parent owns that value. `current` is state the bin owns, so it can set it to `null` when the fade
completes.

### Why removal, not just invisibility

The CSS could fade to `opacity: 0` and stop there. But an element at zero opacity is still in the
accessibility tree: a screen reader would keep announcing a product that visually vanished. Removing
it from the DOM is the accessible behaviour, and `REMOVE_AFTER_MS` is timed to land just after the
fade so the removal is never seen.

### The CSS

```scss
.bin__item {
  animation:
    drop 0.85s cubic-bezier(0.33, 0, 0.4, 1) both,
    fade-away 0.7s ease-in 2.3s forwards;
}
```

**Two animations, not one.** The alternative — one long keyframe set covering drop, hold, and fade —
would stretch the easing curve across four seconds and destroy the bounce. Separate animations keep
independent durations, delays, and easings.

- `both` = apply the first frame before it starts and hold the last after it ends.
- `forwards` = hold the final frame (nothing to hold before, since it's delayed).
- Where both animations touch `opacity`, the later one in the list wins while it's active.

```scss
@keyframes drop {
  0%   { transform: translateY(-150px) rotate(-14deg); opacity: 0; }
  12%  { opacity: 1; }
  48%  { transform: translateY(0) rotate(0deg); }
  64%  { transform: translateY(-22px) rotate(4deg); }   /* bounce */
  80%  { transform: translateY(0) rotate(0deg); }
  90%  { transform: translateY(-7px) rotate(-2deg); }   /* smaller bounce */
  100% { transform: translateY(0) rotate(0deg); }
}
```

Two decaying bounces read as weight. A single landing looks like the image simply appeared.

`transform` and `opacity` are the two properties browsers can animate on the compositor, without
recalculating layout or repainting. Animating `top` or `height` instead would be visibly janky.

### Reduced motion

```scss
@media (prefers-reduced-motion: reduce) {
  .bin__item {
    animation: fade-out-only 0.7s ease-in 2.3s forwards;
  }
  .bin__flap { transition: none; }
  .bin__flap--open { transform: none; }
}
```

`prefers-reduced-motion` is an OS-level accessibility setting; for some people large motion triggers
nausea or vertigo. The product still appears and still fades on the same schedule — behaviour is
preserved, movement is not. Note the separate `fade-out-only` keyframe: the normal `fade-away`
includes a translate and scale, which would defeat the purpose.

---

## 11. The sound service: Web Audio from scratch

Every sound is **synthesized in the browser at play time**. There are no `.mp3` or `.wav` files.

### Why synthesis

Sound files would mean binary assets to store, download, and decode. Synthesis is a few hundred bytes
of code, every sound is parameterisable (the coin pitch varies by denomination, from one constant),
and there's nothing to load before the first click.

The trade-off is honest: synthesized sounds are simple and a bit retro. For a 1950s vending machine
that's a feature; for a cinematic game it wouldn't be.

### The AudioContext

```typescript
private audioContext(): AudioContext | null {
  if (this.muted()) {
    return null;
  }
  if (this.context) {
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  const Ctor = typeof globalThis !== 'undefined'
    ? (globalThis.AudioContext ??
       (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : undefined;
  if (!Ctor) {
    return null;
  }

  try {
    this.context = new Ctor();
    return this.context;
  } catch {
    return null;
  }
}
```

An `AudioContext` is the entry point to the Web Audio API — an audio processing graph where you
connect nodes together, ending at `destination` (the speakers).

Four things this small method does:

1. **Returns `null` when muted.** Every play method starts with `if (!ctx) return;`, so muting makes
   them all silent no-ops. The check lives in one place rather than five.
2. **Creates lazily.** Browsers block audio until a user gesture, so contexts created on page load
   start `suspended`. Every call site here is a click handler, so creating on first sound means it
   starts running.
3. **Resumes if suspended**, covering tab-switching and other cases where the browser suspends it.
4. **Returns `null` if the API is missing or construction throws.** This is what makes the service
   safe in tests and server-side rendering, where `AudioContext` doesn't exist. Without it, importing
   the service into a test would crash.

`??` is the **nullish coalescing** operator: use the left unless it's null/undefined. `void` before
`this.context.resume()` explicitly discards the returned Promise — signalling "not awaiting this on
purpose."

### Building a tone

```typescript
private tone(ctx: AudioContext, options: {...}): void {
  const startAt = options.startAt ?? ctx.currentTime;
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, startAt);

  const gain = ctx.createGain();
  // Tiny attack ramp instead of an instant jump, which would click.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + options.duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + options.duration + 0.02);
}
```

- **Oscillator** — produces a waveform. `sine` is pure and soft; `square` is buzzy and electronic
  (the keypad blip); `sawtooth` is harsh (the reject buzz); `triangle` sits between.
- **Gain** — volume. The signal flows oscillator → gain → speakers.
- **The envelope** is the shaping over time. Starting at full volume produces an audible *click*,
  because the waveform jumps discontinuously. Ramping up over 10ms removes it.
- **Why `exponentialRampToValueAtTime`** — human loudness perception is logarithmic, so exponential
  ramps sound linear. It also cannot reach zero, which is why the code uses `0.0001` rather than `0`.
- **Scheduling ahead** — `startAt` lets sounds be queued at precise future times using the audio
  clock, not `setTimeout`. That's how the coin tumble stays rhythmically exact regardless of what the
  main thread is doing.

### Noise and filters

A pure tone can't sound like metal. Real impacts contain broadband noise:

```typescript
private noise(ctx: AudioContext): AudioBuffer | null {
  if (this.noiseBuffer) {
    return this.noiseBuffer;
  }
  const frames = Math.floor(ctx.sampleRate * 0.15);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    channel[i] = Math.random() * 2 - 1;
  }
  this.noiseBuffer = buffer;
  return buffer;
}
```

Random samples between -1 and 1 are white noise. Generated once and cached — regenerating thousands
of samples per coin would be wasteful.

```typescript
const bandpass = ctx.createBiquadFilter();
bandpass.type = 'bandpass';
bandpass.frequency.value = frequency;
bandpass.Q.value = 12;
```

A **bandpass filter** passes frequencies near its centre and attenuates the rest. High `Q` = narrow
band = a ringing, metallic quality. White noise through a narrow bandpass, with a fast decay, is a
convincing coin strike.

### Composing a coin insert

```typescript
coinInsert(denomination: CoinDenomination): void {
  const ctx = this.audioContext();
  if (!ctx) { return; }
  const now = ctx.currentTime;
  const pitch = COIN_PITCH[denomination];

  this.clink(ctx, pitch, now);                      // strike at the slot lip

  const bounces: [number, number, number][] = [     // [delay, pitchScale, level]
    [0.068, 0.94, 0.75],
    [0.121, 0.86, 0.58],
    [0.163, 0.79, 0.44],
    [0.221, 0.72, 0.3],
    [0.268, 0.66, 0.19],
  ];
  for (const [delay, pitchScale, level] of bounces) {
    this.clink(ctx, pitch * pitchScale, now + delay, level);
  }

  this.chuteSlide(ctx, pitch, now + 0.04);          // metallic slide down the ramp

  this.tone(ctx, { type: 'triangle', frequency: pitch * 0.3, duration: 0.13,
                   gain: 0.05, startAt: now + 0.31 });   // settle into the box
}
```

The bounce timings are **deliberately uneven**. Evenly spaced impacts sound like a machine gun;
irregular spacing sounds like something tumbling. Pitch and volume both decay as it descends.

`COIN_PITCH` maps denomination to base frequency — a dime rings at 2600 Hz, a dollar at 1450 Hz.
Bigger coin, lower pitch, which matches physical intuition. Every element scales from that one
number, so all four coins are consistent without four hand-tuned sounds.

`[number, number, number][]` is a **tuple type**: an array of exactly-three-number arrays,
destructured in the loop.

### Persisting mute

```typescript
toggleMute(): void {
  const next = !this.muted();
  this.muted.set(next);
  try {
    localStorage?.setItem(MUTE_STORAGE_KEY, String(next));
  } catch {
    // Storage can be unavailable (private mode, SSR); muting just won't persist.
  }
}
```

`localStorage` can throw — private browsing, disabled storage, or no `window` at all. The empty
`catch` is intentional and commented: failing to persist a preference must not break muting.

---

## 12. Fit-to-viewport scaling

The whole cabinet scales so it always fits without scrolling — a "fit to page" zoom rather than a
responsive re-layout.

### Measuring

```typescript
const VIEWPORT_PADDING = 16;
const MAX_SCALE = 1.6;

function fitScale(element: HTMLElement): number {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) {
    return 1;
  }
  return Math.min(
    MAX_SCALE,
    (window.innerWidth - VIEWPORT_PADDING * 2) / width,
    (window.innerHeight - VIEWPORT_PADDING * 2) / height,
  );
}
```

**`offsetWidth`/`offsetHeight` ignore CSS transforms.** That is the crucial property. They report the
element's *layout* size, so measuring after scaling still returns the original 780px. If this used
`getBoundingClientRect()` — which *does* include transforms — each measurement would feed on the last
and the scale would spiral toward zero.

`Math.min` of both axes means the more constrained dimension wins, so the whole thing fits either
way.

### Wiring it up

```typescript
private readonly machine = viewChild.required<ElementRef<HTMLElement>>('machine');
private readonly destroyRef = inject(DestroyRef);

protected readonly scale = signal(1);

constructor() {
  afterNextRender(() => {
    const element = this.machine().nativeElement;
    const fit = () => this.scale.set(fitScale(element));

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener('resize', fit);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    });
  });
}
```

- **`viewChild.required<ElementRef<HTMLElement>>('machine')`** grabs the element marked
  `#machine` in the template. `ElementRef` wraps it; `.nativeElement` is the real DOM node.
- **`afterNextRender`** runs once after the first render. The element doesn't exist before that, and
  the callback never runs during server-side rendering — which is what makes touching `window` here
  safe.
- **`ResizeObserver`** fires when the element's own size changes — e.g. the message appearing adds
  height. `window.resize` covers the viewport changing. Both are needed; neither alone is enough.
- **`destroyRef.onDestroy`** disconnects both. An observer or listener outliving its component keeps
  the component alive and can fire against a destroyed view.

There's no feedback loop, and it's worth being explicit about why. `observer.observe(element)` with
no options watches the **content box** — a layout measurement — and the Resize Observer specification
states outright that "observations will not be triggered by CSS transforms." Setting the scale
therefore cannot retrigger the observer.

### The centring, and why it's fiddly

```html
<div class="fit-stage">
  <div class="vending-machine" #machine [style.transform]="'scale(' + scale() + ') translate(-50%, -50%)'">
```

```scss
.fit-stage {
  position: fixed;
  inset: 0;
}

.vending-machine {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: 0 0;
  width: 780px;
}
```

The obvious approaches both fail:

- **`display: grid; place-items: center`** — centring is *unsafe* by default, meaning an item larger
  than its track is centred anyway and overflows equally in both directions. The 780px cabinet spills
  195px past *each* edge of a 390px viewport, and the overflow past the start edge is unreachable —
  you cannot scroll to it. Scaling from `transform-origin: 0 0` then starts from a top-left corner
  that is already off-screen.
- **`display: flex` with `margin: auto`** — auto margins collapse to zero when free space is
  negative, so the cabinet top-left aligns and hangs off to the right.

What works: anchor the box's origin at the stage centre with `top: 50%; left: 50%`, set
`transform-origin: 0 0`, and apply `scale()` **before** `translate(-50%, -50%)`.

Transform functions compose **left to right**, each one establishing the coordinate system the next
operates in. `scale()` sets up a scaled coordinate system, and `translate(-50%, -50%)` then runs
inside it — shifting by half the *scaled* size. The element's visual top-left lands at
`(centre − scaledWidth/2, centre − scaledHeight/2)`: correctly centred at any factor.

Reverse the order and the translate uses the unscaled size, centring the box it *would* have been.

### No responsive breakpoint, on purpose

There is deliberately no media query stacking the layout on narrow screens. It fought the scaler:
stacking made the natural box taller, which forced a *smaller* scale than not stacking. Uniform
scaling already guarantees everything fits.

---

## 13. Styling

### SCSS

SCSS is CSS plus nesting, variables, and more. Nesting is what's used here:

```scss
.coin-slot__buttons {
  display: grid;

  button {
    background: var(--chrome);

    &:active {
      transform: scale(0.94);
    }
  }
}
```

`&` refers to the current selector, so `&:active` compiles to `.coin-slot__buttons button:active`.

### CSS custom properties

```scss
:root {
  --cream: #f6edda;
  --coral: #e2543f;
  --turquoise: #4ec3c7;
  --charcoal: #2b2b2e;
  --chrome: linear-gradient(180deg, #f4f6f8 0%, #c3c8cc 45%, #8d9296 55%, #e8ebed 100%);
  --script: Georgia, 'Times New Roman', serif;
  --readout: 'Courier New', Courier, monospace;
}
```

Used as `color: var(--coral)`. Unlike SCSS variables (resolved at compile time), these are live in
the browser: readable from JavaScript and changeable at runtime, which is how theming works.

They're declared once in `styles.scss` and used everywhere. The same palette appears in the hand-
authored SVGs, so a colour change means editing one list rather than hunting hex codes through a
dozen files.

### Naming

Class names follow a BEM-ish `block__element--modifier` pattern: `.bin`, `.bin__item`,
`.bin__flap--open`. With Angular's style encapsulation collisions aren't actually possible, but the
convention still makes a stylesheet readable — you can see structure without opening the template.

### SVG artwork

All imagery is hand-authored SVG in `public/images/`. SVG is XML describing shapes:

```xml
<rect x="44" y="20" width="32" height="54" rx="5" fill="#C0392B" stroke="#2B2B2E" stroke-width="2"/>
```

Chosen over raster because it stays sharp at any scale — which matters a great deal when the entire
UI is being scaled by an arbitrary factor — and because the whole set is about 20KB, versus roughly
516KB for the photographic version it replaced.

Artwork is resolved by slot code, not by name:

```typescript
const SLOT_IMAGES: Record<string, string> = {
  A1: '/images/products/a1-cola.svg',
  ...
};

export function productImageFor(product: Pick<Product, 'code'>): string {
  return SLOT_IMAGES[product.code.toUpperCase()] ?? FALLBACK_IMAGE;
}
```

An earlier version matched on name keywords and had a genuine bug: `'Chocolate Bar'` matched the
keyword `'cola'`, because **cho-*cola*-te contains it**, so the chocolate bar rendered as a can of
cola. Exact keys make that class of error impossible.

`Record<string, string>` is an object with string keys and string values. `Pick<Product, 'code'>`
constructs a type with just that one property — the function needs only the code, and saying so means
tests can pass a minimal object.

---

## 14. Testing

Tests use **Vitest** (the Angular CLI 22 default — not Karma/Jasmine, which older guides assume).

```bash
ng test
```

### Testing a service

```typescript
describe('SoundService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts unmuted and toggles', () => {
    const service = TestBed.inject(SoundService);

    expect(service.muted()).toBe(false);
    service.toggleMute();
    expect(service.muted()).toBe(true);
  });

  it('stays silent instead of throwing when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const service = TestBed.inject(SoundService);

    expect(() => {
      service.keyPress();
      service.coinInsert('Dollar');
      service.vend();
    }).not.toThrow();

    vi.unstubAllGlobals();
  });
});
```

- **`describe` / `it`** group and name tests; **`expect`** asserts.
- **`TestBed`** is Angular's testing harness — it builds an injector so `TestBed.inject` can resolve
  services with their dependencies.
- **`vi.stubGlobal`** replaces a global for one test. Removing `AudioContext` proves the no-audio
  fallback works — a case impossible to reach in a normal browser.

That second test is the valuable one: it pins down a defensive path that would otherwise only be
discovered by something breaking in an unusual environment.

### Testing a component

```typescript
fixture = TestBed.createComponent(DispenserBin);

it('renders the dispensed product with its own artwork', () => {
  fixture.componentRef.setInput('item', { id: 1, product: candyBar });
  fixture.detectChanges();

  const img: HTMLImageElement = fixture.nativeElement.querySelector('.bin__item');
  expect(img.getAttribute('src')).toBe('/images/products/c3-candy-bar.svg');
  expect(img.getAttribute('alt')).toBe('Candy Bar dispensed');
});
```

- **`ComponentFixture`** wraps a component instance plus its rendered DOM.
- **`setInput`** sets a signal input the way a parent would.
- **`detectChanges()`** triggers change detection so the template re-renders. Forgetting it means
  asserting against stale DOM — a very common early mistake.
- **`fixture.nativeElement`** is the root DOM node, queryable with normal DOM APIs.

Note the test asserts against **rendered output**, not internal fields. It would survive a refactor
of the component's internals, and it would fail if the rendering broke — which is the right
sensitivity.

### Testing time

```typescript
describe('clearing the tray', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes the product once it has faded out', () => {
    fixture.componentRef.setInput('item', { id: 1, product: candyBar });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bin__item')).toBeTruthy();

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bin__item')).toBeTruthy();

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bin__item')).toBeNull();
  });
});
```

`vi.useFakeTimers()` replaces `setTimeout` with a controllable clock, and `advanceTimersByTime` jumps
forward instantly. A three-second behaviour is tested in microseconds, deterministically. Waiting for
real time would make the suite slow *and* flaky.

`afterEach(() => vi.useRealTimers())` restores the real clock — without it, later tests would inherit
a frozen one.

The sibling test covers a subtler case: vending a second product mid-fade must not be wiped out by
the first item's pending removal timer. That's the bug `clearTimers()` prevents, and it's the kind of
thing only a timer test can catch.

### What isn't tested

Worth being explicit:

- **No HTTP-level tests.** `HttpTestingController` would let you assert request URLs and simulate
  error responses; the container's error-handling branch is currently unverified.
- **Audio output is never verified** — only that calls don't throw. The sounds in this project were
  checked by instrumenting `AudioContext` in a real browser and recording scheduled frequencies,
  which is a useful technique when you can't assert on sound itself.
- **The scaler has no unit test**; it was verified by measuring rendered geometry across six viewport
  sizes in a real browser.

---

## 15. Build tooling

```bash
npm install     # install dependencies from package.json
ng serve        # dev server at localhost:4200, rebuilds on save
ng build        # production bundle into dist/vending-machine-app/browser/
ng test         # Vitest
```

- **`ng`** is the Angular CLI.
- **`ng serve`** runs a dev server with hot reload — save a file and the browser updates in about a
  second.
- **`ng build`** produces an optimised bundle in `dist/vending-machine-app/browser/`: minified,
  tree-shaken (unused code removed), and content-hashed for cache busting. It also emits the copy of
  `index.html` that actually gets served — the one carrying the injected `<script>` and stylesheet
  tags described in [section 3](#the-chain).
- **`node_modules/`** holds dependencies and is not committed. `package-lock.json` pins exact
  versions so every machine installs the same tree — that one *is* committed.

The dev server proxies nothing: the app calls `localhost:5022` directly, which is why the API's CORS
policy has to allow `localhost:4200`. Both must be running for the app to work.

---

## 16. Exercises

Roughly increasing in difficulty.

1. **Add a "coins in machine" display.** Add the backend endpoint from the backend guide's exercise
   1, a service method, and a component. Practises: models, service, component, input.

2. **Disable the buy button when the balance is too low.** Compute affordability with `computed` and
   bind it. Notice you need the price *and* the balance — which one lives where?

3. **Highlight the selected slot.** As the user types `C` then `3`, tint the matching tile. This
   needs keypad state to reach `ProductGrid`, so it's a real exercise in data flow: does the entry
   signal move up to the container, or does the keypad emit partial codes?

4. **Add a sound for the coin return.** One exists; make the pitch descend across the returned coins
   so returning four sounds different from returning one.

5. **Write an HTTP test.** Use `HttpTestingController` to assert `MachineService.purchase()` POSTs to
   the right URL with the right body, and to simulate a 402 so the container's error branch is
   covered — closing the first gap in [section 14](#what-isnt-tested).

6. **Make the API base URL configurable.** Replace the hard-coded constant with Angular's environment
   files or an injection token, so a production build can point elsewhere. Think about what should
   happen if it's misconfigured.

7. **Generate the TypeScript models from the API's OpenAPI document.** The API already serves one at
   `/swagger/v1/swagger.json`. This eliminates the hand-mirroring hazard described in
   [section 8](#the-contract-is-a-promise-not-a-guarantee) — the highest-value change on this list
   for a real project.

---

## 17. Appendix: `const`, `readonly`, and actually preventing mutation

[Section 2](#readonly-const-and-template-literals) notes that `readonly` prevents *reassigning* a
property, not mutating the object it points at. The same is true of `const`, and the distinction
catches people out often enough to be worth its own treatment.

### `const` protects the binding, not the value

A common assumption is that declaring an object `const` makes it immutable. It does not:

```javascript
const config = { url: "a" };
config.url = "b";        // fine — you mutated the object
config = { url: "b" };   // TypeError: Assignment to constant variable.

const arr = [1, 2];
arr.push(3);             // fine — [1, 2, 3]
```

`const` means **this name will always point at this same value**. For a primitive that amounts to
immutability, because you can't change `1` into `2`. For an object it means only that the *reference*
is fixed — the thing it references is as mutable as ever.

`readonly` on a class property is the same guarantee at a different level: it stops
`this.rows = somethingElse`, and does nothing about `this.rows.push(...)`.

### Where this bites in this codebase

`features/vending-machine/keypad/keypad.ts`:

```typescript
const ROWS = ['A', 'B', 'C', 'D'];      // module-level: shared by every Keypad instance
...
protected readonly rows = ROWS;
```

`this.rows.push('E')` compiles cleanly. Both guards you might expect to stop it are aimed elsewhere —
`const` at the binding, `readonly` at the property — and because `ROWS` lives at module scope, the
mutation would affect every component instance in the application.

Nothing writes to it, so this is latent rather than a live bug. `SLOT_IMAGES`, `COIN_IMAGES` and
`COIN_PITCH` are `const` objects in the same position.

### Three ways to actually prevent it

**`as const`** — compile-time, deep, and usually what you want for a fixed list:

```typescript
const ROWS = ['A', 'B', 'C', 'D'] as const;
// type: readonly ["A", "B", "C", "D"]

ROWS.push('E');   // Property 'push' does not exist on type 'readonly [...]'
```

It also narrows each element to a *literal* type rather than `string`, which is often a bonus (the
values become part of the type) and occasionally a nuisance (you can no longer assign an arbitrary
string).

**`readonly` type annotations** — compile-time, without the literal narrowing:

```typescript
const ROWS: readonly string[] = ['A', 'B', 'C', 'D'];
const IMAGES: Readonly<Record<string, string>> = { ... };
```

**`Object.freeze()`** — the only option that exists at runtime:

```javascript
const frozen = Object.freeze({ url: "a", nested: { x: 1 } });
frozen.url = "b";       // TypeError: Cannot assign to read only property 'url'
frozen.nested.x = 99;   // succeeds — freeze is SHALLOW
```

Two things to know about it. It **throws** rather than failing silently, because ES modules are always
in strict mode (in sloppy-mode scripts the write is ignored instead, which is worse). And it is
**shallow** — nested objects are untouched, so deep immutability needs a recursive helper or a
library.

### Compile-time versus runtime

This is the distinction that matters when choosing:

| Tool | Enforced | Survives to the browser |
|---|---|---|
| `const` | Compile time (and runtime for rebinding) | The rebinding guard, yes |
| `readonly` property | Compile time | **No — erased** |
| `readonly` / `Readonly<T>` types | Compile time | **No — erased** |
| `as const` | Compile time | **No — erased** |
| `Object.freeze()` | Runtime | **Yes** |

TypeScript's immutability is entirely a compile-time fiction, for the same reason the response types
in [section 2](#so-what-actually-happens-if-the-shape-is-wrong) are: **types are erased**. That's
perfectly sufficient for protecting your code from itself, which is the usual goal. It is not
sufficient if the object crosses a boundary you don't control — data handed to a third-party library,
say — where only `Object.freeze` actually holds.

### Practical guidance

- Reach for **`as const`** on fixed lists and lookup tables. It costs nothing at runtime and turns a
  convention into a compile error.
- Use **`Readonly<T>` / `readonly T[]`** in function signatures to say "I will not modify what you
  pass me." It documents intent and the compiler enforces it.
- Use **`Object.freeze`** sparingly — when you genuinely need the runtime guarantee, and knowing it is
  shallow.
- Don't reach for a deep-freeze utility by default. The runtime cost is real, and for code you own the
  compile-time tools catch the same mistakes earlier.

---

## 18. Appendix: what `@angular` means in an import path

Every component in this project opens with a line like the one in
[section 4](#4-components):

```typescript
import { Component, computed, input } from '@angular/core';
```

The `@angular` part is an **npm scope**. It is not a folder in this project, not a decorator, and not
an Angular language feature — it is a namespace that npm packages can be published under.

### Scopes are a naming convention npm enforces

A scoped package name has the form `@scope/name`. Everything before the first `/` is the scope;
everything after is the package. `@angular/core` and `@angular/common` are two *separate* packages
that happen to share a namespace, in the same way that `angular.dev` and `blog.angular.dev` are
separate sites sharing a domain.

Scopes exist because the flat npm namespace filled up and became easy to squat. A scope is owned by
a user or organisation, and only they can publish under it — so a package under `@angular` is
first-party framework code from the Angular team, whereas an unscoped `angular-something` could be
published by anyone.

The `@` here is unrelated to the other two `@`s this document uses: `@Component`
([section 2](#decorators)) is a TypeScript decorator, and `@if` / `@for`
([section 5](#control-flow)) are Angular template blocks. Three different meanings, one symbol.

### Bare specifiers versus relative paths

[Section 2](#modules) states the rule in one line; this is the mechanics behind it. Look at the
imports in the `ProductSlot` sample together:

```typescript
import { CurrencyPipe } from '@angular/common';                  // bare specifier
import { Component, computed, input } from '@angular/core';      // bare specifier
import { Product } from '../../../core/models/product.model';    // relative path
import { productImageFor } from '../../../core/utils/product-image';
```

A specifier starting with `.` or `..` is **relative** — resolved against the importing file's own
location on disk. Anything else is a **bare specifier**, looked up in `node_modules`. The leading `@`
does not change that; it is simply part of the package name. So `@angular/core` resolves to
`node_modules/@angular/core`, and scoped packages nest one directory deeper than unscoped ones:

```
node_modules/
  rxjs/                 <- unscoped: import from 'rxjs'
  @angular/
    core/               <- scoped:   import from '@angular/core'
    common/
```

Note the collision worth knowing about when reading this document: `@angular/core` and this project's
own `src/app/core/` folder are unrelated things that share a word. The first is the framework; the
second is [our own shared code](#the-pieces). This project defines no `paths` aliases in
`tsconfig.json`, so there is no third category — an import is either relative or a package.

### What's installed here

Bare specifiers only resolve because something put the package on disk. The versions are declared in
`package.json` and `npm install` fetches them:

```json
"dependencies": {
  "@angular/common": "^22.0.0",
  "@angular/core": "^22.0.0",
  ...
}
```

The app declares six `@angular` packages as runtime dependencies (`common`, `compiler`, `core`,
`forms`, `platform-browser`, `router`) plus three build-time ones under `devDependencies`
(`@angular/build`, `@angular/cli`, `@angular/compiler-cli`). The two that appear in nearly every
file:

- **`@angular/core`** — the framework primitives: `Component`, `signal`, `computed`, `input`,
  `output`, `effect`, `inject`.
- **`@angular/common`** — browser-facing pieces built on top of it, such as `CurrencyPipe`.

The framework is split this way so an application only pays for what it imports; a build that never
uses the router doesn't bundle `@angular/router`.

### Subpaths

Some imports have a third segment:

```typescript
import { HttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
```

The scope is still only the first segment. This is the package `@angular/common` plus the **subpath**
`/http` — a named entry point the package publishes in the `exports` field of its own `package.json`.
It is not a directory path you could navigate to; `node_modules/@angular/common` contains no `http`
folder. The package decides which subpaths exist, which is also how it keeps its internals private.

---

## 19. Appendix: writable, derived, and why `computed` is read-only

[Section 6](#computed) introduces `computed` as a derived signal. A fair follow-up question is how
you'd then set or update one. The answer is that you can't, and the reason is worth understanding
because it's the whole point of the API.

### There is no setter, at the type level

```typescript
// node_modules/@angular/core/types/core.d.ts
declare function signal<T>(initialValue: T, ...): WritableSignal<T>;
declare function computed<T>(computation: () => T, options?): Signal<T>;
```

Two different return types. `Signal<T>` is essentially `(() => T)` plus internal reactive metadata —
readable, nothing else. `WritableSignal<T>` **extends** it and adds `.set()`, `.update()`, and
`.asReadonly()`.

So this isn't a runtime restriction you can route around:

```typescript
protected readonly imageUrl = computed(() => productImageFor(this.product()));

this.imageUrl.set('/images/products/A1-cola.svg');
// Property 'set' does not exist on type 'Signal<string>'.
```

The property doesn't exist on the type. `asReadonly()` on a writable signal is the same idea pointed
the other way: it hands out a `Signal<T>` view so collaborators can read your state without writing
to it.

### You change a computed by changing what it reads

The only `computed` in this codebase is `features/vending-machine/product-slot/product-slot.ts`:

```typescript
readonly product = input.required<Product>();
protected readonly imageUrl = computed(() => productImageFor(this.product()));
```

`imageUrl` read `product()` while computing, so Angular recorded that dependency. To make `imageUrl`
produce a different value, the parent rebinds the input:

```html
<app-product-slot [product]="product" />
```

The input signal changes → `imageUrl` is marked stale → it recomputes the next time something reads
it, and caches again. Anywhere else, the same walk applies: find the writable signal upstream and
`.set()` or `.update()` that.

That indirection is the guarantee. A computed cannot hold a value inconsistent with its inputs,
because it has no storage of its own that you could desynchronise. A hand-maintained copy kept in
step by an `effect` can, and eventually does.

### Lazy, not eager

Worth knowing when reasoning about the above: a stale computed doesn't recompute when its dependency
changes — it recomputes when it is next **read**. If nothing reads it, the work never happens. Two
consequences: the computation must be pure (no side effects — you cannot rely on when or whether it
runs), and it is cheap to define computeds that are only sometimes displayed.

### The object-mutation wrinkle

If a computed returns an object, reading it gives you the real object, and mutating that object
notifies nobody:

```typescript
const slot = computed(() => ({ code: this.product().code }));
slot().code = 'D3';   // compiles, changes the cached object, no view updates
```

Nothing in the reactive graph changed, so no dependent recomputes — and the mutation is lost on the
next recompute anyway. This is the same class of trap as [appendix 17](#17-appendix-const-readonly-and-actually-preventing-mutation):
`readonly` on the field stops you rebinding `slot`, not mutating what it returns.

### When you genuinely need derived *and* writable

`linkedSignal` covers that case. It is a real API — `@publicApi 20.0`, available in the
`@angular/core` 22.x this project installs — and it returns a `WritableSignal` whose value is
**reset** whenever its source changes:

```typescript
import { linkedSignal } from '@angular/core';

// seeded from the product list, resets when that list reloads,
// but can also be set directly
protected readonly selectedCode = linkedSignal(() => this.products()[0]?.code ?? '');

this.selectedCode.set('C3');   // allowed — this is a WritableSignal
```

The reset *is* the semantics. It fits a selection or a form field seeded from server data, where a
local edit should win until fresh data arrives and then give way. If you don't want the local write
discarded when the source updates, `linkedSignal` is the wrong tool and you want a plain `signal()`.

### Choosing between the three

| | Writable | Stays in sync with sources | Reach for it when |
|---|---|---|---|
| `signal()` | Yes | No — you maintain it | The value is owned here and set by user or server events |
| `computed()` | **No** | Yes, automatically | The value is purely a function of other state |
| `linkedSignal()` | Yes | Re-seeded on source change | Derived, but locally overridable until the source moves |

Default to `computed` whenever the value is derivable. Reach for `linkedSignal` for the narrow
override case. Reach for a plain `signal` synchronised by an `effect` essentially never — as
[section 6](#effect) puts it, effects are for reaching outside the reactive graph, not for computing
values.

---

## Where to go next

- **The backend**: [`backend/docs/README.md`](../../backend/docs/README.md) — the same treatment for
  C#, ASP.NET Core, and Entity Framework.
- **Design rationale**: `PLAN.md` at the repository root.
- **Working conventions**: `CLAUDE.md` at the repository root.

Official documentation worth bookmarking:

- [Angular](https://angular.dev/) — the modern docs, signals-first
- [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [RxJS](https://rxjs.dev/)
- [MDN Web Docs](https://developer.mozilla.org/) — the reference for the DOM, CSS, and Web Audio
- [Vitest](https://vitest.dev/)
