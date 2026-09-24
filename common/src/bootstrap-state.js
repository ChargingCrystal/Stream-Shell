(() => {
    /*
     * ============================================================
     * PROVIDERS
     * ============================================================
     */

    const PROVIDERS = {
        youtube: {
            label:
                "YouTube",

            hosts: [
                "youtube.com"
            ]
        },

        netflix: {
            label:
                "Netflix",

            hosts: [
                "netflix.com"
            ]
        },

        prime: {
            label:
                "Prime Video",

            hosts: [
                "primevideo.com",
                "amazon.de"
            ]
        },

        disney: {
            label:
                "Disney+",

            hosts: [
                "disneyplus.com"
            ]
        },

        crunchyroll: {
            label:
                "Crunchyroll",

            hosts: [
                "crunchyroll.com"
            ]
        }
    };


    /*
     * ============================================================
     * BASIC HELPERS
     * ============================================================
     */

    function delay(
        ms
    ) {
        return new Promise(
            resolve => {
                setTimeout(
                    resolve,
                    ms
                );
            }
        );
    }


    async function waitForDocumentElement() {
        while (
            !document.documentElement
        ) {
            await delay(
                10
            );
        }
    }


    async function waitUntilManaged() {
        for (
            let attempt = 0;
            attempt < 20;
            attempt++
        ) {
            try {
                const response =
                    await chrome.runtime.sendMessage({
                        type:
                            "is-stream-shell-window"
                    });

                if (
                    response?.managed
                ) {
                    return true;
                }
            } catch {
            }

            await delay(
                250
            );
        }

        return false;
    }


    function recordProviderFlightEvent(
        action,
        {
            category = "provider",
            level = "info",
            detail = {},
            provider = null
        } = {}
    ) {
        const resolvedProvider = provider || getCurrentProvider?.() || null;
        if (!resolvedProvider) return;

        try {
            chrome.runtime.sendMessage({
                type: "stream-shell-flight-event",
                event: {
                    action: String(action || "event"),
                    category: String(category || "provider"),
                    level,
                    provider: resolvedProvider,
                    detail
                }
            }).catch(() => {});
        } catch {
        }
    }

    let managedMarkerObserver = null;
    let managedLayoutProfile = "wide";
    let managedDisplayTarget = "32:9";


    function displayScopedStorageKey(baseKey, target = managedDisplayTarget) {
        const normalizedTarget = ["32:9", "16:9", "16:10"].includes(target)
            ? target
            : "32:9";

        return `${baseKey}__${normalizedTarget.replace(":", "_")}`;
    }


    function readDisplayScopedSetting(stored, baseKey, fallbackValue) {
        const scopedKey = displayScopedStorageKey(baseKey);

        if (Object.prototype.hasOwnProperty.call(stored || {}, scopedKey)) {
            return stored[scopedKey];
        }

        if (Object.prototype.hasOwnProperty.call(stored || {}, baseKey)) {
            return stored[baseKey];
        }

        return fallbackValue;
    }


    async function initializeManagedLayoutProfile() {
        try {
            const state = await chrome.runtime.sendMessage({
                type: "get-state"
            });

            managedLayoutProfile =
                state?.layoutProfile === "compact"
                    ? "compact"
                    : "wide";

            managedDisplayTarget =
                managedLayoutProfile === "compact" &&
                (state?.displayTarget === "16:9" || state?.displayTarget === "16:10")
                    ? state.displayTarget
                    : "32:9";
        } catch {
            managedLayoutProfile = "wide";
            managedDisplayTarget = "32:9";
        }
    }


    function startManagedMarkerGuard() {
        const ensureMarker = () => {
            const root =
                document.documentElement;


            if (
                root &&
                root.getAttribute(
                    "data-stream-shell"
                ) !== "true"
            ) {
                root.setAttribute(
                    "data-stream-shell",
                    "true"
                );
            }


            if (
                root &&
                root.getAttribute(
                    "data-stream-shell-layout-profile"
                ) !== managedLayoutProfile
            ) {
                root.setAttribute(
                    "data-stream-shell-layout-profile",
                    managedLayoutProfile
                );
            }


            if (
                root &&
                root.getAttribute(
                    "data-stream-shell-display-target"
                ) !== managedDisplayTarget
            ) {
                root.setAttribute(
                    "data-stream-shell-display-target",
                    managedDisplayTarget
                );
            }
        };


        ensureMarker();


        if (
            managedMarkerObserver
        ) {
            return;
        }


        managedMarkerObserver =
            new MutationObserver(
                ensureMarker
            );


        managedMarkerObserver.observe(
            document.documentElement,
            {
                attributes: true,
                attributeFilter: [
                    "data-stream-shell",
                    "data-stream-shell-layout-profile",
                    "data-stream-shell-display-target"
                ]
            }
        );
    }


