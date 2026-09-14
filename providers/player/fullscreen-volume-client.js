/* Stream Shell fullscreen/Volume Booster bridge (isolated world). */
(() => {
    const REQUEST_EVENT = "stream-shell-volume-fullscreen-request";
    const RESPONSE_EVENT = "stream-shell-volume-fullscreen-response";

    document.addEventListener(REQUEST_EVENT, event => {
        const detail = event?.detail;
        const requestId = String(detail?.requestId || "");
        const action = detail?.action;

        if (!requestId || (action !== "suspend" && action !== "resume")) {
            return;
        }

        chrome.runtime.sendMessage({
            type: "provider-volume-fullscreen-bridge",
            action
        })
            .then(response => {
                document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                    detail: {
                        requestId,
                        response: response || null
                    }
                }));
            })
            .catch(() => {
                document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                    detail: {
                        requestId,
                        response: null
                    }
                }));
            });
    }, true);
})();
