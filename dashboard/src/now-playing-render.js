function renderNowPlaying() {
    const provider =
        PROVIDERS.has(
            currentLeftMode
        )
            ? currentLeftMode
            : null;


    const media =
        provider
            ? nowPlayingByProvider[
                provider
            ]
            : null;


    renderProviderPlaybackIndicators();


    if (
        !media?.title
    ) {
        setContextualControlVisible(
            nowPlayingSlot,
            nowPlayingPanel,
            false
        );


        nowPlayingPanel.classList.add(
            "empty"
        );


        nowPlayingPanel.removeAttribute(
            "data-provider"
        );


        nowPlayingPanel.dataset.playbackState =
            "unknown";


        nowPlayingPanel.setAttribute(
            "aria-disabled",
            "true"
        );


        nowPlayingPanel.tabIndex =
            -1;


        nowPlayingPanel.title =
            "No active player";


        nowPlayingTitle.textContent =
            "Nothing playing";


        nowPlayingState.textContent =
            "—";


        if (
            nowPlayingRating
        ) {
            nowPlayingRating.hidden =
                true;
            nowPlayingRating.textContent =
                "";
            delete nowPlayingRating.dataset.identity;
            delete nowPlayingRating.dataset.ratingKind;
            nowPlayingPanel.classList.remove(
                "has-rating"
            );
        }


        nowPlayingProgress.style.width =
            "0%";


        nowPlayingTime.textContent =
            "--:-- / --:--";


        setNowPlayingArtwork(
            ""
        );


        refreshNowPlayingMarquee();

        return;
    }


    const playbackState =
        String(
            media.playbackState ||
            "unknown"
        );


    const currentTime =
        getLiveNowPlayingCurrentTime(
            media
        );


    const duration =
        Number(
            media.duration
        );


    const hasCurrentTime =
        Number.isFinite(
            currentTime
        ) &&
        currentTime >= 0;


    const hasDuration =
        Number.isFinite(
            duration
        ) &&
        duration > 0;


    const progress =
        (
            hasCurrentTime &&
            hasDuration
        )
            ? Math.max(
                0,
                Math.min(
                    100,
                    currentTime /
                    duration *
                    100
                )
            )
            : 0;


    const sessionAge =
        formatSessionAge(
            media.sessionStartedAt
        );


    setContextualControlVisible(
        nowPlayingSlot,
        nowPlayingPanel,
        true
    );


    nowPlayingPanel.classList.remove(
        "empty"
    );


    nowPlayingPanel.dataset.provider =
        provider;


    if (
        nowPlayingSettingsButton
    ) {
        const providerName =
            PROVIDER_NAMES[provider] ||
            provider;


        nowPlayingSettingsButton.title =
            `${providerName} settings`;


        nowPlayingSettingsButton.setAttribute(
            "aria-label",
            `Open ${providerName} settings`
        );
    }


    nowPlayingPanel.dataset.playbackState =
        playbackState;


    nowPlayingPanel.setAttribute(
        "aria-disabled",
        "false"
    );


    nowPlayingPanel.tabIndex =
        0;


    nowPlayingPanel.title =
        `Return to ${PROVIDER_NAMES[
            provider
        ] || provider}`;


    const displayTitle =
        provider ===
            "netflix"
            ? normalizeNowPlayingArtworkQuery(
                media.title
            ) ||
                String(
                    media.title
                ).trim()
            : String(
                media.title
            ).trim();


    nowPlayingTitle.textContent =
        displayTitle;


    nowPlayingState.textContent =
        [
            getPlaybackLabel(
                playbackState
            ),
            sessionAge
        ]
            .filter(Boolean)
            .join(
                " · "
            );


    nowPlayingProgress.style.width =
        `${progress}%`;


    nowPlayingTime.textContent =
        `${formatPlaybackTime(
            hasCurrentTime
                ? currentTime
                : null
        )} / ${formatPlaybackTime(
            hasDuration
                ? duration
                : null
        )}`;


    applyNowPlayingArtwork(
        provider,
        provider ===
            "netflix"
            ? {
                ...media,
                title:
                    displayTitle
            }
            : media
    );


    applyNowPlayingRating(
        provider,
        provider ===
            "netflix"
            ? {
                ...media,
                title:
                    displayTitle
            }
            : media
    ).catch(
        () => {}
    );


    refreshNowPlayingMarquee();
}

async function loadNowPlaying() {
    const keys =
        Object.values(
            NOW_PLAYING_KEYS
        );


    const stored =
        await chrome.storage.local.get(
            keys
        );


    nowPlayingByProvider =
        {};


    for (
        const [provider, key]
        of Object.entries(
            NOW_PLAYING_KEYS
        )
    ) {
        if (
            stored[key]?.title
        ) {
            nowPlayingByProvider[provider] =
                stored[key];
        }
    }


    renderNowPlaying();
}


syncNowPlayingWidth();


if (
    typeof ResizeObserver ===
    "function"
) {
    new ResizeObserver(
        () => {
            syncNowPlayingWidth();
            refreshNowPlayingMarquee();
        }
    ).observe(
        statusGroup
    );
}


window.addEventListener(
    "resize",
    () => {
        syncNowPlayingWidth();
        refreshNowPlayingMarquee();
    }
);


loadNowPlaying()
    .catch(
        () => {}
    );


let nowPlayingProgressTimer = null;

function scheduleNowPlayingProgressRefresh(
    immediate = false
) {
    if (nowPlayingProgressTimer) {
        clearTimeout(nowPlayingProgressTimer);
    }

    const hidden =
        document.visibilityState ===
            "hidden";

    nowPlayingProgressTimer = setTimeout(
        () => {
            nowPlayingProgressTimer = null;

            if (
                document.visibilityState !==
                    "hidden"
            ) {
                refreshNowPlayingProgress();
            }

            scheduleNowPlayingProgressRefresh();
        },
        immediate
            ? 0
            : (hidden ? 5000 : 1000)
    );
}

scheduleNowPlayingProgressRefresh();

document.addEventListener(
    "visibilitychange",
    () => {
        scheduleNowPlayingProgressRefresh(
            document.visibilityState !==
                "hidden"
        );
    }
);


