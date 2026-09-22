# Stream Shell 0.11.9

## Provider API Refactor / Cleanup

- Centralized resume/media identity writer+reader logic in shared `resume-utils.js` so Background and Common cannot drift apart.
- Split the oversized Provider API into core, self-test, resume and start source files.
- Removed old generic provider-capability fallbacks.
- Removed dead YouTube parsers, unused provider state, dead Settings rendering and stale Dashboard DOM references.
- Re-ran the existing provider/resume harnesses after the cleanup.

_Recovered from the original Stream Shell development chats / release messages._
