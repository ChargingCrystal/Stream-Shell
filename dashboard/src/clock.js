/*
 * ============================================================
 * CLOCK
 * ============================================================
 */

const clockTimeFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }
);

const clockDateFormatter = new Intl.DateTimeFormat(
    "en-GB",
    {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }
);

let clockUpdateTimer = null;

function updateClock() {
    const now = new Date();

    clock.textContent =
        clockTimeFormatter.format(now);

    date.textContent =
        clockDateFormatter.format(now);
}

function scheduleClockUpdate() {
    if (clockUpdateTimer) {
        clearTimeout(clockUpdateTimer);
    }

    updateClock();

    const now = Date.now();
    const delay = 60000 - (now % 60000) + 50;

    clockUpdateTimer = setTimeout(
        scheduleClockUpdate,
        delay
    );
}

scheduleClockUpdate();

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.visibilityState !== "hidden") {
            scheduleClockUpdate();
        }
    }
);
