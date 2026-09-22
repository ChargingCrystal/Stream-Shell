# Stream Shell 0.8.1

## Netflix Theme Test

- Activated the Netflix theme content-script path for `*.netflix.com`.
- Injected `providers/theme/netflix.js` and `providers/theme/netflix.css` at `document_start`.
- Exposed the Netflix background asset through `web_accessible_resources`.
- Validated that the injection architecture worked; remaining failures were selector/background-layer issues rather than provider detection.

_Recovered from the original Stream Shell development chats / release messages._
