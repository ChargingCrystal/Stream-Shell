
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
