/*
 * Registry-driven subscriptions: configuration is separate from scraped data.
 */
let landingSubscriptionConfig = {};
let landingSubscriptionRegistry = defaultStreamShellProviderRegistry();
let landingSubscriptionState = {};
function getSubscriptionStatus(value) {
    return Object.prototype.hasOwnProperty.call(SUBSCRIPTION_STATUS_LABELS,value) ? value : "unknown";
}
function formatSubscriptionSyncTime(timestamp) {
    return Number.isFinite(timestamp) ? "Updated " + new Intl.DateTimeFormat(undefined,
        {hour:"2-digit",minute:"2-digit"}).format(new Date(timestamp)) : "Never synced";
}
function renderSubscriptionState(state) {
    if (!subscriptionSyncMeta) return;
    landingSubscriptionState = state || {};
    const grid = document.querySelector(".subscription-grid");
    if (!grid) return;
    const entries = streamShellSubscriptionEntries(landingSubscriptionRegistry,landingSubscriptionConfig);
    const visible = entries.filter(p=>p.visible);
    const effective = visible.map(p=>({...p, status:p.mode==="auto" ?
        getSubscriptionStatus(state?.items?.[p.id]?.status) : p.status}));
    grid.replaceChildren(); subscriptionItems.clear();
    for (const p of effective) {
        const data = p.mode==="auto" ? (state?.items?.[p.id] || {}) : {
            status:p.status,renewal:p.date,dateKind:p.dateKind
        };
        const row = document.createElement("div");
        const successAt = data.lastSuccessAt ||
            (["active","ending","inactive"].includes(data.status) ? data.checkedAt : null);
        row.title = p.mode === "auto" ? "Last successful sync: " + formatSubscriptionSyncTime(successAt) : "Manually maintained";
        row.className="subscription-item"; row.dataset.status=p.status;
        row.dataset.subscriptionProvider=p.id;
        const icon = document.createElement("img"); icon.alt="";
        if(p.icon) { icon.src=chrome.runtime.getURL(p.icon); icon.addEventListener("error",()=>{icon.hidden=true;}); }
        else icon.hidden=true;
        const name=document.createElement("span"); name.className="subscription-name";
        name.textContent=p.id==="youtube"?"YouTube":p.id==="prime"?"Prime":p.name; name.title=p.plan || p.name;
        const status=document.createElement("span"); status.className="subscription-status";
        status.textContent=SUBSCRIPTION_STATUS_LABELS[getSubscriptionStatus(p.status)];
        const date=document.createElement("span");date.className="subscription-renewal";
        date.textContent=data.billingSource && data.renewal ? data.billingSource+" · "+data.renewal :
            data.billingSource || data.renewal ||
            (p.status==="verify"?"Verify":p.status==="signin"?"Sign in":p.status==="unknown"?"No data":"—");
        row.append(icon,name,status,date);grid.append(row);subscriptionItems.set(p.id,row);
    }
    if(!visible.length)grid.textContent="Choose subscriptions in Settings → General → Subscriptions.";
    subscriptionSyncMeta.textContent=formatSubscriptionSyncTime(state?.updatedAt);
    subscriptionSyncMeta.title="";
    subscriptionSyncButton.disabled=!visible.some(p=>p.mode==="auto");
}
async function loadSubscriptionState() {
    if (!subscriptionSyncMeta) return;
    const stored=await chrome.storage.local.get([SUBSCRIPTION_STORAGE_KEY,
        STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY,STREAM_SHELL_PROVIDER_REGISTRY_KEY]);
    landingSubscriptionConfig=stored[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY] || {};
    landingSubscriptionRegistry=normalizeStreamShellProviderRegistry(stored[STREAM_SHELL_PROVIDER_REGISTRY_KEY]);
    renderSubscriptionState(stored[SUBSCRIPTION_STORAGE_KEY]);
}
chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==="local" && (changes[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY] ||
        changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY])) loadSubscriptionState().catch(()=>{});
});
async function syncSubscriptions(providerId=null) {
    if(!subscriptionSyncButton || !subscriptionSyncMeta)return;
    subscriptionSyncButton.disabled=true;subscriptionSyncButton.classList.add("syncing");
    subscriptionSyncMeta.textContent="Syncing account pages…";
    try {
        const response=await chrome.runtime.sendMessage({type:"sync-subscriptions",
            providerId:typeof providerId==="string"?providerId:null});
        if(response?.ok===false)throw Error(response.error || "Sync failed");
        await loadSubscriptionState();
    } catch(error) {subscriptionSyncMeta.textContent="Sync failed";subscriptionSyncMeta.title=error.message;}
    finally {subscriptionSyncButton.classList.remove("syncing");subscriptionSyncButton.disabled=false;}
}
