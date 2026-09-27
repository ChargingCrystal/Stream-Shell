const PROVIDERS =
    new Set([
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll"
    ]);


const MEDIA_TYPE_NAMES = {
    movie:
        "Movie",

    tv:
        "Series"
};


const PROVIDER_NAMES = {
    youtube:
        "YouTube",

    netflix:
        "Netflix",

    prime:
        "Prime Video",

    disney:
        "Disney+",

    crunchyroll:
        "Crunchyroll",

    discord:
        "Discord"
};


const SUBSCRIPTION_STORAGE_KEY =
    "streamShellSubscriptions";


const SUBSCRIPTION_STATUS_LABELS = {
    active:
        "ACTIVE",

    ending:
        "ENDING",

    inactive:
        "INACTIVE",

    signin:
        "SIGN IN",

    verify:
        "VERIFY",

    unknown:
        "UNKNOWN"
};


const WATCHLIST_SORT_KEY =
    "streamShellWatchlistSort";


const PENDING_LANDING_PANEL_KEY =
    "streamShellPendingLandingPanel";


const VALID_WATCHLIST_SORTS =
    new Set([
        "added-desc",
        "added-asc",
        "title-asc",
        "title-desc",
        "release-desc",
        "release-asc"
    ]);


const panorama =
    document.getElementById(
        "panorama-background"
    );


const subscriptionSyncButton =
    document.getElementById(
        "subscription-sync"
    );


const subscriptionSyncMeta =
    document.getElementById(
        "subscription-sync-meta"
    );


const subscriptionItems =
    new Map(
        Array.from(
            document.querySelectorAll(
                "[data-subscription-provider]"
            )
        ).map(
            element => [
                element.dataset.subscriptionProvider,
                element
            ]
        )
    );


const watchlistToggle =
    document.getElementById(
        "watchlist-toggle"
    );


const watchlistCount =
    document.getElementById(
        "watchlist-count"
    );


const watchlistTab =
    document.getElementById(
        "watchlist-tab"
    );


const continueTab =
    document.getElementById(
        "continue-tab"
    );


const recentTab =
    document.getElementById(
        "recent-tab"
    );


const directTab =
    document.getElementById(
        "direct-tab"
    );


const libraryHeaderControls =
    document.getElementById(
        "library-header-controls"
    );


const searchHeaderTitle =
    document.getElementById(
        "search-header-title"
    );


const watchlistImportButton =
    document.getElementById(
        "watchlist-import"
    );


const watchlistExportButton =
    document.getElementById(
        "watchlist-export"
    );


const watchlistImportInput =
    document.getElementById(
        "watchlist-import-input"
    );


const watchlistSortWrapper =
    document.getElementById(
        "watchlist-sort-wrapper"
    );


const watchlistSort =
    document.getElementById(
        "watchlist-sort"
    );


const searchControl =
    document.getElementById(
        "search-control"
    );


const mediaSearchInput =
    document.getElementById(
        "media-search-input"
    );


const mediaSearchClear =
    document.getElementById(
        "media-search-clear"
    );


const mediaPanel =
    document.getElementById(
        "media-panel"
    );


const mediaPanelSubtitle =
    document.getElementById(
        "media-panel-subtitle"
    );


const mediaPanelBody =
    document.getElementById(
        "media-panel-body"
    );


const mediaPanelClose =
    document.getElementById(
        "media-panel-close"
    );


const tmdbTokenButton =
    document.getElementById(
        "tmdb-token-button"
    );


const restoreHomeLayoutButton =
    document.getElementById(
        "restore-home-layout"
    );


const discordButton =
    document.getElementById(
        "discord"
    );

const twitchUtility =
    document.getElementById(
        "twitch-utility"
    );

const twitchOpenButton =
    document.getElementById(
        "twitch-open"
    );

const twitchDropsButton =
    document.getElementById(
        "twitch-drops"
    );


let activePanel =
    null;


let lastLibraryPanel =
    "watchlist";


let watchlistItems =
    [];


let continueWatchingItems =
    [];


let recentItems =
    [];


let directLinkItems =
    [];


let watchlistSortMode =
    "added-desc";


let searchResults =
    [];


let searchTimer =
    null;


let searchGeneration =
    0;


let selectedMediaKey =
    null;


/*
 * ============================================================
 * SUBSCRIPTIONS
 * ============================================================
 */

function getSubscriptionStatus(
    value
) {
    return Object.prototype.hasOwnProperty.call(
        SUBSCRIPTION_STATUS_LABELS,
        value
    )
        ? value
        : "unknown";
}


function formatSubscriptionSyncTime(
    timestamp
) {
    if (
        !Number.isFinite(
            timestamp
        )
    ) {
        return "Never synced";
    }


    try {
        return `Updated ${new Intl.DateTimeFormat(
            undefined,
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        ).format(
            new Date(
                timestamp
            )
        )}`;
    } catch {
        return "Updated";
    }
}


function renderSubscriptionState(
    state
) {
    const items =
        state?.items ||
        {};


    for (
        const [
            provider,
            element
        ] of subscriptionItems
    ) {
        const subscription =
            items[provider] ||
            {};


        const status =
            getSubscriptionStatus(
                subscription.status
            );


        const statusElement =
            element.querySelector(
                ".subscription-status"
            );


        const renewalElement =
            element.querySelector(
                ".subscription-renewal"
            );


        element.dataset.status =
            status;


        statusElement.textContent =
            SUBSCRIPTION_STATUS_LABELS[
                status
            ];


        let renewalText =
            "—";


        const billingSource =
            subscription.billingSource ||
            null;


        if (
            billingSource &&
            subscription.renewal
        ) {
            renewalText =
                `${billingSource} · ${subscription.renewal}`;
        } else if (
            billingSource
        ) {
            renewalText =
                billingSource;
        } else if (
            subscription.renewal
        ) {
            renewalText =
                subscription.renewal;
        } else if (
            status ===
            "verify"
        ) {
            renewalText =
                "Verify";
        } else if (
            status ===
            "signin"
        ) {
            renewalText =
                "Sign in";
        } else if (
            status ===
            "unknown"
        ) {
            renewalText =
                "No data";
        }


        renewalElement.textContent =
            renewalText;


        const dateAction =
            subscription.dateKind ===
                "ends"
                ? "Ends"
                : "Renews";


        const titleParts = [
            PROVIDER_NAMES[provider],
            SUBSCRIPTION_STATUS_LABELS[status]
        ];


        if (
            billingSource
        ) {
            titleParts.push(
                `Billing: ${billingSource}`
            );
        }


        if (
            subscription.renewal
        ) {
            titleParts.push(
                `${dateAction} ${subscription.renewal}`
            );
        }


        element.title =
            titleParts.join(
                " · "
            );
    }


    subscriptionSyncMeta.textContent =
        formatSubscriptionSyncTime(
            state?.updatedAt
        );
}


async function loadSubscriptionState() {
    const stored =
        await chrome.storage.local.get(
            SUBSCRIPTION_STORAGE_KEY
        );


    renderSubscriptionState(
        stored[
            SUBSCRIPTION_STORAGE_KEY
        ]
    );
}


async function syncSubscriptions() {
    subscriptionSyncButton.disabled =
        true;


    subscriptionSyncButton.classList.add(
        "syncing"
    );


    subscriptionSyncMeta.textContent =
        "Syncing account pages…";


    try {
        const response =
            await chrome.runtime.sendMessage({
                type:
                    "sync-subscriptions"
            });


        if (
            response?.ok ===
            false
        ) {
            throw new Error(
                response.error ||
                "Subscription sync failed."
            );
        }


        renderSubscriptionState(
            response?.state
        );
    } catch (error) {
        console.error(
            "Subscription sync failed:",
            error
        );


        subscriptionSyncMeta.textContent =
            "Sync failed";
    } finally {
        subscriptionSyncButton.classList.remove(
            "syncing"
        );


        subscriptionSyncButton.disabled =
            false;
    }
}


