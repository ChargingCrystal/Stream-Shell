/*
 * ============================================================
 * DIAGNOSTICS FLIGHT RECORDER
 * ============================================================
 * Session-scoped structured ringbuffer. The service worker is the single
 * writer so provider pages and Dashboard only submit small event records.
 */
const STREAM_SHELL_FLIGHT_RECORDER_KEY = "streamShellFlightRecorder";
const STREAM_SHELL_FLIGHT_RECORDER_VERSION = 1;
const STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS = 200;

let flightRecorderHydrated = false;
let flightRecorderEvents = [];
let flightRecorderSequence = 0;
let flightRecorderWriteQueue = Promise.resolve();

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

async function hydrateFlightRecorder() {
    if (flightRecorderHydrated) return;
    flightRecorderHydrated = true;

    try {
        const stored = await chrome.storage.session.get(
            STREAM_SHELL_FLIGHT_RECORDER_KEY
        );
        const snapshot = stored[STREAM_SHELL_FLIGHT_RECORDER_KEY];
        if (Array.isArray(snapshot?.events)) {
            flightRecorderEvents = snapshot.events
                .slice(-STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);
        }
    } catch {
        flightRecorderEvents = [];
    }
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

function recordFlightEvent(input = {}) {
    const event = normalizeFlightRecorderEvent(input);

    flightRecorderWriteQueue = flightRecorderWriteQueue
        .then(async () => {
            await hydrateFlightRecorder();
            flightRecorderEvents.push(event);
            flightRecorderEvents = flightRecorderEvents
                .slice(-STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);

            try {
                await chrome.storage.session.set({
                    [STREAM_SHELL_FLIGHT_RECORDER_KEY]: {
                        format: "stream-shell-flight-recorder",
                        version: STREAM_SHELL_FLIGHT_RECORDER_VERSION,
                        maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
                        updatedAt: event.at,
                        events: flightRecorderEvents
                    }
                });
            } catch {
            }
        })
        .catch(() => {});

    return flightRecorderWriteQueue.then(() => event);
}

async function getFlightRecorderSnapshot(limit = null) {
    await flightRecorderWriteQueue;
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
        events
    };
}
