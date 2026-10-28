# Stream Shell v0.21.26 — Mangayomi late-window handoff

**Date:** 2026-10-23

## Changed

- **Normal click:** search installed Mangayomi sources within Stream Shell's left panel (unchanged).
- **Shift + left-click:** copy the normalized title to clipboard, then switch directly to Mangayomi. No source lookup.
- **Selecting a result:** when the current Native Host confirms that `/v1/open` succeeded but Mangayomi's main window is not ready, do not falsely mark the source navigation as a failure. Show a pending message and retry the safe `status` probe (which never starts another copy of Mangayomi) before raising the window. User-driven provider changes cancel the deferred raise.
- Error messages no longer automatically instruct users to rebuild the fork and helper.

## Install

Extract over the existing Stream Shell files, preserving local backgrounds. Reload the Stream Shell extension in `opera://extensions`. No recompilation, native helper reinstall or Flutter fork rebuild is necessary **for these two client-side changes**.

## Verification

Offline JS tests exercise the clipboard-before-switch contract, acknowledged-but-late-window handling, cancellation and genuine bridge failures. Actual time-to-window depends on Windows/Flutter; background worker lifetimes can suspend a delayed reveal, in which case users can switch to Mangayomi manually after it finishes starting.
