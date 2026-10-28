> **v0.21.25 cold-start behavior:** A normal search click automatically launches the configured patched Mangayomi executable minimized when it is not already running. The helper waits for the local source bridge from that **same running PID**, so a stale `mangayomi-bridge.json` cannot be used accidentally. The user does not need to open Mangayomi in advance. Shift+click still opens the app directly. A selected result is the only search action that foregrounds it.

# Stream Shell ↔ Mangayomi source-search bridge — staged integration

## v0.21.14: stock-app-compatible handoff (implemented)

Click the magnifying-glass action on an AniList search result or on an Anime/Manga/Novel Library card.
Stream Shell copies the sanitized display title **before** launching/focusing the separately installed Mangayomi app
in the LEFT pane. Open **Mangayomi → Global Search** for the right media kind and paste (`Ctrl+V`).
This is *not* an automatic source search. The result is not imported into Stream Shell.
The existing Mangayomi desktop helper and Window/Titlebar ownership code are unchanged.

## Why it cannot scan extensions yet

Upstream `kodjodevf/mangayomi` has:

- `lib/modules/browse/global_search/global_search_screen.dart`: actual multi-source Global Search (three concurrent source requests);
- `lib/services/search.dart`: native Dart/Isolate extension runner (`getIsolateService.get`, serviceType `search`);
- `lib/main.dart` `_initDeepLinks`: `mangayomi://` URI scheme currently handles `add-repo` and `add-button`, **not** Global Search;
- no externally documented/title-search HTTP API that Stream Shell can safely call from a stock release.

Don't simulate Flutter button presses or load extension websites in Chromium as a substitute.

## Next step — requires change to Mangayomi itself, with explicit install of patched build

1. Add a small, opt-in **local-only search bridge** to Mangayomi's Dart runtime or contribute an upstream API.
2. Search must execute through Mangayomi's own installed source entries/isolate service with its existing fetch gate, language and source settings.
3. Expose results containing *source ID, title, media type, source-page URL (when returned), and source errors/empty status*. Never claim a working stream from search metadata alone.
4. Require loopback-only binding, local authentication (per-session token/capability), constrained CORS or native-host IPC, strict size/time/concurrency limits, and no access from arbitrary websites.
5. In Stream Shell, use native messaging for the broker rather than a web-accessible localhost endpoint; return status per installed source and let users open verified source details in Mangayomi.
6. Maintain the same user-owned source list; never auto-install an untrusted extension or bypass a provider's access restrictions.

The above is a proposed future protocol, **not installed or working in v0.21.14**. It needs a Mangayomi fork/build and Windows integration testing.

## v0.21.15 experimental direct-search stage

`Shift+click` the Mangayomi magnifier in Stream Shell to try a direct search.
For stock Mangayomi, **use normal click** (copies title, opens app).
Direct search sends a strictly constructed protocol URI via the native helper,
not a caller-supplied URL. Apply `fork-patches/0001-global-search-uri.patch`
to a matching checkout of `kodjodevf/mangayomi` and **build/install that version**
before using Shift+click. This stage opens Mangayomi's own real Global Search
and displays source results there; Stream Shell receives **no results**.

The code patch is targeted to the current upstream `lib/main.dart` link listener.
It is a source patch, not a compiled fork. It has not been Flutter-compiled here.
For a cold start, open Mangayomi once before testing direct links: the stock
`uriLinkStream` listener is not guaranteed to deliver an initial URI uniformly
on every Windows app_links/plugin version. Later bridge stages should handle
`getInitialLink()` explicitly and add an authenticated IPC results channel.

## v0.21.16: unregistered-URI protection (stock app fallback)

The v0.21.15 Shift+click route produced the Windows Store app chooser on systems without a registered `mangayomi://` handler. The **native integration helper** now requires the registered `HKCU\Software\Classes\mangayomi` URL handler to target the actual running `Mangayomi.exe` and requires an explicit Stream Shell patched-build capability opt-in. It declines the URI before invoking Windows when either is absent. Stream Shell then uses the already working clipboard handoff. No fake search results or silent success claims.

