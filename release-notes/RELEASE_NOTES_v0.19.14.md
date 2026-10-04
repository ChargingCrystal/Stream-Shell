# Stream Shell 0.19.14 — Twitch Chat Editor Input Repair

- Fixed Marbles auto-join targeting Twitch's outer chat-input wrapper instead of the real nested editor.
- `!play` is now inserted through Twitch's actual contenteditable/textarea so the message participates in Twitch/Slate state and the Send control can activate normally.
- Removed direct content-shell `textContent` fallback that could paint `!play` over the `Send a message` placeholder without creating valid input.
- Added paste/`insertText` editor strategies plus a bounded Send-button wait and Enter fallback.
- Marbles trigger/cooldown behavior is unchanged.
- No native-helper or Unified Remote reinstall is required.
