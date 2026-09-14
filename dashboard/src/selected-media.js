/*
 * ============================================================
 * SELECTED MEDIA
 * ============================================================
 */

async function loadSelectedMedia() {
    const stored =
        await chrome.storage.local.get([
            SELECTED_MEDIA_KEY,
            SELECTED_AVAILABILITY_KEY
        ]);


    selectedMedia =
        stored[
            SELECTED_MEDIA_KEY
        ] ||
        null;


    selectedAvailability =
        stored[
            SELECTED_AVAILABILITY_KEY
        ] ||
        null;


    renderAvailabilityIndicators();
}


ensureAvailabilityIndicators();


loadSelectedMedia()
    .catch(
        () => {}
    );


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


        for (
            const [provider, key]
            of Object.entries(
                NOW_PLAYING_KEYS
            )
        ) {
            if (
                !changes[key]
            ) {
                continue;
            }


            const value =
                changes[key]
                    .newValue;


            if (
                value?.title
            ) {
                nowPlayingByProvider[provider] =
                    value;

            } else {

                delete nowPlayingByProvider[provider];
            }


            renderNowPlaying();
        }


        let changed =
            false;


        if (
            changes[
                SELECTED_MEDIA_KEY
            ]
        ) {
            selectedMedia =
                changes[
                    SELECTED_MEDIA_KEY
                ].newValue ||
                null;


            changed =
                true;
        }


        if (
            changes[
                SELECTED_AVAILABILITY_KEY
            ]
        ) {
            selectedAvailability =
                changes[
                    SELECTED_AVAILABILITY_KEY
                ].newValue ||
                null;


            changed =
                true;
        }


        if (
            changed
        ) {
            renderAvailabilityIndicators();
        }
    }
);


