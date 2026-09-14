/*
 * ============================================================
 * DISPLAY PROFILE / LAYOUT TARGET DETECTION
 * ============================================================
 *
 * 0.13.x introduces the display-profile foundation for the two personal
 * target layouts:
 *   - wide    -> 3840x1080 / 32:9
 *   - compact -> 2880x1800 / 16:10
 *
 * Chromium exposes logical display bounds on desktop, so classification
 * intentionally uses aspect ratio; the native resolutions above are reference
 * targets rather than values inferred from OS DPI scaling. 0.13.1 also owns
 * the legacy-pane geometry so every shell window is anchored to the selected
 * display instead of assuming virtual-desktop origin 0,0. The real Compact
 * single-surface host remains a later migration.
 */

const STREAM_SHELL_DISPLAY_MODE_KEY =
    "streamShellDisplayMode";

const STREAM_SHELL_DISPLAY_PROFILE_VERSION = 1;
const STREAM_SHELL_WIDE_ASPECT = 32 / 9;
const STREAM_SHELL_COMPACT_ASPECT = 16 / 10;
const STREAM_SHELL_ASPECT_TOLERANCE = 0.12;

let streamShellDisplayProfileCache = null;


function normalizeDisplayModeOverride(value) {
    const normalized = String(value || "auto").toLowerCase();
    return ["auto", "wide", "compact"].includes(normalized)
        ? normalized
        : "auto";
}


function normalizeDisplayRect(rect) {
    return {
        left: Number(rect?.left) || 0,
        top: Number(rect?.top) || 0,
        width: Math.max(0, Number(rect?.width) || 0),
        height: Math.max(0, Number(rect?.height) || 0)
    };
}


function displayAspectDistance(display, targetAspect) {
    return Math.abs(
        Number(display?.aspectRatio || 0) - targetAspect
    );
}


function isWideDisplayCandidate(display) {
    return displayAspectDistance(
        display,
        STREAM_SHELL_WIDE_ASPECT
    ) <= STREAM_SHELL_ASPECT_TOLERANCE;
}


function isCompactDisplayCandidate(display) {
    return displayAspectDistance(
        display,
        STREAM_SHELL_COMPACT_ASPECT
    ) <= STREAM_SHELL_ASPECT_TOLERANCE;
}


function normalizeDisplayUnit(display) {
    const bounds = normalizeDisplayRect(display?.bounds);
    const workArea = normalizeDisplayRect(display?.workArea);
    const displayZoomFactor = Number(display?.displayZoomFactor);
    const safeDisplayZoomFactor = Number.isFinite(displayZoomFactor) && displayZoomFactor > 0
        ? displayZoomFactor
        : 1;
    const aspectRatio = bounds.height > 0
        ? bounds.width / bounds.height
        : 0;

    const normalized = {
        id: String(display?.id || ""),
        name: String(display?.name || ""),
        isPrimary: display?.isPrimary === true,
        isInternal: display?.isInternal === true,
        isEnabled: display?.isEnabled !== false,
        rotation: Number(display?.rotation) || 0,
        displayZoomFactor: safeDisplayZoomFactor,
        dpiX: Number(display?.dpiX) || null,
        dpiY: Number(display?.dpiY) || null,
        bounds,
        workArea,
        aspectRatio: Number(aspectRatio.toFixed(4)),
        targetClass: "other",
        referenceTarget: null
    };

    if (isWideDisplayCandidate(normalized)) {
        normalized.targetClass = "wide";
        normalized.referenceTarget = "3840x1080-32:9";
    } else if (isCompactDisplayCandidate(normalized)) {
        normalized.targetClass = "compact";
        normalized.referenceTarget = "2880x1800-16:10";
    }

    return normalized;
}


function displayArea(display) {
    return (
        Number(display?.bounds?.width) || 0
    ) * (
        Number(display?.bounds?.height) || 0
    );
}


function chooseDisplayForMode(displays, mode) {
    const enabled = displays.filter(display => display.isEnabled !== false);
    const targetCandidates = enabled.filter(
        mode === "wide"
            ? isWideDisplayCandidate
            : isCompactDisplayCandidate
    );

    const candidates = targetCandidates.length
        ? targetCandidates
        : enabled;

    return [...candidates]
        .sort((a, b) => {
            if (mode === "compact") {
                const internalDelta = Number(b.isInternal) - Number(a.isInternal);
                if (internalDelta) return internalDelta;
            }

            const primaryDelta = Number(b.isPrimary) - Number(a.isPrimary);
            if (primaryDelta) return primaryDelta;

            const targetDelta = Number(Boolean(b.referenceTarget)) - Number(Boolean(a.referenceTarget));
            if (targetDelta) return targetDelta;

            return displayArea(b) - displayArea(a);
        })[0] || null;
}


