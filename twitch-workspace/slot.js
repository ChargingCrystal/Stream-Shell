(() => {
    const params = new URLSearchParams(location.search);
    const rawSlot = String(params.get("slot") || "").toLowerCase();
    const slotId = ["a", "b", "c", "d"].includes(rawSlot) ? rawSlot : "a";

    const mark = document.getElementById("slot-mark");
    const title = document.getElementById("slot-title");
    const input = document.getElementById("slot-input");
    const error = document.getElementById("slot-error");
    const streamButton = document.getElementById("add-stream");
    const pageButton = document.getElementById("add-page");

    mark.textContent = slotId.toUpperCase();
    title.textContent = `Empty slot ${slotId.toUpperCase()}`;
    document.title = `Stream Shell — Twitch Slot ${slotId.toUpperCase()}`;

    async function assign(kind) {
        const value = String(input.value || "").trim();
        if (!value) {
            error.textContent = "Channel or Twitch URL required.";
            input.focus();
            return;
        }

        error.textContent = "";
        streamButton.disabled = true;
        pageButton.disabled = true;
        try {
            const response = await chrome.runtime.sendMessage({
                type: "twitch-workspace-v2-assign-slot",
                slotId,
                input: value,
                kind
            });
            if (!response?.ok) throw new Error(response?.error || "Could not update this Twitch slot.");
        } catch (err) {
            error.textContent = String(err?.message || err || "Could not update this Twitch slot.");
            streamButton.disabled = false;
            pageButton.disabled = false;
        }
    }

    streamButton.addEventListener("click", () => assign("stream"));
    pageButton.addEventListener("click", () => assign("page"));
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") assign(event.shiftKey ? "page" : "stream");
    });
    setTimeout(() => input.focus(), 80);
})();
