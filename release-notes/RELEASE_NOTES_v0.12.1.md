# Stream Shell 0.12.1

## Diagnostics Performance Pass

- Removed heavy Diagnostics `backdrop-filter` / `clip-path` paint work.
- Stopped hidden Settings DOM from continuing to cost paint/layout work behind Diagnostics.
- Added `content-visibility`/containment where safe.
- Limited live panel probing to the active provider while keeping full five-provider probing for explicit JSON export.
- Kept the UI timeline smaller than the exported recorder history to reduce render cost.

**Recovered SHA-256:** `6a2a918d65ef1a0de3f1301baf80a50a831cdb7228f752749e37e1c9f4a4e194`

_Recovered from the original Stream Shell development chats / release messages._
