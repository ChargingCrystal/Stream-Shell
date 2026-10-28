# Stream Shell – quality gates (0.22.1)

The primary **Stream Shell quality** workflow checks pushes, pull requests and manual runs. Run the same offline suite locally from the extension root:

```powershell
node tools/check-project.mjs
```

**Requirements:** Node 22+, Python 3. There is no `npm install` requirement.

The suite verifies:

- Exact generated bundle/source parity across active background, Landing, Dashboard, Compact and shared scripts.
- Manifest/HTML-referenced files, JS syntax, repository-root/layout constraints and per-area `tests/` placement.
- The current JavaScript regression suite, including provider registry/window state, Wide/Compact search, FMHY/Seven Seas runtime blocks, native Mangayomi dispatch contracts and Anarchy behavior.
- Python checks of the shared native titlebar **source** structure. A structural check is **not** a C# compiler or Opera integration test.

A passing suite does **not** demonstrate that external APIs are reachable, that the native Flutter fork works on Windows or that intermittent browser freezes are resolved.

## Native Windows compilation

The separate **native Windows build** GitHub Actions workflow smoke-compiles the shared Titlebar host when relevant source/build tooling changes, and can be run manually. To check local host compiler compatibility without installing binaries:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\tests\compile-titlebar-host.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integrations\mangayomi\tests\compile-mangayomi-host.ps1
```

Run the relevant check(s) for files you change. The Mangayomi compiler check is separate from the titlebar Actions workflow. After a successful compile, real process launch, Native Messaging identity, window placement, search bridge readiness and explicit process-kill behavior still need testing on Windows/Opera GX.

## High-risk manual checks

- Seven Seas **default off**: blocked FMHY network access and Mangayomi start/search/open. On enable, expected paths work; switching off cancels new gated actions; cleanup kill remains available.
- Wide right-pane isolation and Twitch/Discord window ownership; Compact 16:9 **and** 16:10 CSS and native titlebar.
- Mangayomi cold search without a running process, delayed HWND readiness after result opening, Shift-click clipboard transfer and explicit configured-process kill.
- Visual Anarchy at least once for each effect, combinations, fullscreen VHS and exact restore/teardown of video CSS.
- Performance logs after long sessions; time-gap records may be Windows sleep or throttling, not a definitive freeze cause.

## Failure diagnosis

- **Bundle mismatch:** rebuild with the correct adjacent `build-*.ps1`, then include source and generated output.
- **Missing/failing regression:** repair the behavior and the test contract; do not remove tests merely for CI green.
- **Native C# compiler failure:** do not reinstall the host until the source compiles. The Mangayomi installer stages new binaries before replacing old ones.
- **Personal assets in Git:** remove their tracked index entries without deleting the local files; ignore rules alone are insufficient once tracked.

See [CI Setup](CI-SETUP.md) and [Project Structure](PROJECT-STRUCTURE.md).
