/* Stream Shell performance black box.
 * Runs only in our Landing/Dashboard renderer, not on provider websites.
 * Intentionally low-frequency: incidents only, no telemetry upload or URLs.
 */
(() => {
    "use strict";
    if (globalThis.__streamShellPerformanceWatchdog) return;
    globalThis.__streamShellPerformanceWatchdog = true;

    const source = location.pathname.includes('/dashboard/') ? 'dashboard' : 'landing';
    const INTERVAL_MS = 1000;
    const GAP_THRESHOLD_MS = 2000;
    const LONG_TASK_THRESHOLD_MS = 350;
    const lastReport = new Map();
    let precedingTick = performance.now();
    let precedingVisible = document.visibilityState === 'visible';

    function report(kind, durationMs) {
        const value = Math.round(Number(durationMs));
        if (!Number.isFinite(value) || value < 0) return;
        const now = performance.now();
        const last = lastReport.get(kind) || -Infinity;
        // Keep diagnostic writes bounded even when the UI stutters repeatedly.
        if (now - last < 10000 && value < 5000) return;
        lastReport.set(kind, now);
        try {
            const promise = chrome.runtime.sendMessage({
                type: 'stream-shell-performance-event',
                incident: {
                    source,
                    kind,
                    durationMs: Math.min(value, 86400000),
                    visible: document.visibilityState === 'visible'
                }
            });
            if (promise?.catch) promise.catch(() => {});
        } catch (_) { /* The extension may be shutting down. */ }
    }

    document.addEventListener('visibilitychange', () => {
        precedingTick = performance.now();
        precedingVisible = document.visibilityState === 'visible';
    }, { passive: true });

    setInterval(() => {
        const now = performance.now();
        const gap = now - precedingTick - INTERVAL_MS;
        const isVisible = document.visibilityState === 'visible';
        if (precedingVisible && isVisible && gap >= GAP_THRESHOLD_MS) {
            report('renderer-timer-gap', gap);
        }
        precedingTick = now;
        precedingVisible = isVisible;
    }, INTERVAL_MS);

    if (typeof PerformanceObserver === 'function') {
        try {
            const observer = new PerformanceObserver(list => {
                if (document.visibilityState !== 'visible') return;
                for (const entry of list.getEntries()) {
                    if (entry.duration >= LONG_TASK_THRESHOLD_MS) {
                        report('renderer-long-task', entry.duration);
                    }
                }
            });
            observer.observe({ type: 'longtask', buffered: false });
        } catch (_) { /* Not all Opera builds expose longtask observation. */ }
    }
})();
