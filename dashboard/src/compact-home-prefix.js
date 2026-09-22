/* Compact Shell Home reuses the proven Landing media/subscription runtime in
 * an isolated scope. Wide never initializes or styles this block. */
(async function streamShellCompactHomeRuntime() {
    const compactBootState = await chrome.runtime.sendMessage({ type: "get-state" }).catch(() => null);
    if (compactBootState?.layoutProfile !== "compact") return;

    document.body.dataset.layoutProfile = "compact";

    const compactLandingStyles = document.getElementById("compact-home-landing-styles");
    if (compactLandingStyles) compactLandingStyles.disabled = false;

    const loadCompactHomeScript = (path) => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(path);
        script.async = false;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error(`compact-home-script-failed:${path}`)), { once: true });
        document.head.appendChild(script);
    });

    // These media helpers used to belong exclusively to Landing. Load them only
    // for Compact so Wide Dashboard keeps its pre-0.14 runtime/CSS surface.
    await Promise.all([
        "media/watchlist.js",
        "media/direct-links.js",
        "media/continue-watching.js",
        "media/availability.js",
    ].map(loadCompactHomeScript));