(() => {
    "use strict";

    const FINANCE_HOST =
        "com.streamshell.finance";

    const FINANCE_CONFIG_KEY =
        "streamShellSubscriptionFinance";

    const SUBSCRIPTION_KEY =
        "streamShellSubscriptions";

    const PROVIDERS = [
        { id: "youtube", label: "YouTube" },
        { id: "netflix", label: "Netflix" },
        { id: "prime", label: "Prime Video" },
        { id: "disney", label: "Disney+" },
        { id: "crunchyroll", label: "Crunchyroll" },
        { id: "discord", label: "Discord" }
    ];

    const STATUS_LABELS = {
        active: "ACTIVE",
        ending: "ENDING",
        inactive: "INACTIVE",
        signin: "SIGN IN",
        verify: "VERIFY",
        unknown: "UNKNOWN"
    };

    let overlay =
        null;

    let clickCount =
        0;

    let clickResetTimer =
        null;

    let printableReport =
        "";


    function clampCents(value) {
        const number =
            Number(value);

        if (!Number.isFinite(number) || number < 0) {
            return 0;
        }

        return Math.min(
            999999999,
            Math.round(number)
        );
    }


    function normalizeConfig(raw) {
        const result = {
            version: 1,
            items: {}
        };

        for (const provider of PROVIDERS) {
            const item =
                raw?.items?.[provider.id] ||
                {};

            result.items[provider.id] = {
                amountCents:
                    clampCents(item.amountCents),

                cadence:
                    item.cadence === "yearly"
                        ? "yearly"
                        : "monthly"
            };
        }

        return result;
    }


    function normalizeStatus(value) {
        return Object.prototype.hasOwnProperty.call(
            STATUS_LABELS,
            value
        )
            ? value
            : "unknown";
    }


    function statusCode(value) {
        const status =
            normalizeStatus(value);

        if (status === "active") return "A";
        if (status === "ending") return "E";
        if (status === "inactive") return "I";
        return "U";
    }


    function billingCode(value, providerId) {
        const source =
            String(value || "")
                .trim()
                .toLowerCase();

        if (source.includes("google")) {
            return "G";
        }

        if (source) {
            return "D";
        }

        if (
            providerId === "netflix" ||
            providerId === "prime" ||
            providerId === "disney" ||
            providerId === "crunchyroll"
        ) {
            return "D";
        }

        return "O";
    }


    function fixed(value, length) {
        return String(value || "")
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "-")
            .slice(0, length)
            .padEnd(length, " ");
    }


    function buildLedger(subscriptionState, config) {
        const items =
            subscriptionState?.items ||
            {};

        return PROVIDERS.map(
            provider => {
                const subscription =
                    items[provider.id] ||
                    {};

                const finance =
                    config.items[provider.id];

                const amountCents =
                    String(
                        clampCents(finance.amountCents)
                    ).padStart(9, "0");

                return [
                    fixed(provider.id, 12),
                    statusCode(subscription.status),
                    finance.cadence === "yearly" ? "Y" : "M",
                    amountCents,
                    billingCode(subscription.billingSource, provider.id)
                ].join("");
            }
        ).join("\n") + "\n";
    }


    function parseCobolReport(text) {
        const fields = {};
        const printLines = [];
        let inPrintReport = false;

        for (const line of String(text || "").split(/\r?\n/)) {
            const trimmed =
                line.trim();

            if (trimmed === "PRINT_REPORT_BEGIN") {
                inPrintReport = true;
                continue;
            }

            if (trimmed === "PRINT_REPORT_END") {
                inPrintReport = false;
                continue;
            }

            if (inPrintReport) {
                printLines.push(
                    line.replace(/\s+$/, "")
                );
                continue;
            }

            if (!trimmed) {
                continue;
            }

            const separator =
                trimmed.indexOf("=");

            if (separator <= 0) {
                continue;
            }

            fields[
                trimmed.slice(0, separator)
            ] = trimmed.slice(separator + 1);
        }

        return {
            fields,
            printable:
                printLines.length
                    ? printLines.join("\n").replace(/\s+$/, "") + "\n"
                    : ""
        };
    }


    function reportNumber(report, key) {
        const value =
            Number(report?.[key]);

        return Number.isFinite(value)
            ? value
            : 0;
    }


    function formatMoney(cents) {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency: "EUR"
            }
        ).format(
            Number(cents || 0) / 100
        );
    }


    function monthlyEquivalent(item) {
        const cents =
            clampCents(item.amountCents);

        return item.cadence === "yearly"
            ? Math.round(cents / 12)
            : cents;
    }


    function isBillableStatus(status) {
        return status === "active" ||
            status === "ending";
    }


    function getSubscriptionSummary(subscription) {
        const parts = [];

        if (subscription?.billingSource) {
            parts.push(subscription.billingSource);
        }

        if (subscription?.renewal) {
            parts.push(subscription.renewal);
        }

        return parts.length
            ? parts.join(" · ")
            : "No billing metadata";
    }


    async function loadFinanceState() {
        const stored =
            await chrome.storage.local.get([
                SUBSCRIPTION_KEY,
                FINANCE_CONFIG_KEY
            ]);

        return {
            subscriptions:
                stored[SUBSCRIPTION_KEY] ||
                { items: {} },

            config:
                normalizeConfig(
                    stored[FINANCE_CONFIG_KEY]
                )
        };
    }


    async function saveFinanceConfig(config) {
        await chrome.storage.local.set({
            [FINANCE_CONFIG_KEY]:
                normalizeConfig(config)
        });
    }


    function encodeBase64(value) {
        const bytes =
            new TextEncoder().encode(
                value
            );

        let binary = "";

        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }

        return btoa(binary);
    }


    function decodeBase64(value) {
        const binary =
            atob(value || "");

        const bytes =
            Uint8Array.from(
                binary,
                character =>
                    character.charCodeAt(0)
            );

        return new TextDecoder().decode(
            bytes
        );
    }


    async function runCobolReconciliation(
        subscriptions,
        config
    ) {
        const ledger =
            buildLedger(
                subscriptions,
                config
            );

        const response =
            await chrome.runtime.sendNativeMessage(
                FINANCE_HOST,
                {
                    action:
                        "reconcile",

                    recordsBase64:
                        encodeBase64(ledger)
                }
            );

        if (!response?.ok) {
            throw new Error(
                response?.error ||
                "COBOL finance host returned no result."
            );
        }

        return parseCobolReport(
            decodeBase64(
                response.reportBase64
            )
        );
    }


    function setPrintReport(value) {
        printableReport =
            String(value || "");

        const button =
            overlay?.querySelector(
                "#finance-print"
            );

        if (button) {
            button.disabled =
                !printableReport.trim();
        }
    }


    function markReportDirty() {
        setPrintReport(
            ""
        );

        const status =
            overlay?.querySelector(
                "#finance-engine-status"
            );

        if (status) {
            status.removeAttribute(
                "data-ok"
            );

            status.textContent =
                "INPUT CHANGED · RECONCILE REQUIRED";
        }
    }


    function printFinancialReport() {
        if (!printableReport.trim()) {
            return;
        }

        const existing =
            document.querySelector(
                ".finance-print-report"
            );

        existing?.remove();

        const report =
            document.createElement("pre");

        report.className =
            "finance-print-report";

        report.textContent =
            printableReport;

        document.body.append(
            report
        );

        const cleanup = () => {
            report.remove();
            window.removeEventListener(
                "afterprint",
                cleanup
            );
        };

        window.addEventListener(
            "afterprint",
            cleanup
        );

        window.print();
    }


    function createMetric(label, value, id) {
        const element =
            document.createElement("div");

        element.className =
            "finance-metric";

        const labelElement =
            document.createElement("span");

        labelElement.className =
            "finance-metric-label";

        labelElement.textContent =
            label;

        const valueElement =
            document.createElement("strong");

        valueElement.className =
            "finance-metric-value";

        if (id) {
            valueElement.id =
                id;
        }

        valueElement.textContent =
            value;

        element.append(
            labelElement,
            valueElement
        );

        return element;
    }


    function createProviderRow(
        provider,
        subscription,
        finance
    ) {
        const row =
            document.createElement("div");

        row.className =
            "finance-provider-row";

        row.dataset.provider =
            provider.id;

        const identity =
            document.createElement("div");

        identity.className =
            "finance-provider-identity";

        const name =
            document.createElement("strong");

        name.textContent =
            provider.label;

        const meta =
            document.createElement("span");

        meta.textContent =
            getSubscriptionSummary(
                subscription
            );

        identity.append(
            name,
            meta
        );

        const status =
            document.createElement("span");

        const normalizedStatus =
            normalizeStatus(
                subscription?.status
            );

        status.className =
            "finance-provider-status";

        status.dataset.status =
            normalizedStatus;

        status.textContent =
            STATUS_LABELS[
                normalizedStatus
            ];

        const amountWrap =
            document.createElement("label");

        amountWrap.className =
            "finance-money-input";

        const currency =
            document.createElement("span");

        currency.textContent =
            "€";

        const amount =
            document.createElement("input");

        amount.type =
            "number";

        amount.min =
            "0";

        amount.step =
            "0.01";

        amount.inputMode =
            "decimal";

        amount.value =
            (
                finance.amountCents /
                100
            ).toFixed(2);

        amount.dataset.financeAmount =
            provider.id;

        amount.addEventListener(
            "input",
            markReportDirty
        );

        amountWrap.append(
            currency,
            amount
        );

        const cadence =
            document.createElement("select");

        cadence.className =
            "finance-cadence";

        cadence.dataset.financeCadence =
            provider.id;

        cadence.innerHTML =
            '<option value="monthly">Monthly</option><option value="yearly">Yearly</option>';

        cadence.value =
            finance.cadence;

        cadence.addEventListener(
            "change",
            markReportDirty
        );

        const monthly =
            document.createElement("span");

        monthly.className =
            "finance-monthly-equivalent";

        monthly.dataset.financeMonthly =
            provider.id;

        monthly.textContent =
            isBillableStatus(normalizedStatus)
                ? formatMoney(
                    monthlyEquivalent(finance)
                )
                : "Excluded";

        row.append(
            identity,
            status,
            amountWrap,
            cadence,
            monthly
        );

        return row;
    }


    function readConfigFromOverlay(baseConfig) {
        const config =
            normalizeConfig(
                baseConfig
            );

        for (const provider of PROVIDERS) {
            const amount =
                overlay?.querySelector(
                    `[data-finance-amount="${provider.id}"]`
                );

            const cadence =
                overlay?.querySelector(
                    `[data-finance-cadence="${provider.id}"]`
                );

            config.items[provider.id] = {
                amountCents:
                    clampCents(
                        Number(amount?.value || 0) *
                        100
                    ),

                cadence:
                    cadence?.value === "yearly"
                        ? "yearly"
                        : "monthly"
            };
        }

        return config;
    }


    function renderReport(report) {
        const status =
            overlay?.querySelector(
                "#finance-engine-status"
            );

        if (status) {
            status.textContent =
                report?.STATUS === "OK"
                    ? "RECONCILIATION STATUS: OK · COBOL"
                    : `RECONCILIATION STATUS: ${report?.STATUS || "UNKNOWN"}`;

            status.dataset.ok =
                report?.STATUS === "OK"
                    ? "true"
                    : "false";
        }

        const otherCents =
            reportNumber(
                report,
                "OTHER_CENTS"
            );

        const updates = {
            "finance-active-count":
                String(reportNumber(report, "ACTIVE")),

            "finance-ending-count":
                String(reportNumber(report, "ENDING")),

            "finance-monthly-total":
                formatMoney(
                    reportNumber(
                        report,
                        "MONTHLY_CENTS"
                    )
                ),

            "finance-annual-total":
                formatMoney(
                    reportNumber(
                        report,
                        "ANNUAL_CENTS"
                    )
                ),

            "finance-direct-total":
                formatMoney(
                    reportNumber(
                        report,
                        "DIRECT_CENTS"
                    )
                ),

            "finance-google-total":
                formatMoney(
                    reportNumber(
                        report,
                        "GOOGLE_CENTS"
                    )
                ),

            "finance-other-total":
                formatMoney(
                    otherCents
                )
        };

        for (const [id, value] of Object.entries(updates)) {
            const element =
                overlay?.querySelector(
                    `#${id}`
                );

            if (element) {
                element.textContent =
                    value;
            }
        }

        const otherLabel =
            overlay?.querySelector(
                "#finance-other-label"
            );

        const otherTotal =
            overlay?.querySelector(
                "#finance-other-total"
            );

        const hideOther =
            otherCents === 0;

        if (otherLabel) {
            otherLabel.hidden =
                hideOther;
        }

        if (otherTotal) {
            otherTotal.hidden =
                hideOther;
        }
    }


    function renderEngineError(error) {
        const status =
            overlay?.querySelector(
                "#finance-engine-status"
            );

        if (!status) {
            return;
        }

        status.dataset.ok =
            "false";

        status.textContent =
            `COBOL ENGINE UNAVAILABLE · ${error?.message || error}`;
    }


    async function reconcile(
        subscriptions,
        baseConfig
    ) {
        const button =
            overlay?.querySelector(
                "#finance-reconcile"
            );

        const config =
            readConfigFromOverlay(
                baseConfig
            );

        await saveFinanceConfig(
            config
        );

        for (const provider of PROVIDERS) {
            const subscription =
                subscriptions?.items?.[provider.id] ||
                {};

            const monthly =
                overlay?.querySelector(
                    `[data-finance-monthly="${provider.id}"]`
                );

            if (monthly) {
                monthly.textContent =
                    isBillableStatus(
                        normalizeStatus(
                            subscription.status
                        )
                    )
                        ? formatMoney(
                            monthlyEquivalent(
                                config.items[provider.id]
                            )
                        )
                        : "Excluded";
            }
        }

        if (button) {
            button.disabled =
                true;

            button.textContent =
                "RECONCILING…";
        }

        const status =
            overlay?.querySelector(
                "#finance-engine-status"
            );

        if (status) {
            status.removeAttribute(
                "data-ok"
            );

            status.textContent =
                "COBOL ENGINE: PROCESSING LEDGER…";
        }

        try {
            const result =
                await runCobolReconciliation(
                    subscriptions,
                    config
                );

            renderReport(
                result.fields
            );

            setPrintReport(
                result.printable
            );
        } catch (error) {
            setPrintReport(
                ""
            );
            console.error(
                "COBOL finance reconciliation failed:",
                error
            );

            renderEngineError(
                error
            );
        } finally {
            if (button) {
                button.disabled =
                    false;

                button.textContent =
                    "RECONCILE";
            }
        }
    }


    function closeFinanceDashboard() {
        overlay?.remove();
        overlay =
            null;

        printableReport =
            "";
    }


    async function openFinanceDashboard() {
        if (overlay) {
            return;
        }

        const state =
            await loadFinanceState();

        overlay =
            document.createElement("section");

        overlay.className =
            "finance-operations-overlay";

        overlay.setAttribute(
            "role",
            "dialog"
        );

        overlay.setAttribute(
            "aria-modal",
            "true"
        );

        const shell =
            document.createElement("div");

        shell.className =
            "finance-operations-shell";

        const header =
            document.createElement("header");

        header.className =
            "finance-operations-header";

        const heading =
            document.createElement("div");

        heading.innerHTML =
            '<div class="finance-kicker">STREAM SHELL FINANCIAL OPERATIONS</div>' +
            '<h2>Subscription Exposure Report</h2>' +
            '<div id="finance-engine-status" class="finance-engine-status">COBOL ENGINE: READY</div>';

        const close =
            document.createElement("button");

        close.type =
            "button";

        close.className =
            "finance-close";

        close.title =
            "Close financial operations";

        close.setAttribute(
            "aria-label",
            "Close financial operations"
        );

        close.textContent =
            "×";

        close.addEventListener(
            "click",
            closeFinanceDashboard
        );

        header.append(
            heading,
            close
        );

        const metrics =
            document.createElement("div");

        metrics.className =
            "finance-metrics";

        metrics.append(
            createMetric("Active services", "—", "finance-active-count"),
            createMetric("Ending services", "—", "finance-ending-count"),
            createMetric("Monthly run rate", "—", "finance-monthly-total"),
            createMetric("Annualized expenditure", "—", "finance-annual-total")
        );

        const providerSection =
            document.createElement("section");

        providerSection.className =
            "finance-provider-section";

        const providerHeader =
            document.createElement("div");

        providerHeader.className =
            "finance-provider-header finance-provider-row";

        providerHeader.innerHTML =
            "<span>Service</span><span>Status</span><span>Amount</span><span>Cadence</span><span>Monthly</span>";

        const providerRows =
            document.createElement("div");

        providerRows.className =
            "finance-provider-rows";

        for (const provider of PROVIDERS) {
            providerRows.append(
                createProviderRow(
                    provider,
                    state.subscriptions?.items?.[provider.id] || {},
                    state.config.items[provider.id]
                )
            );
        }

        providerSection.append(
            providerHeader,
            providerRows
        );

        const exposure =
            document.createElement("section");

        exposure.className =
            "finance-exposure";

        exposure.innerHTML =
            '<div class="finance-exposure-title">Monthly billing exposure</div>' +
            '<div class="finance-exposure-grid">' +
                '<span>Direct</span><strong id="finance-direct-total">—</strong>' +
                '<span>Google Play</span><strong id="finance-google-total">—</strong>' +
                '<span id="finance-other-label">Other / unknown</span><strong id="finance-other-total">—</strong>' +
            '</div>';

        const footer =
            document.createElement("footer");

        footer.className =
            "finance-operations-footer";

        const note =
            document.createElement("span");

        note.textContent =
            "Prices are stored locally. ACTIVE and ENDING services are included in exposure. Print output is generated by COBOL.";

        const actions =
            document.createElement("div");

        actions.className =
            "finance-operations-actions";

        const printButton =
            document.createElement("button");

        printButton.type =
            "button";

        printButton.id =
            "finance-print";

        printButton.className =
            "finance-print";

        printButton.textContent =
            "PRINT REPORT";

        printButton.disabled =
            true;

        printButton.addEventListener(
            "click",
            printFinancialReport
        );

        const reconcileButton =
            document.createElement("button");

        reconcileButton.type =
            "button";

        reconcileButton.id =
            "finance-reconcile";

        reconcileButton.className =
            "finance-reconcile";

        reconcileButton.textContent =
            "RECONCILE";

        reconcileButton.addEventListener(
            "click",
            () => {
                reconcile(
                    state.subscriptions,
                    state.config
                ).catch(
                    renderEngineError
                );
            }
        );

        actions.append(
            printButton,
            reconcileButton
        );

        footer.append(
            note,
            actions
        );

        shell.append(
            header,
            metrics,
            providerSection,
            exposure,
            footer
        );

        overlay.append(
            shell
        );

        document.body.append(
            overlay
        );

        const firstInput =
            overlay.querySelector(
                "input"
            );

        firstInput?.focus();

        const hasSavedValues =
            PROVIDERS.some(
                provider =>
                    state.config.items[provider.id].amountCents > 0
            );

        if (hasSavedValues) {
            reconcile(
                state.subscriptions,
                state.config
            ).catch(
                renderEngineError
            );
        }
    }


    function installFinanceStylesheet() {
        if (
            document.querySelector(
                'link[data-stream-shell-finance-style]'
            )
        ) {
            return;
        }

        const link =
            document.createElement("link");

        link.rel =
            "stylesheet";

        link.href =
            chrome.runtime.getURL(
                "landing/finance.css"
            );

        link.dataset.streamShellFinanceStyle =
            "true";

        document.head.append(
            link
        );
    }


    function installSecretTrigger() {
        const title =
            document.querySelector(
                ".subscription-panel-title"
            );

        if (!title) {
            return;
        }

        title.addEventListener(
            "click",
            () => {
                clickCount += 1;

                clearTimeout(
                    clickResetTimer
                );

                if (clickCount >= 5) {
                    clickCount =
                        0;

                    openFinanceDashboard()
                        .catch(
                            error => {
                                console.error(
                                    "Finance dashboard failed:",
                                    error
                                );
                            }
                        );

                    return;
                }

                clickResetTimer =
                    setTimeout(
                        () => {
                            clickCount =
                                0;
                        },
                        2200
                    );
            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                overlay
            ) {
                closeFinanceDashboard();
            }
        }
    );


    installFinanceStylesheet();
    installSecretTrigger();
})();
/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getMediaKey(
    media
) {
    return `${media.mediaType}:${media.id}`;
}


