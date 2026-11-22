## 0.22.34 — Consistent controls and Continue admission rules
- Replace Providers and Subscriptions checkboxes with the existing Settings toggle style.
- Theme Settings range sliders consistently, including Anarchy, Twitch and provider Audio pages; use Anarchy colors for its intensity control.
- Continue now exposes an editable progress range: minimum admission defaults to 5%, while the existing completion threshold is retained. Bounds stay ordered.
- Add per-provider automatic admission switches for the five supported Continue providers. Disabled providers do not add or update entries; existing records remain. Admission checks share the existing storage read and add no polling.
- The minimum uses playback position percentage, not elapsed viewing time. Existing entries below the minimum are filtered out of Continue.

Validation: Continue admission, disabled providers, completion cleanup and bounds regression checks passed, along with merged search and bundle tests. Syntax checks passed; live Opera visual verification remains outstanding.
