/*
 * ============================================================
 * STALE PROVIDER MEDIA LINK RESOLVER
 * ============================================================
 * Continue Watching owns persisted provider URLs. Before a resume
 * navigates, give the dedicated in-page adapter a chance to rebuild
 * the current provider path from the stable media identity. A shared,
 * deterministic resolver is the fallback when a newly-created content
 * script is not ready yet.
 */

async function requestProviderMediaLinkResolution(
    providerName,
    tabId,
    identity,
    fallbackUrl
) {
    if (!Number.isInteger(tabId)) return null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type: "stream-shell-provider-resolve-media-link",
                provider: providerName,
                identity,
                fallbackUrl
            });

            if (response?.ok && response?.result?.url) {
                return {
                    ...response.result,
                    source: "adapter"
                };
            }
        } catch {
        }

        if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }

    return null;
}


function validateResolvedProviderMediaLink(
    providerName,
    result,
    requestedIdentity,
    rawUrl
) {
    if (!result?.url || !isProviderOwnedMediaUrl(providerName, result.url)) {
        return null;
    }

    const url = normalizeProviderResumeUrl(providerName, result.url);
    if (!isProviderOwnedMediaUrl(providerName, url)) return null;

    const resolvedIdentity = getProviderMediaIdentity(providerName, url);
    const expected = getResolvableProviderIdentity(
        providerName,
        requestedIdentity,
        rawUrl
    );

    if (expected?.identity && resolvedIdentity !== expected.identity) {
        return null;
    }

    return {
        provider: providerName,
        identity: resolvedIdentity,
        url,
        strategy: String(result.strategy || "canonical-fallback"),
        reconstructed: result.reconstructed === true,
        source: String(result.source || "shared-fallback")
    };
}


async function resolveSavedProviderMediaLink(
    providerName,
    rawIdentity,
    rawUrl,
    tab
) {
    const identity = String(rawIdentity || "").trim();
    const fallbackUrl = String(rawUrl || "").trim();

    let adapterResult = null;

    if (Number.isInteger(tab?.id)) {
        adapterResult = await requestProviderMediaLinkResolution(
            providerName,
            tab.id,
            identity,
            fallbackUrl
        );
    }

    let resolved = validateResolvedProviderMediaLink(
        providerName,
        adapterResult,
        identity,
        fallbackUrl
    );

    if (!resolved) {
        let preferredOrigin = "";

        try {
            preferredOrigin = new URL(String(tab?.url || "")).origin;
        } catch {
        }

        const fallbackResult = resolveProviderMediaLink(
            providerName,
            identity,
            fallbackUrl,
            preferredOrigin
        );

        resolved = validateResolvedProviderMediaLink(
            providerName,
            fallbackResult
                ? {
                    ...fallbackResult,
                    source: "shared-fallback"
                }
                : null,
            identity,
            fallbackUrl
        );
    }

    if (!resolved) {
        recordFlightEvent({
            source: "background",
            category: "stale-link",
            action: "failed",
            level: "warn",
            provider: providerName,
            detail: {
                reason: "unresolvable-media-identity"
            }
        }).catch(() => {});

        throw new Error("Saved provider link could not be resolved.");
    }

    const normalizedOriginal = isProviderOwnedMediaUrl(
        providerName,
        fallbackUrl
    )
        ? normalizeProviderResumeUrl(providerName, fallbackUrl)
        : "";

    recordFlightEvent({
        source: "background",
        category: "stale-link",
        action: "applied",
        provider: providerName,
        detail: {
            source: resolved.source,
            strategy: resolved.strategy,
            reconstructed: resolved.reconstructed,
            changed: normalizedOriginal !== resolved.url
        }
    }).catch(() => {});

    return resolved;
}
