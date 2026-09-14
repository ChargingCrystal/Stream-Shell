/*
 * ============================================================
 * OPEN PROVIDER + ADD TO RECENT
 * ============================================================
 */

async function openProvider(
    provider
) {
    try {
        const response =
            await chrome.runtime.sendMessage({
                type:
                    "dashboard-switch-provider",

                provider
            });


        if (
            !response?.ok ||
            !selectedMedia
        ) {
            return;
        }


        const opened =
            await navigateProviderToSelectedMedia(
                provider
            );


        if (
            opened
        ) {
            await window
                .StreamShellHistory
                .add(
                    selectedMedia,
                    provider
                );
        }

    } catch (error) {

        console.error(
            "Provider open failed:",
            error
        );
    }
}


