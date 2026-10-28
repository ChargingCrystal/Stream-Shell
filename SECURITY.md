# Security Policy

**Stream Shell 0.22.1** is a personal, best-effort project. Security fixes target the current branch; there is no guaranteed response SLA, bug bounty or long-term supported-version matrix.

## Reporting vulnerabilities

Please do **not** post proof-of-concept exploits, private browser data, secrets or full Diagnostics exports in public issues. Use GitHub private vulnerability reporting if enabled. Otherwise open a minimal issue requesting a private reporting route without publishing exploit details.

Include the affected version/commit, browser/Windows version, affected extension or native component, prerequisites, reproduction, impact and minimal sanitized evidence.

## Security boundaries

- **Explicit Seven Seas opt-in:** FMHY and Mangayomi actions are blocked by default at runtime; hiding a button alone is insufficient. Turning the opt-in off prevents new gated operations. It does not certify or authorize third-party content. New integrations must preserve the execution-path guard.
- **Native Messaging:** validate extension sender identity and message schemas. Titlebar, Discord and Mangayomi helpers have separate responsibilities and installations. Window ownership, process path and native app targeting must remain narrow and explicit.
- **Mangayomi bridge:** the optional patched desktop app exposes an authenticated loopback interface; descriptors and credentials are local user data. Never expose the bridge publicly, bundle its tokens, or accept arbitrary URLs as an exact result-open instruction. The process-kill action targets the configured executable; avoid extending it to arbitrary processes.
- **Custom providers:** HTTPS only; they must not silently gain built-in script injections, host permissions or privileged native actions.
- **Browser/player code:** respect content-script/MAIN-world boundaries, MV3 permissions, incoming message validation and local storage handling. External provider DOM content is untrusted.
- **Sensitive data:** local settings and TMDB tokens, Diagnostics JSON, playback activity, performance JSONL files, source descriptors, custom-provider URLs and external API responses can contain private details. Inspect and redact before sharing.

No project-operated telemetry collection service is bundled. Optional features contact external services or installed desktop applications, according to their separate functionality. Do not add unexpected network destinations or persistent sensitive logging without explicit justification and documentation.

## Disclosure

Allow a reasonable opportunity to investigate and prepare a fix before publishing vulnerability details. Updates are provided on a best-effort basis.
