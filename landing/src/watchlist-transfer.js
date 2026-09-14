/*
 * ============================================================
 * WATCHLIST EXPORT / IMPORT
 * ============================================================
 */

function getExportFileName() {
    const date =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    return `stream-shell-watchlist-${date}.json`;
}


async function exportWatchlist() {
    const [
        items,
        directLinks,
        continueWatching
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    const payload = {
        format:
            "stream-shell-watchlist",

        version:
            3,

        exportedAt:
            new Date()
                .toISOString(),

        items,

        directLinks,

        continueWatching
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        url;


    anchor.download =
        getExportFileName();


    anchor.style.display =
        "none";


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();


    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );
}


async function importWatchlistFile(
    file
) {
    const text =
        await file.text();


    const parsed =
        JSON.parse(
            text
        );


    const items =
        Array.isArray(
            parsed
        )
            ? parsed
            : parsed?.items;


    const directLinks =
        Array.isArray(
            parsed?.directLinks
        )
            ? parsed.directLinks
            : [];


    const continueWatching =
        Array.isArray(
            parsed?.continueWatching
        )
            ? parsed.continueWatching
            : [];


    if (
        !Array.isArray(
            items
        ) &&
        directLinks.length ===
            0 &&
        continueWatching.length ===
            0
    ) {
        throw new Error(
            "The selected file does not contain a Stream Shell Watchlist."
        );
    }


    const [
        beforeTitles,
        beforeLinks,
        beforeContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    await Promise.all([
        window
            .StreamShellWatchlist
            .merge(
                Array.isArray(
                    items
                )
                    ? items
                    : []
            ),
        window
            .StreamShellDirectLinks
            .merge(
                directLinks
            ),
        window
            .StreamShellContinueWatching
            .merge(
                continueWatching
            )
    ]);


    const [
        afterTitles,
        afterLinks,
        afterContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    const addedTitles =
        Math.max(
            0,
            afterTitles.length -
            beforeTitles.length
        );


    const addedLinks =
        Math.max(
            0,
            afterLinks.length -
            beforeLinks.length
        );


    const addedContinue =
        Math.max(
            0,
            afterContinue.length -
            beforeContinue.length
        );


    await Promise.all([
        refreshDirectLinkCache(),
        refreshContinueWatchingCache()
    ]);


    await showWatchlist(
        `Imported ${addedTitles} ${
            addedTitles ===
                1
                ? "title"
                : "titles"
        } · ${addedLinks} ${
            addedLinks ===
                1
                ? "direct link"
                : "direct links"
        } · ${addedContinue} continue`
    );
}


