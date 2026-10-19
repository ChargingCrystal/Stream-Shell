# Security Policy

Stream Shell is a personal project, maintained on a best-effort basis. There is no bug-bounty program, guaranteed response time or long-term security-support matrix. Security-relevant fixes target the latest published version / current `main` branch.

## Private reports

Please do not publish exploit instructions, credentials, browser data or full private diagnostics in an open issue. If GitHub **Private vulnerability reporting** is enabled, use it. Otherwise open a minimal public issue asking for a private reporting channel, without describing the exploit or including secrets.

A useful report specifies the version/commit, browser and Windows versions, affected provider/URL or Native Messaging component, reproduction steps, impact and suggested fix if known.

## Sensitive boundaries

Pay particular attention to:

- Browser permissions, page/content-script/MAIN-world boundaries and message validation.
- The custom-provider registry: only HTTPS URLs should be accepted; custom sites must not automatically gain built-in provider injections or expanded host permissions.
- The C# Native Messaging titlebar and Discord helpers, explicit HWND ownership, provider synchronization and bounded local custom PNG handling.
- Local settings, TMDB tokens and any account/subscription metadata.
- Offscreen capture/audio, optional external metadata services and exported Diagnostics.

**Full Diagnostics exports may include URLs, Twitch channel names, playback state and settings.** Review/redact them before public submission. No project-operated telemetry service is bundled, but optional integrations make requests to their respective external services. Avoid new network destinations or data collection without explicit feature rationale and documentation.

Please allow a reasonable opportunity to investigate and prepare a fix before public disclosure.
