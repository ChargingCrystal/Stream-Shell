    async function startWindowedPlayer() {
        const provider =
            getCurrentProvider();


        if (
            !provider ||
            !WINDOWED_PLAYER_PROVIDERS.has(
                provider
            )
        ) {
            return;
        }


        const storageKey =
            getWindowedPlayerStorageKey(
                provider
            );


        const scopedStorageKey =
            displayScopedStorageKey(
                storageKey
            );


        const adapter =
            getProviderAdapter(
                provider
            );


        const windowedExtension =
            adapter?.extensions
                ?.windowedPlayer ||
            null;


        let enabled =
            false;


        try {
            const storageKeys = [
                storageKey,
                scopedStorageKey,
                ...(
                    Array.isArray(
                        windowedExtension?.storageKeys
                    )
                        ? windowedExtension.storageKeys
                        : []
                )
            ];


            const stored =
                await chrome.storage.local.get(
                    storageKeys
                );


            enabled =
                readDisplayScopedSetting(
                    stored,
                    storageKey,
                    false
                ) === true;


            windowedExtension
                ?.hydrate
                ?.(stored);

        } catch {
        }


        const sync =
            () => {
                syncWindowedPlayerMode(
                    provider,
                    enabled
                );
            };


        sync();


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


                let changed =
                    false;


                if (
                    Object.prototype.hasOwnProperty.call(
                        changes,
                        scopedStorageKey
                    )
                ) {
                    if (changes[scopedStorageKey]?.newValue === undefined) {
                        chrome.storage.local.get(storageKey)
                            .then(stored => {
                                enabled = stored[storageKey] === true;
                                sync();
                            })
                            .catch(() => {});
                    } else {
                        enabled = changes[scopedStorageKey]?.newValue === true;
                    }


                    changed =
                        true;
                } else if (
                    Object.prototype.hasOwnProperty.call(
                        changes,
                        storageKey
                    )
                ) {
                    chrome.storage.local.get(scopedStorageKey)
                        .then(stored => {
                            if (!Object.prototype.hasOwnProperty.call(stored, scopedStorageKey)) {
                                enabled = changes[storageKey]?.newValue === true;
                                sync();
                            }
                        })
                        .catch(() => {});
                }


                if (
                    windowedExtension
                        ?.handleStorageChanges
                        ?.(changes) ===
                    true
                ) {
                    changed =
                        true;
                }


                if (
                    changed
                ) {
                    sync();
                }
            }
        );


        window.addEventListener(
            "popstate",
            sync
        );


        if (
            typeof windowedExtension
                ?.start ===
                "function"
        ) {
            windowedExtension.start(
                sync
            );
            return;
        }


        if (
            provider ===
                "crunchyroll"
        ) {
            startCrunchyrollWindowedNavigationWatch(
                sync
            );
        }
    }


