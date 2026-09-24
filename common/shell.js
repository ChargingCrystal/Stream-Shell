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


/*
 * Shared provider resume URL canonicalization + stable media identity.
 * This file is concatenated into both common/shell.js and background.js.
 * Keep it dependency-free and DOM-free.
 */
function normalizeProviderResumeUrl(providerName, rawUrl) {
    try {
        const url = new URL(String(rawUrl || ""));
        url.hash = "";

        if (providerName === "youtube") {
            const videoId = url.searchParams.get("v");
            if (videoId) {
                const clean = new URL(`${url.origin}/watch`);
                clean.searchParams.set("v", videoId);

                for (const key of ["list", "index"]) {
                    const value = url.searchParams.get(key);
                    if (value) clean.searchParams.set(key, value);
                }

                return clean.toString();
            }

            for (const key of ["t", "start", "time_continue"]) {
                url.searchParams.delete(key);
            }
            return url.toString();
        }

        if (providerName === "netflix") {
            const match = url.pathname.match(/^\/watch\/([^/]+)/i);
            if (match) url.pathname = `/watch/${match[1]}`;
            url.search = "";
            return url.toString();
        }

        if (providerName === "prime") {
            const match = url.pathname.match(/^(.*?\/(?:gp\/video\/)?detail\/[^/]+)/i);
            if (match) url.pathname = match[1];
            url.search = "";
            return url.toString();
        }

        return url.toString();
    } catch {
        return String(rawUrl || "").split("#")[0];
    }
}

function getProviderMediaIdentity(providerName, rawUrl) {
    try {
        const normalized = normalizeProviderResumeUrl(providerName, rawUrl);
        const url = new URL(String(normalized || rawUrl || ""));
        const pathname = url.pathname.replace(/\/+$/, "") || "/";

        if (providerName === "youtube") {
            const videoId = url.searchParams.get("v");
            return videoId ? `youtube:${videoId}` : `youtube:${pathname}`;
        }

        if (providerName === "netflix") {
            const match = pathname.match(/^\/watch\/([^/]+)/i);
            return match ? `netflix:watch:${match[1]}` : `netflix:${url.origin}${pathname}`;
        }

        if (providerName === "prime") {
            const match = pathname.match(/\/(?:gp\/video\/)?detail\/([^/]+)/i);
            return match ? `prime:detail:${match[1]}` : `prime:${url.origin}${pathname}`;
        }

        if (providerName === "crunchyroll") {
            const match = pathname.match(/^\/watch\/([^/]+)/i);
            return match ? `crunchyroll:watch:${match[1]}` : `crunchyroll:${url.origin}${pathname}`;
        }

        return `${providerName}:${url.origin}${pathname}`;
    } catch {
        return `${providerName}:${String(rawUrl || "").split("#")[0]}`;
    }
}

/*
 * Resolve a persisted provider media identity back to a provider-owned URL.
 * This is intentionally deterministic and network-free: dedicated adapters
 * can call it with their current origin, while the service worker uses it as
 * a safe fallback when a freshly opened content script is not ready yet.
 */
function isProviderOwnedMediaUrl(providerName, rawUrl) {
    try {
        const url = new URL(String(rawUrl || ""));
        const host = url.hostname.toLowerCase();

        switch (providerName) {
            case "youtube":
                return host === "youtube.com" || host.endsWith(".youtube.com");
            case "netflix":
                return host === "netflix.com" || host.endsWith(".netflix.com");
            case "prime":
                return host === "primevideo.com" ||
                    host.endsWith(".primevideo.com") ||
                    host === "amazon.de" ||
                    host.endsWith(".amazon.de");
            case "disney":
                return host === "disneyplus.com" || host.endsWith(".disneyplus.com");
            case "crunchyroll":
                return host === "crunchyroll.com" || host.endsWith(".crunchyroll.com");
            default:
                return false;
        }
    } catch {
        return false;
    }
}

