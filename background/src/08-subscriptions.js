function wait(
    milliseconds
) {
    return new Promise(
        resolve => {
            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


async function navigateSubscriptionTab(
    tabId,
    url,
    timeoutMs = 14000
) {
    return new Promise(
        async (
            resolve,
            reject
        ) => {
            let finished =
                false;


            const cleanup =
                () => {
                    chrome.tabs.onUpdated.removeListener(
                        onUpdated
                    );

                    clearTimeout(
                        timeout
                    );
                };


            const finish =
                error => {
                    if (
                        finished
                    ) {
                        return;
                    }


                    finished =
                        true;

                    cleanup();


                    if (
                        error
                    ) {
                        reject(
                            error
                        );
                    } else {
                        resolve();
                    }
                };


            const onUpdated =
                (
                    updatedTabId,
                    changeInfo
                ) => {
                    if (
                        updatedTabId ===
                            tabId &&
                        changeInfo.status ===
                            "complete"
                    ) {
                        finish();
                    }
                };


            const timeout =
                setTimeout(
                    () => {
                        finish(
                            new Error(
                                "Account page timed out."
                            )
                        );
                    },
                    timeoutMs
                );


            chrome.tabs.onUpdated.addListener(
                onUpdated
            );


            try {
                await chrome.tabs.update(
                    tabId,
                    {
                        url,
                        active:
                            true
                    }
                );
            } catch (error) {
                finish(
                    error
                );
            }
        }
    );
}


async function scrapeSubscriptionTab(
    tabId,
    provider
) {
    let lastError =
        null;


    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        if (
            attempt > 0
        ) {
            await wait(
                650
            );
        }


        try {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider
                    }
                );


            if (
                response?.ok &&
                response.result?.pageReady
            ) {
                const result =
                    response.result;


                if (
                    result.status !==
                        "unknown" ||
                    attempt ===
                        4
                ) {
                    return {
                        status:
                            result.status ||
                            "unknown",

                        renewal:
                            result.renewal ||
                            null,

                        dateKind:
                            result.dateKind ||
                            null,

                        billingSource:
                            result.billingSource ||
                            null,

                        checkedAt:
                            Date.now()
                    };
                }


                lastError =
                    new Error(
                        "Account data has not rendered yet."
                    );

                continue;
            }


            lastError =
                new Error(
                    response?.error ||
                    "Account page is not ready."
                );
        } catch (error) {
            lastError =
                error;
        }
    }


    throw (
        lastError ||
        new Error(
            "Subscription scrape failed."
        )
    );
}


async function setSubscriptionSyncWindowInteractive(windowId) {
    try {
        await chrome.windows.update(
            windowId,
            {
                state: "normal",
                focused: true
            }
        );

        await chrome.windows.update(
            windowId,
            {
                left: 480,
                top: 120,
                width: 960,
                height: 780,
                focused: true
            }
        );
    } catch {
    }
}


async function minimizeSubscriptionSyncWindow(windowId) {
    try {
        await chrome.windows.update(
            windowId,
            {
                state: "minimized"
            }
        );
    } catch {
    }
}


