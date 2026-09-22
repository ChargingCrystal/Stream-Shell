# Stream Shell 0.10.35

## YouTube Extras Visibility Attempt

- Tried to isolate/hide the Comments region using a parent `:has(...)` selector.
- The selector was too broad and could hide the wrapper containing Stream Shell's extras as well.

> Historical note: Historical regression build. 0.10.36 immediately removes the problematic parent-hiding rule.

_Recovered from the original Stream Shell development chats / release messages._
