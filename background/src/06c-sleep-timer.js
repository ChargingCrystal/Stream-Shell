/*
 * ============================================================
 * SLEEP TIMER
 * ============================================================
 * One global timer targets the selected provider tab. Fixed-duration
 * timers use chrome.alarms so they survive service-worker suspension;
 * end-of-video mode is armed inside the provider content script.
 */

const SLEEP_TIMER_SESSION_KEY = "streamShellSleepTimerSession";
const SLEEP_TIMER_ALARM = "stream-shell-sleep-timer";

function normalizeSleepTimerMode(value) {
    const mode = String(value || "off");
    return ["off", "30", "60", "90", "end"].includes(mode)
        ? mode
        : "off";
}

function normalizeSleepTimerAction(value) {
    return value === "dashboard" ? "dashboard" : "pause";
}

async function getSleepTimerSession() {
    try {
        const stored = await chrome.storage.session.get(SLEEP_TIMER_SESSION_KEY);
        const session = stored[SLEEP_TIMER_SESSION_KEY];
        return session && PROVIDERS[session.provider] && Number.isInteger(session.tabId)
            ? session
            : null;
    } catch {
        return null;
    }
}

async function setSleepTimerSession(session) {
    try {
        if (session) {
            await chrome.storage.session.set({ [SLEEP_TIMER_SESSION_KEY]: session });
        } else {
            await chrome.storage.session.remove(SLEEP_TIMER_SESSION_KEY);
        }
    } catch {}
}

async function broadcastSleepTimerState(session = null) {
    try {
        await chrome.runtime.sendMessage({
            type: "sleep-timer-state",
            session
        });
    } catch {}
}

async function getProviderActiveTab(provider) {
    const windows = await getProviderWindows();
    const windowId = windows?.[provider];
    if (!Number.isInteger(windowId)) return null;

    try {
        const tabs = await chrome.tabs.query({ active: true, windowId });
        return tabs[0] || null;
    } catch {
        return null;
    }
}

async function disarmSleepTimerContent(session) {
    if (!session?.tabId || session.mode !== "end") return;
    try {
        await chrome.tabs.sendMessage(session.tabId, {
            type: "stream-shell-sleep-arm",
            armed: false
        });
    } catch {}
}

async function clearSleepTimer(broadcast = true) {
    const session = await getSleepTimerSession();
    try { await chrome.alarms.clear(SLEEP_TIMER_ALARM); } catch {}
    await disarmSleepTimerContent(session);
    await setSleepTimerSession(null);
    if (broadcast) await broadcastSleepTimerState(null);
}

async function executeSleepTimer(session) {
    if (!session) return;

    try {
        await chrome.tabs.sendMessage(session.tabId, {
            type: "stream-shell-sleep-pause"
        });
    } catch {}

    await clearSleepTimer(false);

    if (session.action === "dashboard" && !shuttingDown) {
        try { await showDashboard(); } catch {}
    }

    await broadcastSleepTimerState(null);
}

async function configureSleepTimer(provider, mode, action) {
    const normalizedMode = normalizeSleepTimerMode(mode);
    const normalizedAction = normalizeSleepTimerAction(action);

    await clearSleepTimer(false);

    if (normalizedMode === "off") {
        await broadcastSleepTimerState(null);
        return null;
    }

    const tab = await getProviderActiveTab(provider);
    if (!tab?.id) {
        await broadcastSleepTimerState(null);
        return null;
    }

    const startedAt = Date.now();
    const minutes = Number(normalizedMode);
    const session = {
        provider,
        tabId: tab.id,
        mode: normalizedMode,
        action: normalizedAction,
        startedAt,
        endsAt: Number.isFinite(minutes)
            ? startedAt + minutes * 60_000
            : null
    };

    await setSleepTimerSession(session);

    if (normalizedMode === "end") {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                type: "stream-shell-sleep-arm",
                armed: true
            });
        } catch {}
    } else {
        chrome.alarms.create(SLEEP_TIMER_ALARM, { when: session.endsAt });
    }

    await broadcastSleepTimerState(session);
    return session;
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== SLEEP_TIMER_ALARM) return;
    getSleepTimerSession()
        .then(executeSleepTimer)
        .catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
    getSleepTimerSession().then(session => {
        if (session?.tabId === tabId) return clearSleepTimer();
    }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "sleep-timer-get") {
        getSleepTimerSession()
            .then(session => sendResponse({ ok: true, session }))
            .catch(() => sendResponse({ ok: false, session: null }));
        return true;
    }

    if (message?.type === "sleep-timer-content-ready") {
        getSleepTimerSession()
            .then(session => sendResponse({
                ok: true,
                armed: Boolean(
                    session &&
                    session.mode === "end" &&
                    session.tabId === sender?.tab?.id
                )
            }))
            .catch(() => sendResponse({ ok: false, armed: false }));
        return true;
    }

    if (message?.type === "sleep-timer-set") {
        configureSleepTimer(
            message.provider,
            message.mode,
            message.action
        )
            .then(session => sendResponse({ ok: true, session }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || String(error)
            }));
        return true;
    }

    if (message?.type === "sleep-timer-action") {
        getSleepTimerSession().then(async session => {
            if (!session) {
                sendResponse({ ok: true, session: null });
                return;
            }

            const updated = {
                ...session,
                action: normalizeSleepTimerAction(message.action)
            };
            await setSleepTimerSession(updated);
            await broadcastSleepTimerState(updated);
            sendResponse({ ok: true, session: updated });
        }).catch(error => sendResponse({
            ok: false,
            error: error?.message || String(error)
        }));
        return true;
    }

    if (message?.type === "sleep-timer-ended") {
        getSleepTimerSession().then(async session => {
            if (
                session &&
                session.mode === "end" &&
                session.tabId === sender?.tab?.id
            ) {
                await executeSleepTimer(session);
            }
        }).catch(() => {});
    }
});
