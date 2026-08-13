---
name: verify-guide
description: Check the developer guides (frontend/docs/README.md, backend/docs/README.md) for claims that have drifted from the code, the config, or the framework specs. Use before merging a docs change, after changing code a guide describes, or when asked to review/fact-check a guide section. Reports findings for review; does not silently rewrite prose.
---

# Verifying the developer guides

`frontend/docs/README.md` (~2,500 lines, 20 sections) and `backend/docs/README.md` (~2,000 lines)
teach the stack by explaining this codebase. That coupling is the whole problem: every explanation
is a factual claim about code that keeps changing, or about a framework whose behaviour the author
may have misremembered.

Five commits in this repo's history exist only to correct such claims. They are the calibration set
below. None were typos — all were plausible-sounding statements that happened to be false.

The same drift reaches source comments: `1ec23e5` corrected the palette comment in `styles.scss`,
which had made the error `c7d38a0` fixed in the guide. When a comment explains the same thing a
guide section does, check it too.

## Scope the pass

4,500 lines is too much for one useful pass. Verify **one section at a time**, or the sections
touching whatever code just changed. A whole-guide sweep produces a findings list too long to act
on, and quality drops toward the end.

If asked to "check the guide" with no narrower target, ask which section — or pick the ones
covering recently-changed files and say that's what you did.

## Three kinds of claim, three different checks

### 1. Verbatim code quotes

Most fenced blocks in these guides are **not** attributed to a file. A minority name their source
(`` `core/models/purchase-result.model.ts`: ``); the rest you must locate yourself by grepping a
distinctive identifier from the block.

For each block that quotes real project code:

- Find the source file. If you cannot, that itself is a finding — an unattributed block that
  matches nothing is either invented or stale.
- Diff quote against source. Watch specifically for **truncation**: a quote that is correct as far
  as it goes but drops later lines. Commit `226bbcb` fixed a `:root` block missing three custom
  properties, and the omission read as complete.
- Deliberate elision is fine when marked (`...` or a comment). Silent elision is a finding **only
  when the omission changes what a reader concludes** — a dropped assertion or a truncated list
  reads as complete and misleads. Teaching quotes routinely drop a redundant
  `expect(x).toBeTruthy()` or an explanatory comment; reporting those buries the real findings.
  When in doubt, ask whether someone acting on the quote would be wrong.

Illustrative blocks that don't quote the project — a generic TypeScript example, a
counter-example of what *not* to do — are not in scope. Judge by whether a reader would take it as
"this is what the file says."

### 2. Claims about this project's structure, config, or toolchain

Statements about what a file contains, where output lands, which version is in use, what a setting
is set to. Check against the actual file — never memory, and never the guide's own earlier
sections.

Past failures of this kind:

- `ea50487` — "`index.html` contains a `<script>` tag." The source file holds only
  `<app-root></app-root>`; the CLI injects the script into `dist/` at build time. The guide had
  conflated source with served output.
- `c7d38a0` — "the SVGs share the CSS palette, so a colour change means editing one list." The
  exact opposite: SVGs load as separate documents (`<img src>`, `background-image`), so `:root`
  custom properties don't reach them. 206 hex literals across 17 files, 77 with no palette
  equivalent.
- `bf40dd5` — zoneless framed as opt-in when it has been the Angular default since v21 and this
  project has no zone.js dependency.

Useful sources of truth: `package.json` and `*.csproj` for versions, `angular.json` and
`tsconfig*.json` for build and compiler settings, `launchSettings.json` and `appsettings*.json`
for the API, `DbSeeder.cs` for seed data.

### 3. Claims about framework or platform behaviour

The subtlest class, and the one most likely to sound authoritative while being wrong. These
guides explain *why* things work, so they make mechanism claims that no test in this repo covers.

- `86f936d` — "inputs and outputs are all signals." `output()` returns `OutputEmitterRef<T>`
  (a class with `emit()`/`subscribe()`); only `input()` returns something extending `Signal<T>`.
- `bf40dd5` — four spec contradictions at once: `ResizeObserver` said to watch the border box
  (`observe()` with no options watches the content box); transform composition described as
  right-to-left (css-transforms-1 says "from left to right"); grid centring said to left-align an
  oversized item (per css-align it centres and overflows *both* edges — the unreachable start-edge
  overflow is what actually breaks it).

Note the pattern in that last one: **the conclusion was right and the mechanism was wrong.** Do
not stop verifying because the paragraph reaches a correct conclusion. These guides teach
mechanism; a right answer via a wrong route is still a defect.

Check against the actual specification or official docs (WebFetch is available) rather than
recall. Where you can't confirm and can't refute, say so explicitly and flag it for a human —
"unverified" is a legitimate finding, and much better than a confident guess.

## Report, don't rewrite

Output a findings list. For each: section and line, the claim as written, what's actually true,
and the evidence (file:line, or a spec quote).

Do not silently edit the prose. Two reasons. These guides have a distinctive voice and register,
and a drive-by correction reads as foreign. More importantly the right fix is often structural,
not a word swap — `86f936d` didn't patch the offending bullet, it added a subsection distinguishing
signals (values, pulled) from events (occurrences, pushed). That's an author's call.

Propose fixes; apply them when asked.

## After a correction lands

If a corrected claim is also stated in `CLAUDE.md`, `README.md`, or `PLAN.md`, fix it there in the
same change — `c7d38a0` had to correct the palette claim in two places. Grep a distinctive phrase
from the wrong claim across all tracked markdown before calling it done.