async function waitForPrimeVerification(
    windowId,
    tabId,
    initialResult,
    timeoutMs = 120000
) {
    await setSubscriptionSyncWindowInteractive(
        windowId
    );

    const deadline =
        Date.now() + timeoutMs;

    let lastResult =
        initialResult;

    let verificationSeen =
        ["verify", "signin"].includes(
            initialResult?.status
        );

    let returnedToPrimeCentral =
        false;

    const parseAmazonUrl =
        url => {
            try {
                const parsed =
                    new URL(url);

                const isAmazon =
                    parsed.hostname ===
                        "amazon.de" ||
                    parsed.hostname.endsWith(
                        ".amazon.de"
                    );

                const route =
                    `${parsed.pathname} ${parsed.search} ${parsed.hash}`
                        .toLowerCase();

                return {
                    isAmazon,
                    isVerification:
                        isAmazon &&
                        /(?:\/ap\/signin|\/ap\/cvf|signin|auth|verification|verify|cvf)/i.test(
                            route
                        ),
                    isPrimeCentral:
                        isAmazon &&
                        /\/gp\/primecentral/i.test(
                            parsed.pathname
                        )
                };
            } catch {
                return {
                    isAmazon: false,
                    isVerification: false,
                    isPrimeCentral: false
                };
            }
        };

    const scrapePrime =
        async () => {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider:
                            "prime"
                    }
                );

            if (
                !response?.ok ||
                !response.result?.pageReady
            ) {
                return null;
            }

            const result =
                response.result;

            return {
                status:
                    result.status ||
                    "unknown",

                renewal:
                    result.renewal ||
                    null,

                dateKind:
                    result.dateKind ||
                    null,

                billingSource:
                    result.billingSource ||
                    null,

                checkedAt:
                    Date.now()
            };
        };

    try {
        while (
            Date.now() < deadline
        ) {
            await wait(
                900
            );

            let tab =
                null;

            try {
                tab =
                    await chrome.tabs.get(
                        tabId
                    );
            } catch {
            }

            const current =
                parseAmazonUrl(
                    tab?.url || ""
                );

            if (
                current.isVerification
            ) {
                verificationSeen =
                    true;
            }

            try {
                const scraped =
                    await scrapePrime();

                if (
                    scraped
                ) {
                    lastResult =
                        scraped;

                    if (
                        ["verify", "signin"].includes(
                            scraped.status
                        )
                    ) {
                        verificationSeen =
                            true;
                    }

                    if (
                        ![
                            "verify",
                            "signin",
                            "unknown"
                        ].includes(
                            scraped.status
                        )
                    ) {
                        return scraped;
                    }
                }
            } catch {
                /* Amazon may be navigating while verification completes. */
            }

            /*
             * Do NOT keep reloading Prime Central while the user is on the
             * challenge. Once we have actually seen an auth step and Amazon
             * has returned to a normal page, send the original sync tab back
             * to Prime Central exactly once and scrape the membership page.
             */
            if (
                verificationSeen &&
                current.isAmazon &&
                !current.isVerification &&
                !current.isPrimeCentral &&
                !returnedToPrimeCentral
            ) {
                returnedToPrimeCentral =
                    true;

                try {
                    await navigateSubscriptionTab(
                        tabId,
                        PRIME_CENTRAL_URL,
                        18000
                    );

                    await wait(
                        1400
                    );

                    const scraped =
                        await scrapePrime();

                    if (
                        scraped
                    ) {
                        lastResult =
                            scraped;

                        if (
                            ![
                                "verify",
                                "signin",
                                "unknown"
                            ].includes(
                                scraped.status
                            )
                        ) {
                            return scraped;
                        }

                        if (
                            ["verify", "signin"].includes(
                                scraped.status
                            )
                        ) {
                            /* Amazon asked again; keep the window interactive. */
                            returnedToPrimeCentral =
                                false;
                            verificationSeen =
                                true;
                        }
                    }
                } catch {
                    returnedToPrimeCentral =
                        false;
                }
            }
        }

        /*
         * A real auth challenge should remain VERIFY if it was never
         * completed. A merely unrecognised Prime page stays UNKNOWN instead
         * of falsely claiming that the account needs verification.
         */
        if (
            verificationSeen
        ) {
            return {
                status:
                    "verify",

                renewal:
                    null,

                dateKind:
                    null,

                billingSource:
                    null,

                checkedAt:
                    Date.now()
            };
        }

        return {
            status:
                lastResult?.status ||
                "unknown",

            renewal:
                lastResult?.renewal ||
                null,

            dateKind:
                lastResult?.dateKind ||
                null,

            billingSource:
                lastResult?.billingSource ||
                null,

            checkedAt:
                Date.now()
        };
    } finally {
        await minimizeSubscriptionSyncWindow(
            windowId
        );
    }
}


async function scrapeGooglePlaySubscriptionsTab(tabId) {
    let lastError =
        null;

    for (
        let attempt = 0;
        attempt < 6;
        attempt += 1
    ) {
        if (
            attempt > 0
        ) {
            await wait(
                700
            );
        }

        try {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider:
                            "googleplay"
                    }
                );

            if (
                response?.ok &&
                response.result?.pageReady
            ) {
                return response.result;
            }

            lastError =
                new Error(
                    response?.error ||
                    "Google Play subscriptions page is not ready."
                );
        } catch (error) {
            lastError =
                error;
        }
    }

    throw (
        lastError ||
        new Error(
            "Google Play subscription scrape failed."
        )
    );
}


function mergeGooglePlaySubscriptionData(
    items,
    playResult
) {
    const playItems =
        playResult?.items ||
        {};

    const youtube =
        playItems.youtube;

    if (
        youtube
    ) {
        const current =
            items.youtube ||
            {};

        /*
         * Google Play's subscriptions page lists many cards together.
         * Dates extracted from flattened page text can therefore belong to
         * a neighbouring subscription (for example ChatGPT). Use Google Play
         * only to confirm the billing source/status; keep a renewal date only
         * when YouTube itself supplied it.
         */
        items.youtube = {
            ...current,

            status:
                current.status &&
                current.status !== "unknown" &&
                current.status !== "signin"
                    ? current.status
                    : youtube.status ||
                      current.status ||
                      "active",

            renewal:
                current.renewal ||
                null,

            dateKind:
                current.dateKind ||
                null,

            billingSource:
                "Google Play",

            checkedAt:
                Date.now()
        };
    }

    const discord =
        playItems.discord;

    if (
        discord
    ) {
        /*
         * For Discord the Play page is used only as proof that Nitro is billed
         * through Google Play. Do not display a Play-page date because nearby
         * subscriptions (notably Play Pass) can be mistaken for Nitro.
         */
        items.discord = {
            status:
                discord.status ||
                "active",

            renewal:
                null,

            dateKind:
                null,

            billingSource:
                "Google Play",

            checkedAt:
                Date.now()
        };
    }
}


