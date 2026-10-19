# Stream Shell v0.20.0 — Provider Registry UI Consolidation

The first 0.20 milestone brings a polished, space-efficient General → Providers UI to the proven v0.19.37 provider registry and native icon pipeline.

Dashboard (maximum seven pinned) and Native Titlebar (no artificial cap) tables are arranged in parallel at wide settings widths with condensed controls and automatic stacking on narrower layouts. The Add/Edit form places Name, Icon/initials and HTTPS URL together (25:10:65), with Artwork key and aligned Add/Save/Cancel below. Concise, automatically updated local asset paths cover provider icon/wordmark SVGs, native PNG and Wide/Compact PNG backgrounds. The user manages these files manually; no file picker/importer is added.

**Installation:** overlay v0.20.0 PATCH on v0.19.37, then reload the extension in `opera://extensions`. Native helper C# and native Messaging protocol v9 are unchanged; **do not reinstall**. As always, custom artwork and background files are not included in either ZIP.

**Verification:** dashboard JS rebuilt from the authoritative source files; Node regression suites pass, and browser layout smoke tests confirm parallel lists and no form overflow at large/small widths. Actual Opera GX UI visual verification remains for the user.
