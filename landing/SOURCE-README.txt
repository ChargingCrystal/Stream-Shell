Stream Shell Landing source layout
==================================

The browser loads ONLY landing.js.

Files in landing/src/ are source chunks for maintainability. They are deliberately
NOT loaded as separate <script> tags because splitting one classic script into
multiple runtime scripts can change declaration/hoisting semantics.

After editing source chunks, run:

    powershell -ExecutionPolicy Bypass -File .\build-landing.ps1

from this landing folder (or invoke the script by full path).

The build script concatenates the source chunks in the canonical order and writes
landing.js as UTF-8 without BOM. No bundler, package manager or network dependency
is required.

Direct-link storage lives in ../media/direct-links.js and intentionally loads before landing.js as a self-contained IIFE API.
Global Continue Watching storage plus its user-editable completion threshold live in ../media/continue-watching.js and load before landing.js as a self-contained IIFE API.


Wide-only finance source
------------------------
`src/finance.js` is part of `landing/landing.js` only. It intentionally does not appear in Dashboard's Compact Home source list, so Compact does not parse or execute the COBOL finance UI/bridge code.

Finance print path

`src/finance.js` consumes the `PRINT_REPORT_BEGIN` / `PRINT_REPORT_END` section emitted by the GnuCOBOL worker. `PRINT REPORT` prints that COBOL-produced fixed-width statement through A4 print CSS; JavaScript does not reconstruct the financial statement.
