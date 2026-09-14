(() => {
    "use strict";

    const STORAGE_KEY =
        "streamShellDirectLinks";

    function normalizeUrl(
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

    function normalizeItem(
        item,
        savedAt = Date.now()
    ) {
        const url =
            normalizeUrl(
                item?.url
            );

        if (
            !url
        ) {
            return null;
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
                item?.title ||
                host ||
                url
            ).trim();

        return {
            url,

            title:
                title ||
                url,

            host,

            savedAt:
                Number(
                    item?.savedAt ??
                    savedAt
                ) ||
                Date.now()
        };
    }

    function sanitizeItems(
        rawItems
    ) {
        const result =
            [];

        const seen =
            new Set();

        for (
            const item
            of Array.isArray(
                rawItems
            )
                ? rawItems
                : []
        ) {
            const normalized =
                normalizeItem(
                    item,
                    item?.savedAt
                );

            if (
                !normalized ||
                seen.has(
                    normalized.url
                )
            ) {
                continue;
            }

            seen.add(
                normalized.url
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
        ).sort(
            (
                left,
                right
            ) =>
                right.savedAt -
                left.savedAt
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

    async function remove(
        url
    ) {
        const normalizedUrl =
            normalizeUrl(
                url
            );

        if (
            !normalizedUrl
        ) {
            return getAll();
        }

        const items =
            await getAll();

        return saveAll(
            items.filter(
                item =>
                    item.url !==
                    normalizedUrl
            )
        );
    }

    async function merge(
        importedItems
    ) {
        const current =
            await getAll();

        const merged = [
            ...sanitizeItems(
                importedItems
            ),
            ...current
        ];

        return saveAll(
            merged
        );
    }

    window.StreamShellDirectLinks = {
        STORAGE_KEY,

        getAll,

        remove,

        merge
    };
})();
