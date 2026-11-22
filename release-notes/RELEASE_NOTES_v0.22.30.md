## 0.22.30 — Centered diagonal blocklist labels and Shorts shelves
- Center the red label on the actual image rectangle and rotate it 30 degrees clockwise. Scale text to the thumbnail/avatar dimensions and update on resize.
- Preserve existing absolute thumbnail positioning instead of overriding YouTube image wrappers.
- Extend Shorts image/card selectors and use explicit channel-specific shelf identity when individual Shorts omit their author. Generic mixed shelves do not inherit an unrelated channel result.
- Existing imported lists remain unchanged. No JSON reimport required.
- API, identity and Shorts context regression tests passed; live YouTube visual verification remains pending.
