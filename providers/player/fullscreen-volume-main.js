/*
 * Stream Shell fullscreen bridge (MAIN world).
 *
 * Chromium blocks page requestFullscreen() while the same tab is actively
 * self-captured. The Volume Booster uses audio-only tabCapture, so suspend
 * capture for the transition, enter fullscreen with the original user
 * activation, then ask the extension to attach the audio route again.
 */
(() => {
    const REQUEST_EVENT = "stream-shell-volume-fullscreen-request";
    const RESPONSE_EVENT = "stream-shell-volume-fullscreen-response";
    const BRIDGE_TIMEOUT_MS = 1800;

    let sequence = 0;

    function bridgeRequest(action) {
        const requestId = `${Date.now()}-${++sequence}`;

        return new Promise(resolve => {
            let settled = false;

            const finish = value => {
                if (settled) return;
                settled = true;
                document.removeEventListener(RESPONSE_EVENT, onResponse, true);
                clearTimeout(timer);
                resolve(value || null);
            };

            const onResponse = event => {
                const detail = event?.detail;
                if (!detail || detail.requestId !== requestId) return;
                finish(detail.response || null);
            };

            document.addEventListener(RESPONSE_EVENT, onResponse, true);

            const timer = setTimeout(() => finish(null), BRIDGE_TIMEOUT_MS);

            document.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
                detail: {
                    requestId,
                    action
                }
            }));
        });
    }

    function wrapFullscreenMethod(prototype, name) {
        const original = prototype?.[name];
        if (typeof original !== "function" || original.__streamShellVolumeFullscreenBridge) {
            return;
        }

        const wrapped = function(...args) {
            const target = this;

            return (async () => {
                const prepared = await bridgeRequest("suspend");
                const suspended = prepared?.suspended === true;

                try {
                    const result = await original.apply(target, args);

                    if (suspended) {
                        // requestFullscreen() resolves after the fullscreen state has
                        // committed. Re-attach only then so self-capture cannot block
                        // the transition itself.
                        bridgeRequest("resume").catch(() => {});
                    }

                    return result;
                } catch (error) {
                    if (suspended) {
                        bridgeRequest("resume").catch(() => {});
                    }
                    throw error;
                }
            })();
        };

        try {
            Object.defineProperty(wrapped, "__streamShellVolumeFullscreenBridge", {
                value: true
            });
        } catch {}

        try {
            Object.defineProperty(prototype, name, {
                configurable: true,
                enumerable: false,
                writable: true,
                value: wrapped
            });
        } catch {
            try {
                prototype[name] = wrapped;
            } catch {}
        }
    }

    wrapFullscreenMethod(Element.prototype, "requestFullscreen");
    wrapFullscreenMethod(Element.prototype, "webkitRequestFullscreen");
    wrapFullscreenMethod(Element.prototype, "webkitRequestFullScreen");

    // Safety net: if a provider leaves fullscreen while capture is still
    // suspended (for example after a rejected/aborted transition), ask the
    // background to reconcile the audio route once more.
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
            bridgeRequest("resume").catch(() => {});
        }
    }, true);

    document.addEventListener("webkitfullscreenchange", () => {
        const active = document.fullscreenElement || document.webkitFullscreenElement;
        if (!active) {
            bridgeRequest("resume").catch(() => {});
        }
    }, true);
})();
