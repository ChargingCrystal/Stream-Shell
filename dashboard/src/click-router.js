/*
 * ============================================================
 * CLICK ROUTER
 * ============================================================
 */

document.addEventListener(
    "click",
    event => {
        if (
            document.body.dataset.layoutProfile === "compact" &&
            event.target.closest?.("#compact-home-runtime-root")
        ) {
            return;
        }

        const insideSettings =
            event.target.closest?.(
                "#settings-center"
            );


        if (
            insideSettings
        ) {
            if (
                handleSettingsClick(
                    event
                )
            ) {
                event.stopImmediatePropagation();
            }


            return;
        }


        if (
            handleSettingsClick(
                event
            )
        ) {
            event.stopImmediatePropagation();
            return;
        }


        event.stopImmediatePropagation();


        const nowPlayingTarget =
            event.target.closest(
                "#now-playing"
            );


        if (
            nowPlayingTarget &&
            !nowPlayingPanel.classList.contains(
                "empty"
            )
        ) {
            event.preventDefault();


            const provider =
                nowPlayingPanel.dataset.provider;


            if (
                provider &&
                PROVIDERS.has(
                    provider
                )
            ) {
                chrome.runtime.sendMessage({
                    type:
                        "dashboard-switch-provider",

                    provider
                });
            }


            return;
        }


        const button =
            event.target.closest(
                "button"
            );


        if (
            !button
        ) {
            return;
        }


        event.preventDefault();


        const provider =
            button.dataset.provider;


        if (
            provider &&
            PROVIDERS.has(
                provider
            )
        ) {
            openProvider(
                provider
            );


            return;
        }


        if (
            button.id ===
            "reload-left"
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-reload-left"
            });


            return;
        }


        if (
            button.id ===
            "kill-shell"
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-kill-stream-shell"
            });
        }
    },

    true
);


nowPlayingPanel.addEventListener(
    "keydown",
    event => {
        if (
            event.target.closest?.(
                "button"
            )
        ) {
            return;
        }


        if (
            (
                event.key !==
                    "Enter" &&
                event.key !==
                    " "
            ) ||
            nowPlayingPanel.classList.contains(
                "empty"
            )
        ) {
            return;
        }


        event.preventDefault();


        const provider =
            nowPlayingPanel.dataset.provider;


        if (
            provider &&
            PROVIDERS.has(
                provider
            )
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-switch-provider",

                provider
            });
        }
    }
);


