    const YOUTUBE_SHORTS_LIKE_MARKER =
        "data-stream-shell-shorts-like-icon";

    const YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER =
        "data-stream-shell-shorts-like-original";

    const YOUTUBE_SHORTS_LIKE_SVG_MARKER =
        "data-stream-shell-shorts-like-svg";

    const YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR =
        "#segmented-like-button button, like-button-view-model button, #like-button button";

    const YOUTUBE_SHORTS_LIKE_HOST_SELECTOR =
        "#segmented-like-button, like-button-view-model, #like-button";


    let youtubeShortsLikePatchActive =
        false;

    let youtubeShortsLikeButton =
        null;

    let youtubeShortsLikeOriginalSvg =
        null;

    let youtubeShortsLikeCustomSvg =
        null;

    let youtubeShortsLikeObserver =
        null;

    let youtubeShortsLikeObserverRoot =
        null;

    let youtubeShortsLikeDiscoveryObserver =
        null;

    let youtubeShortsLikeDiscoveryObserverRoot =
        null;


    const YOUTUBE_SHORTS_THUMB_DOWN_OUTLINE_PATH =
        "m11.31 2 .392.007c1.824.06 3.61.534 5.223 1.388l.343.189.27.154c.264.152.56.24.863.26l.13.004H20.5a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-1.79l-.158.013a1 1 0 00-.723.512l-.064.145-2.987 8.535a1 1 0 01-1.109.656l-1.04-.174a4 4 0 01-3.251-4.783L10 15H5.938a3.664 3.664 0 01-3.576-2.868A3.682 3.682 0 013 9.15l-.02-.088A3.816 3.816 0 014 5.5v-.043l.008-.227a2.86 2.86 0 01.136-.664l.107-.28A3.754 3.754 0 017.705 2h3.605ZM7.705 4c-.755 0-1.425.483-1.663 1.2l-.032.126a.818.818 0 00-.01.131v.872l-.587.586a1.816 1.816 0 00-.524 1.465l.038.23.02.087.21.9-.55.744a1.686 1.686 0 00-.321 1.18l.029.177c.17.76.844 1.302 1.623 1.302H10a2.002 2.002 0 011.956 2.419l-.623 2.904-.034.208a2.002 2.002 0 001.454 2.139l.206.045.21.035 2.708-7.741A3.001 3.001 0 0118.71 11H20V6.002h-1.47c-.696 0-1.38-.183-1.985-.528l-.27-.155-.285-.157A10.002 10.002 0 0011.31 4H7.705Z";

    const YOUTUBE_SHORTS_THUMB_DOWN_FILLED_PATH =
        "M11.313 2.002c2.088 0 4.14.546 5.953 1.583l.273.156a2 2 0 00.993.264H21a1 1 0 011 1V11a1 1 0 01-1.002 1l-2.787-.005a1 1 0 00-.946.67l-3.02 8.628a.815.815 0 01-.966.522 3.262 3.262 0 01-2.35-4.062l.707-2.477a1 1 0 00-.961-1.274h-5.29a2.24 2.24 0 01-2.004-1.238l-.18-.359a1.784 1.784 0 01.601-2.278.446.446 0 00.198-.37v-.07a.578.578 0 00-.116-.347 2.374 2.374 0 01.412-3.278l.498-.399a.379.379 0 00.123-.415l-.07-.207a2.1 2.1 0 01.313-1.923A2.798 2.798 0 017.4 2l3.913.002Z";


    function clearYouTubeShortsLikeIcons() {
        if (
            !youtubeShortsLikePatchActive
        ) {
            return false;
        }


        try {
            youtubeShortsLikeCustomSvg
                ?.remove?.();
        } catch {
        }


        try {
            youtubeShortsLikeOriginalSvg
                ?.style
                ?.removeProperty(
                    "visibility"
                );

            youtubeShortsLikeOriginalSvg
                ?.removeAttribute?.(
                    YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER
                );
        } catch {
        }


        try {
            youtubeShortsLikeButton
                ?.removeAttribute?.(
                    YOUTUBE_SHORTS_LIKE_MARKER
                );
        } catch {
        }


        youtubeShortsLikePatchActive =
            false;

        youtubeShortsLikeButton =
            null;

        youtubeShortsLikeOriginalSvg =
            null;

        youtubeShortsLikeCustomSvg =
            null;


        return true;
    }


    function isYouTubeShortsLikePressed(
        button
    ) {
        if (
            isPressedButton(
                button
            )
        ) {
            return true;
        }


        const stateHost =
            button?.closest?.(
                "[aria-pressed], [aria-checked]"
            );


        if (
            stateHost &&
            stateHost !== button &&
            isPressedButton(
                stateHost
            )
        ) {
            return true;
        }


        const label =
            [
                button?.getAttribute?.(
                    "aria-label"
                ),
                button?.getAttribute?.(
                    "title"
                )
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase();


        return (
            label.includes(
                "unlike"
            ) ||
            label.includes(
                "gefällt mir nicht mehr"
            ) ||
            label.includes(
                "mag ich nicht mehr"
            )
        );
    }


    function createYouTubeShortsThumbSvg(
        pressed
    ) {
        const namespace =
            "http://www.w3.org/2000/svg";


        const svg =
            document.createElementNS(
                namespace,
                "svg"
            );


        svg.setAttribute(
            YOUTUBE_SHORTS_LIKE_SVG_MARKER,
            "true"
        );

        svg.setAttribute(
            "viewBox",
            "0 0 24 24"
        );

        svg.setAttribute(
            "width",
            "24"
        );

        svg.setAttribute(
            "height",
            "24"
        );

        svg.setAttribute(
            "aria-hidden",
            "true"
        );

        svg.setAttribute(
            "focusable",
            "false"
        );

        svg.style.setProperty(
            "display",
            "block"
        );

        svg.style.setProperty(
            "width",
            "24px"
        );

        svg.style.setProperty(
            "height",
            "24px"
        );

        svg.style.setProperty(
            "pointer-events",
            "none"
        );

        svg.style.setProperty(
            "color",
            "currentColor"
        );


        const path =
            document.createElementNS(
                namespace,
                "path"
            );


        path.setAttribute(
            "d",
            pressed
                ? YOUTUBE_SHORTS_THUMB_DOWN_FILLED_PATH
                : YOUTUBE_SHORTS_THUMB_DOWN_OUTLINE_PATH
        );

        path.setAttribute(
            "fill",
            "currentColor"
        );

        // Rotate the old/native Shorts dislike geometry 180 degrees so the
        // thumb points up and keeps YouTube's normal left/right orientation.
        path.setAttribute(
            "transform",
            "translate(24 24) scale(-1 -1)"
        );


        svg.appendChild(
            path
        );


        return svg;
    }


    function scheduleYouTubeShortsLikeIconSync() {
        if (
            !shouldProviderResourceObserveDom()
        ) {
            return;
        }


        const run =
            () => {
                if (
                    shouldProviderResourceObserveDom()
                ) {
                    syncYouTubeShortsLikeIcon();
                }
            };


        setTimeout(
            run,
            0
        );

        setTimeout(
            run,
            160
        );
    }


    function bindYouTubeShortsLikeButton(
        button
    ) {
        if (
            button.__streamShellShortsLikeBound ===
                true
        ) {
            return;
        }


        button.__streamShellShortsLikeBound =
            true;


        button.addEventListener(
            "click",
            scheduleYouTubeShortsLikeIconSync,
            true
        );
    }


    function mutationTouchesYouTubeShortsLikeControl(
        mutation,
        scope
    ) {
        const target =
            mutation.target instanceof Element
                ? mutation.target
                : null;


        if (
            mutation.type ===
                "attributes"
        ) {
            if (
                target === scope &&
                mutation.attributeName ===
                    "is-active"
            ) {
                return true;
            }


            return Boolean(
                target?.matches?.(
                    YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR
                ) ||
                target?.closest?.(
                    YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
                )
            );
        }


        if (
            mutation.type !==
                "childList"
        ) {
            return false;
        }


        if (
            target?.matches?.(
                YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
            ) ||
            target?.closest?.(
                YOUTUBE_SHORTS_LIKE_HOST_SELECTOR
            )
        ) {
            return true;
        }


        for (
            const node
            of [
                ...mutation.addedNodes,
                ...mutation.removedNodes
            ]
        ) {
            if (
                !(node instanceof Element)
            ) {
                continue;
            }


            if (
                node.hasAttribute?.(
                    YOUTUBE_SHORTS_LIKE_SVG_MARKER
                )
            ) {
                continue;
            }


            if (
                node.matches?.(
                    `${YOUTUBE_SHORTS_LIKE_HOST_SELECTOR}, ${YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR}`
                ) ||
                node.querySelector?.(
                    `${YOUTUBE_SHORTS_LIKE_HOST_SELECTOR}, ${YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR}`
                )
            ) {
                return true;
            }
        }


        return false;
    }


    function disconnectYouTubeShortsLikeDiscoveryObserver() {
        try {
            youtubeShortsLikeDiscoveryObserver
                ?.disconnect?.();
        } catch {
        }


        youtubeShortsLikeDiscoveryObserverRoot =
            null;
    }


    function syncYouTubeShortsLikeDiscoveryObserver(
        enabled =
            true
    ) {
        const allowed =
            enabled !==
                false &&
            !isProviderSafeModeEnabled(
                "youtube"
            ) &&
            shouldProviderResourceObserveDom() &&
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !allowed ||
            getActiveYouTubeShortsRenderer()
        ) {
            disconnectYouTubeShortsLikeDiscoveryObserver();
            return false;
        }


        const root =
            document.querySelector(
                "ytd-shorts"
            ) ||
            document.querySelector(
                "ytd-page-manager"
            );


        if (
            !root
        ) {
            disconnectYouTubeShortsLikeDiscoveryObserver();
            return false;
        }


        if (
            youtubeShortsLikeDiscoveryObserverRoot ===
                root
        ) {
            return true;
        }


        disconnectYouTubeShortsLikeDiscoveryObserver();


        if (
            !youtubeShortsLikeDiscoveryObserver
        ) {
            youtubeShortsLikeDiscoveryObserver =
                new MutationObserver(
                    () => {
                        if (
                            !shouldProviderResourceObserveDom() ||
                            !location.pathname.startsWith(
                                "/shorts/"
                            )
                        ) {
                            disconnectYouTubeShortsLikeDiscoveryObserver();
                            return;
                        }


                        const activeScope =
                            getActiveYouTubeShortsRenderer();


                        if (
                            activeScope
                        ) {
                            disconnectYouTubeShortsLikeDiscoveryObserver();
                            scheduleYouTubeShortsLikeIconSync();
                            return;
                        }


                        const shortsRoot =
                            document.querySelector(
                                "ytd-shorts"
                            );


                        if (
                            shortsRoot &&
                            youtubeShortsLikeDiscoveryObserverRoot !==
                                shortsRoot
                        ) {
                            syncYouTubeShortsLikeDiscoveryObserver();
                        }
                    }
                );
        }


        youtubeShortsLikeDiscoveryObserver.observe(
            root,
            {
                attributes:
                    true,

                childList:
                    true,

                subtree:
                    true,

                attributeFilter: [
                    "is-active"
                ]
            }
        );


        youtubeShortsLikeDiscoveryObserverRoot =
            root;


        return true;
    }


    function syncYouTubeShortsLikeObserver(
        enabled =
            true
    ) {
        const allowed =
            enabled !==
                false &&
            !isProviderSafeModeEnabled(
                "youtube"
            ) &&
            shouldProviderResourceObserveDom() &&
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !allowed
        ) {
            try {
                youtubeShortsLikeObserver
                    ?.disconnect?.();
            } catch {
            }


            youtubeShortsLikeObserverRoot =
                null;

            disconnectYouTubeShortsLikeDiscoveryObserver();


            return false;
        }


        const scope =
            getActiveYouTubeShortsRenderer();


        if (
            !scope
        ) {
            try {
                youtubeShortsLikeObserver
                    ?.disconnect?.();
            } catch {
            }


            youtubeShortsLikeObserverRoot =
                null;

            syncYouTubeShortsLikeDiscoveryObserver();


            return false;
        }


        disconnectYouTubeShortsLikeDiscoveryObserver();


        if (
            youtubeShortsLikeObserverRoot ===
                scope
        ) {
            return true;
        }


        try {
            youtubeShortsLikeObserver
                ?.disconnect?.();
        } catch {
        }


        if (
            !youtubeShortsLikeObserver
        ) {
            youtubeShortsLikeObserver =
                new MutationObserver(
                    mutations => {
                        if (
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        const activeScope =
                            youtubeShortsLikeObserverRoot;


                        if (
                            !activeScope
                        ) {
                            return;
                        }


                        if (
                            mutations.some(
                                mutation =>
                                    mutationTouchesYouTubeShortsLikeControl(
                                        mutation,
                                        activeScope
                                    )
                            )
                        ) {
                            scheduleYouTubeShortsLikeIconSync();
                        }
                    }
                );
        }


        youtubeShortsLikeObserver.observe(
            scope,
            {
                attributes:
                    true,

                childList:
                    true,

                subtree:
                    true,

                attributeFilter: [
                    "is-active",
                    "aria-pressed",
                    "aria-checked",
                    "aria-label",
                    "title"
                ]
            }
        );


        youtubeShortsLikeObserverRoot =
            scope;


        return true;
    }


    function syncYouTubeShortsLikeIcon() {
        const isShort =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            !isShort ||
            isProviderSafeModeEnabled(
                "youtube"
            )
        ) {
            clearYouTubeShortsLikeIcons();
            return false;
        }


        const scope =
            getActiveYouTubeShortsRenderer();


        syncYouTubeShortsLikeObserver();


        if (
            !scope
        ) {
            return false;
        }


        const likeButton =
            scope.querySelector(
                YOUTUBE_SHORTS_LIKE_BUTTON_SELECTOR
            );


        if (
            !likeButton
        ) {
            return false;
        }


        const originalSvg =
            Array.from(
                likeButton.querySelectorAll(
                    "svg"
                )
            ).find(
                svg =>
                    !svg.hasAttribute(
                        YOUTUBE_SHORTS_LIKE_SVG_MARKER
                    )
            );


        if (
            !originalSvg ||
            !originalSvg.parentElement
        ) {
            return false;
        }


        bindYouTubeShortsLikeButton(
            likeButton
        );


        if (
            youtubeShortsLikePatchActive &&
            (
                youtubeShortsLikeButton !== likeButton ||
                youtubeShortsLikeOriginalSvg !== originalSvg
            )
        ) {
            clearYouTubeShortsLikeIcons();
        }


        likeButton.setAttribute(
            YOUTUBE_SHORTS_LIKE_MARKER,
            "true"
        );


        originalSvg.setAttribute(
            YOUTUBE_SHORTS_LIKE_ORIGINAL_MARKER,
            "true"
        );

        originalSvg.style.setProperty(
            "visibility",
            "hidden",
            "important"
        );


        youtubeShortsLikePatchActive =
            true;

        youtubeShortsLikeButton =
            likeButton;

        youtubeShortsLikeOriginalSvg =
            originalSvg;


        const pressed =
            isYouTubeShortsLikePressed(
                likeButton
            );


        if (
            youtubeShortsLikeCustomSvg
                ?.isConnected &&
            youtubeShortsLikeCustomSvg
                ?.getAttribute(
                    "data-stream-shell-pressed"
                ) === String(
                    pressed
                )
        ) {
            return true;
        }


        try {
            youtubeShortsLikeCustomSvg
                ?.remove?.();
        } catch {
        }


        const customSvg =
            createYouTubeShortsThumbSvg(
                pressed
            );


        customSvg.setAttribute(
            "data-stream-shell-pressed",
            String(
                pressed
            )
        );


        originalSvg.parentElement.insertBefore(
            customSvg,
            originalSvg
        );


        youtubeShortsLikeCustomSvg =
            customSvg;


        return true;
    }
