const DIRECT_LINK_STORAGE_KEY = "streamShellDirectLinks";

const pageTitle = document.getElementById("page-title");
const pageHost = document.getElementById("page-host");
const saveButton = document.getElementById("save-page");
const saveLabel = document.getElementById("save-label");
const saveDetail = document.getElementById("save-detail");
const status = document.getElementById("status");

let activeTab = null;
let currentUrl = "";

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function refreshCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  currentUrl = normalizeHttpUrl(activeTab?.url);

  pageTitle.textContent = activeTab?.title || "Current page";

  if (!currentUrl) {
    pageHost.textContent = "This page cannot be saved";
    saveButton.disabled = true;
    saveLabel.textContent = "Save current page";
    saveDetail.textContent = "HTTP/HTTPS pages only";
    return;
  }

  pageHost.textContent = new URL(currentUrl).hostname.replace(/^www\./i, "");
  saveButton.disabled = false;

  const stored = await chrome.storage.local.get(DIRECT_LINK_STORAGE_KEY);
  const items = Array.isArray(stored[DIRECT_LINK_STORAGE_KEY]) ? stored[DIRECT_LINK_STORAGE_KEY] : [];
  const exists = items.some(item => normalizeHttpUrl(item?.url) === currentUrl);

  saveLabel.textContent = exists ? "Update saved link" : "Save current page";
  saveDetail.textContent = exists ? "Refresh title and saved time" : "Add to Direct";
}

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.ok === false) {
    throw new Error(response.error || "Action failed.");
  }
  return response;
}

document.getElementById("open-shell").addEventListener("click", async () => {
  try {
    setStatus("Opening Stream Shell…");
    await send("popup-open-shell");
    window.close();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

saveButton.addEventListener("click", async () => {
  if (!currentUrl) return;

  try {
    saveButton.disabled = true;
    setStatus("Saving…");
    await send("popup-save-direct-link", {
      url: currentUrl,
      title: activeTab?.title || ""
    });
    saveLabel.textContent = "Saved ✓";
    saveDetail.textContent = "Stored locally in Direct";
    setStatus("Saved to Direct.", "success");
    setTimeout(() => window.close(), 650);
  } catch (error) {
    saveButton.disabled = false;
    setStatus(error.message, "error");
  }
});

document.getElementById("open-direct").addEventListener("click", async () => {
  try {
    setStatus("Opening Direct links…");
    await send("popup-open-direct");
    window.close();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

refreshCurrentPage().catch(error => {
  pageTitle.textContent = "Current page unavailable";
  pageHost.textContent = "";
  saveButton.disabled = true;
  setStatus(error.message, "error");
});
