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

