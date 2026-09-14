/*
 * ============================================================
 * PROVIDER SEARCH
 * ============================================================
 */

function buildProviderSearchUrl(
    provider,
    media
) {
    const title =
        encodeURIComponent(
            String(
                media?.title ||
                ""
            ).trim()
        );


    if (
        !title
    ) {
        return null;
    }


    switch (
        provider
    ) {
        case "youtube":

            return `https://www.youtube.com/results?search_query=${title}`;


        case "netflix":

            return `https://www.netflix.com/search?q=${title}`;


        case "prime":

            return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`;


        case "disney":

            return "https://www.disneyplus.com/search";


        case "crunchyroll":

            return `https://www.crunchyroll.com/search?q=${title}`;


        default:

            return null;
    }
}


async function navigateProviderToSelectedMedia(
    provider
) {
    if (
        !selectedMedia
    ) {
        return false;
    }


    const url =
        buildProviderSearchUrl(
            provider,
            selectedMedia
        );


    if (
        !url
    ) {
        return false;
    }


    const stored =
        await chrome.storage.local.get(
            "providerWindows"
        );


    const windowId =
        stored
            .providerWindows?.[
                provider
            ];


    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return false;
    }


    const tabs =
        await chrome.tabs.query({
            windowId
        });


    const tab =
        tabs.find(
            item =>
                Number.isInteger(
                    item.id
                )
        );


    if (
        !tab?.id
    ) {
        return false;
    }


    await chrome.tabs.update(
        tab.id,
        {
            url
        }
    );


    return true;
}


