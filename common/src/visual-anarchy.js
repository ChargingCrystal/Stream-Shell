    /*
     * VISUAL ANARCHY DIRECTOR
     * One event timer per player document; no permanent animation loops.
     * Independent CSS translate/rotate/scale properties do not replace the
     * provider's own `transform` (which many players update themselves).
     * Restoration is exact, including pre-existing inline priorities.
     */
    const VISUAL_EFFECT_KEYS = {
        zoom: "streamShellVisualZoom",
        deepfry: "streamShellVisualDeepFry",
        vhs: "streamShellVisualVhs",
        color: "streamShellVisualColor",
        gravity: "streamShellVisualGravity",
        aspect: "streamShellVisualAspect"
    };
    const VISUAL_CSS_PROPERTIES = [
        "filter", "scale", "rotate", "translate", "transform-origin", "transition"
    ];

    function visualAnarchyReady(provider) {
        if (playbackUtilitySettings.streamShellVisualAnarchy !== true ||
            isProviderSafeModeEnabled(provider) || document.hidden) return false;
        const state = getProviderResourceGovernorState();
        return state?.visible === true && state?.leftMode === provider &&
            state?.minimized !== true && state?.playing === true;
    }

    function visualAnarchyDelay() {
        const mode = playbackUtilitySettings.streamShellVisualFrequency;
        const range = mode === "absolute" ? [5000, 15000] :
            mode === "chaotic" ? [20000, 60000] : [60000, 120000];
        return Math.round(randomBetween(range[0], range[1]));
    }

    function restoreVisualAnarchy() {
        if (!visualAnarchyActive) return;
        const { video, previous, overlay } = visualAnarchyActive;
        for (const [property, saved] of Object.entries(previous)) {
            if (saved.value) video.style.setProperty(property, saved.value, saved.priority);
            else video.style.removeProperty(property);
        }
        overlay?.remove();
        visualAnarchyActive = null;
    }

    function stopVisualAnarchy() {
        if (visualAnarchyTimer !== null) {
            clearTimeout(visualAnarchyTimer);
            visualAnarchyTimer = null;
        }
        restoreVisualAnarchy();
        visualAnarchyProvider = null;
    }

    // Place overlays inside the browser Fullscreen top layer when possible.
    // A fullscreen <video> cannot host HTML overlays; VHS still changes its
    // video filter/translate in that case, so the effect is never invisible.
    function drawVhsScanlines(video, intensity) {
        const rect = video.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return null;
        const fullscreen = document.fullscreenElement;
        if (fullscreen === video) return null;
        const host = document.createElement("div");
        host.id = "stream-shell-visual-anarchy-vhs";
        host.setAttribute("aria-hidden", "true");
        Object.assign(host.style, {
            position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
            width: `${rect.width}px`, height: `${rect.height}px`,
            pointerEvents: "none", zIndex: "2147483646",
            opacity: String(Math.min(.58, .28 + intensity * .3)),
            background: [
                "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,.85) 4px, transparent 6px)",
                "repeating-linear-gradient(to right, transparent 0px, rgba(255,0,65,.19) 23px, rgba(0,220,255,.18) 25px, transparent 51px)"
            ].join(", "),
            contain: "strict"
        });
        (fullscreen || document.documentElement).appendChild(host);
        return host;
    }

    // Unbiased selection without sorting with a random comparator. Boss events
    // pick 2-3 distinct enabled effects using the same one-shot scheduler.
    function chooseVisualEffects(effects, boss) {
        const pool = effects.slice();
        const count = boss ? Math.min(pool.length, 2 + (pool.length > 2 && Math.random() < .5 ? 1 : 0)) : 1;
        const selected = [];
        for (let i = 0; i < count; i++) {
            selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        return selected;
    }

    function executeVisualAnarchy(provider) {
        if (!visualAnarchyReady(provider)) { stopVisualAnarchy(); return; }
        const video = getPrimaryVideo();
        if (!video || video.paused || !video.isConnected) {
            visualAnarchyTimer = setTimeout(() => { visualAnarchyTimer = null; syncVisualAnarchy(provider); }, 5000);
            return;
        }
        const effects = Object.keys(VISUAL_EFFECT_KEYS).filter(k =>
            playbackUtilitySettings[VISUAL_EFFECT_KEYS[k]] === true);
        if (!effects.length) { stopVisualAnarchy(); return; }
        const boss = playbackUtilitySettings.streamShellVisualBoss === true &&
            effects.length > 1 && Math.random() < .12;
        const chosen = chooseVisualEffects(effects, boss);
        const intensity = Math.max(0, Math.min(1, Number(playbackUtilitySettings.streamShellVisualIntensity) / 100 || 0));
        const previous = Object.fromEntries(VISUAL_CSS_PROPERTIES.map(prop => [prop, {
            value: video.style.getPropertyValue(prop),
            priority: video.style.getPropertyPriority(prop)
        }]));
        const filters = [];
        let scaleX = 1;
        let scaleY = 1;
        let angle = 0;
        let moveX = 0;
        let moveY = 0;
        let origin = "50% 50%";
        let overlay = null;

        if (chosen.includes("deepfry")) {
            filters.push(`contrast(${1 + intensity * 2}) saturate(${1 + intensity * 4})`);
        }
        if (chosen.includes("color")) {
            const modes = [
                `hue-rotate(${Math.round(randomBetween(75, 285) * intensity)}deg)`,
                `invert(${intensity})`, `sepia(${intensity})`,
                `grayscale(${intensity})`
            ];
            filters.push(modes[Math.floor(Math.random() * modes.length)]);
        }
        if (chosen.includes("zoom")) {
            // Avoid near-1.0 no-ops: at 75% intensity zoom is distinctly visible.
            const zoomIn = Math.random() < .72;
            const zoom = zoomIn
                ? 1 + randomBetween(.35, .8) * intensity
                : 1 - randomBetween(.26, .34) * intensity;
            scaleX *= zoom;
            scaleY *= zoom;
            origin = `${Math.round(randomBetween(5, 95))}% ${Math.round(randomBetween(5, 95))}%`;
        }
        if (chosen.includes("gravity")) {
            angle = (Math.random() < .5 ? -1 : 1) * randomBetween(16, 42) * intensity;
        }
        if (chosen.includes("aspect")) {
            const axis = Math.random() < .5 ? "X" : "Y";
            // Compression, stretch, and an occasional unmistakable mirror flip.
            const mirrored = Math.random() < .25;
            const axisScale = mirrored ? -(1 + .2 * intensity) :
                Math.random() < .5 ? 1 - randomBetween(.45, .8) * intensity :
                1 + randomBetween(.5, 1.1) * intensity;
            if (axis === "X") scaleX *= axisScale;
            else scaleY *= axisScale;
        }
        if (chosen.includes("vhs")) {
            // The original VHS overlay can be behind fullscreen video. Add a
            // visible video-level effect even where overlays cannot be hosted.
            moveX = (Math.random() < .5 ? -1 : 1) * randomBetween(8, 25) * intensity;
            moveY = (Math.random() < .5 ? -1 : 1) * randomBetween(2, 8) * intensity;
            filters.push(`contrast(${1 + .45 * intensity}) saturate(${1 - .55 * intensity}) sepia(${.4 * intensity})`);
            overlay = drawVhsScanlines(video, intensity);
        }

        const existingFilter = previous.filter.value && previous.filter.value !== "none" ? previous.filter.value + " " : "";
        // Never write 'transform': provider CSS/JS owns that property. The
        // individual transforms compose with it on modern Chromium/Opera GX.
        video.style.setProperty("transition", "filter 240ms ease, scale 380ms ease, rotate 380ms ease, translate 220ms steps(2,end)", "important");
        if (filters.length) video.style.setProperty("filter", existingFilter + filters.join(" "), "important");
        if (chosen.includes("zoom") || chosen.includes("aspect"))
            video.style.setProperty("scale", `${scaleX.toFixed(3)} ${scaleY.toFixed(3)}`, "important");
        if (chosen.includes("gravity"))
            video.style.setProperty("rotate", `${angle.toFixed(2)}deg`, "important");
        if (chosen.includes("vhs"))
            video.style.setProperty("translate", `${moveX.toFixed(1)}px ${moveY.toFixed(1)}px`, "important");
        if (chosen.includes("zoom"))
            video.style.setProperty("transform-origin", origin, "important");

        visualAnarchyActive = {video, previous, overlay, chosen, boss};
        const duration = Math.round(randomBetween(2000, 8000));
        visualAnarchyTimer = setTimeout(() => {
            visualAnarchyTimer = null;
            restoreVisualAnarchy();
            syncVisualAnarchy(provider);
        }, duration);
    }

    function syncVisualAnarchy(provider) {
        if (!visualAnarchyReady(provider)) { stopVisualAnarchy(); return; }
        if (visualAnarchyActive && (visualAnarchyActive.video !== getPrimaryVideo() ||
            !visualAnarchyActive.video.isConnected)) stopVisualAnarchy();
        if (visualAnarchyProvider !== null && visualAnarchyProvider !== provider)
            stopVisualAnarchy();
        visualAnarchyProvider = provider;
        if (visualAnarchyTimer !== null) return;
        visualAnarchyTimer = setTimeout(() => {
            visualAnarchyTimer = null;
            executeVisualAnarchy(provider);
        }, visualAnarchyDelay());
    }