function createElement(
    tagName,
    className = "",
    text = ""
) {
    const element =
        document.createElement(
            tagName
        );


    if (
        className
    ) {
        element.className =
            className;
    }


    if (
        text
    ) {
        element.textContent =
            text;
    }


    return element;
}


function createSvgElement(
    name,
    attributes = {}
) {
    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );


    for (
        const [key, value]
        of Object.entries(
            attributes
        )
    ) {
        element.setAttribute(
            key,
            String(
                value
            )
        );
    }


    return element;
}


function createBookmarkIcon() {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M6 3.75C6 2.78 6.78 2 7.75 2H16.25C17.22 2 18 2.78 18 3.75V21L12 17.25L6 21Z",

                fill:
                    "none",

                stroke:
                    "currentColor",

                "stroke-width":
                    "1.7",

                "stroke-linejoin":
                    "round"
            }
        )
    );


    return svg;
}


function createRefreshIcon() {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M19 8.5A7.5 7.5 0 1 0 19.2 15"
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M19 4.5V8.5H15"
            }
        )
    );


    return svg;
}


function formatReleaseDate(
    media
) {
    const raw =
        String(
            media.releaseDate ||
            ""
        );


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            raw
        )
    ) {
        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric"
            }
        ).format(
            new Date(
                `${raw}T00:00:00`
            )
        );
    }


    return media.year ||
        "Unknown";
}


