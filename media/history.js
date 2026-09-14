(() => {
    "use strict";


    const STORAGE_KEY =
        "streamShellRecentMedia";


    const MAX_ITEMS =
        10;


    function getKey(
        media
    ) {
        return `${media.mediaType}:${media.id}`;
    }


    function normalizeItem(
        media,
        provider = "",
        openedAt = Date.now()
    ) {
        return {
            id:
                Number(
                    media.id
                ),

            mediaType:
                media.mediaType,

            title:
                String(
                    media.title ||
                    ""
                ).trim(),

            originalTitle:
                String(
                    media.originalTitle ||
                    ""
                ).trim(),

            releaseDate:
                String(
                    media.releaseDate ||
                    ""
                ).trim(),

            year:
                String(
                    media.year ||
                    ""
                ).trim(),

            provider:
                String(
                    provider ||
                    ""
                ).trim(),

            openedAt:
                Number(
                    openedAt
                ) ||
                Date.now()
        };
    }


    function isValidItem(
        item
    ) {
        return Boolean(
            item &&

            Number.isInteger(
                Number(
                    item.id
                )
            ) &&

            (
                item.mediaType === "movie" ||
                item.mediaType === "tv"
            ) &&

            String(
                item.title ||
                ""
            ).trim()
        );
    }


    async function getAll() {
        const stored =
            await chrome.storage.local.get(
                STORAGE_KEY
            );


        const items =
            Array.isArray(
                stored[
                    STORAGE_KEY
                ]
            )
                ? stored[
                    STORAGE_KEY
                ]
                : [];


        return items
            .filter(
                isValidItem
            )
            .map(
                item =>
                    normalizeItem(
                        item,
                        item.provider,
                        item.openedAt
                    )
            )
            .sort(
                (
                    left,
                    right
                ) =>
                    right.openedAt -
                    left.openedAt
            )
            .slice(
                0,
                MAX_ITEMS
            );
    }


    async function add(
        media,
        provider
    ) {
        const items =
            await getAll();


        const key =
            getKey(
                media
            );


        const next = [
            normalizeItem(
                media,
                provider
            ),

            ...items.filter(
                item =>
                    getKey(
                        item
                    ) !==
                    key
            )
        ]
            .slice(
                0,
                MAX_ITEMS
            );


        await chrome.storage.local.set({
            [STORAGE_KEY]:
                next
        });


        return next;
    }


    async function clear() {
        await chrome.storage.local.remove(
            STORAGE_KEY
        );
    }


    window.StreamShellHistory = {
        STORAGE_KEY,

        MAX_ITEMS,

        getKey,

        getAll,

        add,

        clear
    };


    console.debug(
        "[Stream Shell] History module loaded."
    );
})();