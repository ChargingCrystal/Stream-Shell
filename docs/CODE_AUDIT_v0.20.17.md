**Erratum (v0.20.18):** The v0.20.17 classification of `landing/src/finance.js` as a dormant prototype was incorrect. This is a supported Wide-only feature activated by five clicks on the Subscriptions heading. Its generated bundle was accidentally missing the module starting in v0.19.35. v0.20.18 restores the module and its build ordering, without changing Finance logic or the COBOL native host.

# Stream Shell — Repository-wide code-care audit (v0.20.16 → v0.20.17)

Date: 2026-10-21. Basis: the complete v0.20.16 FULL release tree and the supplied v0.20.16 Deep Diagnostics export. Static inspection **does not** certify Opera GX, Windows/Win32, C# compilation, or hour-long Chromium stability.

## Scope and method

- Indexed **121 independent JS source files and 22 C# files** (approximately 57,772 source lines before generated bundles), plus CSS, manifest, HTML, PowerShell installers/build definitions, tests and release layout.
- Ran whole-tree pattern analysis for timers, MutationObservers, storage/window queries, runtime messaging, event listeners, silent catches, and large implementation modules. Reviewed relevant high-risk sources manually, including the background message router, runtime state, Twitch utility, diagnostics, native installer/source-contract, dashboard and provider code.
- Verified **five generated bundles** against their declared source order and verified all manifest/HTML local file references. Syntax-tested independently valid JavaScript units and ran existing regression tests plus newly added boundary tests.
- Kept the native helper, Twitch launch/automation, provider playback/resource budget, and renderer handoff timing unchanged.

## Findings and disposition

| Severity | Area | Finding | v0.20.17 action |
|---|---|---|---|
| Medium, fixed | Landing build | `landing/build-landing.ps1` listed `landing/src/finance.js`, but the **shipped** `landing/landing.js` omitted that entire self-executing module. A routine rebuild would unexpectedly activate independent finance/native behavior. | Match the builder to the known-good shipping bundle. Keep `finance.js` archived and dormant; do not silently re-enable it. |
| Medium, fixed | Background IPC | Main `chrome.runtime.onMessage` handler accessed `message.type` without checking message shape. | Ignore malformed messages safely; add executable regression coverage. |
| Medium, fixed | Background IPC | `get-state` returned `true` (async response) but its `Promise.all` branch had no rejection handler. A transient storage/display error could leave the caller without a response. | Always respond with `{ok:false,error}` on rejection; test both success and failure. |
| Medium, addressed | Quality enforcement | Tests and generated bundle parity were previously manual; there was no GitHub Actions workflow. | Add `tools/check-project.mjs` and `.github/workflows/project-quality.yml` with zero new npm dependencies. |
| Medium, deferred | Error handling | Source sweep found many intentionally silent `catch {}` fallbacks; indiscriminate logging or rethrowing would itself create background load and regressions. | Gradually classify failures (expected/optional, recoverable, actionable) by module; no blanket rewrite. |
| Medium, deferred | Coupling | Background message router is approximately 2,061 lines, native titlebar handling is 19 partial modules, and multiple provider scripts share implicit global variables through raw concatenation. | Define boundaries and integration tests before another router/native split. Do not mechanically rename globals/static fields. |
| Medium, deferred | Async liveness | Chromium timer throttling and renderer suspension remain outside the control of JS/native runtime. A recovered Native heartbeat is not proof a renderer can accept messages. | Favor bounded awaits and explicit cancellation/generation tokens on future touched paths; collect targeted telemetry before new recovery changes. |
| Low, reviewed | Background scheduling | Inventory found around 10 JS `setInterval` sites and 8 `MutationObserver` constructors in independent source modules. | Keep watch/claim/auto-join observers and playback watchdogs intact; prevent duplicate loops in feature-specific changes. |
| Low, reviewed | Config & assets | Optional backgrounds are intentionally missing from released ZIPs; special `bootstrap-state.js` and `start.js` are **fragments** of the common bundle and cannot compile individually. | Quality check explicitly understands these exceptions. |

## Current observed runtime state (supplied v0.20.16 Deep export)

- Native protocol v9 compatible, Native heartbeat fresh; no pending claims in the status snapshot.
- Twitch A–D runtimes `ok`, all four browser-side Native claims confirmed; background Marbles chat/joins active.
- `cacheReady: true`, no pending window transition, `eventQueuePending: 0`; Native slow-audit bypass counter was 2 in this snapshot.
- This is a healthy **snapshot**, not a proof that every long-running background or wake path will remain healthy.

## Quality-gate command

```bash
node tools/check-project.mjs
```

It verifies: background/common/dashboard/landing/Compact bundle byte parity; static manifest and HTML asset references (excluding private optional backgrounds); standalone JavaScript syntax; all Node `*.test.js` regressions; native partial-class method/safety source contract using Python. CI runs it on every push and pull request with Node 22 and Python 3.12.

**Limitations:** No source-level static analysis substitutes for live behavior. The check does **not** compile the C# helper, validate browser compositor geometry, guarantee the behavior of third-party media sites, or profile Opera GPU/CPU. Windows integration still needs occasional smoke tests.

## Conventions for further features/refactors

1. Source modules are authoritative; always regenerate bundles and verify byte parity before packaging.
2. Never put awaited storage/window enumeration/native reconciliation back into the Wide focus hot path.
3. Keep the 5.5s cold/3s warm cross-surface handoff and 1.25s fresh Twitch popup stagger until evidence calls for change.
4. Keep Twitch chat, drops/points claims, and playback guard independent of dashboard visibility and throttled UI timers.
5. Every async message expecting a reply needs a success **and** failure completion path; sender checks before privileged work.
6. Native IPC/Win32 work must be timeout-bounded; catch exceptions at true process/thread boundaries and report actionable failure counts.
7. Prefer lifecycle-owned listeners, idempotent initialization, event-driven updates and explicit backpressure over unconditional polling.
8. Avoid global static state/large switches *when adding new features*, but do not rewrite working HWND/protocol state just to satisfy stylistic preferences.
9. Treat full vs Runtime Diagnostics as separate cost classes; never inflate focus/launch paths to populate a diagnostics panel.
10. Never include or overwrite user-maintained `assets/backgrounds/` or private custom artwork in official ZIP releases.

## Future targeted work (NOT modified in this release)

- Decompose `background/src/09-message-router.js` into command families behind a stable transport contract and test success/failure/unauthorized senders before splitting.
- Build feature-level ownership contracts for YouTube observers/DOM helper lifecycle; retain fast SPA/ratio/auto-like functionality.
- Audit disposal/cancellation in Compact Home and optional finance integrations when they are actually maintained/activated.
- Explore a non-invasive Windows C# compile-only CI step separate from the installer (never run installers on CI).
- Extend Native health export coverage only if real Windows output confirms the fields are reliably available.