function formatDateTime(
    timestamp
) {
    const value =
        Number(
            timestamp
        );


    if (
        !value
    ) {
        return "Unknown";
    }


    return new Intl.DateTimeFormat(
        "en-GB",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(
        new Date(
            value
        )
    );
}


function getReleaseSortValue(
    media
) {
    const raw =
        String(
            media.releaseDate ||
            ""
        );


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            raw
        )
    ) {
        return Date.parse(
            `${raw}T00:00:00`
        ) ||
        0;
    }


    return Number(
        media.year
    ) ||
    0;
}


function getSortedWatchlistItems() {
    const items = [
        ...watchlistItems
    ];


    switch (
        watchlistSortMode
    ) {
        case "added-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        a.addedAt
                    ) -
                    Number(
                        b.addedAt
                    )
            );


        case "title-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a.title ||
                        ""
                    ).localeCompare(
                        String(
                            b.title ||
                            ""
                        ),
                        "en",
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );


        case "title-desc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    String(
                        b.title ||
                        ""
                    ).localeCompare(
                        String(
                            a.title ||
                            ""
                        ),
                        "en",
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );


        case "release-desc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    getReleaseSortValue(
                        b
                    ) -
                    getReleaseSortValue(
                        a
                    )
            );


        case "release-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    getReleaseSortValue(
                        a
                    ) -
                    getReleaseSortValue(
                        b
                    )
            );


        case "added-desc":
        default:

            return items.sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.addedAt
                    ) -
                    Number(
                        a.addedAt
                    )
            );
    }
}


/*
 * ============================================================
 * PANEL
 * ============================================================
 */

function renderPanelMessage(
    title,
    text,
    {
        icon = "—",
        error = false
    } = {}
) {
    mediaPanelBody.replaceChildren();


    const wrapper =
        createElement(
            "div",
            `panel-message${
                error
                    ? " error"
                    : ""
            }`
        );


    const inner =
        createElement(
            "div",
            "panel-message-inner"
        );


    inner.append(
        createElement(
            "div",
            "panel-message-icon",
            icon
        ),

        createElement(
            "div",
            "panel-message-title",
            title
        ),

        createElement(
            "div",
            "panel-message-text",
            text
        )
    );


    wrapper.appendChild(
        inner
    );


    mediaPanelBody.appendChild(
        wrapper
    );
}


function updatePanelControls() {
    const libraryOpen =
        !mediaPanel.hidden &&
        (
            activePanel ===
                "watchlist" ||
            activePanel ===
                "continue" ||
            activePanel ===
                "recent" ||
            activePanel ===
                "direct"
        );


    const searchOpen =
        !mediaPanel.hidden &&
        activePanel ===
            "search";


    watchlistToggle.classList.toggle(
        "active",
        libraryOpen
    );


    searchControl.classList.toggle(
        "active",
        searchOpen
    );


    watchlistToggle.setAttribute(
        "aria-expanded",
        String(
            libraryOpen
        )
    );


    libraryHeaderControls.hidden =
        !libraryOpen;


    searchHeaderTitle.hidden =
        !searchOpen;


    watchlistSortWrapper.hidden =
        activePanel !==
            "watchlist" ||
        mediaPanel.hidden;


    watchlistTab.classList.toggle(
        "active",
        activePanel ===
            "watchlist"
    );


    continueTab.classList.toggle(
        "active",
        activePanel ===
            "continue"
    );


    recentTab.classList.toggle(
        "active",
        activePanel ===
            "recent"
    );


    directTab.classList.toggle(
        "active",
        activePanel ===
            "direct"
    );
}


function openPanel(
    mode
) {
    activePanel =
        mode;


    if (
        mode ===
            "watchlist" ||
        mode ===
            "continue" ||
        mode ===
            "recent" ||
        mode ===
            "direct"
    ) {
        lastLibraryPanel =
            mode;
    }


    mediaPanel.hidden =
        false;


    updatePanelControls();
}


function closePanel() {
    mediaPanel.hidden =
        true;


    activePanel =
        null;


    updatePanelControls();
}


/*
 * ============================================================
 * SORTING
 * ============================================================
 */

async function loadWatchlistSortPreference() {
    const stored =
        await chrome.storage.local.get(
            WATCHLIST_SORT_KEY
        );


    const value =
        stored[
            WATCHLIST_SORT_KEY
        ];


    if (
        VALID_WATCHLIST_SORTS.has(
            value
        )
    ) {
        watchlistSortMode =
            value;
    }


    watchlistSort.value =
        watchlistSortMode;
}


async function saveWatchlistSortPreference(
    value
) {
    if (
        !VALID_WATCHLIST_SORTS.has(
            value
        )
    ) {
        return;
    }


    watchlistSortMode =
        value;


    watchlistSort.value =
        value;


    await chrome.storage.local.set({
        [WATCHLIST_SORT_KEY]:
            value
    });
}


/*
 * ============================================================
 * TOKEN
 * ============================================================
 */

async function renderTokenSetup(
    afterSave = null
) {
    searchHeaderTitle.textContent =
        "Connect TMDB";


    mediaPanelSubtitle.textContent =
        "Save your Read Access Token once";


    mediaPanelBody.replaceChildren();


    const wrapper =
        createElement(
            "div",
            "token-setup"
        );


    const card =
        createElement(
            "div",
            "token-setup-card"
        );


    const title =
        createElement(
            "div",
            "token-setup-title",
            "TMDB Read Access Token"
        );


    const text =
        createElement(
            "div",
            "token-setup-text",
            "Stream Shell uses TMDB for titles, metadata and JustWatch streaming availability. The token is stored locally in chrome.storage."
        );


    const row =
        createElement(
            "div",
            "token-input-row"
        );


    const input =
        createElement(
            "input",
            "tmdb-token-input"
        );


    input.type =
        "password";


    input.placeholder =
        "eyJhbGciOiJIUzI1NiJ9...";


    input.autocomplete =
        "off";


    const saveButton =
        createElement(
            "button",
            "tmdb-token-save",
            "Save"
        );


    saveButton.type =
        "button";


    const status =
        createElement(
            "div",
            "token-setup-status"
        );


    row.append(
        input,
        saveButton
    );


    card.append(
        title,
        text,
        row,
        status
    );


    wrapper.appendChild(
        card
    );


    mediaPanelBody.appendChild(
        wrapper
    );


    async function save() {
        const token =
            input.value.trim();


        if (
            !token
        ) {
            status.className =
                "token-setup-status error";


            status.textContent =
                "Paste a token first.";


            return;
        }


        saveButton.disabled =
            true;


        status.className =
            "token-setup-status";


        status.textContent =
            "Validating token...";


        try {
            await window
                .StreamShellMediaApi
                .saveToken(
                    token
                );


            status.className =
                "token-setup-status success";


            status.textContent =
                "Token validated and stored locally.";


            if (
                typeof afterSave ===
                "function"
            ) {
                setTimeout(
                    afterSave,
                    280
                );
            }

        } catch (error) {

            console.error(
                "TMDB token validation failed:",
                error
            );


            status.className =
                "token-setup-status error";


            status.textContent =
                error?.code ===
                    "TMDB_TOKEN_INVALID"
                    ? "TMDB rejected this token."
                    : "The token could not be validated.";

        } finally {

            saveButton.disabled =
                false;
        }
    }


    saveButton.addEventListener(
        "click",
        save
    );


    input.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                save();
            }
        }
    );


    input.focus();
}


/*
 * ============================================================
 * AVAILABILITY
 * ============================================================
 */

