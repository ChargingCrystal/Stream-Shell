
function renderSubscriptionSettingsPage() {
    const entries = streamShellSubscriptionEntries(getStreamShellProviderRegistry(),
        settingsValues[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY]);
    const esc = escapeSettingsHtml;
    const field = (p,key,label,type="text",value=p[key]) =>
        `<label>${label}<input type="${type}" data-subscription-id="${esc(p.id)}"
          data-subscription-field="${key}" value="${esc(value ?? "")}" ${type === "number" ? 'min="0" max="100000" step="0.01"' : ""}></label>`;
    const select = (p,key,label,options) => `<label>${label}<select
        data-subscription-id="${esc(p.id)}" data-subscription-field="${key}">
        ${options.map(([id,name])=>`<option value="${id}" ${p[key]===id?"selected":""}>${name}</option>`).join("")}
        </select></label>`;
    return settingsSubgroup("Subscriptions", `<p>Choose subscriptions independently of Dashboard pins.
        Prices and billing intervals are shared with Finance. YouTube Premium and Music share one entry.
        Automatic sync uses existing provider adapters; custom providers use manual details.</p>
        <div id="subscription-settings-feedback" role="status"></div>` +
        `<div class="subscription-settings-grid">` + entries.map(p=>`<fieldset class="subscription-settings-entry"><legend>${esc(p.name)}</legend>
        <label class="subscription-settings-visible"><span class="settings-switch" style="--settings-accent-rgb:${streamShellProviderAccentRgb(p.id, getStreamShellProviderRegistry())}"><input type="checkbox"
        data-subscription-id="${esc(p.id)}" data-subscription-field="visible" ${p.visible?"checked":""}><span aria-hidden="true"></span></span> Show on Landing</label>
        <div class="subscription-settings-finance">
        <label>Price (EUR)<input type="number" min="0" max="9999999.99" step="0.01"
          data-subscription-finance="amountCents" data-subscription-id="${esc(p.id)}"
          value="${((settingsValues.streamShellSubscriptionFinance?.items?.[p.id]?.amountCents || 0)/100).toFixed(2)}"></label>
        <label>Interval<select data-subscription-finance="cadence" data-subscription-id="${esc(p.id)}">
          <option value="monthly">Monthly</option><option value="yearly" ${settingsValues.streamShellSubscriptionFinance?.items?.[p.id]?.cadence==="yearly"?"selected":""}>Yearly</option></select></label>
        </div>
        <div class="subscription-settings-fields">
        ${select(p,"mode","Data source",p.supported?[["auto",p.id==="discord"?"Automatic (Google Play)":"Automatic"],["manual","Manual"]]:[["manual","Manual"]])}
        ${field(p,"plan","Plan")}
        ${select(p,"status","Manual status",[["unknown","Unknown"],["active","Active"],["ending","Ending"],["inactive","Inactive"]])}
        ${field(p,"date","Next payment / end date","date")}
        ${select(p,"dateKind","Date meaning",[["renews","Renews"],["ends","Ends"]])}
        ${field(p,"url","Billing / account URL","url")}
        </div></fieldset>`).join("") + "</div>");
}
let subscriptionSettingsWriteQueue = Promise.resolve();
document.addEventListener("change", event => {
    const input = event.target.closest?.("[data-subscription-field]");
    if (!input) return;
    const id = input.dataset.subscriptionId, field = input.dataset.subscriptionField;
    const value = field === "visible" ? input.checked : input.value;
    if (field === "url" && value && !streamShellValidatedCustomUrl(value)) {
        input.setCustomValidity("Enter a valid HTTPS URL."); input.reportValidity(); return;
    }
    input.setCustomValidity("");
    subscriptionSettingsWriteQueue = subscriptionSettingsWriteQueue.catch(()=>{}).then(async()=>{
        const stored = await chrome.storage.local.get(STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY);
        const config = {...stored[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY]};
        config[id] = {...config[id], [field]:value};
        await chrome.storage.local.set({[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY]:config});
        settingsValues[STREAM_SHELL_SUBSCRIPTION_CONFIG_KEY] = config;
    }).catch(error=>{
        const feedback = document.querySelector("#subscription-settings-feedback");
        if (feedback) feedback.textContent = "Unable to save: " + error.message;
    });
}, true);

let openingSubscriptionSettings = false;
async function openRequestedSubscriptionSettings() {
    if (openingSubscriptionSettings) return;
    const stored = await chrome.storage.local.get("streamShellOpenSubscriptionSettings");
    if (!stored.streamShellOpenSubscriptionSettings) return;
    openingSubscriptionSettings = true;
    try {
        await openSettingsCenter("general");
        selectSettingsSection("subscriptions");
        await chrome.storage.local.remove("streamShellOpenSubscriptionSettings");
    } finally {openingSubscriptionSettings = false;}
}
chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==="local" && changes.streamShellOpenSubscriptionSettings?.newValue)
        openRequestedSubscriptionSettings().catch(()=>{});
});


function subscriptionFinanceReference(id) {
    const finance = settingsValues.streamShellSubscriptionFinance?.items?.[id];
    if (!finance) return "Price: maintained in the Finance overview.";
    const amount = Number(finance.amountCents);
    if (!Number.isFinite(amount)) return "Price: maintained in the Finance overview.";
    return "Finance: " + escapeSettingsHtml(new Intl.NumberFormat(undefined,
        {style:"currency",currency:"EUR"}).format(amount / 100)) +
        (finance.cadence === "yearly" ? " / year" : " / month");
}
chrome.storage.onChanged.addListener((changes,area)=>{
    if (area !== "local" || !changes.streamShellSubscriptionFinance) return;
    settingsValues.streamShellSubscriptionFinance = changes.streamShellSubscriptionFinance.newValue;
    if (settingsCenterIsOpen() && settingsProvider === "general" && settingsSection === "subscriptions")
        document.querySelectorAll("[data-subscription-finance]").forEach(input=>{
            if (document.activeElement===input) return;
            const item=settingsValues.streamShellSubscriptionFinance?.items?.[input.dataset.subscriptionId] || {};
            input.value=input.dataset.subscriptionFinance==="cadence" ? (item.cadence || "monthly") :
                ((item.amountCents || 0)/100).toFixed(2);
        });
});


document.addEventListener("change",event=>{
    const input=event.target.closest?.("[data-subscription-finance]");
    if(!input)return;
    if(!input.checkValidity()){input.reportValidity();return;}
    const id=input.dataset.subscriptionId, field=input.dataset.subscriptionFinance;
    const value=field==="amountCents"?Math.round(Number(input.value)*100):input.value;
    subscriptionSettingsWriteQueue=subscriptionSettingsWriteQueue.catch(()=>{}).then(async()=>{
        const key="streamShellSubscriptionFinance";
        const stored=await chrome.storage.local.get(key);
        const current=stored[key] || {version:1,items:{}};
        const next={...current,items:{...current.items,[id]:{
            amountCents:0,cadence:"monthly",...current.items?.[id],[field]:value
        }}};
        await chrome.storage.local.set({[key]:next});
        settingsValues[key]=next;
    }).catch(error=>{
        const feedback=document.querySelector("#subscription-settings-feedback");
        if(feedback)feedback.textContent="Unable to save: "+error.message;
    });
},true);
