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
