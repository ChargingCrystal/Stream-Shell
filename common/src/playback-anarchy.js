    const ANARCHY_NEON_COLORS = [
        "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
        "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
        "#b000ff", "#7c00ff", "#651fff", "#304ffe",
        "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
        "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
        "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
        "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
        "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
    ];
    let anarchyNeonColorBag = [];

    function refillAnarchyNeonColorBag() {
        anarchyNeonColorBag = [...ANARCHY_NEON_COLORS];
        for (let i = anarchyNeonColorBag.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [anarchyNeonColorBag[i], anarchyNeonColorBag[j]] =
                [anarchyNeonColorBag[j], anarchyNeonColorBag[i]];
        }
    }

    function randomNeonColor() {
        if (!anarchyNeonColorBag.length) refillAnarchyNeonColorBag();
        return anarchyNeonColorBag.pop();
    }

    function playbackAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            playbackUtilitySettings.streamShellPlaybackAnarchy === true;
    }

    function subtitleAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            shouldProviderResourceRunVisualWork() &&
            SUBTITLE_OVERRIDE_PROVIDERS.has(provider) &&
            playbackUtilitySettings.streamShellSubtitleAnarchy === true;
    }

    function choosePlaybackAnarchyTarget(video) {
        const current = normalizePlaybackRate(
            Number(video?.playbackRate) || 1
        );

        playbackAnarchyState = {
            video,
            from: current,
            target: randomBetween(0.55, 1.9),
            startedAt: performance.now(),
            duration: randomBetween(900, 4200)
        };
    }

    function tickPlaybackAnarchy(provider) {
        if (!playbackAnarchyEnabled(provider)) {
            playbackAnarchyState = null;
            return;
        }

        const video = getPrimaryVideo();
        if (!video) {
            playbackAnarchyState = null;
            return;
        }

        if (
            !playbackAnarchyState ||
            playbackAnarchyState.video !== video
        ) {
            choosePlaybackAnarchyTarget(video);
        }

        const now = performance.now();
        const state = playbackAnarchyState;
        const t = (now - state.startedAt) / state.duration;
        const eased = smoothStep(t);
        const rate = state.from +
            (state.target - state.from) * eased;

        const clampedRate = Math.max(0.25, Math.min(2, rate));

        if (provider === "netflix") {
            try {
                Promise.resolve(
                    getProviderAdapter(provider)?.setPlaybackRate?.(clampedRate)
                ).catch(() => {});
            } catch {
            }
        } else {
            try {
                video.playbackRate = clampedRate;
            } catch {
            }
        }

        if (t >= 1) {
            playbackAnarchyState = {
                video,
                from: state.target,
                target: randomBetween(0.55, 1.9),
                startedAt: now,
                duration: randomBetween(900, 4200)
            };
        }
    }

    function ensurePlaybackAnarchyTimer(provider) {
        const configured = playbackAnarchyEnabled(provider);
        const resourceState = getProviderResourceGovernorState();
        const enabled = configured && resourceState.playing === true;

        if (enabled && !playbackAnarchyTimer) {
            playbackAnarchyTimer = setInterval(
                () => tickPlaybackAnarchy(provider),
                50
            );
            tickPlaybackAnarchy(provider);
            return;
        }

        if (!enabled && playbackAnarchyTimer) {
            clearInterval(playbackAnarchyTimer);
            playbackAnarchyTimer = null;
            playbackAnarchyState = null;
        }
    }

    function chooseSubtitleAnarchyTarget() {
        const root = document.documentElement;
        const current = Number(
            root?.style.getPropertyValue(
                "--stream-shell-subtitle-scale"
            )
        );

        subtitleAnarchyState = {
            from: Number.isFinite(current) && current > 0
                ? current
                : 1,
            target: randomBetween(0.62, 1.85),
            startedAt: performance.now(),
            duration: randomBetween(650, 2600)
        };
    }

    function tickSubtitleAnarchy(provider) {
        if (!subtitleAnarchyEnabled(provider)) {
            subtitleAnarchyState = null;
            return;
        }

        const root = document.documentElement;
        if (!root) {
            return;
        }

        if (!subtitleAnarchyState) {
            chooseSubtitleAnarchyTarget();
        }

        const now = performance.now();
        const state = subtitleAnarchyState;
        const t = (now - state.startedAt) / state.duration;
        const eased = smoothStep(t);
        const scale = state.from +
            (state.target - state.from) * eased;

        root.style.setProperty(
            "--stream-shell-subtitle-scale",
            String(scale)
        );

        if (t >= 1) {
            subtitleAnarchyState = {
                from: state.target,
                target: randomBetween(0.62, 1.85),
                startedAt: now,
                duration: randomBetween(650, 2600)
            };
        }
    }

    function ensureSubtitleAnarchyTimers(provider) {
        const enabled = subtitleAnarchyEnabled(provider);

        if (enabled && !subtitleAnarchyTimer) {
            subtitleAnarchyTimer = setInterval(
                () => tickSubtitleAnarchy(provider),
                50
            );
            subtitleColorTimer = setInterval(
                () => {
                    if (!subtitleAnarchyEnabled(provider)) {
                        return;
                    }

                    document.documentElement?.style.setProperty(
                        "--stream-shell-subtitle-color",
                        randomNeonColor()
                    );
                },
                200
            );

            document.documentElement?.style.setProperty(
                "--stream-shell-subtitle-color",
                randomNeonColor()
            );
            tickSubtitleAnarchy(provider);
            return;
        }

        if (!enabled) {
            if (subtitleAnarchyTimer) {
                clearInterval(subtitleAnarchyTimer);
                subtitleAnarchyTimer = null;
            }

            if (subtitleColorTimer) {
                clearInterval(subtitleColorTimer);
                subtitleColorTimer = null;
            }

            subtitleAnarchyState = null;
        }
    }

    function dvdAnarchyEnabled(provider) {
        return !isProviderSafeModeEnabled(provider) &&
            playbackUtilitySettings.streamShellDvdAnarchy === true;
    }

    function dvdAnarchyShouldRun(provider) {
        if (!dvdAnarchyEnabled(provider)) return false;

        /*
         * This runs from requestAnimationFrame, so use the governor's live
         * core state directly instead of building the Diagnostics workload
         * snapshot on every frame. Governor changes still call
         * syncPlaybackUtilities immediately.
         */
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("dvd-anarchy");

        return Boolean(
            state.visible === true &&
            state.leftMode === provider &&
            state.minimized !== true
        );
    }

    function destroyDvdAnarchy() {
        if (dvdAnarchyFrame) {
            cancelAnimationFrame(dvdAnarchyFrame);
            dvdAnarchyFrame = null;
        }

        if (dvdAnarchyHost?.isConnected) {
            dvdAnarchyHost.remove();
        }

        dvdAnarchyHost = null;
        dvdAnarchyLogo = null;
        dvdAnarchyState = null;
    }

    function createDvdAnarchyHost() {
        if (dvdAnarchyHost?.isConnected && dvdAnarchyLogo) {
            return;
        }

        destroyDvdAnarchy();

        const host = document.createElement("div");
        host.id = "stream-shell-dvd-anarchy";
        host.setAttribute("aria-hidden", "true");
        host.style.setProperty("all", "initial", "important");
        host.style.setProperty("position", "fixed", "important");
        host.style.setProperty("inset", "0", "important");
        host.style.setProperty("width", "100vw", "important");
        host.style.setProperty("height", "100vh", "important");
        host.style.setProperty("pointer-events", "none", "important");
        host.style.setProperty("overflow", "hidden", "important");
        host.style.setProperty("z-index", "2147483646", "important");
        host.style.setProperty("contain", "strict", "important");

        const shadow = host.attachShadow({ mode: "closed" });
        const logo = document.createElement("div");
        const maskUrl = `url("${chrome.runtime.getURL(
            "assets/anarchy/dvd-logo.png"
        )}")`;

        logo.style.cssText = [
            "position:absolute",
            "left:0",
            "top:0",
            "width:clamp(138px, 12vw, 240px)",
            "aspect-ratio:540 / 280",
            "background:#00ffff",
            `-webkit-mask-image:${maskUrl}`,
            "-webkit-mask-repeat:no-repeat",
            "-webkit-mask-position:center",
            "-webkit-mask-size:contain",
            `mask-image:${maskUrl}`,
            "mask-repeat:no-repeat",
            "mask-position:center",
            "mask-size:contain",
            "will-change:transform,background-color",
            "filter:drop-shadow(0 0 10px rgba(0,0,0,.35))",
            "opacity:.92"
        ].join(";");

        shadow.appendChild(logo);
        document.documentElement?.appendChild(host);
        dvdAnarchyHost = host;
        dvdAnarchyLogo = logo;
    }

    function chooseDvdAnarchySpeedTarget(now) {
        if (!dvdAnarchyState) return;

        const current = Number(dvdAnarchyState.speed) || 260;
        dvdAnarchyState.speedFrom = current;
        dvdAnarchyState.speedTarget = randomBetween(105, 760);
        dvdAnarchyState.speedStartedAt = now;
        dvdAnarchyState.speedDuration = randomBetween(420, 1500);
        dvdAnarchyState.nextSpeedChangeAt = now +
            randomBetween(950, 3600);
    }

    function resetDvdAnarchyState(now) {
        const width = Math.max(0, window.innerWidth || 0);
        const height = Math.max(0, window.innerHeight || 0);
        const rect = dvdAnarchyLogo?.getBoundingClientRect?.();
        const logoWidth = Math.max(1, rect?.width || 180);
        const logoHeight = Math.max(1, rect?.height || 93);
        const maxX = Math.max(0, width - logoWidth);
        const maxY = Math.max(0, height - logoHeight);
        const angle = randomBetween(
            24 * Math.PI / 180,
            66 * Math.PI / 180
        );
        const xSign = Math.random() < 0.5 ? -1 : 1;
        const ySign = Math.random() < 0.5 ? -1 : 1;
        const initialSpeed = randomBetween(180, 520);

        dvdAnarchyState = {
            x: randomBetween(0, maxX),
            y: randomBetween(0, maxY),
            dirX: Math.cos(angle) * xSign,
            dirY: Math.sin(angle) * ySign,
            speed: initialSpeed,
            speedFrom: initialSpeed,
            speedTarget: initialSpeed,
            speedStartedAt: now,
            speedDuration: 1,
            nextSpeedChangeAt: now + randomBetween(700, 2200),
            lastAt: now,
            lastWidth: width,
            lastHeight: height
        };

        if (dvdAnarchyLogo) {
            dvdAnarchyLogo.style.backgroundColor = randomNeonColor();
        }
    }

    function tickDvdAnarchy(provider, now) {
        dvdAnarchyFrame = null;

        if (!dvdAnarchyShouldRun(provider)) {
            destroyDvdAnarchy();
            return;
        }

        createDvdAnarchyHost();
        if (!dvdAnarchyLogo) return;

        if (!dvdAnarchyState) {
            resetDvdAnarchyState(now);
        }

        const state = dvdAnarchyState;
        const width = Math.max(0, window.innerWidth || 0);
        const height = Math.max(0, window.innerHeight || 0);
        const rect = dvdAnarchyLogo.getBoundingClientRect();
        const logoWidth = Math.max(1, rect.width || 180);
        const logoHeight = Math.max(1, rect.height || 93);
        const maxX = Math.max(0, width - logoWidth);
        const maxY = Math.max(0, height - logoHeight);

        if (
            state.lastWidth !== width ||
            state.lastHeight !== height
        ) {
            state.x = Math.min(maxX, Math.max(0, state.x));
            state.y = Math.min(maxY, Math.max(0, state.y));
            state.lastWidth = width;
            state.lastHeight = height;
        }

        if (now >= state.nextSpeedChangeAt) {
            chooseDvdAnarchySpeedTarget(now);
        }

        const speedT = Math.max(
            0,
            Math.min(
                1,
                (now - state.speedStartedAt) /
                    Math.max(1, state.speedDuration)
            )
        );
        const easedSpeedT = smoothStep(speedT);
        state.speed = state.speedFrom +
            (state.speedTarget - state.speedFrom) * easedSpeedT;

        const deltaSeconds = Math.min(
            0.05,
            Math.max(0, (now - state.lastAt) / 1000)
        );
        state.lastAt = now;

        state.x += state.dirX * state.speed * deltaSeconds;
        state.y += state.dirY * state.speed * deltaSeconds;

        let collided = false;

        if (state.x <= 0) {
            state.x = 0;
            state.dirX = Math.abs(state.dirX);
            collided = true;
        } else if (state.x >= maxX) {
            state.x = maxX;
            state.dirX = -Math.abs(state.dirX);
            collided = true;
        }

        if (state.y <= 0) {
            state.y = 0;
            state.dirY = Math.abs(state.dirY);
            collided = true;
        } else if (state.y >= maxY) {
            state.y = maxY;
            state.dirY = -Math.abs(state.dirY);
            collided = true;
        }

        if (collided) {
            dvdAnarchyLogo.style.backgroundColor = randomNeonColor();
        }

        dvdAnarchyLogo.style.transform =
            `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;

        dvdAnarchyFrame = requestAnimationFrame(
            nextNow => tickDvdAnarchy(provider, nextNow)
        );
    }

    function syncDvdAnarchy(provider) {
        if (!dvdAnarchyShouldRun(provider)) {
            destroyDvdAnarchy();
            return;
        }

        createDvdAnarchyHost();
        if (!dvdAnarchyFrame) {
            dvdAnarchyFrame = requestAnimationFrame(
                now => tickDvdAnarchy(provider, now)
            );
        }
    }

