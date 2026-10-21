# Background IPC conventions (adopted v0.20.20)

Stream Shell runs an MV3 extension service worker. `chrome.runtime.onMessage` owns its
response channel and sender authorization. This is **not** a general RPC framework.
The narrow shared helper in `background/src/09-message-helpers.js` reduces repeated
error handling while preserving existing message shapes.

## For new or migrated request/reply handlers

1. **Validate the envelope and sender first.** Authentication/authorization belongs in
   `09-message-router.js`, *before* privileged work. Do not use this utility to circumvent
   `isDashboardSender`, `isLandingSender`, or a managed-window check.
2. For a request that expects an async reply, return
   `streamShellRespondAsync(sendResponse, () => operation(), options)` directly.
   It opens the response channel (`return true`) and catches synchronous throws and
   Promise rejections. Never separately call `sendResponse` from the same operation.
3. Use `success: result => payload` to maintain existing success schemas. A command
   may choose `success: () => ({ok:true})`; query results often retain their
   original shape. `failure: error => payload` preserves historically expected
   failure schemas. If omitted, the default is `{ok:false,error:string}`.
4. Do **not** send credentials, private data or raw error stacks to consumers.
   `streamShellMessageErrorText` derives a short, readable `error.message` or fallback.
5. Do not introduce polling, browser enumeration or new artificial timeout behavior
   as part of a syntax-only migration. Use explicit, measured timeouts only when a
   separate integration test covers cancellation/late replies and retry semantics.
6. Fire-and-forget message handlers and immediately cached responses should **not**
   be wrapped just for stylistic consistency. A closed port is an expected condition.
7. Keep quick Runtime Diagnostics and expensive full Diagnostics separate, including
   their existing caller permissions and data-collection budgets.

## Migrated in v0.20.20

- `dashboard-settings-visibility`
- `dashboard-flight-event`
- `dashboard-diagnostics-repair`
- `get-state` (legacy flat success response retained)

## Intentionally excluded from this migration

- `dashboard-diagnostics-lite`: synchronous cache-only response.
- `dashboard-diagnostics`: on-demand deep collection; existing timeout/partial-failure
  behavior requires separate integration coverage.
- Twitch A–D, Native claims, HWND mapping, and window/provider transition handlers:
  timing-sensitive and already aggressively backpressured.
- `kill-stream-shell`: fire-and-forget semantics.

## Regression contract

Run `node tools/check-project.mjs`. Required background tests include
`background/tests/message-ipc-contract.test.js` and
`background/tests/dashboard-ipc-regression.test.js`. This cannot prove long-term
Opera GX responsiveness or Native Win32 runtime behavior.
