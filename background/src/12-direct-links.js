const DIRECT_LINK_STORAGE_KEY =
    "streamShellDirectLinks";


function normalizeDirectLinkUrl(
    value
) {
    try {
        const url =
            new URL(
                String(
                    value ||
                    ""
                ).trim()
            );

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return url.href;

    } catch {
        return "";
    }
}


async function saveDirectLinkFromBrowser(
    rawUrl,
    rawTitle
) {
    const url =
        normalizeDirectLinkUrl(
            rawUrl
        );


    if (
        !url
    ) {
        return false;
    }


    let host =
        "";


    try {
        host =
            new URL(
                url
            ).hostname.replace(
                /^www\./i,
                ""
            );
    } catch {
    }


    const title =
        String(
            rawTitle ||
            host ||
            url
        ).trim() ||
        url;


    const stored =
        await chrome.storage.local.get(
            DIRECT_LINK_STORAGE_KEY
        );


    const existing =
        Array.isArray(
            stored[
                DIRECT_LINK_STORAGE_KEY
            ]
        )
            ? stored[
                DIRECT_LINK_STORAGE_KEY
            ]
            : [];


    const next = [
        {
            url,
            title,
            host,
            savedAt:
                Date.now()
        },

        ...existing.filter(
            item =>
                normalizeDirectLinkUrl(
                    item?.url
                ) !==
                url
        )
    ];


    await chrome.storage.local.set({
        [DIRECT_LINK_STORAGE_KEY]:
            next
    });


    return true;
}


function removeLegacyDirectLinkContextMenu() {
    if (
        !chrome.contextMenus
    ) {
        return;
    }


    chrome.contextMenus.remove(
        "stream-shell-save-direct-link",
        () => {
            void chrome.runtime.lastError;
        }
    );
}


removeLegacyDirectLinkContextMenu();


async function openDirectLinkInBrowser(
    rawUrl
) {
    const url =
        normalizeDirectLinkUrl(
            rawUrl
        );


    if (
        !url
    ) {
        throw new Error(
            "Invalid direct link."
        );
    }


    const normalWindows =
        await chrome.windows.getAll({
            populate:
                false,

            windowTypes: [
                "normal"
            ]
        });


    const target =
        normalWindows.find(
            window =>
                window.focused
        ) ||
        normalWindows[0] ||
        null;


    if (
        target?.id
    ) {
        await chrome.tabs.create({
            windowId:
                target.id,

            url,

            active:
                true
        });


        await chrome.windows.update(
            target.id,
            {
                focused:
                    true
            }
        );


        return;
    }


    await chrome.windows.create({
        type:
            "normal",

        url,

        focused:
            true
    });
}