function getResolvableProviderIdentity(providerName, rawIdentity, fallbackUrl = "") {
    const identity = String(rawIdentity || "").trim();

    const fromIdentity = (() => {
        if (providerName === "youtube") {
            const match = identity.match(/^youtube:([A-Za-z0-9_-]{6,32})$/);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        if (providerName === "netflix") {
            const match = identity.match(/^netflix:watch:([^:/?#]+)$/i);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        if (providerName === "prime") {
            const match = identity.match(/^prime:detail:([^:/?#]+)$/i);
            if (match) return { identity, kind: "detail", mediaId: match[1] };
        }

        if (providerName === "crunchyroll") {
            const match = identity.match(/^crunchyroll:watch:([^:/?#]+)$/i);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        return null;
    })();

    if (fromIdentity) return fromIdentity;

    if (!isProviderOwnedMediaUrl(providerName, fallbackUrl)) return null;

    const derived = getProviderMediaIdentity(providerName, fallbackUrl);
    if (!derived || derived === identity) return null;

    return getResolvableProviderIdentity(providerName, derived, "");
}

function resolveProviderMediaLink(
    providerName,
    rawIdentity,
    fallbackUrl = "",
    preferredOrigin = ""
) {
    const fallback = isProviderOwnedMediaUrl(providerName, fallbackUrl)
        ? normalizeProviderResumeUrl(providerName, fallbackUrl)
        : "";

    const resolvable = getResolvableProviderIdentity(
        providerName,
        rawIdentity,
        fallback
    );

    let url = "";
    let strategy = "canonical-fallback";

    if (resolvable?.mediaId) {
        const mediaId = encodeURIComponent(resolvable.mediaId);

        if (providerName === "youtube") {
            const target = new URL("https://www.youtube.com/watch");
            target.searchParams.set("v", resolvable.mediaId);

            try {
                const old = new URL(fallback);
                if (
                    isProviderOwnedMediaUrl("youtube", old.toString()) &&
                    old.searchParams.get("v") === resolvable.mediaId
                ) {
                    for (const key of ["list", "index"]) {
                        const value = old.searchParams.get(key);
                        if (value) target.searchParams.set(key, value);
                    }
                }
            } catch {
            }

            url = target.toString();
            strategy = "youtube-watch-id";
        }

        if (providerName === "netflix") {
            url = `https://www.netflix.com/watch/${mediaId}`;
            strategy = "netflix-watch-id";
        }

        if (providerName === "prime") {
            let origin = "https://www.primevideo.com";

            try {
                const candidate = new URL(String(preferredOrigin || ""));
                if (isProviderOwnedMediaUrl("prime", candidate.toString())) {
                    origin = candidate.origin;
                }
            } catch {
            }

            const host = new URL(origin).hostname.toLowerCase();
            url = host === "amazon.de" || host.endsWith(".amazon.de")
                ? `${origin}/gp/video/detail/${mediaId}`
                : `${origin}/detail/${mediaId}`;
            strategy = "prime-detail-id";
        }

        if (providerName === "crunchyroll") {
            url = `https://www.crunchyroll.com/watch/${mediaId}`;
            strategy = "crunchyroll-watch-id";
        }
    }

    if (!url && fallback) {
        url = fallback;
    }

    if (!url || !isProviderOwnedMediaUrl(providerName, url)) {
        return null;
    }

    const identity = getProviderMediaIdentity(providerName, url);

    return {
        provider: providerName,
        identity,
        url: normalizeProviderResumeUrl(providerName, url),
        strategy,
        reconstructed: Boolean(
            resolvable &&
            strategy !== "canonical-fallback"
        )
    };
}

    /*
     * ============================================================
     * NOW PLAYING TRACKER
     * ============================================================
     *
     * The Dashboard reads one small storage record per provider.
     * Nothing is sent outside Stream Shell; title/artwork are taken
     * from the already-open provider page itself.
     */

    const NOW_PLAYING_KEY_PREFIX =
        "streamShellNowPlaying_";


    function getCurrentProvider() {
        const hostname =
            String(
                window.location.hostname ||
                ""
            ).toLowerCase();


        for (
            const [provider, config]
            of Object.entries(
                PROVIDERS
            )
        ) {
            if (
                config.hosts.some(
                    host =>
                        hostname === host ||
                        hostname.endsWith(
                            `.${host}`
                        )
                )
            ) {
                return provider;
            }
        }


        return null;
    }


    function getMetaContent(
        selector
    ) {
        return String(
            document
                .querySelector(
                    selector
                )
                ?.getAttribute(
                    "content"
                ) ||
            ""
        ).trim();
    }


    function getTextFromSelectors(
        selectors
    ) {
        for (
            const selector
            of selectors
        ) {
            const elements =
                document.querySelectorAll(
                    selector
                );


            for (
                const element
                of elements
            ) {
                const text =
                    String(
                        element.textContent ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                if (
                    text.length >= 2 &&
                    text.length <= 220
                ) {
                    return text;
                }
            }
        }


        return "";
    }


    function getAttributeFromSelectors(
        selectors,
        attribute
    ) {
        for (
            const selector
            of selectors
        ) {
            const elements =
                document.querySelectorAll(
                    selector
                );


            for (
                const element
                of elements
            ) {
                const value =
                    String(
                        attribute === "src"
                            ? element.currentSrc ||
                                element.getAttribute?.(
                                    "src"
                                ) ||
                                ""
                            : element.getAttribute?.(
                                attribute
                            ) ||
                                ""
                    ).trim();


                if (
                    value
                ) {
                    return value;
                }
            }
        }


        return "";
    }


    function isGenericProviderTitle(
        title,
        provider
    ) {
        const value =
            String(
                title ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            !value
        ) {
            return true;
        }


        if (
            provider ===
                "prime"
        ) {
            return (
                /^(?:amazon\s+)?prime\s*video(?:\b|\s*[:|\-])/i.test(
                    value
                ) ||
                /^watch\s+(?:movies|tv|shows|prime\s*video)/i.test(
                    value
                ) ||
                /^amazon\.(?:com|de)\b/i.test(
                    value
                )
            );
        }


        return false;
    }


    function cleanProviderTitle(
        rawTitle,
        provider
    ) {
        let title =
            String(
                rawTitle ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            !title
        ) {
            return "";
        }


        const suffixes = {
            youtube: [
                /\s*-\s*YouTube\s*$/i
            ],

            netflix: [
                /^Watch\s+/i,
                /\s*[|\-]\s*Netflix\s*$/i
            ],

            prime: [
                /\s*[|\-]\s*Prime Video\s*$/i,
                /\s*[|\-]\s*Amazon Prime Video\s*$/i
            ],

            disney: [
                /\s*[|\-]\s*Disney\+\s*$/i
            ],

            crunchyroll: [
                /\s*[|\-]\s*Crunchyroll\s*$/i
            ]
        };


        for (
            const pattern
            of suffixes[provider] || []
        ) {
            title =
                title.replace(
                    pattern,
                    ""
                ).trim();
        }


        if (
            /^(Netflix|YouTube|Prime Video|Amazon Prime Video|Disney\+|Crunchyroll)$/i.test(
                title
            )
        ) {
            return "";
        }


        return title;
    }


    let netflixDomBodyScanUrl = "";
    let netflixDomBodyScanAt = 0;
    let netflixDomBodyScanTitle = "";


    function compactNetflixNowPlayingTitle(
        rawTitle
    ) {
        let title =
            String(
                rawTitle ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            !title
        ) {
            return "";
        }


        /*
         * Netflix's current player frequently concatenates nested text nodes
         * without a separator. In practice that can become either
         *
         *   Rick and Morty E7: Big Trouble in Little Sanchez
         *
         * or even
         *
         *   Rick and Morty E7Big Trouble in Little Sanchez
         *
         * Do not rely on a word boundary after the episode number. Strip the
         * episode suffix as soon as a season/episode marker follows the show
         * title. Movie titles are left untouched.
         */
        title =
            title
                .replace(
                    /\s+(?:S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*)?E(?:pisode)?\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s+S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*F(?:olge)?\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s+(?:Episode|Folge|Chapter|Kapitel)\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s*[·–—-]\s*$/,
                    ""
                )
                .trim();


        return title;
    }


    function getNetflixDomProviderTitle() {
        const candidates =
            [];


        const addCandidate =
            value => {
                const text =
                    String(
                        value ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                if (
                    text.length >= 2 &&
                    text.length <= 220 &&
                    !candidates.includes(
                        text
                    )
                ) {
                    candidates.push(
                        text
                    );
                }
            };


        const titleNodes =
            document.querySelectorAll(
                '[data-uia*="video-title"], [data-uia*="player-title"], [data-uia="video-title"], [class*="video-title"], [class*="VideoTitle"], [class*="ellipsize"]'
            );


        for (
            const node
            of titleNodes
        ) {
            addCandidate(
                node.textContent
            );

            addCandidate(
                node.getAttribute?.(
                    "aria-label"
                )
            );

            addCandidate(
                node.getAttribute?.(
                    "title"
                )
            );


            let parent =
                node.parentElement;


            for (
                let depth = 0;
                depth < 3 && parent;
                depth++
            ) {
                addCandidate(
                    parent.textContent
                );

                parent =
                    parent.parentElement;
            }
        }


        for (
            const candidate
            of candidates
        ) {
            const cleaned =
                cleanProviderTitle(
                    candidate,
                    "netflix"
                );

            const compact =
                compactNetflixNowPlayingTitle(
                    cleaned
                );


            if (
                compact &&
                compact !== cleaned &&
                compact.length >= 2
            ) {
                return compact;
            }
        }


        const structuralTitle =
            getTextFromSelectors([
                '[data-uia*="video-title"] h1',
                '[data-uia*="video-title"] h2',
                '[data-uia*="video-title"] h3',
                '[data-uia*="video-title"] h4',
                '[data-uia*="player-title"] h1',
                '[data-uia*="player-title"] h2',
                '[data-uia*="player-title"] h3',
                '[data-uia*="player-title"] h4',
                '[class*="video-title"] h1',
                '[class*="video-title"] h2',
                '[class*="video-title"] h3',
                '[class*="video-title"] h4',
                '[class*="ellipsize"] h4'
            ]);


        if (
            structuralTitle
        ) {
            return compactNetflixNowPlayingTitle(
                cleanProviderTitle(
                    structuralTitle,
                    "netflix"
                )
            );
        }


        /*
         * document.body.innerText forces a full rendered-text walk and is the
         * expensive compatibility fallback here. Do not repeat it on every
         * Now Playing tick when Netflix's normal title nodes are absent.
         */
        const bodyScanUrl =
            String(
                location.href ||
                ""
            );

        const bodyScanNow =
            Date.now();

        const shouldScanBody =
            bodyScanUrl !==
                netflixDomBodyScanUrl ||
            bodyScanNow -
                netflixDomBodyScanAt >=
                    5000;


        if (
            shouldScanBody
        ) {
            netflixDomBodyScanUrl =
                bodyScanUrl;

            netflixDomBodyScanAt =
                bodyScanNow;

            netflixDomBodyScanTitle =
                "";


            const bodyLines =
                String(
                    document.body?.innerText ||
                    ""
                )
                    .split(
                        /[\r\n]+/
                    )
                    .map(
                        line =>
                            line
                                .replace(
                                    /\s+/g,
                                    " "
                                )
                                .trim()
                    )
                    .filter(
                        line =>
                            line.length >= 4 &&
                            line.length <= 220 &&
                            /\s(?:S(?:eason|taffel)?\s*\d+\s*)?E(?:pisode)?\s*\d+/i.test(
                                line
                            )
                    );


            for (
                const line
                of bodyLines
            ) {
                const cleaned =
                    cleanProviderTitle(
                        line,
                        "netflix"
                    );

                const compact =
                    compactNetflixNowPlayingTitle(
                        cleaned
                    );


                if (
                    compact &&
                    compact !== cleaned &&
                    compact.length >= 2
                ) {
                    netflixDomBodyScanTitle =
                        compact;

                    return compact;
                }
            }
        }


        if (
            bodyScanUrl ===
                netflixDomBodyScanUrl &&
            netflixDomBodyScanTitle
        ) {
            return netflixDomBodyScanTitle;
        }


        const fallback =
            getTextFromSelectors([
                '[data-uia="video-title"]',
                '[data-uia="player-title"]',
                '[data-uia*="video-title"]'
            ]) ||
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            document.title;


        return compactNetflixNowPlayingTitle(
            cleanProviderTitle(
                fallback,
                "netflix"
            )
        );
    }


    async function getNetflixProviderTitle() {
        /*
         * Do not call Netflix's internal member metadata endpoint from the
         * playback document. The player is extremely sensitive to extra
         * same-origin traffic in some Chromium builds. Capture the title from
         * the player DOM while controls are available; startNowPlayingTracking
         * keeps that last stable metadata when Netflix later removes them.
         */
        return getNetflixDomProviderTitle();
    }


    function getActiveYouTubeShortsRenderer() {
        if (
            getCurrentProvider?.() !==
                "youtube" ||
            !location.pathname.startsWith(
                "/shorts/"
            )
        ) {
            return null;
        }


        const shortsVideos =
            document.querySelectorAll(
                "ytd-reel-video-renderer video"
            );


        // A playing media element is the strongest available signal. It also
        // survives cases where YouTube leaves Polymer's is-active marker stale
        // or applies it late after a long non-Shorts session.
        for (
            const video
            of shortsVideos
        ) {
            if (
                video.paused ||
                video.ended ||
                video.readyState < 2
            ) {
                continue;
            }


            const renderer =
                video.closest?.(
                    "ytd-reel-video-renderer"
                );


            if (
                renderer
            ) {
                return renderer;
            }
        }


        const marked =
            document.querySelector(
                "ytd-reel-video-renderer[is-active]"
            );


        if (
            marked
        ) {
            try {
                const rect =
                    marked.getBoundingClientRect();

                if (
                    rect.bottom > 0 &&
                    rect.right > 0 &&
                    rect.top < window.innerHeight &&
                    rect.left < window.innerWidth
                ) {
                    return marked;
                }
            } catch {
            }
        }


        try {
            const centered =
                document.elementFromPoint(
                    Math.max(
                        0,
                        Math.min(
                            window.innerWidth - 1,
                            window.innerWidth / 2
                        )
                    ),
                    Math.max(
                        0,
                        Math.min(
                            window.innerHeight - 1,
                            window.innerHeight / 2
                        )
                    )
                )?.closest?.(
                    "ytd-reel-video-renderer"
                );


            if (
                centered
            ) {
                return centered;
            }
        } catch {
        }


        const renderers =
            document.querySelectorAll(
                "ytd-reel-video-renderer"
            );


        let best =
            null;

        let bestVisibleArea =
            0;


        for (
            const renderer
            of renderers
        ) {
            const rect =
                renderer.getBoundingClientRect();


            const visibleWidth =
                Math.max(
                    0,
                    Math.min(
                        rect.right,
                        window.innerWidth
                    ) -
                    Math.max(
                        rect.left,
                        0
                    )
                );

            const visibleHeight =
                Math.max(
                    0,
                    Math.min(
                        rect.bottom,
                        window.innerHeight
                    ) -
                    Math.max(
                        rect.top,
                        0
                    )
                );

            const visibleArea =
                visibleWidth *
                visibleHeight;


            if (
                visibleArea >
                    bestVisibleArea
            ) {
                best =
                    renderer;

                bestVisibleArea =
                    visibleArea;
            }
        }


        if (
            best
        ) {
            return best;
        }


        return marked || null;
    }


    function getPrimaryVideo() {
        /*
         * YouTube is by far the hottest caller of this helper. Its active
         * video is already addressable without enumerating every <video> and
         * forcing geometry reads, so take the cheap provider-specific path
         * first and keep the generic area scan as a fallback for everyone
         * else.
         */
        if (
            getCurrentProvider?.() ===
                "youtube"
        ) {
            if (
                location.pathname.startsWith(
                    "/shorts/"
                )
            ) {
                const activeShort =
                    getActiveYouTubeShortsRenderer()
                        ?.querySelector?.(
                            "video"
                        );


                if (
                    activeShort
                ) {
                    return activeShort;
                }
            }


            const moviePlayerVideo =
                document.querySelector(
                    "#movie_player video"
                ) ||
                document.querySelector(
                    "video.html5-main-video"
                );


            if (
                moviePlayerVideo
            ) {
                return moviePlayerVideo;
            }
        }


        const videos =
            document.querySelectorAll(
                "video"
            );


        if (
            videos.length ===
                1
        ) {
            return videos[0];
        }


        if (
            videos.length ===
                0
        ) {
            return null;
        }


        let best =
            null;

        let bestArea =
            0;


        for (
            const video
            of videos
        ) {
            const rect =
                video.getBoundingClientRect();


            const area =
                Math.max(
                    0,
                    rect.width
                ) *
                Math.max(
                    0,
                    rect.height
                );


            if (
                area > bestArea
            ) {
                best =
                    video;

                bestArea =
                    area;
            }
        }


        return best;
    }


    function getPlaybackSnapshot() {
        const video =
            getPrimaryVideo();


        if (
            !video
        ) {
            return {
                playbackState:
                    "unknown",

                currentTime:
                    null,

                duration:
                    null
            };
        }


        const currentTime =
            Number.isFinite(
                video.currentTime
            )
                ? Math.max(
                    0,
                    video.currentTime
                )
                : null;


        const duration =
            Number.isFinite(
                video.duration
            ) &&
            video.duration > 0
                ? video.duration
                : null;


        let playbackState =
            "unknown";


        if (
            video.ended
        ) {
            playbackState =
                "ended";

        } else if (
            video.paused
        ) {
            playbackState =
                currentTime !== null &&
                currentTime > .25
                    ? "paused"
                    : "ready";

        } else {

            playbackState =
                "playing";
        }


        return {
            playbackState,

            currentTime,

            duration
        };
    }


    function isWatchContext(
        provider
    ) {
        const path =
            window.location.pathname;


        if (
            provider ===
            "youtube"
        ) {
            return (
                path ===
                "/watch"
            );
        }


        if (
            provider ===
            "netflix"
        ) {
            return path.startsWith(
                "/watch/"
            );
        }


        if (
            provider ===
            "crunchyroll"
        ) {
            return path.startsWith(
                "/watch/"
            );
        }


        if (
            provider ===
            "disney"
        ) {
            return (
                (
                    path.includes(
                        "/video/"
                    ) ||
                    path.includes(
                        "/play/"
                    )
                ) &&
                Boolean(
                    getPrimaryVideo()
                )
            );
        }


        if (
            provider ===
            "prime"
        ) {
            return (
                (
                    path.includes(
                        "/detail/"
                    ) ||
                    path.includes(
                        "/gp/video/detail/"
                    )
                ) &&
                Boolean(
                    getPrimaryVideo()
                )
            );
        }


        return false;
    }


    function getPrimeProviderTitle() {
        const direct =
            getTextFromSelectors([
                '.atvwebplayersdk-title-text',
                'h1[data-automation-id="title"]',
                '.atvwebplayersdk-player-container h1',
                '#dv-web-player h1'
            ]);


        const imageAlt =
            getAttributeFromSelectors([
                '.DVWebNode-detail-atf-wrapper picture img',
                'main div[data-automation-id="hero-background"] img'
            ], "alt");


        for (
            const candidate
            of [
                direct,
                imageAlt
            ]
        ) {
            const cleaned =
                cleanProviderTitle(
                    candidate,
                    "prime"
                );


            if (
                cleaned &&
                !isGenericProviderTitle(
                    cleaned,
                    "prime"
                )
            ) {
                return cleaned;
            }
        }


        return "";
    }


    function getCrunchyrollProviderTitle() {
        const direct =
            getTextFromSelectors([
                '.show-title-link',
                '[data-t="show-title-link"]',
                'a[href*="/series/"] > h4',
                'a[href*="/series/"] h4'
            ]);


        if (
            direct
        ) {
            return cleanProviderTitle(
                direct,
                "crunchyroll"
            );
        }


        const seriesLinks =
            document.querySelectorAll(
                'a[href*="/series/"]'
            );


        for (
            const link
            of seriesLinks
        ) {
            const text =
                String(
                    link.querySelector(
                        "h4"
                    )?.textContent ||
                    link.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();


            if (
                text.length >= 2 &&
                text.length <= 160
            ) {
                return cleanProviderTitle(
                    text,
                    "crunchyroll"
                );
            }
        }


        const scripts =
            document.head?.querySelectorAll(
                'script[type="application/ld+json"]'
            ) || [];


        for (
            const script
            of scripts
        ) {
            try {
                const data =
                    JSON.parse(
                        script.textContent ||
                        "null"
                    );


                const items =
                    Array.isArray(
                        data
                    )
                        ? data
                        : [data];


                for (
                    const item
                    of items
                ) {
                    const seriesName =
                        item?.partOfSeries?.name ||
                        item?.partOfSeries?.headline ||
                        item?.partOfSeries?.alternateName ||
                        "";


                    if (
                        String(
                            seriesName
                        ).trim()
                    ) {
                        return cleanProviderTitle(
                            seriesName,
                            "crunchyroll"
                        );
                    }
                }
            } catch {
            }
        }


        const metadataTitle =
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            getMetaContent(
                'meta[name="twitter:title"]'
            ) ||
            getMetaContent(
                'meta[name="title"]'
            );


        if (
            metadataTitle
        ) {
            return cleanProviderTitle(
                metadataTitle,
                "crunchyroll"
            );
        }


        return cleanProviderTitle(
            document.title,
            "crunchyroll"
        );
    }


    function getYouTubeProviderTitle() {
        const currentVideoId =
            typeof getYouTubeVideoId ===
                "function"
                ? getYouTubeVideoId()
                : "";


        const isWatchPage =
            window.location.pathname ===
                "/watch";


        if (
            isWatchPage &&
            currentVideoId
        ) {
            /*
             * Playlist/autoplay transitions can update /watch?v= before
             * the visible watch metadata has switched to the new video.
             * Never cache a title until the DOM explicitly belongs to the
             * current video ID. The player-title link is checked first
             * because it usually flips with the player itself; ytd-watch-
             * flexy's video-id is the authoritative DOM readiness guard.
             */
            const playerTitleLink =
                document.querySelector(
                    "#movie_player .ytp-title-link"
                );


            if (
                playerTitleLink
            ) {
                const playerTitle =
                    String(
                        playerTitleLink.textContent ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                const playerHref =
                    String(
                        playerTitleLink.getAttribute(
                            "href"
                        ) ||
                        ""
                    ).trim();


                try {
                    const playerUrl =
                        new URL(
                            playerHref,
                            window.location.href
                        );


                    const playerVideoId =
                        String(
                            playerUrl.searchParams.get(
                                "v"
                            ) ||
                            ""
                        ).trim();


                    if (
                        playerTitle &&
                        playerVideoId ===
                            currentVideoId
                    ) {
                        return playerTitle;
                    }


                    if (
                        playerVideoId &&
                        playerVideoId !==
                            currentVideoId
                    ) {
                        return "";
                    }

                } catch {
                }
            }


            const escapedVideoId =
                typeof CSS?.escape ===
                    "function"
                    ? CSS.escape(
                        currentVideoId
                    )
                    : currentVideoId;


            const watchContainer =
                document.querySelector(
                    `ytd-watch-flexy[video-id="${escapedVideoId}"]`
                );


            if (
                !watchContainer
            ) {
                return "";
            }


            const selectors = [
                "h1.ytd-watch-metadata yt-formatted-string",
                "h1 yt-formatted-string.ytd-watch-metadata",
                "#title h1 yt-formatted-string"
            ];


            for (
                const selector
                of selectors
            ) {
                const elements =
                    watchContainer.querySelectorAll(
                        selector
                    );


                for (
                    const element
                    of elements
                ) {
                    const text =
                        String(
                            element.textContent ||
                            ""
                        )
                            .replace(
                                /\s+/g,
                                " "
                            )
                            .trim();


                    if (
                        text.length >= 2 &&
                        text.length <= 220
                    ) {
                        return text;
                    }
                }
            }


            return "";
        }


        return (
            getTextFromSelectors([
                "h1.ytd-watch-metadata yt-formatted-string",
                "h1 yt-formatted-string.ytd-watch-metadata",
                "#title h1 yt-formatted-string"
            ]) ||
            getMetaContent(
                'meta[name="title"]'
            ) ||
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            document.title
        );
    }

    async function getProviderTitle(
        provider
    ) {
        let title =
            "";


        if (
            provider ===
            "youtube"
        ) {
            title =
                getYouTubeProviderTitle();
        }


        if (
            provider ===
            "netflix"
        ) {
            title =
                await getNetflixProviderTitle();
        }


        if (
            provider ===
            "prime"
        ) {
            title =
                getPrimeProviderTitle();
        }


        if (
            provider ===
            "disney"
        ) {
            title =
                getTextFromSelectors([
                    '[data-testid="title"]',
                    '[class*="player"] h1',
                    '[class*="Player"] h1'
                ]) ||
                getMetaContent(
                    'meta[property="og:title"]'
                ) ||
                document.title;
        }


        if (
            provider ===
            "crunchyroll"
        ) {
            title =
                getCrunchyrollProviderTitle();
        }


        title =
            cleanProviderTitle(
                title,
                provider
            );


        if (
            provider ===
                "netflix"
        ) {
            title =
                compactNetflixNowPlayingTitle(
                    title
                );
        }


        return title;
    }




    function parseYouTubeVoteCount(value) {
        const raw = String(value || "")
            .replace(/[\u00a0\u202f]/g, " ")
            .trim();

        if (!raw) {
            return null;
        }

        const match = raw.match(/([0-9][0-9.,]*)\s*([KMBT])?/i);
        if (!match) {
            return null;
        }

        const suffix = String(match[2] || "").toUpperCase();
        let numeric = match[1];
        let parsed = NaN;

        if (suffix) {
            const lastComma = numeric.lastIndexOf(",");
            const lastDot = numeric.lastIndexOf(".");
            const decimalIndex = Math.max(lastComma, lastDot);

            if (decimalIndex >= 0) {
                numeric = numeric
                    .slice(0, decimalIndex)
                    .replace(/[.,]/g, "") +
                    "." +
                    numeric.slice(decimalIndex + 1).replace(/[.,]/g, "");
            }

            parsed = Number(numeric);
            const multiplier = {
                K: 1e3,
                M: 1e6,
                B: 1e9,
                T: 1e12
            }[suffix] || 1;

            parsed *= multiplier;
        } else {
            parsed = Number(numeric.replace(/[.,]/g, ""));
        }

        return Number.isFinite(parsed) && parsed >= 0
            ? parsed
            : null;
    }

    function getYouTubeRydLikeRatio() {
        // Return YouTube Dislike already exposes its resolved vote counts in
        // #ryd-dislike-tooltip as "likes / dislikes". Read that finished
        // result directly instead of trying to rediscover YouTube's current
        // like/dislike button implementation.
        const tooltip =
            document.querySelector(
                "#ryd-dislike-tooltip"
            );

        const tooltipText =
            String(
                tooltip?.textContent ||
                ""
            ).trim();

        if (tooltipText) {
            const parts =
                tooltipText.split(
                    "/"
                );

            if (parts.length >= 2) {
                const likes =
                    parseYouTubeVoteCount(
                        parts[0]
                    );

                const dislikes =
                    parseYouTubeVoteCount(
                        parts[1]
                    );

                if (
                    Number.isFinite(likes) &&
                    Number.isFinite(dislikes) &&
                    likes >= 0 &&
                    dislikes >= 0 &&
                    likes + dislikes > 0
                ) {
                    return Math.round(
                        (likes / (likes + dislikes)) * 1000
                    ) / 10;
                }
            }
        }

        // RYD also publishes the final like percentage as the width of its
        // own ratio bar. This is a safe secondary source when the tooltip is
        // temporarily absent during YouTube SPA navigation.
        const bar =
            document.querySelector(
                "#ryd-bar"
            );

        const width =
            Number.parseFloat(
                String(
                    bar?.style?.width ||
                    ""
                )
            );

        if (
            Number.isFinite(width) &&
            width >= 0 &&
            width <= 100
        ) {
            return Math.round(width * 10) / 10;
        }

        return null;
    }



    async function getProviderArtwork(
        provider
    ) {
        if (
            provider ===
            "youtube"
        ) {
            const url =
                new URL(
                    window.location.href
                );


            const videoId =
                url.searchParams.get(
                    "v"
                );


            if (
                videoId
            ) {
                return `https://i.ytimg.com/vi/${encodeURIComponent(
                    videoId
                )}/hqdefault.jpg`;
            }
        }


        const video =
            getPrimaryVideo();


        const providerArtwork =
            provider ===
                "prime"
                ? getAttributeFromSelectors([
                    'main div[data-automation-id="hero-background"] img',
                    '.DVWebNode-detail-atf-wrapper picture img'
                ], "src")
                : "";


        const candidates = [
            providerArtwork,
            video?.poster,
            getMetaContent(
                'meta[property="og:image"]'
            ),
            getMetaContent(
                'meta[name="twitter:image"]'
            ),
            getMetaContent(
                'meta[property="twitter:image"]'
            )
        ];


        for (
            const candidate
            of candidates
        ) {
            const value =
                String(
                    candidate ||
                    ""
                ).trim();


            if (
                /^https?:\/\//i.test(
                    value
                )
            ) {
                return value;
            }
        }


        return "";
    }


    /*
     * ============================================================
     * PROVIDER API CORE
     * ============================================================
     * Stable shell-facing contract above provider DOM details.
     * Shared contract, adapter registry and generic playback primitives.
     * Provider-specific DOM/state belongs in dedicated provider adapters.
     */

    const STREAM_SHELL_PROVIDER_API_VERSION = 1;
    const CONTINUE_WATCHING_STORAGE_KEY = "streamShellContinueWatching";
    const CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY = "streamShellContinueWatchingCompletePercent";
    const CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT = 95;
    const CONTINUE_WATCHING_MAX_ITEMS = 50;
    let continueWatchingCompletePercent = CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT;
    const PENDING_RESUME_KEY_PREFIX = "streamShellPendingResume_";

    const providerApiListeners = new Map();
    const providerAdapterFactories = new Map();
    const providerAdapterInstances = new Map();
    let providerApiStarted = false;
    let providerApiProgressEventAt = 0;
    let providerApiSelfTestTimer = null;
    let providerApiResumeRunning = false;
    let providerApiLastLaunchSelfTestStartedAt = null;
    let providerApiLastResumeFlightKey = "";
    let providerApiResumeGeneration = 0;

    function normalizeContinueWatchingCompletePercent(
        value,
        fallback = CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
    ) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(1, Math.min(100, Math.round(numeric)));
    }

    function setContinueWatchingCompletePercent(value) {
        continueWatchingCompletePercent = normalizeContinueWatchingCompletePercent(
            value,
            CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
        );
        return continueWatchingCompletePercent;
    }

    async function initializeContinueWatchingCompletePercent() {
        try {
            const stored = await chrome.storage.local.get(
                CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY
            );
            return setContinueWatchingCompletePercent(
                stored[CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY]
            );
        } catch {
            return setContinueWatchingCompletePercent(
                CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
            );
        }
    }

    function providerApiOn(type, listener) {
        if (typeof listener !== "function") return () => {};
        const listeners = providerApiListeners.get(type) || new Set();
        listeners.add(listener);
        providerApiListeners.set(type, listeners);
        return () => listeners.delete(listener);
    }

    function providerApiEmit(type, detail = {}) {
        const listeners = providerApiListeners.get(type);
        if (!listeners) return;
        for (const listener of [...listeners]) {
            try {
                listener(detail);
            } catch {
            }
        }
    }

    function registerProviderAdapter(provider, factory) {
        if (!provider || !PROVIDERS[provider] || typeof factory !== "function") {
            return false;
        }

        providerAdapterFactories.set(provider, factory);
        providerAdapterInstances.delete(provider);
        return true;
    }

    function providerApiNotifyExtensionChange(name, detail = {}) {
        const provider = getCurrentProvider();
        if (!provider) return;

        providerApiEmit("extensionchange", {
            provider,
            name: String(name || "unknown"),
            ...detail
        });

        scheduleProviderApiSelfTest(`extension:${String(name || "unknown")}`, 350);
    }


    function makeCapability(supported, available, state = null, detail = null) {
        return {
            supported: supported === true,
            available: supported === true && available === true,
            state: state === undefined ? null : state,
            detail: detail === undefined ? null : detail
        };
    }


    function getProviderCapabilities(provider, adapter = null) {
        const video = getPrimaryVideo();
        const playback = getPlaybackSnapshot();
        const watchContext = Boolean(provider && isWatchContext(provider));
        const hasDuration = Number.isFinite(playback.duration) && playback.duration > 0;

        return {
            common: {
                watchContext: makeCapability(true, watchContext, watchContext ? "active" : "inactive"),
                playback: makeCapability(true, Boolean(video), playback.playbackState),
                seek: makeCapability(true, Boolean(video) && hasDuration, Boolean(video) && hasDuration ? "ready" : "unavailable"),
                progress: makeCapability(true, Boolean(video) && hasDuration && Number.isFinite(playback.currentTime), Boolean(video) && hasDuration ? "ready" : "unavailable"),
                volume: makeCapability(true, Boolean(video), video ? "ready" : "unavailable"),
                playbackRate: makeCapability(true, Boolean(video), video ? "ready" : "unavailable"),
                resume: makeCapability(
                    true,
                    watchContext && Boolean(video) && hasDuration,
                    watchContext && Boolean(video) && hasDuration ? "ready" : "waiting",
                    adapter?.resumeStrategy || "pending-seek"
                ),
                linkResolver: makeCapability(
                    true,
                    typeof adapter?.resolveMediaUrl === "function",
                    typeof adapter?.resolveMediaUrl === "function" ? "ready" : "unavailable",
                    adapter?.linkResolverStrategy || "identity + canonical fallback"
                )
            },
            extensions: typeof adapter?.getExtensionCapabilities === "function"
                ? adapter.getExtensionCapabilities({
                    watchContext,
                    video,
                    playback
                })
                : {}
        };
    }

    async function getProviderMediaSnapshot(
        provider = getCurrentProvider(),
        adapter = null
    ) {
        const resolvedAdapter = adapter || getProviderAdapter(provider);
        const watchContext = resolvedAdapter?.isWatchContext?.() === true;
        if (!provider || !watchContext) return null;

        const title = await (
            typeof resolvedAdapter?.getTitle === "function"
                ? resolvedAdapter.getTitle()
                : getProviderTitle(provider)
        );
        if (!title) return null;

        const image = await (
            typeof resolvedAdapter?.getArtwork === "function"
                ? resolvedAdapter.getArtwork()
                : getProviderArtwork(provider)
        );
        const playback = typeof resolvedAdapter?.getPlayback === "function"
            ? resolvedAdapter.getPlayback()
            : getPlaybackSnapshot();

        const resumeUrl = typeof resolvedAdapter?.getResumeUrl === "function"
            ? resolvedAdapter.getResumeUrl()
            : normalizeProviderResumeUrl(provider, window.location.href);

        return {
            provider,
            title,
            image,
            url: resumeUrl || normalizeProviderResumeUrl(provider, window.location.href),
            identity: resolvedAdapter?.getIdentity?.() || getProviderMediaIdentity(provider, window.location.href),
            likeRatio: null,
            ...playback
        };
    }

    async function providerApiPlay() {
        const video = getPrimaryVideo();
        if (!video) return false;
        await video.play();
        return true;
    }

    function providerApiPause() {
        const video = getPrimaryVideo();
        if (!video) return false;
        video.pause();
        return true;
    }

    function providerApiSeekTo(seconds) {
        const video = getPrimaryVideo();
        const value = Number(seconds);
        if (!video || !Number.isFinite(value)) return false;
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
        video.currentTime = Math.max(0, duration ? Math.min(value, Math.max(0, duration - .25)) : value);
        return true;
    }

    function providerApiSeekBy(seconds) {
        const video = getPrimaryVideo();
        return video ? providerApiSeekTo(video.currentTime + Number(seconds || 0)) : false;
    }

    function providerApiSetVolume(value) {
        const video = getPrimaryVideo();
        const numeric = Number(value);
        if (!video || !Number.isFinite(numeric)) return false;
        video.volume = Math.max(0, Math.min(1, numeric));
        return true;
    }

    function providerApiToggleMute() {
        const video = getPrimaryVideo();
        if (!video) return false;
        video.muted = !video.muted;
        return video.muted;
    }

    function providerApiSetPlaybackRate(value) {
        const video = getPrimaryVideo();
        const numeric = Number(value);
        if (!video || !Number.isFinite(numeric) || numeric <= 0) return false;

        video.playbackRate = numeric;

        try {
            video.defaultPlaybackRate = numeric;
        } catch {
        }

        return true;
    }

    function createBaseProviderAdapter(provider) {
        const adapter = {
            id: provider,
            label: PROVIDERS[provider].label,
            apiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
            adapterKind: "generic",
            getUrl: () => window.location.href,
            getResumeUrl: () => normalizeProviderResumeUrl(provider, window.location.href),
            getIdentity: () => getProviderMediaIdentity(provider, window.location.href),
            linkResolverStrategy: "identity + canonical fallback",
            resolveMediaUrl: (identity, fallbackUrl = "") =>
                resolveProviderMediaLink(
                    provider,
                    identity,
                    fallbackUrl,
                    window.location.origin
                ),
            isWatchContext: () => isWatchContext(provider),
            getTitle: () => getProviderTitle(provider),
            getArtwork: () => getProviderArtwork(provider),
            getPlayback: () => getPlaybackSnapshot(),
            getMediaSnapshot: () => getProviderMediaSnapshot(provider),
            play: providerApiPlay,
            pause: providerApiPause,
            seekTo: providerApiSeekTo,
            seekBy: providerApiSeekBy,
            setVolume: providerApiSetVolume,
            toggleMute: providerApiToggleMute,
            setPlaybackRate: providerApiSetPlaybackRate,
            extensions: {},
            getExtensionState: () => null
        };

        adapter.getCapabilities = () => getProviderCapabilities(provider, adapter);
        return adapter;
    }

    function getProviderAdapter(provider = getCurrentProvider()) {
        if (!provider || !PROVIDERS[provider]) return null;

        if (providerAdapterInstances.has(provider)) {
            return providerAdapterInstances.get(provider);
        }

        const baseAdapter = createBaseProviderAdapter(provider);
        const factory = providerAdapterFactories.get(provider);
        let adapter = baseAdapter;

        if (factory) {
            try {
                adapter = factory(baseAdapter) || baseAdapter;
            } catch {
                adapter = baseAdapter;
            }
        }

        adapter.id = provider;
        adapter.label = adapter.label || PROVIDERS[provider].label;
        adapter.apiVersion = STREAM_SHELL_PROVIDER_API_VERSION;
        adapter.adapterKind = String(adapter.adapterKind || "generic");
        adapter.getCapabilities = typeof adapter.getCapabilities === "function"
            ? adapter.getCapabilities
            : () => getProviderCapabilities(provider, adapter);
        adapter.extensions = adapter.extensions || {};

        providerAdapterInstances.set(provider, adapter);

        recordProviderFlightEvent("initialized", {
            category: "adapter",
            provider,
            detail: {
                adapterKind: adapter.adapterKind,
                apiVersion: adapter.apiVersion
            }
        });

        return adapter;
    }

    /*
     * ============================================================
     * PER-PROVIDER SAFE MODE
     * ============================================================
     * Isolation switch for provider-specific DOM/UI manipulation.
     * Provider API, Continue/Resume, Now Playing and other shell basics
     * remain alive so Diagnostics can distinguish provider failures from
     * Stream Shell presentation/automation failures.
     */
    const PROVIDER_SAFE_MODE_KEY_PREFIX = "streamShellProviderSafeMode_";
    const PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE = "data-stream-shell-safe-mode";

    let providerSafeModeProvider = null;
    let providerSafeModeEnabled = false;
    let providerSafeModeInitialized = false;
    let providerSafeModeStorageBound = false;
    let providerSafeModeChangedAt = null;

    function getProviderSafeModeStorageKey(provider) {
        return `${PROVIDER_SAFE_MODE_KEY_PREFIX}${provider}`;
    }

    function isProviderSafeModeEnabled(provider = getCurrentProvider()) {
        return Boolean(
            provider &&
            providerSafeModeInitialized &&
            providerSafeModeProvider === provider &&
            providerSafeModeEnabled
        );
    }

    function getProviderSafeModeState(provider = getCurrentProvider()) {
        return {
            supported: Boolean(provider && PROVIDERS[provider]),
            provider: provider || null,
            enabled: isProviderSafeModeEnabled(provider),
            initialized: providerSafeModeInitialized,
            storageKey: provider ? getProviderSafeModeStorageKey(provider) : null,
            changedAt: providerSafeModeChangedAt
        };
    }

    function setProviderSafeModeMarker(provider, enabled) {
        const root = document.documentElement;
        if (!root) return;

        if (enabled) {
            root.setAttribute(PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE, provider);
        } else {
            root.removeAttribute(PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE);
        }
    }

    function clearGenericSubtitleSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        root.removeAttribute("data-stream-shell-subtitle-override");
        root.removeAttribute("data-stream-shell-subtitle-font-override");
        root.removeAttribute("data-stream-shell-subtitle-provider");
        root.style.removeProperty("--stream-shell-subtitle-scale");
        root.style.removeProperty("--stream-shell-subtitle-color");
        root.style.removeProperty("--stream-shell-subtitle-font");
    }

    function clearPrimeSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        for (const attribute of [
            "data-stream-shell-prime-ui-fix",
            "data-stream-shell-prime-hide-xray",
            "data-stream-shell-prime-hide-overlay",
            "data-stream-shell-prime-subtitles"
        ]) {
            root.removeAttribute(attribute);
        }

        root.style.removeProperty("--stream-shell-prime-subtitle-scale");
        root.style.removeProperty("--stream-shell-prime-subtitle-color");
        root.style.removeProperty("--stream-shell-prime-subtitle-font");
    }

    function clearYouTubeSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        root.removeAttribute("data-stream-shell-youtube-theme");
        root.removeAttribute("data-stream-shell-youtube-extras");
        root.removeAttribute("data-stream-shell-youtube-top-ui");

        if (typeof YOUTUBE_CLEANUP_SETTINGS === "object") {
            for (const attribute of Object.values(YOUTUBE_CLEANUP_SETTINGS)) {
                root.removeAttribute(attribute);
            }
        }

        try { clearYouTubeTopUiTimer(); } catch {}
        try { restoreYouTubeTheaterModeIfNeeded(); } catch {}
        try { clearYouTubeTextCleanupTargets(); } catch {}
        try { restoreYouTubeUploadDate(); } catch {}
        try { clearYouTubeShortsLikeIcons(); } catch {}

        const video = getPrimaryVideo();
        if (video) {
            try {
                video.loop = location.pathname.startsWith("/shorts/");
            } catch {
            }
        }
    }

    function clearProviderInvasiveState(provider) {
        try { syncWindowedPlayerMode(provider, false); } catch {}
        clearGenericSubtitleSafeModeState();
        try { syncPlaybackUtilities(provider); } catch {}

        if (provider === "youtube") {
            clearYouTubeSafeModeState();
            try { disconnectYouTubeRuntimeObservers(); } catch {}
            try { clearYouTubeUtilityDomTimer(); } catch {}
            try { cancelYouTubeUtilitySettlePasses(); } catch {}
            return;
        }

        if (provider === "netflix") {
            document.documentElement?.removeAttribute(
                "data-stream-shell-netflix-wallpaper"
            );
            try { syncNetflixEnhancementObserver(); } catch {}
            return;
        }

        if (provider === "prime") {
            clearPrimeSafeModeState();
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
            return;
        }

        if (provider === "crunchyroll") {
            const root = document.documentElement;
            root?.removeAttribute(
                "data-stream-shell-crunchyroll-blur-thumbnails"
            );
        }
    }

    async function restoreProviderInvasiveState(provider) {
        try {
            if (WINDOWED_PLAYER_PROVIDERS.has(provider)) {
                const storageKey = getWindowedPlayerStorageKey(provider);
                const stored = await chrome.storage.local.get(storageKey);
                syncWindowedPlayerMode(provider, stored[storageKey] === true);
            }
        } catch {
        }

        try { syncPlaybackUtilities(provider); } catch {}

        if (provider === "youtube") {
            try { setYouTubeThemeMarker(); } catch {}
            try { syncYouTubeCleanupMarkers(); } catch {}
            try { syncYouTubeRuntimeObservers(); } catch {}
            try { handleYouTubeUtilityNavigation(); } catch {}
        } else if (provider === "netflix") {
            try { syncNetflixEnhancementObserver(); } catch {}
            try { runNetflixEnhancements(); } catch {}
        } else if (provider === "prime") {
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
        } else if (provider === "crunchyroll") {
            try {
                const adapter = getProviderAdapter("crunchyroll");
                adapter?.extensions?.enhancements?.syncSettings?.();
                await adapter?.extensions?.skipEvents?.load?.(true);
            } catch {
            }
        } else if (provider === "disney") {
            try {
                getProviderAdapter("disney")
                    ?.extensions
                    ?.subtitleStyling
                    ?.sync?.(playbackUtilitySettings);
            } catch {
            }
        }
    }

    async function applyProviderSafeModeState(provider, enabled, reason = "runtime") {
        const next = enabled === true;
        const wasInitialized = providerSafeModeInitialized;
        const changed = providerSafeModeProvider !== provider ||
            providerSafeModeEnabled !== next ||
            !wasInitialized;

        providerSafeModeProvider = provider;
        providerSafeModeEnabled = next;
        providerSafeModeInitialized = true;
        if (changed) providerSafeModeChangedAt = Date.now();

        setProviderSafeModeMarker(provider, next);

        if (next) {
            clearProviderInvasiveState(provider);
        } else if (changed && wasInitialized) {
            await restoreProviderInvasiveState(provider);
        }

        if (changed && (wasInitialized || next)) {
            recordProviderFlightEvent(next ? "enabled" : "disabled", {
                category: "safe-mode",
                provider,
                detail: { reason }
            });

            try {
                providerApiNotifyExtensionChange("safeMode", {
                    enabled: next,
                    reason
                });
            } catch {
            }
        }

        return getProviderSafeModeState(provider);
    }

    async function initializeProviderSafeMode() {
        const provider = getCurrentProvider();
        if (!provider) return getProviderSafeModeState(null);

        const storageKey = getProviderSafeModeStorageKey(provider);
        let enabled = false;

        try {
            const stored = await chrome.storage.local.get(storageKey);
            enabled = stored[storageKey] === true;
        } catch {
        }

        await applyProviderSafeModeState(provider, enabled, "startup");

        if (!providerSafeModeStorageBound) {
            providerSafeModeStorageBound = true;
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (
                    areaName !== "local" ||
                    !Object.prototype.hasOwnProperty.call(changes, storageKey)
                ) {
                    return;
                }

                applyProviderSafeModeState(
                    provider,
                    changes[storageKey]?.newValue === true,
                    "settings"
                ).catch(() => {});
            });
        }

        return getProviderSafeModeState(provider);
    }
    /*
     * ============================================================
     * RESOURCE GOVERNOR V2
     * ============================================================
     * Adaptive pacing for Stream Shell's own polling/DOM work. Provider
     * windows remain open; only our loops and observers are slowed or parked
     * when a provider is inactive, hidden/minimized, outside watch context or
     * paused. Event-driven playback/resume commands stay immediate.
     */

    const PROVIDER_RESOURCE_PROFILES = {
        "foreground-playing": {
            poll: 1,
            metadata: 1,
            navigation: 1,
            dom: 1,
            visual: 1
        },
        "foreground-paused": {
            poll: 1.6,
            metadata: 1.8,
            navigation: 1.25,
            dom: 1.5,
            visual: 1
        },
        "idle-visible": {
            poll: 2.5,
            metadata: 3,
            navigation: 1.6,
            dom: 2.5,
            visual: 1.5
        },
        "background-playing": {
            poll: 2.5,
            metadata: 2.75,
            navigation: 2,
            dom: 1.75,
            visual: 8
        },
        "sleeping": {
            poll: 8,
            metadata: 8,
            navigation: 4,
            dom: 8,
            visual: 12
        }
    };

    let providerResourceGovernorWindowState = {
        managed: true,
        provider: null,
        windowId: null,
        windowState: null,
        minimized: false,
        focused: false,
        shellActive: true,
        activeProvider: null,
        leftMode: null
    };

    let providerResourceGovernorState = null;
    let providerResourceGovernorStarted = false;
    let providerResourceGovernorLastFlightSignature = "";
    const providerResourceGovernorListeners = new Set();
    const providerResourceGovernorWorkloads = new Map();

    function getProviderResourceGovernorMode({
        visible,
        watchContext,
        playing
    }) {
        if (!visible) {
            return playing && watchContext
                ? "background-playing"
                : "sleeping";
        }

        if (!watchContext) {
            return "idle-visible";
        }

        return playing
            ? "foreground-playing"
            : "foreground-paused";
    }

    function computeProviderResourceGovernorState(
        reason = "state"
    ) {
        const provider = getCurrentProvider();
        const adapter = provider
            ? getProviderAdapter(provider)
            : null;
        const video = getPrimaryVideo();
        const watchContext = adapter?.isWatchContext?.() === true;
        const playing = Boolean(
            video &&
            video.paused !== true &&
            video.ended !== true
        );
        const documentVisible = document.visibilityState !== "hidden";
        const minimized = providerResourceGovernorWindowState.minimized === true;
        const shellActive = providerResourceGovernorWindowState.shellActive !== false;
        const visible = documentVisible && !minimized && shellActive;
        const focused = Boolean(
            providerResourceGovernorWindowState.focused === true ||
            document.hasFocus?.()
        );
        const mode = getProviderResourceGovernorMode({
            visible,
            watchContext,
            playing
        });
        const domObserversAllowed = Boolean(
            visible ||
            (watchContext && playing)
        );
        const visualWorkAllowed = visible === true;
        const profile = PROVIDER_RESOURCE_PROFILES[mode] ||
            PROVIDER_RESOURCE_PROFILES["foreground-playing"];

        return {
            provider: provider || null,
            mode,
            reason: String(reason || "state"),
            documentVisible,
            visible,
            minimized,
            focused,
            shellActive,
            watchContext,
            playing,
            domObserversAllowed,
            visualWorkAllowed,
            paused: Boolean(video && !playing),
            videoPresent: Boolean(video),
            profile: { ...profile },
            windowState: providerResourceGovernorWindowState.windowState || null,
            windowId: providerResourceGovernorWindowState.windowId || null,
            activeProvider: providerResourceGovernorWindowState.activeProvider || null,
            leftMode: providerResourceGovernorWindowState.leftMode || null,
            updatedAt: Date.now()
        };
    }

    function resourceGovernorStateSignature(state) {
        if (!state) return "";
        return JSON.stringify([
            state.mode,
            state.visible,
            state.minimized,
            state.focused,
            state.shellActive,
            state.watchContext,
            state.playing,
            state.videoPresent
        ]);
    }

    function updateProviderResourceGovernor(
        reason = "state"
    ) {
        const previous = providerResourceGovernorState;
        const next = computeProviderResourceGovernorState(reason);
        const previousSignature = resourceGovernorStateSignature(previous);
        const nextSignature = resourceGovernorStateSignature(next);

        providerResourceGovernorState = next;

        document.documentElement?.setAttribute(
            "data-stream-shell-resource-mode",
            next.mode
        );

        if (previousSignature === nextSignature) {
            return next;
        }

        for (const listener of [...providerResourceGovernorListeners]) {
            try {
                listener(next, previous);
            } catch {
            }
        }

        const flightSignature = JSON.stringify([
            next.mode,
            next.minimized,
            next.shellActive,
            next.watchContext,
            next.playing
        ]);

        if (
            next.provider &&
            flightSignature !== providerResourceGovernorLastFlightSignature
        ) {
            providerResourceGovernorLastFlightSignature = flightSignature;
            recordProviderFlightEvent("state-changed", {
                category: "resource-governor",
                provider: next.provider,
                detail: {
                    mode: next.mode,
                    minimized: next.minimized,
                    shellActive: next.shellActive,
                    watchContext: next.watchContext,
                    playing: next.playing,
                    reason: next.reason
                }
            });
        }

        return next;
    }

    function getProviderResourceGovernorState() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("snapshot");

        return {
            ...state,
            profile: { ...state.profile },
            workloads: [...providerResourceGovernorWorkloads.values()]
                .map(workload => ({ ...workload }))
        };
    }

    function onProviderResourceGovernorChange(listener) {
        if (typeof listener !== "function") return () => {};
        providerResourceGovernorListeners.add(listener);
        return () => providerResourceGovernorListeners.delete(listener);
    }

    function getProviderResourceDelay(
        baseMs,
        workload = "poll"
    ) {
        const base = Math.max(25, Number(baseMs) || 25);
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("delay");
        const multiplier = Number(state.profile?.[workload]) || 1;
        return Math.max(
            25,
            Math.min(15000, Math.round(base * multiplier))
        );
    }

    function shouldProviderResourceObserveDom() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("observer");

        /*
         * Keep automation responsive while media is actually playing, even
         * in a background provider. A hidden/minimized paused provider can
         * drop broad DOM observers entirely until state changes again.
         */
        return state.domObserversAllowed === true;
    }

    function shouldProviderResourceRunVisualWork() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("visual");
        return state.visualWorkAllowed === true;
    }

    function createProviderResourceLoop(
        name,
        callback,
        baseMs,
        workload = "poll",
        {
            immediate = false
        } = {}
    ) {
        let timer = null;
        let stopped = false;
        let running = false;
        const key = String(name || "loop");

        const workloadState = {
            name: key,
            kind: String(workload || "poll"),
            baseMs: Math.max(25, Number(baseMs) || 25),
            delayMs: null,
            lastRunAt: null
        };

        providerResourceGovernorWorkloads.set(key, workloadState);

        const schedule = delayOverride => {
            if (stopped) return;
            if (timer) clearTimeout(timer);

            const delayMs = Number.isFinite(delayOverride)
                ? Math.max(0, delayOverride)
                : getProviderResourceDelay(
                    workloadState.baseMs,
                    workloadState.kind
                );

            workloadState.delayMs = delayMs;
            timer = setTimeout(tick, delayMs);
        };

        const tick = async () => {
            timer = null;
            if (stopped || running) {
                if (!stopped) schedule();
                return;
            }

            running = true;
            workloadState.lastRunAt = Date.now();
            try {
                await callback();
            } catch {
            } finally {
                running = false;
                schedule();
            }
        };

        const unsubscribe = onProviderResourceGovernorChange(
            () => schedule(0)
        );

        const handle = {
            stop() {
                stopped = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                unsubscribe();
                providerResourceGovernorWorkloads.delete(key);
            },
            wake() {
                schedule(0);
            }
        };

        schedule(immediate ? 0 : undefined);
        return handle;
    }

    async function refreshProviderResourceWindowState(
        reason = "background"
    ) {
        try {
            const state = await chrome.runtime.sendMessage({
                type: "provider-resource-state"
            });

            if (state?.managed === true) {
                providerResourceGovernorWindowState = {
                    ...providerResourceGovernorWindowState,
                    ...state
                };
            }
        } catch {
        }

        return updateProviderResourceGovernor(reason);
    }

    function startProviderResourceGovernor() {
        if (providerResourceGovernorStarted) return;
        const provider = getCurrentProvider();
        if (!provider) return;

        providerResourceGovernorStarted = true;
        providerResourceGovernorWindowState.provider = provider;

        chrome.runtime.onMessage.addListener(message => {
            if (message?.type !== "stream-shell-resource-window-state") {
                return;
            }

            if (
                message.state?.provider &&
                message.state.provider !== provider
            ) {
                return;
            }

            providerResourceGovernorWindowState = {
                ...providerResourceGovernorWindowState,
                ...(message.state || {})
            };
            updateProviderResourceGovernor("window-state");
        });

        document.addEventListener(
            "visibilitychange",
            () => {
                updateProviderResourceGovernor("visibilitychange");
                refreshProviderResourceWindowState("visibilitychange")
                    .catch(() => {});
            }
        );

        window.addEventListener(
            "focus",
            () => refreshProviderResourceWindowState("focus")
                .catch(() => {}),
            true
        );

        window.addEventListener(
            "blur",
            () => refreshProviderResourceWindowState("blur")
                .catch(() => {}),
            true
        );

        for (const eventName of [
            "play",
            "pause",
            "ended",
            "loadedmetadata",
            "emptied"
        ]) {
            document.addEventListener(
                eventName,
                () => updateProviderResourceGovernor(eventName),
                true
            );
        }

        providerApiOn(
            "statechange",
            event => updateProviderResourceGovernor(
                event?.reason || "provider-state"
            )
        );

        updateProviderResourceGovernor("startup");
        refreshProviderResourceWindowState("startup")
            .catch(() => {});
    }
    /* Provider API contract/self-test reporting. */
    function flattenCapabilities(capabilities) {
        const flattened = {};
        for (const [groupName, group] of Object.entries(capabilities || {})) {
            for (const [name, value] of Object.entries(group || {})) {
                flattened[`${groupName}.${name}`] = value;
            }
        }
        return flattened;
    }

    function getProviderApiSelfTest(provider = getCurrentProvider()) {
        const adapter = getProviderAdapter(provider);
        const capabilities = adapter?.getCapabilities?.() || { common: {}, extensions: {} };
        const common = capabilities.common || {};
        const managed = document.documentElement?.getAttribute("data-stream-shell") === "true";
        const failures = [];

        if (!adapter) failures.push("adapter-missing");
        if (!managed) failures.push("managed-marker-missing");
        if (adapter && adapter.apiVersion !== STREAM_SHELL_PROVIDER_API_VERSION) failures.push("api-version-mismatch");

        const requiredMethods = [
            "getIdentity",
            "getResumeUrl",
            "resolveMediaUrl",
            "isWatchContext",
            "getMediaSnapshot",
            "getCapabilities",
            "play",
            "pause",
            "seekTo",
            "seekBy",
            "setVolume",
            "toggleMute",
            "setPlaybackRate"
        ];

        for (const method of requiredMethods) {
            if (adapter && typeof adapter[method] !== "function") {
                failures.push(`contract-missing:${method}`);
            }
        }

        const dedicatedAdapterProviders = new Set([
            "youtube",
            "netflix",
            "prime",
            "disney",
            "crunchyroll"
        ]);

        if (
            dedicatedAdapterProviders.has(provider) &&
            adapter?.adapterKind !== provider
        ) {
            failures.push(`${provider}-adapter-not-registered`);
        }

        return {
            ok: failures.length === 0,
            apiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
            provider,
            adapterKind: adapter?.adapterKind || null,
            managed,
            watchContext: adapter?.isWatchContext?.() === true,
            videoPresent: Boolean(getPrimaryVideo()),
            failures,
            capabilities: flattenCapabilities(capabilities),
            extensionState: adapter?.getExtensionState?.() || null,
            checkedAt: Date.now()
        };
    }

    async function publishProviderApiSelfTest(reason = "runtime") {
        const provider = getCurrentProvider();
        if (!provider) return;
        try {
            await chrome.runtime.sendMessage({
                type: "provider-api-self-test-report",
                provider,
                reason,
                report: getProviderApiSelfTest(provider)
            });
        } catch {
        }
    }

    function scheduleProviderApiSelfTest(reason = "runtime", delayMs = 900) {
        if (providerApiSelfTestTimer) clearTimeout(providerApiSelfTestTimer);
        providerApiSelfTestTimer = setTimeout(() => {
            providerApiSelfTestTimer = null;
            publishProviderApiSelfTest(reason);
        }, delayMs);
    }
    /* Continue Watching persistence and provider resume orchestration. */
    function normalizeContinueWatchingItem(item) {
        const provider = String(item?.provider || "");
        const url = String(item?.url || "");
        const currentTime = Number(item?.currentTime);
        const duration = Number(item?.duration);
        const progressPercent = duration > 0 && Number.isFinite(currentTime)
            ? Math.max(0, Math.min(100, currentTime / duration * 100))
            : Number(item?.progressPercent);
        return {
            id: String(item?.id || getProviderMediaIdentity(provider, url)),
            provider,
            title: String(item?.title || "").trim(),
            image: String(item?.image || "").trim(),
            url,
            currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
            duration: Number.isFinite(duration) && duration > 0 ? duration : null,
            progressPercent: Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : null,
            updatedAt: Number(item?.updatedAt) || Date.now()
        };
    }

    async function updateContinueWatching(media) {
        if (!media?.provider || !media?.title || !media?.url) return;
        const currentTime = Number(media.currentTime);
        const duration = Number(media.duration);
        if (!Number.isFinite(currentTime) || currentTime < 1 || !Number.isFinite(duration) || duration <= 0) return;

        const id = media.identity || getProviderMediaIdentity(media.provider, media.url);
        const progressPercent = Math.max(0, Math.min(100, currentTime / duration * 100));
        const stored = await chrome.storage.local.get(CONTINUE_WATCHING_STORAGE_KEY);
        const items = Array.isArray(stored[CONTINUE_WATCHING_STORAGE_KEY])
            ? stored[CONTINUE_WATCHING_STORAGE_KEY].map(normalizeContinueWatchingItem)
            : [];
        const remaining = items.filter(item => {
            if (item.id === id) return false;
            return getProviderMediaIdentity(item.provider, item.url) !== id;
        });

        if (progressPercent < continueWatchingCompletePercent) {
            remaining.unshift(normalizeContinueWatchingItem({
                id,
                provider: media.provider,
                title: media.title,
                image: media.image,
                url: media.url,
                currentTime,
                duration,
                progressPercent,
                updatedAt: Date.now()
            }));
        }

        await chrome.storage.local.set({
            [CONTINUE_WATCHING_STORAGE_KEY]: remaining.slice(0, CONTINUE_WATCHING_MAX_ITEMS)
        });
    }

    async function cancelPendingProviderResume(
        provider = getCurrentProvider(),
        reason = "manual-repair"
    ) {
        if (!provider) return false;

        providerApiResumeGeneration += 1;
        providerApiLastResumeFlightKey = "";

        try {
            await chrome.storage.local.remove(
                `${PENDING_RESUME_KEY_PREFIX}${provider}`
            );
        } catch {
            return false;
        }

        recordProviderFlightEvent("cleared", {
            category: "resume",
            provider,
            detail: { reason }
        });

        providerApiEmit("resume-cleared", { provider, reason });
        return true;
    }

    async function tryApplyPendingResume(provider = getCurrentProvider()) {
        if (!provider || providerApiResumeRunning) return false;
        providerApiResumeRunning = true;
        const key = `${PENDING_RESUME_KEY_PREFIX}${provider}`;
        const resumeGeneration = providerApiResumeGeneration;

        try {
            const stored = await chrome.storage.local.get(key);
            const pending = stored[key];
            if (!pending) return false;
            if (resumeGeneration !== providerApiResumeGeneration) return false;

            const requestedAt = Number(pending.requestedAt) || 0;
            const resumeFlightKey = `${provider}:${requestedAt}:${Number(pending.currentTime) || 0}`;
            if (resumeFlightKey !== providerApiLastResumeFlightKey) {
                providerApiLastResumeFlightKey = resumeFlightKey;
                recordProviderFlightEvent("bootstrap", {
                    category: "resume",
                    provider,
                    detail: {
                        targetTime: Number(pending.currentTime) || null,
                        ageMs: requestedAt ? Math.max(0, Date.now() - requestedAt) : null
                    }
                });
            }

            if (requestedAt && Date.now() - requestedAt > 10 * 60 * 1000) {
                recordProviderFlightEvent("failed", {
                    category: "resume",
                    level: "warn",
                    provider,
                    detail: { reason: "expired" }
                });
                await chrome.storage.local.remove(key);
                return false;
            }

            const adapter = getProviderAdapter(provider);
            const currentIdentity = adapter?.getIdentity?.() ||
                getProviderMediaIdentity(provider, window.location.href);
            if (pending.identity && pending.identity !== currentIdentity) return false;

            const target = Number(pending.currentTime);
            if (!Number.isFinite(target) || target < 1) {
                recordProviderFlightEvent("failed", {
                    category: "resume",
                    level: "warn",
                    provider,
                    detail: { reason: "invalid-target" }
                });
                await chrome.storage.local.remove(key);
                return false;
            }

            const confirmation = adapter?.resumeConfirmation || {};
            const confirmationDelayMs = Math.max(
                120,
                Number(confirmation.delayMs) || 250
            );
            const confirmationChecks = Math.max(
                1,
                Math.min(5, Number(confirmation.checks) || 1)
            );
            const toleranceSeconds = Math.max(
                1,
                Number(confirmation.toleranceSeconds) || 5
            );

            const deadline = Date.now() + 30000;
            let attempt = 0;

            while (Date.now() < deadline) {
                if (resumeGeneration !== providerApiResumeGeneration) {
                    recordProviderFlightEvent("cancelled", {
                        category: "resume",
                        provider,
                        detail: { reason: "repair-cancelled" }
                    });
                    return false;
                }

                attempt += 1;

                try {
                    await adapter?.prepareResume?.({
                        pending,
                        target,
                        deadline,
                        attempt
                    });
                } catch {
                }

                const video = getPrimaryVideo();
                const mediaReady = video && video.readyState >= 1 && (
                    typeof adapter?.isResumeMediaReady !== "function" ||
                    adapter.isResumeMediaReady(video) === true
                );

                if (mediaReady) {
                    const duration = Number.isFinite(video.duration) && video.duration > 0
                        ? video.duration
                        : null;
                    const safeTarget = duration
                        ? Math.min(target, Math.max(0, duration - 1))
                        : target;

                    try {
                        recordProviderFlightEvent("seek-attempt", {
                            category: "resume",
                            provider,
                            detail: {
                                attempt,
                                targetTime: safeTarget,
                                strategy: adapter?.resumeStrategy || "pending-seek"
                            }
                        });

                        const seekResult = typeof adapter?.seekTo === "function"
                            ? await Promise.resolve(adapter.seekTo(Math.max(0, safeTarget)))
                            : false;

                        if (seekResult !== false) {
                            let stable = true;

                            for (let check = 0; check < confirmationChecks; check += 1) {
                                await delay(confirmationDelayMs);
                                if (resumeGeneration !== providerApiResumeGeneration) {
                                    return false;
                                }

                                const playback = adapter?.getPlayback?.() || getPlaybackSnapshot();
                                const observed = Number(playback?.currentTime);

                                if (
                                    !Number.isFinite(observed) ||
                                    observed < safeTarget - toleranceSeconds
                                ) {
                                    stable = false;
                                    break;
                                }
                            }

                            if (stable) {
                                await chrome.storage.local.remove(key);
                                providerApiEmit("resume-applied", {
                                    provider,
                                    currentTime: safeTarget,
                                    strategy: adapter?.resumeStrategy || "pending-seek"
                                });
                                recordProviderFlightEvent("confirmed", {
                                    category: "resume",
                                    provider,
                                    detail: {
                                        targetTime: safeTarget,
                                        attempts: attempt,
                                        strategy: adapter?.resumeStrategy || "pending-seek"
                                    }
                                });
                                return true;
                            }
                        }
                    } catch {
                    }
                }

                await delay(250);
            }

            recordProviderFlightEvent("failed", {
                category: "resume",
                level: "error",
                provider,
                detail: { reason: "timeout", attempts: attempt }
            });
            return false;
        } catch (error) {
            recordProviderFlightEvent("failed", {
                category: "resume",
                level: "error",
                provider,
                detail: {
                    reason: "exception",
                    message: String(error?.message || error || "unknown")
                }
            });
            return false;
        } finally {
            providerApiResumeRunning = false;
        }
    }
    /* Provider API runtime event wiring and lazy resume/self-test startup. */
    function startProviderApi() {
        if (providerApiStarted) return;
        const provider = getCurrentProvider();
        if (!provider) return;

        providerApiStarted = true;
        let lastFlightWatchContext = null;
        let lastFlightVideoPresent = null;

        const syncFlightState = reason => {
            const adapter = getProviderAdapter(provider);
            const watchContext = adapter?.isWatchContext?.() === true;
            const videoPresent = Boolean(getPrimaryVideo());

            if (lastFlightWatchContext !== watchContext) {
                recordProviderFlightEvent(
                    watchContext ? "entered" : "left",
                    {
                        category: "watch-context",
                        provider,
                        detail: { reason }
                    }
                );
                lastFlightWatchContext = watchContext;
            }

            if (lastFlightVideoPresent !== videoPresent) {
                recordProviderFlightEvent(
                    videoPresent ? "appeared" : "disappeared",
                    {
                        category: "video",
                        provider,
                        detail: { reason }
                    }
                );
                lastFlightVideoPresent = videoPresent;
            }
        };

        const emitState = reason => {
            providerApiEmit("statechange", { provider, reason });

            if (/(navigate|navigation|popstate|pageshow)/i.test(String(reason || ""))) {
                recordProviderFlightEvent("navigation", {
                    category: "spa",
                    provider,
                    detail: { reason }
                });
            }

            syncFlightState(reason);
            if (reason !== "timeupdate") scheduleProviderApiSelfTest(reason, 700);
        };

        for (const eventName of ["play", "pause", "ended", "loadedmetadata", "seeked"]) {
            document.addEventListener(eventName, () => emitState(eventName), true);
        }

        document.addEventListener("timeupdate", () => {
            const now = Date.now();
            const cadence = typeof getProviderResourceDelay === "function"
                ? getProviderResourceDelay(5000, "metadata")
                : 5000;
            if (now - providerApiProgressEventAt < cadence) return;
            providerApiProgressEventAt = now;
            emitState("timeupdate");
            providerApiEmit("progress", { provider });
        }, true);

        document.addEventListener("visibilitychange", () => emitState("visibilitychange"));
        window.addEventListener("popstate", () => {
            emitState("popstate");
            setTimeout(() => tryApplyPendingResume(provider), 80);
        });
        window.addEventListener("pageshow", () => emitState("pageshow"));

        const adapter = getProviderAdapter(provider);
        recordProviderFlightEvent("started", {
            category: "provider-api",
            provider,
            detail: { adapterKind: adapter?.adapterKind || "missing" }
        });
        syncFlightState("startup");

        adapter?.bindProviderApiEvents?.({
            emitState,
            applyPendingResume: () => tryApplyPendingResume(provider)
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message?.type !== "stream-shell-provider-resolve-media-link") return;
            if (message?.provider !== provider) {
                sendResponse({
                    ok: false,
                    error: "Provider mismatch."
                });
                return;
            }

            Promise.resolve(
                adapter?.resolveMediaUrl?.(
                    message.identity,
                    message.fallbackUrl
                )
            )
                .then(result => {
                    if (
                        !result?.url ||
                        !isProviderOwnedMediaUrl(provider, result.url)
                    ) {
                        sendResponse({
                            ok: false,
                            error: "No provider-owned media URL could be resolved."
                        });
                        return;
                    }

                    recordProviderFlightEvent("resolved", {
                        category: "stale-link",
                        provider,
                        detail: {
                            strategy: result.strategy || adapter?.linkResolverStrategy || "adapter",
                            reconstructed: result.reconstructed === true
                        }
                    });

                    sendResponse({
                        ok: true,
                        result: {
                            provider,
                            identity: result.identity || getProviderMediaIdentity(provider, result.url),
                            url: normalizeProviderResumeUrl(provider, result.url),
                            strategy: result.strategy || adapter?.linkResolverStrategy || "adapter",
                            reconstructed: result.reconstructed === true
                        }
                    });
                })
                .catch(error => {
                    sendResponse({
                        ok: false,
                        error: String(error?.message || "Media link resolver failed.")
                    });
                });

            return true;
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            const resumeKey = `${PENDING_RESUME_KEY_PREFIX}${provider}`;
            if (changes[resumeKey]?.newValue) {
                setTimeout(() => tryApplyPendingResume(provider), 80);
            }

            if (Object.prototype.hasOwnProperty.call(
                changes,
                CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY
            )) {
                const previous = continueWatchingCompletePercent;
                const next = setContinueWatchingCompletePercent(
                    changes[CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY]?.newValue
                );

                if (next !== previous) {
                    providerApiEmit("continuethresholdchange", {
                        provider,
                        previous,
                        next
                    });
                }
            }

            const launchSelfTest = changes.streamShellLaunchSelfTest?.newValue;
            const launchStartedAt = Number(launchSelfTest?.startedAt) || null;
            if (
                launchStartedAt &&
                launchStartedAt !== providerApiLastLaunchSelfTestStartedAt
            ) {
                providerApiLastLaunchSelfTestStartedAt = launchStartedAt;
                scheduleProviderApiSelfTest("launch", 350);
            }
        });

        scheduleProviderApiSelfTest("startup", 1200);
        setTimeout(() => tryApplyPendingResume(provider), 150);
    }
    async function extractNowPlaying(
        provider
    ) {
        const adapter =
            getProviderAdapter(
                provider
            );


        if (
            !adapter
        ) {
            return null;
        }


        return adapter
            .getMediaSnapshot();
    }


    function startNowPlayingTracking() {
        const provider =
            getCurrentProvider();


        if (
            !provider
        ) {
            return;
        }


        const providerAdapter =
            getProviderAdapter(
                provider
            );


        if (
            !providerAdapter
        ) {
            return;
        }


        const isCurrentWatchContext =
            () => providerAdapter
                .isWatchContext?.() ===
                true;


        const storageKey =
            `${NOW_PLAYING_KEY_PREFIX}${provider}`;


        let lastSignature =
            null;


        let currentSessionIdentity =
            null;


        let sessionStartedAt =
            null;


        let lastStableMedia =
            null;


        let lastStableWatchIdentity =
            null;


        let lastContinueWriteAt =
            0;


        let lastContinueIdentity =
            null;


        async function canPublishWhileHidden() {
            if (
                document.visibilityState !==
                    "hidden"
            ) {
                return true;
            }


            try {
                const response =
                    await chrome.runtime.sendMessage({
                        type:
                            "provider-now-playing-eligible"
                    });


                return Boolean(
                    response?.eligible
                );

            } catch {
                return false;
            }
        }


        async function publish(
            forceContinueWrite = false
        ) {
            const eligible =
                await canPublishWhileHidden();


            const watchIdentity =
                `${provider}:${window.location.pathname}${window.location.search}`;


            const canReuseNetflixMedia =
                provider ===
                    "netflix" &&
                eligible &&
                isCurrentWatchContext() &&
                lastStableMedia &&
                lastStableWatchIdentity ===
                    watchIdentity &&
                Boolean(
                    getPrimaryVideo()
                );


            let media =
                canReuseNetflixMedia
                    ? {
                        ...lastStableMedia,
                        url:
                            window.location.href,
                        ...getPlaybackSnapshot()
                    }
                    : eligible
                        ? await extractNowPlaying(
                            provider
                        )
                        : null;


            /*
             * RYD can briefly remove/recreate its tooltip while YouTube
             * changes player/layout state. Once a valid ratio has been seen
             * for this exact watch URL, keep it until RYD publishes a newer
             * valid value or navigation changes the watch identity.
             */
            if (
                provider === "youtube" &&
                media &&
                !Number.isFinite(media.likeRatio) &&
                lastStableMedia &&
                lastStableWatchIdentity === watchIdentity &&
                Number.isFinite(lastStableMedia.likeRatio)
            ) {
                media.likeRatio =
                    lastStableMedia.likeRatio;
            }


            if (
                media
            ) {
                lastStableMedia =
                    {
                        ...media
                    };

                lastStableWatchIdentity =
                    watchIdentity;

            } else if (
                eligible &&
                isCurrentWatchContext() &&
                lastStableMedia &&
                lastStableWatchIdentity ===
                    watchIdentity
            ) {
                /*
                 * Provider controls are often removed from the DOM after a
                 * few idle seconds. Keep the last valid metadata while the
                 * same watch URL and video are still alive; only playback
                 * state/progress needs to be refreshed.
                 */
                const playback =
                    getPlaybackSnapshot();


                if (
                    getPrimaryVideo()
                ) {
                    media = {
                        ...lastStableMedia,
                        url:
                            window.location.href,
                        ...playback
                    };
                }
            }


            if (
                !isCurrentWatchContext()
            ) {
                lastStableMedia =
                    null;

                lastStableWatchIdentity =
                    null;
            }


            if (
                media
            ) {
                const identity =
                    JSON.stringify([
                        media.title,
                        media.url
                    ]);


                if (
                    identity !==
                    currentSessionIdentity
                ) {
                    currentSessionIdentity =
                        identity;


                    sessionStartedAt =
                        Date.now();
                }


                media.sessionStartedAt =
                    sessionStartedAt;
            } else {
                currentSessionIdentity =
                    null;


                sessionStartedAt =
                    null;
            }


            if (
                media &&
                Number.isFinite(
                    media.currentTime
                ) &&
                Number.isFinite(
                    media.duration
                ) &&
                media.duration > 0
            ) {
                const now =
                    Date.now();


                const continueIdentity =
                    media.identity ||
                    getProviderMediaIdentity(
                        provider,
                        media.url
                    );


                const progressPercent =
                    media.currentTime /
                    media.duration *
                    100;


                const completionChanged =
                    progressPercent >=
                        continueWatchingCompletePercent &&
                    continueIdentity !==
                        lastContinueIdentity;


                if (
                    forceContinueWrite ||
                    completionChanged ||
                    now - lastContinueWriteAt >=
                        10000
                ) {
                    lastContinueWriteAt =
                        now;

                    lastContinueIdentity =
                        continueIdentity;


                    updateContinueWatching(
                        media
                    ).catch(
                        () => {}
                    );
                }
            }


            const signature =
                media
                    ? JSON.stringify([
                        media.title,
                        media.image,
                        media.url,
                        media.likeRatio,
                        media.playbackState,
                        Number.isFinite(
                            media.currentTime
                        )
                            ? media.playbackState ===
                                "playing"
                                ? Math.floor(
                                    media.currentTime /
                                    60
                                )
                                : Math.floor(
                                    media.currentTime
                                )
                            : null,
                        Number.isFinite(
                            media.duration
                        )
                            ? Math.floor(
                                media.duration
                            )
                            : null,
                        sessionStartedAt
                            ? Math.floor(
                                (
                                    Date.now() -
                                    sessionStartedAt
                                ) /
                                60000
                            )
                            : null
                    ])
                    : "__none__";


            if (
                signature ===
                lastSignature
            ) {
                return;
            }


            lastSignature =
                signature;


            try {
                if (
                    media
                ) {
                    await chrome.storage.local.set({
                        [storageKey]: {
                            ...media,

                            updatedAt:
                                Date.now()
                        }
                    });

                } else {

                    await chrome.storage.local.remove(
                        storageKey
                    );
                }
            } catch {
            }
        }


        publish();


        createProviderResourceLoop(
            `now-playing-${provider}`,
            publish,
            1500,
            "metadata"
        );


        const forcePublish =
            (forceContinueWrite = false) => {
                lastSignature =
                    null;

                publish(
                    forceContinueWrite
                );
            };


        providerApiOn(
            "continuethresholdchange",
            () => {
                forcePublish(true);
            }
        );


        providerApiOn(
            "statechange",
            event => {
                const reason =
                    event?.reason ||
                    "statechange";


                forcePublish(
                    reason === "pause" ||
                    reason === "ended" ||
                    reason === "seeked"
                );
            }
        );
    }


    /*
     * ============================================================
     * WINDOWED PLAYER
     * ============================================================
     *
     * Stream Shell keeps this deliberately small: state lives in
     * chrome.storage, provider-specific CSS owns the layout, and this
     * controller only toggles the root marker / native provider mode.
     */

    const WINDOWED_PLAYER_KEY_PREFIX =
        "streamShellWindowedPlayer_";


    const YOUTUBE_EXTRAS_STORAGE_KEY =
        "streamShellYoutubeExtrasEnabled";


    const WINDOWED_PLAYER_PROVIDERS =
        new Set([
            "youtube",
            "crunchyroll"
        ]);


    let youtubeTheaterForcedByStreamShell =
        false;


    let youtubeTopUiHideTimer =
        null;


    let youtubeExtrasEnabled =
        true;


    let youtubeTopUiPointerBound =
        false;

    let youtubeTopUiPointerZone =
        "outside";


    let crunchyrollWindowedNavigationTimer =
        null;


    function getWindowedPlayerStorageKey(
        provider
    ) {
        return `${WINDOWED_PLAYER_KEY_PREFIX}${provider}`;
    }


    function isWindowedPlayerWatchContext(
        provider
    ) {
        const path =
            String(
                window.location.pathname ||
                ""
            );


        if (
            provider ===
                "youtube"
        ) {
            return path ===
                "/watch";
        }


        if (
            provider ===
                "crunchyroll"
        ) {
            return /^\/watch\//i.test(
                path
            );
        }


        return false;
    }


    function setWindowedPlayerRootMarker(
        provider,
        enabled
    ) {
        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            enabled
        ) {
            root.setAttribute(
                "data-stream-shell-windowed-player",
                provider
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-windowed-player"
            );
        }
    }


    function setYouTubeTopUiVisible(
        visible
    ) {
        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            visible
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-top-ui",
                "true"
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-youtube-top-ui"
            );
        }
    }


    function setYouTubeExtrasRootMarker(
        enabled
    ) {
        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            enabled
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-extras",
                "true"
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-youtube-extras"
            );
        }
    }


    function syncYouTubeExtrasMode(
        enabled
    ) {
        const active =
            !isProviderSafeModeEnabled("youtube") &&
            Boolean(
                enabled
            ) &&
            isWindowedPlayerWatchContext(
                "youtube"
            ) &&
            document.documentElement
                ?.getAttribute(
                    "data-stream-shell-windowed-player"
                ) ===
                "youtube";


        setYouTubeExtrasRootMarker(
            active
        );
    }


    function clearYouTubeTopUiTimer() {
        if (
            !youtubeTopUiHideTimer
        ) {
            return;
        }


        clearTimeout(
            youtubeTopUiHideTimer
        );


        youtubeTopUiHideTimer =
            null;
    }


    function scheduleYouTubeTopUiHide() {
        clearYouTubeTopUiTimer();


        youtubeTopUiHideTimer =
            setTimeout(
                () => {
                    setYouTubeTopUiVisible(
                        false
                    );


                    youtubeTopUiHideTimer =
                        null;
                },
                240
            );
    }


    function handleYouTubeWindowedPointerMove(
        event
    ) {
        const masthead =
            document.getElementById(
                "masthead-container"
            );


        const zone =
            event.clientY <=
                72 ||
            masthead?.contains(
                event.target
            )
                ? "top"
                : event.clientY >
                    112
                    ? "outside"
                    : "transition";


        if (
            zone ===
                youtubeTopUiPointerZone
        ) {
            return;
        }


        youtubeTopUiPointerZone =
            zone;


        if (
            zone ===
                "top"
        ) {
            clearYouTubeTopUiTimer();
            setYouTubeTopUiVisible(
                true
            );
            return;
        }


        if (
            zone ===
                "outside"
        ) {
            scheduleYouTubeTopUiHide();
        }
    }


    function bindYouTubeTopUiPointer(
        enabled =
            true
    ) {
        const shouldBind =
            enabled ===
                true;


        if (
            shouldBind ===
                youtubeTopUiPointerBound
        ) {
            return;
        }


        youtubeTopUiPointerBound =
            shouldBind;

        youtubeTopUiPointerZone =
            "outside";


        if (
            shouldBind
        ) {
            document.addEventListener(
                "pointermove",
                handleYouTubeWindowedPointerMove,
                {
                    passive:
                        true,

                    capture:
                        true
                }
            );


            return;
        }


        document.removeEventListener(
            "pointermove",
            handleYouTubeWindowedPointerMove,
            true
        );


        clearYouTubeTopUiTimer();

        setYouTubeTopUiVisible(
            false
        );
    }


    function getYouTubeWatchContainer() {
        return document.querySelector(
            "ytd-watch-flexy"
        );
    }


    function getYouTubeSizeButton() {
        return document.querySelector(
            ".ytp-size-button"
        );
    }


    function ensureYouTubeTheaterMode() {
        const watchContainer =
            getYouTubeWatchContainer();


        if (
            !watchContainer ||
            watchContainer.hasAttribute(
                "theater"
            )
        ) {
            return Boolean(
                watchContainer
            );
        }


        const sizeButton =
            getYouTubeSizeButton();


        if (
            !sizeButton
        ) {
            return false;
        }


        youtubeTheaterForcedByStreamShell =
            true;


        sizeButton.click();


        return true;
    }


    function scheduleYouTubeTheaterMode() {
        const delays = [
            0,
            120,
            350,
            800,
            1500
        ];


        for (
            const delayMs
            of delays
        ) {
            setTimeout(
                () => {
                    if (
                        document.documentElement
                            ?.getAttribute(
                                "data-stream-shell-windowed-player"
                            ) !==
                            "youtube" ||
                        !isWindowedPlayerWatchContext(
                            "youtube"
                        )
                    ) {
                        return;
                    }


                    ensureYouTubeTheaterMode();
                },
                delayMs
            );
        }
    }


    function restoreYouTubeTheaterModeIfNeeded() {
        if (
            !youtubeTheaterForcedByStreamShell
        ) {
            return;
        }


        const watchContainer =
            getYouTubeWatchContainer();


        const sizeButton =
            getYouTubeSizeButton();


        if (
            watchContainer?.hasAttribute(
                "theater"
            ) &&
            sizeButton
        ) {
            sizeButton.click();
        }


        youtubeTheaterForcedByStreamShell =
            false;
    }


    function startCrunchyrollWindowedNavigationWatch(
        sync
    ) {
        if (
            crunchyrollWindowedNavigationTimer
        ) {
            return;
        }


        let lastPath =
            String(
                window.location.pathname ||
                ""
            );


        /*
         * Crunchyroll changes episodes / watch routes with SPA pushState.
         * pushState does not emit popstate, so a persisted ON state could
         * remain dormant after navigating from the provider home page to
         * /watch/... until the Dashboard toggle was touched again.
         *
         * A tiny pathname watcher is deliberately less invasive than
         * monkey-patching History or observing Crunchyroll's entire DOM.
         */
        crunchyrollWindowedNavigationTimer =
            createProviderResourceLoop(
                "crunchyroll-windowed-navigation",
                () => {
                    const nextPath =
                        String(
                            window.location.pathname ||
                            ""
                        );


                    if (
                        nextPath ===
                            lastPath
                    ) {
                        return;
                    }


                    lastPath =
                        nextPath;


                    sync();
                },
                400,
                "navigation"
            );
    }


    function syncWindowedPlayerMode(
        provider,
        enabled
    ) {
        const effectiveEnabled = Boolean(enabled) &&
            !isProviderSafeModeEnabled(provider);

        const adapter =
            getProviderAdapter(
                provider
            );


        const adapterSync =
            adapter?.extensions
                ?.windowedPlayer
                ?.sync;


        if (
            typeof adapterSync ===
                "function"
        ) {
            return adapterSync(
                effectiveEnabled
            );
        }


        const active =
            effectiveEnabled &&
            isWindowedPlayerWatchContext(
                provider
            );


        setWindowedPlayerRootMarker(
            provider,
            active
        );


        return active;
    }


    /*
     * ============================================================
     * PLAYBACK UTILITIES
     * ============================================================
     * Shared provider-local playback conveniences: preferred playback
     * speed, optional subtitle overrides, sleep-timer signaling and
     * double-click toggling of Stream Shell's windowed player mode.
     */

    const PLAYBACK_UTILITY_PROVIDERS = [
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll"
    ];

    const SUBTITLE_OVERRIDE_PROVIDERS = new Set([
        "youtube",
        "netflix",
        "disney"
    ]);

    const SUBTITLE_FONT_STACKS = {
        Arial: "Arial, sans-serif",
        Helvetica: "Helvetica, Arial, sans-serif",
        Georgia: "Georgia, serif",
        "Times New Roman": '"Times New Roman", Times, serif',
        "Courier New": '"Courier New", monospace',
        Verdana: "Verdana, sans-serif",
        Roboto: "Roboto, Arial, sans-serif"
    };

    const PLAYBACK_UTILITY_GLOBAL_KEYS = new Set([
        "streamShellPlaybackAnarchy",
        "streamShellSubtitleAnarchy",
        "streamShellDvdAnarchy"
    ]);

    const playbackUtilityDefaults = {
        streamShellPlaybackAnarchy: false,
        streamShellSubtitleAnarchy: false,
        streamShellDvdAnarchy: false
    };

    for (const provider of PLAYBACK_UTILITY_PROVIDERS) {
        playbackUtilityDefaults[`streamShellPlaybackSpeed_${provider}`] = "1";
    }

    playbackUtilityDefaults.streamShellDoubleClickWindowed_youtube = false;
    playbackUtilityDefaults.streamShellDoubleClickWindowed_crunchyroll = false;

    for (const provider of SUBTITLE_OVERRIDE_PROVIDERS) {
        playbackUtilityDefaults[`streamShellSubtitleOverride_${provider}`] = false;
        playbackUtilityDefaults[`streamShellSubtitleScale_${provider}`] = "1";
        playbackUtilityDefaults[`streamShellSubtitleColor_${provider}`] = "#ffffff";
        playbackUtilityDefaults[`streamShellSubtitleFont_${provider}`] = "default";
    }

    let playbackUtilitySettings = {
        ...playbackUtilityDefaults
    };

    function playbackUtilityKeysForProvider(provider) {
        const keys = Object.keys(playbackUtilityDefaults).filter(
            key => PLAYBACK_UTILITY_GLOBAL_KEYS.has(key) ||
                key.endsWith(`_${provider}`)
        );

        if (provider === "youtube" || provider === "crunchyroll") {
            keys.push(
                displayScopedStorageKey(
                    `streamShellDoubleClickWindowed_${provider}`
                )
            );
        }

        return keys;
    }

    function windowedDoubleClickEnabled(provider) {
        const baseKey = `streamShellDoubleClickWindowed_${provider}`;
        const scopedKey = displayScopedStorageKey(baseKey);

        if (Object.prototype.hasOwnProperty.call(playbackUtilitySettings, scopedKey)) {
            return playbackUtilitySettings[scopedKey] === true;
        }

        return playbackUtilitySettings[baseKey] === true;
    }

    let playbackUtilityTimer = null;
    let playbackAnarchyTimer = null;
    let playbackAnarchyState = null;
    let subtitleAnarchyTimer = null;
    let subtitleColorTimer = null;
    let subtitleAnarchyState = null;
    let dvdAnarchyFrame = null;
    let dvdAnarchyHost = null;
    let dvdAnarchyLogo = null;
    let dvdAnarchyState = null;
    let sleepTimerEndArmed = false;

    function normalizePlaybackRate(value) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
            return 1;
        }

        return Math.min(2, Math.max(0.25, numeric));
    }


    function normalizeSubtitleScale(value) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
            return 1;
        }

        return Math.min(2, Math.max(0.5, numeric));
    }

    function normalizeSubtitleColor(value) {
        const text = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(text)
            ? text
            : "#ffffff";
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function smoothStep(value) {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }

    const ANARCHY_NEON_COLORS = [
        "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
        "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
        "#b000ff", "#7c00ff", "#651fff", "#304ffe",
        "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
        "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
        "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
        "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
        "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
    ];
    let anarchyNeonColorBag = [];

    function refillAnarchyNeonColorBag() {
        anarchyNeonColorBag = [...ANARCHY_NEON_COLORS];
        for (let i = anarchyNeonColorBag.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [anarchyNeonColorBag[i], anarchyNeonColorBag[j]] =
                [anarchyNeonColorBag[j], anarchyNeonColorBag[i]];
        }
    }

    function randomNeonColor() {
        if (!anarchyNeonColorBag.length) refillAnarchyNeonColorBag();
        return anarchyNeonColorBag.pop();
    }

    function playbackAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            playbackUtilitySettings.streamShellPlaybackAnarchy === true;
    }

    function subtitleAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            shouldProviderResourceRunVisualWork() &&
            SUBTITLE_OVERRIDE_PROVIDERS.has(provider) &&
            playbackUtilitySettings.streamShellSubtitleAnarchy === true;
    }

    function choosePlaybackAnarchyTarget(video) {
        const current = normalizePlaybackRate(
            Number(video?.playbackRate) || 1
        );

        playbackAnarchyState = {
            video,
            from: current,
            target: randomBetween(0.55, 1.9),
            startedAt: performance.now(),
            duration: randomBetween(900, 4200)
        };
    }

    function tickPlaybackAnarchy(provider) {
        if (!playbackAnarchyEnabled(provider)) {
            playbackAnarchyState = null;
            return;
        }

        const video = getPrimaryVideo();
        if (!video) {
            playbackAnarchyState = null;
            return;
        }

        if (
            !playbackAnarchyState ||
            playbackAnarchyState.video !== video
        ) {
            choosePlaybackAnarchyTarget(video);
        }

        const now = performance.now();
        const state = playbackAnarchyState;
        const t = (now - state.startedAt) / state.duration;
        const eased = smoothStep(t);
        const rate = state.from +
            (state.target - state.from) * eased;

        const clampedRate = Math.max(0.25, Math.min(2, rate));

        if (provider === "netflix") {
            try {
                Promise.resolve(
                    getProviderAdapter(provider)?.setPlaybackRate?.(clampedRate)
                ).catch(() => {});
            } catch {
            }
        } else {
            try {
                video.playbackRate = clampedRate;
            } catch {
            }
        }

        if (t >= 1) {
            playbackAnarchyState = {
                video,
                from: state.target,
                target: randomBetween(0.55, 1.9),
                startedAt: now,
                duration: randomBetween(900, 4200)
            };
        }
    }

    function ensurePlaybackAnarchyTimer(provider) {
        const configured = playbackAnarchyEnabled(provider);
        const resourceState = getProviderResourceGovernorState();
        const enabled = configured && resourceState.playing === true;

        if (enabled && !playbackAnarchyTimer) {
            playbackAnarchyTimer = setInterval(
                () => tickPlaybackAnarchy(provider),
                50
            );
            tickPlaybackAnarchy(provider);
            return;
        }

        if (!enabled && playbackAnarchyTimer) {
            clearInterval(playbackAnarchyTimer);
            playbackAnarchyTimer = null;
            playbackAnarchyState = null;
        }
    }

    function chooseSubtitleAnarchyTarget() {
        const root = document.documentElement;
        const current = Number(
            root?.style.getPropertyValue(
                "--stream-shell-subtitle-scale"
            )
        );

        subtitleAnarchyState = {
            from: Number.isFinite(current) && current > 0
                ? current
                : 1,
            target: randomBetween(0.62, 1.85),
            startedAt: performance.now(),
            duration: randomBetween(650, 2600)
        };
    }

    function tickSubtitleAnarchy(provider) {
        if (!subtitleAnarchyEnabled(provider)) {
            subtitleAnarchyState = null;
            return;
        }

        const root = document.documentElement;
        if (!root) {
            return;
        }

        if (!subtitleAnarchyState) {
            chooseSubtitleAnarchyTarget();
        }

        const now = performance.now();
        const state = subtitleAnarchyState;
        const t = (now - state.startedAt) / state.duration;
        const eased = smoothStep(t);
        const scale = state.from +
            (state.target - state.from) * eased;

        root.style.setProperty(
            "--stream-shell-subtitle-scale",
            String(scale)
        );

        if (t >= 1) {
            subtitleAnarchyState = {
                from: state.target,
                target: randomBetween(0.62, 1.85),
                startedAt: now,
                duration: randomBetween(650, 2600)
            };
        }
    }

    function ensureSubtitleAnarchyTimers(provider) {
        const enabled = subtitleAnarchyEnabled(provider);

        if (enabled && !subtitleAnarchyTimer) {
            subtitleAnarchyTimer = setInterval(
                () => tickSubtitleAnarchy(provider),
                50
            );
            subtitleColorTimer = setInterval(
                () => {
                    if (!subtitleAnarchyEnabled(provider)) {
                        return;
                    }

                    document.documentElement?.style.setProperty(
                        "--stream-shell-subtitle-color",
                        randomNeonColor()
                    );
                },
                200
            );

            document.documentElement?.style.setProperty(
                "--stream-shell-subtitle-color",
                randomNeonColor()
            );
            tickSubtitleAnarchy(provider);
            return;
        }

        if (!enabled) {
            if (subtitleAnarchyTimer) {
                clearInterval(subtitleAnarchyTimer);
                subtitleAnarchyTimer = null;
            }

            if (subtitleColorTimer) {
                clearInterval(subtitleColorTimer);
                subtitleColorTimer = null;
            }

            subtitleAnarchyState = null;
        }
    }

    function dvdAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            playbackUtilitySettings.streamShellDvdAnarchy === true;
    }

    function dvdAnarchyShouldRun(provider) {
        if (!dvdAnarchyEnabled(provider)) return false;

        /*
         * This runs from requestAnimationFrame, so use the governor's live
         * core state directly instead of building the Diagnostics workload
         * snapshot on every frame. Governor changes still call
         * syncPlaybackUtilities immediately.
         */
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("dvd-anarchy");

        return Boolean(
            state.visible === true &&
            state.leftMode === provider &&
            state.minimized !== true
        );
    }

    function destroyDvdAnarchy() {
        if (dvdAnarchyFrame) {
            cancelAnimationFrame(dvdAnarchyFrame);
            dvdAnarchyFrame = null;
        }

        if (dvdAnarchyHost?.isConnected) {
            dvdAnarchyHost.remove();
        }

        dvdAnarchyHost = null;
        dvdAnarchyLogo = null;
        dvdAnarchyState = null;
    }

    function createDvdAnarchyHost() {
        if (dvdAnarchyHost?.isConnected && dvdAnarchyLogo) {
            return;
        }

        destroyDvdAnarchy();

        const host = document.createElement("div");
        host.id = "stream-shell-dvd-anarchy";
        host.setAttribute("aria-hidden", "true");
        host.style.setProperty("all", "initial", "important");
        host.style.setProperty("position", "fixed", "important");
        host.style.setProperty("inset", "0", "important");
        host.style.setProperty("width", "100vw", "important");
        host.style.setProperty("height", "100vh", "important");
        host.style.setProperty("pointer-events", "none", "important");
        host.style.setProperty("overflow", "hidden", "important");
        host.style.setProperty("z-index", "2147483646", "important");
        host.style.setProperty("contain", "strict", "important");

        const shadow = host.attachShadow({ mode: "closed" });
        const logo = document.createElement("div");
        const maskUrl = `url("${chrome.runtime.getURL(
            "assets/anarchy/dvd-logo.png"
        )}")`;

        logo.style.cssText = [
            "position:absolute",
            "left:0",
            "top:0",
            "width:clamp(138px, 12vw, 240px)",
            "aspect-ratio:540 / 280",
            "background:#00ffff",
            `-webkit-mask-image:${maskUrl}`,
            "-webkit-mask-repeat:no-repeat",
            "-webkit-mask-position:center",
            "-webkit-mask-size:contain",
            `mask-image:${maskUrl}`,
            "mask-repeat:no-repeat",
            "mask-position:center",
            "mask-size:contain",
            "will-change:transform,background-color",
            "filter:drop-shadow(0 0 10px rgba(0,0,0,.35))",
            "opacity:.92"
        ].join(";");

        shadow.appendChild(logo);
        document.documentElement?.appendChild(host);
        dvdAnarchyHost = host;
        dvdAnarchyLogo = logo;
    }

    function chooseDvdAnarchySpeedTarget(now) {
        if (!dvdAnarchyState) return;

        const current = Number(dvdAnarchyState.speed) || 260;
        dvdAnarchyState.speedFrom = current;
        dvdAnarchyState.speedTarget = randomBetween(105, 760);
        dvdAnarchyState.speedStartedAt = now;
        dvdAnarchyState.speedDuration = randomBetween(420, 1500);
        dvdAnarchyState.nextSpeedChangeAt = now +
            randomBetween(950, 3600);
    }

    function resetDvdAnarchyState(now) {
        const width = Math.max(0, window.innerWidth || 0);
        const height = Math.max(0, window.innerHeight || 0);
        const rect = dvdAnarchyLogo?.getBoundingClientRect?.();
        const logoWidth = Math.max(1, rect?.width || 180);
        const logoHeight = Math.max(1, rect?.height || 93);
        const maxX = Math.max(0, width - logoWidth);
        const maxY = Math.max(0, height - logoHeight);
        const angle = randomBetween(
            24 * Math.PI / 180,
            66 * Math.PI / 180
        );
        const xSign = Math.random() < 0.5 ? -1 : 1;
        const ySign = Math.random() < 0.5 ? -1 : 1;
        const initialSpeed = randomBetween(180, 520);

        dvdAnarchyState = {
            x: randomBetween(0, maxX),
            y: randomBetween(0, maxY),
            dirX: Math.cos(angle) * xSign,
            dirY: Math.sin(angle) * ySign,
            speed: initialSpeed,
            speedFrom: initialSpeed,
            speedTarget: initialSpeed,
            speedStartedAt: now,
            speedDuration: 1,
            nextSpeedChangeAt: now + randomBetween(700, 2200),
            lastAt: now,
            lastWidth: width,
            lastHeight: height
        };

        if (dvdAnarchyLogo) {
            dvdAnarchyLogo.style.backgroundColor = randomNeonColor();
        }
    }

    function tickDvdAnarchy(provider, now) {
        dvdAnarchyFrame = null;

        if (!dvdAnarchyShouldRun(provider)) {
            destroyDvdAnarchy();
            return;
        }

        createDvdAnarchyHost();
        if (!dvdAnarchyLogo) return;

        if (!dvdAnarchyState) {
            resetDvdAnarchyState(now);
        }

        const state = dvdAnarchyState;
        const width = Math.max(0, window.innerWidth || 0);
        const height = Math.max(0, window.innerHeight || 0);
        const rect = dvdAnarchyLogo.getBoundingClientRect();
        const logoWidth = Math.max(1, rect.width || 180);
        const logoHeight = Math.max(1, rect.height || 93);
        const maxX = Math.max(0, width - logoWidth);
        const maxY = Math.max(0, height - logoHeight);

        if (
            state.lastWidth !== width ||
            state.lastHeight !== height
        ) {
            state.x = Math.min(maxX, Math.max(0, state.x));
            state.y = Math.min(maxY, Math.max(0, state.y));
            state.lastWidth = width;
            state.lastHeight = height;
        }

        if (now >= state.nextSpeedChangeAt) {
            chooseDvdAnarchySpeedTarget(now);
        }

        const speedT = Math.max(
            0,
            Math.min(
                1,
                (now - state.speedStartedAt) /
                    Math.max(1, state.speedDuration)
            )
        );
        const easedSpeedT = smoothStep(speedT);
        state.speed = state.speedFrom +
            (state.speedTarget - state.speedFrom) * easedSpeedT;

        const deltaSeconds = Math.min(
            0.05,
            Math.max(0, (now - state.lastAt) / 1000)
        );
        state.lastAt = now;

        state.x += state.dirX * state.speed * deltaSeconds;
        state.y += state.dirY * state.speed * deltaSeconds;

        let collided = false;

        if (state.x <= 0) {
            state.x = 0;
            state.dirX = Math.abs(state.dirX);
            collided = true;
        } else if (state.x >= maxX) {
            state.x = maxX;
            state.dirX = -Math.abs(state.dirX);
            collided = true;
        }

        if (state.y <= 0) {
            state.y = 0;
            state.dirY = Math.abs(state.dirY);
            collided = true;
        } else if (state.y >= maxY) {
            state.y = maxY;
            state.dirY = -Math.abs(state.dirY);
            collided = true;
        }

        if (collided) {
            dvdAnarchyLogo.style.backgroundColor = randomNeonColor();
        }

        dvdAnarchyLogo.style.transform =
            `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;

        dvdAnarchyFrame = requestAnimationFrame(
            nextNow => tickDvdAnarchy(provider, nextNow)
        );
    }

    function syncDvdAnarchy(provider) {
        if (!dvdAnarchyShouldRun(provider)) {
            destroyDvdAnarchy();
            return;
        }

        createDvdAnarchyHost();
        if (!dvdAnarchyFrame) {
            dvdAnarchyFrame = requestAnimationFrame(
                now => tickDvdAnarchy(provider, now)
            );
        }
    }

    function syncGenericSubtitleMarker(provider) {
        if (!SUBTITLE_OVERRIDE_PROVIDERS.has(provider)) {
            return;
        }

        if (isProviderSafeModeEnabled(provider)) {
            clearGenericSubtitleSafeModeState();
            ensureSubtitleAnarchyTimers(provider);
            return;
        }

        const adapterSync = getProviderAdapter(provider)
            ?.extensions
            ?.subtitleStyling
            ?.sync;

        if (typeof adapterSync === "function") {
            adapterSync(playbackUtilitySettings);
            return;
        }

        const root = document.documentElement;
        if (!root) {
            return;
        }

        const anarchy = subtitleAnarchyEnabled(provider);
        const enabled = anarchy || playbackUtilitySettings[
            `streamShellSubtitleOverride_${provider}`
        ] === true;

        root.toggleAttribute(
            "data-stream-shell-subtitle-override",
            enabled
        );

        root.setAttribute(
            "data-stream-shell-subtitle-provider",
            provider
        );

        if (!anarchy) {
            root.style.setProperty(
                "--stream-shell-subtitle-scale",
                String(
                    normalizeSubtitleScale(
                        playbackUtilitySettings[
                            `streamShellSubtitleScale_${provider}`
                        ]
                    )
                )
            );

            root.style.setProperty(
                "--stream-shell-subtitle-color",
                normalizeSubtitleColor(
                    playbackUtilitySettings[
                        `streamShellSubtitleColor_${provider}`
                    ]
                )
            );
        }

        const font = String(
            playbackUtilitySettings[
                `streamShellSubtitleFont_${provider}`
            ] || "default"
        );

        const stack = SUBTITLE_FONT_STACKS[font];

        root.toggleAttribute(
            "data-stream-shell-subtitle-font-override",
            Boolean(stack)
        );

        if (stack) {
            root.style.setProperty(
                "--stream-shell-subtitle-font",
                stack
            );
        } else {
            root.style.removeProperty(
                "--stream-shell-subtitle-font"
            );
        }
    }

    function syncPlaybackRate(provider) {
        ensurePlaybackAnarchyTimer(provider);

        if (
            playbackAnarchyEnabled(provider) &&
            getProviderResourceGovernorState().playing === true
        ) {
            return;
        }

        const adapter = getProviderAdapter(provider);
        const video = getPrimaryVideo();
        if (!adapter || !video) {
            return;
        }

        const rate = normalizePlaybackRate(
            playbackUtilitySettings[
                `streamShellPlaybackSpeed_${provider}`
            ]
        );
        const currentRate = Number(video.playbackRate);

        /*
         * The adaptive playback loop is intentionally persistent so a provider
         * can recreate/reset its player without losing the configured rate.
         * Do not, however, keep issuing the same provider command while the
         * current media element already reports the desired value. Netflix in
         * particular would otherwise bounce a redundant command through its
         * MAIN-world bridge on every utility tick.
         */
        if (
            Number.isFinite(currentRate) &&
            Math.abs(currentRate - rate) < 0.001
        ) {
            return;
        }

        try {
            const result = adapter.setPlaybackRate(rate);
            if (result && typeof result.catch === "function") {
                result.catch(() => {});
            }
        } catch {
        }
    }

    function syncPlaybackUtilities(provider) {
        syncPlaybackRate(provider);
        syncGenericSubtitleMarker(provider);
        ensureSubtitleAnarchyTimers(provider);
        syncDvdAnarchy(provider);
    }


    function doubleClickTargetsPlayer(provider, target) {
        if (!(target instanceof Element)) {
            return false;
        }

        const adapterTargetCheck = getProviderAdapter(provider)
            ?.extensions
            ?.windowedPlayer
            ?.matchesTarget;

        if (typeof adapterTargetCheck === "function") {
            return adapterTargetCheck(target);
        }

        if (provider === "crunchyroll") {
            return Boolean(
                target.closest(
                    "#vilosRoot, #velocity-player-package, [data-testid*='player']"
                )
            );
        }

        return false;
    }

    async function handleWindowedDoubleClick(provider, event) {
        if (
            isProviderSafeModeEnabled(provider) ||
            !WINDOWED_PLAYER_PROVIDERS.has(provider) ||
            !windowedDoubleClickEnabled(provider) ||
            !isWindowedPlayerWatchContext(provider) ||
            !doubleClickTargetsPlayer(provider, event.target)
        ) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const storageKey = getWindowedPlayerStorageKey(provider);
        const scopedStorageKey = displayScopedStorageKey(storageKey);

        try {
            const stored = await chrome.storage.local.get([
                storageKey,
                scopedStorageKey
            ]);
            const current = readDisplayScopedSetting(
                stored,
                storageKey,
                false
            ) === true;

            await chrome.storage.local.set({
                [scopedStorageKey]: !current
            });
        } catch {
        }
    }

    function handleSleepTimerEnded(event) {
        if (!sleepTimerEndArmed) return;

        const media = event.target;
        if (!(media instanceof HTMLMediaElement)) return;

        const primary = getPrimaryVideo();
        if (primary && media !== primary) return;

        sleepTimerEndArmed = false;
        try { media.pause(); } catch {}

        chrome.runtime.sendMessage({
            type: "sleep-timer-ended"
        }).catch(() => {});
    }

    chrome.runtime.onMessage.addListener(message => {
        if (message?.type === "stream-shell-sleep-arm") {
            sleepTimerEndArmed = message.armed === true;
            return;
        }

        if (message?.type === "stream-shell-sleep-pause") {
            const adapter = getProviderAdapter();
            if (adapter) {
                try { adapter.pause(); } catch {}
            }
        }
    });

    async function startPlaybackUtilities() {
        const provider = getCurrentProvider();

        if (!provider || !PLAYBACK_UTILITY_PROVIDERS.includes(provider)) {
            return;
        }

        const keys = playbackUtilityKeysForProvider(provider);

        try {
            const stored = await chrome.storage.local.get(keys);
            playbackUtilitySettings = {
                ...playbackUtilitySettings,
                ...stored
            };
        } catch {
        }

        syncPlaybackUtilities(provider);

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                const scopedDoubleClickKey = displayScopedStorageKey(
                    `streamShellDoubleClickWindowed_${provider}`
                );

                for (const [key, change] of Object.entries(changes)) {
                    if (key === scopedDoubleClickKey) {
                        if (change.newValue === undefined) {
                            delete playbackUtilitySettings[key];
                        } else {
                            playbackUtilitySettings[key] = change.newValue;
                        }
                        relevant = true;
                        continue;
                    }

                    if (!Object.prototype.hasOwnProperty.call(
                        playbackUtilityDefaults,
                        key
                    )) {
                        continue;
                    }

                    playbackUtilitySettings[key] = change.newValue === undefined
                        ? playbackUtilityDefaults[key]
                        : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    syncPlaybackUtilities(provider);
                }
            }
        );

        if (WINDOWED_PLAYER_PROVIDERS.has(provider)) {
            document.addEventListener(
                "dblclick",
                event => {
                    handleWindowedDoubleClick(provider, event)
                        .catch(() => {});
                },
                true
            );
        }

        document.addEventListener(
            "ended",
            handleSleepTimerEnded,
            true
        );

        chrome.runtime.sendMessage({
            type: "sleep-timer-content-ready"
        }).then(response => {
            sleepTimerEndArmed = response?.armed === true;
        }).catch(() => {});

        document.addEventListener(
            "loadedmetadata",
            () => syncPlaybackUtilities(provider),
            true
        );

        document.addEventListener(
            "play",
            () => syncPlaybackRate(provider),
            true
        );

        playbackUtilityTimer = createProviderResourceLoop(
            `playback-utilities-${provider}`,
            () => syncPlaybackUtilities(provider),
            1200,
            "poll"
        );

        onProviderResourceGovernorChange(() => {
            syncPlaybackUtilities(provider);
        });
    }
    /*
     * ============================================================
     * DISNEY+ PROVIDER ADAPTER
     * ============================================================
     * Owns the Disney+-specific watch-route/title/subtitle contract.
     * The subtitle renderer is still styled by shared CSS, but marker and
     * runtime state now live behind the provider adapter instead of the
     * generic playback utility layer knowing Disney+ details directly.
     */

    let disneyAdapterNavigationTimer = null;

    const DISNEY_ADAPTER_TITLE_SELECTORS = [
        '[data-testid="title"]',
        '[class*="player"] h1',
        '[class*="Player"] h1'
    ];

    const DISNEY_ADAPTER_SUBTITLE_SELECTORS = [
        'span.dss-subtitle-renderer-cue',
        '.dss-subtitle-renderer-cue-window',
        '.dss-subtitle-renderer-line'
    ];

    function isDisneyAdapterWatchContext() {
        const path = String(window.location.pathname || "");
        return (
            path.includes("/video/") ||
            path.includes("/play/")
        ) && Boolean(getPrimaryVideo());
    }

    function getDisneyAdapterTitle() {
        return cleanProviderTitle(
            getTextFromSelectors(DISNEY_ADAPTER_TITLE_SELECTORS) ||
            getMetaContent('meta[property="og:title"]') ||
            document.title,
            "disney"
        );
    }

    function setDisneyAdapterBooleanMarker(attribute, enabled) {
        const root = document.documentElement;
        if (!root) return false;

        if (enabled) {
            root.setAttribute(attribute, "true");
        } else {
            root.removeAttribute(attribute);
        }

        return true;
    }

    function syncDisneyAdapterSubtitleStyling(
        settings = playbackUtilitySettings
    ) {
        const root = document.documentElement;
        if (!root) return false;

        if (isProviderSafeModeEnabled("disney")) {
            clearGenericSubtitleSafeModeState();
            providerApiNotifyExtensionChange("disneySubtitleStyling", {
                enabled: false,
                anarchy: false,
                safeMode: true
            });
            return true;
        }

        const anarchy = subtitleAnarchyEnabled("disney");
        const enabled = anarchy || settings[
            "streamShellSubtitleOverride_disney"
        ] === true;

        setDisneyAdapterBooleanMarker(
            "data-stream-shell-subtitle-override",
            enabled
        );
        root.setAttribute(
            "data-stream-shell-subtitle-provider",
            "disney"
        );

        if (!anarchy) {
            root.style.setProperty(
                "--stream-shell-subtitle-scale",
                String(normalizeSubtitleScale(
                    settings["streamShellSubtitleScale_disney"]
                ))
            );
            root.style.setProperty(
                "--stream-shell-subtitle-color",
                normalizeSubtitleColor(
                    settings["streamShellSubtitleColor_disney"]
                )
            );
        }

        const font = String(
            settings["streamShellSubtitleFont_disney"] || "default"
        );
        const stack = SUBTITLE_FONT_STACKS[font];

        setDisneyAdapterBooleanMarker(
            "data-stream-shell-subtitle-font-override",
            Boolean(stack)
        );

        if (stack) {
            root.style.setProperty(
                "--stream-shell-subtitle-font",
                stack
            );
        } else {
            root.style.removeProperty(
                "--stream-shell-subtitle-font"
            );
        }

        providerApiNotifyExtensionChange("disneySubtitleStyling", {
            enabled,
            anarchy
        });

        return true;
    }

    function getDisneyAdapterExtensionState() {
        const root = document.documentElement;
        const title = getDisneyAdapterTitle();
        const safeMode = isProviderSafeModeEnabled("disney");
        const subtitleNodes = document.querySelectorAll(
            DISNEY_ADAPTER_SUBTITLE_SELECTORS.join(",")
        ).length;
        const marker = root?.getAttribute(
            "data-stream-shell-subtitle-override"
        ) || null;
        const providerMarker = root?.getAttribute(
            "data-stream-shell-subtitle-provider"
        ) || null;
        const fontMarker = root?.getAttribute(
            "data-stream-shell-subtitle-font-override"
        ) || null;

        return {
            safeMode,
            metadata: {
                titleAvailable: Boolean(title),
                source: title ? "player-or-page-dom" : "waiting"
            },
            subtitles: {
                enabled: !safeMode && playbackUtilitySettings[
                    "streamShellSubtitleOverride_disney"
                ] === true,
                configuredEnabled: playbackUtilitySettings[
                    "streamShellSubtitleOverride_disney"
                ] === true,
                anarchy: !safeMode && playbackUtilitySettings[
                    "streamShellSubtitleAnarchy"
                ] === true,
                configuredAnarchy: playbackUtilitySettings[
                    "streamShellSubtitleAnarchy"
                ] === true,
                suppressed: safeMode,
                marker: marker === "true",
                providerMarker,
                fontMarker: fontMarker === "true",
                configuredScale: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleScale_disney"
                    ] ?? "1"
                ),
                configuredColor: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleColor_disney"
                    ] || "#ffffff"
                ),
                configuredFont: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleFont_disney"
                    ] || "default"
                ),
                appliedScale: root?.style?.getPropertyValue(
                    "--stream-shell-subtitle-scale"
                ) || null,
                appliedColor: root?.style?.getPropertyValue(
                    "--stream-shell-subtitle-color"
                ) || null,
                cueNodes: subtitleNodes
            },
            rootReady: Boolean(root),
            watchContext: isDisneyAdapterWatchContext()
        };
    }

    function getDisneyAdapterExtensionCapabilities({ watchContext }) {
        const state = getDisneyAdapterExtensionState();
        const subtitleEnabled = state.subtitles.enabled ||
            state.subtitles.anarchy;

        return {
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable ? "ready" : "waiting"
            ),
            subtitleStyling: makeCapability(
                true,
                state.rootReady,
                state.subtitles.anarchy
                    ? "anarchy"
                    : (subtitleEnabled
                        ? `on · ${state.subtitles.configuredScale}x`
                        : "off"),
                state.subtitles.cueNodes > 0
                    ? `${state.subtitles.cueNodes} cue node(s)`
                    : "cue DOM not currently visible"
            ),
            playerRoute: makeCapability(
                true,
                watchContext,
                watchContext ? "active" : "inactive"
            )
        };
    }

    function startDisneyAdapterNavigationWatch(
        emitState,
        applyPendingResume
    ) {
        if (disneyAdapterNavigationTimer) return;

        let lastUrl = String(location.href || "");

        disneyAdapterNavigationTimer = createProviderResourceLoop(
            "disney-navigation",
            () => {
                const nextUrl = String(location.href || "");
                if (nextUrl === lastUrl) return;

                lastUrl = nextUrl;
                emitState?.("disney-navigation");
                setTimeout(
                    () => applyPendingResume?.(),
                    80
                );
            },
            750,
            "navigation"
        );
    }

    function createDisneyProviderAdapter(baseAdapter) {
        const extensions = {
            subtitleStyling: {
                sync: syncDisneyAdapterSubtitleStyling,
                getState: () => getDisneyAdapterExtensionState().subtitles
            },
            metadata: {
                getState: () => getDisneyAdapterExtensionState().metadata
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "disney",
            resumeStrategy: "clean-player-url + pending-seek (unverified)",
            linkResolverStrategy: "canonical provider fallback (identity mapping unverified)",
            resumeConfirmation: {
                delayMs: 350,
                checks: 2,
                toleranceSeconds: 5
            },
            extensions,
            isWatchContext: isDisneyAdapterWatchContext,
            getTitle: async () => getDisneyAdapterTitle(),
            getExtensionState: getDisneyAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                startDisneyAdapterNavigationWatch(
                    emitState,
                    applyPendingResume
                );
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("disney", adapter);
        adapter.getExtensionCapabilities = context =>
            getDisneyAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("disney", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "disney",
        createDisneyProviderAdapter
    );
    /*
     * ============================================================
     * NETFLIX ENHANCEMENTS
     * ============================================================
     * Settings + scheduling lifecycle only. Netflix DOM knowledge now
     * lives in the dedicated Provider API adapter.
     */

    const NETFLIX_ENHANCEMENT_DEFAULTS = {
        streamShellNetflixAutoSkipIntro: false,
        streamShellNetflixAutoSkipRecap: false,
        streamShellNetflixAutoNextEpisode: false,
        streamShellNetflixContinueWatching: true
    };

    let netflixEnhancementSettings = {
        ...NETFLIX_ENHANCEMENT_DEFAULTS
    };

    let netflixEnhancementObserver = null;
    let netflixEnhancementObserverActive = false;
    let netflixEnhancementTimer = null;
    let netflixEnhancementScheduleTimer = null;

    function runNetflixEnhancements() {
        const automation = getProviderAdapter("netflix")
            ?.extensions
            ?.automation;

        if (typeof automation?.run !== "function") {
            return false;
        }

        try {
            return automation.run(netflixEnhancementSettings) === true;
        } catch {
            return false;
        }
    }

    function scheduleNetflixEnhancementRun() {
        if (netflixEnhancementScheduleTimer) {
            return;
        }

        netflixEnhancementScheduleTimer = setTimeout(
            () => {
                netflixEnhancementScheduleTimer = null;
                runNetflixEnhancements();
            },
            100
        );
    }


    function syncNetflixEnhancementObserver() {
        if (typeof MutationObserver !== "function") {
            return false;
        }

        const automationEnabled = Boolean(
            netflixEnhancementSettings.streamShellNetflixAutoSkipIntro ||
            netflixEnhancementSettings.streamShellNetflixAutoSkipRecap ||
            netflixEnhancementSettings.streamShellNetflixAutoNextEpisode ||
            netflixEnhancementSettings.streamShellNetflixContinueWatching
        );

        const shouldObserve =
            automationEnabled &&
            !isProviderSafeModeEnabled("netflix") &&
            shouldProviderResourceObserveDom();

        if (!netflixEnhancementObserver) {
            netflixEnhancementObserver = new MutationObserver(
                scheduleNetflixEnhancementRun
            );
        }

        if (shouldObserve && !netflixEnhancementObserverActive) {
            netflixEnhancementObserver.observe(
                document.documentElement,
                {
                    childList: true,
                    subtree: true
                }
            );
            netflixEnhancementObserverActive = true;
            return true;
        }

        if (!shouldObserve && netflixEnhancementObserverActive) {
            netflixEnhancementObserver.disconnect();
            netflixEnhancementObserverActive = false;
        }

        return netflixEnhancementObserverActive;
    }

    async function startNetflixEnhancements() {
        if (getCurrentProvider() !== "netflix") {
            return;
        }

        try {
            const stored = await chrome.storage.local.get(
                Object.keys(NETFLIX_ENHANCEMENT_DEFAULTS)
            );

            netflixEnhancementSettings = {
                ...NETFLIX_ENHANCEMENT_DEFAULTS,
                ...stored
            };
        } catch {
        }

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                for (const [key, change] of Object.entries(changes)) {
                    if (!Object.prototype.hasOwnProperty.call(
                        NETFLIX_ENHANCEMENT_DEFAULTS,
                        key
                    )) {
                        continue;
                    }

                    netflixEnhancementSettings[key] = change.newValue === undefined
                        ? NETFLIX_ENHANCEMENT_DEFAULTS[key]
                        : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    syncNetflixEnhancementObserver();
                    scheduleNetflixEnhancementRun();
                    providerApiNotifyExtensionChange("netflixAutomationSettings");
                }
            }
        );

        syncNetflixEnhancementObserver();

        netflixEnhancementTimer = createProviderResourceLoop(
            "netflix-enhancements",
            runNetflixEnhancements,
            750,
            "dom"
        );

        onProviderResourceGovernorChange(() => {
            syncNetflixEnhancementObserver();
            scheduleNetflixEnhancementRun();
        });

        runNetflixEnhancements();
    }
    /*
     * ============================================================
     * NETFLIX PROVIDER ADAPTER
     * ============================================================
     * Owns Netflix-specific DOM/UI knowledge. The enhancement lifecycle,
     * Now Playing, diagnostics and future shell features consume this
     * adapter instead of reaching into Netflix selectors directly.
     */

    const NETFLIX_ADAPTER_ACTIONS = {
        continueWatching: {
            selectors: [
                "button[data-uia='interrupt-autoplay-continue']"
            ],
            tokens: [
                "continue playing",
                "weiter ansehen",
                "weiterschauen",
                "continue watching"
            ]
        },
        skipRecap: {
            selectors: [
                "button[data-uia='player-skip-recap']"
            ],
            tokens: [
                "skip recap",
                "zusammenfassung überspringen",
                "zusammenfassung ueberspringen"
            ]
        },
        skipIntro: {
            selectors: [
                "button[data-uia='player-skip-intro']",
                ".watch-video--skip-content-button"
            ],
            tokens: [
                "skip intro",
                "intro überspringen",
                "intro ueberspringen",
                "vorspann überspringen",
                "vorspann ueberspringen"
            ]
        },
        nextEpisode: {
            selectors: [
                "button[data-uia='next-episode-seamless-button']",
                "button[data-uia='next-episode-seamless-button-draining']",
                ".watch-video--skip-preplay-button"
            ],
            tokens: [
                "next episode",
                "nächste folge",
                "naechste folge"
            ]
        }
    };

    let netflixAdapterLastUrl = String(location.href || "");
    let netflixAdapterEmitState = null;
    let netflixAdapterApplyPendingResume = null;
    const NETFLIX_ADAPTER_SEMANTIC_SCAN_COOLDOWN_MS = 3000;
    const netflixAdapterSemanticActionCache = new Map();

    const NETFLIX_PLAYER_BRIDGE_CHANNEL = "stream-shell-netflix-player-bridge-v1";
    const netflixPlayerBridgePending = new Map();
    let netflixPlayerBridgeSequence = 0;
    let netflixPlayerBridgeReady = false;
    let netflixPlayerBridgeLastAckAt = 0;
    let netflixPlayerBridgeLastError = null;

    function handleNetflixPlayerBridgeMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.__streamShellNetflixBridge !== NETFLIX_PLAYER_BRIDGE_CHANNEL) return;

        if (data.type === "ready") {
            const wasReady = netflixPlayerBridgeReady;
            netflixPlayerBridgeReady = true;
            netflixPlayerBridgeLastError = null;
            if (!wasReady) {
                recordProviderFlightEvent("ready", {
                    category: "netflix-bridge",
                    provider: "netflix"
                });
            }
            return;
        }

        if (data.type !== "ack" || !data.id) return;
        const pending = netflixPlayerBridgePending.get(String(data.id));
        if (!pending) return;

        netflixPlayerBridgePending.delete(String(data.id));
        clearTimeout(pending.timer);
        netflixPlayerBridgeReady = true;
        netflixPlayerBridgeLastAckAt = Date.now();
        netflixPlayerBridgeLastError = data.ok === true ? null : String(data.error || "bridge-command-failed");
        recordProviderFlightEvent(
            data.ok === true ? "result" : "error",
            {
                category: "netflix-bridge",
                level: data.ok === true ? "info" : "error",
                provider: "netflix",
                detail: {
                    action: pending.action || "unknown",
                    error: data.ok === true ? null : netflixPlayerBridgeLastError
                }
            }
        );
        pending.resolve({
            ok: data.ok === true,
            result: data.result,
            error: data.error || null
        });
    }

    window.addEventListener("message", handleNetflixPlayerBridgeMessage);

    function sendNetflixPlayerBridgeCommand(action, payload = {}, timeoutMs = 900) {
        const id = `ss-nf-${Date.now().toString(36)}-${(++netflixPlayerBridgeSequence).toString(36)}`;
        const timeout = Math.max(250, Number(timeoutMs) || 900);

        recordProviderFlightEvent("command", {
            category: "netflix-bridge",
            provider: "netflix",
            detail: { action: String(action || "") }
        });

        return new Promise(resolve => {
            const timer = setTimeout(() => {
                netflixPlayerBridgePending.delete(id);
                netflixPlayerBridgeLastError = "bridge-timeout";
                recordProviderFlightEvent("error", {
                    category: "netflix-bridge",
                    level: "error",
                    provider: "netflix",
                    detail: {
                        action: String(action || ""),
                        error: "bridge-timeout"
                    }
                });
                resolve({ ok: false, result: null, error: "bridge-timeout" });
            }, timeout);

            netflixPlayerBridgePending.set(id, {
                resolve,
                timer,
                action: String(action || "")
            });
            window.postMessage({
                __streamShellNetflixBridge: NETFLIX_PLAYER_BRIDGE_CHANNEL,
                type: "command",
                id,
                action: String(action || ""),
                payload
            }, "*");
        });
    }

    async function probeNetflixPlayerBridge() {
        const response = await sendNetflixPlayerBridgeCommand("ping", {}, 700);
        netflixPlayerBridgeReady = response.ok === true;
        if (!response.ok) netflixPlayerBridgeLastError = response.error || "bridge-unavailable";
        return response.ok === true;
    }

    async function netflixAdapterBridgePlay() {
        const response = await sendNetflixPlayerBridgeCommand("play", {}, 1000);
        return response.ok === true;
    }

    async function netflixAdapterBridgePause() {
        const response = await sendNetflixPlayerBridgeCommand("pause", {}, 1000);
        return response.ok === true;
    }

    async function netflixAdapterBridgeSeekTo(seconds) {
        const video = getPrimaryVideo();
        const value = Number(seconds);
        if (!Number.isFinite(value)) return false;

        const duration = Number.isFinite(video?.duration) && video.duration > 0
            ? video.duration
            : null;
        const safeTarget = Math.max(
            0,
            duration ? Math.min(value, Math.max(0, duration - .25)) : value
        );

        const response = await sendNetflixPlayerBridgeCommand(
            "seek",
            { milliseconds: Math.round(safeTarget * 1000) },
            1100
        );
        return response.ok === true;
    }

    async function netflixAdapterBridgeSeekBy(seconds) {
        const video = getPrimaryVideo();
        const delta = Number(seconds);
        if (!video || !Number.isFinite(delta)) return false;
        return netflixAdapterBridgeSeekTo(Number(video.currentTime || 0) + delta);
    }

    async function netflixAdapterBridgeSetPlaybackRate(value) {
        const rate = Number(value);
        if (!Number.isFinite(rate) || rate <= 0) return false;
        const response = await sendNetflixPlayerBridgeCommand(
            "setPlaybackRate",
            { rate },
            1000
        );
        return response.ok === true;
    }

    async function netflixAdapterBridgeSetVolume(value) {
        const volume = Number(value);
        if (!Number.isFinite(volume)) return false;
        const response = await sendNetflixPlayerBridgeCommand(
            "setVolume",
            { volume: Math.max(0, Math.min(1, volume)) },
            1000
        );
        return response.ok === true;
    }

    function getNetflixPlayerBridgeState() {
        return {
            ready: netflixPlayerBridgeReady,
            lastAckAt: netflixPlayerBridgeLastAckAt || null,
            lastError: netflixPlayerBridgeLastError,
            commandPath: "main-world-netflix-player-api"
        };
    }

    function netflixAdapterElementVisible(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0 &&
            rect.width > 0 &&
            rect.height > 0;
    }

    function normalizeNetflixAdapterActionText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase();
    }

    function findNetflixAdapterSemanticButton(actionName, tokens) {
        const cached = netflixAdapterSemanticActionCache.get(actionName);
        if (
            cached?.element?.isConnected &&
            netflixAdapterElementVisible(cached.element)
        ) {
            const cachedText = normalizeNetflixAdapterActionText([
                cached.element.getAttribute?.("aria-label"),
                cached.element.getAttribute?.("data-uia"),
                cached.element.textContent
            ].filter(Boolean).join(" "));

            if (tokens.some(token => cachedText.includes(token))) {
                return cached.element;
            }
        }

        const now = Date.now();
        if (
            cached &&
            now - cached.checkedAt < NETFLIX_ADAPTER_SEMANTIC_SCAN_COOLDOWN_MS
        ) {
            return null;
        }

        const candidates = document.querySelectorAll(
            "button, [role='button'], a[aria-label], button[aria-label]"
        );

        for (const element of candidates) {
            if (!netflixAdapterElementVisible(element)) {
                continue;
            }

            const text = normalizeNetflixAdapterActionText([
                element.getAttribute?.("aria-label"),
                element.getAttribute?.("data-uia"),
                element.textContent
            ].filter(Boolean).join(" "));

            if (tokens.some(token => text.includes(token))) {
                netflixAdapterSemanticActionCache.set(actionName, {
                    checkedAt: now,
                    element
                });
                return element;
            }
        }

        netflixAdapterSemanticActionCache.set(actionName, {
            checkedAt: now,
            element: null
        });
        return null;
    }

    function findNetflixAdapterAction(actionName, includeSemantic = true) {
        const definition = NETFLIX_ADAPTER_ACTIONS[actionName];
        if (!definition) return null;

        for (const selector of definition.selectors) {
            const element = document.querySelector(selector);
            if (netflixAdapterElementVisible(element)) {
                return element;
            }
        }

        return includeSemantic
            ? findNetflixAdapterSemanticButton(actionName, definition.tokens)
            : null;
    }

    function triggerNetflixAdapterAction(actionName) {
        if (isProviderSafeModeEnabled("netflix")) return false;

        const element = findNetflixAdapterAction(actionName, true);
        if (!element) return false;

        try {
            element.click();
            if (actionName === "skipRecap" || actionName === "skipIntro") {
                recordProviderFlightEvent("executed", {
                    category: "skip",
                    provider: "netflix",
                    detail: { kind: actionName === "skipRecap" ? "recap" : "intro" }
                });
            }
            return true;
        } catch {
            return false;
        }
    }

    function syncNetflixAdapterNavigation() {
        const currentUrl = String(location.href || "");
        if (currentUrl === netflixAdapterLastUrl) {
            return false;
        }

        netflixAdapterLastUrl = currentUrl;
        netflixAdapterSemanticActionCache.clear();
        netflixAdapterEmitState?.("netflix-navigation");
        setTimeout(() => probeNetflixPlayerBridge(), 60);
        setTimeout(
            () => netflixAdapterApplyPendingResume?.(),
            120
        );
        return true;
    }

    function runNetflixAdapterAutomation(settings = netflixEnhancementSettings) {
        syncNetflixAdapterNavigation();

        if (isProviderSafeModeEnabled("netflix")) {
            return false;
        }

        if (!/^\/watch\//i.test(String(location.pathname || ""))) {
            return false;
        }

        let triggered = false;

        if (settings?.streamShellNetflixContinueWatching === true) {
            triggered = triggerNetflixAdapterAction("continueWatching") || triggered;
        }

        if (settings?.streamShellNetflixAutoSkipRecap === true) {
            triggered = triggerNetflixAdapterAction("skipRecap") || triggered;
        }

        if (settings?.streamShellNetflixAutoSkipIntro === true) {
            triggered = triggerNetflixAdapterAction("skipIntro") || triggered;
        }

        if (settings?.streamShellNetflixAutoNextEpisode === true) {
            triggered = triggerNetflixAdapterAction("nextEpisode") || triggered;
        }

        return triggered;
    }

    function getNetflixAdapterActionState(actionName, enabled) {
        const watchContext = /^\/watch\//i.test(String(location.pathname || ""));
        const safeMode = isProviderSafeModeEnabled("netflix");
        const buttonPresent = watchContext && Boolean(
            findNetflixAdapterAction(actionName, true)
        );

        return {
            enabled: !safeMode && enabled === true,
            configuredEnabled: enabled === true,
            watchContext,
            buttonPresent
        };
    }

    function getNetflixAdapterExtensionState() {
        const root = document.documentElement;
        const watchContext = /^\/watch\//i.test(String(location.pathname || ""));
        const wallpaperMarker = Boolean(
            root?.hasAttribute("data-stream-shell-netflix-wallpaper")
        );
        const titleAvailable = Boolean(
            getNetflixDomProviderTitle()
        );
        const safeMode = isProviderSafeModeEnabled("netflix");

        return {
            safeMode,
            playerBridge: getNetflixPlayerBridgeState(),
            metadata: {
                titleAvailable,
                source: titleAvailable ? "player-dom" : "waiting"
            },
            wallpaper: {
                marker: wallpaperMarker,
                playbackRoute: watchContext,
                state: safeMode
                    ? "safe-mode"
                    : (wallpaperMarker
                        ? "on"
                        : (watchContext ? "suppressed-on-playback" : "off-or-disabled"))
            },
            continueWatching: getNetflixAdapterActionState(
                "continueWatching",
                netflixEnhancementSettings.streamShellNetflixContinueWatching
            ),
            skipRecap: getNetflixAdapterActionState(
                "skipRecap",
                netflixEnhancementSettings.streamShellNetflixAutoSkipRecap
            ),
            skipIntro: getNetflixAdapterActionState(
                "skipIntro",
                netflixEnhancementSettings.streamShellNetflixAutoSkipIntro
            ),
            nextEpisode: getNetflixAdapterActionState(
                "nextEpisode",
                netflixEnhancementSettings.streamShellNetflixAutoNextEpisode
            )
        };
    }

    function getNetflixAdapterExtensionCapabilities({ watchContext }) {
        const state = getNetflixAdapterExtensionState();

        const automationCapability = automationState => makeCapability(
            true,
            watchContext,
            automationState.enabled
                ? (automationState.buttonPresent ? "ready-now" : "armed")
                : "disabled"
        );

        return {
            playerBridge: makeCapability(
                true,
                state.playerBridge.ready,
                state.playerBridge.ready ? "ready" : "waiting",
                state.playerBridge.lastError || state.playerBridge.commandPath
            ),
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable ? "ready" : "waiting"
            ),
            continueWatching: automationCapability(state.continueWatching),
            skipRecap: automationCapability(state.skipRecap),
            skipIntro: automationCapability(state.skipIntro),
            nextEpisode: automationCapability(state.nextEpisode),
            wallpaper: makeCapability(
                true,
                Boolean(document.documentElement),
                state.wallpaper.state
            )
        };
    }

    function createNetflixProviderAdapter(baseAdapter) {
        const extensions = {
            metadata: {
                getTitle: getNetflixProviderTitle,
                getState: () => getNetflixAdapterExtensionState().metadata
            },
            automation: {
                run: runNetflixAdapterAutomation,
                getState: getNetflixAdapterExtensionState
            },
            continueWatching: {
                trigger: () => triggerNetflixAdapterAction("continueWatching"),
                getState: () => getNetflixAdapterExtensionState().continueWatching
            },
            skipRecap: {
                trigger: () => triggerNetflixAdapterAction("skipRecap"),
                getState: () => getNetflixAdapterExtensionState().skipRecap
            },
            skipIntro: {
                trigger: () => triggerNetflixAdapterAction("skipIntro"),
                getState: () => getNetflixAdapterExtensionState().skipIntro
            },
            nextEpisode: {
                trigger: () => triggerNetflixAdapterAction("nextEpisode"),
                getState: () => getNetflixAdapterExtensionState().nextEpisode
            },
            wallpaper: {
                getState: () => getNetflixAdapterExtensionState().wallpaper
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "netflix",
            resumeStrategy: "clean-watch-url + main-world-player-api seek",
            linkResolverStrategy: "watch-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 350,
                checks: 2,
                toleranceSeconds: 5
            },
            extensions,
            getTitle: getNetflixProviderTitle,
            getExtensionState: getNetflixAdapterExtensionState,
            play: netflixAdapterBridgePlay,
            pause: netflixAdapterBridgePause,
            seekTo: netflixAdapterBridgeSeekTo,
            seekBy: netflixAdapterBridgeSeekBy,
            setPlaybackRate: netflixAdapterBridgeSetPlaybackRate,
            setVolume: netflixAdapterBridgeSetVolume,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                netflixAdapterEmitState = emitState || null;
                netflixAdapterApplyPendingResume = applyPendingResume || null;
                netflixAdapterLastUrl = String(location.href || "");
                setTimeout(() => probeNetflixPlayerBridge(), 80);
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("netflix", adapter);
        adapter.getExtensionCapabilities = context =>
            getNetflixAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("netflix", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "netflix",
        createNetflixProviderAdapter
    );
    /*
     * ============================================================
     * CRUNCHYROLL ENHANCEMENTS
     * ============================================================
     * Settings/lifecycle layer only. Crunchyroll-specific route, player,
     * skip-event, presentation and marker behavior lives in
     * provider-adapter-crunchyroll.
     */

    const CRUNCHYROLL_ENHANCEMENT_DEFAULTS = {
        streamShellCrunchyrollAutoSkipIntro: false,
        streamShellCrunchyrollAutoSkipRecap: false,
        streamShellCrunchyrollAutoSkipCredits: false,
        streamShellCrunchyrollBlurEpisodeThumbnails: false
    };

    let crunchyrollEnhancementSettings = {
        ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS
    };

    async function startCrunchyrollEnhancements() {
        if (getCurrentProvider() !== "crunchyroll") {
            return;
        }

        try {
            const stored = await chrome.storage.local.get(
                Object.keys(CRUNCHYROLL_ENHANCEMENT_DEFAULTS)
            );

            crunchyrollEnhancementSettings = {
                ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                ...stored
            };
        } catch {
        }

        const adapter = getProviderAdapter("crunchyroll");
        adapter?.extensions?.enhancements?.start?.();

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                for (const [key, change] of Object.entries(changes)) {
                    if (!Object.prototype.hasOwnProperty.call(
                        CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                        key
                    )) {
                        continue;
                    }

                    crunchyrollEnhancementSettings[key] =
                        change.newValue === undefined
                            ? CRUNCHYROLL_ENHANCEMENT_DEFAULTS[key]
                            : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    adapter?.extensions?.enhancements
                        ?.syncSettings?.();
                }
            }
        );
    }
    /*
     * ============================================================
     * CRUNCHYROLL PROVIDER ADAPTER
     * ============================================================
     * Owns Crunchyroll-specific route/player knowledge, windowed-mode
     * targeting, skip-event automation, spoiler presentation and diagnostics
     * state.
     */

    let crunchyrollAdapterSkipEvents = null;
    let crunchyrollAdapterSkipEventsEpisodeId = "";
    let crunchyrollAdapterEnhancementTimer = null;
    let crunchyrollAdapterNavigationTimer = null;
    let crunchyrollAdapterLastUrl = String(location.href || "");
    const crunchyrollAdapterNavigationListeners = new Set();

    function getCrunchyrollAdapterEpisodeId() {
        const match = String(location.pathname || "")
            .match(/^\/watch\/([A-Z0-9]+)/i);
        return String(match?.[1] || "").toUpperCase();
    }

    function isCrunchyrollAdapterWatchContext() {
        return /^\/watch\//i.test(
            String(window.location.pathname || "")
        );
    }

    function crunchyrollAdapterSubscribeNavigation(listener) {
        if (typeof listener === "function") {
            crunchyrollAdapterNavigationListeners.add(listener);
        }

        if (crunchyrollAdapterNavigationTimer) return;

        crunchyrollAdapterLastUrl = String(location.href || "");
        crunchyrollAdapterNavigationTimer = createProviderResourceLoop(
            "crunchyroll-navigation",
            () => {
                const nextUrl = String(location.href || "");
                if (nextUrl === crunchyrollAdapterLastUrl) return;

                const previousUrl = crunchyrollAdapterLastUrl;
                crunchyrollAdapterLastUrl = nextUrl;

                for (const callback of [...crunchyrollAdapterNavigationListeners]) {
                    try {
                        callback({ previousUrl, nextUrl });
                    } catch {
                    }
                }
            },
            400,
            "navigation"
        );
    }

    function setCrunchyrollAdapterBooleanMarker(attribute, enabled) {
        const root = document.documentElement;
        if (!root) return false;

        if (enabled) {
            root.setAttribute(attribute, "true");
        } else {
            root.removeAttribute(attribute);
        }
        return true;
    }

    function syncCrunchyrollAdapterPresentation(
        settings = crunchyrollEnhancementSettings
    ) {
        const enabled = !isProviderSafeModeEnabled("crunchyroll") &&
            settings?.streamShellCrunchyrollBlurEpisodeThumbnails === true;

        setCrunchyrollAdapterBooleanMarker(
            "data-stream-shell-crunchyroll-blur-thumbnails",
            enabled
        );

        providerApiNotifyExtensionChange("crunchyrollPresentation", {
            blurEpisodeThumbnails: enabled
        });

        return true;
    }

    async function loadCrunchyrollAdapterSkipEvents(force = false) {
        const episodeId = getCrunchyrollAdapterEpisodeId();

        if (!episodeId) {
            const changed = Boolean(
                crunchyrollAdapterSkipEventsEpisodeId ||
                crunchyrollAdapterSkipEvents
            );
            crunchyrollAdapterSkipEvents = null;
            crunchyrollAdapterSkipEventsEpisodeId = "";
            if (changed) {
                providerApiNotifyExtensionChange("crunchyrollSkipData", {
                    state: "inactive"
                });
            }
            return false;
        }

        if (
            !force &&
            episodeId === crunchyrollAdapterSkipEventsEpisodeId
        ) {
            return Boolean(crunchyrollAdapterSkipEvents);
        }

        crunchyrollAdapterSkipEventsEpisodeId = episodeId;
        crunchyrollAdapterSkipEvents = null;

        try {
            const response = await chrome.runtime.sendMessage({
                type: "crunchyroll-skip-events",
                episodeId
            });

            if (
                response?.ok &&
                response.events &&
                typeof response.events === "object"
            ) {
                crunchyrollAdapterSkipEvents = response.events;
                const eventKinds = Object.keys(response.events);
                providerApiNotifyExtensionChange("crunchyrollSkipData", {
                    state: "loaded",
                    eventKinds
                });
                recordProviderFlightEvent("detected", {
                    category: "skip",
                    provider: "crunchyroll",
                    detail: { kinds: eventKinds }
                });
                return true;
            }
        } catch {
        }

        providerApiNotifyExtensionChange("crunchyrollSkipData", {
            state: "unavailable"
        });
        return false;
    }

    function crunchyrollAdapterEventEnabled(
        kind,
        settings = crunchyrollEnhancementSettings
    ) {
        if (isProviderSafeModeEnabled("crunchyroll")) return false;

        if (kind === "intro") {
            return settings?.streamShellCrunchyrollAutoSkipIntro === true;
        }
        if (kind === "recap") {
            return settings?.streamShellCrunchyrollAutoSkipRecap === true;
        }
        if (kind === "credits") {
            return settings?.streamShellCrunchyrollAutoSkipCredits === true;
        }
        return false;
    }

    function getCrunchyrollAdapterEvent(kind) {
        const event = crunchyrollAdapterSkipEvents?.[kind];
        const start = Number(event?.start);
        const end = Number(event?.end);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return null;
        }

        return { start, end };
    }

    function runCrunchyrollAdapterAutoSkip(
        settings = crunchyrollEnhancementSettings
    ) {
        const video = getPrimaryVideo();
        if (!video || !crunchyrollAdapterSkipEvents) return false;

        const currentTime = Number(video.currentTime);
        if (!Number.isFinite(currentTime)) return false;

        for (const kind of ["recap", "intro", "credits"]) {
            if (!crunchyrollAdapterEventEnabled(kind, settings)) {
                continue;
            }

            const event = getCrunchyrollAdapterEvent(kind);
            if (!event) continue;

            if (
                currentTime >= event.start &&
                currentTime < event.end - 0.08
            ) {
                const target = Math.min(
                    Number.isFinite(video.duration)
                        ? video.duration
                        : event.end + 0.05,
                    event.end + 0.05
                );

                try {
                    video.currentTime = target;
                    providerApiNotifyExtensionChange(
                        "crunchyrollAutoSkip",
                        { kind, target }
                    );
                    recordProviderFlightEvent("executed", {
                        category: "skip",
                        provider: "crunchyroll",
                        detail: { kind, target }
                    });
                    return true;
                } catch {
                    return false;
                }
            }
        }

        return false;
    }

    function syncCrunchyrollAdapterWindowedPlayer(enabled) {
        const active = !isProviderSafeModeEnabled("crunchyroll") &&
            Boolean(enabled) &&
            isCrunchyrollAdapterWatchContext();

        setWindowedPlayerRootMarker(
            "crunchyroll",
            active
        );

        providerApiNotifyExtensionChange("windowedPlayer", {
            active
        });
        return active;
    }

    function crunchyrollAdapterMatchesPlayerTarget(target) {
        return target instanceof Element && Boolean(
            target.closest(
                "#vilosRoot, #velocity-player-package, " +
                "[data-testid*='player'], .video-player-wrapper, " +
                "#player-container, .bitmovinplayer-container"
            )
        );
    }

    function getCrunchyrollAdapterSkipState(
        kind,
        settings = crunchyrollEnhancementSettings
    ) {
        const watchContext = isCrunchyrollAdapterWatchContext();
        const enabled = crunchyrollAdapterEventEnabled(kind, settings);
        const event = getCrunchyrollAdapterEvent(kind);

        return {
            enabled,
            watchContext,
            eventAvailable: Boolean(event),
            start: event?.start ?? null,
            end: event?.end ?? null
        };
    }

    function getCrunchyrollAdapterExtensionState() {
        const root = document.documentElement;
        const windowedMarker = root?.getAttribute(
            "data-stream-shell-windowed-player"
        ) || null;
        const blurMarker = root?.getAttribute(
            "data-stream-shell-crunchyroll-blur-thumbnails"
        ) || null;
        const safeMode = isProviderSafeModeEnabled("crunchyroll");
        const titleAvailable = Boolean(
            cleanProviderTitle(
                getCrunchyrollProviderTitle(),
                "crunchyroll"
            )
        );

        return {
            safeMode,
            metadata: {
                titleAvailable
            },
            windowedPlayer: {
                active: windowedMarker === "crunchyroll",
                watchContext: isCrunchyrollAdapterWatchContext(),
                playerTargetPresent: Boolean(document.querySelector(
                    "#vilosRoot, #velocity-player-package, " +
                    "[data-testid*='player'], .video-player-wrapper, " +
                    "#player-container, .bitmovinplayer-container"
                ))
            },
            skipData: {
                episodeId: getCrunchyrollAdapterEpisodeId() || null,
                loadedEpisodeId: crunchyrollAdapterSkipEventsEpisodeId || null,
                loaded: Boolean(crunchyrollAdapterSkipEvents),
                eventKinds: crunchyrollAdapterSkipEvents
                    ? Object.keys(crunchyrollAdapterSkipEvents)
                    : []
            },
            skipIntro: getCrunchyrollAdapterSkipState("intro"),
            skipRecap: getCrunchyrollAdapterSkipState("recap"),
            skipCredits: getCrunchyrollAdapterSkipState("credits"),
            spoilerProtection: {
                enabled: !safeMode && crunchyrollEnhancementSettings
                    .streamShellCrunchyrollBlurEpisodeThumbnails === true,
                configuredEnabled: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollBlurEpisodeThumbnails === true,
                marker: blurMarker === "true"
            },
            rootReady: Boolean(root)
        };
    }

    function getCrunchyrollAdapterExtensionCapabilities({ watchContext }) {
        const state = getCrunchyrollAdapterExtensionState();

        const skipCapability = skipState => makeCapability(
            true,
            watchContext,
            skipState.enabled
                ? (skipState.eventAvailable ? "armed · timing ready" : "armed · timing waiting")
                : "disabled"
        );

        return {
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable
                    ? "ready"
                    : "waiting"
            ),
            windowedPlayer: makeCapability(
                true,
                watchContext,
                state.windowedPlayer.active ? "on" : "off",
                state.windowedPlayer.playerTargetPresent
                    ? "player target present"
                    : "player target not currently present"
            ),
            skipData: makeCapability(
                true,
                state.skipData.loaded,
                state.skipData.loaded
                    ? `${state.skipData.eventKinds.length} event type(s)`
                    : (watchContext ? "waiting" : "inactive")
            ),
            skipIntro: skipCapability(state.skipIntro),
            skipRecap: skipCapability(state.skipRecap),
            skipCredits: skipCapability(state.skipCredits),
            spoilerProtection: makeCapability(
                true,
                state.rootReady,
                state.spoilerProtection.marker
                    ? "on"
                    : (state.spoilerProtection.enabled
                        ? "marker-missing"
                        : "off")
            )
        };
    }

    function startCrunchyrollAdapterEnhancements() {
        syncCrunchyrollAdapterPresentation();
        loadCrunchyrollAdapterSkipEvents().catch(() => {});

        crunchyrollAdapterSubscribeNavigation(() => {
            crunchyrollAdapterSkipEventsEpisodeId = "";
            loadCrunchyrollAdapterSkipEvents(true).catch(() => {});
        });

        if (!crunchyrollAdapterEnhancementTimer) {
            crunchyrollAdapterEnhancementTimer = createProviderResourceLoop(
                "crunchyroll-enhancements",
                () => {
                    const episodeId = getCrunchyrollAdapterEpisodeId();
                    if (episodeId !== crunchyrollAdapterSkipEventsEpisodeId) {
                        loadCrunchyrollAdapterSkipEvents().catch(() => {});
                    }
                    runCrunchyrollAdapterAutoSkip();
                },
                350,
                "dom"
            );
        }

        return true;
    }

    function syncCrunchyrollAdapterEnhancementSettings() {
        syncCrunchyrollAdapterPresentation();
        runCrunchyrollAdapterAutoSkip();
        providerApiNotifyExtensionChange(
            "crunchyrollEnhancementSettings",
            {
                autoSkipIntro: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipIntro === true,
                autoSkipRecap: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipRecap === true,
                autoSkipCredits: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipCredits === true
            }
        );
        return true;
    }

    function createCrunchyrollProviderAdapter(baseAdapter) {
        const extensions = {
            windowedPlayer: {
                sync: syncCrunchyrollAdapterWindowedPlayer,
                start(sync) {
                    crunchyrollAdapterSubscribeNavigation(sync);
                },
                matchesTarget: crunchyrollAdapterMatchesPlayerTarget,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().windowedPlayer
            },
            enhancements: {
                start: startCrunchyrollAdapterEnhancements,
                syncSettings: syncCrunchyrollAdapterEnhancementSettings,
                getState: getCrunchyrollAdapterExtensionState
            },
            skipEvents: {
                load: loadCrunchyrollAdapterSkipEvents,
                run: runCrunchyrollAdapterAutoSkip,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().skipData
            },
            spoilerProtection: {
                sync: syncCrunchyrollAdapterPresentation,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().spoilerProtection
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "crunchyroll",
            resumeStrategy: "clean-watch-url + pending-seek",
            linkResolverStrategy: "episode-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 250,
                checks: 1,
                toleranceSeconds: 5
            },
            extensions,
            isWatchContext: isCrunchyrollAdapterWatchContext,
            getTitle: async () => cleanProviderTitle(
                getCrunchyrollProviderTitle(),
                "crunchyroll"
            ),
            getExtensionState: getCrunchyrollAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                crunchyrollAdapterSubscribeNavigation(() => {
                    emitState?.("crunchyroll-navigation");
                    setTimeout(
                        () => applyPendingResume?.(),
                        80
                    );
                });
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("crunchyroll", adapter);
        adapter.getExtensionCapabilities = context =>
            getCrunchyrollAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("crunchyroll", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "crunchyroll",
        createCrunchyrollProviderAdapter
    );
    /*
     * ============================================================
     * PRIME VIDEO ENHANCEMENTS
     * ============================================================
     * Settings and scheduling layer. Prime-specific DOM operations are
     * delegated to the Prime Provider Adapter.
     */

    const PRIME_SETTINGS_DEFAULTS = {
        streamShellPrimeUiFixEnabled: true,
        streamShellPrimeHideXray: true,
        streamShellPrimeHideOverlay: true,
        streamShellPrimeAutoSkipIntro: false,
        streamShellPrimeAutoSkipRecap: false,
        streamShellPrimeAutoSkipPromos: true,
        streamShellPrimeSubtitleScale: "0.5",
        streamShellPrimeSubtitleColor: "#ffffff",
        streamShellPrimeSubtitleFont: "default",
        streamShellSubtitleAnarchy: false
    };

    const PRIME_SUBTITLE_FONT_STACKS = {
        Arial: 'Arial, sans-serif',
        Helvetica: 'Helvetica, Arial, sans-serif',
        Georgia: 'Georgia, serif',
        "Times New Roman": '"Times New Roman", Times, serif',
        "Courier New": '"Courier New", monospace',
        Verdana: 'Verdana, sans-serif',
        Roboto: 'Roboto, Arial, sans-serif'
    };

    let primeSettings = {
        ...PRIME_SETTINGS_DEFAULTS
    };

    let primeSubtitleAnarchyTimer = null;
    let primeSubtitleColorTimer = null;
    let primeSubtitleAnarchyState = null;

    function getPrimeEnhancementAdapter() {
        const adapter = getProviderAdapter("prime");
        return adapter?.adapterKind === "prime"
            ? adapter
            : null;
    }

    function normalizePrimeSubtitleScale(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0.5;
        return Math.min(2, Math.max(0.5, numeric));
    }

    function normalizePrimeSubtitleColor(value) {
        const text = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(text)
            ? text
            : "#ffffff";
    }

    function primeAnarchyRandomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function primeAnarchySmoothStep(value) {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }

    const PRIME_ANARCHY_NEON_COLORS = [
        "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
        "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
        "#b000ff", "#7c00ff", "#651fff", "#304ffe",
        "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
        "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
        "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
        "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
        "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
    ];
    let primeAnarchyColorBag = [];

    function refillPrimeAnarchyColorBag() {
        primeAnarchyColorBag = [...PRIME_ANARCHY_NEON_COLORS];
        for (let i = primeAnarchyColorBag.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [primeAnarchyColorBag[i], primeAnarchyColorBag[j]] =
                [primeAnarchyColorBag[j], primeAnarchyColorBag[i]];
        }
    }

    function primeAnarchyColor() {
        if (!primeAnarchyColorBag.length) refillPrimeAnarchyColorBag();
        return primeAnarchyColorBag.pop();
    }

    function primeSubtitleAnarchyEnabled() {
        return !isProviderSafeModeEnabled("prime") &&
            shouldProviderResourceRunVisualWork() &&
            primeSettings.streamShellSubtitleAnarchy === true;
    }

    function choosePrimeSubtitleAnarchyTarget() {
        const adapter = getPrimeEnhancementAdapter();
        const current = Number(
            adapter?.extensions?.subtitles?.getState?.()?.scale
        );

        primeSubtitleAnarchyState = {
            from: Number.isFinite(current) && current > 0
                ? current
                : normalizePrimeSubtitleScale(
                    primeSettings.streamShellPrimeSubtitleScale
                ),
            target: primeAnarchyRandomBetween(0.62, 1.85),
            startedAt: performance.now(),
            duration: primeAnarchyRandomBetween(650, 2600)
        };
    }

    function tickPrimeSubtitleAnarchy() {
        if (!primeSubtitleAnarchyEnabled()) {
            primeSubtitleAnarchyState = null;
            return;
        }

        const adapter = getPrimeEnhancementAdapter();
        const setScale = adapter?.extensions?.subtitles?.setScale;
        if (typeof setScale !== "function") return;

        if (!primeSubtitleAnarchyState) {
            choosePrimeSubtitleAnarchyTarget();
        }

        const state = primeSubtitleAnarchyState;
        const now = performance.now();
        const t = (now - state.startedAt) / state.duration;
        const eased = primeAnarchySmoothStep(t);
        const scale = state.from +
            (state.target - state.from) * eased;

        setScale(scale);

        if (t >= 1) {
            primeSubtitleAnarchyState = {
                from: state.target,
                target: primeAnarchyRandomBetween(0.62, 1.85),
                startedAt: now,
                duration: primeAnarchyRandomBetween(650, 2600)
            };
        }
    }

    function syncPrimeSubtitleAnarchy() {
        const enabled = primeSubtitleAnarchyEnabled();
        const adapter = getPrimeEnhancementAdapter();
        const setColor = adapter?.extensions?.subtitles?.setColor;

        if (enabled && !primeSubtitleAnarchyTimer) {
            primeSubtitleAnarchyTimer = setInterval(
                tickPrimeSubtitleAnarchy,
                50
            );
            primeSubtitleColorTimer = setInterval(
                () => {
                    if (
                        primeSubtitleAnarchyEnabled() &&
                        typeof setColor === "function"
                    ) {
                        setColor(primeAnarchyColor());
                    }
                },
                200
            );
            if (typeof setColor === "function") {
                setColor(primeAnarchyColor());
            }
            tickPrimeSubtitleAnarchy();
            return;
        }

        if (!enabled) {
            if (primeSubtitleAnarchyTimer) {
                clearInterval(primeSubtitleAnarchyTimer);
                primeSubtitleAnarchyTimer = null;
            }
            if (primeSubtitleColorTimer) {
                clearInterval(primeSubtitleColorTimer);
                primeSubtitleColorTimer = null;
            }
            primeSubtitleAnarchyState = null;
        }
    }

    function syncPrimeEnhancementMarkers() {
        const adapter = getPrimeEnhancementAdapter();
        adapter?.extensions?.presentation?.sync?.(primeSettings);
        syncPrimeSubtitleAnarchy();
    }

    function syncPrimeAutoSkipObserver() {
        const adapter = getPrimeEnhancementAdapter();
        adapter?.extensions?.autoSkip?.syncObserver?.(primeSettings);
    }

    async function startPrimeEnhancements() {
        if (getCurrentProvider() !== "prime") return;

        const keys = Object.keys(PRIME_SETTINGS_DEFAULTS);

        try {
            const stored = await chrome.storage.local.get(keys);
            primeSettings = {
                ...PRIME_SETTINGS_DEFAULTS,
                ...stored
            };
        } catch {
            primeSettings = {
                ...PRIME_SETTINGS_DEFAULTS
            };
        }

        syncPrimeEnhancementMarkers();
        syncPrimeAutoSkipObserver();

        onProviderResourceGovernorChange(() => {
            syncPrimeEnhancementMarkers();
            syncPrimeAutoSkipObserver();
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            let changed = false;
            for (const key of keys) {
                if (!Object.prototype.hasOwnProperty.call(changes, key)) {
                    continue;
                }

                primeSettings[key] =
                    changes[key]?.newValue === undefined
                        ? PRIME_SETTINGS_DEFAULTS[key]
                        : changes[key].newValue;
                changed = true;
            }

            if (!changed) return;

            syncPrimeEnhancementMarkers();
            syncPrimeAutoSkipObserver();
        });
    }
    /*
     * ============================================================
     * PRIME VIDEO PROVIDER ADAPTER
     * ============================================================
     * Owns Prime-specific DOM markers, skip-control discovery and
     * provider extension state. Feature settings remain in
     * prime-enhancements.js; shell-facing consumers use this adapter.
     */

    const PRIME_ADAPTER_SKIP_SELECTORS = [
        ".adSkipButton.skippable",
        '[data-testid="skip-ad-button"]',
        ".atvwebplayersdk-skipelement-button",
        ".atvwebplayersdk-skipelements-button",
        'button[aria-label*="skip" i]',
        'button[title*="skip" i]',
        'button[aria-label*="überspring" i]',
        'button[title*="überspring" i]'
    ].join(",");

    let primeAdapterSkipObserver = null;
    let primeAdapterSkipCheckTimer = null;
    let primeAdapterLastResumeClickAt = 0;
    const primeAdapterClickedSkipSignatures = new WeakMap();

    function setPrimeAdapterBooleanMarker(attribute, enabled) {
        const root = document.documentElement;
        if (!root) return;

        if (enabled) {
            root.setAttribute(attribute, "true");
        } else {
            root.removeAttribute(attribute);
        }
    }

    function readPrimeAdapterMarker(attribute) {
        const root = document.documentElement;
        if (!root?.hasAttribute(attribute)) return null;
        return root.getAttribute(attribute) || "true";
    }

    function setPrimeAdapterSubtitleScale(value) {
        const root = document.documentElement;
        if (!root) return false;
        root.style.setProperty(
            "--stream-shell-prime-subtitle-scale",
            String(value)
        );
        return true;
    }

    function setPrimeAdapterSubtitleColor(value) {
        const root = document.documentElement;
        if (!root) return false;
        root.style.setProperty(
            "--stream-shell-prime-subtitle-color",
            String(value)
        );
        return true;
    }

    function setPrimeAdapterSubtitleFont(value) {
        const root = document.documentElement;
        if (!root) return false;

        if (value) {
            root.style.setProperty(
                "--stream-shell-prime-subtitle-font",
                String(value)
            );
        } else {
            root.style.removeProperty(
                "--stream-shell-prime-subtitle-font"
            );
        }

        return true;
    }

    function syncPrimeAdapterPresentation(settings = primeSettings) {
        const root = document.documentElement;
        if (!root) return false;

        const safeMode = isProviderSafeModeEnabled("prime");
        const uiFixEnabled = !safeMode &&
            settings?.streamShellPrimeUiFixEnabled !== false;
        const hideXrayEnabled = !safeMode &&
            settings?.streamShellPrimeHideXray === true;
        const hideOverlayEnabled = !safeMode &&
            settings?.streamShellPrimeHideOverlay === true;

        setPrimeAdapterBooleanMarker(
            "data-stream-shell-prime-ui-fix",
            uiFixEnabled
        );
        setPrimeAdapterBooleanMarker(
            "data-stream-shell-prime-hide-xray",
            hideXrayEnabled
        );
        setPrimeAdapterBooleanMarker(
            "data-stream-shell-prime-hide-overlay",
            hideOverlayEnabled
        );
        setPrimeAdapterBooleanMarker(
            "data-stream-shell-prime-subtitles",
            !safeMode
        );

        if (safeMode) {
            root.style.removeProperty("--stream-shell-prime-subtitle-scale");
            root.style.removeProperty("--stream-shell-prime-subtitle-color");
            root.style.removeProperty("--stream-shell-prime-subtitle-font");
        } else if (settings?.streamShellSubtitleAnarchy !== true) {
            setPrimeAdapterSubtitleScale(
                normalizePrimeSubtitleScale(
                    settings?.streamShellPrimeSubtitleScale
                )
            );
            setPrimeAdapterSubtitleColor(
                normalizePrimeSubtitleColor(
                    settings?.streamShellPrimeSubtitleColor
                )
            );
        }

        if (!safeMode) {
            const font = String(
                settings?.streamShellPrimeSubtitleFont || "default"
            );
            setPrimeAdapterSubtitleFont(
                PRIME_SUBTITLE_FONT_STACKS[font] || null
            );
        }

        providerApiNotifyExtensionChange("primePresentation", {
            uiFix: uiFixEnabled,
            hideXray: hideXrayEnabled,
            hideOverlay: hideOverlayEnabled,
            safeMode
        });

        return true;
    }

    function normalizePrimeAdapterActionText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase();
    }

    function primeAdapterButtonActionText(button) {
        return normalizePrimeAdapterActionText([
            button.getAttribute?.("aria-label"),
            button.getAttribute?.("title"),
            button.textContent
        ].filter(Boolean).join(" "));
    }

    function primeAdapterSkipKind(button) {
        const testId = normalizePrimeAdapterActionText(
            button.getAttribute?.("data-testid")
        );
        const className = normalizePrimeAdapterActionText(
            typeof button.className === "string"
                ? button.className
                : button.getAttribute?.("class")
        );
        const text = primeAdapterButtonActionText(button);

        if (
            testId.includes("skip-ad") ||
            className.includes("adskipbutton")
        ) {
            return "promo";
        }

        const hasSkipIntent = [
            "skip",
            "überspring",
            "ueberspring",
            "omitir",
            "saltar",
            "passer",
            "salta",
            "ignora"
        ].some(token => text.includes(token)) ||
            className.includes("skipelement");

        if (!hasSkipIntent) return null;

        if ([
            "intro",
            "vorspann",
            "opening",
            "générique",
            "generique"
        ].some(token => text.includes(token))) {
            return "intro";
        }

        if ([
            "recap",
            "previously",
            "zusammenfassung",
            "récap",
            "recapitul",
            "riassunto",
            "resumen"
        ].some(token => text.includes(token))) {
            return "recap";
        }

        if ([
            "promo",
            "trailer",
            "advert",
            "werbung",
            "anzeige",
            "publicité",
            "publicite",
            "pubblicità",
            "pubblicita",
            "anuncio"
        ].some(token => text.includes(token))) {
            return "promo";
        }

        const compact = text
            .replace(/[.!…]+$/g, "")
            .trim();

        if ([
            "skip",
            "überspringen",
            "ueberspringen",
            "omitir",
            "saltar",
            "passer",
            "salta",
            "ignora"
        ].includes(compact) && (
            className.includes("skip") ||
            testId.includes("skip")
        )) {
            return "promo";
        }

        return null;
    }

    function primeAdapterSkipKindEnabled(kind, settings = primeSettings) {
        if (isProviderSafeModeEnabled("prime")) return false;

        if (kind === "intro") {
            return settings?.streamShellPrimeAutoSkipIntro === true;
        }
        if (kind === "recap") {
            return settings?.streamShellPrimeAutoSkipRecap === true;
        }
        if (kind === "promo") {
            return settings?.streamShellPrimeAutoSkipPromos === true;
        }
        return false;
    }

    function isPrimeAdapterActionVisible(element) {
        if (
            !element ||
            element.disabled ||
            element.getAttribute?.("aria-disabled") === "true"
        ) {
            return false;
        }

        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const style = getComputedStyle(element);
        return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0;
    }

    function getPrimeAdapterPlaybackContainer() {
        return document.querySelector(
            ".atvwebplayersdk-player-container, #dv-web-player"
        );
    }

    function isPrimeAdapterResumeMediaReady(video) {
        const container = getPrimeAdapterPlaybackContainer();
        return Boolean(
            video &&
            container &&
            (container === video || container.contains(video))
        );
    }

    function primeAdapterResumeButtonScore(element) {
        if (!isPrimeAdapterActionVisible(element)) return -1;

        const text = primeAdapterButtonActionText(element);
        if (!text) return -1;

        if ([
            "trailer",
            "vorschau",
            "preview",
            "werbefreien",
            "ad-free",
            "weitere möglichkeiten",
            "weitere moeglichkeiten",
            "more ways",
            "details",
            "shop"
        ].some(token => text.includes(token))) {
            return -1;
        }

        if ([
            "fortsetzen",
            "weitersehen",
            "weiter ansehen",
            "weiterschauen",
            "continue watching",
            "continue",
            "resume"
        ].some(token => text.includes(token))) {
            return 100;
        }

        if ([
            "abspielen",
            "wiedergabe",
            "jetzt ansehen",
            "watch now",
            "play"
        ].some(token => text.includes(token))) {
            return 50;
        }

        return -1;
    }

    function findPrimeAdapterResumeButton() {
        const candidates = [
            ...document.querySelectorAll(
                'button, [role="button"], a[href]'
            )
        ];

        let best = null;
        let bestScore = -1;

        for (const candidate of candidates) {
            const score = primeAdapterResumeButtonScore(candidate);
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }

        return bestScore >= 0 ? best : null;
    }

    function preparePrimeAdapterResume() {
        const video = getPrimaryVideo();
        if (isPrimeAdapterResumeMediaReady(video)) return true;

        const now = Date.now();
        if (now - primeAdapterLastResumeClickAt < 1400) return false;

        const button = findPrimeAdapterResumeButton();
        if (!button) return false;

        try {
            button.click();
            primeAdapterLastResumeClickAt = now;
            providerApiNotifyExtensionChange("primeResumeBootstrap", {
                clicked: true
            });
            recordProviderFlightEvent("resume-control-clicked", {
                category: "resume",
                provider: "prime"
            });
            return true;
        } catch {
            return false;
        }
    }

    function getPrimeAdapterResumeBootstrapState() {
        const video = getPrimaryVideo();
        const playerPresent = isPrimeAdapterResumeMediaReady(video);
        const buttonPresent = !playerPresent && Boolean(findPrimeAdapterResumeButton());

        return {
            playerPresent,
            buttonPresent,
            state: playerPresent
                ? "player-ready"
                : (buttonPresent ? "resume-control-ready" : "waiting")
        };
    }

    function getPrimeAdapterSkipCandidates() {
        return [...document.querySelectorAll(PRIME_ADAPTER_SKIP_SELECTORS)];
    }

    function findPrimeAdapterSkipButton(kind) {
        return getPrimeAdapterSkipCandidates().find(button =>
            primeAdapterSkipKind(button) === kind &&
            isPrimeAdapterActionVisible(button)
        ) || null;
    }

    function triggerPrimeAdapterSkip(kind) {
        if (isProviderSafeModeEnabled("prime")) return false;

        const button = findPrimeAdapterSkipButton(kind);
        if (!button) return false;

        try {
            button.click();
            recordProviderFlightEvent("executed", {
                category: "skip",
                provider: "prime",
                detail: { kind }
            });
            return true;
        } catch {
            return false;
        }
    }

    function runPrimeAdapterAutoSkip(settings = primeSettings) {
        const enabled = Boolean(
            settings?.streamShellPrimeAutoSkipIntro ||
            settings?.streamShellPrimeAutoSkipRecap ||
            settings?.streamShellPrimeAutoSkipPromos
        );

        if (!enabled) return false;

        let triggered = false;
        const triggeredKinds = [];

        for (const button of getPrimeAdapterSkipCandidates()) {
            const kind = primeAdapterSkipKind(button);
            if (
                !kind ||
                !primeAdapterSkipKindEnabled(kind, settings) ||
                !isPrimeAdapterActionVisible(button)
            ) {
                continue;
            }

            const signature = `${kind}:${primeAdapterButtonActionText(button)}`;
            if (primeAdapterClickedSkipSignatures.get(button) === signature) {
                continue;
            }

            primeAdapterClickedSkipSignatures.set(button, signature);

            try {
                button.click();
                triggered = true;
                triggeredKinds.push(kind);
            } catch {
            }
        }

        if (triggered) {
            providerApiNotifyExtensionChange("primeAutoSkip", {
                triggeredKinds
            });
            for (const kind of triggeredKinds) {
                recordProviderFlightEvent("executed", {
                    category: "skip",
                    provider: "prime",
                    detail: { kind }
                });
            }
        }

        return triggered;
    }

    function schedulePrimeAdapterAutoSkipCheck(settings = primeSettings) {
        if (primeAdapterSkipCheckTimer) {
            return;
        }

        primeAdapterSkipCheckTimer = setTimeout(() => {
            primeAdapterSkipCheckTimer = null;
            runPrimeAdapterAutoSkip(settings);
        }, 120);
    }

    function syncPrimeAdapterAutoSkipObserver(settings = primeSettings) {
        const enabled = !isProviderSafeModeEnabled("prime") &&
            shouldProviderResourceObserveDom() &&
            Boolean(
                settings?.streamShellPrimeAutoSkipIntro ||
                settings?.streamShellPrimeAutoSkipRecap ||
                settings?.streamShellPrimeAutoSkipPromos
            );

        if (!enabled) {
            primeAdapterSkipObserver?.disconnect();
            primeAdapterSkipObserver = null;

            if (primeAdapterSkipCheckTimer) {
                clearTimeout(primeAdapterSkipCheckTimer);
                primeAdapterSkipCheckTimer = null;
            }

            return false;
        }

        if (!primeAdapterSkipObserver) {
            primeAdapterSkipObserver = new MutationObserver(
                () => schedulePrimeAdapterAutoSkipCheck(primeSettings)
            );
            primeAdapterSkipObserver.observe(
                document.documentElement,
                {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: [
                        "class",
                        "style",
                        "aria-hidden",
                        "aria-label",
                        "title",
                        "disabled"
                    ]
                }
            );
        }

        schedulePrimeAdapterAutoSkipCheck(settings);
        return true;
    }

    function getPrimeAdapterSkipState(kind, settings = primeSettings) {
        const watchContext = isWatchContext("prime");
        const enabled = primeAdapterSkipKindEnabled(kind, settings);
        const buttonPresent = watchContext && Boolean(
            findPrimeAdapterSkipButton(kind)
        );

        return {
            enabled,
            watchContext,
            buttonPresent
        };
    }

    function getPrimeAdapterExtensionState() {
        const root = document.documentElement;
        const safeMode = isProviderSafeModeEnabled("prime");
        const uiFixMarker = readPrimeAdapterMarker(
            "data-stream-shell-prime-ui-fix"
        );
        const hideXrayMarker = readPrimeAdapterMarker(
            "data-stream-shell-prime-hide-xray"
        );
        const hideOverlayMarker = readPrimeAdapterMarker(
            "data-stream-shell-prime-hide-overlay"
        );
        const subtitlesMarker = readPrimeAdapterMarker(
            "data-stream-shell-prime-subtitles"
        );

        return {
            safeMode,
            uiFix: {
                enabled: !safeMode && primeSettings.streamShellPrimeUiFixEnabled !== false,
                configuredEnabled: primeSettings.streamShellPrimeUiFixEnabled !== false,
                marker: uiFixMarker === "true"
            },
            hideXray: {
                enabled: !safeMode && primeSettings.streamShellPrimeHideXray === true,
                configuredEnabled: primeSettings.streamShellPrimeHideXray === true,
                marker: hideXrayMarker === "true"
            },
            hideOverlay: {
                enabled: !safeMode && primeSettings.streamShellPrimeHideOverlay === true,
                configuredEnabled: primeSettings.streamShellPrimeHideOverlay === true,
                marker: hideOverlayMarker === "true"
            },
            subtitles: {
                marker: subtitlesMarker === "true",
                scale: root?.style?.getPropertyValue(
                    "--stream-shell-prime-subtitle-scale"
                ) || null,
                color: root?.style?.getPropertyValue(
                    "--stream-shell-prime-subtitle-color"
                ) || null,
                font: root?.style?.getPropertyValue(
                    "--stream-shell-prime-subtitle-font"
                ) || null,
                configuredScale: String(
                    primeSettings.streamShellPrimeSubtitleScale ?? "0.5"
                ),
                configuredColor: String(
                    primeSettings.streamShellPrimeSubtitleColor || "#ffffff"
                ),
                configuredFont: String(
                    primeSettings.streamShellPrimeSubtitleFont || "default"
                ),
                anarchy: !safeMode && primeSettings.streamShellSubtitleAnarchy === true,
                configuredAnarchy: primeSettings.streamShellSubtitleAnarchy === true,
                suppressed: safeMode
            },
            skipIntro: getPrimeAdapterSkipState("intro"),
            skipRecap: getPrimeAdapterSkipState("recap"),
            skipPromos: getPrimeAdapterSkipState("promo"),
            resumeBootstrap: getPrimeAdapterResumeBootstrapState(),
            rootReady: Boolean(root)
        };
    }

    function getPrimeAdapterExtensionCapabilities({ watchContext }) {
        const state = getPrimeAdapterExtensionState();

        const markerCapability = markerState => makeCapability(
            true,
            state.rootReady,
            markerState.marker
                ? "on"
                : (markerState.enabled ? "marker-missing" : "off")
        );

        const skipCapability = skipState => makeCapability(
            true,
            watchContext,
            skipState.enabled
                ? (skipState.buttonPresent ? "ready-now" : "armed")
                : "disabled"
        );

        return {
            uiFix: markerCapability(state.uiFix),
            hideXray: markerCapability(state.hideXray),
            hideOverlay: markerCapability(state.hideOverlay),
            subtitleStyling: makeCapability(
                true,
                state.rootReady && state.subtitles.marker,
                state.subtitles.anarchy
                    ? "anarchy"
                    : `ready · ${state.subtitles.configuredScale}x`
            ),
            skipIntro: skipCapability(state.skipIntro),
            skipRecap: skipCapability(state.skipRecap),
            skipPromos: skipCapability(state.skipPromos),
            resumeBootstrap: makeCapability(
                true,
                state.resumeBootstrap.playerPresent || state.resumeBootstrap.buttonPresent,
                state.resumeBootstrap.state,
                "Prime detail page -> player bootstrap"
            )
        };
    }

    function resolvePrimeAdapterMediaUrl(identity, fallbackUrl = "") {
        const expected = getResolvableProviderIdentity(
            "prime",
            identity,
            fallbackUrl
        );

        if (expected?.identity) {
            const currentUrl = normalizeProviderResumeUrl(
                "prime",
                window.location.href
            );

            if (
                isProviderOwnedMediaUrl("prime", currentUrl) &&
                getProviderMediaIdentity("prime", currentUrl) === expected.identity
            ) {
                return {
                    provider: "prime",
                    identity: expected.identity,
                    url: currentUrl,
                    strategy: "prime-live-current-path",
                    reconstructed: false
                };
            }

            const candidates = document.querySelectorAll(
                'a[href*="/detail/"], a[href*="/gp/video/detail/"]'
            );

            for (const anchor of candidates) {
                const candidate = normalizeProviderResumeUrl(
                    "prime",
                    anchor.href
                );

                if (
                    isProviderOwnedMediaUrl("prime", candidate) &&
                    getProviderMediaIdentity("prime", candidate) === expected.identity
                ) {
                    return {
                        provider: "prime",
                        identity: expected.identity,
                        url: candidate,
                        strategy: "prime-live-detail-anchor",
                        reconstructed: true
                    };
                }
            }
        }

        return resolveProviderMediaLink(
            "prime",
            identity,
            fallbackUrl,
            window.location.origin
        );
    }


    function createPrimeProviderAdapter(baseAdapter) {
        const extensions = {
            presentation: {
                sync: syncPrimeAdapterPresentation,
                getState: getPrimeAdapterExtensionState
            },
            subtitles: {
                setScale: setPrimeAdapterSubtitleScale,
                setColor: setPrimeAdapterSubtitleColor,
                setFont: setPrimeAdapterSubtitleFont,
                getState: () => getPrimeAdapterExtensionState().subtitles
            },
            autoSkip: {
                run: runPrimeAdapterAutoSkip,
                syncObserver: syncPrimeAdapterAutoSkipObserver,
                getState: getPrimeAdapterExtensionState
            },
            skipIntro: {
                trigger: () => triggerPrimeAdapterSkip("intro"),
                getState: () => getPrimeAdapterExtensionState().skipIntro
            },
            skipRecap: {
                trigger: () => triggerPrimeAdapterSkip("recap"),
                getState: () => getPrimeAdapterExtensionState().skipRecap
            },
            skipPromos: {
                trigger: () => triggerPrimeAdapterSkip("promo"),
                getState: () => getPrimeAdapterExtensionState().skipPromos
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "prime",
            resumeStrategy: "detail-resume-control + pending-seek",
            linkResolverStrategy: "live detail path/anchor -> detail-id fallback",
            resolveMediaUrl: resolvePrimeAdapterMediaUrl,
            resumeConfirmation: {
                delayMs: 350,
                checks: 2,
                toleranceSeconds: 5
            },
            prepareResume: preparePrimeAdapterResume,
            isResumeMediaReady: isPrimeAdapterResumeMediaReady,
            extensions,
            getTitle: async () => cleanProviderTitle(
                getPrimeProviderTitle(),
                "prime"
            ),
            getExtensionState: getPrimeAdapterExtensionState
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("prime", adapter);
        adapter.getExtensionCapabilities = context =>
            getPrimeAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("prime", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "prime",
        createPrimeProviderAdapter
    );
    /*
     * ============================================================
     * YOUTUBE UTILITIES
     * ============================================================
     *
     * Stream Shell owns only the small behaviors the user actually uses:
     * theme gating, preferred quality, exact upload dates, auto-like and
     * a configurable cleanup layer. Everything remains scoped to managed
     * Stream Shell windows.
     */

    const YOUTUBE_THEME_STORAGE_KEY =
        "streamShellYoutubeThemeEnabled";

    const YOUTUBE_QUALITY_ENABLED_KEY =
        "streamShellYoutubeQualityEnabled";

    const YOUTUBE_QUALITY_KEY =
        "streamShellYoutubeQuality";

    const YOUTUBE_UPLOAD_DATE_ENABLED_KEY =
        "streamShellYoutubeUploadDateEnabled";

    const YOUTUBE_UPLOAD_DATE_FORMAT_KEY =
        "streamShellYoutubeUploadDateFormat";

    const YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY =
        "streamShellYoutubeUploadDateRelativeEnabled";

    const YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY =
        "streamShellYoutubeUploadDateRelativeDays";

    const YOUTUBE_AUTO_LIKE_ENABLED_KEY =
        "streamShellYoutubeAutoLikeEnabled";

    const YOUTUBE_AUTO_LIKE_TRIGGER_KEY =
        "streamShellYoutubeAutoLikeTrigger";

    const YOUTUBE_AUTO_LIKE_PERCENT_KEY =
        "streamShellYoutubeAutoLikePercent";

    const YOUTUBE_AUTO_LIKE_SECONDS_KEY =
        "streamShellYoutubeAutoLikeSeconds";

    const YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY =
        "streamShellYoutubeAutoLikeSubscribedOnly";

    const YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY =
        "streamShellYoutubeAutoLikeWaitForAds";

    const YOUTUBE_AUTO_LIKE_SHORTS_KEY =
        "streamShellYoutubeAutoLikeShorts";

    const YOUTUBE_KEEP_PLAYING_KEY =
        "streamShellYoutubeKeepPlaying";

    const YOUTUBE_LOOP_KEY =
        "streamShellYoutubeLoopEnabled";

    const YOUTUBE_LOOP_VIDEOS_KEY =
        "streamShellYoutubeLoopVideos";

    const YOUTUBE_LOOP_SHORTS_KEY =
        "streamShellYoutubeLoopShorts";

    const YOUTUBE_CLEANUP_SETTINGS = {
        streamShellYoutubeCleanupHideHomeFeed:
            "data-stream-shell-yt-hide-home-feed",

        streamShellYoutubeCleanupHideHomePromotions:
            "data-stream-shell-yt-hide-home-promotions",

        streamShellYoutubeCleanupHidePlayables:
            "data-stream-shell-yt-hide-playables",

        streamShellYoutubeCleanupHideVideoSidebar:
            "data-stream-shell-yt-hide-video-sidebar",

        streamShellYoutubeCleanupHideRecommended:
            "data-stream-shell-yt-hide-recommended",

        streamShellYoutubeCleanupHideLiveChat:
            "data-stream-shell-yt-hide-live-chat",

        streamShellYoutubeCleanupHidePlaylist:
            "data-stream-shell-yt-hide-playlist",

        streamShellYoutubeCleanupHideFundraiser:
            "data-stream-shell-yt-hide-fundraiser",

        streamShellYoutubeCleanupHideTranscriptChapters:
            "data-stream-shell-yt-hide-transcript-chapters",

        streamShellYoutubeCleanupHideEndScreenFeed:
            "data-stream-shell-yt-hide-end-screen-feed",

        streamShellYoutubeCleanupHideEndScreenCards:
            "data-stream-shell-yt-hide-end-screen-cards",

        streamShellYoutubeCleanupHideComments:
            "data-stream-shell-yt-hide-comments",

        streamShellYoutubeCleanupHideProfilePhotos:
            "data-stream-shell-yt-hide-profile-photos",

        streamShellYoutubeCleanupHideMixes:
            "data-stream-shell-yt-hide-mixes",

        streamShellYoutubeCleanupHideMerch:
            "data-stream-shell-yt-hide-merch",

        streamShellYoutubeCleanupHideVideoInfo:
            "data-stream-shell-yt-hide-video-info",

        streamShellYoutubeCleanupHideTopHeader:
            "data-stream-shell-yt-hide-top-header",

        streamShellYoutubeCleanupHideNotifications:
            "data-stream-shell-yt-hide-notifications",

        streamShellYoutubeCleanupHideInaptSearchResults:
            "data-stream-shell-yt-hide-inapt-search",

        streamShellYoutubeCleanupHideExploreTrending:
            "data-stream-shell-yt-hide-explore-trending",

        streamShellYoutubeCleanupHideMoreFromYouTube:
            "data-stream-shell-yt-hide-more-youtube",

        streamShellYoutubeCleanupHideShortsTab:
            "data-stream-shell-yt-hide-shorts-tab",

        streamShellYoutubeCleanupHideSubscriptions:
            "data-stream-shell-yt-hide-subscriptions",

        streamShellYoutubeCleanupDisableAutoplay:
            "data-stream-shell-yt-disable-autoplay",

        streamShellYoutubeCleanupDisableAnnotations:
            "data-stream-shell-yt-disable-annotations"
    };

    const YOUTUBE_UTILITY_DEFAULTS = {
        [YOUTUBE_THEME_STORAGE_KEY]:
            true,

        [YOUTUBE_QUALITY_ENABLED_KEY]:
            true,

        [YOUTUBE_QUALITY_KEY]:
            "hd1080",

        [YOUTUBE_UPLOAD_DATE_ENABLED_KEY]:
            true,

        [YOUTUBE_UPLOAD_DATE_FORMAT_KEY]:
            "friendly",

        [YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY]:
            true,

        [YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY]:
            1,

        [YOUTUBE_AUTO_LIKE_ENABLED_KEY]:
            true,

        [YOUTUBE_AUTO_LIKE_TRIGGER_KEY]:
            "percent",

        [YOUTUBE_AUTO_LIKE_PERCENT_KEY]:
            69,

        [YOUTUBE_AUTO_LIKE_SECONDS_KEY]:
            30,

        [YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY]:
            false,

        [YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY]:
            false,

        [YOUTUBE_AUTO_LIKE_SHORTS_KEY]:
            true,

        [YOUTUBE_KEEP_PLAYING_KEY]:
            true,

        [YOUTUBE_LOOP_KEY]:
            false,

        [YOUTUBE_LOOP_VIDEOS_KEY]:
            false,

        [YOUTUBE_LOOP_SHORTS_KEY]:
            true,

        streamShellYoutubeCleanupHideHomeFeed:
            false,

        streamShellYoutubeCleanupHideHomePromotions:
            true,

        streamShellYoutubeCleanupHidePlayables:
            true,

        streamShellYoutubeCleanupHideVideoSidebar:
            false,

        streamShellYoutubeCleanupHideRecommended:
            false,

        streamShellYoutubeCleanupHideLiveChat:
            false,

        streamShellYoutubeCleanupHidePlaylist:
            false,

        streamShellYoutubeCleanupHideFundraiser:
            false,

        streamShellYoutubeCleanupHideTranscriptChapters:
            false,

        streamShellYoutubeCleanupHideEndScreenFeed:
            false,

        streamShellYoutubeCleanupHideEndScreenCards:
            false,

        streamShellYoutubeCleanupHideComments:
            false,

        streamShellYoutubeCleanupHideProfilePhotos:
            false,

        streamShellYoutubeCleanupHideMixes:
            false,

        streamShellYoutubeCleanupHideMerch:
            true,

        streamShellYoutubeCleanupHideVideoInfo:
            false,

        streamShellYoutubeCleanupHideTopHeader:
            false,

        streamShellYoutubeCleanupHideNotifications:
            false,

        streamShellYoutubeCleanupHideInaptSearchResults:
            true,

        streamShellYoutubeCleanupHideExploreTrending:
            false,

        streamShellYoutubeCleanupHideMoreFromYouTube:
            true,

        streamShellYoutubeCleanupHideShortsTab:
            false,

        streamShellYoutubeCleanupHideSubscriptions:
            false,

        streamShellYoutubeCleanupDisableAutoplay:
            false,

        streamShellYoutubeCleanupDisableAnnotations:
            false
    };

    let youtubeUtilitySettings = {
        ...YOUTUBE_UTILITY_DEFAULTS
    };

    /*
     * 0.17 runtime: no observer is ever attached to documentElement.
     * Individual YouTube surfaces are observed only while the resource
     * governor allows DOM work.
     */
    const youtubeRuntimeObservers = {
        popup: null,
        player: null,
        guide: null
    };

    const youtubeRuntimeObserverRoots = {
        popup: null,
        player: null,
        guide: null
    };

    let youtubeRuntimeObserversActive =
        false;

    let youtubeUtilityDomTimer =
        null;

    let youtubeUtilitySettleGeneration =
        0;

    const youtubeUtilitySettleTimers =
        new Set();

    const youtubeUtilityPendingWork =
        new Set();

    let youtubeAutoLikeTimer =
        null;

    let youtubeLastQualityVideoId =
        "";

    let youtubeAutoLikedVideoIds =
        new Set();


    let youtubeLastAdSeenAt =
        0;


    const youtubeUploadDateCache =
        new Map();

    const youtubeUploadDateScriptScanAttempts =
        new Map();

    let youtubeUploadDateElement =
        null;

    let youtubeUploadDateOriginalText =
        null;

    const youtubeTextCleanupTargets =
        new Set();


    function getYouTubeVideoId() {
        try {
            const url =
                new URL(
                    location.href
                );


            if (
                url.pathname ===
                    "/watch"
            ) {
                return String(
                    url.searchParams.get(
                        "v"
                    ) ||
                    ""
                );
            }


            if (
                url.pathname.startsWith(
                    "/shorts/"
                )
            ) {
                return url.pathname
                    .split("/")
                    .filter(Boolean)[1] ||
                    "";
            }

        } catch {
        }


        return "";
    }


    function setYouTubeThemeMarker() {
        if (isProviderSafeModeEnabled("youtube")) {
            document.documentElement?.removeAttribute(
                "data-stream-shell-youtube-theme"
            );
            return;
        }

        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_THEME_STORAGE_KEY
            ] !== false
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-theme",
                "true"
            );

        } else {
            root.removeAttribute(
                "data-stream-shell-youtube-theme"
            );
        }
    }


    function syncYouTubeCleanupMarkers() {
        if (isProviderSafeModeEnabled("youtube")) {
            const safeRoot = document.documentElement;
            if (safeRoot) {
                for (const attribute of Object.values(YOUTUBE_CLEANUP_SETTINGS)) {
                    safeRoot.removeAttribute(attribute);
                }
            }
            clearYouTubeTextCleanupTargets();
            return;
        }

        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        for (
            const [key, attribute]
            of Object.entries(
                YOUTUBE_CLEANUP_SETTINGS
            )
        ) {
            root.toggleAttribute(
                attribute,
                youtubeUtilitySettings[key] ===
                    true
            );
        }


        syncYouTubeTextCleanupTargets();
        syncYouTubeAutoplaySetting();
    }


    function clearYouTubeTextCleanupTargets() {
        for (
            const element
            of youtubeTextCleanupTargets
        ) {
            try {
                element?.removeAttribute?.(
                    "data-stream-shell-cleanup-hidden"
                );
            } catch {
            }
        }


        youtubeTextCleanupTargets.clear();
    }


    function syncYouTubeTextCleanupTargets(
        root =
            document
    ) {
        if (isProviderSafeModeEnabled("youtube")) {
            clearYouTubeTextCleanupTargets();
            return;
        }


        if (
            !youtubeUtilitySettings
                .streamShellYoutubeCleanupHideMoreFromYouTube
        ) {
            clearYouTubeTextCleanupTargets();
            return;
        }


        for (
            const element
            of [...youtubeTextCleanupTargets]
        ) {
            if (
                !element?.isConnected
            ) {
                youtubeTextCleanupTargets.delete(
                    element
                );
            }
        }


        const sections =
            root instanceof Element &&
            root.matches(
                "ytd-guide-section-renderer"
            )
                ? [root]
                : Array.from(
                    root?.querySelectorAll?.(
                        "ytd-guide-section-renderer"
                    ) ||
                    []
                );


        for (
            const section
            of sections
        ) {
            if (
                youtubeTextCleanupTargets.has(
                    section
                )
            ) {
                continue;
            }


            const text =
                String(
                    section.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .toLowerCase();


            if (
                text.includes(
                    "more from youtube"
                ) ||
                text.includes(
                    "mehr von youtube"
                )
            ) {
                section.setAttribute(
                    "data-stream-shell-cleanup-hidden",
                    "true"
                );


                youtubeTextCleanupTargets.add(
                    section
                );
            }
        }
    }


    function syncYouTubeAutoplaySetting() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            !youtubeUtilitySettings
                .streamShellYoutubeCleanupDisableAutoplay
        ) {
            return;
        }


        const toggle =
            document.querySelector(
                ".ytp-autonav-toggle-button"
            );


        if (
            toggle?.getAttribute(
                "aria-checked"
            ) ===
                "true"
        ) {
            toggle.click();
        }
    }


    function getYouTubePlayer() {
        return document.getElementById(
            "movie_player"
        );
    }


    let youtubeQualityGeneration =
        0;


    function applyYouTubePreferredQuality(
        force = false
    ) {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_QUALITY_ENABLED_KEY
            ] ===
                false
        ) {
            return;
        }


        const videoId =
            getYouTubeVideoId();


        if (
            !force &&
            videoId &&
            videoId ===
                youtubeLastQualityVideoId
        ) {
            return;
        }


        const preferred =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_QUALITY_KEY
                ] ||
                "hd1080"
            );


        chrome.runtime.sendMessage({
            type:
                "youtube-set-quality",

            preferred
        })
            .then(
                response => {
                    if (
                        response?.ok &&
                        videoId ===
                            getYouTubeVideoId()
                    ) {
                        youtubeLastQualityVideoId =
                            videoId;
                    }
                }
            )
            .catch(
                () => {}
            );
    }


    function scheduleYouTubePreferredQuality() {
        youtubeLastQualityVideoId =
            "";


        const generation =
            ++youtubeQualityGeneration;

        const videoId =
            getYouTubeVideoId();


        for (
            const timeout
            of [250, 700, 1500, 3000]
        ) {
            setTimeout(
                () => {
                    if (
                        generation !==
                            youtubeQualityGeneration ||
                        videoId !==
                            getYouTubeVideoId() ||
                        !shouldProviderResourceObserveDom()
                    ) {
                        return;
                    }


                    applyYouTubePreferredQuality(
                        timeout >= 1500
                    );
                },
                timeout
            );
        }
    }


    function extractYouTubeUploadTimestamp() {
        const videoId =
            getYouTubeVideoId();


        if (
            videoId &&
            youtubeUploadDateCache.has(
                videoId
            )
        ) {
            return youtubeUploadDateCache.get(
                videoId
            );
        }


        let fallback =
            "";


        const metaSelectors = [
            'meta[itemprop="uploadDate"]',
            'meta[itemprop="datePublished"]'
        ];


        for (
            const selector
            of metaSelectors
        ) {
            const value =
                String(
                    document
                        .querySelector(
                            selector
                        )
                        ?.getAttribute(
                            "content"
                        ) ||
                        ""
                ).trim();


            if (
                !value
            ) {
                continue;
            }


            if (
                /T\d{2}:\d{2}/
                    .test(
                        value
                    )
            ) {
                if (
                    videoId
                ) {
                    youtubeUploadDateCache.set(
                        videoId,
                        value
                    );
                }


                return value;
            }


            fallback =
                fallback ||
                value;
        }


        const scriptScanKey =
            videoId ||
            "__no-video__";

        const scriptScanAttempts =
            youtubeUploadDateScriptScanAttempts.get(
                scriptScanKey
            ) ||
            0;


        if (
            scriptScanAttempts >=
                5
        ) {
            return fallback;
        }


        youtubeUploadDateScriptScanAttempts.set(
            scriptScanKey,
            scriptScanAttempts + 1
        );


        const scripts =
            document.scripts ||
            [];


        for (
            const script
            of scripts
        ) {
            const scriptText =
                script.textContent ||
                "";


            if (
                !scriptText.includes(
                    "uploadDate"
                ) &&
                !scriptText.includes(
                    "publishDate"
                )
            ) {
                continue;
            }


            const uploadMatch =
                scriptText.match(
                    /"uploadDate"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/
                );


            const publishMatch =
                scriptText.match(
                    /"publishDate"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/
                );


            const raw =
                (
                    uploadMatch?.[1] ||
                    publishMatch?.[1] ||
                    ""
                )
                    .replace(
                        /\\u0026/g,
                        "&"
                    )
                    .replace(
                        /\\\//g,
                        "/"
                    );


            if (
                !raw
            ) {
                continue;
            }


            if (
                /T\d{2}:\d{2}/
                    .test(
                        raw
                    )
            ) {
                if (
                    videoId
                ) {
                    youtubeUploadDateCache.set(
                        videoId,
                        raw
                    );
                }


                return raw;
            }


            fallback =
                fallback ||
                raw;
        }


        if (
            videoId &&
            fallback
        ) {
            youtubeUploadDateCache.set(
                videoId,
                fallback
            );
        }


        return fallback;
    }


    function formatYouTubeAbsoluteDate(
        raw
    ) {
        const dateOnly =
            /^\d{4}-\d{2}-\d{2}$/
                .test(
                    raw
                );


        const date =
            dateOnly
                ? new Date(
                    `${raw}T12:00:00`
                )
                : new Date(
                    raw
                );


        if (
            !Number.isFinite(
                date.getTime()
            )
        ) {
            return "";
        }


        const format =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_UPLOAD_DATE_FORMAT_KEY
                ] ||
                "friendly"
            );


        const time =
            dateOnly
                ? ""
                : new Intl.DateTimeFormat(
                    "en-US",
                    {
                        hour:
                            "numeric",

                        minute:
                            "2-digit",

                        hour12:
                            true
                    }
                ).format(
                    date
                );


        let datePart =
            "";


        if (
            format ===
                "numeric"
        ) {
            datePart =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        month:
                            "2-digit",

                        day:
                            "2-digit",

                        year:
                            "numeric"
                    }
                ).format(
                    date
                );

        } else if (
            format ===
                "iso"
        ) {
            const year =
                date.getFullYear();


            const month =
                String(
                    date.getMonth() +
                    1
                ).padStart(
                    2,
                    "0"
                );


            const day =
                String(
                    date.getDate()
                ).padStart(
                    2,
                    "0"
                );


            datePart =
                `${year}-${month}-${day}`;

        } else {

            datePart =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        month:
                            "short",

                        day:
                            "numeric",

                        year:
                            "numeric"
                    }
                ).format(
                    date
                );
        }


        if (
            time
        ) {
            return `${datePart} · ${time}`;
        }


        return datePart;
    }


    function formatYouTubeRelativeDate(
        raw
    ) {
        if (
            /^\d{4}-\d{2}-\d{2}$/
                .test(
                    raw
                )
        ) {
            return "";
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY
            ] !==
                true
        ) {
            return "";
        }


        const days =
            Math.max(
                0,
                Number(
                    youtubeUtilitySettings[
                        YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY
                    ]
                ) ||
                0
            );


        if (
            days <= 0
        ) {
            return "";
        }


        const date =
            new Date(
                raw
            );


        const ageMs =
            Date.now() -
            date.getTime();


        if (
            !Number.isFinite(
                ageMs
            ) ||
            ageMs < 0 ||
            ageMs >=
                days *
                86400000
        ) {
            return "";
        }


        const hours =
            Math.max(
                1,
                Math.round(
                    ageMs /
                    3600000
                )
            );


        if (
            hours < 24
        ) {
            return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
        }


        const relativeDays =
            Math.max(
                1,
                Math.round(
                    hours /
                    24
                )
            );


        return `${relativeDays} ${relativeDays === 1 ? "day" : "days"} ago`;
    }


    function restoreYouTubeUploadDate() {
        if (
            youtubeUploadDateElement
        ) {
            try {
                if (
                    youtubeUploadDateElement.isConnected
                ) {
                    youtubeUploadDateElement.textContent =
                        youtubeUploadDateOriginalText ??
                        youtubeUploadDateElement.textContent;


                    youtubeUploadDateElement.removeAttribute(
                        "data-stream-shell-original-upload-date"
                    );


                    youtubeUploadDateElement.removeAttribute(
                        "data-stream-shell-upload-date"
                    );
                }
            } catch {
            }
        }


        youtubeUploadDateElement =
            null;

        youtubeUploadDateOriginalText =
            null;


        document
            .getElementById(
                "stream-shell-youtube-upload-date"
            )
            ?.remove();
    }


    function findYouTubeUploadDateLabel() {
        const selectors = [
            "#info-strings yt-formatted-string",
            "ytd-watch-info-text yt-formatted-string",
            "ytd-watch-info-text span"
        ];


        const candidates =
            Array.from(
                document.querySelectorAll(
                    selectors.join(
                        ","
                    )
                )
            );


        return candidates
            .filter(
                element => {
                    const text =
                        String(
                            element.textContent ||
                            ""
                        ).trim();


                    return /\bago\b|\bvor\b|\b20\d{2}\b|premiered|streamed|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i
                        .test(
                            text
                        );
                }
            )
            .at(-1) ||
            null;
    }


    function applyYouTubeUploadDate() {
        if (isProviderSafeModeEnabled("youtube")) {
            restoreYouTubeUploadDate();
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_UPLOAD_DATE_ENABLED_KEY
            ] ===
                false ||
            location.pathname !==
                "/watch"
        ) {
            restoreYouTubeUploadDate();
            return;
        }


        const raw =
            extractYouTubeUploadTimestamp();


        if (
            !raw
        ) {
            return;
        }


        const text =
            formatYouTubeRelativeDate(
                raw
            ) ||
            formatYouTubeAbsoluteDate(
                raw
            );


        if (
            !text
        ) {
            return;
        }


        const label =
            findYouTubeUploadDateLabel();


        if (
            label
        ) {
            if (
                youtubeUploadDateElement !==
                    label
            ) {
                restoreYouTubeUploadDate();

                youtubeUploadDateElement =
                    label;

                youtubeUploadDateOriginalText =
                    String(
                        label.textContent ||
                        ""
                    );
            }


            if (
                !label.hasAttribute(
                    "data-stream-shell-original-upload-date"
                )
            ) {
                label.setAttribute(
                    "data-stream-shell-original-upload-date",
                    youtubeUploadDateOriginalText ||
                    ""
                );
            }


            label.textContent =
                text;


            label.setAttribute(
                "data-stream-shell-upload-date",
                raw
            );


            label.title =
                formatYouTubeAbsoluteDate(
                    raw
                );


            return;
        }


        const container =
            document.querySelector(
                "#info-strings"
            ) ||
            document.querySelector(
                "ytd-watch-info-text"
            );


        if (
            !container
        ) {
            return;
        }


        let fallback =
            document.getElementById(
                "stream-shell-youtube-upload-date"
            );


        if (
            !fallback
        ) {
            fallback =
                document.createElement(
                    "span"
                );


            fallback.id =
                "stream-shell-youtube-upload-date";


            container.appendChild(
                fallback
            );
        }


        fallback.textContent =
            ` • ${text}`;


        fallback.title =
            formatYouTubeAbsoluteDate(
                raw
            );
    }


    function getActiveYouTubeVideo() {
        return getPrimaryVideo();
    }


    function isYouTubeSubscribed() {
        const subscribeButton =
            document.querySelector(
                "ytd-subscribe-button-renderer button, ytd-subscribe-button-renderer tp-yt-paper-button"
            );


        if (
            !subscribeButton
        ) {
            return false;
        }


        const text =
            String(
                subscribeButton.textContent ||
                subscribeButton.getAttribute(
                    "aria-label"
                ) ||
                ""
            )
                .trim()
                .toLowerCase();


        return subscribeButton.hasAttribute(
            "subscribed"
        ) ||
            text.includes(
                "subscribed"
            ) ||
            text.includes(
                "abonniert"
            );
    }


    function getYouTubeLikeButtons() {
        const shorts =
            location.pathname.startsWith(
                "/shorts/"
            );


        const scope =
            shorts
                ? getActiveYouTubeShortsRenderer()
                : document;


        if (
            shorts &&
            !scope
        ) {
            return {
                like: null,
                dislike: null
            };
        }


        const like =
            scope.querySelector(
                "#segmented-like-button button, like-button-view-model button, #like-button button"
            );


        const dislike =
            scope.querySelector(
                "#segmented-dislike-button button, dislike-button-view-model button, #dislike-button button"
            );


        return {
            like,
            dislike
        };
    }


    function isPressedButton(
        button
    ) {
        return button?.getAttribute(
            "aria-pressed"
        ) ===
            "true" ||
            button?.getAttribute(
                "aria-checked"
            ) ===
                "true";
    }


    function runYouTubeAutoLike() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_ENABLED_KEY
            ] !==
                true
        ) {
            return;
        }


        const shorts =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            shorts &&
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_SHORTS_KEY
            ] !==
                true
        ) {
            return;
        }


        const videoId =
            getYouTubeVideoId();


        if (
            !videoId ||
            youtubeAutoLikedVideoIds.has(
                videoId
            )
        ) {
            return;
        }


        const player =
            getYouTubePlayer();


        const adActive =
            player?.classList?.contains(
                "ad-showing"
            ) ===
            true;


        if (
            adActive
        ) {
            youtubeLastAdSeenAt =
                Date.now();


            return;
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY
            ] ===
                true &&
            Date.now() -
                youtubeLastAdSeenAt <
                1500
        ) {
            return;
        }


        const video =
            getActiveYouTubeVideo();


        if (
            !video ||
            !Number.isFinite(
                video.currentTime
            )
        ) {
            return;
        }


        const trigger =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_AUTO_LIKE_TRIGGER_KEY
                ] ||
                "percent"
            );


        let reached =
            false;


        if (
            trigger ===
                "seconds"
        ) {
            const seconds =
                Math.max(
                    1,
                    Number(
                        youtubeUtilitySettings[
                            YOUTUBE_AUTO_LIKE_SECONDS_KEY
                        ]
                    ) ||
                    30
                );


            reached =
                video.currentTime >=
                seconds;

        } else {

            const duration =
                Number(
                    video.duration
                );


            if (
                !Number.isFinite(
                    duration
                ) ||
                duration <= 0
            ) {
                return;
            }


            const percent =
                Math.max(
                    1,
                    Math.min(
                        100,
                        Number(
                            youtubeUtilitySettings[
                                YOUTUBE_AUTO_LIKE_PERCENT_KEY
                            ]
                        ) ||
                        69
                    )
                );


            reached =
                video.currentTime /
                duration *
                100 >=
                percent;
        }


        if (
            !reached
        ) {
            return;
        }


        /*
         * Subscribed-only is intentionally checked at the trigger boundary,
         * not once per second for the entire video.
         */
        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY
            ] ===
                true &&
            !isYouTubeSubscribed()
        ) {
            return;
        }


        const {
            like,
            dislike
        } = getYouTubeLikeButtons();


        if (
            !like
        ) {
            return;
        }


        if (
            isPressedButton(
                like
            )
        ) {
            youtubeAutoLikedVideoIds.add(
                videoId
            );
            return;
        }


        if (
            isPressedButton(
                dislike
            )
        ) {
            youtubeAutoLikedVideoIds.add(
                videoId
            );
            return;
        }


        try {
            like.click();


            youtubeAutoLikedVideoIds.add(
                videoId
            );
        } catch {
        }
    }


    const YOUTUBE_SHORTS_LIKE_MARKER =
        "data-stream-shell-shorts-like-icon";

    const YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER =
        "data-stream-shell-shorts-like-original";

    const YOUTUBE_SHORTS_LIKE_SVG_MARKER =
        "data-stream-shell-shorts-like-svg";

    const YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR =
        "#segmented-like-button button, like-button-view-model button, #like-button button";

    const YOUTUBE_SHORTS_LIKE_HOST_SELECTOR =
        "#segmented-like-button, like-button-view-model, #like-button";


    let youtubeShortsLikePatchActive =
        false;

    let youtubeShortsLikeButton =
        null;

    let youtubeShortsLikeOriginalSvg =
        null;

    let youtubeShortsLikeCustomSvg =
        null;

    let youtubeShortsLikeObserver =
        null;

    let youtubeShortsLikeObserverRoot =
        null;

    let youtubeShortsLikeDiscoveryObserver =
        null;

    let youtubeShortsLikeDiscoveryObserverRoot =
        null;


    const YOUTUBE_SHORTS_THUMB_DOWN_OUTLINE_PATH =
        "m11.31 2 .392.007c1.824.06 3.61.534 5.223 1.388l.343.189.27.154c.264.152.56.24.863.26l.13.004H20.5a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-1.79l-.158.013a1 1 0 00-.723.512l-.064.145-2.987 8.535a1 1 0 01-1.109.656l-1.04-.174a4 4 0 01-3.251-4.783L10 15H5.938a3.664 3.664 0 01-3.576-2.868A3.682 3.682 0 013 9.15l-.02-.088A3.816 3.816 0 014 5.5v-.043l.008-.227a2.86 2.86 0 01.136-.664l.107-.28A3.754 3.754 0 017.705 2h3.605ZM7.705 4c-.755 0-1.425.483-1.663 1.2l-.032.126a.818.818 0 00-.01.131v.872l-.587.586a1.816 1.816 0 00-.524 1.465l.038.23.02.087.21.9-.55.744a1.686 1.686 0 00-.321 1.18l.029.177c.17.76.844 1.302 1.623 1.302H10a2.002 2.002 0 011.956 2.419l-.623 2.904-.034.208a2.002 2.002 0 001.454 2.139l.206.045.21.035 2.708-7.741A3.001 3.001 0 0118.71 11H20V6.002h-1.47c-.696 0-1.38-.183-1.985-.528l-.27-.155-.285-.157A10.002 10.002 0 0011.31 4H7.705Z";

    const YOUTUBE_SHORTS_THUMB_DOWN_FILLED_PATH =
        "M11.313 2.002c2.088 0 4.14.546 5.953 1.583l.273.156a2 2 0 00.993.264H21a1 1 0 011 1V11a1 1 0 01-1.002 1l-2.787-.005a1 1 0 00-.946.67l-3.02 8.628a.815.815 0 01-.966.522 3.262 3.262 0 01-2.35-4.062l.707-2.477a1 1 0 00-.961-1.274h-5.29a2.24 2.24 0 01-2.004-1.238l-.18-.359a1.784 1.784 0 01.601-2.278.446.446 0 00.198-.37v-.07a.578.578 0 00-.116-.347 2.374 2.374 0 01.412-3.278l.498-.399a.379.379 0 00.123-.415l-.07-.207a2.1 2.1 0 01.313-1.923A2.798 2.798 0 017.4 2l3.913.002Z";


    function clearYouTubeShortsLikeIcons() {
        if (
            !youtubeShortsLikePatchActive
        ) {
            return false;
        }


        try {
            youtubeShortsLikeCustomSvg
                ?.remove?.();
        } catch {
        }


        try {
            youtubeShortsLikeOriginalSvg
                ?.style
                ?.removeProperty(
                    "visibility"
                );

            youtubeShortsLikeOriginalSvg
                ?.removeAttribute?.(
                    YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER
                );
        } catch {
        }


        try {
            youtubeShortsLikeButton
                ?.removeAttribute?.(
                    YOUTUBE_SHORTS_LIKE_MARKER
                );
        } catch {
        }


        youtubeShortsLikePatchActive =
            false;

        youtubeShortsLikeButton =
            null;

        youtubeShortsLikeOriginalSvg =
            null;

        youtubeShortsLikeCustomSvg =
            null;


        return true;
    }


    function isYouTubeShortsLikePressed(
        button
    ) {
        if (
            isPressedButton(
                button
            )
        ) {
            return true;
        }


        const stateHost =
            button?.closest?.(
                "[aria-pressed], [aria-checked]"
            );


        if (
            stateHost &&
            stateHost !== button &&
            isPressedButton(
                stateHost
            )
        ) {
            return true;
        }


        const label =
            [
                button?.getAttribute?.(
                    "aria-label"
                ),
                button?.getAttribute?.(
                    "title"
                )
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase();


        return (
            label.includes(
                "unlike"
            ) ||
            label.includes(
                "gefällt mir nicht mehr"
            ) ||
            label.includes(
                "mag ich nicht mehr"
            )
        );
    }


    function createYouTubeShortsThumbSvg(
        pressed
    ) {
        const namespace =
            "http://www.w3.org/2000/svg";


        const svg =
            document.createElementNS(
                namespace,
                "svg"
            );


        svg.setAttribute(
            YOUTUBE_SHORTS_LIKE_SVG_MARKER,
            "true"
        );

        svg.setAttribute(
            "viewBox",
            "0 0 24 24"
        );

        svg.setAttribute(
            "width",
            "24"
        );

        svg.setAttribute(
            "height",
            "24"
        );

        svg.setAttribute(
            "aria-hidden",
            "true"
        );

        svg.setAttribute(
            "focusable",
            "false"
        );

        svg.style.setProperty(
            "display",
            "block"
        );

        svg.style.setProperty(
            "width",
            "24px"
        );

        svg.style.setProperty(
            "height",
            "24px"
        );

        svg.style.setProperty(
            "pointer-events",
            "none"
        );

        svg.style.setProperty(
            "color",
            "currentColor"
        );


        const path =
            document.createElementNS(
                namespace,
                "path"
            );


        path.setAttribute(
            "d",
            pressed
                ? YOUTUBE_SHORTS_THUMB_DOWN_FILLED_PATH
                : YOUTUBE_SHORTS_THUMB_DOWN_OUTLINE_PATH
        );

        path.setAttribute(
            "fill",
            "currentColor"
        );

        // Rotate the old/native Shorts dislike geometry 180 degrees so the
        // thumb points up and keeps YouTube's normal left/right orientation.
        path.setAttribute(
            "transform",
            "translate(24 24) scale(-1 -1)"
        );


        svg.appendChild(
            path
        );


        return svg;
    }


    function scheduleYouTubeShortsLikeIconSync() {
        if (
            !shouldProviderResourceObserveDom()
        ) {
            return;
        }


        const run =
            () => {
                if (
                    shouldProviderResourceObserveDom()
                ) {
                    syncYouTubeShortsLikeIcon();
                }
            };


        setTimeout(
            run,
            0
        );

        setTimeout(
            run,
            160
        );
    }


    function bindYouTubeShortsLikeButton(
        button
    ) {
        if (
            button.__streamShellShortsLikeBound ===
                true
        ) {
            return;
        }


        button.__streamShellShortsLikeBound =
            true;


        button.addEventListener(
            "click",
            scheduleYouTubeShortsLikeIconSync,
            true
        );
    }


    function mutationTouchesYouTubeShortsLikeControl(
        mutation,
        scope
    ) {
        const target =
            mutation.target instanceof Element
                ? mutation.target
                : null;


        if (
            mutation.type ===
                "attributes"
        ) {
            if (
                target === scope &&
                mutation.attributeName ===
                    "is-active"
            ) {
                return true;
            }


            return Boolean(
                target?.matches?.(
                    YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR
                ) ||
                target?.closest?.(
                    YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
                )
            );
        }


        if (
            mutation.type !==
                "childList"
        ) {
            return false;
        }


        if (
            target?.matches?.(
                YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
            ) ||
            target?.closest?.(
                YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
            )
        ) {
            return true;
        }


        for (
            const node
            of [
                ...mutation.addedNodes,
                ...mutation.removedNodes
            ]
        ) {
            if (
                !(node instanceof Element)
            ) {
                continue;
            }


            if (
                node.hasAttribute?.(
                    YOUTUBE_SHORTS_LIKE_SVG_MARKER
                )
            ) {
                continue;
            }


            if (
                node.matches?.(
                    `${YOUTUBE_SHORTS_LIKE_HOST_SELECTOR}, ${YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR}`
                ) ||
                node.querySelector?.(
                    `${YOUTUBE_SHORTS_LIKE_HOST_SELECTOR}, ${YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR}`
                )
            ) {
                return true;
            }
        }


        return false;
    }


    function disconnectYouTubeShortsLikeDiscoveryObserver() {
        try {
            youtubeShortsLikeDiscoveryObserver
                ?.disconnect?.();
        } catch {
        }


        youtubeShortsLikeDiscoveryObserverRoot =
            null;
    }


    function syncYouTubeShortsLikeDiscoveryObserver(
        enabled =
            true
    ) {
        const allowed =
            enabled !==
                false &&
            !isProviderSafeModeEnabled(
                "youtube"
            ) &&
            shouldProviderResourceObserveDom() &&
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !allowed ||
            getActiveYouTubeShortsRenderer()
        ) {
            disconnectYouTubeShortsLikeDiscoveryObserver();
            return false;
        }


        const root =
            document.querySelector(
                "ytd-shorts"
            ) ||
            document.querySelector(
                "ytd-page-manager"
            );


        if (
            !root
        ) {
            disconnectYouTubeShortsLikeDiscoveryObserver();
            return false;
        }


        if (
            youtubeShortsLikeDiscoveryObserverRoot ===
                root
        ) {
            return true;
        }


        disconnectYouTubeShortsLikeDiscoveryObserver();


        if (
            !youtubeShortsLikeDiscoveryObserver
        ) {
            youtubeShortsLikeDiscoveryObserver =
                new MutationObserver(
                    () => {
                        if (
                            !shouldProviderResourceObserveDom() ||
                            !location.pathname.startsWith(
                                "/shorts/"
                            )
                        ) {
                            disconnectYouTubeShortsLikeDiscoveryObserver();
                            return;
                        }


                        const activeScope =
                            getActiveYouTubeShortsRenderer();


                        if (
                            activeScope
                        ) {
                            disconnectYouTubeShortsLikeDiscoveryObserver();
                            scheduleYouTubeShortsLikeIconSync();
                            return;
                        }


                        const shortsRoot =
                            document.querySelector(
                                "ytd-shorts"
                            );


                        if (
                            shortsRoot &&
                            youtubeShortsLikeDiscoveryObserverRoot !==
                                shortsRoot
                        ) {
                            syncYouTubeShortsLikeDiscoveryObserver();
                        }
                    }
                );
        }


        youtubeShortsLikeDiscoveryObserver.observe(
            root,
            {
                attributes:
                    true,

                childList:
                    true,

                subtree:
                    true,

                attributeFilter: [
                    "is-active"
                ]
            }
        );


        youtubeShortsLikeDiscoveryObserverRoot =
            root;


        return true;
    }


    function syncYouTubeShortsLikeObserver(
        enabled =
            true
    ) {
        const allowed =
            enabled !==
                false &&
            !isProviderSafeModeEnabled(
                "youtube"
            ) &&
            shouldProviderResourceObserveDom() &&
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !allowed
        ) {
            try {
                youtubeShortsLikeObserver
                    ?.disconnect?.();
            } catch {
            }


            youtubeShortsLikeObserverRoot =
                null;

            disconnectYouTubeShortsLikeDiscoveryObserver();


            return false;
        }


        const scope =
            getActiveYouTubeShortsRenderer();


        if (
            !scope
        ) {
            try {
                youtubeShortsLikeObserver
                    ?.disconnect?.();
            } catch {
            }


            youtubeShortsLikeObserverRoot =
                null;

            syncYouTubeShortsLikeDiscoveryObserver();


            return false;
        }


        disconnectYouTubeShortsLikeDiscoveryObserver();


        if (
            youtubeShortsLikeObserverRoot ===
                scope
        ) {
            return true;
        }


        try {
            youtubeShortsLikeObserver
                ?.disconnect?.();
        } catch {
        }


        if (
            !youtubeShortsLikeObserver
        ) {
            youtubeShortsLikeObserver =
                new MutationObserver(
                    mutations => {
                        if (
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        const activeScope =
                            youtubeShortsLikeObserverRoot;


                        if (
                            !activeScope
                        ) {
                            return;
                        }


                        if (
                            mutations.some(
                                mutation =>
                                    mutationTouchesYouTubeShortsLikeControl(
                                        mutation,
                                        activeScope
                                    )
                            )
                        ) {
                            scheduleYouTubeShortsLikeIconSync();
                        }
                    }
                );
        }


        youtubeShortsLikeObserver.observe(
            scope,
            {
                attributes:
                    true,

                childList:
                    true,

                subtree:
                    true,

                attributeFilter: [
                    "is-active",
                    "aria-pressed",
                    "aria-checked",
                    "aria-label",
                    "title"
                ]
            }
        );


        youtubeShortsLikeObserverRoot =
            scope;


        return true;
    }


    function syncYouTubeShortsLikeIcon() {
        const isShort =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !isShort ||
            isProviderSafeModeEnabled(
                "youtube"
            )
        ) {
            clearYouTubeShortsLikeIcons();
            return false;
        }


        const scope =
            getActiveYouTubeShortsRenderer();


        syncYouTubeShortsLikeObserver();


        if (
            !scope
        ) {
            return false;
        }


        const likeButton =
            scope.querySelector(
                YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR
            );


        if (
            !likeButton
        ) {
            return false;
        }


        const originalSvg =
            Array.from(
                likeButton.querySelectorAll(
                    "svg"
                )
            ).find(
                svg =>
                    !svg.hasAttribute(
                        YOUTUBE_SHORTS_LIKE_SVG_MARKER
                    )
            );


        if (
            !originalSvg ||
            !originalSvg.parentElement
        ) {
            return false;
        }


        bindYouTubeShortsLikeButton(
            likeButton
        );


        if (
            youtubeShortsLikePatchActive &&
            (
                youtubeShortsLikeButton !== likeButton ||
                youtubeShortsLikeOriginalSvg !== originalSvg
            )
        ) {
            clearYouTubeShortsLikeIcons();
        }


        likeButton.setAttribute(
            YOUTUBE_SHORTS_LIKE_MARKER,
            "true"
        );


        originalSvg.setAttribute(
            YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER,
            "true"
        );

        originalSvg.style.setProperty(
            "visibility",
            "hidden",
            "important"
        );


        youtubeShortsLikePatchActive =
            true;

        youtubeShortsLikeButton =
            likeButton;

        youtubeShortsLikeOriginalSvg =
            originalSvg;


        const pressed =
            isYouTubeShortsLikePressed(
                likeButton
            );


        if (
            youtubeShortsLikeCustomSvg
                ?.isConnected &&
            youtubeShortsLikeCustomSvg
                ?.getAttribute(
                    "data-stream-shell-pressed"
                ) === String(
                    pressed
                )
        ) {
            return true;
        }


        try {
            youtubeShortsLikeCustomSvg
                ?.remove?.();
        } catch {
        }


        const customSvg =
            createYouTubeShortsThumbSvg(
                pressed
            );


        customSvg.setAttribute(
            "data-stream-shell-pressed",
            String(
                pressed
            )
        );


        originalSvg.parentElement.insertBefore(
            customSvg,
            originalSvg
        );


        youtubeShortsLikeCustomSvg =
            customSvg;


        return true;
    }
    function syncYouTubeLoopSetting() {
        const video =
            getPrimaryVideo();


        if (
            !video ||
            !getYouTubeVideoId()
        ) {
            return;
        }


        const isShort =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (isProviderSafeModeEnabled("youtube")) {
            if (video.loop !== isShort) {
                video.loop = isShort;
            }
            return;
        }


        const overrideEnabled =
            youtubeUtilitySettings[
                YOUTUBE_LOOP_KEY
            ] === true;


        /*
         * With the override disabled, restore YouTube's normal split:
         * regular videos do not loop, Shorts do. The old master switch
         * forced video.loop=false globally and accidentally disabled the
         * native Shorts loop as well.
         */
        const enabled =
            overrideEnabled
                ? (
                    isShort
                        ? youtubeUtilitySettings[
                            YOUTUBE_LOOP_SHORTS_KEY
                        ] === true
                        : youtubeUtilitySettings[
                            YOUTUBE_LOOP_VIDEOS_KEY
                        ] === true
                )
                : isShort;


        if (
            video.loop !==
                enabled
        ) {
            video.loop =
                enabled;
        }
    }


    function dismissYouTubeContinueWatching() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_KEEP_PLAYING_KEY
            ] !== true
        ) {
            return;
        }


        const dialogs =
            document.querySelectorAll(
                "ytd-popup-container yt-confirm-dialog-renderer, ytd-popup-container tp-yt-paper-dialog, ytd-popup-container [role='dialog']"
            );


        for (
            const dialog
            of dialogs
        ) {
            const text =
                String(
                    dialog.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .toLocaleLowerCase();


            if (
                ![
                    "video paused",
                    "continue watching",
                    "video pausiert",
                    "wiedergabe pausiert",
                    "weiterschauen",
                    "weiter ansehen"
                ].some(
                    token =>
                        text.includes(
                            token
                        )
                )
            ) {
                continue;
            }


            const confirm =
                dialog.querySelector(
                    "#confirm-button button, button#confirm-button, #confirm-button, yt-button-shape#confirm-button button"
                );


            try {
                confirm?.click();


                getPrimaryVideo()
                    ?.play?.()
                    ?.catch?.(
                        () => {}
                    );


                return;

            } catch {
            }
        }
    }


    let youtubeTranslatedAudioSurveyLastScanAt =
        0;


    function isYouTubeTranslatedAudioSurveyText(value) {
        const text =
            String(
                value ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim()
                .toLocaleLowerCase();


        return (
            text.includes(
                "how satisfied are you with the translated audio"
            ) ||
            text.includes(
                "translated audio in this video"
            )
        );
    }


    function hideYouTubeTranslatedAudioSurveyElement(element) {
        if (
            !(element instanceof Element)
        ) {
            return false;
        }


        element.setAttribute(
            "data-stream-shell-translated-audio-survey-hidden",
            "true"
        );


        return true;
    }


    function dismissYouTubeTranslatedAudioSurvey() {
        if (isProviderSafeModeEnabled("youtube")) {
            document
                .querySelectorAll(
                    "[data-stream-shell-translated-audio-survey-hidden]"
                )
                .forEach(
                    element => {
                        element.removeAttribute(
                            "data-stream-shell-translated-audio-survey-hidden"
                        );
                    }
                );


            youtubeTranslatedAudioSurveyLastScanAt =
                0;


            return false;
        }


        /*
         * This runs from YouTube's shared DOM observer. The 0.15.7 fallback
         * read textContent from the whole player/popup tree and, once a
         * wording match existed, walked every descendant. On a busy watch
         * page that turned a tiny survey cleanup into repeated full-DOM work.
         *
         * The survey is rare and does not need sub-200 ms reaction time, so
         * keep the scan narrow, bounded and throttled. If YouTube changes the
         * wrapper again we intentionally fail closed instead of searching the
         * entire page.
         */
        const now =
            Date.now();


        if (
            now - youtubeTranslatedAudioSurveyLastScanAt <
                1200
        ) {
            return false;
        }


        youtubeTranslatedAudioSurveyLastScanAt =
            now;


        const selector = [
            "yt-survey-renderer",
            "ytd-survey-renderer",
            "ytd-player-survey-renderer",
            "[role='dialog']",
            "tp-yt-paper-dialog"
        ].join(",");


        const roots = [
            document.getElementById(
                "movie_player"
            ),
            document.querySelector(
                "ytd-popup-container"
            )
        ].filter(Boolean);


        for (
            const root
            of roots
        ) {
            const candidates = [
                ...(
                    root.matches?.(selector)
                        ? [root]
                        : []
                ),
                ...root.querySelectorAll(
                    selector
                )
            ];


            for (
                const candidate
                of candidates
            ) {
                if (
                    !isYouTubeTranslatedAudioSurveyText(
                        candidate.textContent
                    )
                ) {
                    continue;
                }


                return hideYouTubeTranslatedAudioSurveyElement(
                    candidate
                );
            }
        }


        return false;
    }

    /*
     * ============================================================
     * YOUTUBE RUNTIME 0.17
     * ============================================================
     * No global documentElement observer. Each hot surface gets a narrow
     * observer and a small work queue. SPA navigation is handled by bounded
     * settle passes; the resource governor can park all DOM work.
     */

    function clearYouTubeUtilityDomTimer() {
        if (
            youtubeUtilityDomTimer
        ) {
            clearTimeout(
                youtubeUtilityDomTimer
            );


            youtubeUtilityDomTimer =
                null;
        }


        youtubeUtilityPendingWork.clear();
    }


    function cancelYouTubeUtilitySettlePasses() {
        youtubeUtilitySettleGeneration +=
            1;


        for (
            const timer
            of youtubeUtilitySettleTimers
        ) {
            clearTimeout(
                timer
            );
        }


        youtubeUtilitySettleTimers.clear();
    }


    function runYouTubeUtilityWork(
        kinds
    ) {
        const work =
            new Set(
                kinds
            );


        const all =
            work.has(
                "all"
            );


        if (
            all ||
            work.has(
                "guide"
            )
        ) {
            syncYouTubeTextCleanupTargets();
        }


        if (
            all ||
            work.has(
                "player"
            )
        ) {
            syncYouTubeAutoplaySetting();
            applyYouTubeUploadDate();
            syncYouTubeLoopSetting();
            dismissYouTubeTranslatedAudioSurvey();
        }


        if (
            all ||
            work.has(
                "popup"
            )
        ) {
            dismissYouTubeTranslatedAudioSurvey();
            dismissYouTubeContinueWatching();
        }


        if (
            all ||
            work.has(
                "shorts"
            )
        ) {
            syncYouTubeShortsLikeIcon();
            syncYouTubeShortsLikeObserver();
        }


        syncYouTubeRuntimeObservers();
    }


    function scheduleYouTubeUtilityDomSync(
        kind =
            "all",
        delay =
            120
    ) {
        if (
            !shouldProviderResourceObserveDom()
        ) {
            clearYouTubeUtilityDomTimer();
            return;
        }


        youtubeUtilityPendingWork.add(
            String(
                kind ||
                "all"
            )
        );


        if (
            youtubeUtilityDomTimer
        ) {
            return;
        }


        youtubeUtilityDomTimer =
            setTimeout(
                () => {
                    youtubeUtilityDomTimer =
                        null;


                    if (
                        !shouldProviderResourceObserveDom()
                    ) {
                        youtubeUtilityPendingWork.clear();
                        return;
                    }


                    const kinds =
                        [...youtubeUtilityPendingWork];


                    youtubeUtilityPendingWork.clear();


                    runYouTubeUtilityWork(
                        kinds
                    );
                },
                Math.max(
                    0,
                    Number(
                        delay
                    ) ||
                    0
                )
            );
    }


    function getYouTubeRuntimeObserverRoot(
        kind
    ) {
        if (
            kind ===
                "popup"
        ) {
            return document.querySelector(
                "ytd-popup-container"
            );
        }


        if (
            kind ===
                "player"
        ) {
            return document.getElementById(
                "movie_player"
            ) ||
                document.querySelector(
                    "ytd-watch-flexy"
                );
        }


        if (
            kind ===
                "guide"
        ) {
            return document.querySelector(
                "ytd-guide-renderer, #guide-content, tp-yt-app-drawer"
            );
        }


        return null;
    }


    function disconnectYouTubeRuntimeObserver(
        kind
    ) {
        try {
            youtubeRuntimeObservers[
                kind
            ]?.disconnect?.();
        } catch {
        }


        youtubeRuntimeObserverRoots[
            kind
        ] =
            null;
    }


    function disconnectYouTubeRuntimeObservers() {
        for (
            const kind
            of [
                "popup",
                "player",
                "guide"
            ]
        ) {
            disconnectYouTubeRuntimeObserver(
                kind
            );
        }


        youtubeRuntimeObserversActive =
            false;


        syncYouTubeShortsLikeObserver(
            false
        );
    }


    function ensureYouTubeRuntimeObserver(
        kind
    ) {
        const root =
            getYouTubeRuntimeObserverRoot(
                kind
            );


        if (
            !root
        ) {
            disconnectYouTubeRuntimeObserver(
                kind
            );
            return false;
        }


        if (
            youtubeRuntimeObserverRoots[
                kind
            ] ===
                root
        ) {
            return true;
        }


        disconnectYouTubeRuntimeObserver(
            kind
        );


        if (
            !youtubeRuntimeObservers[
                kind
            ]
        ) {
            youtubeRuntimeObservers[
                kind
            ] =
                new MutationObserver(
                    mutations => {
                        if (
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        if (
                            kind ===
                                "guide"
                        ) {
                            for (
                                const mutation
                                of mutations
                            ) {
                                for (
                                    const node
                                    of mutation.addedNodes
                                ) {
                                    if (
                                        node instanceof
                                            Element
                                    ) {
                                        syncYouTubeTextCleanupTargets(
                                            node
                                        );
                                    }
                                }
                            }


                            return;
                        }


                        scheduleYouTubeUtilityDomSync(
                            kind
                        );
                    }
                );
        }


        youtubeRuntimeObservers[
            kind
        ].observe(
            root,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );


        youtubeRuntimeObserverRoots[
            kind
        ] =
            root;


        return true;
    }


    function syncYouTubeRuntimeObservers() {
        if (
            typeof MutationObserver !==
                "function" ||
            isProviderSafeModeEnabled(
                "youtube"
            ) ||
            !shouldProviderResourceObserveDom()
        ) {
            disconnectYouTubeRuntimeObservers();
            return false;
        }


        const states =
            [
                "popup",
                "player",
                "guide"
            ].map(
                ensureYouTubeRuntimeObserver
            );


        syncYouTubeShortsLikeObserver();


        youtubeRuntimeObserversActive =
            states.some(
                Boolean
            );


        return youtubeRuntimeObserversActive;
    }


    function scheduleYouTubeNavigationSettle() {
        cancelYouTubeUtilitySettlePasses();


        if (
            !shouldProviderResourceObserveDom()
        ) {
            return;
        }


        const generation =
            youtubeUtilitySettleGeneration;


        for (
            const delay
            of [
                0,
                120,
                350,
                900,
                1800
            ]
        ) {
            const timer =
                setTimeout(
                    () => {
                        youtubeUtilitySettleTimers.delete(
                            timer
                        );


                        if (
                            generation !==
                                youtubeUtilitySettleGeneration ||
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        syncYouTubeRuntimeObservers();
                        scheduleYouTubeUtilityDomSync(
                            "all",
                            0
                        );
                    },
                    delay
                );


            youtubeUtilitySettleTimers.add(
                timer
            );
        }
    }


    function handleYouTubeUtilityNavigation() {
        restoreYouTubeUploadDate();
        clearYouTubeTextCleanupTargets();

        youtubeTranslatedAudioSurveyLastScanAt =
            0;

        youtubeLastQualityVideoId =
            "";

        youtubeNowPlayingStaticCache =
            null;


        scheduleYouTubePreferredQuality();

        disconnectYouTubeRuntimeObservers();
        scheduleYouTubeNavigationSettle();


        providerApiNotifyExtensionChange(
            "youtubeUtilities",
            {
                reason:
                    "navigation"
            }
        );
    }


    function getYouTubeRuntimeDiagnosticState() {
        return {
            globalObserver:
                false,

            observersActive:
                youtubeRuntimeObserversActive,

            observers: {
                popup:
                    Boolean(
                        youtubeRuntimeObserverRoots.popup
                    ),

                player:
                    Boolean(
                        youtubeRuntimeObserverRoots.player
                    ),

                guide:
                    Boolean(
                        youtubeRuntimeObserverRoots.guide
                    ),

                shortsLike:
                    Boolean(
                        youtubeShortsLikeObserverRoot
                    )
            },

            pendingWork:
                [...youtubeUtilityPendingWork],

            settlePasses:
                youtubeUtilitySettleTimers.size,

            domTimer:
                Boolean(
                    youtubeUtilityDomTimer
                )
        };
    }
    async function startYouTubeUtilities() {
        if (
            getCurrentProvider() !==
                "youtube"
        ) {
            return;
        }


        const keys = [
            ...Object.keys(
                YOUTUBE_UTILITY_DEFAULTS
            )
        ];


        try {
            const stored =
                await chrome.storage.local.get(
                    keys
                );


            youtubeUtilitySettings = {
                ...YOUTUBE_UTILITY_DEFAULTS,
                ...stored
            };

        } catch {
        }


        setYouTubeThemeMarker();
        syncYouTubeCleanupMarkers();
        handleYouTubeUtilityNavigation();


        chrome.storage.onChanged.addListener(
            (
                changes,
                areaName
            ) => {
                if (
                    areaName !==
                        "local"
                ) {
                    return;
                }


                let relevant =
                    false;


                for (
                    const [key, change]
                    of Object.entries(
                        changes
                    )
                ) {
                    if (
                        !Object.prototype.hasOwnProperty.call(
                            YOUTUBE_UTILITY_DEFAULTS,
                            key
                        )
                    ) {
                        continue;
                    }


                    youtubeUtilitySettings[key] =
                        change.newValue ===
                            undefined
                            ? YOUTUBE_UTILITY_DEFAULTS[key]
                            : change.newValue;


                    relevant =
                        true;
                }


                if (
                    !relevant
                ) {
                    return;
                }


                setYouTubeThemeMarker();
                syncYouTubeCleanupMarkers();
                applyYouTubeUploadDate();
                syncYouTubeLoopSetting();
                dismissYouTubeContinueWatching();
                scheduleYouTubePreferredQuality();


                providerApiNotifyExtensionChange(
                    "youtubeUtilities",
                    {
                        reason: "settings"
                    }
                );
            }
        );


        document.addEventListener(
            "yt-navigate-finish",
            handleYouTubeUtilityNavigation,
            true
        );


        document.addEventListener(
            "yt-popup-opened",
            () => {
                scheduleYouTubeUtilityDomSync(
                    "popup",
                    0
                );
            },
            true
        );


        document.addEventListener(
            "loadedmetadata",
            () => {
                if (
                    !shouldProviderResourceObserveDom()
                ) {
                    return;
                }


                applyYouTubePreferredQuality(
                    true
                );


                applyYouTubeUploadDate();
                syncYouTubeLoopSetting();
            },
            true
        );


        syncYouTubeRuntimeObservers();


        onProviderResourceGovernorChange(
            state => {
                if (
                    state?.domObserversAllowed ===
                        true
                ) {
                    syncYouTubeRuntimeObservers();
                    scheduleYouTubeNavigationSettle();

                } else {
                    clearYouTubeUtilityDomTimer();
                    cancelYouTubeUtilitySettlePasses();
                    disconnectYouTubeRuntimeObservers();
                }
            }
        );


        youtubeAutoLikeTimer =
            createProviderResourceLoop(
                "youtube-auto-like",
                () => {
                    if (
                        shouldProviderResourceObserveDom()
                    ) {
                        runYouTubeAutoLike();
                    }
                },
                1000,
                "dom"
            );
    }

    /*
     * ============================================================
     * YOUTUBE PROVIDER ADAPTER
     * ============================================================
     * First provider-specific Provider API implementation. All shared
     * shell consumers should talk to this adapter instead of knowing
     * YouTube selectors, root markers or utility internals directly.
     */

    let youtubeNowPlayingStaticCache =
        null;


    function readYouTubeAdapterMarker(name) {
        const root = document.documentElement;
        if (!root?.hasAttribute(name)) return null;
        return root.getAttribute(name) || "true";
    }

    function getYouTubeCleanupAdapterState() {
        const entries = Object.entries(YOUTUBE_CLEANUP_SETTINGS);
        const configuredEnabled = entries
            .filter(([key]) => youtubeUtilitySettings[key] === true)
            .map(([key]) => key.replace(/^streamShellYoutubeCleanup/, ""));
        const safeMode = isProviderSafeModeEnabled("youtube");
        const enabled = safeMode ? [] : configuredEnabled;

        const activeMarkers = entries.filter(([, attribute]) =>
            document.documentElement?.hasAttribute(attribute)
        ).length;

        return {
            enabledCount: enabled.length,
            configuredEnabledCount: configuredEnabled.length,
            configuredCount: entries.length,
            activeMarkerCount: activeMarkers,
            enabledRules: enabled,
            safeMode
        };
    }

    function getYouTubeAdapterExtensionState() {
        const root = document.documentElement;
        const player = getYouTubePlayer();
        const video = getPrimaryVideo();
        const videoId = getYouTubeVideoId();
        const rydRatio = getYouTubeRydLikeRatio();
        const uploadDatePresent = Boolean(
            document.querySelector("[data-stream-shell-upload-date]")
        );
        const windowedMarker = readYouTubeAdapterMarker(
            "data-stream-shell-windowed-player"
        );
        const extrasMarker = readYouTubeAdapterMarker(
            "data-stream-shell-youtube-extras"
        );
        const themeMarker = readYouTubeAdapterMarker(
            "data-stream-shell-youtube-theme"
        );
        const safeMode = isProviderSafeModeEnabled("youtube");

        return {
            safeMode,
            theme: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_THEME_STORAGE_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_THEME_STORAGE_KEY] !== false,
                marker: themeMarker === "true"
            },
            windowedPlayer: {
                active: windowedMarker === "youtube",
                watchContext: isWindowedPlayerWatchContext("youtube"),
                theater: Boolean(getYouTubeWatchContainer()?.hasAttribute("theater"))
            },
            extras: {
                enabled: !safeMode && youtubeExtrasEnabled !== false,
                configuredEnabled: youtubeExtrasEnabled !== false,
                active: extrasMarker === "true"
            },
            ryd: {
                available: Number.isFinite(rydRatio),
                ratio: Number.isFinite(rydRatio) ? rydRatio : null,
                tooltipPresent: Boolean(document.querySelector("#ryd-dislike-tooltip")),
                barWidth: document.querySelector("#ryd-bar")?.style?.width || null
            },
            quality: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_QUALITY_ENABLED_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_QUALITY_ENABLED_KEY] !== false,
                preferred: String(youtubeUtilitySettings[YOUTUBE_QUALITY_KEY] || "hd1080"),
                playerPresent: Boolean(player)
            },
            uploadDate: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_ENABLED_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_ENABLED_KEY] !== false,
                present: uploadDatePresent,
                format: String(youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_FORMAT_KEY] || "friendly"),
                relativeEnabled: youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY] !== false,
                relativeDays: Number(youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY]) || 1
            },
            autoLike: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_ENABLED_KEY] === true,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_ENABLED_KEY] === true,
                trigger: String(youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_TRIGGER_KEY] || "percent"),
                subscribedOnly: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY] === true,
                shorts: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_SHORTS_KEY] === true,
                handledCurrent: Boolean(videoId && youtubeAutoLikedVideoIds.has(videoId))
            },
            keepPlaying: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_KEEP_PLAYING_KEY] === true,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_KEEP_PLAYING_KEY] === true
            },
            loop: {
                overrideEnabled: !safeMode && youtubeUtilitySettings[YOUTUBE_LOOP_KEY] === true,
                configuredOverrideEnabled: youtubeUtilitySettings[YOUTUBE_LOOP_KEY] === true,
                videos: youtubeUtilitySettings[YOUTUBE_LOOP_VIDEOS_KEY] === true,
                shorts: youtubeUtilitySettings[YOUTUBE_LOOP_SHORTS_KEY] === true,
                currentVideoLoop: video ? video.loop === true : null
            },
            cleanup: getYouTubeCleanupAdapterState(),
            rootReady: Boolean(root)
        };
    }

    function getYouTubeAdapterExtensionCapabilities({ watchContext, video }) {
        const state = getYouTubeAdapterExtensionState();

        return {
            rydRatio: makeCapability(
                true,
                state.ryd.available,
                state.ryd.available ? `${state.ryd.ratio}%` : "missing"
            ),
            windowedPlayer: makeCapability(
                true,
                watchContext,
                state.windowedPlayer.active ? "on" : "off"
            ),
            extras: makeCapability(
                true,
                watchContext,
                state.extras.active ? "on" : (state.extras.enabled ? "ready" : "disabled")
            ),
            theme: makeCapability(
                true,
                state.rootReady,
                state.theme.marker ? "on" : (state.theme.enabled ? "marker-missing" : "off")
            ),
            uploadDate: makeCapability(
                true,
                state.uploadDate.present,
                state.uploadDate.enabled
                    ? (state.uploadDate.present ? "present" : "not-present")
                    : "disabled"
            ),
            qualityControl: makeCapability(
                true,
                state.quality.playerPresent,
                state.quality.enabled
                    ? (state.quality.playerPresent ? `ready · ${state.quality.preferred}` : "player-missing")
                    : "disabled"
            ),
            autoLike: makeCapability(
                true,
                watchContext && Boolean(video),
                state.autoLike.enabled ? "armed" : "disabled"
            ),
            keepPlaying: makeCapability(
                true,
                watchContext,
                state.keepPlaying.enabled ? "armed" : "disabled"
            ),
            loop: makeCapability(
                true,
                watchContext && Boolean(video),
                state.loop.overrideEnabled ? "override" : "native"
            ),
            cleanup: makeCapability(
                true,
                state.rootReady,
                `${state.cleanup.enabledCount}/${state.cleanup.configuredCount} active`
            )
        };
    }

    function syncYouTubeAdapterWindowedPlayer(enabled) {
        const active = !isProviderSafeModeEnabled("youtube") &&
            Boolean(enabled) &&
            isWindowedPlayerWatchContext("youtube");

        setWindowedPlayerRootMarker("youtube", active);
        bindYouTubeTopUiPointer(active);

        if (active) {
            scheduleYouTubeTheaterMode();
        } else {
            restoreYouTubeTheaterModeIfNeeded();
            clearYouTubeTopUiTimer();
            setYouTubeTopUiVisible(false);
        }

        syncYouTubeExtrasMode(active && youtubeExtrasEnabled);
        providerApiNotifyExtensionChange("windowedPlayer", {
            active
        });

        return active;
    }

    function createYouTubeProviderAdapter(baseAdapter) {
        const extensions = {
            ryd: {
                getRatio: () => getYouTubeRydLikeRatio()
            },
            windowedPlayer: {
                storageKeys: [
                    YOUTUBE_EXTRAS_STORAGE_KEY,
                    displayScopedStorageKey(YOUTUBE_EXTRAS_STORAGE_KEY)
                ],
                hydrate(stored) {
                    youtubeExtrasEnabled = readDisplayScopedSetting(
                        stored,
                        YOUTUBE_EXTRAS_STORAGE_KEY,
                        true
                    ) !== false;
                },
                handleStorageChanges(changes) {
                    const scopedKey = displayScopedStorageKey(
                        YOUTUBE_EXTRAS_STORAGE_KEY
                    );

                    if (Object.prototype.hasOwnProperty.call(changes || {}, scopedKey)) {
                        if (changes[scopedKey]?.newValue === undefined) {
                            chrome.storage.local.get(YOUTUBE_EXTRAS_STORAGE_KEY)
                                .then(stored => {
                                    youtubeExtrasEnabled = stored[YOUTUBE_EXTRAS_STORAGE_KEY] !== false;
                                    syncYouTubeAdapterWindowedPlayer(
                                        document.documentElement?.getAttribute(
                                            "data-stream-shell-windowed-player"
                                        ) === "youtube"
                                    );
                                })
                                .catch(() => {});
                        } else {
                            youtubeExtrasEnabled = changes[scopedKey]?.newValue !== false;
                        }
                        return true;
                    }

                    if (!Object.prototype.hasOwnProperty.call(
                        changes || {},
                        YOUTUBE_EXTRAS_STORAGE_KEY
                    )) {
                        return false;
                    }

                    chrome.storage.local.get(scopedKey)
                        .then(stored => {
                            if (!Object.prototype.hasOwnProperty.call(stored, scopedKey)) {
                                youtubeExtrasEnabled = changes[YOUTUBE_EXTRAS_STORAGE_KEY]
                                    ?.newValue !== false;
                                syncYouTubeAdapterWindowedPlayer(
                                    document.documentElement?.getAttribute(
                                        "data-stream-shell-windowed-player"
                                    ) === "youtube"
                                );
                            }
                        })
                        .catch(() => {});
                    return false;
                },
                sync: syncYouTubeAdapterWindowedPlayer,
                start(sync) {
                    document.addEventListener(
                        "yt-navigate-finish",
                        sync,
                        true
                    );
                },
                matchesTarget(target) {
                    return target instanceof Element &&
                        Boolean(target.closest("#movie_player"));
                },
                getState: () => getYouTubeAdapterExtensionState().windowedPlayer
            },
            extras: {
                getState: () => getYouTubeAdapterExtensionState().extras,
                sync: enabled => syncYouTubeExtrasMode(Boolean(enabled))
            },
            theme: {
                getState: () => getYouTubeAdapterExtensionState().theme,
                sync: setYouTubeThemeMarker
            },
            quality: {
                getState: () => getYouTubeAdapterExtensionState().quality,
                applyPreferred: force => applyYouTubePreferredQuality(force === true),
                schedulePreferred: scheduleYouTubePreferredQuality
            },
            uploadDate: {
                getState: () => getYouTubeAdapterExtensionState().uploadDate,
                refresh: applyYouTubeUploadDate,
                restore: restoreYouTubeUploadDate
            },
            autoLike: {
                getState: () => getYouTubeAdapterExtensionState().autoLike,
                run: runYouTubeAutoLike
            },
            keepPlaying: {
                getState: () => getYouTubeAdapterExtensionState().keepPlaying,
                dismissPrompt: dismissYouTubeContinueWatching
            },
            loop: {
                getState: () => getYouTubeAdapterExtensionState().loop,
                sync: syncYouTubeLoopSetting
            },
            cleanup: {
                getState: getYouTubeCleanupAdapterState,
                sync: syncYouTubeCleanupMarkers
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "youtube",
            resumeStrategy: "clean-watch-url + stabilized-seek",
            linkResolverStrategy: "video-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 750,
                checks: 3,
                toleranceSeconds: 4
            },
            extensions,
            getExtensionState: getYouTubeAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                document.addEventListener(
                    "yt-navigate-finish",
                    () => {
                        /*
                         * YouTube updates the /watch?v= URL before every
                         * piece of watch metadata has necessarily settled.
                         * A metadata tick in that gap can therefore cache
                         * the previous video's title under the new video ID.
                         * yt-navigate-finish is the authoritative boundary:
                         * invalidate before publishing so the finished page
                         * repopulates the static snapshot once.
                         */
                        youtubeNowPlayingStaticCache =
                            null;

                        emitState?.("yt-navigate-finish");
                        setTimeout(
                            () => applyPendingResume?.(),
                            80
                        );
                    },
                    true
                );
            },
            async getMediaSnapshot() {
                const identity =
                    adapter.getIdentity?.() ||
                    getProviderMediaIdentity(
                        "youtube",
                        window.location.href
                    );

                const videoId =
                    getYouTubeVideoId();

                const staticKey =
                    videoId ||
                    identity ||
                    `${window.location.pathname}${window.location.search}`;


                if (
                    youtubeNowPlayingStaticCache?.key ===
                        staticKey &&
                    youtubeNowPlayingStaticCache.title
                ) {
                    return {
                        provider:
                            "youtube",

                        title:
                            youtubeNowPlayingStaticCache.title,

                        image:
                            youtubeNowPlayingStaticCache.image,

                        url:
                            youtubeNowPlayingStaticCache.url,

                        identity:
                            youtubeNowPlayingStaticCache.identity,

                        likeRatio:
                            getYouTubeRydLikeRatio(),

                        ...getPlaybackSnapshot()
                    };
                }


                const media =
                    await getProviderMediaSnapshot(
                        "youtube",
                        adapter
                    );


                if (
                    !media
                ) {
                    return null;
                }


                youtubeNowPlayingStaticCache = {
                    key:
                        staticKey,

                    title:
                        media.title,

                    image:
                        media.image,

                    url:
                        media.url,

                    identity:
                        media.identity
                };


                media.likeRatio =
                    getYouTubeRydLikeRatio();


                return media;
            }
        };

        adapter.getExtensionCapabilities = context =>
            getYouTubeAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("youtube", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "youtube",
        createYouTubeProviderAdapter
    );
    /*
     * ============================================================
     * PROVIDER SELF-HEAL / REPAIR
     * ============================================================
     * Targeted, provider-local recovery primitives used by Diagnostics.
     * No broad reinjection: repair escalates from marker/state resync to
     * adapter/runtime rebuild and only the background may reload a tab.
     */
    let providerRepairLastResult = null;

    const PROVIDER_REPAIR_ACTIONS = new Set([
        "restore-managed-marker",
        "clear-pending-resume",
        "resync-adapter",
        "resync-content-state",
        "reinitialize-runtime",
        "netflix-bridge-probe"
    ]);

    function setProviderRepairResult(provider, action, ok, detail = {}) {
        providerRepairLastResult = {
            provider,
            action,
            ok: ok === true,
            detail: detail && typeof detail === "object" ? detail : {},
            at: Date.now()
        };

        recordProviderFlightEvent(ok === true ? "completed" : "failed", {
            category: "repair",
            level: ok === true ? "info" : "error",
            provider,
            detail: {
                action,
                ...providerRepairLastResult.detail
            }
        });

        return providerRepairLastResult;
    }

    async function hydratePlaybackRepairSettings(provider) {
        const keys = playbackUtilityKeysForProvider(provider);
        if (!keys.length) return;

        try {
            const stored = await chrome.storage.local.get(keys);
            for (const key of keys) {
                playbackUtilitySettings[key] = stored[key] === undefined
                    ? playbackUtilityDefaults[key]
                    : stored[key];
            }
        } catch {
        }
    }

    async function hydrateProviderFeatureRepairSettings(provider) {
        try {
            if (provider === "youtube") {
                const stored = await chrome.storage.local.get(
                    Object.keys(YOUTUBE_UTILITY_DEFAULTS)
                );
                youtubeUtilitySettings = {
                    ...YOUTUBE_UTILITY_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "netflix") {
                const stored = await chrome.storage.local.get(
                    Object.keys(NETFLIX_ENHANCEMENT_DEFAULTS)
                );
                netflixEnhancementSettings = {
                    ...NETFLIX_ENHANCEMENT_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "prime") {
                const stored = await chrome.storage.local.get(
                    Object.keys(PRIME_SETTINGS_DEFAULTS)
                );
                primeSettings = {
                    ...PRIME_SETTINGS_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "crunchyroll") {
                const stored = await chrome.storage.local.get(
                    Object.keys(CRUNCHYROLL_ENHANCEMENT_DEFAULTS)
                );
                crunchyrollEnhancementSettings = {
                    ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                    ...stored
                };
            }
        } catch {
        }
    }

    async function resyncWindowedPlayerRepairState(provider, adapter) {
        if (!WINDOWED_PLAYER_PROVIDERS.has(provider)) return false;

        const storageKey = getWindowedPlayerStorageKey(provider);
        const extension = adapter?.extensions?.windowedPlayer || null;
        const storageKeys = [
            storageKey,
            ...(Array.isArray(extension?.storageKeys)
                ? extension.storageKeys
                : [])
        ];

        let stored = {};
        try {
            stored = await chrome.storage.local.get(storageKeys);
        } catch {
        }

        try {
            extension?.hydrate?.(stored);
        } catch {
        }

        syncWindowedPlayerMode(
            provider,
            stored[storageKey] === true
        );
        return true;
    }

    async function applyProviderRepairState(provider, adapter) {
        startManagedMarkerGuard();
        await resyncWindowedPlayerRepairState(provider, adapter);

        try {
            syncPlaybackUtilities(provider);
        } catch {
        }

        if (provider === "youtube") {
            try { setYouTubeThemeMarker(); } catch {}
            try { syncYouTubeCleanupMarkers(); } catch {}
            try { handleYouTubeUtilityNavigation(); } catch {}
        } else if (provider === "netflix") {
            try { runNetflixEnhancements(); } catch {}
        } else if (provider === "prime") {
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
        } else if (provider === "crunchyroll") {
            try {
                adapter?.extensions?.enhancements?.syncSettings?.();
                await adapter?.extensions?.skipEvents?.load?.(true);
            } catch {
            }
        } else if (provider === "disney") {
            try {
                adapter?.extensions?.subtitleStyling?.sync?.(
                    playbackUtilitySettings
                );
            } catch {
            }
        }

        providerApiNotifyExtensionChange("diagnosticsRepair", {
            repair: "content-state"
        });
        return true;
    }

    function rebuildProviderAdapterForRepair(provider) {
        providerAdapterInstances.delete(provider);
        const adapter = getProviderAdapter(provider);
        return adapter?.adapterKind === provider
            ? adapter
            : null;
    }

    async function executeProviderRepair(action) {
        const provider = getCurrentProvider();
        const normalizedAction = String(action || "");

        if (!provider || !PROVIDER_REPAIR_ACTIONS.has(normalizedAction)) {
            return setProviderRepairResult(
                provider || null,
                normalizedAction || "unknown",
                false,
                { reason: "unsupported-action" }
            );
        }

        recordProviderFlightEvent("requested", {
            category: "repair",
            provider,
            detail: { action: normalizedAction }
        });

        try {
            let detail = {};

            if (normalizedAction === "restore-managed-marker") {
                startManagedMarkerGuard();
                const restored = document.documentElement
                    ?.getAttribute("data-stream-shell") === "true";
                detail = { markerPresent: restored };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    restored,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "clear-pending-resume") {
                const cleared = await cancelPendingProviderResume(
                    provider,
                    "diagnostics-repair"
                );
                detail = { cleared };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    cleared,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "netflix-bridge-probe") {
                if (provider !== "netflix") {
                    return setProviderRepairResult(
                        provider,
                        normalizedAction,
                        false,
                        { reason: "not-netflix" }
                    );
                }

                const bridgeReady = await probeNetflixPlayerBridge();
                detail = {
                    bridgeReady,
                    lastError: netflixPlayerBridgeLastError || null
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    bridgeReady,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "resync-adapter") {
                const adapter = rebuildProviderAdapterForRepair(provider);
                const ok = Boolean(adapter);
                detail = {
                    adapterKind: adapter?.adapterKind || null,
                    apiVersion: adapter?.apiVersion || null
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "resync-content-state") {
                const adapter = getProviderAdapter(provider);
                const ok = await applyProviderRepairState(provider, adapter);
                detail = { adapterKind: adapter?.adapterKind || null };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "reinitialize-runtime") {
                await initializeContinueWatchingCompletePercent();
                await hydratePlaybackRepairSettings(provider);
                await hydrateProviderFeatureRepairSettings(provider);
                const adapter = rebuildProviderAdapterForRepair(provider);
                const ok = Boolean(adapter) &&
                    await applyProviderRepairState(provider, adapter);
                detail = {
                    adapterKind: adapter?.adapterKind || null,
                    settingsRehydrated: true
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }
        } catch (error) {
            return setProviderRepairResult(
                provider,
                normalizedAction,
                false,
                { reason: String(error?.message || error || "repair-failed") }
            );
        }

        return setProviderRepairResult(
            provider,
            normalizedAction,
            false,
            { reason: "unhandled-action" }
        );
    }

    function getProviderRepairDiagnosticState(provider, context = {}) {
        const recommendations = [];
        const seen = new Set();
        const addRecommendation = (action, reason, severity = "warn") => {
            if (seen.has(action)) return;
            seen.add(action);
            recommendations.push({ action, reason, severity });
        };

        const managed = context.managed === true;
        const pendingResume = context.pendingResume || null;
        const currentIdentity = context.currentIdentity || null;
        const selfTest = context.selfTest || null;
        const extensionState = context.extensionState || {};
        const watchContext = selfTest?.watchContext === true;
        const pendingAgeMs = pendingResume?.requestedAt
            ? Math.max(0, Date.now() - Number(pendingResume.requestedAt))
            : null;
        const identityMismatch = Boolean(
            pendingResume?.identity &&
            currentIdentity &&
            pendingResume.identity !== currentIdentity
        );

        if (!managed) {
            addRecommendation(
                "restore-managed-marker",
                "Stream Shell managed marker is missing.",
                "error"
            );
        }

        if (pendingResume && (identityMismatch || pendingAgeMs > 60000)) {
            addRecommendation(
                "clear-pending-resume",
                identityMismatch
                    ? "Pending resume belongs to a different media identity."
                    : "Pending resume has remained unresolved for over 60 seconds.",
                "warn"
            );
        }

        const failures = Array.isArray(selfTest?.failures)
            ? selfTest.failures
            : [];
        if (failures.some(failure =>
            failure === "adapter-missing" ||
            failure === "api-version-mismatch" ||
            /adapter-not-registered$/.test(String(failure)) ||
            String(failure).startsWith("contract-missing:")
        )) {
            addRecommendation(
                "resync-adapter",
                "Provider API adapter contract is not healthy.",
                "error"
            );
        }

        let markerStateMismatch = false;
        const safeMode = isProviderSafeModeEnabled(provider);
        if (!safeMode && provider === "youtube") {
            markerStateMismatch = Boolean(
                extensionState?.theme?.enabled &&
                !extensionState?.theme?.marker
            );
        } else if (!safeMode && provider === "prime") {
            markerStateMismatch = [
                extensionState?.uiFix,
                extensionState?.hideXray,
                extensionState?.hideOverlay
            ].some(state => state?.enabled === true && state?.marker !== true);
        } else if (!safeMode && provider === "crunchyroll") {
            markerStateMismatch = Boolean(
                extensionState?.spoilerProtection?.enabled &&
                !extensionState?.spoilerProtection?.marker
            );
        }

        if (markerStateMismatch) {
            addRecommendation(
                "resync-content-state",
                "Enabled provider feature state and DOM markers are out of sync.",
                "warn"
            );
        }

        if (provider === "netflix") {
            const bridge = extensionState?.playerBridge || {};
            if (
                bridge.lastError ||
                (watchContext && bridge.ready !== true)
            ) {
                addRecommendation(
                    "netflix-bridge-probe",
                    bridge.lastError
                        ? `Netflix player bridge reported ${bridge.lastError}.`
                        : "Netflix player bridge is not ready in watch context.",
                    "error"
                );
            }
        }

        if (selfTest?.ok === false && recommendations.length === 0) {
            addRecommendation(
                "reinitialize-runtime",
                "Provider self-test reports a fault without a narrower repair target.",
                "warn"
            );
        }

        const availableActions = [
            "resync-content-state",
            "reinitialize-runtime"
        ];
        if (!managed) availableActions.unshift("restore-managed-marker");
        if (pendingResume) availableActions.push("clear-pending-resume");
        if (provider === "netflix") availableActions.push("netflix-bridge-probe");
        if (failures.length) availableActions.push("resync-adapter");

        return {
            healthy: recommendations.length === 0,
            recommendations,
            availableActions: [...new Set(availableActions)],
            lastResult: providerRepairLastResult?.provider === provider
                ? providerRepairLastResult
                : null
        };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type !== "stream-shell-provider-repair") return;

        executeProviderRepair(message.action)
            .then(sendResponse)
            .catch(error => sendResponse({
                ok: false,
                provider: getCurrentProvider(),
                action: String(message.action || ""),
                detail: {
                    reason: String(error?.message || error || "repair-failed")
                },
                at: Date.now()
            }));

        return true;
    });

    /*
     * ============================================================
     * PROVIDER DIAGNOSTICS
     * ============================================================
     * Privacy-conscious health snapshot used by Dashboard.
     * Titles, URLs and account data are intentionally omitted.
     */
    function readRootFlag(name) {
        const root = document.documentElement;
        if (!root?.hasAttribute(name)) return null;
        return root.getAttribute(name) || "true";
    }

    async function getProviderDiagnosticSnapshot() {
        const provider = getCurrentProvider();
        const videos = [...document.querySelectorAll("video")];
        const video = getPrimaryVideo() || videos[0] || null;
        const currentTime = video && Number.isFinite(video.currentTime) ? video.currentTime : null;
        const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
        const adapter = getProviderAdapter(provider);
        const capabilities = adapter?.getCapabilities?.() || { common: {}, extensions: {} };
        const extensionState = adapter?.getExtensionState?.() || null;
        const selfTest = getProviderApiSelfTest(provider);
        const resumeKey = provider
            ? `streamShellPendingResume_${provider}`
            : null;
        const resumeStored = resumeKey
            ? await chrome.storage.local.get(resumeKey)
            : {};
        const pendingResume = resumeKey ? resumeStored[resumeKey] : null;
        const currentIdentity = adapter?.getIdentity?.() || null;
        const managed = document.documentElement
            ?.getAttribute("data-stream-shell") === "true";
        const repair = getProviderRepairDiagnosticState(provider, {
            managed,
            pendingResume,
            currentIdentity,
            selfTest,
            extensionState
        });

        return {
            ok: true,
            provider,
            managed,
            visibility: document.visibilityState,
            readyState: document.readyState,
            api: {
                version: adapter?.apiVersion || null,
                adapterLoaded: Boolean(adapter),
                adapterKind: adapter?.adapterKind || null,
                identityAvailable: Boolean(currentIdentity),
                watchContext: adapter?.isWatchContext?.() === true,
                resume: {
                    strategy: adapter?.resumeStrategy || "pending-seek",
                    pending: Boolean(pendingResume),
                    targetTime: Number.isFinite(Number(pendingResume?.currentTime))
                        ? Number(pendingResume.currentTime)
                        : null,
                    ageMs: pendingResume?.requestedAt
                        ? Math.max(0, Date.now() - Number(pendingResume.requestedAt))
                        : null,
                    identityMatches: pendingResume?.identity && currentIdentity
                        ? pendingResume.identity === currentIdentity
                        : null
                },
                capabilities,
                extensionState,
                safeMode: getProviderSafeModeState(provider),
                resourceGovernor: getProviderResourceGovernorState(),
                youtubeRuntime: provider === "youtube"
                    ? getYouTubeRuntimeDiagnosticState()
                    : null,
                selfTest,
                repair
            },
            counts: {
                video: videos.length,
                iframe: document.querySelectorAll("iframe").length,
                canvas: document.querySelectorAll("canvas").length,
                buttons: document.querySelectorAll("button, [role='button']").length
            },
            video: video ? {
                readyState: video.readyState,
                networkState: video.networkState,
                paused: video.paused,
                ended: video.ended,
                currentTime,
                duration,
                progressPercent: currentTime !== null && duration
                    ? Math.max(0, Math.min(100, currentTime / duration * 100))
                    : null,
                playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : null,
                width: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
                height: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
                muted: video.muted === true,
                volume: Number.isFinite(video.volume) ? video.volume : null
            } : null,
            features: {
                windowed: readRootFlag("data-stream-shell-windowed-player"),
                subtitleOverride: readRootFlag("data-stream-shell-subtitle-override"),
                youtubeExtras: provider === "youtube"
                    ? (extensionState?.extras?.active ? "true" : null)
                    : null,
                youtubeTheme: provider === "youtube"
                    ? (extensionState?.theme?.marker ? "true" : null)
                    : null,
                youtubeUploadDate: provider === "youtube"
                    ? extensionState?.uploadDate?.present === true
                    : false,
                rydTooltipPresent: provider === "youtube"
                    ? extensionState?.ryd?.tooltipPresent === true
                    : false,
                rydTooltipText: provider === "youtube" && Number.isFinite(extensionState?.ryd?.ratio)
                    ? `${extensionState.ryd.ratio}% like ratio`
                    : null,
                rydBarWidth: provider === "youtube"
                    ? extensionState?.ryd?.barWidth || null
                    : null,
                netflixWallpaper: provider === "netflix"
                    ? (extensionState?.wallpaper?.marker ? "true" : null)
                    : null,
                primeUiFix: provider === "prime"
                    ? (extensionState?.uiFix?.marker ? "true" : null)
                    : null,
                primeHideXray: provider === "prime"
                    ? (extensionState?.hideXray?.marker ? "true" : null)
                    : null,
                primeHideOverlay: provider === "prime"
                    ? (extensionState?.hideOverlay?.marker ? "true" : null)
                    : null,
                crunchyrollSubtitleCanvas: Boolean(document.querySelector("#velocity-canvas, canvas"))
            }
        };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type !== "stream-shell-provider-diagnostics") return;

        getProviderDiagnosticSnapshot()
            .then(sendResponse)
            .catch(error => {
                sendResponse({
                    ok: false,
                    error: String(error?.message || error || "Unknown error")
                });
            });

        return true;
    });
    async function startWindowedPlayer() {
        const provider =
            getCurrentProvider();


        if (
            !provider ||
            !WINDOWED_PLAYER_PROVIDERS.has(
                provider
            )
        ) {
            return;
        }


        const storageKey =
            getWindowedPlayerStorageKey(
                provider
            );


        const scopedStorageKey =
            displayScopedStorageKey(
                storageKey
            );


        const adapter =
            getProviderAdapter(
                provider
            );


        const windowedExtension =
            adapter?.extensions
                ?.windowedPlayer ||
            null;


        let enabled =
            false;


        try {
            const storageKeys = [
                storageKey,
                scopedStorageKey,
                ...(
                    Array.isArray(
                        windowedExtension?.storageKeys
                    )
                        ? windowedExtension.storageKeys
                        : []
                )
            ];


            const stored =
                await chrome.storage.local.get(
                    storageKeys
                );


            enabled =
                readDisplayScopedSetting(
                    stored,
                    storageKey,
                    false
                ) === true;


            windowedExtension
                ?.hydrate
                ?.(stored);

        } catch {
        }


        const sync =
            () => {
                syncWindowedPlayerMode(
                    provider,
                    enabled
                );
            };


        sync();


        chrome.storage.onChanged.addListener(
            (
                changes,
                areaName
            ) => {
                if (
                    areaName !==
                        "local"
                ) {
                    return;
                }


                let changed =
                    false;


                if (
                    Object.prototype.hasOwnProperty.call(
                        changes,
                        scopedStorageKey
                    )
                ) {
                    if (changes[scopedStorageKey]?.newValue === undefined) {
                        chrome.storage.local.get(storageKey)
                            .then(stored => {
                                enabled = stored[storageKey] === true;
                                sync();
                            })
                            .catch(() => {});
                    } else {
                        enabled = changes[scopedStorageKey]?.newValue === true;
                    }


                    changed =
                        true;
                } else if (
                    Object.prototype.hasOwnProperty.call(
                        changes,
                        storageKey
                    )
                ) {
                    chrome.storage.local.get(scopedStorageKey)
                        .then(stored => {
                            if (!Object.prototype.hasOwnProperty.call(stored, scopedStorageKey)) {
                                enabled = changes[storageKey]?.newValue === true;
                                sync();
                            }
                        })
                        .catch(() => {});
                }


                if (
                    windowedExtension
                        ?.handleStorageChanges
                        ?.(changes) ===
                    true
                ) {
                    changed =
                        true;
                }


                if (
                    changed
                ) {
                    sync();
                }
            }
        );


        window.addEventListener(
            "popstate",
            sync
        );


        if (
            typeof windowedExtension
                ?.start ===
                "function"
        ) {
            windowedExtension.start(
                sync
            );
            return;
        }


        if (
            provider ===
                "crunchyroll"
        ) {
            startCrunchyrollWindowedNavigationWatch(
                sync
            );
        }
    }


    /*
     * ============================================================
     * START
     * ============================================================
     */

    async function start() {
        await waitForDocumentElement();


        const managed =
            await waitUntilManaged();


        if (
            !managed
        ) {
            return;
        }


        /*
         * 0.9.29: the in-page floating navbar is retired. Navigation now
         * lives in the native left titlebar toolbar. Keep only the managed
         * marker here because the provider themes are intentionally scoped
         * to Stream Shell windows.
         */
        await initializeManagedLayoutProfile();


        startManagedMarkerGuard();


        await initializeProviderSafeMode();


        await initializeContinueWatchingCompletePercent();


        startProviderApi();


        startProviderResourceGovernor();


        startWindowedPlayer();


        startPlaybackUtilities();


        startNetflixEnhancements();


        startCrunchyrollEnhancements();


        startPrimeEnhancements();


        startYouTubeUtilities();


        startNowPlayingTracking();
    }


    start();
})();