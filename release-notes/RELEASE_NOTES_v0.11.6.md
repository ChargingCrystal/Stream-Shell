# Stream Shell 0.11.6

## Managed Marker & Crunchyroll Metadata Fix

- Added a lightweight managed-marker guard so SPA/provider changes can restore Stream Shell's root marker when a site removes it.
- Applied the guard to all providers.
- Added Crunchyroll title fallback order: Series DOM → JSON-LD → `og:title` → `twitter:title` → meta title → `document.title`.
- Exposed Crunchyroll `titleMetadata` detail in Diagnostics.

**Recovered SHA-256:** `994d9cbb8badaf0d7fb1abc66e8c407cf1cd182c99c1658e0e9596c07b660171`

_Recovered from the original Stream Shell development chats / release messages._
