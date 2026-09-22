# Stream Shell 0.10.63

## Diagnostics Content Sizing Fix

- Let Diagnostics cards use their real content height instead of compressing three rows into the fixed panel height.
- Changed grid rows to `max-content` and stopped small cards stretching to match the tallest card.
- Made the Diagnostics content region scroll when the cards exceed the available height.
- Kept header/footer fixed and retained responsive 3 → 2 → 1 column behavior.

**Recovered SHA-256:** `6bd37d2d0a64116ebae11cb1cef1c5f60fe8458363f5c59a8fa17626fb43cdc0`

_Recovered from the original Stream Shell development chats / release messages._
