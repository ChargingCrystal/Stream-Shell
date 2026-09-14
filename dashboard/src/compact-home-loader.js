/*
 * ============================================================
 * COMPACT HOME LAZY LOADER
 * ============================================================
 * Wide must keep the pre-0.14 dashboard runtime surface. The much larger
 * Landing-derived Watchlist/Search/Subscriptions runtime is therefore parsed
 * only after the session has positively identified itself as Compact.
 */
let compactHomeRuntimeLoadPromise = null;

function ensureCompactHomeRuntimeLoaded(layoutProfile) {
    if (layoutProfile !== "compact") {
        return Promise.resolve(false);
    }

    if (compactHomeRuntimeLoadPromise) {
        return compactHomeRuntimeLoadPromise;
    }

    compactHomeRuntimeLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-stream-shell-compact-home]');
        if (existing) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("dashboard/compact-home.js");
        script.async = false;
        script.dataset.streamShellCompactHome = "true";
        script.addEventListener("load", () => resolve(true), { once: true });
        script.addEventListener("error", () => reject(new Error("compact-home-runtime-load-failed")), { once: true });
        document.head.appendChild(script);
    }).catch(error => {
        compactHomeRuntimeLoadPromise = null;
        console.error("Compact Home runtime failed:", error);
        return false;
    });

    return compactHomeRuntimeLoadPromise;
}