async function createSubscriptionSyncWindow() {
    const profile =
        await getStreamShellDisplayProfile()
            .catch(() => null);

    if (
        profile?.mode ===
            "compact"
    ) {
        /*
         * On the 200%-scaled laptop, Opera can heavily throttle a newly
         * created minimized account window before its content scripts have a
         * chance to answer. Keep the Compact sync renderer alive as a small,
         * unfocused popup behind the full-surface shell. It is removed again
         * in _syncSubscriptions()' finally block and only becomes interactive
         * if Prime explicitly requires verification.
         */
        const width =
            Math.max(
                420,
                Math.min(
                    720,
                    LEFT.width - 80
                )
            );

        const height =
            Math.max(
                360,
                Math.min(
                    620,
                    LEFT.height - 100
                )
            );

        return chrome.windows.create({
            type:
                "popup",

            state:
                "normal",

            focused:
                false,

            left:
                LEFT.left +
                Math.max(
                    20,
                    Math.floor(
                        (LEFT.width - width) / 2
                    )
                ),

            top:
                LEFT.top +
                Math.max(
                    40,
                    Math.floor(
                        (LEFT.height - height) / 2
                    )
                ),

            width,
            height,

            url:
                "about:blank"
        });
    }

    try {
        return await chrome.windows.create({
            type:
                "normal",

            state:
                "minimized",

            focused:
                false,

            url:
                "about:blank"
        });
    } catch {
        const syncWindow =
            await chrome.windows.create({
                type:
                    "normal",

                focused:
                    false,

                url:
                    "about:blank"
            });

        if (
            syncWindow?.id
        ) {
            try {
                await chrome.windows.update(
                    syncWindow.id,
                    {
                        state:
                            "minimized"
                    }
                );
            } catch {
            }
        }

        return syncWindow;
    }
}


async function _syncSubscriptions() {
    let syncWindowId =
        null;


    const items =
        {};


    try {
        const syncWindow =
            await createSubscriptionSyncWindow();


        if (
            !syncWindow?.id
        ) {
            throw new Error(
                "Subscription sync window could not be created."
            );
        }


        syncWindowId =
            syncWindow.id;


        const tabs =
            await chrome.tabs.query({
                windowId:
                    syncWindowId
            });


        const tabId =
            tabs[0]?.id;


        if (
            !Number.isInteger(
                tabId
            )
        ) {
            throw new Error(
                "Subscription sync tab could not be created."
            );
        }


        for (
            const provider
            of SUBSCRIPTION_PROVIDERS
        ) {
            try {
                await navigateSubscriptionTab(
                    tabId,
                    provider.url
                );


                await wait(
                    1100
                );


                let result =
                    await scrapeSubscriptionTab(
                        tabId,
                        provider.id
                    );


                if (
                    provider.id ===
                        "prime" &&
                    [
                        "verify",
                        "signin",
                        "unknown"
                    ].includes(
                        result.status
                    )
                ) {
                    result =
                        await waitForPrimeVerification(
                            syncWindowId,
                            tabId,
                            result
                        );
                }


                items[provider.id] =
                    result;
            } catch (error) {
                console.warn(
                    `Subscription sync failed for ${provider.id}:`,
                    error
                );


                items[provider.id] = {
                    status:
                        "unknown",

                    renewal:
                        null,

                    dateKind:
                        null,

                    billingSource:
                        null,

                    checkedAt:
                        Date.now()
                };
            }
        }


        try {
            await navigateSubscriptionTab(
                tabId,
                GOOGLE_PLAY_SUBSCRIPTIONS_URL,
                18000
            );


            await wait(
                1300
            );


            const playResult =
                await scrapeGooglePlaySubscriptionsTab(
                    tabId
                );


            mergeGooglePlaySubscriptionData(
                items,
                playResult
            );
        } catch (error) {
            console.warn(
                "Google Play subscription sync failed:",
                error
            );
        }


        if (
            !items.discord
        ) {
            items.discord = {
                status:
                    "unknown",

                renewal:
                    null,

                dateKind:
                    null,

                billingSource:
                    null,

                checkedAt:
                    Date.now()
            };
        }
    } finally {
        if (
            Number.isInteger(
                syncWindowId
            )
        ) {
            await safelyRemoveWindow(
                syncWindowId
            );
        }
    }


    const state = {
        items,
        updatedAt:
            Date.now()
    };


    await chrome.storage.local.set({
        [SUBSCRIPTION_STORAGE_KEY]:
            state
    });


    return state;
}


async function syncSubscriptions() {
    if (
        subscriptionSyncLock
    ) {
        return subscriptionSyncLock;
    }


    subscriptionSyncLock =
        _syncSubscriptions()
            .finally(
                () => {
                    subscriptionSyncLock =
                        null;
                }
            );


    return subscriptionSyncLock;
}


