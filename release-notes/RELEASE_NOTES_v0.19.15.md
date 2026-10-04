# Stream Shell 0.19.15 — Twitch Marbles Submission Transaction Hotfix

- Added a per-slot in-flight lock so one Marbles burst cannot overlap two chat submissions.
- Replaced the previous paste/fallback race with one settled editor insertion path, eliminating the main `!play!play` source.
- Reuses or normalizes an existing auto-generated `!play` draft instead of appending another command.
- Verifies submission by waiting for Twitch to clear the editor; an unsent draft no longer starts the 120-second cooldown.
- Retries the live Twitch Send control without reinserting text and cleans up failed auto-generated drafts before the next round.
- Unrelated user chat drafts are left untouched, and newer user focus/clicks win over focus restoration.
- The initial chat-hydration buffer, 5-10-user trigger, 1-4 second delay and per-slot 120-second cooldown are unchanged.
- No native-helper or Unified Remote reinstall is required.
