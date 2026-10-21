/*
 * ============================================================
 * DIAGNOSTICS FLIGHT RECORDER
 * ============================================================
 * Session-scoped structured ringbuffer. The service worker is the single
 * writer so provider pages and Dashboard only submit small event records.
 */
const STREAM_SHELL_FLIGHT_RECORDER_KEY = "streamShellFlightRecorder";
const STREAM_SHELL_FLIGHT_RECORDER_VERSION = 1;
const STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS = 80;

let flightRecorderHydrated = false;
let flightRecorderHydration = null;
let flightRecorderEvents = [];
let flightRecorderSequence = 0;
// Bound storage pressure even when Opera/Chromium is busy. Events remain in
// memory immediately; persistence is a coalesced best-effort session snapshot.
const STREAM_SHELL_FLIGHT_RECORDER_FLUSH_MS = 5000;
let flightRecorderFlushTimer = null;
let flightRecorderFlushInFlight = null;
let flightRecorderDirty = false;
let flightRecorderStorageFailures = 0;
let flightRecorderLastFlushAt = null;

function sanitizeFlightRecorderValue(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return value.slice(0, 240);
    if (depth >= 2) return String(value).slice(0, 240);

    if (Array.isArray(value)) {
        return value
            .slice(0, 12)
            .map(item => sanitizeFlightRecorderValue(item, depth + 1));
    }

    if (typeof value === "object") {
        const result = {};
        for (const [key, item] of Object.entries(value).slice(0, 16)) {
            result[String(key).slice(0, 80)] = sanitizeFlightRecorderValue(
                item,
                depth + 1
            );
        }
        return result;
    }

    return String(value).slice(0, 240);
}

function hydrateFlightRecorder() {
    if (flightRecorderHydrated) return Promise.resolve();
    if (flightRecorderHydration) return flightRecorderHydration;

    flightRecorderHydration = (async () => {
        try {
            const stored = await chrome.storage.session.get(
                STREAM_SHELL_FLIGHT_RECORDER_KEY
            );
            const snapshot = stored[STREAM_SHELL_FLIGHT_RECORDER_KEY];
            if (Array.isArray(snapshot?.events)) {
                flightRecorderEvents = snapshot.events
                    .slice(-STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);
            }
        } catch (error) {
            // Storage can be temporarily unavailable during startup. Do not
            // turn diagnostics into a fatal dependency of user interactions.
            console.warn("Stream Shell flight recorder hydration failed:", error);
        } finally {
            flightRecorderHydrated = true;
        }
    })();
    return flightRecorderHydration;
}

function scheduleFlightRecorderFlush() {
    if (flightRecorderFlushTimer !== null || flightRecorderFlushInFlight) return;
    flightRecorderFlushTimer = setTimeout(() => {
        flightRecorderFlushTimer = null;
        void flushFlightRecorder().catch(error => {
            console.warn("Stream Shell flight recorder flush failed:", error);
        });
    }, STREAM_SHELL_FLIGHT_RECORDER_FLUSH_MS);
}

function flushFlightRecorder() {
    if (flightRecorderFlushInFlight) return flightRecorderFlushInFlight;
    if (!flightRecorderDirty) return Promise.resolve();

    flightRecorderDirty = false;
    const updatedAt = flightRecorderEvents.at(-1)?.at || null;
    const payload = {
        format: "stream-shell-flight-recorder",
        version: STREAM_SHELL_FLIGHT_RECORDER_VERSION,
        maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
        updatedAt,
        events: flightRecorderEvents.slice()
    };

    flightRecorderFlushInFlight = Promise.resolve()
        .then(() => chrome.storage.session.set({
            [STREAM_SHELL_FLIGHT_RECORDER_KEY]: payload
        }))
        .then(() => {
            flightRecorderStorageFailures = 0;
            flightRecorderLastFlushAt = Date.now();
        })
        .catch(error => {
            flightRecorderStorageFailures += 1;
            flightRecorderDirty = true;
            if (flightRecorderStorageFailures <= 2 ||
                (flightRecorderStorageFailures & (flightRecorderStorageFailures - 1)) === 0) {
                console.warn("Stream Shell flight recorder storage write failed:", error);
            }
        })
        .finally(() => {
            flightRecorderFlushInFlight = null;
            if (flightRecorderDirty) scheduleFlightRecorderFlush();
        });
    return flightRecorderFlushInFlight;
}

function normalizeFlightRecorderEvent(input = {}) {
    const action = String(input.action || "event").slice(0, 100);
    const source = String(input.source || "background").slice(0, 40);
    const category = String(input.category || "runtime").slice(0, 60);
    const level = ["info", "warn", "error"].includes(input.level)
        ? input.level
        : "info";
    const provider = PROVIDERS[input.provider] ? input.provider : null;
    const at = Date.now();

    return {
        id: `${at.toString(36)}-${(++flightRecorderSequence).toString(36)}`,
        at,
        iso: new Date(at).toISOString(),
        source,
        category,
        action,
        level,
        provider,
        detail: sanitizeFlightRecorderValue(input.detail || {})
    };
}

async function recordFlightEvent(input = {}) {
    const event = normalizeFlightRecorderEvent(input);
    await hydrateFlightRecorder();
    flightRecorderEvents.push(event);
    if (flightRecorderEvents.length > STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS) {
        flightRecorderEvents.splice(0, flightRecorderEvents.length - STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);
    }
    flightRecorderDirty = true;
    scheduleFlightRecorderFlush();
    // Do not make a UI/window transition wait for chrome.storage.session.set().
    return event;
}

async function getFlightRecorderSnapshot(limit = null) {
    await hydrateFlightRecorder();
    const numericLimit = Number(limit);
    const events = Number.isFinite(numericLimit) && numericLimit > 0
        ? flightRecorderEvents.slice(-Math.floor(numericLimit))
        : flightRecorderEvents.slice();

    return {
        format: "stream-shell-flight-recorder",
        version: STREAM_SHELL_FLIGHT_RECORDER_VERSION,
        maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
        count: flightRecorderEvents.length,
        updatedAt: flightRecorderEvents.at(-1)?.at || null,
        persistence: {
            dirty: flightRecorderDirty,
            writePending: Boolean(flightRecorderFlushInFlight),
            lastFlushAt: flightRecorderLastFlushAt,
            storageFailures: flightRecorderStorageFailures
        },
        events
    };
}
