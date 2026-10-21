/* Stream Shell v0.20.31: small document_idle admission for optional Twitch HUD.
 * The full HUD is physically loaded only for a confirmed managed V2 slot,
 * staggered after renderer startup. Core playback/wake/Marbles remain independent. */
(() => {
    const HUD_DELAY_MS = Object.freeze({ a: 750, b: 1050, c: 1350, d: 1650 });
    let alive = true;
    let requested = false;
    let pending = null;
    let retryTimer = null;
    let attempts = 0;

    window.addEventListener("pagehide", () => {
        alive = false;
        if (pending !== null) clearTimeout(pending);
        if (retryTimer !== null) clearTimeout(retryTimer);
    }, { once: true });

    async function requestHud() {
        pending = null;
        if (!alive || requested) return;
        requested = true;
        try {
            const reply = await chrome.runtime.sendMessage({ type: "twitch-workspace-v2-load-hud" });
            if (!reply?.ok && alive) {
                requested = false;
                retry();
            }
        } catch {
            if (!alive) return;
            requested = false;
            retry();
        }
    }

    function retry() {
        if (!alive || requested || retryTimer !== null || attempts >= 20) return;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            hydrate();
        }, 160 + attempts * 45);
    }

    async function hydrate() {
        if (!alive || requested) return;
        attempts += 1;
        let context = null;
        try {
            context = await chrome.runtime.sendMessage({ type: "get-stream-shell-twitch-workspace-context" });
        } catch {}
        if (!alive || requested) return;
        if (!context?.managed) {
            retry();
            return;
        }
        // Legacy/non-slot Twitch windows have no workspace HUD to render.
        if (context.role !== "slot" || !["a", "b", "c", "d"].includes(context.slotId)) return;
        const delay = document.visibilityState === "visible" ? 0 : HUD_DELAY_MS[context.slotId];
        pending = setTimeout(requestHud, delay);
    }

    hydrate().catch(() => {});
})();