function chooseAutomaticDisplayProfile(displays) {
    const wideCandidates = displays.filter(isWideDisplayCandidate);
    if (wideCandidates.length) {
        return {
            mode: "wide",
            target: chooseDisplayForMode(wideCandidates, "wide"),
            reason: "auto-wide-present",
            supportedTarget: true
        };
    }

    const compactCandidates = displays.filter(isCompactDisplayCandidate);
    if (compactCandidates.length) {
        return {
            mode: "compact",
            target: chooseDisplayForMode(compactCandidates, "compact"),
            reason: "auto-compact-present",
            supportedTarget: true
        };
    }

    /*
     * Stream Shell is intentionally not a general-purpose responsive app.
     * Unknown layouts receive a deterministic fallback only so Diagnostics
     * can describe them; no support promise is implied by this branch.
     */
    const primary = displays.find(display => display.isPrimary) || displays[0] || null;
    const fallbackMode = Number(primary?.aspectRatio || 0) >= 2.8
        ? "wide"
        : "compact";

    return {
        mode: fallbackMode,
        target: primary,
        reason: "auto-unsupported-fallback",
        supportedTarget: false
    };
}


function plannedDisplayLayout(mode, target) {
    if (!target?.bounds) {
        return {
            full: null,
            left: null,
            right: null
        };
    }

    const full = { ...target.bounds };

    if (mode !== "wide") {
        return {
            full,
            left: full,
            right: null
        };
    }

    const leftWidth = Math.floor(full.width / 2);
    const rightWidth = Math.max(0, full.width - leftWidth);

    return {
        full,
        left: {
            left: full.left,
            top: full.top,
            width: leftWidth,
            height: full.height
        },
        right: {
            left: full.left + leftWidth,
            top: full.top,
            width: rightWidth,
            height: full.height
        }
    };
}


function appliedLegacyWindowGeometry(profile) {
    const target = profile?.targetDisplay || null;

    if (!target) {
        return {
            left: { ...LEFT },
            right: { ...RIGHT },
            source: "legacy-fallback"
        };
    }

    const rawRect = profile.mode === "compact"
        ? (target.workArea?.width && target.workArea?.height
            ? target.workArea
            : target.bounds)
        : target.bounds;

    const full = normalizeDisplayRect(rawRect);
    if (!full.width || !full.height) {
        return {
            left: { ...LEFT },
            right: { ...RIGHT },
            source: "legacy-fallback"
        };
    }

    if (profile.mode === "compact") {
        /*
         * Compact is a true single-surface shell. Dashboard and provider
         * windows deliberately share the same full work-area geometry and
         * the window manager decides which one is visible. Keeping both LEFT
         * and RIGHT equal also lets the existing Discord/native integrations
         * reuse the selected display without learning a third geometry type.
         */
        const surface = {
            left: full.left,
            top: full.top,
            width: full.width,
            height: full.height
        };

        return {
            left: { ...surface },
            right: { ...surface },
            source: "target-display-compact-single-surface"
        };
    }

    const leftWidth = Math.floor(full.width / 2);
    const rightWidth = Math.max(1, full.width - leftWidth);

    return {
        left: {
            left: full.left,
            top: full.top,
            width: Math.max(1, leftWidth),
            height: full.height
        },
        right: {
            left: full.left + leftWidth,
            top: full.top,
            width: rightWidth,
            height: full.height
        },
        source: "target-display-wide"
    };
}

function applyStreamShellDisplayGeometry(profile) {
    const geometry = appliedLegacyWindowGeometry(profile);

    Object.assign(LEFT, geometry.left);
    Object.assign(RIGHT, geometry.right);

    return geometry;
}


async function collectStreamShellDisplays() {
    if (!chrome.system?.display?.getInfo) {
        return {
            apiAvailable: false,
            displays: []
        };
    }

    try {
        const displays = await chrome.system.display.getInfo();
        return {
            apiAvailable: true,
            displays: (Array.isArray(displays) ? displays : [])
                .map(normalizeDisplayUnit)
                .filter(display => display.isEnabled !== false)
        };
    } catch {
        return {
            apiAvailable: false,
            displays: []
        };
    }
}


