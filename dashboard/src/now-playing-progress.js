function getLiveNowPlayingCurrentTime(
    media
) {
    let currentTime =
        Number(
            media?.currentTime
        );


    if (
        !Number.isFinite(
            currentTime
        ) ||
        currentTime < 0
    ) {
        return null;
    }


    if (
        media?.playbackState ===
            "playing" &&
        Number.isFinite(
            Number(
                media?.updatedAt
            )
        )
    ) {
        currentTime +=
            Math.max(
                0,
                Date.now() -
                    Number(
                        media.updatedAt
                    )
            ) /
            1000;
    }


    const duration =
        Number(
            media?.duration
        );


    if (
        Number.isFinite(
            duration
        ) &&
        duration > 0
    ) {
        currentTime =
            Math.min(
                currentTime,
                duration
            );
    }


    return currentTime;
}


function refreshNowPlayingProgress() {
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


    if (
        !media?.title
    ) {
        return;
    }


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


    nowPlayingState.textContent =
        [
            getPlaybackLabel(
                String(
                    media.playbackState ||
                    "unknown"
                )
            ),
            formatSessionAge(
                media.sessionStartedAt
            )
        ]
            .filter(Boolean)
            .join(
                " · "
            );
}


