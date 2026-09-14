    function syncWindowedPlayerMode(
        provider,
        enabled
    ) {
        const effectiveEnabled = Boolean(enabled) &&
            !isProviderSafeModeEnabled(provider);

        const adapter =
            getProviderAdapter(
                provider
            );


        const adapterSync =
            adapter?.extensions
                ?.windowedPlayer
                ?.sync;


        if (
            typeof adapterSync ===
                "function"
        ) {
            return adapterSync(
                effectiveEnabled
            );
        }


        const active =
            effectiveEnabled &&
            isWindowedPlayerWatchContext(
                provider
            );


        setWindowedPlayerRootMarker(
            provider,
            active
        );


        return active;
    }