**Stock app: do nothing extra.** To test an independently compiled fork with `fork-patches/0001-global-search-uri.patch`, first install that fork and confirm that it handles global-search deep links on Windows; only then run from Stream Shell root:

```powershell
.\integrations\mangayomi\enable-patched-search.ps1 -ExecutablePath "C:\path\to\patched\Mangayomi.exe" -IInstalledPatchedBuild
```

This explicitly registers the current user's protocol and sets the local patched-build opt-in. It is **not** run by the native-helper installer and must not be used with an unmodified Mangayomi build. Disable the experimental bridge with `-Disable`. Results still appear inside Mangayomi; authenticated result transfer is future work.


## v0.21.17 — optional executable fork build kit (not a Windows binary)

New source `fork-patches/files/lib/services/stream_shell_search_bridge.dart` and
`apply-bridge-to-source.py` extend the actual Mangayomi app with loopback search.
This is *not* a standalone web scraper. The bridge uses the same installed sources
and isolate service used by Mangayomi itself; each searched source returns `ok`,
`empty`, `timeout` or `error` plus up to 12 title/source-URL matches.

Run `build-patched-mangayomi.ps1` on a Windows machine with Flutter, Rust, `flutter_rust_bridge_codegen`, Python 3,
Git and Visual Studio C++ build tools. It clones Mangayomi into a separate working
folder if necessary, patches Dart, and builds a standalone Windows Release folder.
Do not copy only Mangayomi.exe; the Flutter DLLs/data directory are required.
Then set the Stream Shell Mangayomi exe path to the fork and explicitly enable
`enable-patched-search.ps1 -IInstalledPatchedBuild -ExecutablePath ...`.

The app binds HTTP to `127.0.0.1` on a randomly chosen port only when enabled,
with a fresh random bearer token written to a user-local descriptor. The native
host reads that descriptor and forwards searches; no browser page talks to the
server directly. Scan at most 18 installed sources, at most 3 simultaneously,
18 seconds per source, and 12 hits per source; the response states how many
sources were skipped. No auto-opening source links. Only actual source search
results are returned, not streaming guarantees. The patched app navigates into
its Global Search after the external scan completes, rather than launching
simultaneous duplicate extension requests.

This build kit was authored and inspected in a Linux container. **It has not
been Flutter-compiled or tested on Windows**. If the source checkout differs
from the expected upstream anchors, the patch script fails closed.

## v0.21.20 — Source-specific detail handoff

`Shift+click` queries the opted-in source search bridge and displays real source
results in the existing LEFT Search/Watchlist panel. Picking a result forwards
its opaque, session-local ID via trusted Native Messaging. The authenticated
loopback service resolves the original source + MManga object from memory and
calls Mangayomi's normal detail-page navigation method. Result IDs expire
15 minutes after the last search and are invalidated by a new query; users
must re-search expired results. No raw provider URL is used as a launch target.

Requires BOTH a newly built Mangayomi fork (Dart source) and an updated native
host executable (C# source). A replaced extension bundle alone is insufficient.
Search still works with the older fork, but direct detail navigation does not.

## v0.21.20 — Source-specific detail handoff

`Shift+click` queries the opted-in source search bridge and displays real source
results in the existing LEFT Search/Watchlist panel. Picking a result forwards
its opaque, session-local ID via trusted Native Messaging. The authenticated
loopback service resolves the original source + MManga object from memory and
calls Mangayomi's normal detail-page navigation method. Result IDs expire
15 minutes after the last search and are invalidated by a new query; users
must re-search expired results. No raw provider URL is used as a launch target.

Requires BOTH a newly built Mangayomi fork (Dart source) and an updated native
host executable (C# source). A replaced extension bundle alone is insufficient.
Search still works with the older fork, but direct detail navigation does not.

## v0.21.21 — UI shortcut

Ordinary click on the Mangayomi magnifier queries installed sources without showing the native app, then renders the resulting hits in the LEFT Search panel. Shift+left-click **copies the title and switches** to the configured Mangayomi app; no source lookup or automatic Global Search navigation occurs. Selecting an actual hit uses the authenticated /v1/open endpoint available in the rebuilt fork.
