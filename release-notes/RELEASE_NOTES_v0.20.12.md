# Stream Shell v0.20.12 – Twitch Skeleton Geometry Alignment

A/B native Opera windows cover y=0–560 and C/D begin at y=520 on the 3840×1080 Wide display. The previous skeleton used a full-window header and an inset 2×2 grid, so growing real popups clipped the shared header and misaligned the placeholders.

This change switches to a full-bleed 2×2 placeholder grid. Each slot A–D has its own loading header, purple status dot, shimmer video placeholder and footer, and upper cards reserve space away from the 40px native overlap seam. Real Twitch windows progressively cover their matching skeleton cells without cutting through a shared header.

No new browser/Storage/native API calls, polling, helper reinstall or changes to the cold/warm renderer admission controls.
