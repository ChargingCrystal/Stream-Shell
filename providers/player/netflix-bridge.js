(() => {
    "use strict";

    const CHANNEL = "stream-shell-netflix-player-bridge-v1";
    const RUNTIME_KEY = "__streamShellNetflixPlayerBridgeRuntimeV1";

    const previousRuntime = window[RUNTIME_KEY];
    if (typeof previousRuntime?.handler === "function") {
        try {
            window.removeEventListener("message", previousRuntime.handler);
        } catch {
        }
    }

    function reply(id, ok, result = null, error = null) {
        window.postMessage({
            __streamShellNetflixBridge: CHANNEL,
            type: "ack",
            id,
            ok: ok === true,
            result,
            error: error ? String(error) : null
        }, "*");
    }

    function getPlayerManager() {
        try {
            return window.netflix
                ?.appContext
                ?.state
                ?.playerApp
                ?.getAPI?.()
                ?.videoPlayer || null;
        } catch {
            return null;
        }
    }

    function getPlayer() {
        const manager = getPlayerManager();
        if (!manager?.getAllPlayerSessionIds || !manager?.getVideoPlayerBySessionId) {
            return null;
        }

        let sessionIds = [];
        try {
            sessionIds = manager.getAllPlayerSessionIds() || [];
        } catch {
            return null;
        }

        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
            return null;
        }

        const sessionId = sessionIds.find(id => /watch/i.test(String(id || ""))) || sessionIds[0];
        try {
            return manager.getVideoPlayerBySessionId(sessionId) || null;
        } catch {
            return null;
        }
    }

    async function executeCommand(action, payload = {}) {
        if (action === "ping") {
            return {
                bridgeReady: true,
                playerReady: Boolean(getPlayer())
            };
        }

        const player = getPlayer();
        if (!player) {
            const error = new Error("player-unavailable");
            error.code = "player-unavailable";
            throw error;
        }

        switch (action) {
            case "seek": {
                const milliseconds = Number(payload.milliseconds);
                if (!Number.isFinite(milliseconds) || milliseconds < 0 || typeof player.seek !== "function") {
                    throw new Error("seek-unavailable");
                }
                await Promise.resolve(player.seek(milliseconds));
                return true;
            }

            case "play":
                if (typeof player.play !== "function") throw new Error("play-unavailable");
                await Promise.resolve(player.play());
                return true;

            case "pause":
                if (typeof player.pause !== "function") throw new Error("pause-unavailable");
                await Promise.resolve(player.pause());
                return true;

            case "setPlaybackRate": {
                const rate = Number(payload.rate);
                if (!Number.isFinite(rate) || rate <= 0 || typeof player.setPlaybackRate !== "function") {
                    throw new Error("playback-rate-unavailable");
                }
                await Promise.resolve(player.setPlaybackRate(rate));
                return true;
            }

            case "setVolume": {
                const volume = Number(payload.volume);
                if (!Number.isFinite(volume) || typeof player.setVolume !== "function") {
                    throw new Error("volume-unavailable");
                }
                await Promise.resolve(player.setVolume(Math.max(0, Math.min(1, volume))));
                return true;
            }

            default:
                throw new Error("unknown-command");
        }
    }

    const handler = event => {
        if (event.source !== window) return;

        const data = event.data;
        if (
            !data ||
            data.__streamShellNetflixBridge !== CHANNEL ||
            data.type !== "command" ||
            !data.id
        ) {
            return;
        }

        Promise.resolve()
            .then(() => executeCommand(String(data.action || ""), data.payload || {}))
            .then(result => reply(data.id, true, result, null))
            .catch(error => reply(
                data.id,
                false,
                null,
                error?.code || error?.message || "bridge-command-failed"
            ));
    };

    window.addEventListener("message", handler);
    window[RUNTIME_KEY] = {
        handler,
        initializedAt: Date.now()
    };

    window.postMessage({
        __streamShellNetflixBridge: CHANNEL,
        type: "ready"
    }, "*");
})();
