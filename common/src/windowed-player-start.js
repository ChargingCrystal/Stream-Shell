    async function startWindowedPlayer() {
        if (!WINDOWED_PLAYER_PROVIDERS.has(getCurrentProvider())) return;
        return startProviderFeatureOnce(`windowed-player:${getCurrentProvider()}`, async () => {
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


        let enabled = false;
        // Keep the current display override and its legacy fallback in memory.
        // Reading storage again inside onChanged can finish out of order and
        // overwrite a newer setting after rapid toggles/imports.
        let baseEnabled = false;
        let scopedEnabled;

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


            baseEnabled = stored[storageKey] === true;
            scopedEnabled = Object.prototype.hasOwnProperty.call(
                stored, scopedStorageKey
            ) ? stored[scopedStorageKey] === true : undefined;
            enabled = readDisplayScopedSetting(stored, storageKey, false) === true;

            windowedExtension
                ?.hydrate
                ?.(stored);

        } catch {
        }


        const sync = () => {
            enabled = scopedEnabled === undefined ? baseEnabled : scopedEnabled;
            syncWindowedPlayerMode(provider, enabled);
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


                // Apply storage change batches atomically. The scoped value
                // always wins while present, even if the legacy key changes
                // in the same batch. Removing it immediately reveals the
                // latest legacy fallback without an asynchronous read.
                const scopedChanged = Object.prototype.hasOwnProperty.call(
                    changes, scopedStorageKey
                );
                const baseChanged = Object.prototype.hasOwnProperty.call(
                    changes, storageKey
                );

                if (scopedChanged) {
                    const value = changes[scopedStorageKey]?.newValue;
                    scopedEnabled = value === undefined ? undefined : value === true;
                }
                if (baseChanged) {
                    baseEnabled = changes[storageKey]?.newValue === true;
                }
                changed = scopedChanged || (baseChanged && scopedEnabled === undefined);

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
        });
    }


