/* Stream Shell offscreen tab-audio router. */

let activeSession = null;

function normalizePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 100;
    return Math.min(600, Math.max(100, numeric));
}

function normalizeProfile(value) {
    const profile = String(value || "normal").toLowerCase();
    return ["normal", "dialogue", "night"].includes(profile)
        ? profile
        : "normal";
}

function disconnectProcessing(session) {
    if (!session) return;

    try { session.source.disconnect(); } catch {}

    for (const node of session.profileNodes || []) {
        try { node.disconnect(); } catch {}
    }

    session.profileNodes = [];
}

function buildProfileNodes(session, profile) {
    const context = session.context;

    if (profile === "dialogue") {
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 105;
        highpass.Q.value = 0.7;

        const presence = context.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 2600;
        presence.Q.value = 0.9;
        presence.gain.value = 4.0;

        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 2.4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.18;

        const trim = context.createGain();
        trim.gain.value = 1.08;

        return [highpass, presence, compressor, trim];
    }

    if (profile === "night") {
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 70;
        highpass.Q.value = 0.65;

        const presence = context.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 2500;
        presence.Q.value = 1.0;
        presence.gain.value = 2.5;

        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -34;
        compressor.knee.value = 24;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        const trim = context.createGain();
        trim.gain.value = 1.16;

        return [highpass, presence, compressor, trim];
    }

    return [];
}

function applyProfile(profile) {
    if (!activeSession) return false;

    const session = activeSession;
    const normalized = normalizeProfile(profile);

    disconnectProcessing(session);

    const nodes = buildProfileNodes(session, normalized);
    session.profileNodes = nodes;
    session.profile = normalized;

    let previous = session.source;
    for (const node of nodes) {
        previous.connect(node);
        previous = node;
    }
    previous.connect(session.gain);

    return true;
}

async function disposeSession(notify = false) {
    const session = activeSession;
    activeSession = null;
    if (!session) return;

    try {
        session.stream.getTracks().forEach(track => {
            try { track.stop(); } catch {}
        });
    } catch {}

    disconnectProcessing(session);
    try { session.gain.disconnect(); } catch {}
    try { await session.context.close(); } catch {}

    if (notify) {
        try {
            await chrome.runtime.sendMessage({
                type: "volume-capture-ended",
                source: "stream-shell-volume-offscreen",
                tabId: session.tabId
            });
        } catch {}
    }
}

async function startSession(message) {
    await disposeSession(false);

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: message.streamId
            }
        },
        video: false
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("AudioContext is unavailable.");
    }

    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();

    gain.gain.value = normalizePercent(message.percent) / 100;
    gain.connect(context.destination);

    const session = {
        tabId: message.tabId,
        provider: message.provider,
        stream,
        context,
        source,
        gain,
        profileNodes: [],
        profile: "normal"
    };

    activeSession = session;
    applyProfile(message.profile);

    if (context.state === "suspended") {
        try { await context.resume(); } catch {}
    }

    const track = stream.getAudioTracks()[0];
    if (track) {
        track.addEventListener("ended", () => {
            if (activeSession === session) {
                disposeSession(true).catch(() => {});
            }
        }, { once: true });
    }
}

function setGain(percent) {
    if (!activeSession) return false;

    const value = normalizePercent(percent) / 100;
    try {
        activeSession.gain.gain.setTargetAtTime(
            value,
            activeSession.context.currentTime,
            0.012
        );
    } catch {
        activeSession.gain.gain.value = value;
    }
    return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== "stream-shell-volume-offscreen") return;

    if (message.type === "volume-capture-start") {
        startSession(message)
            .then(() => sendResponse({ ok: true }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || String(error)
            }));
        return true;
    }

    if (message.type === "volume-capture-stop") {
        disposeSession(false)
            .then(() => sendResponse({ ok: true }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || String(error)
            }));
        return true;
    }

    if (message.type === "volume-capture-set-gain") {
        sendResponse({ ok: setGain(message.percent) });
        return;
    }

    if (message.type === "volume-capture-set-profile") {
        sendResponse({ ok: applyProfile(message.profile) });
    }
});
