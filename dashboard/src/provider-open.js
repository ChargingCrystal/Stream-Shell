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


        if (provider === "mangayomi" && response?.ok === false) {
            window.alert(response.error || "Mangayomi is unavailable. Install its optional native helper and check the executable path in General → Providers.");
            return;
        }
        if (
            !response?.ok ||
            !selectedMedia ||
            !STREAM_SHELL_BUILTIN_IDS.has(provider)
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


