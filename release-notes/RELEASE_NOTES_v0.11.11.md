# Stream Shell 0.11.11

## Completion Threshold Editing Fix

- Allowed the Continue completion input to be temporarily empty while the user is editing it.
- Committed on Enter/blur and restored the previous value on Escape.
- Made an empty blur fall back safely instead of trapping the field in an invalid state.

_Recovered from the original Stream Shell development chats / release messages._
