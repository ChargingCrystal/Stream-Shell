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