async function resolveStreamShellDisplayProfile() {
    let override = "auto";

    try {
        const stored = await chrome.storage.local.get(
            STREAM_SHELL_DISPLAY_MODE_KEY
        );
        override = normalizeDisplayModeOverride(
            stored[STREAM_SHELL_DISPLAY_MODE_KEY]
        );
    } catch {
    }

    const collected = await collectStreamShellDisplays();
    const displays = collected.displays;

    let resolution;

    if (!collected.apiAvailable || !displays.length) {
        resolution = {
            mode: override === "compact" ? "compact" : "wide",
            target: null,
            reason: collected.apiAvailable
                ? "display-list-empty"
                : "display-api-unavailable",
            supportedTarget: false
        };
    } else if (override === "wide" || override === "compact") {
        const target = chooseDisplayForMode(displays, override);
        resolution = {
            mode: override,
            target,
            reason: `override-${override}`,
            supportedTarget: target
                ? (
                    override === "wide"
                        ? isWideDisplayCandidate(target)
                        : isCompactDisplayCandidate(target)
                )
                : false
        };
    } else {
        resolution = chooseAutomaticDisplayProfile(displays);
    }

    const target = resolution.target || null;
    const profile = {
        version: STREAM_SHELL_DISPLAY_PROFILE_VERSION,
        override,
        mode: resolution.mode,
        reason: resolution.reason,
        supportedTarget: resolution.supportedTarget === true,
        apiAvailable: collected.apiAvailable === true,
        displayCount: displays.length,
        targetDisplayId: target?.id || null,
        targetDisplay: target,
        displays,
        plannedLayout: plannedDisplayLayout(
            resolution.mode,
            target
        ),
        compactHostReady: true,
        appliedLayout: resolution.mode === "wide"
            ? "wide-target-panes"
            : "compact-single-surface",
        detectedAt: Date.now()
    };

    profile.appliedGeometry = applyStreamShellDisplayGeometry(profile);
    return profile;
}


function streamShellDisplayProfileSignature(profile) {
    return JSON.stringify({
        override: profile?.override || "auto",
        mode: profile?.mode || null,
        reason: profile?.reason || null,
        supportedTarget: profile?.supportedTarget === true,
        targetDisplayId: profile?.targetDisplayId || null,
        displayCount: Number(profile?.displayCount) || 0,
        bounds: profile?.targetDisplay?.bounds || null,
        displayZoomFactor: profile?.targetDisplay?.displayZoomFactor || null
    });
}


async function refreshStreamShellDisplayProfile(reason = "refresh") {
    const previous = streamShellDisplayProfileCache;
    const next = await resolveStreamShellDisplayProfile();
    streamShellDisplayProfileCache = next;

    if (
        !previous ||
        streamShellDisplayProfileSignature(previous) !==
            streamShellDisplayProfileSignature(next)
    ) {
        recordFlightEvent({
            source: "background",
            category: "display-profile",
            action: previous ? "changed" : "detected",
            level: next.supportedTarget ? "info" : "warn",
            detail: {
                mode: next.mode,
                override: next.override,
                supportedTarget: next.supportedTarget,
                displayCount: next.displayCount,
                targetClass: next.targetDisplay?.targetClass || null,
                referenceTarget: next.targetDisplay?.referenceTarget || null,
                reason
            }
        }).catch(() => {});
    }

    return next;
}


async function getStreamShellDisplayProfile() {
    if (streamShellDisplayProfileCache) {
        return streamShellDisplayProfileCache;
    }

    return refreshStreamShellDisplayProfile("lazy");
}


if (chrome.system?.display?.onDisplayChanged?.addListener) {
    chrome.system.display.onDisplayChanged.addListener(
        () => {
            refreshStreamShellDisplayProfile("display-changed")
                .catch(() => {});
        }
    );
}


chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (
            areaName !== "local" ||
            !Object.prototype.hasOwnProperty.call(
                changes,
                STREAM_SHELL_DISPLAY_MODE_KEY
            )
        ) {
            return;
        }

        refreshStreamShellDisplayProfile("override-changed")
            .catch(() => {});
    }
);
