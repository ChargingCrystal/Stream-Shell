(() => {
    "use strict";


    const STORAGE_KEY =
        "streamShellWatchlist";


    function getKey(
        media
    ) {
        return `${media.mediaType}:${media.id}`;
    }


    function normalizeItem(
        media,
        addedAt = Date.now()
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

            addedAt:
                Number(
                    addedAt
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


    function sanitizeItems(
        rawItems
    ) {
        const items =
            Array.isArray(
                rawItems
            )
                ? rawItems
                : [];


        const result =
            [];


        const seen =
            new Set();


        for (
            const item
            of items
        ) {
            if (
                !isValidItem(
                    item
                )
            ) {
                continue;
            }


            const normalized =
                normalizeItem(
                    item,
                    item.addedAt
                );


            const key =
                getKey(
                    normalized
                );


            if (
                seen.has(
                    key
                )
            ) {
                continue;
            }


            seen.add(
                key
            );


            result.push(
                normalized
            );
        }


        return result;
    }


    async function getAll() {
        const stored =
            await chrome.storage.local.get(
                STORAGE_KEY
            );


        return sanitizeItems(
            stored[
                STORAGE_KEY
            ]
        )
            .sort(
                (
                    left,
                    right
                ) =>
                    right.addedAt -
                    left.addedAt
            );
    }


    async function saveAll(
        items
    ) {
        const sanitized =
            sanitizeItems(
                items
            );


        await chrome.storage.local.set({
            [STORAGE_KEY]:
                sanitized
        });


        return sanitized;
    }


    async function contains(
        media
    ) {
        const items =
            await getAll();


        const key =
            getKey(
                media
            );


        return items.some(
            item =>
                getKey(
                    item
                ) ===
                key
        );
    }


    async function add(
        media
    ) {
        const items =
            await getAll();


        const key =
            getKey(
                media
            );


        if (
            items.some(
                item =>
                    getKey(
                        item
                    ) ===
                    key
            )
        ) {
            return items;
        }


        items.unshift(
            normalizeItem(
                media
            )
        );


        return saveAll(
            items
        );
    }


    async function remove(
        media
    ) {
        const items =
            await getAll();


        const key =
            getKey(
                media
            );


        return saveAll(
            items.filter(
                item =>
                    getKey(
                        item
                    ) !==
                    key
            )
        );
    }


    async function toggle(
        media
    ) {
        if (
            await contains(
                media
            )
        ) {
            await remove(
                media
            );


            return false;
        }


        await add(
            media
        );


        return true;
    }


    async function merge(
        importedItems
    ) {
        const current =
            await getAll();


        const currentKeys =
            new Set(
                current.map(
                    getKey
                )
            );


        const result = [
            ...current
        ];


        for (
            const item
            of sanitizeItems(
                importedItems
            )
        ) {
            const key =
                getKey(
                    item
                );


            if (
                currentKeys.has(
                    key
                )
            ) {
                continue;
            }


            currentKeys.add(
                key
            );


            result.push(
                item
            );
        }


        return saveAll(
            result
        );
    }


    window.StreamShellWatchlist = {
        STORAGE_KEY,

        getKey,

        getAll,

        saveAll,

        contains,

        add,

        remove,

        toggle,

        merge
    };


    console.debug(
        "[Stream Shell] Watchlist module loaded."
    );
})();