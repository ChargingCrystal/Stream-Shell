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
                stored[storageKey] ===
                true;


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
                        storageKey
                    )
                ) {
                    enabled =
                        changes[storageKey]
                            ?.newValue ===
                        true;


                    changed =
                        true;
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


