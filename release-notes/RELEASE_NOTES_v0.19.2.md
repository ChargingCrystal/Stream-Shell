# Stream Shell 0.19.2 — Twitch Workspace Stability Pass

- removes the 0.19.1 delayed focus/claim cascades that could turn one workspace action into repeated Opera/native z-order work
- Twitch workspace show no longer raises Dashboard first
- a workspace show performs one browser focus transition; the native helper raises the remaining claimed Twitch members once without activation
- slot Add/Edit/Clear no longer invokes a second full workspace-show cycle
- native titlebar renderer is reset to the proven 0.18.37 implementation; the experimental C/D/chat chrome overlays from 0.19.1 are removed
- A/B keep the proven native Twitch chrome path; C/D/chat remain ordinary claimed Opera windows for now
- Twitch SPA location sync no longer rebroadcasts the entire shell state
- workspace HUD rendering is deduplicated when its context did not materially change
- hiding the chat drawer now minimizes that drawer instead of leaving a live chat window in the compositor z-order

This release is intentionally a stabilization release. It changes no slot geometry and does not reintroduce parking or post-create resizing.
