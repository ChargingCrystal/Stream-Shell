# Stream Shell v0.19.37 — Native PNG Primary Recovery

Reproduced symptom in user Diagnostics v0.19.36: `native.titlebarArtwork` used `provider-svg` with `primaryFailure: offscreen-timeout`; titlebar showed the fallback Prime Video artwork instead of the test Settings icon. `titlebarProviderSync` acknowledged generation 2 without native errors.

The PNG primary is no longer sent through offscreen image decoding; the extension worker reads local bytes. Native helper renders normalized neutral monochrome, independent of selected provider titlebar color. Fallback SVG and text priority remain, with status reasons distinguishing missing/invalid/large PNG from renderer timeouts.

Version: v0.19.37; Native Messaging protocol v9; reinstall native helper; reload Opera GX. Custom art and backgrounds are preserved locally, not bundled. Windows C# compile and actual native GDI draw have not been verified in this environment.