function renderProviderState(
    container,
    availability
) {
    container.replaceChildren();


    if (
        !availability
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-loading",
                "Checking streaming providers..."
            )
        );

        return;
    }


    if (
        availability.error ===
        "token"
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-error",
                "TMDB access required"
            )
        );

        return;
    }


    if (
        availability.error
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-error",
                "Availability could not be loaded"
            )
        );

        return;
    }


    if (
        !availability.regionAvailable ||
        availability.providers.length ===
            0
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-none",
                "No current provider found"
            )
        );

        return;
    }


    for (
        const provider
        of availability.providers
    ) {
        const chip =
            createElement(
                "span",
                "provider-chip"
            );


        chip.appendChild(
            createElement(
                "span",
                "provider-chip-name",
                provider.name
            )
        );


        if (
            provider.modeLabels.length >
            0
        ) {
            chip.appendChild(
                createElement(
                    "span",
                    "provider-chip-mode",
                    provider
                        .modeLabels
                        .join("/")
                )
            );
        }


        container.appendChild(
            chip
        );
    }
}


async function loadAvailabilityIntoRow(
    row,
    media,
    generation = null,
    force = false
) {
    const providerContainer =
        row.querySelector(
            ".media-item-providers"
        );


    const refreshButton =
        row.querySelector(
            ".media-item-refresh"
        );


    if (
        !providerContainer
    ) {
        return null;
    }


    renderProviderState(
        providerContainer,
        null
    );


    refreshButton
        ?.classList
        .add(
            "loading"
        );


    try {
        const availability =
            force
                ? await window
                    .StreamShellAvailability
                    .refreshAvailability(
                        media
                    )
                : await window
                    .StreamShellAvailability
                    .getAvailability(
                        media
                    );


        if (
            generation !==
                null &&
            generation !==
                searchGeneration
        ) {
            return null;
        }


        if (
            !row.isConnected
        ) {
            return null;
        }


        renderProviderState(
            providerContainer,
            availability
        );


        row.__streamShellAvailability =
            availability;


        if (
            force &&
            selectedMediaKey ===
                getMediaKey(
                    media
                )
        ) {
            await window
                .StreamShellAvailability
                .selectMedia(
                    media,
                    availability
                );
        }


        return availability;

    } catch (error) {

        console.error(
            "Availability lookup failed:",
            error
        );


        if (
            generation !==
                null &&
            generation !==
                searchGeneration
        ) {
            return null;
        }


        const errorState = {
            error:
                (
                    error?.code ===
                        "TMDB_TOKEN_MISSING" ||
                    error?.code ===
                        "TMDB_TOKEN_INVALID"
                )
                    ? "token"
                    : "generic"
        };


        if (
            row.isConnected
        ) {
            renderProviderState(
                providerContainer,
                errorState
            );


            row.__streamShellAvailability =
                errorState;
        }


        return errorState;

    } finally {

        refreshButton
            ?.classList
            .remove(
                "loading"
            );
    }
}


/*
 * ============================================================
 * MEDIA ITEMS
 * ============================================================
 */

function createMediaItem(
    media,
    {
        mode,
        saved = false,
        addedAt = null,
        openedAt = null,
        openedProvider = "",
        generation = null
    }
) {
    const key =
        getMediaKey(
            media
        );


    const row =
        createElement(
            "article",
            "media-item"
        );


    row.dataset.mediaKey =
        key;


    row.classList.toggle(
        "selected",
        key ===
            selectedMediaKey
    );


    /*
     * Refresh button left of title.
     */

    const refresh =
        createElement(
            "button",
            "media-item-refresh"
        );


    refresh.type =
        "button";


    refresh.dataset.refreshAvailability =
        key;


    refresh.title =
        "Refresh availability";


    refresh.setAttribute(
        "aria-label",
        `Refresh availability for ${media.title}`
    );


    refresh.appendChild(
        createRefreshIcon()
    );


    /*
     * Main title area.
     */

    const main =
        createElement(
            "button",
            "media-item-main"
        );


    main.type =
        "button";


    main.dataset.selectMedia =
        key;


    const titleRow =
        createElement(
            "div",
            "media-item-title-row"
        );


    titleRow.append(
        createElement(
            "span",
            "media-item-title",
            media.title
        ),

        createElement(
            "span",
            "media-item-type",
            MEDIA_TYPE_NAMES[
                media.mediaType
            ] ||
            media.mediaType
        )
    );


    const meta =
        createElement(
            "div",
            "media-item-meta"
        );


    if (
        mode ===
        "watchlist"
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                `Added ${formatDateTime(
                    addedAt
                )}`
            )
        );


        if (
            media.releaseDate ||
            media.year
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `Released ${formatReleaseDate(
                        media
                    )}`
                )
            );
        }

    } else if (
        mode ===
        "recent"
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                `Opened ${formatDateTime(
                    openedAt
                )}`
            )
        );


        if (
            openedProvider
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `via ${
                        PROVIDER_NAMES[
                            openedProvider
                        ] ||
                        openedProvider
                    }`
                )
            );
        }


        if (
            media.releaseDate ||
            media.year
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `Released ${formatReleaseDate(
                        media
                    )}`
                )
            );
        }

    } else {

        meta.appendChild(
            createElement(
                "span",
                "",
                `Released ${formatReleaseDate(
                    media
                )}`
            )
        );


        if (
            Number.isFinite(
                media.rating
            ) &&
            media.rating >
                0
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `TMDB ${media.rating.toFixed(
                        1
                    )}`
                )
            );
        }
    }


    main.append(
        titleRow,
        meta
    );


    if (
        media.originalTitle &&
        media.originalTitle !==
            media.title
    ) {
        main.appendChild(
            createElement(
                "div",
                "media-item-original",
                media.originalTitle
            )
        );
    }


    const providers =
        createElement(
            "div",
            "media-item-providers"
        );


    main.appendChild(
        providers
    );


    /*
     * Right actions.
     */

    const actions =
        createElement(
            "div",
            "media-item-actions"
        );


    if (
        mode ===
        "search"
    ) {
        const bookmark =
            createElement(
                "button",
                `media-item-action${
                    saved
                        ? " saved"
                        : ""
                }`
            );


        bookmark.type =
            "button";


        bookmark.dataset.toggleWatchlist =
            key;


        bookmark.title =
            saved
                ? "Remove from Watchlist"
                : "Add to Watchlist";


        bookmark.appendChild(
            createBookmarkIcon()
        );


        actions.appendChild(
            bookmark
        );

    } else if (
        mode ===
        "watchlist"
    ) {
        const remove =
            createElement(
                "button",
                "media-item-action remove",
                "×"
            );


        remove.type =
            "button";


        remove.dataset.removeWatchlist =
            key;


        remove.title =
            "Remove from Watchlist";


        actions.appendChild(
            remove
        );
    }


    row.append(
        refresh,
        main,
        actions
    );


    loadAvailabilityIntoRow(
        row,
        media,
        generation
    );


    return row;
}


/*
 * ============================================================
 * CACHES
 * ============================================================
 */

function updateWatchlistCount() {
    watchlistCount.textContent =
        String(
            watchlistItems.length +
            continueWatchingItems.length +
            directLinkItems.length
        );
}


async function refreshWatchlistCache() {
    watchlistItems =
        await window
            .StreamShellWatchlist
            .getAll();


    updateWatchlistCount();
}


async function refreshDirectLinkCache() {
    directLinkItems =
        await window
            .StreamShellDirectLinks
            .getAll();


    updateWatchlistCount();
}


async function refreshContinueWatchingCache() {
    continueWatchingItems =
        await window
            .StreamShellContinueWatching
            .getAll();


    updateWatchlistCount();
}


async function refreshRecentCache() {
    recentItems =
        await window
            .StreamShellHistory
            .getAll();
}


