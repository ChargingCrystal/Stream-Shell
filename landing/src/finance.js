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
