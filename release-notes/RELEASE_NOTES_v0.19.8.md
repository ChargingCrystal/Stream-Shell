# Stream Shell 0.19.8 — Twitch Workspace Lifecycle & Compositor Wake Pass

- A-D native claims now follow real tab title/status readiness instead of depending only on fixed startup delays.
- Returning to Twitch sends a no-reload compositor wake pulse to live Twitch tabs to reduce black surfaces after they were covered.
- Cold Workspace creation gets one final no-activate cluster settle after onboarding so B-D do not remain behind Dashboard.
- Redundant claim-wave z-order raises were removed.
- Twitch A-D and the remaining Stream Shell browser windows now close in parallel during shutdown.
- No Workspace geometry/schema migration, Unified Remote reinstall or native-helper reinstall is required.
