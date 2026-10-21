# Stream Shell v0.20.27 — Cross-Surface Renderer Admission & Twitch Cold-Window Verification

Released: 2026-10-21

## Reproduction from the 0.20.26 Deep Log

YouTube's window was opened at 14:11:31 UTC, then the Twitch workspace transition began only a few seconds later. The Flight Recorder shows **four new Twitch popup creations** (`newPopups:4`, stagger 1250 ms), yet `twitch-workspace-v2/shown` reported `coldStart:false`. The warm/cold admission decision trusted four integer window IDs in the focus cache; it did not establish that those Opera windows still existed. The 3-second warm grace can therefore be selected for a real four-window cold start. No `provider -> twitch` stagger event was logged. This is a concrete misclassification, not proof that the complete Opera freeze has only one cause.

## Fix

1. Before cross-surface admission, verify the target provider/each Twitch A–D window through `chrome.windows.get` rather than trusting cached IDs. Missing or inaccessible IDs select the existing **5500 ms cold** grace, including when the original list of four IDs remains stored. Verified live target windows may retain the **3000 ms warm** grace after the initial 30s period.
2. Store the last completed provider/Twitch handoff timestamp as a short-lived lease in MV3 `chrome.storage.session`, and read it when a new service-worker instance has no in-memory lease. Apply this equally to all provider IDs, including custom providers; the warm hidden provider launched on Home also records the lease. Store failures fall back to existing process-local pacing. No permanent storage, alarms, background polling or additional delays.
3. Twitch workspace `coldStart` and its surface-wake scheduling now use actual live A–D windows rather than persisted numeric IDs; stale IDs correctly cause cold wake/reconciliation.
4. Extend mandatory Node behavior regressions to cover service-worker restart, both launch directions, user-selected custom providers, warm startup, stale slot IDs, genuinely warm slot windows and no extra wait beyond grace.

## Deliberately unchanged

The existing cold/warm constants (5.5s/3s), Twitch new-popup spacing (1250ms), popup ordering, native claims, C# titlebar and Discord helpers, all provider content/YouTube features, Storage settings, IPC payload contracts, and local custom artwork remain unchanged. No native reinstall is required.

## Applying & validation

Apply PATCH over **v0.20.26**, then reload the unpacked extension, or use the FULL project. Do not delete local artwork or backgrounds; none are bundled in the ZIP. Run `node tools/check-project.mjs` to verify all cross-platform source/build/tests. Only a real Opera GX start with provider first and Twitch second can establish whether the visible race/freeze is resolved.
