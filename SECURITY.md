# Security Policy

Stream Shell is a personal project and does not operate a bug-bounty program or security-response SLA. Security reports are still appreciated.

## Supported versions

Security fixes are targeted at the **latest public release** and current `main` branch. Older releases are not maintained as separate supported lines.

## Reporting a vulnerability

Please **do not publish sensitive exploit details, credentials, tokens, or private account data in a public issue**.

If GitHub offers **Report a vulnerability / Private vulnerability reporting** for this repository, use that channel.

If private vulnerability reporting is unavailable, open a minimal public issue stating that you found a security-sensitive problem and need a private contact channel. Do not include the exploit, secret material, or sensitive reproduction data in that public issue.

A useful private report includes the affected version/commit, provider or component, impact, reproduction steps, whether Native Messaging is involved, browser/Windows version details, and a suggested fix if one is already known.

## Security-sensitive areas

Extra care is appropriate around:

- Native Messaging helpers and native window integration;
- extension permissions and host permissions;
- account/subscription scraping;
- locally stored settings and the optional TMDB token;
- MAIN-world player bridges;
- message passing between page, content-script, service-worker, offscreen, and native contexts.

Stream Shell intentionally includes no telemetry service. Avoid adding code that transmits browsing, playback, account, or diagnostic data to new third parties without an explicit feature requirement and clear disclosure.

## Disclosure

Please allow a reasonable opportunity to investigate and publish a fix before disclosing a vulnerability publicly.