function findWatchlistMedia(
    key
) {
    return watchlistItems.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findSearchMedia(
    key
) {
    return searchResults.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findRecentMedia(
    key
) {
    return recentItems.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findVisibleMedia(
    key
) {
    return (
        findSearchMedia(
            key
        ) ||
        findWatchlistMedia(
            key
        ) ||
        findRecentMedia(
            key
        )
    );
}


function isSaved(
    media
) {
    const key =
        getMediaKey(
            media
        );


    return watchlistItems.some(
        item =>
            getMediaKey(
                item
            ) ===
            key
    );
}


/*
 * ============================================================
 * WATCHLIST
 * ============================================================
 */

async function showWatchlist(
    customSubtitle =
        null
) {
    openPanel(
        "watchlist"
    );


    mediaPanelSubtitle.textContent =
        customSubtitle ||
        "Stored locally · availability checked live";


    await refreshWatchlistCache();


    if (
        watchlistItems.length ===
        0
    ) {
        renderPanelMessage(
            "Your Watchlist is empty",
            "Add movies and series from Search. The Watchlist is stored locally in Stream Shell.",
            {
                icon:
                    "♡"
            }
        );


        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (
        const media
        of getSortedWatchlistItems()
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "watchlist",

                    saved:
                        true,

                    addedAt:
                        media.addedAt
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


/*
 * ============================================================
 * CONTINUE WATCHING
 * ============================================================
 */

function formatPlaybackTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}


function createContinueWatchingItem(item) {
    const row = createElement("article", "media-item continue-watching-item");

    const providerIcon = createElement("button", "continue-provider-icon");
    providerIcon.type = "button";
    providerIcon.dataset.resumeContinue = item.id;
    providerIcon.title = `Resume on ${PROVIDER_NAMES[item.provider] || item.provider}`;

    const image = document.createElement("img");
    image.src = `../assets/providers/icons/${item.provider}.svg`;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    providerIcon.appendChild(image);

    const main = createElement("button", "media-item-main continue-watching-main");
    main.type = "button";
    main.dataset.resumeContinue = item.id;

    const titleRow = createElement("div", "media-item-title-row");
    titleRow.append(
        createElement("span", "media-item-title", item.title),
        createElement("span", "media-item-type", PROVIDER_NAMES[item.provider] || item.provider)
    );

    const progress = Number(item.progressPercent);
    const meta = createElement("div", "media-item-meta");
    meta.append(
        createElement("span", "", `${Number.isFinite(progress) ? progress.toFixed(1) : "—"}% watched`),
        createElement("span", "", `${formatPlaybackTime(item.currentTime)} / ${formatPlaybackTime(item.duration)}`),
        createElement("span", "", `Updated ${formatDateTime(item.updatedAt)}`)
    );

    const track = createElement("div", "continue-progress-track");
    const fill = createElement("div", "continue-progress-fill");
    fill.style.width = `${Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0}%`;
    track.appendChild(fill);

    main.append(titleRow, meta, track);

    const actions = createElement("div", "media-item-actions");
    const remove = createElement("button", "media-item-action remove", "×");
    remove.type = "button";
    remove.dataset.removeContinue = item.id;
    remove.title = "Remove from Continue Watching";
    actions.appendChild(remove);

    row.append(providerIcon, main, actions);
    return row;
}


function renderContinueWatchingSubtitle(completePercent) {
    mediaPanelSubtitle.replaceChildren();
    mediaPanelSubtitle.append(
        document.createTextNode("Resume across providers · completed at ")
    );

    const input = document.createElement("input");
    input.type = "number";
    input.className = "continue-complete-percent-input";
    input.min = "1";
    input.max = "100";
    input.step = "1";
    input.inputMode = "numeric";
    input.value = String(completePercent);
    input.setAttribute("aria-label", "Continue Watching completion percentage");
    input.title = "Completion threshold (1–100%)";

    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
        // Keep the field freely editable while focused. In particular, an
        // empty value must remain possible so the existing number can be
        // replaced without fighting an eager minimum-value clamp.
        if (input.value === "") return;

        const numeric = Number(input.value);
        if (!Number.isFinite(numeric)) return;
        if (numeric > 100) input.value = "100";
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            input.blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            input.value = String(completePercent);
            input.blur();
        }
    });
    input.addEventListener("change", async () => {
        const next = await window.StreamShellContinueWatching.setCompletePercent(
            input.value
        );
        input.value = String(next);
        await showContinueWatching();
    });

    mediaPanelSubtitle.append(
        input,
        document.createTextNode("%")
    );
}


async function showContinueWatching() {
    openPanel("continue");

    const completePercent = await window.StreamShellContinueWatching.getCompletePercent();
    renderContinueWatchingSubtitle(completePercent);
    await refreshContinueWatchingCache();

    if (continueWatchingItems.length === 0) {
        renderPanelMessage(
            "Nothing waiting to resume",
            `Titles appear here automatically while you watch through Stream Shell and disappear at ${completePercent}%.`,
            { icon: "▶" }
        );
        return;
    }

    const list = createElement("div", "media-list");
    for (const item of continueWatchingItems) {
        list.appendChild(createContinueWatchingItem(item));
    }
    mediaPanelBody.replaceChildren(list);
}


async function resumeContinueWatching(id) {
    const item = continueWatchingItems.find(entry => entry.id === id);
    if (!item) return;

    const response = await chrome.runtime.sendMessage({
        type: "landing-resume-provider",
        provider: item.provider,
        url: item.url,
        currentTime: item.currentTime,
        identity: item.id
    });

    if (response?.ok === false) {
        throw new Error(response.error || "Continue Watching resume failed.");
    }
}


async function removeContinueWatching(id) {
    await window.StreamShellContinueWatching.removeById(id);
    await showContinueWatching();
}


/*
 * ============================================================
 * RECENT
 * ============================================================
 */

async function showRecent() {
    openPanel(
        "recent"
    );


    mediaPanelSubtitle.textContent =
        "Last 10 titles opened through Stream Shell";


    await refreshRecentCache();


    if (
        recentItems.length ===
        0
    ) {
        renderPanelMessage(
            "Nothing opened yet",
            "Titles appear here after Stream Shell opens them through one of the providers.",
            {
                icon:
                    "↻"
            }
        );


        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (
        const media
        of recentItems
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "recent",

                    openedAt:
                        media.openedAt,

                    openedProvider:
                        media.provider
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


/*
 * ============================================================
 * DIRECT LINKS
 * ============================================================
 */

function createDirectLinkItem(
    item
) {
    const row =
        createElement(
            "article",
            "media-item direct-link-item"
        );


    const launch =
        createElement(
            "button",
            "direct-link-launch",
            "↗"
        );


    launch.type =
        "button";


    launch.dataset.openDirectLink =
        item.url;


    launch.title =
        "Open in regular Opera";


    const main =
        createElement(
            "div",
            "media-item-main direct-link-main"
        );


    const titleRow =
        createElement(
            "div",
            "media-item-title-row"
        );


    titleRow.append(
        createElement(
            "span",
            "media-item-title",
            item.title
        ),

        createElement(
            "span",
            "media-item-type",
            "Direct"
        )
    );


    const meta =
        createElement(
            "div",
            "media-item-meta"
        );


    meta.appendChild(
        createElement(
            "span",
            "",
            `Saved ${formatDateTime(
                item.savedAt
            )}`
        )
    );


    if (
        item.host
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                item.host
            )
        );
    }


    const link =
        createElement(
            "button",
            "direct-link-url",
            item.url
        );


    link.type =
        "button";


    link.dataset.openDirectLink =
        item.url;


    link.title =
        item.url;


    main.append(
        titleRow,
        meta,
        link
    );


    const actions =
        createElement(
            "div",
            "media-item-actions"
        );


    const remove =
        createElement(
            "button",
            "media-item-action remove",
            "×"
        );


    remove.type =
        "button";


    remove.dataset.removeDirectLink =
        item.url;


    remove.title =
        "Remove direct link";


    actions.appendChild(
        remove
    );


    row.append(
        launch,
        main,
        actions
    );


    return row;
}


async function showDirectLinks() {
    openPanel(
        "direct"
    );


    mediaPanelSubtitle.textContent =
        "Saved from Opera · opens outside Stream Shell";


    await refreshDirectLinkCache();


    if (
        directLinkItems.length ===
        0
    ) {
        renderPanelMessage(
            "No direct links saved",
            "Use the Stream Shell extension button in Opera and choose ‘Save current page’. Direct links are stored locally with the Watchlist.",
            {
                icon:
                    "↗"
            }
        );


        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (
        const item
        of directLinkItems
    ) {
        list.appendChild(
            createDirectLinkItem(
                item
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


async function removeDirectLink(
    url
) {
    await window
        .StreamShellDirectLinks
        .remove(
            url
        );


    await showDirectLinks();
}


async function openDirectLink(
    url
) {
    const response =
        await chrome.runtime.sendMessage({
            type:
                "open-direct-link",

            url
        });


    if (
        response?.ok ===
        false
    ) {
        throw new Error(
            response.error ||
            "Direct link could not be opened."
        );
    }
}


/*
 * ============================================================
 * WATCHLIST MODIFICATION
 * ============================================================
 */

async function removeWatchlistItem(
    key
) {
    const media =
        findWatchlistMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    await window
        .StreamShellWatchlist
        .remove(
            media
        );


    if (
        selectedMediaKey ===
        key
    ) {
        selectedMediaKey =
            null;


        await window
            .StreamShellAvailability
            .clearSelectedMedia();
    }


    await showWatchlist();
}


async function toggleWatchlistForSearch(
    key
) {
    const media =
        findSearchMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    await window
        .StreamShellWatchlist
        .toggle(
            media
        );


    await refreshWatchlistCache();


    if (
        activePanel ===
        "search"
    ) {
        renderSearchResults(
            searchResults,
            searchGeneration
        );
    }
}


/*
 * ============================================================
 * SEARCH
 * ============================================================
 */

function showSearchHint() {
    searchHeaderTitle.textContent =
        "Search";


    mediaPanelSubtitle.textContent =
        "Movies and series · current availability in Germany";


    renderPanelMessage(
        "What do you want to watch?",
        "Enter at least two characters. Stream Shell will search for movies and series and check their current streaming availability.",
        {
            icon:
                "⌕"
        }
    );
}


function renderSearchResults(
    results,
    generation
) {
    searchHeaderTitle.textContent =
        "Search Results";


    mediaPanelSubtitle.textContent =
        `${results.length} ${
            results.length ===
                1
                ? "result"
                : "results"
        } · Germany`;


    if (
        results.length ===
        0
    ) {
        renderPanelMessage(
            "No results",
            "No matching movies or series were found.",
            {
                icon:
                    "×"
            }
        );


        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (
        const media
        of results
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "search",

                    saved:
                        isSaved(
                            media
                        ),

                    generation
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


async function runSearch(
    query,
    generation
) {
    try {
        const hasToken =
            await window
                .StreamShellMediaApi
                .hasToken();


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        if (
            !hasToken
        ) {
            await renderTokenSetup(
                () => {
                    if (
                        activePanel ===
                        "search"
                    ) {
                        scheduleSearch(
                            true
                        );
                    }
                }
            );


            return;
        }


        renderPanelMessage(
            "Searching...",
            `Searching for “${query}” and checking streaming availability.`,
            {
                icon:
                    "…"
            }
        );


        const results =
            await window
                .StreamShellMediaApi
                .searchMedia(
                    query
                );


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        searchResults =
            results;


        await refreshWatchlistCache();


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        renderSearchResults(
            results,
            generation
        );

    } catch (error) {

        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        console.error(
            "Media search failed:",
            error
        );


        if (
            error?.code ===
                "TMDB_TOKEN_MISSING" ||
            error?.code ===
                "TMDB_TOKEN_INVALID"
        ) {
            await renderTokenSetup(
                () => {
                    scheduleSearch(
                        true
                    );
                }
            );


            return;
        }


        renderPanelMessage(
            "Search failed",
            "TMDB could not be reached. Try again.",
            {
                icon:
                    "×",

                error:
                    true
            }
        );
    }
}


function scheduleSearch(
    immediate =
        false
) {
    openPanel(
        "search"
    );


    const query =
        mediaSearchInput
            .value
            .trim();


    mediaSearchClear.hidden =
        query.length ===
        0;


    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    const generation =
        searchGeneration;


    searchResults =
        [];


    if (
        query.length <
        2
    ) {
        showSearchHint();

        return;
    }


    searchTimer =
        setTimeout(
            () => {
                runSearch(
                    query,
                    generation
                );
            },

            immediate
                ? 0
                : 300
        );
}


async function clearSearch() {
    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    searchResults =
        [];


    selectedMediaKey =
        null;


    mediaSearchInput.value =
        "";


    mediaSearchClear.hidden =
        true;


    await window
        .StreamShellAvailability
        .clearSelectedMedia();


    openPanel(
        "search"
    );


    showSearchHint();


    mediaSearchInput.focus();
}


/*
 * ============================================================
 * SELECT MEDIA
 * ============================================================
 */

async function selectMediaByKey(
    key
) {
    /*
     * ============================================================
     * DESELECT CURRENT MEDIA
     * ============================================================
     *
     * Clicking the currently selected title again clears the
     * selection completely.
     */

    if (
        selectedMediaKey ===
        key
    ) {
        selectedMediaKey =
            null;


        await window
            .StreamShellAvailability
            .clearSelectedMedia();


        mediaPanelBody
            .querySelectorAll(
                ".media-item.selected"
            )
            .forEach(
                item => {
                    item.classList.remove(
                        "selected"
                    );
                }
            );


        return;
    }


    const media =
        findVisibleMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    const row =
        mediaPanelBody.querySelector(
            `.media-item[data-media-key="${CSS.escape(
                key
            )}"]`
        );


    let availability =
        row
            ?.__streamShellAvailability ||
        null;


    if (
        !availability ||
        availability.error
    ) {
        try {
            availability =
                await window
                    .StreamShellAvailability
                    .getAvailability(
                        media
                    );

        } catch (error) {

            console.error(
                "Selected media availability failed:",
                error
            );


            availability = {
                error:
                    (
                        error?.code ===
                            "TMDB_TOKEN_MISSING" ||
                        error?.code ===
                            "TMDB_TOKEN_INVALID"
                    )
                        ? "token"
                        : "generic"
            };
        }
    }


    selectedMediaKey =
        key;


    await window
        .StreamShellAvailability
        .selectMedia(
            media,
            availability
        );


    mediaPanelBody
        .querySelectorAll(
            ".media-item"
        )
        .forEach(
            item => {
                item.classList.toggle(
                    "selected",

                    item.dataset.mediaKey ===
                        key
                );
            }
        );
}


/*
 * ============================================================
 * MANUAL REFRESH
 * ============================================================
 */

async function refreshMediaAvailability(
    key,
    button
) {
    const media =
        findVisibleMedia(
            key
        );


    const row =
        button.closest(
            ".media-item"
        );


    if (
        !media ||
        !row
    ) {
        return;
    }


    await loadAvailabilityIntoRow(
        row,
        media,
        null,
        true
    );
}


/*
 * ============================================================
 * SELECTED STATE
 * ============================================================
 */

async function loadSelectedMediaState() {
    const key =
        window
            .StreamShellAvailability
            .SELECTED_MEDIA_KEY;


    const stored =
        await chrome.storage.local.get(
            key
        );


    const media =
        stored[
            key
        ];


    selectedMediaKey =
        media
            ? getMediaKey(
                media
            )
            : null;
}


/*
 * ============================================================
 * WATCHLIST EXPORT / IMPORT
 * ============================================================
 */

function getExportFileName() {
    const date =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    return `stream-shell-watchlist-${date}.json`;
}


async function exportWatchlist() {
    const [
        items,
        directLinks,
        continueWatching
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    const payload = {
        format:
            "stream-shell-watchlist",

        version:
            3,

        exportedAt:
            new Date()
                .toISOString(),

        items,

        directLinks,

        continueWatching
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        url;


    anchor.download =
        getExportFileName();


    anchor.style.display =
        "none";


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();


    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );
}


async function importWatchlistFile(
    file
) {
    const text =
        await file.text();


    const parsed =
        JSON.parse(
            text
        );


    const items =
        Array.isArray(
            parsed
        )
            ? parsed
            : parsed?.items;


    const directLinks =
        Array.isArray(
            parsed?.directLinks
        )
            ? parsed.directLinks
            : [];


    const continueWatching =
        Array.isArray(
            parsed?.continueWatching
        )
            ? parsed.continueWatching
            : [];


    if (
        !Array.isArray(
            items
        ) &&
        directLinks.length ===
            0 &&
        continueWatching.length ===
            0
    ) {
        throw new Error(
            "The selected file does not contain a Stream Shell Watchlist."
        );
    }


    const [
        beforeTitles,
        beforeLinks,
        beforeContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    await Promise.all([
        window
            .StreamShellWatchlist
            .merge(
                Array.isArray(
                    items
                )
                    ? items
                    : []
            ),
        window
            .StreamShellDirectLinks
            .merge(
                directLinks
            ),
        window
            .StreamShellContinueWatching
            .merge(
                continueWatching
            )
    ]);


    const [
        afterTitles,
        afterLinks,
        afterContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    const addedTitles =
        Math.max(
            0,
            afterTitles.length -
            beforeTitles.length
        );


    const addedLinks =
        Math.max(
            0,
            afterLinks.length -
            beforeLinks.length
        );


    const addedContinue =
        Math.max(
            0,
            afterContinue.length -
            beforeContinue.length
        );


    await Promise.all([
        refreshDirectLinkCache(),
        refreshContinueWatchingCache()
    ]);


    await showWatchlist(
        `Imported ${addedTitles} ${
            addedTitles ===
                1
                ? "title"
                : "titles"
        } · ${addedLinks} ${
            addedLinks ===
                1
                ? "direct link"
                : "direct links"
        } · ${addedContinue} continue`
    );
}


/*
 * ============================================================
 * EVENTS
 * ============================================================
 */

subscriptionSyncButton.addEventListener(
    "click",
    () => {
        syncSubscriptions()
            .catch(
                () => {}
            );
    }
);


watchlistToggle.addEventListener(
    "click",
    () => {
        const libraryOpen =
            !mediaPanel.hidden &&
            (
                activePanel ===
                    "watchlist" ||
                activePanel ===
                    "continue" ||
                activePanel ===
                    "recent" ||
                activePanel ===
                    "direct"
            );


        if (
            libraryOpen
        ) {
            closePanel();

            return;
        }


        const openLastLibraryPanel =
            lastLibraryPanel ===
                "continue"
                ? showContinueWatching
                : lastLibraryPanel ===
                    "recent"
                    ? showRecent
                    : lastLibraryPanel ===
                        "direct"
                        ? showDirectLinks
                        : showWatchlist;


        openLastLibraryPanel()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


watchlistTab.addEventListener(
    "click",
    () => {
        showWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


continueTab.addEventListener(
    "click",
    () => {
        showContinueWatching()
            .catch(
                error => {
                    console.error(
                        "Continue Watching failed:",
                        error
                    );
                }
            );
    }
);


recentTab.addEventListener(
    "click",
    () => {
        showRecent()
            .catch(
                error => {
                    console.error(
                        "Recent list failed:",
                        error
                    );
                }
            );
    }
);



directTab.addEventListener(
    "click",
    () => {
        showDirectLinks()
            .catch(
                error => {
                    console.error(
                        "Direct links failed:",
                        error
                    );
                }
            );
    }
);


watchlistImportButton.addEventListener(
    "click",
    () => {
        watchlistImportInput.value =
            "";


        watchlistImportInput.click();
    }
);


watchlistImportInput.addEventListener(
    "change",
    async () => {
        const file =
            watchlistImportInput
                .files?.[0];


        if (
            !file
        ) {
            return;
        }


        try {
            await importWatchlistFile(
                file
            );

        } catch (error) {

            console.error(
                "Watchlist import failed:",
                error
            );


            openPanel(
                "watchlist"
            );


            renderPanelMessage(
                "Import failed",
                "The selected file is not a valid Stream Shell Watchlist export.",
                {
                    icon:
                        "×",

                    error:
                        true
                }
            );
        }
    }
);


watchlistExportButton.addEventListener(
    "click",
    () => {
        exportWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist export failed:",
                        error
                    );
                }
            );
    }
);


watchlistSort.addEventListener(
    "change",
    async () => {
        await saveWatchlistSortPreference(
            watchlistSort.value
        );


        if (
            activePanel ===
                "watchlist" &&
            !mediaPanel.hidden
        ) {
            await showWatchlist();
        }
    }
);


mediaSearchInput.addEventListener(
    "focus",
    () => {
        if (
            activePanel !==
                "search" ||
            mediaPanel.hidden
        ) {
            scheduleSearch(
                true
            );
        }
    }
);


mediaSearchInput.addEventListener(
    "input",
    () => {
        scheduleSearch();
    }
);


mediaSearchClear.addEventListener(
    "click",
    event => {
        event.preventDefault();

        event.stopPropagation();


        clearSearch()
            .catch(
                () => {}
            );
    }
);


mediaPanelClose.addEventListener(
    "click",
    closePanel
);


async function refreshDiscordButtonFromNative() {
    if (
        !discordButton ||
        !discordButton.classList.contains(
            "active"
        )
    ) {
        return;
    }


    try {
        const status =
            await chrome.runtime.sendMessage({
                type:
                    "get-discord-status"
            });


        if (
            status?.ok
        ) {
            const active =
                status.visible ===
                    true;


            discordButton.classList.toggle(
                "active",
                active
            );


            discordButton.setAttribute(
                "aria-pressed",
                active
                    ? "true"
                    : "false"
            );
        }
    } catch {
    }
}


/*
 * Native Discord can be minimized or closed-to-tray without producing an
 * Opera window event. Poll while Landing is actually visible; focus/
 * visibility events perform an immediate catch-up after a hidden period.
 */
let discordNativeStatusTimer = null;

function scheduleDiscordNativeStatusPoll(
    immediate = false
) {
    if (discordNativeStatusTimer) {
        clearTimeout(discordNativeStatusTimer);
        discordNativeStatusTimer = null;
    }

    if (
        document.visibilityState ===
            "hidden"
    ) {
        return;
    }

    discordNativeStatusTimer = setTimeout(
        async () => {
            discordNativeStatusTimer = null;
            await refreshDiscordButtonFromNative();
            scheduleDiscordNativeStatusPoll();
        },
        immediate ? 0 : 2000
    );
}

scheduleDiscordNativeStatusPoll();

document.addEventListener(
    "visibilitychange",
    () => {
        scheduleDiscordNativeStatusPoll(
            document.visibilityState !==
                "hidden"
        );
    }
);

window.addEventListener(
    "focus",
    () => {
        scheduleDiscordNativeStatusPoll(
            true
        );
    }
);


discordButton.addEventListener(
    "click",
    async () => {
        discordButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "landing-show-discord"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Discord desktop bridge failed."
                );
            }
        } catch (error) {
            console.error(
                "Discord desktop failed:",
                error
            );
        } finally {
            discordButton.classList.remove(
                "busy"
            );
        }
    }
);


if (twitchUtility && twitchOpenButton && twitchDropsButton) {
    const openTwitchTarget = async target => {
        twitchUtility.classList.add("busy");
        try {
            const response = await chrome.runtime.sendMessage({
                type: "landing-show-twitch",
                target
            });
            if (response?.ok === false) {
                throw new Error(response.error || "Twitch utility failed.");
            }
        } catch (error) {
            console.error("Twitch utility failed:", error);
        } finally {
            twitchUtility.classList.remove("busy");
        }
    };

    twitchOpenButton.addEventListener("click", () => {
        openTwitchTarget("resume");
    });

    twitchDropsButton.addEventListener("click", () => {
        openTwitchTarget("drops");
    });
}


restoreHomeLayoutButton.addEventListener(
    "click",
    async () => {
        restoreHomeLayoutButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "restore-home-layout"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Home layout restore failed."
                );
            }
        } catch (error) {
            console.error(
                "Home layout restore failed:",
                error
            );
        } finally {
            restoreHomeLayoutButton.classList.remove(
                "busy"
            );
        }
    }
);


tmdbTokenButton.addEventListener(
    "click",
    () => {
        openPanel(
            "search"
        );


        renderTokenSetup(
            () => {
                scheduleSearch(
                    true
                );
            }
        );
    }
);


mediaPanelBody.addEventListener(
    "click",
    event => {
        const button =
            event.target.closest(
                "button"
            );


        if (
            !button
        ) {
            return;
        }


        if (
            button.dataset
                .refreshAvailability
        ) {
            refreshMediaAvailability(
                button.dataset
                    .refreshAvailability,
                button
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .selectMedia
        ) {
            selectMediaByKey(
                button.dataset
                    .selectMedia
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .toggleWatchlist
        ) {
            toggleWatchlistForSearch(
                button.dataset
                    .toggleWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .removeWatchlist
        ) {
            removeWatchlistItem(
                button.dataset
                    .removeWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .resumeContinue
        ) {
            resumeContinueWatching(
                button.dataset
                    .resumeContinue
            )
                .catch(
                    error => {
                        console.error(
                            "Continue Watching resume failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeContinue
        ) {
            removeContinueWatching(
                button.dataset
                    .removeContinue
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .openDirectLink
        ) {
            openDirectLink(
                button.dataset
                    .openDirectLink
            )
                .catch(
                    error => {
                        console.error(
                            "Direct link open failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeDirectLink
        ) {
            removeDirectLink(
                button.dataset
                    .removeDirectLink
            )
                .catch(
                    () => {}
                );
        }
    }
);


document.addEventListener(
    "keydown",
    event => {
        if (
            event.key ===
                "Escape" &&
            !mediaPanel.hidden
        ) {
            closePanel();
        }
    }
);


/*
 * ============================================================
 * STORAGE UPDATES
 * ============================================================
 */

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {
        if (
            areaName !==
            "local"
        ) {
            return;
        }


        if (
            changes[
                PENDING_LANDING_PANEL_KEY
            ]?.newValue ===
                "direct"
        ) {
            chrome.storage.local.remove(
                PENDING_LANDING_PANEL_KEY
            );

            showDirectLinks()
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                SUBSCRIPTION_STORAGE_KEY
            ]
        ) {
            renderSubscriptionState(
                changes[
                    SUBSCRIPTION_STORAGE_KEY
                ].newValue
            );
        }


        if (
            changes[
                window
                    .StreamShellWatchlist
                    .STORAGE_KEY
            ]
        ) {
            refreshWatchlistCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "watchlist" &&
                            !mediaPanel.hidden
                        ) {
                            showWatchlist();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellDirectLinks
                    .STORAGE_KEY
            ]
        ) {
            refreshDirectLinkCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "direct" &&
                            !mediaPanel.hidden
                        ) {
                            showDirectLinks();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellContinueWatching
                    .STORAGE_KEY
            ]
        ) {
            refreshContinueWatchingCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "continue" &&
                            !mediaPanel.hidden
                        ) {
                            showContinueWatching();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellHistory
                    .STORAGE_KEY
            ]
        ) {
            if (
                activePanel ===
                    "recent" &&
                !mediaPanel.hidden
            ) {
                showRecent()
                    .catch(
                        () => {}
                    );
            }
        }


        if (
            changes[
                window
                    .StreamShellAvailability
                    .SELECTED_MEDIA_KEY
            ]
        ) {
            const media =
                changes[
                    window
                        .StreamShellAvailability
                        .SELECTED_MEDIA_KEY
                ].newValue;


            selectedMediaKey =
                media
                    ? getMediaKey(
                        media
                    )
                    : null;
        }
    }
);


/*
 * ============================================================
 * INITIAL STATE
 * ============================================================
 */

Promise.all([
    loadSubscriptionState(),
    refreshWatchlistCache(),
    refreshDirectLinkCache(),
    refreshContinueWatchingCache(),
    refreshRecentCache(),
    loadSelectedMediaState(),
    loadWatchlistSortPreference()
])
    .then(
        async () => {
            const pending =
                await chrome.storage.local.get(
                    PENDING_LANDING_PANEL_KEY
                );


            if (
                pending[
                    PENDING_LANDING_PANEL_KEY
                ] ===
                    "direct"
            ) {
                await chrome.storage.local.remove(
                    PENDING_LANDING_PANEL_KEY
                );

                await showDirectLinks();
            }
        }
    )
    .catch(
        () => {}
    );


chrome.runtime.sendMessage({
    type:
        "get-state"
})
    .then(
        renderState
    )
    .catch(
        () => {}
    );


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message.type ===
            "state-changed"
        ) {
            renderState(
                message
            );
        }
    }
);


/*
 * ============================================================
 * BACKGROUND STATE
 * ============================================================
 */

function renderState(
    state
) {
    let provider =
        state?.activeProvider ||
        "netflix";


    if (
        !PROVIDERS.has(
            provider
        )
    ) {
        provider =
            "netflix";
    }


    document.body.dataset.provider =
        provider;


    const rightMode =
        state?.rightMode ||
        "dashboard";


    if (
        discordButton
    ) {
        discordButton.classList.toggle(
            "active",
            rightMode ===
                "discord"
        );

        discordButton.setAttribute(
            "aria-pressed",
            rightMode ===
                "discord"
                ? "true"
                : "false"
        );
    }


    if (twitchUtility) {
        twitchUtility.classList.toggle(
            "active",
            rightMode === "twitch"
        );
    }


    const backgroundVariant =
        document.body.dataset.layoutProfile === "compact"
            ? "compact"
            : "wide";


    const backgroundUrl =
        chrome.runtime.getURL(
            `assets/backgrounds/${provider}_${backgroundVariant}.png`
        );


    panorama.style.backgroundImage =
        `url("${backgroundUrl}")`;
}