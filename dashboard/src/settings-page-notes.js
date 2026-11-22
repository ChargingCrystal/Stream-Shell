/* Personal notes belong to one provider/category, with no prefilled content. */
const settingsPageNoteDrafts = new Map();
function appendSettingsNoteText(container, value) {
    // Build DOM nodes, never interpret user notes as HTML.
    const pattern = /(?:https?:\/\/|www\.)[^\s<>]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>]*)?/gi;
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
        container.append(document.createTextNode(value.slice(offset, match.index)));
        const text = match[0];
        const link = document.createElement("a");
        link.textContent = text;
        link.href = /^https?:\/\//i.test(text) ? text : "https://" + text;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        container.append(link);
        offset = match.index + text.length;
    }
    container.append(document.createTextNode(value.slice(offset)));
}
async function mountSettingsPageNote(root, provider, section) {
    const host = root.querySelector("[data-settings-page-note]");
    const edit = root.querySelector("[data-settings-note-edit]");
    const key = "streamShellSettingsPageNote:" + provider + ":" + section;
    let saved = "";
    let editing = false;
    let loading = true;
    edit.disabled = true;
    function preview() {
        editing = false;
        host.replaceChildren();
        host.hidden = !saved.trim();
        if (saved.trim()) appendSettingsNoteText(host, saved);
        edit.setAttribute("aria-expanded", "false");
    }
    function editor() {
        if (loading || editing) return;
        editing = true;
        host.hidden = false;
        host.replaceChildren();
        edit.setAttribute("aria-expanded", "true");
        const field = document.createElement("textarea");
        field.rows = 3;
        field.maxLength = 12000;
        field.setAttribute("aria-label", "Page note");
        field.placeholder = "Your notes and links…";
        field.value = settingsPageNoteDrafts.get(key) ?? saved;
        field.addEventListener("input", () => settingsPageNoteDrafts.set(key, field.value));
        const actions = document.createElement("div");
        actions.className = "settings-note-actions";
        const status = document.createElement("span");
        status.setAttribute("role", "status");
        const save = document.createElement("button");
        save.type = "button"; save.textContent = "Save";
        const cancel = document.createElement("button");
        cancel.type = "button"; cancel.textContent = "Cancel";
        save.addEventListener("click", async () => {
            save.disabled = cancel.disabled = true;
            try {
                const value = field.value;
                await chrome.storage.local.set({[key]: value});
                saved = value;
                settingsPageNoteDrafts.delete(key);
                preview();
            } catch {
                status.textContent = "Could not save. Please try again.";
                save.disabled = cancel.disabled = false;
            }
        });
        cancel.addEventListener("click", () => { settingsPageNoteDrafts.delete(key); preview(); });
        field.addEventListener("keydown", event => {
            if (event.key === "Escape") { event.stopPropagation(); cancel.click(); }
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); save.click(); }
        });
        actions.append(status, cancel, save);
        host.append(field, actions);
        field.focus();
    }
    edit.addEventListener("click", editor);
    try {
        const stored = await chrome.storage.local.get(key);
        if (!host.isConnected) return;
        saved = typeof stored[key] === "string" ? stored[key] : "";
        loading = false; edit.disabled = false;
        preview();
        if (settingsPageNoteDrafts.has(key)) editor();
    } catch {
        edit.title = "Could not load page note. Reopen this category to retry.";
    }
}

